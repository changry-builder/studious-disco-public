// The only file that talks to the backend.
export type TodayItem = {
  module: string;
  title: string;
  kind: string;
  due: string | null;
  ref_id: string | null;
};
export type TodayResponse = { date: string; items: TodayItem[] };
export type MessageResponse = {
  message_id: string;
  outcome: string;
  reply: string;
};

export async function getToday(): Promise<TodayResponse> {
  const r = await fetch("/api/today");
  if (!r.ok) throw new Error(`today failed: ${r.status}`);
  return r.json();
}

export async function sendMessage(text: string): Promise<MessageResponse> {
  const device = window.matchMedia?.("(min-width: 900px)").matches ? "laptop" : "phone";
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const r = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, device, tz }),
  });
  if (!r.ok) throw new Error(`message failed: ${r.status}`);
  return r.json();
}
