# ════════════════════════════════════════════════════════════════════════
# Hisaflow LLM Gateway — Dockerfile
# Based on the official LiteLLM image (Python, pinned for stability)
# ════════════════════════════════════════════════════════════════════════

FROM ghcr.io/berriai/litellm:main-stable

# Copy our routing configuration into the image
WORKDIR /app
COPY config.yaml /app/config.yaml

# Set default port (Railway will override this with its own $PORT)
ENV PORT=4000

# Override the base image ENTRYPOINT so we can use shell variable expansion
ENTRYPOINT []
CMD ["sh", "-c", "litellm --config /app/config.yaml --port $PORT --host 0.0.0.0"]
