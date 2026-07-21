# ════════════════════════════════════════════════════════════════════════
# Hisaflow LLM Gateway — Dockerfile
# Based on the official LiteLLM image (Python, pinned for stability)
# ════════════════════════════════════════════════════════════════════════

FROM ghcr.io/berriai/litellm:main-stable

# Copy our routing configuration into the image
WORKDIR /app
COPY config.yaml /app/config.yaml

# Expose the proxy port
EXPOSE 4000

# Health check so Railway / Docker knows when the gateway is ready
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Start LiteLLM with our config, binding to the Railway-provided $PORT if it exists
CMD ["sh", "-c", "litellm --config /app/config.yaml --port ${PORT:-4000} --host 0.0.0.0"]
