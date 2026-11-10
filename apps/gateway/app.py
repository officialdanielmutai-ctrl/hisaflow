"""HisaFlow LiteLLM gateway — slim OpenAI-compatible entrypoint.

The published LiteLLM proxy image needs roughly 1 GB of RAM. Northflank's free
project allowance is 1 GB total, shared with the 512 MB API service, so the
full proxy cannot run beside the backend. This module keeps the same config,
model aliases, fallback chain and ``/v1/chat/completions`` contract while using
only the LiteLLM SDK + FastAPI/uvicorn. It runs comfortably in 512 MB.
"""

from __future__ import annotations

import json
import os

import yaml
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from litellm import Router

CONFIG_PATH = os.getenv("CONFIG_PATH", "/app/config.yaml")
with open(CONFIG_PATH, encoding="utf-8") as handle:
    CONFIG = yaml.safe_load(handle) or {}

ROUTER_SETTINGS = CONFIG.get("router_settings") or {}
router = Router(
    model_list=CONFIG.get("model_list", []),
    fallbacks=CONFIG.get("fallbacks"),
    routing_strategy=ROUTER_SETTINGS.get("routing_strategy", "simple-shuffle"),
    num_retries=ROUTER_SETTINGS.get("num_retries", 2),
    retry_after=ROUTER_SETTINGS.get("retry_after", 0),
    allowed_fails=ROUTER_SETTINGS.get("allowed_fails", 2),
    cooldown_time=ROUTER_SETTINGS.get("cooldown_time", 60),
)

MASTER_KEY = os.environ.get("LITELLM_MASTER_KEY", "")
MODEL_NAMES = sorted(
    {entry["model_name"] for entry in CONFIG.get("model_list", [])}
)

app = FastAPI(title="HisaFlow LiteLLM Gateway")


def authorized(request: Request) -> bool:
    header = request.headers.get("authorization", "")
    return bool(MASTER_KEY) and header == f"Bearer {MASTER_KEY}"


def as_dict(value):
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return dict(value)


def unauthorized() -> JSONResponse:
    return JSONResponse(
        {"error": {"message": "Invalid gateway key", "type": "unauthorized"}},
        status_code=401,
    )


@app.get("/")
async def root():
    return {"service": "hisaflow-litellm-gateway", "status": "ok"}


@app.get("/health/liveliness")
async def liveliness():
    return "I'm alive!"


@app.get("/health")
async def health():
    return {"status": "healthy", "models": MODEL_NAMES}


@app.get("/v1/models")
async def models(request: Request):
    if not authorized(request):
        return unauthorized()
    return {
        "object": "list",
        "data": [{"id": name, "object": "model"} for name in MODEL_NAMES],
    }


@app.get("/model/info")
async def model_info(request: Request):
    """Minimal shape used by the admin provider panel's connectivity check."""
    if not authorized(request):
        return unauthorized()
    return {
        "data": [
            {
                "model_name": name,
                "litellm_params": {"model": name},
                "model_info": {"id": name},
            }
            for name in MODEL_NAMES
        ]
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    if not authorized(request):
        return unauthorized()

    body = await request.json()
    model = body.get("model")
    messages = body.get("messages") or []
    stream = bool(body.get("stream"))
    extra = {
        key: value
        for key, value in body.items()
        if key not in {"model", "messages", "stream"}
    }

    response = await router.acompletion(
        model=model,
        messages=messages,
        stream=stream,
        **extra,
    )

    if not stream:
        return JSONResponse(as_dict(response))

    async def event_stream():
        try:
            async for chunk in response:
                yield f"data: {json.dumps(as_dict(chunk))}\n\n"
        except Exception as error:  # keep the SSE contract even when a provider fails
            yield f"data: {json.dumps({'error': {'message': str(error)}})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "4000")),
        log_level=os.getenv("LITELLM_LOG", "info").lower(),
    )
