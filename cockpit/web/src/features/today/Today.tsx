import type { TodayItem } from "../../api/client";

export function Today({ date, items }: { date: string; items: TodayItem[] }) {
  return (
    <section aria-label="Today">
      <h1>Today</h1>
      <p className="muted">{date}</p>
      {items.length === 0 ? (
        <p className="empty">Nothing due. Type a line below to add something.</p>
      ) : (
        <ul className="list">
          {items.map((i, n) => (
            <li key={i.ref_id ?? n}>
              <span>{i.title}</span>
              {i.due && <span className="muted">{i.due}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
