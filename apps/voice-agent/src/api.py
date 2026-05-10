"""Banter Voice Agent -- FastAPI service with LiveKit Agents SDK pipeline.

Provides STT -> LLM -> TTS voice agent functionality for Banter calls.
Gracefully degrades when provider API keys or LiveKit SDK are not available.
"""

import os
import time
import uuid
import logging
import asyncio
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .pipeline import AgentPipeline, PipelineConfig
from .registry import AgentRegistry

logger = logging.getLogger("voice-agent")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Banter Voice Agent", version="0.5.0")

# ── State ───────────────────────────────────────────────────────
# Two layers:
#   - `agents` (in-memory): the agents this pod is currently hosting.
#                           Mirrors a subset of the Redis registry
#                           (only entries this pod created itself).
#   - `_active_pipelines` (in-memory): the live rtc.Room +
#                           asyncio.Task references — not serializable,
#                           so they only live in this process.
#   - `registry` (Redis): cross-pod source of truth for "which agents
#                           are believed alive somewhere." On pod
#                           startup we read it, ask LiveKit to remove
#                           any orphan participants from their rooms,
#                           then clear it. banter-api re-spawns agents
#                           on demand so we don't need to recreate
#                           them ourselves.

agents: dict[str, dict] = {}
_active_pipelines: dict[str, AgentPipeline] = {}
registry = AgentRegistry()

# Provider configuration (pushed from banter-api admin settings)
_provider_config: dict = {
    "stt_provider": None,
    "stt_config": {},
    "tts_provider": None,
    "tts_config": {},
    "llm_provider": None,
    "llm_config": {},
}

# ── Request / Response models ────────────────────────────────────


class SpawnRequest(BaseModel):
    call_id: str
    mode: str = Field(default="text", pattern="^(voice|text)$")
    room_name: Optional[str] = None
    config: Optional[dict] = None


class SpawnResponse(BaseModel):
    agent_id: str
    status: str


class ProviderConfigRequest(BaseModel):
    stt_provider: Optional[str] = None
    stt_config: Optional[dict] = None
    tts_provider: Optional[str] = None
    tts_config: Optional[dict] = None
    llm_provider: Optional[str] = None
    llm_config: Optional[dict] = None


class ProviderStatusEntry(BaseModel):
    provider: Optional[str]
    configured: bool
    has_api_key: bool


class ProviderConfigStatus(BaseModel):
    stt: ProviderStatusEntry
    tts: ProviderStatusEntry
    llm: ProviderStatusEntry
    livekit_sdk_available: bool


class TranscribeRequest(BaseModel):
    """Request body for offline (post-call) transcription."""

    call_id: str
    recording_url: str
    callback_url: Optional[str] = None


# ── Lifecycle hooks ─────────────────────────────────────────────


@app.on_event("startup")
async def _on_startup() -> None:
    """Connect to Redis and reconcile any orphan agents from a prior pod.

    The orphans are participants the previous pod believed it was
    hosting. We can't bring back their pipeline state (asyncio.Task /
    rtc.Room are dead), so the cleanest move is to ask LiveKit to remove
    the participant from the room so banter-api can re-spawn cleanly on
    the next user request. If the LiveKit server-side API is
    unavailable we just log the orphans and let LiveKit's own empty-
    room TTL clean up.
    """
    await registry.connect()
    orphans = await registry.reconcile_orphans()
    if not orphans:
        return
    logger.info(
        "Reconciling %d orphan agent(s) from prior pod: clearing LiveKit participants",
        len(orphans),
    )
    # Best-effort: remove each orphan from its LiveKit room. The Python
    # LiveKit server SDK does this via RoomService.remove_participant.
    # Failures are logged and swallowed — banter-api will detect the
    # call has no agent and re-invoke /agents/spawn if needed.
    try:
        from livekit import api as lk_api  # noqa: PLC0415 — lazy import
    except ImportError:
        logger.info("livekit SDK unavailable; skipping orphan removal")
        return
    livekit_url = os.environ.get("LIVEKIT_URL", "")
    api_key = os.environ.get("LIVEKIT_API_KEY", "")
    api_secret = os.environ.get("LIVEKIT_API_SECRET", "")
    if not (livekit_url and api_key and api_secret):
        logger.info("LiveKit credentials not set; skipping orphan removal")
        return
    try:
        room_service = lk_api.LiveKitAPI(livekit_url, api_key, api_secret)
        for orphan in orphans:
            agent_id = orphan.get("agent_id")
            room_name = orphan.get("room_name")
            if not (agent_id and room_name):
                continue
            try:
                await room_service.room.remove_participant(
                    lk_api.RoomParticipantIdentity(room=room_name, identity=agent_id)
                )
                logger.info("Removed orphan agent %s from room %s", agent_id, room_name)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Failed to remove orphan agent %s from room %s: %s",
                    agent_id,
                    room_name,
                    exc,
                )
        await room_service.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Orphan reconciliation aborted: %s", exc)


