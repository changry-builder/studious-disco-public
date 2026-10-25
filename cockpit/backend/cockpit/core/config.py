import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    database_url: str = "sqlite:///./cockpit.db"
    timezone: str = "UTC"
    llm_backend: str = "fake"
    anthropic_api_key: str = ""
    daily_token_cap: int = 50000


def load_settings(env: dict | None = None) -> Settings:
    """Read settings from the environment. Secrets never live in code."""
    if env is None:
        load_dotenv()
        env = os.environ
    return Settings(
        database_url=env.get("COCKPIT_DATABASE_URL", Settings.database_url),
        timezone=env.get("COCKPIT_TZ", Settings.timezone),
        llm_backend=env.get("COCKPIT_LLM", Settings.llm_backend),
        anthropic_api_key=env.get("ANTHROPIC_API_KEY", ""),
        daily_token_cap=int(env.get("COCKPIT_DAILY_TOKEN_CAP", Settings.daily_token_cap)),
    )
