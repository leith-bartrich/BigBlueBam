"""Offline STT transcription for recorded calls.

Supports OpenAI Whisper and Deepgram for batch audio transcription.
Returns transcript segments with timestamps and confidence scores.
"""

import logging
from typing import Optional

logger = logging.getLogger("voice-agent.stt")


async def transcribe_audio(
    audio_data: bytes, config: "PipelineConfig"
) -> list[dict]:
    """Transcribe raw audio bytes using the configured STT provider.

    Returns a list of segment dicts:
        [{"text": "...", "start": 0.0, "end": 1.5, "confidence": 0.95}, ...]

    Raises if no STT provider is configured or transcription fails.
    """
    from .pipeline import PipelineConfig

    provider = config.stt_provider or "openai"
    api_key = config.stt_api_key

    if not api_key:
        raise ValueError("No STT API key configured for offline transcription")

    if provider in ("openai", "whisper"):
        return await _transcribe_openai(audio_data, api_key)
    elif provider == "deepgram":
        return await _transcribe_deepgram(audio_data, api_key)
    else:
        logger.warning("Unknown STT provider '%s', falling back to OpenAI", provider)
        return await _transcribe_openai(audio_data, api_key)


async def _transcribe_openai(audio_data: bytes, api_key: str) -> list[dict]:
    """Transcribe using OpenAI Whisper API."""
    try:
        import openai
    except ImportError:
        raise RuntimeError(
            "openai package not installed. Install it with: pip install openai"
        )

    import io

    client = openai.AsyncOpenAI(api_key=api_key)

    # Whisper expects a file-like object with a name
    audio_file = io.BytesIO(audio_data)
    audio_file.name = "recording.webm"

    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format="verbose_json",
        timestamp_granularities=["segment"],
    )

    segments = []
    if hasattr(response, "segments") and response.segments:
        for seg in response.segments:
            segments.append(
                {
                    "text": seg.get("text", "").strip() if isinstance(seg, dict) else getattr(seg, "text", "").strip(),
                    "start": seg.get("start", 0.0) if isinstance(seg, dict) else getattr(seg, "start", 0.0),
                    "end": seg.get("end", 0.0) if isinstance(seg, dict) else getattr(seg, "end", 0.0),
                    "confidence": 1.0
                    - (
                        seg.get("no_speech_prob", 0.0)
                        if isinstance(seg, dict)
                        else getattr(seg, "no_speech_prob", 0.0)
                    ),
                }
            )
    elif hasattr(response, "text") and response.text:
        # Fallback: single segment for the entire audio
        segments.append(
            {
                "text": response.text.strip(),
                "start": 0.0,
                "end": 0.0,
                "confidence": 0.9,
            }
        )

    return segments


async def _transcribe_deepgram(audio_data: bytes, api_key: str) -> list[dict]:
    """Transcribe using Deepgram API (direct HTTP, no SDK dependency)."""
    import httpx

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": "audio/webm",
            },
            params={
                "model": "nova-2",
                "smart_format": "true",
                "utterances": "true",
                "punctuate": "true",
            },
            content=audio_data,
        )
        resp.raise_for_status()
        result = resp.json()

    segments = []
    utterances = result.get("results", {}).get("utterances", [])
    if utterances:
        for utt in utterances:
            segments.append(
                {
                    "text": utt.get("transcript", "").strip(),
                    "start": utt.get("start", 0.0),
                    "end": utt.get("end", 0.0),
                    "confidence": utt.get("confidence", 0.0),
                }
            )
    else:
        # Fall back to channel/alternatives
        channels = result.get("results", {}).get("channels", [])
        for channel in channels:
            for alt in channel.get("alternatives", []):
                if alt.get("transcript"):
                    segments.append(
                        {
                            "text": alt["transcript"].strip(),
                            "start": 0.0,
                            "end": 0.0,
                            "confidence": alt.get("confidence", 0.0),
                        }
                    )

    return segments
