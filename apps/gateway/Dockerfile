# ════════════════════════════════════════════════════════════════════════
# Hisaflow LLM Gateway — Dockerfile
# Based on the official LiteLLM image (Python, pinned for stability)
# ════════════════════════════════════════════════════════════════════════

FROM ghcr.io/berriai/litellm:main-stable

# Copy our routing configuration into the image
WORKDIR /app
COPY config.yaml /app/config.yaml

# Set default port (the host platform supplies PORT; Northflank should target 4000)
ENV PORT=4000
EXPOSE 4000

# Override the base image ENTRYPOINT so we can use shell variable expansion
ENTRYPOINT []
CMD ["sh", "-c", "litellm --config /app/config.yaml --port $PORT --host 0.0.0.0"]
