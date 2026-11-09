// Roll Call screens: the game list, the board, the clock and the results sheet.
//
// Two kinds of quiz share this screen:
//   type  one player types the names (US Presidents)
//   say   a quizmaster holds the phone and taps off what the player says out loud
//         (Bill of Rights)

(function () {
  const QUIZZES = window.ROLL_CALL_QUIZZES;
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $("score"), clock: $("clock"), entry: $("entry"), guess: $("guess"),
    sayNote: $("say-note"), action: $("action"), feedback: $("feedback"),
    home: $("home"), gameList: $("game-list"), homeLink: $("home-link"),
    intro: $("intro"), prompt: $("prompt"), instructions: $("instructions"),
    best: $("best"), board: $("board"), scroller: $("scroller"), results: $("results"),
    resultsTitle: $("results-title"), resultsScore: $("results-score"),
    resultsDetail: $("results-detail"), resultsBest: $("results-best"),
    review: $("review"), again: $("again"), hints: $("hints"), answers: $("answers"),
    minutes: $("minutes"), less: $("less"), more: $("more"), variants: $("variants"),
  };

  let base = null; // the quiz as defined
  let quiz = null; // what's being played: `base`, cut down to the chosen variant
  let game = null;
  let state = "ready"; // ready | playing | over
  let endsAt = 0;
  let timer = 0;
  let feedbackTimer = 0;
  let firstOpenRow = 0; // the board scrolls here as rows ahead of it fill up
  const isSay = () => quiz.mode === "say";

  // ---- storage (per viewer; fine if it's unavailable) ----
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  // ---- time limit (chosen on the start card, remembered per quiz) ----
  const MIN_MINUTES = 1;
  const MAX_MINUTES = 60;
  let minutes = 10;
  const minutesKey = () => `rollcall:minutes:${quiz.id}`;
  const limit = () => minutes * 60;

  // ---- best score: most named; ties go to fewer hints, then less time. One per time limit.
  const bestKey = () => `rollcall:best:${quiz.id}:v2:${minutes}m`;
  const loadBest = () => load(bestKey());
  function saveBest(result) {
    const best = loadBest();
    const better = !best || result.score > best.score ||
      (result.score === best.score && result.hints < best.hints) ||
      (result.score === best.score && result.hints === best.hints && result.seconds < best.seconds);
    if (better) store(bestKey(), result);
    return better;
  }
  function bestText(best) {
    if (!best) return "";
    const hints = best.hints ? ` (${best.hints} with hints)` : "";
    return `Your best with ${minutes} min: ${best.score}/${game.total}${hints} in ${RollCall.formatClock(best.seconds)}`;
  }

  // ---- screens ----
  function renderHome() {
    el.gameList.innerHTML = "";
    for (const q of QUIZZES) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${q.id}`;
      a.className = "game-card";
      a.innerHTML = `<span class="tag ${q.mode}">${q.mode === "say" ? "Say it · 2 players" : "Type it"}</span>
        <strong></strong><span class="blurb"></span>`;
      a.querySelector("strong").textContent = q.title;
      a.querySelector(".blurb").textContent = q.blurb;
      li.appendChild(a);
      el.gameList.appendChild(li);
    }
  }

  function route() {
    if (state === "playing") return;
    const id = location.hash.slice(1);
    const next = QUIZZES.find((q) => q.id === id);
    if (!next) {
      quiz = null;
      document.body.dataset.screen = "home";
      delete document.body.dataset.mode;
      el.results.hidden = true;
      document.title = "Roll Call";
      return;
    }
    base = next;
    document.body.dataset.screen = "quiz";
    document.body.dataset.mode = base.mode;
    document.title = `${base.title} · Roll Call`;
    el.instructions.innerHTML = base.instructions.map((p) => `<p>${p}</p>`).join("");
    const variants = base.variants || [];
    const savedVariant = load(`rollcall:variant:${base.id}`);
    choose(variants.find((v) => v.id === savedVariant) || variants[0] || null);
  }

  // Some quizzes offer a choice on the start card, such as Bill of Rights or all 27.
  // Each choice is played as its own quiz, with its own time limit and best scores.
  function choose(variant) {
    quiz = base;
    if (variant) {
      const slots = base.slots.slice(0, variant.count || base.slots.length);
      const answers = {};
      for (const s of slots) answers[s.answer] = base.answers[s.answer];
      quiz = { ...base, id: `${base.id}:${variant.id}`, prompt: variant.prompt,
        seconds: variant.seconds || base.seconds, slots, answers };
      store(`rollcall:variant:${base.id}`, variant.id);
    }
    renderVariants(variant);
    minutes = Math.round(quiz.seconds / 60);
    const saved = parseInt(load(minutesKey()), 10);
    if (saved >= MIN_MINUTES && saved <= MAX_MINUTES) minutes = saved;
    el.prompt.textContent = quiz.prompt;
    reset();
    setMinutes(minutes);
  }

  function renderVariants(current) {
    el.variants.innerHTML = "";
    el.variants.hidden = !base.variants;
    for (const v of base.variants || []) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(v === current));
      b.innerHTML = "<strong></strong><span></span>";
      b.querySelector("strong").textContent = v.label;
      b.querySelector("span").textContent = v.sub || "";
      b.addEventListener("click", () => { if (state !== "playing") choose(v); });
      el.variants.appendChild(b);
    }
  }

  // ---- board ----
  function renderBoard() {
    el.board.innerHTML = "";
    quiz.slots.forEach((slot, i) => {
      const answer = quiz.answers[slot.answer];
      const li = document.createElement("li");
      li.className = "slot";
      li.dataset.answer = slot.answer;
      li.dataset.index = i;
      if (isSay()) {
        li.innerHTML = `<span class="num"></span><span class="year"></span>
          <span class="name"></span><span class="detail"></span>
          <span class="concealed">Answer hidden</span><span class="hint-text"></span>
          <span class="card-actions">
            <button type="button" class="hint-btn" aria-label="Show a hint">💡</button>
            <button type="button" class="reveal-btn" aria-label="Show this answer" aria-pressed="false">👁</button>
          </span>`;
        li.querySelector(".num").textContent = slot.label;
        li.querySelector(".year").textContent = slot.sub;
        li.querySelector(".name").textContent = answer.name;
        li.querySelector(".detail").textContent = answer.detail || "";
        li.querySelector(".hint-text").textContent = `Hint: ${answer.hint}`;
      } else {
        li.innerHTML = `<span class="num">${slot.label}</span><span class="name"></span><span class="sub">${slot.sub}</span>`;
        li.querySelector(".name").dataset.hint = RollCall.initials(answer.name);
      }
      el.board.appendChild(li);
    });
  }

  const slotsFor = (id) => el.board.querySelectorAll(`[data-answer="${id}"]`);

  function fill(id, cls) {
    for (const li of slotsFor(id)) {
      if (!isSay()) {
        li.querySelector(".name").textContent = quiz.answers[id].short || quiz.answers[id].name;
        li.title = quiz.answers[id].name;
      }
      li.classList.add(cls);
    }
  }

  // ---- hints ----
  function showHint(id) {
    game.hint(id);
    for (const li of slotsFor(id)) li.classList.add("show-hint");
  }

  function setHintsOn(on) {
    el.hints.setAttribute("aria-pressed", String(on));
    document.body.classList.toggle("hints-on", on);
    // Every box still to be named shows its hint now, so they all count as hinted.
    if (on) game.missed().forEach((id) => game.hint(id));
  }

  // Say quizzes: the quizmaster can show or hide the answers. They start hidden.
  function setAnswersShown(on) {
    el.answers.setAttribute("aria-pressed", String(on));
    document.body.classList.toggle("answers-on", on);
  }

  function updateScore() {
    el.score.textContent = `${game.found.size}/${game.total}`;
  }

  function say(text, tone) {
    el.feedback.textContent = text;
    el.feedback.className = `feedback ${tone || ""}`;
    clearTimeout(feedbackTimer);
    if (text) feedbackTimer = setTimeout(() => say(""), 2500);
  }

  // ---- game flow ----
  function reset() {
    game = RollCall.createGame(quiz);
    state = "ready";
    renderBoard();
    updateScore();
    el.clock.textContent = RollCall.formatClock(limit());
    el.minutes.value = minutes;
    el.clock.classList.remove("low");
    el.guess.value = "";
    el.guess.disabled = true;
    el.guess.placeholder = "Press Start to play";
    el.sayNote.textContent = "Press Start when you're both ready";
    el.action.textContent = "Start";
    el.action.classList.add("primary");
    el.intro.hidden = false;
    el.best.textContent = bestText(loadBest());
    el.results.hidden = true;
    document.body.classList.remove("over", "playing");
    firstOpenRow = 0;
    el.scroller.scrollTop = 0;
    el.hints.disabled = true;
    setHintsOn(false);
    el.answers.disabled = true;
    setAnswersShown(false);
    say("");
  }

  function start() {
    state = "playing";
    document.body.classList.add("playing");
    endsAt = Date.now() + limit() * 1000;
    el.intro.hidden = true;
    el.action.textContent = isSay() ? "End" : "Give up";
    el.action.classList.remove("primary");
    if (isSay()) {
      el.sayNote.textContent = "Tap each one they name";
      el.answers.disabled = false;
    } else {
      el.guess.disabled = false;
      el.guess.placeholder = "Type a name…";
      el.hints.disabled = false;
      el.guess.focus();
    }
    tick();
    timer = setInterval(tick, 250);
  }

  function secondsLeft() {
    return Math.max(0, (endsAt - Date.now()) / 1000);
  }

  function tick() {
    const left = secondsLeft();
    el.clock.textContent = RollCall.formatClock(left);
    el.clock.classList.toggle("low", left <= 60);
    if (left <= 0) finish("time");
  }

  function finish(reason) {
    if (state !== "playing") return;
    state = "over";
    clearInterval(timer);
    const used = Math.min(limit(), Math.round(limit() - secondsLeft()));
    game.missed().forEach((id) => fill(id, "missed"));
    for (const id of game.found) {
      if (game.isHinted(id)) for (const li of slotsFor(id)) li.classList.add("assisted");
    }
    el.hints.disabled = true;
    setHintsOn(false);
    el.answers.disabled = true;
    setAnswersShown(false);
    el.guess.disabled = true;
    el.guess.blur();
    el.guess.placeholder = "";
    el.sayNote.textContent = "";
    el.action.textContent = "Play again";
    el.action.classList.add("primary");
    document.body.classList.remove("playing");
    document.body.classList.add("over");
    say("");

    const score = game.found.size;
    const helped = score - game.unaided();
    const isNewBest = saveBest({ score, hints: helped, seconds: used });
    el.resultsTitle.textContent =
      reason === "done" ? "You got them all!" : reason === "time" ? "Time's up" : "Nice try";
    el.resultsScore.textContent = `${score}/${game.total}`;
    const done = reason === "done"
      ? `Every one of the ${quiz.noun} in ${RollCall.formatClock(used)}.`
      : `You named ${Math.round((score / game.total) * 100)}% of the ${quiz.noun}.`;
    const hintNote = score === 0 ? "" : helped === 0
      ? " No hints needed!"
      : ` ${score - helped} on your own, ${helped} with a hint.`;
    el.resultsDetail.textContent = done + hintNote;
    el.resultsBest.textContent = isNewBest && score > 0 ? "New personal best!" : bestText(loadBest());
    el.results.hidden = false;
    el.again.focus();
  }

  function check(fuzzy) {
    if (state !== "playing" || isSay()) return;
    const result = game.guess(el.guess.value, { fuzzy });
    if (!result) return;
    if (result.type === "found") {
      result.ids.forEach((id) => { fill(id, "found"); flash(id); });
      const nums = quiz.slots.filter((s) => result.ids.includes(s.answer)).map((s) => s.label).join(", ");
      const names = result.ids.map((id) => quiz.answers[id].name).join(" & ");
      say(`✓ ${names} (${nums})`, "good");
      el.guess.value = "";
      updateScore();
      if (game.isComplete()) finish("done");
      else followProgress();
    } else if (result.type === "repeat") {
      say("Already named", "hint");
      if (fuzzy) el.guess.value = "";
    } else if (result.type === "miss") {
      say("Not on the list", "bad");
      el.guess.classList.remove("shake");
      void el.guess.offsetWidth;
      el.guess.classList.add("shake");
    }
  }

  // Say quizzes: is this answer on screen for the quizmaster?
  function answerShowing(li) {
    return document.body.classList.contains("answers-on") || li.classList.contains("revealed");
  }

  // Show or hide one answer without scoring it.
  function setRevealed(li, on) {
    li.classList.toggle("revealed", on);
    li.querySelector(".reveal-btn").setAttribute("aria-pressed", String(on));
  }

  // Say quizzes: the quizmaster taps an answer to tick it off, or again to undo.
  function tickOff(id) {
    const nowFound = game.toggle(id);
    for (const li of slotsFor(id)) li.classList.toggle("found", nowFound);
    const label = quiz.slots.find((s) => s.answer === id).label;
    if (nowFound) {
      flash(id);
      say(`✓ ${label}`, "good");
    } else {
      say(`Unticked ${label}`, "hint");
    }
    updateScore();
    if (game.isComplete()) finish("done");
  }

  // Once every box above a row is filled, bring that row to the top of the board.
  function followProgress() {
    const first = quiz.slots.findIndex((slot) => !game.isFound(slot.answer));
    if (first < 0) return;
    const columns = getComputedStyle(el.board).gridTemplateColumns.split(" ").length;
    const row = Math.floor(first / columns);
    if (row <= firstOpenRow) return;
    firstOpenRow = row;
    const target = el.board.children[first];
    const top = target.offsetTop - el.board.offsetTop;
    el.scroller.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // Keep the app the height of what's visible, so the board ends above the
  // on-screen keyboard and the top bar never scrolls away.
  function fitViewport() {
    const vv = window.visualViewport;
    document.documentElement.style.setProperty("--app-height", `${vv ? vv.height : window.innerHeight}px`);
    if (window.scrollY) window.scrollTo(0, 0);
  }
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", fitViewport);
    visualViewport.addEventListener("scroll", fitViewport);
  }
  window.addEventListener("resize", fitViewport);
  fitViewport();

  function flash(id) {
    for (const li of slotsFor(id)) {
      li.classList.remove("pop");
      void li.offsetWidth;
      li.classList.add("pop");
    }
  }

  function setMinutes(value) {
    const n = Math.round(Number(value));
    if (Number.isFinite(n) && n > 0) minutes = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, n));
    el.minutes.value = minutes;
    el.less.disabled = minutes <= MIN_MINUTES;
    el.more.disabled = minutes >= MAX_MINUTES;
    store(minutesKey(), minutes);
    if (state === "ready") {
      el.clock.textContent = RollCall.formatClock(limit());
      el.best.textContent = bestText(loadBest());
    }
  }
  el.less.addEventListener("click", () => setMinutes(minutes - 1));
  el.more.addEventListener("click", () => setMinutes(minutes + 1));
  el.minutes.addEventListener("input", () => { if (el.minutes.value !== "") setMinutes(el.minutes.value); });
  el.minutes.addEventListener("change", () => setMinutes(el.minutes.value));
  el.minutes.addEventListener("keydown", (e) => { if (e.key === "Enter") el.minutes.blur(); });

  // Type quizzes: tapping the Hints button or a box shouldn't close the phone's keyboard.
  const keepFocus = (e) => { if (state === "playing" && !isSay()) e.preventDefault(); };
  el.hints.addEventListener("mousedown", keepFocus);
  el.board.addEventListener("mousedown", keepFocus);
  el.hints.addEventListener("click", () => {
    if (state !== "playing") return;
    setHintsOn(el.hints.getAttribute("aria-pressed") !== "true");
    el.guess.focus();
  });
  el.answers.addEventListener("click", () => {
    if (state === "playing") setAnswersShown(el.answers.getAttribute("aria-pressed") !== "true");
  });
  el.board.addEventListener("click", (e) => {
    const li = e.target.closest(".slot");
    if (!li || state !== "playing") return;
    const id = li.dataset.answer;
    if (isSay()) {
      if (e.target.closest(".hint-btn")) showHint(id);
      else if (e.target.closest(".reveal-btn")) setRevealed(li, !li.classList.contains("revealed"));
      else if (game.isFound(id) || answerShowing(li)) tickOff(id);
      else {
        // First tap on a hidden answer shows it; the second gives the point.
        setRevealed(li, true);
        say(`Tap ${quiz.slots[li.dataset.index].label} again to give the point`, "hint");
      }
      return;
    }
    if (game.isFound(id)) return;
    showHint(id);
    el.guess.focus();
  });

  // ---- events ----
  el.guess.addEventListener("input", () => check(false));
  el.entry.addEventListener("submit", (e) => { e.preventDefault(); check(true); });
  el.action.addEventListener("click", () => {
    if (state === "ready") start();
    else if (state === "playing") finish("gave-up");
    else reset();
  });
  el.homeLink.addEventListener("click", (e) => {
    if (state === "playing") e.preventDefault();
  });
  el.again.addEventListener("click", () => { reset(); start(); });
  el.review.addEventListener("click", () => { el.results.hidden = true; });
  el.results.addEventListener("click", (e) => { if (e.target === el.results) el.results.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.results.hidden) el.results.hidden = true;
  });
  window.addEventListener("hashchange", route);

  renderHome();
  route();
})();
