import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def new_id() -> str:
    return str(uuid.uuid4())


def now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class MessageLog(Base):
    """Every typed line is saved here first, so nothing is ever lost."""

    __tablename__ = "message_log"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    text: Mapped[str] = mapped_column(Text)
    device: Mapped[str] = mapped_column(String, default="unknown")
    outcome: Mapped[str] = mapped_column(String, default="received")
    tool_call: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PendingConfirmation(Base):
    __tablename__ = "pending_confirmation"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    message_id: Mapped[str] = mapped_column(String)
    tool: Mapped[str] = mapped_column(String)
    args: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
