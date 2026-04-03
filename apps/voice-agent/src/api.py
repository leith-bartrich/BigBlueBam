from fastapi import FastAPI

app = FastAPI()

agents = {}


@app.get("/health")
def health():
    return {"status": "ok", "agents": len(agents)}


@app.post("/agents/spawn")
def spawn_agent(data: dict):
    # Placeholder — will implement full pipeline later
    agent_id = data.get("call_id", "unknown")
    agents[agent_id] = {"status": "active", "mode": data.get("mode", "text")}
    return {"agent_id": agent_id, "status": "spawned"}


@app.post("/agents/{agent_id}/despawn")
def despawn_agent(agent_id: str):
    agents.pop(agent_id, None)
    return {"status": "despawned"}


@app.get("/agents")
def list_agents():
    return {"agents": agents}
