import { useState } from "react";

export function Capture({ onSend }: { onSend: (text: string) => Promise<string> }) {
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const line = text.trim();
    if (!line) return;
    setText(""); // the box is free for the next line straight away
    try {
      setReply(await onSend(line));
    } catch {
      setReply("Could not reach the backend. Your line was not saved.");
    }
  }

  return (
    <form className="capture" onSubmit={submit}>
      {reply && <p className="reply" role="status">{reply}</p>}
      <input
        aria-label="Tell me anything"
        placeholder="Tell me anything…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
    </form>
  );
}
