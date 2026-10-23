// Sounds and vibration for Pivot Pitch, synthesised with Web Audio (no audio files).
// Mode is "sound", "vibrate" or "mute".

const PivotSound = (() => {
  let ctx = null;
  let mode = "sound";

  // Browsers only allow audio after a tap, so call this from a click handler.
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone({ freq, to, type = "sine", at = 0, dur, gain = 0.2 }) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    // Wood-block tick; the last three seconds go up in pitch.
    tick: (secondsLeft) =>
      tone({ freq: secondsLeft <= 3 ? 1500 : 1100, type: "triangle", dur: 0.06, gain: 0.25 }),
    // Game-show buzzer.
    buzzer: () => {
      tone({ freq: 150, type: "sawtooth", dur: 0.8, gain: 0.18 });
      tone({ freq: 156, type: "square", dur: 0.8, gain: 0.08 });
    },
    // A cute "bloop" up, then two sparkles.
    pivot: () => {
      tone({ freq: 420, to: 950, type: "triangle", dur: 0.16, gain: 0.25 });
      tone({ freq: 1320, type: "sine", at: 0.14, dur: 0.14, gain: 0.18 });
      tone({ freq: 1760, type: "sine", at: 0.24, dur: 0.22, gain: 0.16 });
    },
  };

  const VIBRATIONS = {
    tick: () => 25,
    buzzer: () => [300, 100, 300],
    pivot: () => [40, 40, 40, 40, 120],
  };

  function play(name, arg) {
    if (mode === "mute") return;
    if (mode === "vibrate") {
      try {
        if (navigator.vibrate) navigator.vibrate(VIBRATIONS[name](arg));
      } catch (e) {}
      return;
    }
    if (!ctx) return;
    try {
      SOUNDS[name](arg);
    } catch (e) {}
  }

  return {
    unlock,
    play,
    setMode: (m) => (mode = m),
    canVibrate: () => typeof navigator !== "undefined" && "vibrate" in navigator,
  };
})();
