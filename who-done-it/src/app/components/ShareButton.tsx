import { useState } from "react";

/** Share via the system sheet if there is one, otherwise copy to the clipboard. */
export function ShareButton({ text, label = "Share", className = "btn btn--small" }: { text: string; label?: string; className?: string }) {
  const [msg, setMsg] = useState("");
  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg("Copied");
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") return;
      setMsg("Could not copy");
    }
    setTimeout(() => setMsg(""), 2000);
  };
  return (
    <>
      <button type="button" className={className} onClick={share}>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" ? label : "Copy"}
      </button>
      <span className="small muted" role="status" aria-live="polite">
        {msg}
      </span>
    </>
  );
}
