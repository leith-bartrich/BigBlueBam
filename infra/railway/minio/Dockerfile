# Passthrough image so MinIO can be deployed on Railway using the same
# config-as-code flow as our app services. Railway needs a Dockerfile; this
# one just re-exports the upstream image with the server command baked in.
#
# Volume: mount a Railway volume at /data in the dashboard.
# Env vars (set in dashboard): MINIO_ROOT_USER, MINIO_ROOT_PASSWORD.
FROM minio/minio:latest

EXPOSE 9000 9001

# --console-address opens the admin UI on :9001. The data port is :9000.
CMD ["server", "/data", "--console-address", ":9001"]
