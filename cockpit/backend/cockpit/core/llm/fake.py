from datetime import date

from cockpit.core.llm.interface import LLMReply
from cockpit.core.modules import ToolSpec


class FakeLLM:
    """Offline stand-in. Returns scripted replies by exact text, else a canned answer. Costs no tokens."""

    def __init__(self, script: dict[str, LLMReply] | None = None):
        self.script = script or {}
        self.calls: list[str] = []

    def complete(self, text: str, tools: list[ToolSpec], today: date, tz: str) -> LLMReply:
        self.calls.append(text)
        if text in self.script:
            return self.script[text]
        return LLMReply(text=f"Got it: {text}")
