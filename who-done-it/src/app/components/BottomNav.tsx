const ITEMS: { id: string; label: string; icon: string; group: string[] }[] = [
  { id: "house", label: "House", icon: "⌂", group: ["house", "room"] },
  { id: "people", label: "People", icon: "☺", group: ["people", "dossier", "press"] },
  { id: "notebook", label: "Notebook", icon: "▤", group: ["notebook"] },
  { id: "accuse", label: "Accuse", icon: "⚖", group: ["accuse"] },
];

export function BottomNav({ screen, go }: { screen: string; go: (s: string) => void }) {
  return (
    <nav className="bottomnav" aria-label="Case">
      {ITEMS.map((it) => (
        <button key={it.id} type="button" className="bottomnav__item" aria-current={it.group.includes(screen) ? "page" : undefined} onClick={() => go(it.id)}>
          <span className="bottomnav__icon" aria-hidden="true">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
