"""LiveKit Agents voice pipeline: STT -> LLM -> TTS.

Connects to a LiveKit room as a participant, listens for audio via STT,
processes with an LLM, and responds via TTS. Gracefully degrades when
the LiveKit SDK or provider API keys are unavailable.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("voice-agent.pipeline")

# Probe for LiveKit SDK availability at import time
try:
    from livekit import rtc, api as lk_api
    from livekit.agents import (
        AutoSubscribe,
        JobContext,
        WorkerOptions,
        llm as agents_llm,
        stt as agents_stt,
        tts as agents_tts,
        VoicePipelineAgent,
    )

    LIVEKIT_AVAILABLE = True
except ImportError:
    LIVEKIT_AVAILABLE = False
    logger.info(
        "LiveKit Agents SDK not installed. Voice pipeline will run in log-only mode."
    )

# Probe for provider plugins
try:
    from livekit.plugins import silero as silero_vad

    SILERO_AVAILABLE = True
except ImportError:
    SILERO_AVAILABLE = False

try:
    import openai as _openai_mod

    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    import anthropic as _anthropic_mod

    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False


@dataclass
class PipelineConfig:
    """Configuration for the voice pipeline."""

    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    stt_provider: Optional[str] = None  # "deepgram", "openai", "whisper"
    stt_api_key: str = ""

    llm_provider: Optional[str] = None  # "openai", "anthropic"
    llm_api_key: str = ""
    llm_model: Optional[str] = None

    tts_provider: Optional[str] = None  # "openai", "elevenlabs"
    tts_api_key: str = ""
    tts_voice: Optional[str] = None

    system_prompt: str = "You are a helpful voice assistant."

    @property
    def livekit_available(self) -> bool:
        return LIVEKIT_AVAILABLE

    @property
    def stt_ready(self) -> bool:
        if not self.stt_provider:
            # Auto-detect: if we have an OpenAI key, use OpenAI whisper
            return bool(self.stt_api_key)
        return True

    @property
    def llm_ready(self) -> bool:
        if not self.llm_provider:
            return bool(self.llm_api_key)
        return bool(self.llm_api_key)

    @property
    def tts_ready(self) -> bool:
        if not self.tts_provider:
            return bool(self.tts_api_key)
        return True


class AgentPipeline:
    """Manages a LiveKit voice pipeline for a single call.

    If the LiveKit SDK is not available, all methods are no-ops that log.
    If provider API keys are missing, the pipeline enters degraded mode
    where it joins the room but does not process audio.
    """

    def __init__(self, config: PipelineConfig):
        self._config = config
        self._room: Optional[object] = None  # livekit.rtc.Room when connected
        self._pipeline_task: Optional[asyncio.Task] = None
        self._connected = False
        self._shutdown_event = asyncio.Event()

    def can_connect(self) -> bool:
        """True if the minimum requirements for a voice connection are met."""
        return (
            LIVEKIT_AVAILABLE
            and bool(self._config.livekit_url)
            and bool(self._config.livekit_api_key)
            and bool(self._config.livekit_api_secret)
        )

    def missing_requirements(self) -> list[str]:
        """Return a list of missing requirements for a voice connection."""
        missing = []
        if not LIVEKIT_AVAILABLE:
            missing.append("livekit-agents SDK")
        if not self._config.livekit_url:
            missing.append("LIVEKIT_URL")
        if not self._config.livekit_api_key:
            missing.append("LIVEKIT_API_KEY")
        if not self._config.livekit_api_secret:
            missing.append("LIVEKIT_API_SECRET")
        if not self._config.stt_ready:
            missing.append("STT provider/key")
        if not self._config.llm_ready:
            missing.append("LLM provider/key")
        if not self._config.tts_ready:
            missing.append("TTS provider/key")
        return missing

    def is_connected(self) -> bool:
        return self._connected

    async def connect(self, room_name: str, agent_id: str) -> None:
        """Connect to a LiveKit room and start the voice pipeline."""
        if not LIVEKIT_AVAILABLE:
            logger.warning("Cannot connect: LiveKit SDK not available")
            return

        # Generate a token for the agent to join the room
        token = (
            lk_api.AccessToken(
                self._config.livekit_api_key, self._config.livekit_api_secret
            )
            .with_identity(agent_id)
            .with_name("AI Assistant")
            .with_grants(
                lk_api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                )
            )
            .to_jwt()
        )

        # Connect to the room
        room = rtc.Room()
        await room.connect(self._config.livekit_url, token)
        self._room = room
        self._connected = True

        logger.info("Agent %s connected to room %s", agent_id, room_name)

        # If all providers are ready, start the full voice pipeline
        if self._config.stt_ready and self._config.llm_ready and self._config.tts_ready:
            self._pipeline_task = asyncio.create_task(
                self._run_voice_pipeline(room, agent_id)
            )
        else:
            missing = self.missing_requirements()
            logger.info(
                "Agent %s connected but pipeline incomplete (%s). "
                "Listening only (no STT/LLM/TTS).",
                agent_id,
                ", ".join(missing),
            )

    async def _run_voice_pipeline(self, room: "rtc.Room", agent_id: str) -> None:
        """Run the STT -> LLM -> TTS pipeline using LiveKit Agents SDK."""
        try:
            stt_instance = self._create_stt()
            llm_instance = self._create_llm()
            tts_instance = self._create_tts()
            vad_instance = self._create_vad()

            if not all([stt_instance, llm_instance, tts_instance]):
                logger.warning(
                    "Agent %s: could not create all pipeline components. Listening only.",
                    agent_id,
                )
                return

            initial_context = agents_llm.ChatContext()
            initial_context.append(
                role="system",
                text=self._config.system_prompt,
            )

            pipeline_kwargs = {
                "stt": stt_instance,
                "llm": llm_instance,
                "tts": tts_instance,
                "chat_ctx": initial_context,
            }
            if vad_instance:
                pipeline_kwargs["vad"] = vad_instance

            agent = VoicePipelineAgent(**pipeline_kwargs)

            # The agent starts processing audio from the room
            agent.start(room)

            logger.info("Voice pipeline started for agent %s", agent_id)

            # Wait until shutdown is requested
            await self._shutdown_event.wait()

        except Exception as exc:
            logger.error(
                "Voice pipeline error for agent %s: %s", agent_id, exc, exc_info=True
            )

    def _create_stt(self) -> Optional[object]:
        """Create the STT component based on config."""
        if not LIVEKIT_AVAILABLE:
            return None

        provider = self._config.stt_provider or "openai"
        api_key = self._config.stt_api_key

        if not api_key:
            logger.warning("No STT API key available for provider '%s'", provider)
            return None

        try:
            if provider in ("openai", "whisper"):
                from livekit.plugins.openai import STT as OpenAISTT

                return OpenAISTT(api_key=api_key)
            elif provider == "deepgram":
                from livekit.plugins.deepgram import STT as DeepgramSTT

                return DeepgramSTT(api_key=api_key)
            else:
                logger.warning("Unknown STT provider: %s. Trying OpenAI.", provider)
                from livekit.plugins.openai import STT as OpenAISTT

                return OpenAISTT(api_key=api_key)
        except ImportError:
            logger.warning(
                "STT plugin for '%s' not installed. Install livekit-plugins-%s.",
                provider,
                provider,
            )
            return None
        except Exception as exc:
            logger.warning("Failed to create STT (%s): %s", provider, exc)
            return None

    def _create_llm(self) -> Optional[object]:
        """Create the LLM component based on config."""
        if not LIVEKIT_AVAILABLE:
            return None

        provider = self._config.llm_provider or self._detect_llm_provider()
        api_key = self._config.llm_api_key
        model = self._config.llm_model

        if not api_key:
            logger.warning("No LLM API key available for provider '%s'", provider)
            return None

        try:
            if provider == "openai":
                from livekit.plugins.openai import LLM as OpenAILLM

                kwargs = {"api_key": api_key}
                if model:
                    kwargs["model"] = model
                return OpenAILLM(**kwargs)
            elif provider == "anthropic":
                from livekit.plugins.anthropic import LLM as AnthropicLLM

                kwargs = {"api_key": api_key}
                if model:
                    kwargs["model"] = model
                return AnthropicLLM(**kwargs)
            else:
                logger.warning(
                    "Unknown LLM provider: %s. Trying OpenAI.", provider
                )
                from livekit.plugins.openai import LLM as OpenAILLM

                return OpenAILLM(api_key=api_key)
        except ImportError:
            logger.warning(
                "LLM plugin for '%s' not installed. Install livekit-plugins-%s.",
                provider,
                provider,
            )
            return None
        except Exception as exc:
            logger.warning("Failed to create LLM (%s): %s", provider, exc)
            return None

    def _create_tts(self) -> Optional[object]:
        """Create the TTS component based on config."""
        if not LIVEKIT_AVAILABLE:
            return None

        provider = self._config.tts_provider or "openai"
        api_key = self._config.tts_api_key
        voice = self._config.tts_voice

        if not api_key:
            logger.warning("No TTS API key available for provider '%s'", provider)
            return None

        try:
            if provider == "openai":
                from livekit.plugins.openai import TTS as OpenAITTS

                kwargs = {"api_key": api_key}
                if voice:
                    kwargs["voice"] = voice
                return OpenAITTS(**kwargs)
            elif provider == "elevenlabs":
                from livekit.plugins.elevenlabs import TTS as ElevenLabsTTS

                kwargs = {"api_key": api_key}
                if voice:
                    kwargs["voice_id"] = voice
                return ElevenLabsTTS(**kwargs)
            else:
                logger.warning(
                    "Unknown TTS provider: %s. Trying OpenAI.", provider
                )
                from livekit.plugins.openai import TTS as OpenAITTS

                return OpenAITTS(api_key=api_key)
        except ImportError:
            logger.warning(
                "TTS plugin for '%s' not installed. Install livekit-plugins-%s.",
                provider,
                provider,
            )
            return None
        except Exception as exc:
            logger.warning("Failed to create TTS (%s): %s", provider, exc)
            return None

    def _create_vad(self) -> Optional[object]:
        """Create Voice Activity Detection using Silero if available."""
        if not LIVEKIT_AVAILABLE or not SILERO_AVAILABLE:
            return None
        try:
            return silero_vad.VAD.load()
        except Exception as exc:
            logger.warning("Failed to load Silero VAD: %s", exc)
            return None

    def _detect_llm_provider(self) -> str:
        """Auto-detect LLM provider based on available API keys."""
        import os

        if os.environ.get("ANTHROPIC_API_KEY"):
            return "anthropic"
        return "openai"

    async def disconnect(self) -> None:
        """Disconnect from the room and stop the pipeline."""
        self._shutdown_event.set()

        if self._pipeline_task and not self._pipeline_task.done():
            self._pipeline_task.cancel()
            try:
                await self._pipeline_task
            except (asyncio.CancelledError, Exception):
                pass

        if self._room and LIVEKIT_AVAILABLE:
            try:
                await self._room.disconnect()
            except Exception as exc:
                logger.warning("Error disconnecting from room: %s", exc)

        self._connected = False
        self._room = None
        logger.info("Pipeline disconnected")
