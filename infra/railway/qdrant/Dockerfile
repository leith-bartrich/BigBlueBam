# Passthrough image so Qdrant can be deployed on Railway using the same
# config-as-code flow as our app services. The upstream image's default
# command already starts the HTTP server on :6333 and gRPC on :6334, so
# we just re-export it unchanged.
#
# Volume: mount a Railway volume at /qdrant/storage in the dashboard.
FROM qdrant/qdrant:latest

EXPOSE 6333 6334
