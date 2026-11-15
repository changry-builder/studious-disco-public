import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { getAppStore } from "./app/store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App store={getAppStore()} />
  </StrictMode>,
);
