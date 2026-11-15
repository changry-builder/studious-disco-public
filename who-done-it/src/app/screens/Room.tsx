import { useEffect } from "react";
import { param, useCase } from "../ctx";
import { ItemCard } from "../components/Cards";
import { Page } from "../components/Page";
import { charName, roomDesc, roomName, spotEmpty, spotName } from "../text";
import { refKey } from "../../engine/index";

export function Room() {
  const c = useCase();
  const { store, snap, solo, entry, facts } = c;
  const roomId = param(snap, "room");
  const room = facts.rooms.find((r) => r.id === roomId);
  useEffect(() => {
    if (!room) store.navigate("house");
  }, [room, store]);
  if (!room) return null;

  const items = solo.view.items;
  const pins = solo.state.pins;
  const pin = (id: string) => (on: boolean) => store.dispatch({ type: "pin", ref: { kind: "item", id }, on });
  const isBody = solo.view.bodyRoom === room.id;
  const bodyItems = items.filter((i) => i.kind === "wound" || i.kind === "tod");
  const desc = roomDesc(entry, room.id);

  return (
    <Page title={roomName(entry, room.id)} back={() => store.navigate("house")} caseScreen>
      {desc && <p className="prose">{desc}</p>}

      {isBody && (
        <section className="stack" aria-label="The body">
          {solo.state.bodyExamined ? (
            <>
              <h2 className="eyebrow">{charName(entry, solo.view.victim)}</h2>
              {bodyItems.map((it) => (
                <ItemCard key={it.id} c={c} item={it} pinned={pins.includes(refKey({ kind: "item", id: it.id }))} onPin={pin(it.id)} />
              ))}
            </>
          ) : (
            <button type="button" className="btn btn--primary btn--block" onClick={() => store.dispatch({ type: "examineBody" })}>
              Examine the body
            </button>
          )}
        </section>
      )}

      <section className="stack" aria-label="Places to search">
        <h2 className="eyebrow">Places to search</h2>
        {room.spots.map((spot) => {
          const done = solo.state.searched.includes(`${room.id}/${spot}`);
          const name = spotName(entry, room.id, spot);
          if (!done) {
            return (
              <button key={spot} type="button" className="card card--tap spot__btn" onClick={() => store.dispatch({ type: "search", room: room.id, spot })}>
                <span className="spot__name">{name}</span>
                <span className="spot__state">Search</span>
              </button>
            );
          }
          const found = items.filter((i) => "room" in i && i.room === room.id && i.spot === spot);
          return (
            <div key={spot} className="spot" role="group" aria-label={name}>
              <div className="row">
                <span className="spot__name grow">{name}</span>
                <span className="spot__state">Searched</span>
              </div>
              <div className="found" aria-live="polite">
                {found.length === 0 ? (
                  <p className="muted prose">{spotEmpty(entry, room.id, spot)}</p>
                ) : (
                  found.map((it) => <ItemCard key={it.id} c={c} item={it} pinned={pins.includes(refKey({ kind: "item", id: it.id }))} onPin={pin(it.id)} />)
                )}
              </div>
            </div>
          );
        })}
      </section>
    </Page>
  );
}

