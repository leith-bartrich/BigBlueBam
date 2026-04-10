# Passthrough image for deploying LiveKit on Railway. The upstream image is
# distroless-style and ships only the binary, so we use a tiny alpine layer
# at the top to provide envsubst (gettext) and a shell, then copy the
# binary out of the upstream image and start it via our entrypoint.
#
# The entrypoint renders /etc/livekit.yaml.tmpl into /etc/livekit.yaml at
# container start using LIVEKIT_API_KEY / LIVEKIT_API_SECRET / optional
# LIVEKIT_WEBHOOK_URL from the environment.
FROM alpine:3.20

RUN apk add --no-cache gettext ca-certificates

COPY --from=livekit/livekit-server:latest /livekit-server /livekit-server

COPY infra/railway/livekit/livekit.yaml.tmpl /etc/livekit.yaml.tmpl
COPY infra/railway/livekit/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7880 7881

ENTRYPOINT ["/entrypoint.sh"]
