"""Validated process configuration; no files or secrets are loaded implicitly."""

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JOB_OS_", frozen=True)

    port: int = Field(default=8000, ge=1024, le=65535)
    log_level: Literal["debug", "info", "warning", "error", "critical"] = "info"
    allow_desktop_dev_origin: bool = False
