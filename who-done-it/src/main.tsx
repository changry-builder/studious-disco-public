import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Placeholder until milestone 3 builds the screens.
function App() {
  return <main style={{ padding: 16, fontFamily: "serif" }}>Who Done It? — under construction.</main>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
