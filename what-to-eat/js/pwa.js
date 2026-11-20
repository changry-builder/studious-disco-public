(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  let deferredPrompt = null;
  let registration = null;
  let updateCb = null;
  let installCb = null;
  let waitingWorker = null;
  let reloading = false;

  function apply() {
    const w = waitingWorker || (registration && registration.waiting);
    if (!w) return;
    w.postMessage({ type: "SKIP_WAITING" });
  }

  function notifyUpdate(worker) {
    waitingWorker = worker;
    if (updateCb) updateCb(apply);
  }

  function watch(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) notifyUpdate(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) notifyUpdate(nw);
      });
    });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installCb) installCb();
    });
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
    });
  }

  WTE.PWA = {
    register() {
      if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
      const loc = root.location;
      const ok =
        loc.protocol === "https:" || loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
      if (!ok) return;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        // Only reload if the user asked to apply an update.
        if (!waitingWorker) return;
        reloading = true;
        loc.reload();
      });
      const go = () =>
        navigator.serviceWorker
          .register("sw.js", { scope: "./" })
          .then((reg) => {
            registration = reg;
            watch(reg);
          })
          .catch(() => {});
      if (document.readyState === "complete") go();
      else root.addEventListener("load", go);
    },
    onUpdateReady(cb) {
      updateCb = cb;
      if (waitingWorker && cb) cb(apply);
    },
    canInstall() {
      return !!deferredPrompt;
    },
    promptInstall() {
      if (!deferredPrompt) return Promise.resolve("unavailable");
      const p = deferredPrompt;
      deferredPrompt = null;
      return Promise.resolve()
        .then(() => p.prompt())
        .then(() => p.userChoice)
        .then((c) => (c && c.outcome === "accepted" ? "accepted" : "dismissed"))
        .catch(() => "dismissed");
    },
    onInstallAvailable(cb) {
      installCb = cb;
      if (deferredPrompt && cb) cb();
    },
    isStandalone() {
      try {
        return (
          (root.matchMedia && root.matchMedia("(display-mode: standalone)").matches) ||
          root.navigator.standalone === true
        );
      } catch (e) {
        return false;
      }
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