@app.on_event("shutdown")
async def _on_shutdown() -> None:
    """Graceful disconnect of every pipeline this pod owns.

    Called by FastAPI on SIGTERM / lifespan shutdown. Disconnects the
    rtc.Room of every active pipeline so the SFU sees the participant
    leave cleanly, then drops their Redis entry. Hard kill (SIGKILL)
    bypasses this, which is exactly why the startup orphan-reconcile
    above exists as the belt-and-suspenders.
    """
    for agent_id in list(_active_pipelines.keys()):
        pipeline = _active_pipelines.pop(agent_id, None)
        if pipeline:
            try:
                await pipeline.disconnect()
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Shutdown: failed to disconnect pipeline %s: %s", agent_id, exc
                )
        await registry.deregister(agent_id)
    await registry.disconnect()


# ── Health ───────────────────────────────────────────────────────


@app.get("/health")
async def health():
    pipeline_cfg = _build_pipeline_config()
    return {
        "status": "ok",
        "agents": len(agents),
        "active_pipelines": len(_active_pipelines),
        "registry_connected": registry.connected,
        "registry_count": await registry.count(),
        "livekit_sdk": pipeline_cfg.livekit_available,
        "stt_ready": pipeline_cfg.stt_ready,
        "llm_ready": pipeline_cfg.llm_ready,
        "tts_ready": pipeline_cfg.tts_ready,
        "version": "0.5.0",
    }


# ── Agent lifecycle ──────────────────────────────────────────────


@app.post("/agents/spawn", response_model=SpawnResponse)
async def spawn_agent(data: SpawnRequest):
    agent_id = f"agent_{data.call_id}_{uuid.uuid4().hex[:8]}"
    now = time.time()

    agent_state: dict = {
        "agent_id": agent_id,
        "call_id": data.call_id,
        "mode": data.mode,
        "room_name": data.room_name,
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }

    # Apply any per-spawn config overrides
    if data.config:
        agent_state["config_overrides"] = data.config

    if data.mode == "voice" and data.room_name:
        pipeline_cfg = _build_pipeline_config(overrides=data.config)
        pipeline = AgentPipeline(pipeline_cfg)

        if pipeline.can_connect():
            try:
                await pipeline.connect(data.room_name, agent_id)
                _active_pipelines[agent_id] = pipeline
                agent_state["status"] = "active"
                agent_state["detail"] = (
                    f"Voice pipeline connected to room '{data.room_name}'. "
                    f"STT={pipeline_cfg.stt_provider}, "
                    f"LLM={pipeline_cfg.llm_provider}, "
                    f"TTS={pipeline_cfg.tts_provider}"
                )
                logger.info(
                    "Voice agent %s connected to room '%s'", agent_id, data.room_name
                )
            except Exception as exc:
                logger.warning(
                    "Voice agent %s failed to connect: %s. Falling back to log-only.",
                    agent_id,
                    exc,
                )
                agent_state["status"] = "degraded"
                agent_state["detail"] = (
                    f"Pipeline connection failed: {exc}. Running in degraded mode."
                )
        else:
            missing = pipeline.missing_requirements()
            logger.info(
                "Voice agent %s: pipeline not fully configured (%s). Log-only mode.",
                agent_id,
                ", ".join(missing),
            )
            agent_state["status"] = "degraded"
            agent_state["detail"] = (
                f"Pipeline missing: {', '.join(missing)}. "
                "Agent running in log-only mode."
            )
    elif data.mode == "voice":
        logger.info(
            "Voice agent %s: no room_name provided. Text-fallback mode.", agent_id
        )
        agent_state["status"] = "degraded"
        agent_state["detail"] = "Voice mode requested but no room_name. Text-fallback."
    else:
        # Text-only participant
        logger.info("Text-only agent %s spawned for call %s", agent_id, data.call_id)
        agent_state["status"] = "active"
        agent_state["detail"] = "Text-only participant"

    agents[agent_id] = agent_state
    # Mirror to Redis so a pod restart can find and clean up this
    # participant. Best-effort; ignored when the registry isn't
    # connected (it falls back to in-memory-only).
    await registry.register(agent_id, agent_state)
    return SpawnResponse(agent_id=agent_id, status=agent_state["status"])


