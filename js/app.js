// Capital Clash UI: pass-and-play screens, the per-country clock and the reveal board.

(function () {
  const E = Engine;
  const app = document.getElementById("app");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    names: ["Player 1", "Player 2"],
    seconds: 20,
    rounds: [], // { tier, countries, order: [first, second], turns: [items|null, items|null] }
    roundIndex: 0,
    turnStep: 0, // 0 = first player of the round, 1 = second
  };

  let turn = null; // live turn: { player, items, cur, last, timer }

  // ---------- helpers ----------

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  const playerTag = (i) => `<span class="who p${i}">${esc(state.names[i])}</span>`;
  const tierName = (tier) => ["", "Easy", "Medium", "Hard"][tier];
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

  // ---------- setup ----------

  function renderSetup() {
    const p = E.POINTS;
    show(`
      <section class="screen setup">
        <header class="marquee">
          <p class="eyebrow">Departures · 2 players · 1 device</p>
          <h1 class="board-title">${flapHTML("Capital Clash")}</h1>
          <p class="lede">You get a country. Name a city. Capitals and the biggest city score the most. Take turns on the same device; neither of you sees the other's answers until the round is over.</p>
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
            <legend class="label">Seconds per country</legend>
            <div class="segmented" role="radiogroup">
              ${[15, 20]
                .map(
                  (s) => `
                <label><input type="radio" name="seconds" id="sec-${s}" value="${s}" ${state.seconds === s ? "checked" : ""}/><span>${s}s</span></label>`
                )
                .join("")}
            </div>
          </fieldset>

          <button class="btn primary big" type="submit">Board the flight</button>
        </form>

        <section class="panel rules">
          <h2 class="section-title">Scoring</h2>
          <table class="fare">
            <tbody>
              <tr><td>Capital city</td><td class="num">${p.capital}</td></tr>
              <tr><td>Most populous city</td><td class="num">${p.largest}</td></tr>
              <tr><td>Both at once (e.g. Paris for France)</td><td class="num">${p.both}</td></tr>
              <tr><td>Any other major city</td><td class="num">${p.major}</td></tr>
              <tr><td>Quick answer (half the clock left, capital or largest)</td><td class="num">+${E.FAST_BONUS}</td></tr>
            </tbody>
          </table>
          <ul class="fine">
            <li>${E.ROUND_COUNT} rounds of ${E.COUNTRIES_PER_ROUND} countries: Easy, Medium, then Hard at double points.</li>
            <li>Each country has its own clock. Skip one and its clock pauses until you come back.</li>
            <li>One answer per country. Spelling slips and missing accents are forgiven.</li>
            <li>Watch for traps: Australia's capital is not Sydney.</li>
          </ul>
        </section>
      </section>`);

    document.getElementById("setup-form").addEventListener("submit", (e) => {
      e.preventDefault();
      state.names = [0, 1].map((i) => document.getElementById(`name-${i}`).value.trim() || `Player ${i + 1}`);
      state.seconds = Number(app.querySelector('input[name="seconds"]:checked').value);
      startMatch();
    });
  }

  function startMatch() {
    const used = new Set();
    state.rounds = [];
    for (let r = 0; r < E.ROUND_COUNT; r++) {
      const countries = E.pickRound(COUNTRIES, r + 1, used);
      countries.forEach((c) => used.add(c.code));
      state.rounds.push({ tier: r + 1, countries, order: r % 2 === 0 ? [0, 1] : [1, 0], turns: [null, null] });
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
          <li><span class="label">Countries</span><span>${E.COUNTRIES_PER_ROUND}</span></li>
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
      items: round().countries.map((country) => ({
        country,
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
          <p class="eyebrow">Name a city in</p>
          <h1 class="board-title country" id="country" aria-live="polite"></h1>
          <div class="clock" aria-hidden="true"><div class="clock-fill" id="clock-fill"></div></div>
          <p class="clock-num" id="clock-num"></p>
        </div>

        <form class="answer" id="answer-form" autocomplete="off">
          <label class="sr-only" for="answer">Your city</label>
          <input id="answer" placeholder="Type a city…" spellcheck="false" autocapitalize="words" />
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

  function showCurrent() {
    const item = turn.items[turn.cur];
    const countryEl = document.getElementById("country");
    countryEl.innerHTML = flapHTML(item.country.name);
    countryEl.classList.toggle("long", item.country.name.length > 16);
    animateFlaps(countryEl);
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
            aria-label="Country ${i + 1}: ${status}">
            <span class="chip-code">${esc(it.country.code)}</span>
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
    fill.classList.toggle("fast", item.left >= turn.limit / 2);
    document.getElementById("clock-num").textContent = `${Math.ceil(item.left / 1000)}s${
      item.left >= turn.limit / 2 ? " · quick bonus live" : ""
    }`;
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
      item.result = { kind: "timeout", city: null };
      advance();
      return;
    }
    renderClock();
    const chip = document.querySelector(`.chip[data-index="${turn.cur}"]`);
    if (chip && item.left <= 5000) chip.classList.add("low");
  }

  function lockIn() {
    const item = turn.items[turn.cur];
    const text = document.getElementById("answer").value.trim();
    if (!text) return;
    item.answer = text;
    item.status = "answered";
    item.result = E.judge(item.country, text);
    item.points = E.score(item.result.kind, {
      fast: item.left >= turn.limit / 2,
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
      item.result = { kind: "passed", city: null };
      advance();
    }
  }

  // Move to the next unfinished country after the current one, wrapping round.
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
    const matched = it.result.city && E.normalize(it.result.city) !== E.normalize(it.answer) ? ` <span class="as">(${esc(it.result.city)})</span>` : "";
    const pts = it.points.total
      ? `<span class="pts">+${it.points.total}</span>${it.points.bonus ? `<span class="bonus">quick</span>` : ""}`
      : `<span class="pts zero">0</span>`;
    return `<div class="cell ${kind}">
      <span class="cell-who">${playerTag(player)}</span>
      <div class="said-line">${said}${matched}</div>
      <div class="verdict"><span class="tag ${kind}">${E.KIND_LABELS[kind]}</span>${pts}</div>
    </div>`;
  }

  function renderReveal() {
    const r = round();
    const last = state.roundIndex === E.ROUND_COUNT - 1;
    const rows = r.countries
      .map((c, i) => {
        const a = r.turns[0][i];
        const b = r.turns[1][i];
        const trap = E.isTrap(c) ? `<span class="trap">Trap</span>` : "";
        return `<tr style="--i:${i}">
          <th scope="row">
            <span class="code">${esc(c.code)}</span>
            <span class="cname">${esc(c.name)}</span>${trap}
            <span class="key">Capital <b>${esc(names(c.capital))}</b> · Largest <b>${esc(names(c.largest))}</b></span>
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

        <div class="board-wrap">
          <table class="board answers">
            <thead><tr><th scope="col">Country</th><th scope="col">${playerTag(0)}</th><th scope="col">${playerTag(1)}</th></tr></thead>
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

  // ---------- final ----------

  function renderFinal() {
    const totals = [total(0), total(1)];
    const winner = totals[0] === totals[1] ? -1 : totals[0] > totals[1] ? 0 : 1;
    const headline = winner < 0 ? "Dead heat" : `${playerTag(winner)} wins`;
    const margin = winner < 0 ? `Both on ${totals[0]} points.` : `${totals[winner]} to ${totals[1 - winner]}.`;

    const study = [];
    state.rounds.forEach((r) =>
      r.countries.forEach((c, i) => {
        const missed = [0, 1].filter((p) => !["capital", "largest", "both"].includes(r.turns[p][i].result.kind));
        if (missed.length) study.push({ c, missed });
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
          <p class="fine">Countries where someone missed both the capital and the largest city.</p>
          <ul class="study">
            ${study
              .map(
                ({ c, missed }) => `<li>
              <span class="code">${esc(c.code)}</span>
              <span class="cname">${esc(c.name)}</span>
              <span class="key">Capital <b>${esc(names(c.capital))}</b> · Largest <b>${esc(names(c.largest))}</b></span>
              <span class="missed">${missed.map(playerTag).join(" ")}</span>
            </li>`
              )
              .join("")}
          </ul>
        </section>`
            : `<p class="lede">Nobody missed a capital or largest city all game.</p>`
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
