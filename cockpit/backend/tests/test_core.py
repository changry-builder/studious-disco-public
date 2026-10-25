from datetime import date

from fastapi.testclient import TestClient
from pydantic import BaseModel

from cockpit.core.app import create_app
from cockpit.core.config import Settings, load_settings
from cockpit.core.llm.fake import FakeLLM
from cockpit.core.llm.interface import LLMReply, ToolCall
from cockpit.core.modules import Context, Effect, TodayItem, ToolResult, ToolSpec
from cockpit.core.storage.models import MessageLog, PendingConfirmation
from cockpit.core.storage.sqlite import SqliteStorage


class NoteArgs(BaseModel):
    title: str


class DummyModule:
    """A throwaway module that proves the contract works without any real module."""

    name = "dummy"

    def __init__(self):
        self.notes: list[str] = []

    def tools(self):
        return [
            ToolSpec("dummy.add", "add a note", NoteArgs, Effect.WRITE_LOCAL, self._add),
            ToolSpec("dummy.wipe", "delete all notes", NoteArgs, Effect.DESTRUCTIVE, self._add),
        ]

    def _add(self, ctx: Context, args: NoteArgs) -> ToolResult:
        self.notes.append(args.title)
        return ToolResult(reply=f"Added {args.title}")

    def today(self, ctx: Context):
        return [TodayItem(module="dummy", title=n, due=date(2026, 10, 30)) for n in self.notes]


def make(llm=None, module=None):
    storage = SqliteStorage("sqlite://")
    module = module or DummyModule()
    app = create_app(Settings(), storage, llm or FakeLLM(), [module])
    return TestClient(app), storage, module


def test_health():
    client, _, _ = make()
    assert client.get("/health").json() == {"status": "ok"}


def test_empty_today():
    client, _, _ = make()
    body = client.get("/api/today").json()
    assert body["items"] == []


def test_fake_model_answers_canned_message_and_logs_it():
    client, storage, _ = make()
    r = client.post("/api/messages", json={"text": "hello", "device": "laptop"}).json()
    assert r["outcome"] == "reply" and r["reply"] == "Got it: hello"
    with storage.session() as s:
        row = s.query(MessageLog).one()
        assert row.text == "hello" and row.device == "laptop"


def test_tool_call_runs_and_shows_in_today():
    llm = FakeLLM({"note x": LLMReply(tool_call=ToolCall("dummy.add", {"title": "x"}))})
    client, _, module = make(llm)
    r = client.post("/api/messages", json={"text": "note x"}).json()
    assert r["outcome"] == "done" and module.notes == ["x"]
    assert client.get("/api/today").json()["items"][0]["title"] == "x"


def test_destructive_tool_waits_for_confirmation():
    llm = FakeLLM({"wipe": LLMReply(tool_call=ToolCall("dummy.wipe", {"title": "all"}))})
    client, storage, module = make(llm)
    r = client.post("/api/messages", json={"text": "wipe"}).json()
    assert r["outcome"] == "needs_confirmation" and module.notes == []
    with storage.session() as s:
        assert s.query(PendingConfirmation).one().status == "pending"


def test_bad_arguments_do_not_run():
    llm = FakeLLM({"bad": LLMReply(tool_call=ToolCall("dummy.add", {"wrong": 1}))})
    client, _, module = make(llm)
    assert client.post("/api/messages", json={"text": "bad"}).json()["outcome"] == "error"
    assert module.notes == []


def test_model_failure_still_saves_the_line():
    class Broken:
        def complete(self, *a, **k):
            raise TimeoutError

    client, storage, _ = make(Broken())
    r = client.post("/api/messages", json={"text": "call plumber"}).json()
    assert r["outcome"] == "llm_error"
    with storage.session() as s:
        assert s.query(MessageLog).one().text == "call plumber"


def test_settings_come_from_environment_not_code():
    s = load_settings({"COCKPIT_TZ": "Europe/London", "COCKPIT_LLM": "claude"})
    assert s.timezone == "Europe/London" and s.llm_backend == "claude"
