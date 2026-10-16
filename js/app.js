// Capital Clash UI: pass-and-play screens, the per-question clock and the reveal board.

(function () {
  const E = Engine;
  const app = document.getElementById("app");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    names: ["Player 1", "Player 2"],
    seconds: 20,
    difficulty: "rising", // "rising" (Easy, Medium, Hard) or a fixed tier: "1", "2", "3"
    topic: "geo", // "geo" (World geography) or "supplies" (School supplies)
    mode: "cities", // geography game: "cities", "countries" or "top3"
    rounds: [], // { tier, questions, order: [first, second], turns: [items|null, items|null] }
    roundIndex: 0,
    turnStep: 0, // 0 = first player of the round, 1 = second
  };

  let turn = null; // live turn: { player, items, cur, last, timer }

  // ---------- helpers ----------

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  const playerTag = (i) => `<span class="who p${i}">${esc(state.names[i])}</span>`;
  const tierName = (tier) => ["", "Easy", "Medium", "Hard"][tier];
  const DIFFICULTIES = [
    { value: "rising", label: "Easy → Hard" },
    { value: "1", label: "Easy" },
    { value: "2", label: "Medium" },
    { value: "3", label: "Hard" },
  ];
  const studyKey = (c) => `Capital <b>${esc(names(c.capital))}</b> · Largest <b>${esc(names(c.largest))}</b>`;

  // What changes between the two games. A question is { country } or, in City → Country,
  // { country, clue, clueRole, answers }.
  const MODES = {
    cities: {
      label: "Country → city",
      lede: "You get a country. Name a city. Capitals and the biggest city score the most.",
      ask: "Name a city in",
      placeholder: "Type a city…",
      prompt: (q) => q.country.name,
      chip: (q) => q.country.code,
      pick: (tier, used) => E.pickRound(COUNTRIES, tier, used).map((country) => ({ country })),
      judge: (q, text) => {
        const r = E.judge(q.country, text);
        return { kind: r.kind, match: r.city };
      },
      scored: (kind) => ["capital", "largest", "both"].includes(kind),
      rowHead: (q) => `
        <span class="code">${esc(q.country.code)}</span>
        <span class="cname">${esc(q.country.name)}</span>${E.isTrap(q.country) ? `<span class="trap">Trap</span>` : ""}
        <span class="key">${studyKey(q.country)}</span>`,
      studyNote: "Countries where someone missed both the capital and the largest city.",
      perfect: "Nobody missed a capital or largest city all game.",
      rules: (p) => `
        <tr><td>Capital city</td><td class="num">${p.capital}</td></tr>
        <tr><td>Most populous city</td><td class="num">${p.largest}</td></tr>
        <tr><td>Both at once (e.g. Paris for France)</td><td class="num">${p.both}</td></tr>
        <tr><td>Any other major city</td><td class="num">${p.major}</td></tr>
        <tr><td>Quick answer (half the clock left, capital or largest)</td><td class="num">+${E.FAST_BONUS}</td></tr>`,
      tip: "Watch for traps: Australia's capital is not Sydney.",
      fastBonus: true,
    },
    countries: {
      label: "City → country",
      lede: "You get a city. Name the country it's in. Some are capitals, some are a country's second or third city.",
      ask: "Which country is this in?",
      placeholder: "Type a country…",
      prompt: (q) => q.clue,
      chip: (q, i) => `#${i + 1}`,
      pick: (tier, used) => E.pickReverseRound(COUNTRIES, tier, used),
      judge: (q, text) => {
        const r = E.judgeCountry(COUNTRIES, q.answers, text);
        return { kind: r.kind, match: r.country, code: r.code };
      },
      scored: (kind) => kind === "country",
      rowHead: (q) => {
        const also = q.answers
          .filter((code) => code !== q.country.code)
          .map((code) => E.countryNames(COUNTRIES.find((c) => c.code === code))[0]);
        return `
        <span class="cname">${esc(q.clue)}</span>
        <span class="key">${esc(q.clueRole)} of <b>${esc(q.country.name)}</b>${
          also.length ? ` · also a city in <b>${esc(also.join(", "))}</b>` : ""
        }</span>`;
      },
      studyNote: "Cities someone couldn't place.",
      perfect: "Nobody misplaced a city all game.",
      rules: (p) => `
        <tr><td>Right country</td><td class="num">${p.country}</td></tr>
        <tr><td>Quick answer (half the clock left)</td><td class="num">+${E.FAST_BONUS}</td></tr>`,
      tip: "Some city names exist in more than one country. Valencia is in Spain and Venezuela; either counts.",
      fastBonus: true,
    },
    top3: {
      label: "Top 3 cities",
      lede: "You get a country's three biggest cities, one at a time, smallest first. Name the country. The fewer cities you need, the more you score.",
      ask: "Which country's three biggest cities?",
      placeholder: "Type a country…",
      ladder: true,
      rungs: (q) => [
        { label: "3rd biggest", text: q.cities[2] },
        { label: "2nd biggest", text: q.cities[1] },
        { label: "Biggest city", text: q.cities[0] },
      ],
      chip: (q, i) => `#${i + 1}`,
      pick: (tier, used) => E.pickTop3Round(COUNTRIES, PLACES, tier, used),
      judge: (q, text, shown) => {
        const r = E.judgeCountry(COUNTRIES, q.answers, text);
        return { kind: r.kind === "country" ? `top${shown}` : r.kind, match: r.country, code: r.code, shown };
      },
      scored: (kind) => /^top/.test(kind),
      rowHead: (q) => `
        <span class="code">${esc(q.country.code)}</span>
        <span class="cname">${esc(q.country.name)}</span>
        <span class="key">${q.cities.map((c, k) => `${k + 1}. <b>${esc(c)}</b>`).join(" · ")}</span>`,
      prompt: (q) => q.country.name,
      studyNote: "Countries someone couldn't name from their three biggest cities.",
      perfect: "Nobody missed a country all game.",
      rules: (p) => `
        <tr><td>Right country with 1 city showing</td><td class="num">${p.top1}</td></tr>
        <tr><td>With 2 cities showing</td><td class="num">${p.top2}</td></tr>
        <tr><td>With all 3 showing</td><td class="num">${p.top3}</td></tr>`,
      tip: `A new city appears every ${E.REVEAL_EVERY_MS / 1000} seconds: the third biggest, then the second, then the biggest.`,
      fastBonus: false,
    },
    supplies: {
      topic: "supplies",
      label: "School supplies",
      lede: "You get three clues about a school supply, hardest first, one every 5 seconds. Name it. The fewer clues you need, the more you score.",
      ask: "What's this school supply?",
      placeholder: "Type an item…",
      ladder: true,
      rungs: (q) => q.clues.map((text, k) => ({ label: `Clue ${k + 1}`, text, plain: true })),
      chip: (q, i) => `#${i + 1}`,
      pick: (tier, used) => E.pickItems(SUPPLIES, tier, used),
      judge: (q, text, shown) => {
        const r = E.judgeItem(SUPPLIES, q.item, text);
        return { kind: r.kind === "right" ? `top${shown}` : r.kind, match: r.item, shown };
      },
      scored: (kind) => /^top/.test(kind),
      labels: { top1: "On 1 clue", top2: "On 2 clues", top3: "On 3 clues", wrong: "Wrong item" },
      columnLabel: "Item",
      map: false,
      rowHead: (q) => `
        <span class="cname">${esc(q.item.name)}</span>
        <span class="key clue-list">${q.clues.map((c, k) => `${k + 1}. ${esc(c)}`).join("<br />")}</span>`,
      prompt: (q) => q.item.name,
      studyNote: "Items someone couldn't name.",
      perfect: "Nobody missed an item all game.",
      rules: (p) => `
        <tr><td>Right item after 1 clue</td><td class="num">${p.top1}</td></tr>
        <tr><td>After 2 clues</td><td class="num">${p.top2}</td></tr>
        <tr><td>After all 3 clues</td><td class="num">${p.top3}</td></tr>`,
      tip: "Other names count too: rubber for eraser, Post-it for sticky notes, Sharpie for marker.",
      fastBonus: false,
    },
  };
  const TOPICS = [
    { value: "geo", label: "World geography" },
    { value: "supplies", label: "School supplies" },
  ];
  const modeFor = (topic, game) => (topic === "supplies" ? MODES.supplies : MODES[game]);
  const mode = () => modeFor(state.topic, state.mode);

  const tierForRound = (r) => (state.difficulty === "rising" ? r + 1 : Number(state.difficulty));
  const round = () => state.rounds[state.roundIndex];
  const names = (list) => list.map(E.displayName).join(" / ");

  function total(player, upToRound = state.rounds.length - 1) {
    let sum = 0;
    state.rounds.slice(0, upToRound + 1).forEach((r) => {
      const items = r.turns[player];
      if (items) items.forEach((it) => (sum += it.points.total));
    });
    return sum;
  }

  function roundTotal(r, player) {
    const items = r.turns[player];
    return items ? items.reduce((s, it) => s + it.points.total, 0) : 0;
  }

  function show(html) {
    stopClock();
    app.innerHTML = html;
    window.scrollTo(0, 0);
    const focusTarget = app.querySelector("[autofocus]");
    if (focusTarget) focusTarget.focus();
  }

  // Split-flap board letters. Each letter cycles briefly, then settles.
  const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function flapHTML(text) {
    return text
      .toUpperCase()
      .split(" ")
      .map(
        (word) =>
          `<span class="flap-word">${[...word]
            .map((ch) => `<span class="flap" data-ch="${esc(ch)}">${esc(ch)}</span>`)
            .join("")}</span>`
      )
      .join("");
  }

  function animateFlaps(root) {
    if (reduceMotion) return;
    root.querySelectorAll(".flap").forEach((el, i) => {
      const final = el.dataset.ch;
      if (!/[A-Z]/.test(final)) return;
      let spins = 4 + i;
      el.classList.add("spinning");
      const id = setInterval(() => {
        if (--spins <= 0) {
          clearInterval(id);
          el.textContent = final;
          el.classList.remove("spinning");
          return;
        }
        el.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
      }, 45);
    });
  }

  // Remember the last setup on this device. Storage can be unavailable, so ignore failures.
  const PREFS_KEY = "capital-clash-setup";
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
    if (saved) {
      if (Array.isArray(saved.names) && saved.names.length === 2) state.names = saved.names.map(String);
      if ([15, 20].includes(saved.seconds)) state.seconds = saved.seconds;
      if (DIFFICULTIES.some((d) => d.value === saved.difficulty)) state.difficulty = saved.difficulty;
      if (MODES[saved.mode] && !MODES[saved.mode].topic) state.mode = saved.mode;
      if (TOPICS.some((t) => t.value === saved.topic)) state.topic = saved.topic;
    }
  } catch (e) {}

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ names: state.names, seconds: state.seconds, difficulty: state.difficulty, mode: state.mode, topic: state.topic }));
    } catch (e) {}
  }

  // ---------- setup ----------

  function rulesHTML(m) {
    return `
          <h2 class="section-title">Scoring</h2>
          <table class="fare"><tbody>${m.rules(E.POINTS)}</tbody></table>
          <ul class="fine">
            <li>${E.ROUND_COUNT} rounds of ${E.COUNTRIES_PER_ROUND} questions. The last round counts double.</li>
            <li>Easy → Hard gets tougher each round. Pick Easy, Medium or Hard to stay at one level all game.</li>
            <li>Each question has its own clock. Skip one and its clock pauses until you come back.</li>
            <li>One answer per question. Spelling slips and missing accents are forgiven.</li>
            <li>${m.tip}</li>
          </ul>`;
  }

  function renderSetup() {
    show(`
      <section class="screen setup">
        <header class="marquee">
          <p class="eyebrow">Departures · 2 players · 1 device</p>
          <h1 class="board-title">${flapHTML("Capital Clash")}</h1>
          <p class="lede"><span id="mode-lede">${mode().lede}</span> Take turns on the same device; neither of you sees the other's answers until the round is over.</p>
        </header>

        <form class="panel" id="setup-form" autocomplete="off">
          <div class="field-row">
            <label class="field">
              <span class="label"><span class="dot p0"></span>Player 1</span>
              <input id="name-0" maxlength="16" value="${esc(state.names[0])}" />
            </label>
            <label class="field">
              <span class="label"><span class="dot p1"></span>Player 2</span>
              <input id="name-1" maxlength="16" value="${esc(state.names[1])}" />
            </label>
          </div>

          <fieldset class="field">
            <legend class="label">Topic</legend>
            <div class="segmented two" role="radiogroup">
              ${TOPICS.map(
                (t) => `
                <label><input type="radio" name="topic" id="topic-${t.value}" value="${t.value}" ${state.topic === t.value ? "checked" : ""}/><span>${t.label}</span></label>`
              ).join("")}
            </div>
          </fieldset>

          <fieldset class="field" id="game-field" ${state.topic === "geo" ? "" : "hidden"}>
            <legend class="label">Game</legend>
            <div class="segmented three" role="radiogroup">
              ${Object.entries(MODES)
                .filter(([, m]) => !m.topic)
                .map(
                  ([value, m]) => `
                <label><input type="radio" name="mode" id="mode-${value}" value="${value}" ${state.mode === value ? "checked" : ""}/><span>${m.label}</span></label>`
                )
                .join("")}
            </div>
          </fieldset>

          <fieldset class="field">
            <legend class="label">Seconds per question</legend>
            <div class="segmented" role="radiogroup">
              ${[15, 20]
                .map(
                  (s) => `
                <label><input type="radio" name="seconds" id="sec-${s}" value="${s}" ${state.seconds === s ? "checked" : ""}/><span>${s}s</span></label>`
                )
                .join("")}
            </div>
          </fieldset>

          <fieldset class="field">
            <legend class="label">Difficulty</legend>
            <div class="segmented four" role="radiogroup">
              ${DIFFICULTIES.map(
                (d) => `
                <label><input type="radio" name="difficulty" id="diff-${d.value}" value="${d.value}" ${state.difficulty === d.value ? "checked" : ""}/><span>${d.label}</span></label>`
              ).join("")}
            </div>
          </fieldset>

          <button class="btn primary big" type="submit">Board the flight</button>
        </form>

        <section class="panel rules" id="rules">${rulesHTML(mode())}</section>
      </section>`);

    // Keep the intro and scoring in step with the chosen topic and game.
    const refresh = () => {
      const topic = app.querySelector('input[name="topic"]:checked').value;
      const m = modeFor(topic, app.querySelector('input[name="mode"]:checked').value);
      document.getElementById("game-field").hidden = topic !== "geo";
      document.getElementById("mode-lede").textContent = m.lede;
      document.getElementById("rules").innerHTML = rulesHTML(m);
    };
    app.querySelectorAll('input[name="mode"], input[name="topic"]').forEach((radio) => radio.addEventListener("change", refresh));

    document.getElementById("setup-form").addEventListener("submit", (e) => {
      e.preventDefault();
      state.names = [0, 1].map((i) => document.getElementById(`name-${i}`).value.trim() || `Player ${i + 1}`);
      state.seconds = Number(app.querySelector('input[name="seconds"]:checked').value);
      state.difficulty = app.querySelector('input[name="difficulty"]:checked').value;
      state.mode = app.querySelector('input[name="mode"]:checked').value;
      state.topic = app.querySelector('input[name="topic"]:checked').value;
      savePrefs();
      startMatch();
    });
  }

  function startMatch() {
    const used = new Set();
    state.rounds = [];
    for (let r = 0; r < E.ROUND_COUNT; r++) {
      const tier = tierForRound(r);
      const questions = mode().pick(tier, used);
      questions.forEach((q) => used.add(q.key || q.country.code));
      state.rounds.push({ tier, questions, order: r % 2 === 0 ? [0, 1] : [1, 0], turns: [null, null] });
    }
    state.roundIndex = 0;
    state.turnStep = 0;
    renderHandoff();
  }

  // ---------- hand-off ----------

  function renderHandoff() {
    const r = round();
    const player = r.order[state.turnStep];
    const other = 1 - player;
    const mult = E.multiplierForRound(state.roundIndex);
    const intro =
      state.turnStep === 0
        ? `Round ${state.roundIndex + 1} of ${E.ROUND_COUNT} · ${tierName(r.tier)}${mult > 1 ? ` · ×${mult} points` : ""}`
        : `${esc(state.names[other])} is done. Their answers stay hidden until you finish.`;

    show(`
      <section class="screen handoff p${player}-theme">
        <p class="eyebrow">${intro}</p>
        <h1 class="gate">Now boarding<br />${playerTag(player)}</h1>
        <p class="lede">Hand the device to ${esc(state.names[player])}. ${esc(state.names[other])}, no peeking.</p>
        <ul class="ticket">
          <li><span class="label">Game</span><span>${mode().label}</span></li>
          <li><span class="label">Questions</span><span>${E.COUNTRIES_PER_ROUND}</span></li>
          <li><span class="label">Clock</span><span>${state.seconds}s each</span></li>
          <li><span class="label">Skip</span><span><kbd>Tab</kbd></span></li>
          <li><span class="label">Lock in</span><span><kbd>Enter</kbd></span></li>
        </ul>
        <button class="btn primary big" id="go" autofocus>I'm ${esc(state.names[player])}. Start</button>
      </section>`);
    document.getElementById("go").addEventListener("click", () => startTurn(player));
  }

  // ---------- the turn ----------

  function startTurn(player) {
    const limit = state.seconds * 1000;
    turn = {
      player,
      limit,
      cur: 0,
      items: round().questions.map((q) => ({
        q,
        left: limit,
        status: "pending", // pending | answered | timeout | passed
        draft: "",
        answer: "",
        result: null,
        points: { base: 0, bonus: 0, total: 0 },
      })),
      last: 0,
      timer: null,
    };
    renderTurnShell();
    showCurrent();
    startClock();
  }

  function renderTurnShell() {
    const r = round();
    const mult = E.multiplierForRound(state.roundIndex);
    show(`
      <section class="screen turn p${turn.player}-theme">
        <header class="turn-head">
          <span class="eyebrow">Round ${state.roundIndex + 1} · ${tierName(r.tier)}${mult > 1 ? ` · ×${mult}` : ""}</span>
          ${playerTag(turn.player)}
        </header>

        <ol class="chips" id="chips"></ol>

        <div class="stage">
          <p class="eyebrow">${mode().ask}</p>
          <div class="prompt" id="country" aria-live="polite"></div>
          <div class="clock" aria-hidden="true"><div class="clock-fill" id="clock-fill"></div></div>
          <p class="clock-num" id="clock-num"></p>
        </div>

        <form class="answer" id="answer-form" autocomplete="off">
          <label class="sr-only" for="answer">Your answer</label>
          <input id="answer" placeholder="${mode().placeholder}" spellcheck="false" autocapitalize="words" />
          <div class="answer-actions">
            <button class="btn ghost" type="button" id="skip">Skip</button>
            <button class="btn primary" type="submit">Lock in</button>
          </div>
        </form>
      </section>`);

    const input = document.getElementById("answer");
    input.addEventListener("input", () => (turn.items[turn.cur].draft = input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        skip();
      }
    });
    document.getElementById("answer-form").addEventListener("submit", (e) => {
      e.preventDefault();
      lockIn();
    });
    document.getElementById("skip").addEventListener("click", skip);
    document.getElementById("chips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-index]");
      if (!chip) return;
      const i = Number(chip.dataset.index);
      if (turn.items[i].status === "pending" && i !== turn.cur) {
        turn.cur = i;
        showCurrent();
      }
    });
  }

  function pendingOthers() {
    return turn.items.some((it, i) => it.status === "pending" && i !== turn.cur);
  }

  // Ladder games (Top 3 cities, School supplies): how many clues this question is showing.
  const shownFor = (item) => E.citiesShown(turn.limit - item.left);
  const rungWait = (item, step) => Math.max(1, Math.ceil((step * E.REVEAL_EVERY_MS - (turn.limit - item.left)) / 1000));

  // The clues in the order they appear. Hidden ones say when they'll show.
  function renderLadder(item, freshStep) {
    const shown = shownFor(item);
    const rungs = mode().rungs(item.q);
    const el = document.getElementById("country");
    el.innerHTML = `<ol class="ladder">${rungs
      .map((r, k) => {
        const visible = k < shown;
        const cls = ["rung", visible ? "shown" : "hidden", k === rungs.length - 1 ? "last" : "", visible && k === freshStep ? "fresh" : ""];
        const body = !visible
          ? `<span class="rung-wait">Shows in ${rungWait(item, k)}s</span>`
          : r.plain
          ? `<p class="rung-clue">${esc(r.text)}</p>`
          : `<span class="board-title rung-name ${r.text.length > 14 ? "long" : ""}">${flapHTML(r.text)}</span>`;
        return `<li class="${cls.join(" ")}" data-step="${k}"><span class="rung-label">${esc(r.label)}</span>${body}</li>`;
      })
      .join("")}</ol>`;
    item.shownRendered = shown;
    el.querySelectorAll(".rung.shown").forEach((rung) => {
      if (freshStep == null || Number(rung.dataset.step) === freshStep) animateFlaps(rung);
    });
  }

  function showCurrent() {
    const item = turn.items[turn.cur];
    const countryEl = document.getElementById("country");
    if (mode().ladder) {
      renderLadder(item);
    } else {
      const prompt = mode().prompt(item.q);
      countryEl.innerHTML = `<h1 class="board-title country ${prompt.length > 16 ? "long" : ""}">${flapHTML(prompt)}</h1>`;
      animateFlaps(countryEl);
    }
    const input = document.getElementById("answer");
    input.value = item.draft;
    input.focus();
    document.getElementById("skip").textContent = pendingOthers() ? "Skip" : "Pass";
    renderChips();
    renderClock();
  }

  function renderChips() {
    const chips = document.getElementById("chips");
    chips.innerHTML = turn.items
      .map((it, i) => {
        const current = i === turn.cur;
        const secs = Math.ceil(it.left / 1000);
        const status =
          it.status === "answered" ? "Locked" : it.status === "timeout" ? "Time" : it.status === "passed" ? "Passed" : current ? "Now" : `${secs}s`;
        const pickable = it.status === "pending" && !current;
        return `<li>
          <button type="button" class="chip ${it.status} ${current ? "current" : ""}" data-index="${i}" ${pickable ? "" : "disabled"}
            aria-label="Question ${i + 1}: ${status}">
            <span class="chip-code">${esc(mode().chip(it.q, i))}</span>
            <span class="chip-status">${status}</span>
          </button>
        </li>`;
      })
      .join("");
  }

  function renderClock() {
    const item = turn.items[turn.cur];
    const frac = Math.max(0, item.left / turn.limit);
    const fill = document.getElementById("clock-fill");
    fill.style.transform = `scaleX(${frac})`;
    fill.classList.toggle("low", item.left <= 5000);
    const secs = `${Math.ceil(item.left / 1000)}s`;
    if (mode().ladder) {
      const shown = shownFor(item);
      fill.classList.toggle("fast", shown === 1);
      document.getElementById("clock-num").textContent = `${secs} · worth ${E.POINTS[`top${shown}`]} now`;
      return;
    }
    fill.classList.toggle("fast", item.left >= turn.limit / 2);
    document.getElementById("clock-num").textContent = `${secs}${item.left >= turn.limit / 2 ? " · quick bonus live" : ""}`;
  }

  function startClock() {
    turn.last = performance.now();
    turn.timer = setInterval(tick, 100);
  }

  function stopClock() {
    if (turn && turn.timer) {
      clearInterval(turn.timer);
      turn.timer = null;
    }
  }

  function tick() {
    const now = performance.now();
    const item = turn.items[turn.cur];
    item.left -= now - turn.last;
    turn.last = now;
    if (item.left <= 0) {
      item.left = 0;
      item.status = "timeout";
      item.result = { kind: "timeout", match: null };
      advance();
      return;
    }
    renderClock();
    if (mode().ladder) {
      const shown = shownFor(item);
      // Reveal the next city, or just refresh the "shows in" countdowns.
      renderLadderIfChanged(item, shown);
    }
    const chip = document.querySelector(`.chip[data-index="${turn.cur}"]`);
    if (chip && item.left <= 5000) chip.classList.add("low");
  }

  function renderLadderIfChanged(item, shown) {
    if (shown !== item.shownRendered) return renderLadder(item, shown - 1);
    document.querySelectorAll(".rung.hidden").forEach((rung) => {
      rung.querySelector(".rung-wait").textContent = `Shows in ${rungWait(item, Number(rung.dataset.step))}s`;
    });
  }

  function lockIn() {
    const item = turn.items[turn.cur];
    const text = document.getElementById("answer").value.trim();
    if (!text) return;
    item.answer = text;
    item.status = "answered";
    item.result = mode().judge(item.q, text, mode().ladder ? shownFor(item) : undefined);
    item.points = E.score(item.result.kind, {
      fast: mode().fastBonus && item.left >= turn.limit / 2,
      multiplier: E.multiplierForRound(state.roundIndex),
    });
    advance();
  }

  function skip() {
    if (pendingOthers()) {
      advance();
    } else {
      const item = turn.items[turn.cur];
      item.status = "passed";
      item.result = { kind: "passed", match: null };
      advance();
    }
  }

  // Move to the next unfinished question after the current one, wrapping round.
  function advance() {
    const n = turn.items.length;
    for (let step = 1; step <= n; step++) {
      const i = (turn.cur + step) % n;
      if (turn.items[i].status === "pending") {
        turn.cur = i;
        turn.last = performance.now();
        showCurrent();
        return;
      }
    }
    finishTurn();
  }

  function finishTurn() {
    stopClock();
    round().turns[turn.player] = turn.items;
    turn = null;
    if (state.turnStep === 0) {
      state.turnStep = 1;
      renderHandoff();
    } else {
      renderReveal();
    }
  }

  // ---------- reveal ----------

  function answerCell(it, player) {
    const kind = it.result.kind;
    const said = it.answer ? `<span class="said">${esc(it.answer)}</span>` : `<span class="said none">—</span>`;
    const m = it.result.match;
    const matched = m && E.normalize(m) !== E.normalize(it.answer) ? ` <span class="as">(${esc(m)})</span>` : "";
    const pts = it.points.total
      ? `<span class="pts">+${it.points.total}</span>${it.points.bonus ? `<span class="bonus">quick</span>` : ""}`
      : `<span class="pts zero">0</span>`;
    return `<div class="cell ${kind}">
      <span class="cell-who">${playerTag(player)}</span>
      <div class="said-line">${said}${matched}</div>
      <div class="verdict"><span class="tag ${kind}">${(mode().labels || {})[kind] || E.KIND_LABELS[kind]}</span>${pts}</div>
    </div>`;
  }

  function renderReveal() {
    const r = round();
    const last = state.roundIndex === E.ROUND_COUNT - 1;
    const rows = r.questions
      .map((q, i) => {
        const a = r.turns[0][i];
        const b = r.turns[1][i];
        return `<tr style="--i:${i}">
          <th scope="row">${mode().rowHead(q)}
            ${mode().map === false ? "" : `<button type="button" class="map-link" data-q="${i}">Show on map</button>`}
          </th>
          <td>${answerCell(a, 0)}</td>
          <td>${answerCell(b, 1)}</td>
        </tr>`;
      })
      .join("");

    show(`
      <section class="screen reveal">
        <header>
          <p class="eyebrow">Round ${state.roundIndex + 1} of ${E.ROUND_COUNT} · ${tierName(r.tier)} · Arrivals</p>
          <h1 class="section-title big">The answers</h1>
        </header>

        <div class="scoreline">
          ${[0, 1]
            .map(
              (p) => `<div class="score-card p${p}-theme">
              ${playerTag(p)}
              <span class="score-round">+${roundTotal(r, p)} this round</span>
              <span class="score-total">${total(p, state.roundIndex)}</span>
            </div>`
            )
            .join("")}
        </div>

        ${mode().map === false ? "" : `<section class="panel map" id="map" aria-label="Round map"></section>`}

        <div class="board-wrap">
          <table class="board answers">
            <thead><tr><th scope="col">${mode().columnLabel || (state.mode === "countries" ? "City" : "Country")}</th><th scope="col">${playerTag(0)}</th><th scope="col">${playerTag(1)}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <button class="btn primary big" id="next" autofocus>${last ? "Final results" : `On to round ${state.roundIndex + 2}`}</button>
      </section>`);

    const mapEl = document.getElementById("map");
    let map = null;
    if (mapEl) {
      try {
        map = RevealMap.mount(mapEl, { mode: state.mode, round: r, names: state.names });
      } catch (err) {
        mapEl.hidden = true; // the answers still work without the map
      }
    }
    app.querySelectorAll(".map-link").forEach((btn) => {
      if (!map) return (btn.hidden = true);
      btn.addEventListener("click", () => {
        map.focus(Number(btn.dataset.q));
        mapEl.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    });

    document.getElementById("next").addEventListener("click", () => {
      if (last) return renderFinal();
      state.roundIndex++;
      state.turnStep = 0;
      renderHandoff();
    });
  }

  // ---------- final ----------

  function renderFinal() {
    const totals = [total(0), total(1)];
    const winner = totals[0] === totals[1] ? -1 : totals[0] > totals[1] ? 0 : 1;
    const headline = winner < 0 ? "Dead heat" : `${playerTag(winner)} wins`;
    const margin = winner < 0 ? `Both on ${totals[0]} points.` : `${totals[winner]} to ${totals[1 - winner]}.`;

    const study = [];
    state.rounds.forEach((r) =>
      r.questions.forEach((q, i) => {
        const missed = [0, 1].filter((p) => !mode().scored(r.turns[p][i].result.kind));
        if (missed.length) study.push({ q, missed });
      })
    );

    show(`
      <section class="screen final">
        <p class="eyebrow">Final destination</p>
        <h1 class="gate">${headline}</h1>
        <p class="lede">${margin}</p>

        <div class="board-wrap">
          <table class="board totals">
            <thead><tr><th scope="col">Round</th><th scope="col" class="num">${playerTag(0)}</th><th scope="col" class="num">${playerTag(1)}</th></tr></thead>
            <tbody>
              ${state.rounds
                .map(
                  (r, i) => `<tr><th scope="row">${i + 1} · ${tierName(r.tier)}${E.multiplierForRound(i) > 1 ? " ×2" : ""}</th>
                  <td class="num">${roundTotal(r, 0)}</td><td class="num">${roundTotal(r, 1)}</td></tr>`
                )
                .join("")}
              <tr class="sum"><th scope="row">Total</th><td class="num">${totals[0]}</td><td class="num">${totals[1]}</td></tr>
            </tbody>
          </table>
        </div>

        ${
          study.length
            ? `<section class="panel">
          <h2 class="section-title">Study list</h2>
          <p class="fine">${mode().studyNote}</p>
          <ul class="study">
            ${study
              .map(
                ({ q, missed }) => `<li>
              <div class="study-head">${mode().rowHead(q)}</div>
              <span class="missed">${missed.map(playerTag).join(" ")}</span>
            </li>`
              )
              .join("")}
          </ul>
        </section>`
            : `<p class="lede">${mode().perfect}</p>`
        }

        <div class="actions">
          <button class="btn primary big" id="rematch" autofocus>Rematch</button>
          <button class="btn ghost" id="new">Change players</button>
        </div>
      </section>`);

    document.getElementById("rematch").addEventListener("click", startMatch);
    document.getElementById("new").addEventListener("click", renderSetup);
  }

  renderSetup();
  animateFlaps(app.querySelector(".board-title"));
})();
