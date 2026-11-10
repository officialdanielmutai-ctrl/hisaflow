# ════════════════════════════════════════════════════════════════════════
# Hisaflow LLM Gateway — Dockerfile
# Based on the official LiteLLM image (Python, pinned for stability).
# The default proxy entrypoint needs ~1 GB; Northflank's free project
# allowance is 1 GB total, so app.py runs the same config through the
# LiteLLM SDK + FastAPI and fits in the 512 MB plan.
# ════════════════════════════════════════════════════════════════════════

FROM ghcr.io/berriai/litellm:main-v1.80.15-stable

WORKDIR /app
COPY config.yaml /app/config.yaml
COPY app.py /app/app.py

ENV PORT=4000
ENV PYTHONUNBUFFERED=1
EXPOSE 4000

# The base image sets ENTRYPOINT ["litellm"]; clear it so CMD runs Python.
ENTRYPOINT []
CMD ["python", "/app/app.py"]