@app.post("/agents/{agent_id}/despawn")
async def despawn_agent(agent_id: str):
    removed = agents.pop(agent_id, None)

    # Also stop the pipeline if one is running
    pipeline = _active_pipelines.pop(agent_id, None)
    if pipeline:
        try:
            await pipeline.disconnect()
        except Exception as exc:
            logger.warning("Error disconnecting pipeline for %s: %s", agent_id, exc)

    # Drop the Redis registry entry too so the next pod restart's
    # reconcile pass doesn't try to remove a participant that's
    # already gone. We deregister even when `removed` was None — the
    # in-memory state may have lagged (e.g. a previous restart cleared
    # `agents` but Redis kept the entry), and we want both sides clean.
    await registry.deregister(agent_id)

    if removed is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    logger.info("Agent %s despawned", agent_id)
    return {"status": "despawned", "agent_id": agent_id}


@app.get("/agents/{agent_id}/status")
def agent_status(agent_id: str):
    agent = agents.get(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    uptime = time.time() - agent["created_at"]
    pipeline = _active_pipelines.get(agent_id)
    return {
        "agent_id": agent_id,
        "status": agent["status"],
        "mode": agent["mode"],
        "room_name": agent.get("room_name"),
        "detail": agent.get("detail"),
        "pipeline_active": pipeline is not None and pipeline.is_connected(),
        "uptime_seconds": round(uptime, 1),
    }


@app.get("/agents")
def list_agents():
    return {"agents": agents, "count": len(agents)}


# ── Offline transcription ────────────────────────────────────────


@app.post("/transcribe")
async def transcribe(data: TranscribeRequest):
    """Queue an offline transcription of a recorded call.

    This endpoint is used by the banter-api (or worker) to request
    post-call STT transcription. The actual transcription runs async
    and results are posted back via callback_url or stored directly.
    """
    pipeline_cfg = _build_pipeline_config()

    if not pipeline_cfg.stt_ready:
        return {
            "status": "unavailable",
            "detail": "No STT provider configured. Cannot transcribe.",
        }

    # Fire-and-forget the transcription task
    asyncio.create_task(
        _run_offline_transcription(
            data.call_id, data.recording_url, data.callback_url, pipeline_cfg
        )
    )

    return {"status": "queued", "call_id": data.call_id}


async def _run_offline_transcription(
    call_id: str,
    recording_url: str,
    callback_url: Optional[str],
    config: PipelineConfig,
) -> None:
    """Download a recording and run STT on it. Posts results to callback_url."""
    import httpx

    logger.info("Starting offline transcription for call %s", call_id)

    try:
        # Download the recording
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(recording_url)
            resp.raise_for_status()
            audio_data = resp.content

        # Run STT (uses the same provider config as live pipeline)
        from .stt import transcribe_audio

        segments = await transcribe_audio(audio_data, config)

        logger.info(
            "Transcription complete for call %s: %d segments", call_id, len(segments)
        )

        # Post results to callback_url if provided
        if callback_url:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.post(
                    callback_url,
                    json={
                        "call_id": call_id,
                        "segments": segments,
                        "status": "completed",
                    },
                )
    except Exception as exc:
        logger.error("Offline transcription failed for call %s: %s", call_id, exc)
        if callback_url:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        callback_url,
                        json={
                            "call_id": call_id,
                            "status": "failed",
                            "error": str(exc),
                        },
                    )
            except Exception:
                pass


# ── Provider configuration ───────────────────────────────────────


