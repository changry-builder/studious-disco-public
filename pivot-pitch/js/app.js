// Pivot Pitch screens: setup → ready → pitch → pivot question → ready …

(() => {
  const G = PivotGame;
  const S = PivotSound;
  const app = document.getElementById("app");
  const soundBtn = document.getElementById("sound-btn");
  const banner = document.getElementById("pivot-banner");
  const STORE_KEY = "pivot-pitch:settings";

  const SOUND_LABELS = { sound: "🔊 Sound", vibrate: "📳 Vibrate", mute: "🔇 Mute" };
  const CHALLENGE_LABELS = { off: "Off", adjective: "Pivot the adjective", noun: "Pivot the noun" };
  const RING_C = 2 * Math.PI * 54; // clock ring circumference (r = 54)

  let settings = loadSettings();
  let pitch = null; // the pitch in progress
  let screen = "setup";

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  function loadSettings() {
    try {
      return G.normalizeSettings(JSON.parse(localStorage.getItem(STORE_KEY)));
    } catch (e) {
      return G.normalizeSettings();
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  function setSound(mode) {
    settings.sound = mode;
    S.setMode(mode);
    soundBtn.textContent = SOUND_LABELS[mode];
    soundBtn.setAttribute("aria-label", `Sound: ${mode}. Tap to change.`);
    saveSettings();
  }

  // ---------- Setup ----------

  function pills(name, options, labelFor, current, disabled = false) {
    return options
      .map(
        (value) => `
        <label class="pill">
          <input type="radio" name="${name}" value="${value}" ${String(value) === String(current) ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <span>${esc(labelFor(value))}</span>
        </label>`
      )
      .join("");
  }

  function renderSetup() {
    stopPitch();
    const refresh = screen === "setup"; // an option changed, so don't replay the entrance
    screen = "setup";
    const untimed = settings.timer === 0;
    app.innerHTML = `
      <section class="screen setup ${refresh ? "still" : ""}">
        <h1 class="title">Pivot <span>Pitch</span></h1>
        <p class="lede">Start the clock, flip two cards, and pitch the product they make.
          When time's up, the room picks a curveball question for you to answer on the spot.</p>

        <fieldset class="option">
          <legend>Pitch timer</legend>
          <div class="pills">${pills("timer", G.TIMER_OPTIONS, (v) => (v ? `${v} sec` : "Untimed"), settings.timer)}</div>
        </fieldset>

        <fieldset class="option">
          <legend>Challenge mode</legend>
          <div class="pills">${pills("challenge", G.CHALLENGE_OPTIONS, (v) => CHALLENGE_LABELS[v], settings.challenge, untimed)}</div>
          <p class="hint">${
            untimed
              ? "Challenge mode needs a timer. Pick 60 or 90 seconds to turn it on."
              : "Halfway through the pitch, that card flips to a new word and you have to pivot."
          }</p>
        </fieldset>

        <fieldset class="option">
          <legend>Sound</legend>
          <div class="pills">${pills("sound", G.SOUND_OPTIONS, (v) => SOUND_LABELS[v], settings.sound)}</div>
          ${settings.sound === "vibrate" && !S.canVibrate() ? `<p class="hint">This device can't vibrate, so you won't feel anything.</p>` : ""}
        </fieldset>

        <button class="big-btn" id="go" type="button">Let's pitch!</button>
      </section>`;

    app.querySelectorAll("input[type=radio]").forEach((input) =>
      input.addEventListener("change", () => {
        S.unlock();
        if (input.name === "timer") settings.timer = Number(input.value);
        if (input.name === "challenge") settings.challenge = input.value;
        if (input.name === "sound") setSound(input.value);
        saveSettings();
        renderSetup();
        app.querySelector(`input[name=${input.name}][value="${input.value}"]`).focus();
      })
    );
    app.querySelector("#go").addEventListener("click", () => {
      S.unlock();
      renderReady();
    });
  }

  // ---------- Ready: cards face down until the clock starts ----------

  function settingsSummary() {
    const parts = [settings.timer ? `${settings.timer} sec` : "Untimed"];
    if (G.challengeActive(settings)) parts.push(`Challenge: ${settings.challenge} pivots`);
    return parts.join(" · ");
  }

  function renderReady() {
    stopPitch();
    screen = "ready";
    app.innerHTML = `
      <section class="screen ready">
        <p class="kicker">Next player</p>
        <h2>Step up to pitch!</h2>
        <p class="sub">Your cards flip over when the clock starts.</p>
        <div class="combo">
          <div class="card adjective back"><span class="card-word">?</span></div>
          <span class="plus" aria-hidden="true">+</span>
          <div class="card noun back"><span class="card-word">?</span></div>
        </div>
        <button class="big-btn" id="start" type="button">Start pitch</button>
        <p class="chips">${esc(settingsSummary())}</p>
        <button class="link-btn" id="change" type="button">Change settings</button>
      </section>`;
    app.querySelector("#start").addEventListener("click", startPitch);
    app.querySelector("#change").addEventListener("click", renderSetup);
    app.querySelector("#start").focus();
  }

  // ---------- Pitch ----------

  function cardHTML(side, word, extra = "") {
    return `
      <div class="card ${side} ${extra}" data-side="${side}">
        <span class="card-label">${side === "adjective" ? "Adjective" : "Noun"}</span>
        <span class="card-word">${esc(word)}</span>
      </div>`;
  }

  function startPitch() {
    S.unlock();
    screen = "pitch";
    const timed = settings.timer > 0;
    pitch = {
      combo: G.dealCombo(),
      original: null,
      timed,
      durationMs: settings.timer * 1000,
      startedAt: performance.now(),
      lastSecond: null,
      swapped: false,
      raf: 0,
      wakeLock: null,
    };

    app.innerHTML = `
      <section class="screen pitch">
        <div class="clock ${timed ? "" : "untimed"}" id="clock" role="timer" aria-live="off">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="54" />
            <circle class="ring" id="ring" cx="60" cy="60" r="54" stroke-dasharray="${RING_C}" stroke-dashoffset="0" />
          </svg>
          <div class="clock-text">
            <span class="clock-time" id="clock-time">${timed ? G.formatClock(settings.timer) : "0:00"}</span>
            <span class="clock-label">${timed ? "left" : "untimed"}</span>
          </div>
        </div>
        <div class="combo dealt">
          ${cardHTML("adjective", pitch.combo.adjective, "flip-in")}
          <span class="plus" aria-hidden="true">+</span>
          ${cardHTML("noun", pitch.combo.noun, "flip-in")}
        </div>
        <ul class="beats">
          <li><strong>Who</strong> is it for?</li>
          <li><strong>What</strong> problem does it solve?</li>
          <li><strong>Why</strong> is it worth it?</li>
        </ul>
        ${G.challengeActive(settings) ? `<p class="chips warn">Heads up: your ${settings.challenge} pivots at ${G.formatClock(settings.timer / 2)}</p>` : ""}
        <button class="big-btn secondary" id="done" type="button">${timed ? "Done early" : "Done pitching"}</button>
      </section>`;

    app.querySelector("#done").addEventListener("click", () => endPitch(false));
    requestWakeLock();
    pitch.raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!pitch) return;
    const elapsed = now - pitch.startedAt;
    const timeEl = document.getElementById("clock-time");

    if (!pitch.timed) {
      timeEl.textContent = G.formatClock(elapsed / 1000);
      pitch.raf = requestAnimationFrame(tick);
      return;
    }

    const msLeft = pitch.durationMs - elapsed;
    const secs = G.secondsLeft(msLeft);
    const ring = document.getElementById("ring");
    ring.setAttribute("stroke-dashoffset", String(RING_C * Math.min(1, elapsed / pitch.durationMs)));

    if (secs !== pitch.lastSecond) {
      pitch.lastSecond = secs;
      timeEl.textContent = G.formatClock(secs);
      document.getElementById("clock").classList.toggle("urgent", secs <= G.TICK_FROM);
      if (G.isTickSecond(secs) && msLeft > 0) S.play("tick", secs);
    }

    if (!pitch.swapped && G.challengeActive(settings) && elapsed >= G.swapAtMs(settings.timer)) {
      pitch.swapped = true;
      doChallengePivot();
    }

    if (msLeft <= 0) {
      endPitch(true);
      return;
    }
    pitch.raf = requestAnimationFrame(tick);
  }

  // Challenge mode: flip the chosen card to a new word mid-pitch.
  function doChallengePivot() {
    const side = settings.challenge;
    pitch.original = { ...pitch.combo };
    pitch.combo = G.pivotCombo(pitch.combo, side);
    const card = app.querySelector(`.card[data-side="${side}"]`);
    S.play("pivot");
    showBanner();
    card.classList.remove("flip-in");
    card.classList.add("pivoting");
    // Change the word while the card is edge-on, halfway through the flip.
    setTimeout(() => {
      card.querySelector(".card-word").textContent = pitch.combo[side];
      card.classList.add("pivoted");
    }, 300);
    setTimeout(() => card.classList.remove("pivoting"), 650);
    app.querySelector(".chips.warn")?.remove();
  }

  function showBanner() {
    banner.classList.remove("show");
    void banner.offsetWidth; // restart the animation
    banner.classList.add("show");
    clearTimeout(showBanner.timer);
    showBanner.timer = setTimeout(() => banner.classList.remove("show"), 1400);
  }

  function endPitch(timeUp) {
    if (!pitch) return;
    const done = { combo: pitch.combo, original: pitch.original, timeUp };
    stopPitch();
    if (timeUp) S.play("buzzer");
    renderPivot(done);
  }

  function stopPitch() {
    if (!pitch) return;
    cancelAnimationFrame(pitch.raf);
    releaseWakeLock(pitch);
    pitch = null;
    banner.classList.remove("show");
  }

  // Keep the screen on while someone pitches.
  async function requestWakeLock() {
    const current = pitch;
    try {
      if (navigator.wakeLock) {
        const lock = await navigator.wakeLock.request("screen");
        if (pitch === current) current.wakeLock = lock;
        else lock.release();
      }
    } catch (e) {}
  }

  function releaseWakeLock(p) {
    try {
      if (p.wakeLock) p.wakeLock.release();
    } catch (e) {}
  }

  // ---------- Pivot question ----------

  function renderPivot({ combo, original, timeUp }) {
    screen = "pivot";
    const questions = G.pivotQuestions();
    const name = `${combo.adjective} ${combo.noun}`;
    const was = original ? ` <span class="was">(started as ${esc(original.adjective)} ${esc(original.noun)})</span>` : "";
    app.innerHTML = `
      <section class="screen pivot">
        <p class="kicker">${timeUp ? "Time's up!" : "Nice pitch!"}</p>
        <h2>Pivot question</h2>
        <p class="product">You pitched the <strong>${esc(name)}</strong>${was}</p>
        <p class="sub" id="pivot-sub">Everyone else: pick a question to ask.</p>
        <div class="pivot-cards">
          ${questions
            .map(
              (q, i) => `
            <button class="card pivot-card" type="button" data-i="${i}">
              <span class="card-label">Pivot</span>
              <span class="card-q">${esc(q)}</span>
            </button>`
            )
            .join("")}
        </div>
        <button class="big-btn" id="next" type="button">Next player</button>
      </section>`;

    const cards = app.querySelectorAll(".pivot-card");
    cards.forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.classList.contains("chosen")) return;
        cards.forEach((c) => {
          c.classList.toggle("chosen", c === btn);
          c.classList.toggle("dismissed", c !== btn);
          c.setAttribute("aria-pressed", String(c === btn));
        });
        document.getElementById("pivot-sub").textContent = "Answer this one on the spot!";
        S.play("pivot");
      })
    );
    app.querySelector("#next").addEventListener("click", renderReady);
  }

  // ---------- Global controls ----------

  soundBtn.addEventListener("click", () => {
    S.unlock();
    const i = G.SOUND_OPTIONS.indexOf(settings.sound);
    setSound(G.SOUND_OPTIONS[(i + 1) % G.SOUND_OPTIONS.length]);
    if (screen === "setup") renderSetup();
  });

  document.getElementById("home").addEventListener("click", renderSetup);

  // Space or Enter starts a pitch from the ready screen.
  document.addEventListener("keydown", (e) => {
    if (screen !== "ready" || (e.key !== " " && e.key !== "Enter")) return;
    if (e.target.closest && e.target.closest("button, input")) return;
    e.preventDefault();
    startPitch();
  });

  setSound(settings.sound);
  renderSetup();
})();
