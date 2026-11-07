const test = require("node:test");
const assert = require("node:assert/strict");
const RollCall = require("../roll-call/js/engine.js");
const { PRESIDENTS } = require("../roll-call/js/quizzes/presidents.js");

test("presidents data is complete", () => {
  assert.equal(PRESIDENTS.slots.length, 47);
  assert.equal(Object.keys(PRESIDENTS.answers).length, 45);
  PRESIDENTS.slots.forEach((slot, i) => {
    assert.equal(slot.label, `#${i + 1}`);
    assert.ok(PRESIDENTS.answers[slot.answer], `slot ${slot.label} has an unknown answer`);
  });
  const used = new Set(PRESIDENTS.slots.map((s) => s.answer));
  assert.equal(used.size, 45, "every person has a slot");
  const twice = PRESIDENTS.slots.filter((s) => s.answer === "cleveland" || s.answer === "trump");
  assert.deepEqual(twice.map((s) => s.label), ["#22", "#24", "#45", "#47"]);
});

test("no name that fills in on its own is the start of a different person's name", () => {
  // Answers fill in as you type, so "Grant" must not be the first letters of
  // someone else's name or that person could never be typed.
  const index = RollCall.buildIndex(PRESIDENTS);
  for (const [key, owners] of index) {
    if (owners.size !== 1) continue;
    const [owner] = owners;
    for (const [other, otherOwners] of index) {
      if (other !== key && other.startsWith(key)) {
        assert.ok(otherOwners.has(owner) && otherOwners.size === 1,
          `"${key}" fills in before "${other}" can be typed`);
      }
    }
  }
});

test("surnames, full names and nicknames all count", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.deepEqual(game.guess("Lincoln"), { type: "found", id: "lincoln" });
  assert.equal(game.guess("van buren").id, "vanburen");
  assert.equal(game.guess("FDR").id, "froosevelt");
  assert.equal(game.guess("Ike").id, "eisenhower");
  assert.equal(game.guess("John F. Kennedy").id, "kennedy");
  assert.equal(game.guess("Dubya").id, "gwbush");
  assert.equal(game.found.size, 6);
});

test("shared surnames ask which one, until only one is left", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.equal(game.guess("Adams").type, "ambiguous");
  assert.equal(game.guess("John Quincy Adams").id, "jqadams");
  assert.equal(game.guess("adams").id, "jadams");
  assert.equal(game.guess("Adams").type, "repeat");

  assert.equal(game.guess("Bush").type, "ambiguous");
  assert.equal(game.guess("George Bush").type, "ambiguous");
  assert.equal(game.guess("HW Bush").id, "ghwbush");
  assert.equal(game.guess("Johnson").type, "ambiguous");
  assert.equal(game.guess("LBJ").id, "ljohnson");
});

test("one answer covers both of Cleveland's and Trump's terms", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.equal(game.guess("Cleveland").id, "cleveland");
  assert.equal(game.guess("Grover Cleveland").type, "repeat");
  assert.equal(game.guess("trump").id, "trump");
});

test("typos are only forgiven on Enter", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.equal(game.guess("Eisenhauer"), null);
  assert.equal(game.guess("Eisenhauer", { fuzzy: true }).id, "eisenhower");
  assert.equal(game.guess("Jeffersen", { fuzzy: true }).id, "jefferson");
  assert.equal(game.guess("Harison", { fuzzy: true }).type, "ambiguous");
  assert.equal(game.guess("Smith", { fuzzy: true }).type, "miss");
  assert.equal(game.guess("Polc", { fuzzy: true }).type, "miss", "short names need to be exact");
  assert.equal(game.guess("   "), null);
});

test("naming everyone completes the game", () => {
  const game = RollCall.createGame(PRESIDENTS);
  for (const answer of Object.values(PRESIDENTS.answers)) game.guess(answer.name);
  assert.ok(game.isComplete());
  assert.deepEqual(game.missed(), []);
});

test("formats the clock", () => {
  assert.equal(RollCall.formatClock(600), "10:00");
  assert.equal(RollCall.formatClock(61.2), "1:02");
  assert.equal(RollCall.formatClock(-3), "0:00");
});
