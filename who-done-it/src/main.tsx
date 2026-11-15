import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { reportUpdateReady } from "./app/pwa";
import { getAppStore } from "./app/store";

// Offline support. A new version is downloaded quietly and offered on the Home screen.
const updateSW = registerSW({
  onNeedRefresh() {
    reportUpdateReady(() => void updateSW(true));
  },
});

// Ask the browser not to evict saves. The answer does not matter.
void navigator.storage?.persist?.();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App store={getAppStore()} />
  </StrictMode>,
);
