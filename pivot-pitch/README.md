# Pivot Pitch

A digital take on Pivot Pitch, the improv pitching card game by Nathan Minns. Open
`index.html` in a browser to play. There's nothing to install or build.

## How to play

1. Pick your settings and press **Let's pitch!**
2. The next player steps up and presses **Start pitch**. The clock starts and two cards
   flip over: an **adjective** and a **noun**. Together they're the product
   ("Sparkly Toaster").
3. Pitch it before time runs out: who it's for, what problem it solves, and why it's
   worth it.
4. When time's up, two blue **Pivot** questions appear. Everyone else picks one to ask,
   and the pitcher answers on the spot.
5. Press **Next player** and go again. Cards can come up again from one pitch to the next.

## Settings

- **Pitch timer:** 60 seconds, 90 seconds, or untimed. With a timer, the last 10
  seconds tick and a buzzer sounds at zero. Untimed pitches count up and end with
  **Done pitching**.
- **Challenge mode:** pick the adjective or the noun before you start. Halfway through
  each pitch, that card flips to a new word with a "PIVOT!" and the pitcher has to
  change course. Challenge mode needs a timer.
- **Sound:** sound, vibrate or mute. It's also the button at the top right, so you can
  change it mid-game. Vibrate only works on devices that support it (most Android
  phones, not iPhones).

Settings are remembered in the browser.

## Project layout

- `index.html`: the page
- `css/style.css`: styling
- `js/cards.js`: card text (45 adjectives, 45 nouns, 40 pivot questions)
- `js/game.js`: dealing, the challenge pivot and clock helpers (no DOM)
- `js/sound.js`: ticks, buzzer and pivot sound, made with Web Audio, plus vibration
- `js/app.js`: the screens and the pitch clock
- `../tests/pivot-pitch.test.js`: tests, run with `npm test` from the repo root

To change the cards, edit `js/cards.js`. The tests check the card counts, so update them
in `tests/pivot-pitch.test.js` if you add or remove cards.
