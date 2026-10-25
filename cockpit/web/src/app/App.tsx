import { useCallback, useEffect, useState } from "react";
import { getToday, sendMessage, type TodayResponse } from "../api/client";
import { Capture } from "../features/capture/Capture";
import { Today } from "../features/today/Today";

export function App() {
  const [today, setToday] = useState<TodayResponse>({ date: "", items: [] });
  const refresh = useCallback(() => getToday().then(setToday).catch(() => {}), []);
  useEffect(() => { refresh(); }, [refresh]);

  async function onSend(text: string) {
    const r = await sendMessage(text);
    await refresh();
    return r.reply;
  }

  return (
    <div className="shell">
      <aside className="side" aria-label="Panels">
        <p className="muted">Contacts, habits and home upkeep will appear here on a laptop.</p>
      </aside>
      <main className="main">
        <Today date={today.date} items={today.items} />
      </main>
      <Capture onSend={onSend} />
    </div>
  );
}
