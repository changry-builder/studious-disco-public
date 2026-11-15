// Builds the list of things a player can put in front of a suspect or offer as proof.
// Pure: reads only the player's own view of the case.

import { refKey, type EvidenceRef } from "../../engine/index";
import type { CaseCtx } from "../ctx";
import { charName, claimSentence, itemText, itemTitle, slotLabel } from "../text";

export interface EvidenceOption {
  key: string;
  ref: EvidenceRef;
  group: "clue" | "testimony";
  title: string;
  text: string;
  slot?: number;
}

/** Every item held, and every CURRENT statement by someone other than `exceptSpeaker`. */
export function evidenceOptions(c: CaseCtx, exceptSpeaker?: string): EvidenceOption[] {
  const out: EvidenceOption[] = [];
  for (const item of [...c.solo.view.items].reverse()) {
    const ref: EvidenceRef = { kind: "item", id: item.id };
    out.push({ key: refKey(ref), ref, group: "clue", title: itemTitle(c.entry, item), text: itemText(c.entry, c.cs, item) });
  }
  for (const st of c.solo.view.statements) {
    if (st.speaker === exceptSpeaker) continue;
    const version = st.versions.length - 1;
    const ref: EvidenceRef = { kind: "claim", speaker: st.speaker, slot: st.slot, version };
    out.push({
      key: refKey(ref),
      ref,
      group: "testimony",
      title: `${charName(c.entry, st.speaker)}, ${slotLabel(c.entry, st.slot)}`,
      text: claimSentence(c.entry, c.cs.seed, st.speaker, st.slot, st.versions[version]!),
      slot: st.slot,
    });
  }
  return out;
}
