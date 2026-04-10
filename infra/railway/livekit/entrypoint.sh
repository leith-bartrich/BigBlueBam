#!/bin/sh
# Render the LiveKit config template with env vars at container start, then
# exec livekit-server with it. Railway passes secrets via env, so this lets
# us avoid baking dev keys into the image.
set -e

: "${LIVEKIT_API_KEY:?LIVEKIT_API_KEY is required}"
: "${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET is required}"
: "${LIVEKIT_WEBHOOK_URL:=http://banter-api.railway.internal:4002/v1/webhooks/livekit}"

envsubst < /etc/livekit.yaml.tmpl > /etc/livekit.yaml
exec /livekit-server --config /etc/livekit.yaml
