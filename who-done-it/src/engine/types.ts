// Shapes for the case engine. The spec is docs/case-engine.md section 3.
// Changing anything here needs the lead architect's sign-off.

export type CharId = string;
export type RoomId = string;
export type WeaponId = string;
export type MotiveType = "inheritance" | "jealousy" | "revenge" | "debt" | "blackmail" | "exposure";
export type WoundClass = "blunt" | "blade" | "ligature";
export type Difficulty = "easy" | "medium" | "hard";

export const MOTIVE_TYPES: readonly MotiveType[] = [
  "inheritance",
  "jealousy",
  "revenge",
  "debt",
  "blackmail",
  "exposure",
];
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

// ---------- Scenario (hand-written) ----------

export interface Room {
  id: RoomId;
  adjacent: RoomId[]; // map only; no movement rules in v1
  spots: string[];
  proofSpot: string;
}
export interface Character {
  id: CharId;
  secret?: { room: RoomId; evidenceSpot: string };
}
export interface Weapon {
  id: WeaponId;
  class: WoundClass;
  home: RoomId;
  homeSpot: string;
  access?: CharId[];
}
export interface MotiveLink {
  id: string;
  suspect: CharId;
  victim: CharId;
  type: MotiveType;
  doc: { room: RoomId; spot: string };
}
export interface Bond {
  from: CharId; // `from` would lie to protect `to`
  to: CharId;
  public: boolean;
  doc?: { room: RoomId; spot: string };
}
export interface Scenario {
  id: string;
  index: number; // 0..15, used in case codes
  slots: { id: number; label: string }[];
  rooms: Room[];
  characters: Character[];
  weapons: Weapon[];
  motives: MotiveLink[];
  bonds: Bond[];
  victims: CharId[];
}

// ---------- Case (generated) ----------

export interface Claim {
  room: RoomId;
  with: CharId[]; // complete list of others present, scenario order; may include the victim
}
export type EvidenceRef =
  | { kind: "claim"; speaker: CharId; slot: number; version: number }
  | { kind: "item"; id: string };
export interface ClaimVersion {
  claim: Claim;
  lie: boolean;
  refutedBy: EvidenceRef[];
}
export interface ClaimChain {
  speaker: CharId;
  slot: number;
  versions: ClaimVersion[];
}

export type Item =
  | { id: string; kind: "wound"; class: WoundClass }
  | { id: string; kind: "tod"; from: number; to: number }
  | { id: string; kind: "weaponInPlace"; weapon: WeaponId; room: RoomId; spot: string }
  | { id: string; kind: "weaponMissing"; weapon: WeaponId; room: RoomId; spot: string }
  | { id: string; kind: "weaponFound"; weapon: WeaponId; used: boolean; room: RoomId; spot: string }
  | { id: string; kind: "motiveDoc"; link: string; room: RoomId; spot: string }
  | { id: string; kind: "bondDoc"; pairs: { from: CharId; to: CharId }[]; room: RoomId; spot: string }
  | { id: string; kind: "presence"; who: CharId; at: RoomId; slot: number; room: RoomId; spot: string }
  | { id: string; kind: "secretTrace"; who: CharId; room: RoomId; spot: string };

export interface Solution {
  killer: CharId;
  weapon: WeaponId;
  motive: MotiveType;
  room: RoomId;
  slot: number;
}
export type Disposition = "atScene" | "hidden" | "gone";
export interface Truth {
  loc: Record<CharId, (RoomId | null)[]>; // null = dead
  secondLiar: null | { kind: "shield" | "secretKeeper"; who: CharId; slot: number };
  weaponTakenSlot: number;
  disposition: Disposition;
}
export interface Case {
  genVersion: number;
  scenarioId: string;
  seed: number;
  difficulty: Difficulty;
  attempt: number;
  fallback: boolean;
  repairs: number;
  victim: CharId;
  suspects: CharId[];
  body: { room: RoomId };
  claims: ClaimChain[];
  items: Item[];
  solution: Solution;
  truth: Truth;
  par: { questions: number };
}

// ---------- Knowledge base (what a player can know) ----------

export interface KB {
  suspects: CharId[];
  victim: CharId;
  bodyRoom: RoomId;
  slots: number;
  rooms: RoomId[];
  /** Latest known claim per suspect and slot; undefined if not known. */
  current: Record<CharId, (Claim | undefined)[]>;
  withdrawn: { who: CharId; slot: number }[];
  bonds: { from: CharId; to: CharId }[];
  items: Item[];
  weapons: Weapon[];
  motiveLinks: MotiveLink[];
}

export type Family = "opportunity" | "means" | "motive";
export interface Fit {
  killer: CharId;
  weapon: WeaponId;
  motive: MotiveType;
}