def _has_api_key(config: dict) -> bool:
    """Check if a provider config dict contains a non-empty api_key."""
    key = config.get("api_key", "")
    return isinstance(key, str) and len(key) > 0


def _build_pipeline_config(overrides: Optional[dict] = None) -> PipelineConfig:
    """Build a PipelineConfig from current provider settings + env vars."""
    cfg = PipelineConfig(
        livekit_url=os.environ.get("LIVEKIT_URL", ""),
        livekit_api_key=os.environ.get("LIVEKIT_API_KEY", ""),
        livekit_api_secret=os.environ.get("LIVEKIT_API_SECRET", ""),
        stt_provider=_provider_config.get("stt_provider"),
        stt_api_key=(_provider_config.get("stt_config") or {}).get("api_key")
        or os.environ.get("STT_API_KEY", "")
        or os.environ.get("DEEPGRAM_API_KEY", ""),
        llm_provider=_provider_config.get("llm_provider")
        or os.environ.get("LLM_PROVIDER"),
        llm_api_key=(_provider_config.get("llm_config") or {}).get("api_key")
        or os.environ.get("LLM_API_KEY", "")
        or os.environ.get("OPENAI_API_KEY", "")
        or os.environ.get("ANTHROPIC_API_KEY", ""),
        llm_model=(_provider_config.get("llm_config") or {}).get("model"),
        tts_provider=_provider_config.get("tts_provider"),
        tts_api_key=(_provider_config.get("tts_config") or {}).get("api_key")
        or os.environ.get("TTS_API_KEY", "")
        or os.environ.get("OPENAI_API_KEY", ""),
        tts_voice=(_provider_config.get("tts_config") or {}).get("voice"),
        system_prompt=os.environ.get(
            "AGENT_SYSTEM_PROMPT",
            "You are a helpful AI assistant participating in a voice call. "
            "Keep your responses concise and conversational. "
            "If you don't know something, say so honestly.",
        ),
    )

    if overrides:
        for key, value in overrides.items():
            if hasattr(cfg, key) and value is not None:
                setattr(cfg, key, value)

    return cfg


@app.get("/config", response_model=ProviderConfigStatus)
def get_config():
    """Return current provider configuration status (no secrets leaked)."""
    pipeline_cfg = _build_pipeline_config()
    return ProviderConfigStatus(
        stt=ProviderStatusEntry(
            provider=pipeline_cfg.stt_provider,
            configured=pipeline_cfg.stt_provider is not None,
            has_api_key=bool(pipeline_cfg.stt_api_key),
        ),
        tts=ProviderStatusEntry(
            provider=pipeline_cfg.tts_provider,
            configured=pipeline_cfg.tts_provider is not None,
            has_api_key=bool(pipeline_cfg.tts_api_key),
        ),
        llm=ProviderStatusEntry(
            provider=pipeline_cfg.llm_provider,
            configured=pipeline_cfg.llm_provider is not None,
            has_api_key=bool(pipeline_cfg.llm_api_key),
        ),
        livekit_sdk_available=pipeline_cfg.livekit_available,
    )


@app.post("/config")
def update_config(data: ProviderConfigRequest):
    """Accept provider configuration pushed from banter-api admin settings."""
    if data.stt_provider is not None:
        _provider_config["stt_provider"] = data.stt_provider
    if data.stt_config is not None:
        _provider_config["stt_config"] = data.stt_config
    if data.tts_provider is not None:
        _provider_config["tts_provider"] = data.tts_provider
    if data.tts_config is not None:
        _provider_config["tts_config"] = data.tts_config
    if data.llm_provider is not None:
        _provider_config["llm_provider"] = data.llm_provider
    if data.llm_config is not None:
        _provider_config["llm_config"] = data.llm_config

    logger.info(
        "Provider config updated: STT=%s, TTS=%s, LLM=%s",
        _provider_config.get("stt_provider"),
        _provider_config.get("tts_provider"),
        _provider_config.get("llm_provider"),
    )

    return {
        "status": "updated",
        "stt_provider": _provider_config.get("stt_provider"),
        "tts_provider": _provider_config.get("tts_provider"),
        "llm_provider": _provider_config.get("llm_provider"),
    }
