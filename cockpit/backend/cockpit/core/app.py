from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from pydantic import BaseModel

from cockpit.core.agent import handle_message
from cockpit.core.config import Settings, load_settings
from cockpit.core.llm.fake import FakeLLM
from cockpit.core.modules import Context, Module
from cockpit.core.registry import Registry
from cockpit.core.storage.sqlite import SqliteStorage


class MessageIn(BaseModel):
    text: str
    device: str = "unknown"
    tz: str | None = None


def create_app(settings=None, storage=None, llm=None, modules: list[Module] | None = None) -> FastAPI:
    settings = settings or load_settings()
    storage = storage or SqliteStorage(settings.database_url)
    storage.create_tables()
    llm = llm or FakeLLM()  # real model is wired in at M1
    registry = Registry(modules)

    app = FastAPI(title="Cockpit")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/messages")
    def post_message(body: MessageIn):
        with storage.session() as s:
            return handle_message(s, registry, llm, body.text, body.device, body.tz or settings.timezone)

    @app.get("/api/today")
    def today():
        tz = settings.timezone
        day = datetime.now(ZoneInfo(tz)).date()
        with storage.session() as s:
            ctx = Context(session=s, today=day, tz=tz)
            items = [i for m in registry.modules for i in m.today(ctx)]
        return {"date": day.isoformat(),
                "items": [{"module": i.module, "title": i.title, "kind": i.kind,
                           "due": i.due.isoformat() if i.due else None, "ref_id": i.ref_id}
                          for i in items]}

    return app


def app_factory() -> FastAPI:  # for: uvicorn cockpit.core.app:app_factory --factory
    return create_app()
