"""Turns one typed line into a result: log it, ask the model, validate, gate, run."""
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import ValidationError
from sqlalchemy.orm import Session

from cockpit.core.llm.interface import LLM
from cockpit.core.modules import Context, Effect
from cockpit.core.registry import Registry
from cockpit.core.storage.models import MessageLog, PendingConfirmation

AUTO_RUN = {Effect.READ, Effect.WRITE_LOCAL}


def handle_message(
    session: Session, registry: Registry, llm: LLM, text: str, device: str, tz: str
) -> dict:
    msg = MessageLog(text=text, device=device)
    session.add(msg)
    session.flush()  # the raw line is stored before anything can fail

    today = datetime.now(ZoneInfo(tz)).date()
    tools = registry.tools()
    try:
        reply = llm.complete(text, list(tools.values()), today, tz)
    except Exception:
        msg.outcome = "llm_error"
        return {"message_id": msg.id, "outcome": "llm_error",
                "reply": "Saved your line, but the assistant could not be reached."}

    msg.input_tokens, msg.output_tokens = reply.input_tokens, reply.output_tokens
    if reply.tool_call is None:
        msg.outcome = "reply"
        return {"message_id": msg.id, "outcome": "reply", "reply": reply.text or ""}

    call = reply.tool_call
    msg.tool_call = {"name": call.name, "args": call.args}
    tool = tools.get(call.name)
    if tool is None:
        msg.outcome = "unknown_tool"
        return {"message_id": msg.id, "outcome": "error", "reply": "I could not act on that."}
    try:
        args = tool.args_model(**call.args)
    except ValidationError:
        msg.outcome = "invalid_args"
        return {"message_id": msg.id, "outcome": "error",
                "reply": "I could not read the details from that line."}

    if tool.effect not in AUTO_RUN:
        session.add(PendingConfirmation(message_id=msg.id, tool=call.name, args=call.args))
        msg.outcome = "needs_confirmation"
        return {"message_id": msg.id, "outcome": "needs_confirmation",
                "reply": f"Please confirm: {tool.description}"}

    result = tool.handler(Context(session=session, today=today, tz=tz), args)
    msg.outcome = "done"
    return {"message_id": msg.id, "outcome": "done", "reply": result.reply, "data": result.data}
