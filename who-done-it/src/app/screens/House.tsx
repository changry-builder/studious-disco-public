import { useCase } from "../ctx";
import { Page } from "../components/Page";
import { roomName } from "../text";

export function House() {
  const { store, solo, entry, facts } = useCase();
  const searched = solo.state.searched;
  return (
    <Page title="The house" caseScreen>
      <p className="muted small">Tap a room to look around. Searching is free.</p>
      <ul className="rooms">
        {facts.rooms.map((r) => {
          const done = searched.filter((k) => k.startsWith(`${r.id}/`)).length;
          const isBody = solo.view.bodyRoom === r.id;
          return (
            <li key={r.id}>
              <button
                type="button"
                className={isBody ? "card card--tap card--accent roomcard" : "card card--tap roomcard"}
                onClick={() => store.navigate("room", { room: r.id })}
                aria-label={`${roomName(entry, r.id)}, ${done} of ${r.spots.length} spots searched${isBody ? ", the body lies here" : ""}`}
              >
                <span className="roomcard__name">{roomName(entry, r.id)}</span>
                <span className="roomcard__meta">
                  {isBody && <span className="roomcard__body">The body lies here</span>}
                  <span>
                    {done} of {r.spots.length} spots searched
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
