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
    mode: "cities", // key into MODES; always a game of the current topic
    rounds: [], // { tier, questions, order: [first, second], turns: [items|null, items|null] }
    roundIndex: 0,
    turnStep: 0, // 0 = first player of the round, 1 = second
  };

  let turn = null; // live turn: { player, items, cur, last, timer }
  let sprint = null; // live picture sprint: { player, left, idx, log, wrong, timer, ... }

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
      topic: "geo",
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
      topic: "geo",
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
      topic: "geo",
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
      label: "Three clues",
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
    shapes: {
      topic: "geo",
      sprint: true,
      label: "Country shapes",
      lede: "A speed round in the style of The Floor: name as many countries from their outline as you can in 30 seconds.",
      noun: "countries",
      placeholder: "Type a country…",
      queue: (tier, used) =>
        E.buildSprintQueue(COUNTRIES, tier, used, Math.random, (c) => c.code).map((country) => ({ key: country.code, country })),
      picture: (q) => RevealMap.silhouette(q.country.code),
      name: (q) => E.countryNames(q.country)[0],
      judge: (q, text) => E.judgeCountry(COUNTRIES, [q.country.code], text).kind === "country",
      credit: "",
    },
    supplyPics: {
      topic: "supplies",
      sprint: true,
      label: "Picture sprint",
      lede: "A speed round in the style of The Floor: name as many school supplies from their picture as you can in 30 seconds.",
      noun: "items",
      placeholder: "Type an item…",
      queue: (tier, used) =>
        E.buildSprintQueue(SUPPLY_PICTURES, tier, used, Math.random, (p) => p.name).map((pic) => ({ key: pic.name, pic })),
      picture: (q) => `<img class="pic-img" src="img/supplies/${q.pic.img}.svg" alt="Picture to name" draggable="false" />`,
      name: (q) => q.pic.name,
      judge: (q, text) => E.judgeItem(SUPPLY_PICTURES, q.pic, text).kind === "right",
      credit: `Pictures: <a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a>, CC BY 4.0.`,
    },
  };
  const TOPICS = [
    { value: "geo", label: "World geography" },
    { value: "supplies", label: "School supplies" },
  ];
  const gamesFor = (topic) => Object.entries(MODES).filter(([, m]) => m.topic === topic);
  const mode = () => MODES[state.mode];
  // The game last played in each topic, so switching topics brings it back.
  const lastGame = { geo: "cities", supplies: "supplies" };

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
    if (sprint && !sprint.done) {
      clearInterval(sprint.timer);
      clearTimeout(sprint.countdown);
    }
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
      if (saved.lastGame) {
        Object.entries(saved.lastGame).forEach(([t, g]) => {
          if (MODES[g] && MODES[g].topic === t) lastGame[t] = g;
        });
      }
      if (TOPICS.some((t) => t.value === saved.topic)) state.topic = saved.topic;
      state.mode = lastGame[state.topic];
    }
  } catch (e) {}

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ names: state.names, seconds: state.seconds, difficulty: state.difficulty, topic: state.topic, lastGame }));
    } catch (e) {}
  }

  // ---------- setup ----------

  function rulesHTML(m) {
    if (m.sprint) {
      return `
          <h2 class="section-title">How it works</h2>
          <table class="fare"><tbody>
            <tr><td>Each picture you name</td><td class="num">1</td></tr>
            <tr><td>Pass a picture</td><td class="num">−${E.PASS_PENALTY_MS / 1000}s</td></tr>
          </tbody></table>
          <ul class="fine">
            <li>${E.SPRINT_MS / 1000} seconds each. Name the picture on screen to get the next one.</li>
            <li>Stuck? Pass with <kbd>Tab</kbd>. You lose that picture and ${E.PASS_PENALTY_MS / 1000} seconds.</li>
            <li>Both players get the same pictures in the same order. ${E.ROUND_COUNT} rounds; the last counts double.</li>
            <li>Spelling slips are forgiven, and other names count.</li>
            ${m.credit ? `<li>${m.credit}</li>` : ""}
          </ul>`;
    }
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

  function gameOptionsHTML(topic, selected) {
    const games = gamesFor(topic);
    return `<div class="segmented ${games.length === 2 ? "two" : "four"}" role="radiogroup">${games
      .map(
        ([value, m]) => `
      <label><input type="radio" name="mode" id="mode-${value}" value="${value}" ${selected === value ? "checked" : ""}/><span>${m.label}</span></label>`
      )
      .join("")}</div>`;
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

          <fieldset class="field">
            <legend class="label">Game</legend>
            <div id="game-options">${gameOptionsHTML(state.topic, state.mode)}</div>
          </fieldset>

          <fieldset class="field" id="seconds-field" ${mode().sprint ? "hidden" : ""}>
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
      const game = app.querySelector('input[name="mode"]:checked').value;
      const m = MODES[game];
      lastGame[m.topic] = game;
      document.getElementById("seconds-field").hidden = !!m.sprint;
      document.getElementById("mode-lede").textContent = m.lede;
      document.getElementById("rules").innerHTML = rulesHTML(m);
    };
    const bindGames = () => app.querySelectorAll('input[name="mode"]').forEach((radio) => radio.addEventListener("change", refresh));
    bindGames();
    app.querySelectorAll('input[name="topic"]').forEach((radio) =>
      radio.addEventListener("change", () => {
        document.getElementById("game-options").innerHTML = gameOptionsHTML(radio.value, lastGame[radio.value]);
        bindGames();
        refresh();
      })
    );

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
      const order = r % 2 === 0 ? [0, 1] : [1, 0];
      if (mode().sprint) {
        // Everyone gets the same pictures in the same order. Count the first dozen as
        // used, so later rounds start with pictures nobody has seen yet.
        const queue = mode().queue(tier, used);
        queue.slice(0, 12).forEach((q) => used.add(q.key));
        state.rounds.push({ tier, queue, questions: [], order, turns: [null, null] });
        continue;
      }
      const questions = mode().pick(tier, used);
      questions.forEach((q) => used.add(q.key || q.country.code));
      state.rounds.push({ tier, questions, order, turns: [null, null] });
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
          ${
            mode().sprint
              ? `<li><span class="label">Clock</span><span>${E.SPRINT_MS / 1000}s total</span></li>
          <li><span class="label">Pass</span><span><kbd>Tab</kbd> −${E.PASS_PENALTY_MS / 1000}s</span></li>
          <li><span class="label">Answer</span><span><kbd>Enter</kbd></span></li>`
              : `<li><span class="label">Questions</span><span>${E.COUNTRIES_PER_ROUND}</span></li>
          <li><span class="label">Clock</span><span>${state.seconds}s each</span></li>
          <li><span class="label">Skip</span><span><kbd>Tab</kbd></span></li>
          <li><span class="label">Lock in</span><span><kbd>Enter</kbd></span></li>`
          }
        </ul>
        <button class="btn primary big" id="go" autofocus>I'm ${esc(state.names[player])}. Start</button>
      </section>`);
    document.getElementById("go").addEventListener("click", () => startTurn(player));
  }

  // ---------- the turn ----------

  function startTurn(player) {
    if (mode().sprint) return startSprint(player);
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
    const { player, items } = turn;
    turn = null;
    recordTurn(player, items);
  }

  // Store a finished turn, then hand over or reveal the round.
  function recordTurn(player, items) {
    round().turns[player] = items;
    if (state.turnStep === 0) {
      state.turnStep = 1;
      renderHandoff();
    } else {
      renderReveal();
    }
  }

  // ---------- picture sprint ----------
  //
  // One clock for the whole turn. The picture on screen must be named before the next
  // appears; passing loses it and costs PASS_PENALTY_MS. The turn's log records every
  // picture reached: "right", "passed", or "timeout" for the one on screen at the end.

  function startSprint(player) {
    sprint = { player, left: E.SPRINT_MS, idx: 0, log: [], wrong: "", timer: null, last: 0, done: false };
    const r = round();
    const mult = E.multiplierForRound(state.roundIndex);
    show(`
      <section class="screen sprint p${player}-theme">
        <header class="turn-head">
          <span class="eyebrow">Round ${state.roundIndex + 1} · ${tierName(r.tier)}${mult > 1 ? ` · ×${mult}` : ""}</span>
          ${playerTag(player)}
        </header>
        <div class="sprint-top">
          <span class="sprint-clock" id="sp-clock">${(E.SPRINT_MS / 1000).toFixed(1)}</span>
          <span class="sprint-score">Named <b id="sp-score">0</b></span>
        </div>
        <div class="clock" aria-hidden="true"><div class="clock-fill fast" id="clock-fill"></div></div>
        <div class="pic-frame" id="pic"><span class="countdown">3</span></div>
        <p class="sprint-flash" id="sp-flash" aria-live="polite">&nbsp;</p>
        <form class="answer" id="sp-form" autocomplete="off">
          <label class="sr-only" for="sp-answer">Your answer</label>
          <input id="sp-answer" placeholder="${mode().placeholder}" spellcheck="false" autocapitalize="off" disabled />
          <div class="answer-actions">
            <button class="btn ghost" type="button" id="sp-pass" disabled>Pass −${E.PASS_PENALTY_MS / 1000}s</button>
            <button class="btn primary" type="submit" id="sp-enter" disabled>Enter</button>
          </div>
        </form>
      </section>`);

    const input = document.getElementById("sp-answer");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        sprintPass();
      }
    });
    input.addEventListener("animationend", () => input.classList.remove("nope"));
    document.getElementById("sp-form").addEventListener("submit", (e) => {
      e.preventDefault();
      sprintAnswer();
    });
    document.getElementById("sp-pass").addEventListener("click", sprintPass);

    // 3, 2, 1, then the clock starts.
    const frame = document.getElementById("pic");
    let count = 3;
    const step = () => {
      if (!sprint || sprint.player !== player) return;
      count -= 1;
      if (count > 0) {
        frame.innerHTML = `<span class="countdown">${count}</span>`;
        sprint.countdown = setTimeout(step, 600);
        return;
      }
      ["sp-answer", "sp-pass", "sp-enter"].forEach((id) => (document.getElementById(id).disabled = false));
      input.focus();
      showSprintPicture();
      sprint.last = performance.now();
      sprint.timer = setInterval(sprintTick, 100);
    };
    sprint.countdown = setTimeout(step, 600);
  }

  function showSprintPicture() {
    const q = round().queue[sprint.idx];
    if (!q) return endSprint();
    document.getElementById("pic").innerHTML = mode().picture(q);
    const input = document.getElementById("sp-answer");
    input.value = "";
    input.focus();
    sprint.wrong = "";
  }

  function sprintFlash(text, cls) {
    const el = document.getElementById("sp-flash");
    el.textContent = text;
    el.className = `sprint-flash ${cls}`;
  }

  function renderSprintClock() {
    const secs = Math.max(0, sprint.left) / 1000;
    document.getElementById("sp-clock").textContent = secs.toFixed(1);
    const fill = document.getElementById("clock-fill");
    fill.style.transform = `scaleX(${Math.max(0, sprint.left) / E.SPRINT_MS})`;
    fill.classList.toggle("fast", sprint.left > 10000);
    fill.classList.toggle("low", sprint.left <= 5000);
  }

  function sprintTick() {
    const now = performance.now();
    sprint.left -= now - sprint.last;
    sprint.last = now;
    renderSprintClock();
    if (sprint.left <= 0) endSprint();
  }

  function sprintAnswer() {
    if (!sprint || sprint.done) return;
    const input = document.getElementById("sp-answer");
    const text = input.value.trim();
    if (!text) return;
    const q = round().queue[sprint.idx];
    if (mode().judge(q, text)) {
      sprint.log.push({ qIndex: sprint.idx, status: "right", answer: text, points: { total: E.multiplierForRound(state.roundIndex) } });
      document.getElementById("sp-score").textContent = sprint.log.filter((l) => l.status === "right").length;
      sprintFlash(`✓ ${mode().name(q)}`, "ok");
      sprint.idx += 1;
      showSprintPicture();
    } else {
      sprint.wrong = text;
      sprintFlash("Not it. Try again or pass.", "bad");
      input.classList.remove("nope");
      void input.offsetWidth; // restart the shake
      input.classList.add("nope");
      input.select();
    }
  }

  function sprintPass() {
    if (!sprint || sprint.done || !sprint.timer) return;
    const q = round().queue[sprint.idx];
    sprint.log.push({ qIndex: sprint.idx, status: "passed", answer: sprint.wrong, points: { total: 0 } });
    sprint.left -= E.PASS_PENALTY_MS;
    sprintFlash(`Passed: ${mode().name(q)} · −${E.PASS_PENALTY_MS / 1000}s`, "bad");
    renderSprintClock();
    if (sprint.left <= 0) return endSprint();
    sprint.idx += 1;
    showSprintPicture();
  }

  function endSprint() {
    if (!sprint || sprint.done) return;
    sprint.done = true;
    clearInterval(sprint.timer);
    clearTimeout(sprint.countdown);
    const { player, log, idx } = sprint;
    const onScreen = document.getElementById("sp-answer");
    // The picture still showing at the buzzer, if it wasn't just passed.
    if (round().queue[idx] && !log.some((l) => l.qIndex === idx)) {
      log.push({ qIndex: idx, status: "timeout", answer: sprint.wrong || (onScreen && onScreen.value.trim()) || "", points: { total: 0 } });
    }
    sprint.left = 0;
    renderSprintClock();
    sprintFlash("Time!", "bad");
    ["sp-answer", "sp-pass", "sp-enter"].forEach((id) => (document.getElementById(id).disabled = true));
    setTimeout(() => {
      sprint = null;
      recordTurn(player, log);
    }, 900);
  }

  const sprintThumb = (q) => `<span class="thumb">${mode().picture(q)}</span>`;

  function sprintCell(entry, player) {
    const labels = { right: "Named it", passed: "Passed", timeout: "Time ran out" };
    if (!entry) {
      return `<div class="cell none"><span class="cell-who">${playerTag(player)}</span><span class="said none">Didn't reach it</span></div>`;
    }
    const said = entry.answer ? `<span class="said">${esc(entry.answer)}</span>` : `<span class="said none">—</span>`;
    const pts = entry.points.total ? `<span class="pts">+${entry.points.total}</span>` : `<span class="pts zero">0</span>`;
    const kind = entry.status === "right" ? "country" : "miss";
    return `<div class="cell ${kind}">
      <span class="cell-who">${playerTag(player)}</span>
      <div class="said-line">${said}</div>
      <div class="verdict"><span class="tag ${kind}">${labels[entry.status]}</span>${pts}</div>
    </div>`;
  }

  function renderSprintReveal() {
    const r = round();
    const last = state.roundIndex === E.ROUND_COUNT - 1;
    const reached = Math.max(...[0, 1].map((p) => Math.max(-1, ...r.turns[p].map((l) => l.qIndex))));
    const named = (p) => r.turns[p].filter((l) => l.status === "right").length;
    const rows = r.queue
      .slice(0, reached + 1)
      .map((q, i) => {
        const cells = [0, 1].map((p) => sprintCell(r.turns[p].find((l) => l.qIndex === i), p));
        return `<tr style="--i:${Math.min(i, 4)}">
          <th scope="row"><div class="sprint-row">${sprintThumb(q)}<span class="cname">${esc(mode().name(q))}</span></div></th>
          <td>${cells[0]}</td>
          <td>${cells[1]}</td>
        </tr>`;
      })
      .join("");

    show(`
      <section class="screen reveal">
        <header>
          <p class="eyebrow">Round ${state.roundIndex + 1} of ${E.ROUND_COUNT} · ${tierName(r.tier)} · Arrivals</p>
          <h1 class="section-title big">The pictures</h1>
        </header>
        <div class="scoreline">
          ${[0, 1]
            .map(
              (p) => `<div class="score-card p${p}-theme">
              ${playerTag(p)}
              <span class="score-round">Named ${named(p)} · +${roundTotal(r, p)} this round</span>
              <span class="score-total">${total(p, state.roundIndex)}</span>
            </div>`
            )
            .join("")}
        </div>
        <div class="board-wrap">
          <table class="board answers">
            <thead><tr><th scope="col">Picture</th><th scope="col">${playerTag(0)}</th><th scope="col">${playerTag(1)}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button class="btn primary big" id="next" autofocus>${last ? "Final results" : `On to round ${state.roundIndex + 2}`}</button>
      </section>`);

    document.getElementById("next").addEventListener("click", () => {
      if (last) return renderFinal();
      state.roundIndex++;
      state.turnStep = 0;
      renderHandoff();
    });
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
    if (mode().sprint) return renderSprintReveal();
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
    if (mode().sprint) {
      // Pictures someone passed or was stuck on at the buzzer.
      const seen = new Map();
      state.rounds.forEach((r) =>
        [0, 1].forEach((p) =>
          r.turns[p]
            .filter((l) => l.status !== "right")
            .forEach((l) => {
              const q = r.queue[l.qIndex];
              const entry = seen.get(q.key) || { q, missed: [] };
              if (!entry.missed.includes(p)) entry.missed.push(p);
              seen.set(q.key, entry);
            })
        )
      );
      study.push(...seen.values());
    } else {
      state.rounds.forEach((r) =>
        r.questions.forEach((q, i) => {
          const missed = [0, 1].filter((p) => !mode().scored(r.turns[p][i].result.kind));
          if (missed.length) study.push({ q, missed });
        })
      );
    }
    const studyHead = (q) =>
      mode().sprint ? `<div class="sprint-row">${sprintThumb(q)}<span class="cname">${esc(mode().name(q))}</span></div>` : mode().rowHead(q);

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
          <p class="fine">${mode().sprint ? `Pictures someone passed or was stuck on when time ran out.` : mode().studyNote}</p>
          <ul class="study">
            ${study
              .map(
                ({ q, missed }) => `<li>
              <div class="study-head">${studyHead(q)}</div>
              <span class="missed">${missed.map(playerTag).join(" ")}</span>
            </li>`
              )
              .join("")}
          </ul>
        </section>`
            : `<p class="lede">${mode().sprint ? "Nobody passed a picture all game." : mode().perfect}</p>`
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
