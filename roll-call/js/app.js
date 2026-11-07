// Roll Call screens: the board, the clock and the results sheet.

(function () {
  const quiz = window.ROLL_CALL_QUIZZES[0];
  const $ = (id) => document.getElementById(id);
  const el = {
    score: $("score"), clock: $("clock"), entry: $("entry"), guess: $("guess"),
    action: $("action"), feedback: $("feedback"), intro: $("intro"), prompt: $("prompt"),
    best: $("best"), board: $("board"), results: $("results"),
    resultsTitle: $("results-title"), resultsScore: $("results-score"),
    resultsDetail: $("results-detail"), resultsBest: $("results-best"),
    review: $("review"), again: $("again"),
  };

  let game = null;
  let state = "ready"; // ready | playing | over
  let endsAt = 0;
  let timer = 0;
  let feedbackTimer = 0;

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
      li.querySelector(".name").textContent = quiz.answers[id].name;
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
    document.body.classList.remove("over");
    say("");
  }

  function start() {
    state = "playing";
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
      const { name } = quiz.answers[result.id];
      fill(result.id, "found");
      flash(result.id);
      const nums = quiz.slots.filter((s) => s.answer === result.id).map((s) => s.label).join(" & ");
      say(`✓ ${name} (${nums})`, "good");
      el.guess.value = "";
      updateScore();
      if (game.isComplete()) finish("done");
    } else if (result.type === "ambiguous") {
      say(`More than one matches “${el.guess.value.trim()}”. Add a first name.`, "hint");
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
