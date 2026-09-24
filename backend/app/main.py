"""Application composition without starting a server at import time."""

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.health import router as health_router
from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    origins = ["http://tauri.localhost"]
    if settings.allow_desktop_dev_origin:
        origins.append("http://127.0.0.1:1420")

    application = FastAPI(
        title="Oracle Backend",
        debug=False,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        redirect_slashes=False,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET"],
        allow_headers=[],
        allow_credentials=False,
        max_age=600,
    )
    application.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["127.0.0.1", "localhost"],
        www_redirect=False,
    )
    application.include_router(health_router)
    return application
