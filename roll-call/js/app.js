// Roll Call screens: the board, the clock and the results sheet.

(function () {
  const quiz = window.ROLL_CALL_QUIZZES[0];
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $("score"), clock: $("clock"), entry: $("entry"), guess: $("guess"),
    action: $("action"), feedback: $("feedback"), intro: $("intro"), prompt: $("prompt"),
    best: $("best"), board: $("board"), scroller: $("scroller"), results: $("results"),
    resultsTitle: $("results-title"), resultsScore: $("results-score"),
    resultsDetail: $("results-detail"), resultsBest: $("results-best"),
    review: $("review"), again: $("again"),
  };

  let game = null;
  let state = "ready"; // ready | playing | over
  let endsAt = 0;
  let timer = 0;
  let feedbackTimer = 0;
  let firstOpenRow = 0; // the board scrolls here as rows ahead of it fill up

  // ---- best score (per viewer; fine if storage is unavailable) ----
  const bestKey = `rollcall:best:${quiz.id}`;
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(bestKey)) || null; } catch { return null; }
  }
  function saveBest(result) {
    const best = loadBest();
    const better = !best || result.score > best.score ||
      (result.score === best.score && result.seconds < best.seconds);
    if (better) {
      try { localStorage.setItem(bestKey, JSON.stringify(result)); } catch { /* ignore */ }
    }
    return better;
  }
  function bestText(best) {
    if (!best) return "";
    return `Your best: ${best.score}/${game.total} in ${RollCall.formatClock(best.seconds)}`;
  }

  // ---- board ----
  function renderBoard() {
    el.board.innerHTML = "";
    quiz.slots.forEach((slot, i) => {
      const li = document.createElement("li");
      li.className = "slot";
      li.dataset.answer = slot.answer;
      li.dataset.index = i;
      li.innerHTML = `<span class="num">${slot.label}</span><span class="name"></span><span class="sub">${slot.sub}</span>`;
      el.board.appendChild(li);
    });
  }

  function fill(id, cls) {
    for (const li of el.board.querySelectorAll(`[data-answer="${id}"]`)) {
      li.querySelector(".name").textContent = quiz.answers[id].short || quiz.answers[id].name;
      li.title = quiz.answers[id].name;
      li.classList.add(cls);
    }
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
    el.clock.textContent = RollCall.formatClock(quiz.seconds);
    el.clock.classList.remove("low");
    el.guess.value = "";
    el.guess.disabled = true;
    el.guess.placeholder = "Press Start to play";
    el.action.textContent = "Start";
    el.action.classList.add("primary");
    el.intro.hidden = false;
    el.prompt.textContent = quiz.prompt;
    el.best.textContent = bestText(loadBest());
    el.results.hidden = true;
    document.body.classList.remove("over", "playing");
    firstOpenRow = 0;
    el.scroller.scrollTop = 0;
    say("");
  }

  function start() {
    state = "playing";
    document.body.classList.add("playing");
    endsAt = Date.now() + quiz.seconds * 1000;
    el.intro.hidden = true;
    el.guess.disabled = false;
    el.guess.placeholder = "Type a name…";
    el.action.textContent = "Give up";
    el.action.classList.remove("primary");
    el.guess.focus();
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
    const used = Math.min(quiz.seconds, Math.round(quiz.seconds - secondsLeft()));
    game.missed().forEach((id) => fill(id, "missed"));
    el.guess.disabled = true;
    el.guess.blur();
    el.guess.placeholder = "";
    el.action.textContent = "Play again";
    el.action.classList.add("primary");
    document.body.classList.remove("playing");
    document.body.classList.add("over");
    say("");

    const score = game.found.size;
    const isNewBest = saveBest({ score, seconds: used });
    el.resultsTitle.textContent =
      reason === "done" ? "You got them all!" : reason === "time" ? "Time's up" : "Nice try";
    el.resultsScore.textContent = `${score}/${game.total}`;
    el.resultsDetail.textContent = reason === "done"
      ? `Every one of the ${quiz.noun} in ${RollCall.formatClock(used)}.`
      : `You named ${Math.round((score / game.total) * 100)}% of the ${quiz.noun}. Missed ones are in red.`;
    el.resultsBest.textContent = isNewBest && score > 0 ? "New personal best!" : bestText(loadBest());
    el.results.hidden = false;
    el.again.focus();
  }

  function check(fuzzy) {
    if (state !== "playing") return;
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
    for (const li of el.board.querySelectorAll(`[data-answer="${id}"]`)) {
      li.classList.remove("pop");
      void li.offsetWidth;
      li.classList.add("pop");
    }
  }

  // ---- events ----
  el.guess.addEventListener("input", () => check(false));
  el.entry.addEventListener("submit", (e) => { e.preventDefault(); check(true); });
  el.action.addEventListener("click", () => {
    if (state === "ready") start();
    else if (state === "playing") finish("gave-up");
    else reset();
  });
  el.again.addEventListener("click", () => { reset(); start(); });
  el.review.addEventListener("click", () => { el.results.hidden = true; });
  el.results.addEventListener("click", (e) => { if (e.target === el.results) el.results.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.results.hidden) el.results.hidden = true;
  });

  reset();
})();
