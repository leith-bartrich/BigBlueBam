FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY apps/voice-agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/voice-agent/src/ ./src/
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE

EXPOSE 4003
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "4003"]
