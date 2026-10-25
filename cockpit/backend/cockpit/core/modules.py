"""The contract every module implements. Modules import from here, never from each other."""
from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Any, Callable, Protocol

from pydantic import BaseModel
from sqlalchemy.orm import Session


class Effect(str, Enum):
    READ = "read"
    WRITE_LOCAL = "write_local"  # runs at once, with Undo
    DESTRUCTIVE = "destructive"  # needs an explicit confirm
    EXTERNAL_SEND = "external_send"
    SPEND = "spend"


@dataclass
class Context:
    session: Session
    today: date
    tz: str


@dataclass
class ToolResult:
    reply: str
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolSpec:
    name: str  # e.g. "actions.add_item"
    description: str  # one line, read by the model
    args_model: type[BaseModel]
    effect: Effect
    handler: Callable[[Context, BaseModel], ToolResult]


@dataclass
class TodayItem:
    module: str
    title: str
    kind: str = "item"
    due: date | None = None
    ref_id: str | None = None


class Module(Protocol):
    name: str

    def tools(self) -> list[ToolSpec]: ...

    def today(self, ctx: Context) -> list[TodayItem]: ...
