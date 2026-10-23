// Pivot Pitch game logic: dealing cards, the challenge-mode pivot and clock helpers. No DOM.

const PivotGame = (() => {
  const Cards = typeof require === "function" ? require("./cards.js") : PIVOT_CARDS;

  const TIMER_OPTIONS = [60, 90, 0]; // seconds; 0 = untimed
  const CHALLENGE_OPTIONS = ["off", "adjective", "noun"];
  const SOUND_OPTIONS = ["sound", "vibrate", "mute"];
  const TICK_FROM = 10; // tick through the last 10 seconds
  const PIVOT_CHOICES = 2;

  // A random item of `list`, never `except`. Cards can repeat between pitches.
  function pick(list, rng = Math.random, except) {
    const pool = except === undefined ? list : list.filter((x) => x !== except);
    return pool[Math.floor(rng() * pool.length)];
  }

  function dealCombo(rng = Math.random) {
    return { adjective: pick(Cards.adjectives, rng), noun: pick(Cards.nouns, rng) };
  }

  // Challenge mode: swap one side of the combo for a different word.
  function pivotCombo(combo, side, rng = Math.random) {
    const list = side === "adjective" ? Cards.adjectives : side === "noun" ? Cards.nouns : null;
    if (!list) throw new Error(`can't pivot "${side}"`);
    return { ...combo, [side]: pick(list, rng, combo[side]) };
  }

  // Two different pivot questions for the audience to choose between.
  function pivotQuestions(rng = Math.random, count = PIVOT_CHOICES) {
    const pool = Cards.pivots.slice();
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  // Challenge mode needs a clock, so untimed pitches never pivot.
  function challengeActive(settings) {
    return settings.timer > 0 && settings.challenge !== "off";
  }

  const swapAtMs = (timerSeconds) => (timerSeconds * 1000) / 2;
  const secondsLeft = (msLeft) => Math.max(0, Math.ceil(msLeft / 1000));
  const isTickSecond = (s) => s > 0 && s <= TICK_FROM;

  function formatClock(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  // Fills in defaults and drops anything stale from saved settings.
  function normalizeSettings(raw) {
    const s = raw || {};
    return {
      timer: TIMER_OPTIONS.includes(s.timer) ? s.timer : 60,
      challenge: CHALLENGE_OPTIONS.includes(s.challenge) ? s.challenge : "off",
      sound: SOUND_OPTIONS.includes(s.sound) ? s.sound : "sound",
    };
  }

  return {
    TIMER_OPTIONS,
    CHALLENGE_OPTIONS,
    SOUND_OPTIONS,
    TICK_FROM,
    pick,
    dealCombo,
    pivotCombo,
    pivotQuestions,
    challengeActive,
    swapAtMs,
    secondsLeft,
    isTickSecond,
    formatClock,
    normalizeSettings,
  };
})();

if (typeof module !== "undefined") module.exports = PivotGame;
