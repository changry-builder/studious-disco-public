// Install and update state for the Home screen. No service-worker code lives here:
// src/main.tsx registers the worker and reports into this module, so tests can import it freely.

type Listener = () => void;

let updateReady = false;
let applyFn: (() => void) | null = null;
const listeners = new Set<Listener>();

/** Called by main.tsx when a new version has been downloaded and is waiting. */
export function reportUpdateReady(apply: () => void): void {
  updateReady = true;
  applyFn = apply;
  listeners.forEach((l) => l());
}
export function subscribePwa(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function isUpdateReady(): boolean {
  return updateReady;
}
/** Switch to the new version (reloads the page). Only offered on Home, never mid-case. */
export function applyUpdate(): void {
  applyFn?.();
}

/** True when running from the home-screen icon. */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
}

export type Platform = "ios" | "android" | "other";
export function platform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** The install steps from docs/adr/006-hosting.md, for the visitor's kind of phone. */
export function installSteps(p: Platform): string[] {
  if (p === "ios") return ["Open this page in Safari (not Chrome).", "Tap the Share button.", "Tap \"Add to Home Screen\", then \"Add\".", "Open the game from its new icon."];
  if (p === "android") return ["Open this page in Chrome.", "Tap \"Install app\" when offered, or open the ⋮ menu and tap \"Install app\".", "Open the game from its new icon."];
  return ["On an iPhone: open this page in Safari, tap Share, then \"Add to Home Screen\".", "On Android: open it in Chrome and tap \"Install app\" in the ⋮ menu."];
}
