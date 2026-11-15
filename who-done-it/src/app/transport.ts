// The sync seam (docs/architecture.md section 6). v1 ships LocalTransport, which does nothing.

import type { Action, PartyAction } from "../engine/index";

export interface SessionTransport {
  /** Called by the store for every local action, after it is applied and saved. */
  publish(sessionId: string, action: Action | PartyAction): void;
  /** The transport calls back with actions from other devices, in a total order. Returns an unsubscribe. */
  subscribe(sessionId: string, onRemote: (a: Action | PartyAction) => void): () => void;
}

/** Single-device transport: publishes nowhere, never delivers anything. */
export class LocalTransport implements SessionTransport {
  publish(_sessionId: string, _action: Action | PartyAction): void {}
  subscribe(_sessionId: string, _onRemote: (a: Action | PartyAction) => void): () => void {
    return () => {};
  }
}
