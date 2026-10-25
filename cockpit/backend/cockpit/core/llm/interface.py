from dataclasses import dataclass
from datetime import date
from typing import Protocol

from cockpit.core.modules import ToolSpec


@dataclass
class ToolCall:
    name: str
    args: dict


@dataclass
class LLMReply:
    text: str | None = None
    tool_call: ToolCall | None = None
    input_tokens: int = 0
    output_tokens: int = 0


class LLM(Protocol):
    def complete(self, text: str, tools: list[ToolSpec], today: date, tz: str) -> LLMReply: ...
