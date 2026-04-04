import os
import time
import uuid
import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Graceful import of livekit SDK — not required for text-only mode
try:
    import livekit
    import livekit.agents

    LIVEKIT_AVAILABLE = True
except ImportError:
    LIVEKIT_AVAILABLE = False

logger = logging.getLogger("voice-agent")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Banter Voice Agent", version="0.4.0")

# ── In-memory state ──────────────────────────────────────────────

agents: dict[str, dict] = {}

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


# ── Health ───────────────────────────────────────────────────────


@app.get("/health")
def health():
    return {
        "status": "ok",
        "agents": len(agents),
        "livekit_sdk": LIVEKIT_AVAILABLE,
        "version": "0.4.0",
    }


# ── Agent lifecycle ──────────────────────────────────────────────


@app.post("/agents/spawn", response_model=SpawnResponse)
def spawn_agent(data: SpawnRequest):
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

    if data.mode == "voice":
        if LIVEKIT_AVAILABLE and data.room_name:
            # In a full implementation this would connect to the LiveKit room
            # via livekit.agents.Worker. For now we log and mark as active.
            logger.info(
                "Voice agent %s would connect to LiveKit room '%s' "
                "(actual connection requires livekit-agents worker setup)",
                agent_id,
                data.room_name,
            )
            agent_state["status"] = "active"
            agent_state["detail"] = (
                f"Voice mode: would connect to room '{data.room_name}'. "
                "LiveKit agents SDK detected but full worker not yet wired."
            )
        else:
            logger.info(
                "Voice agent %s: LiveKit SDK not available or no room_name. "
                "Running in degraded/text-fallback mode.",
                agent_id,
            )
            agent_state["status"] = "active"
            agent_state["detail"] = (
                "Voice mode requested but LiveKit SDK not available. "
                "Agent running in text-fallback mode."
            )
    else:
        # Text-only participant
        logger.info("Text-only agent %s spawned for call %s", agent_id, data.call_id)
        agent_state["status"] = "active"
        agent_state["detail"] = "Text-only participant"

    # Apply any per-spawn config overrides
    if data.config:
        agent_state["config_overrides"] = data.config

    agents[agent_id] = agent_state
    return SpawnResponse(agent_id=agent_id, status=agent_state["status"])


@app.post("/agents/{agent_id}/despawn")
def despawn_agent(agent_id: str):
    removed = agents.pop(agent_id, None)
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
    return {
        "agent_id": agent_id,
        "status": agent["status"],
        "mode": agent["mode"],
        "room_name": agent.get("room_name"),
        "detail": agent.get("detail"),
        "uptime_seconds": round(uptime, 1),
    }


@app.get("/agents")
def list_agents():
    return {"agents": agents, "count": len(agents)}


# ── Provider configuration ───────────────────────────────────────


def _has_api_key(config: dict) -> bool:
    """Check if a provider config dict contains a non-empty api_key."""
    key = config.get("api_key", "")
    return isinstance(key, str) and len(key) > 0


@app.get("/config", response_model=ProviderConfigStatus)
def get_config():
    """Return current provider configuration status (no secrets leaked)."""
    return ProviderConfigStatus(
        stt=ProviderStatusEntry(
            provider=_provider_config.get("stt_provider"),
            configured=_provider_config.get("stt_provider") is not None,
            has_api_key=_has_api_key(_provider_config.get("stt_config") or {}),
        ),
        tts=ProviderStatusEntry(
            provider=_provider_config.get("tts_provider"),
            configured=_provider_config.get("tts_provider") is not None,
            has_api_key=_has_api_key(_provider_config.get("tts_config") or {}),
        ),
        llm=ProviderStatusEntry(
            provider=_provider_config.get("llm_provider"),
            configured=_provider_config.get("llm_provider") is not None,
            has_api_key=_has_api_key(_provider_config.get("llm_config") or {}),
        ),
        livekit_sdk_available=LIVEKIT_AVAILABLE,
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
