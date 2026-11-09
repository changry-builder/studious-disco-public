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

test("no name fills in partway through typing someone else's name", () => {
  // Answers fill in as you type, so "Grant" must not be the first letters of
  // someone else's name or that person could never be typed.
  const index = RollCall.buildIndex(PRESIDENTS);
  for (const [key, owners] of index) {
    for (const [other, otherOwners] of index) {
      if (other !== key && other.startsWith(key)) {
        for (const id of otherOwners) {
          assert.ok(owners.has(id), `"${key}" fills in before "${other}" can be typed`);
        }
      }
    }
  }
});

test("every answer has a board label", () => {
  for (const [id, a] of Object.entries(PRESIDENTS.answers)) assert.ok(a.short, id);
});

test("surnames, full names and nicknames all count", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.deepEqual(game.guess("Lincoln"), { type: "found", ids: ["lincoln"] });
  assert.deepEqual(game.guess("van buren").ids, ["vanburen"]);
  assert.deepEqual(game.guess("FDR").ids, ["froosevelt"]);
  assert.deepEqual(game.guess("Ike").ids, ["eisenhower"]);
  assert.deepEqual(game.guess("John F. Kennedy").ids, ["kennedy"]);
  assert.deepEqual(game.guess("Dubya").ids, ["gwbush"]);
  assert.equal(game.found.size, 6);
});

test("a shared surname fills in everyone who has it", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.deepEqual(game.guess("Bush").ids.sort(), ["ghwbush", "gwbush"]);
  assert.equal(game.guess("Bush Jr").type, "repeat");
  assert.deepEqual(game.guess("John Adams").ids, ["jadams"], "a first name picks one");
  assert.deepEqual(game.guess("Adams").ids, ["jqadams"], "then the surname fills the rest");
  assert.equal(game.guess("Adams").type, "repeat");
  assert.deepEqual(game.guess("Johnson").ids.sort(), ["ajohnson", "ljohnson"]);
});

test("one answer covers both of Cleveland's and Trump's terms", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.deepEqual(game.guess("Cleveland").ids, ["cleveland"]);
  assert.equal(game.guess("Grover Cleveland").type, "repeat");
  assert.deepEqual(game.guess("trump").ids, ["trump"]);
});

test("typos are only forgiven on Enter", () => {
  const game = RollCall.createGame(PRESIDENTS);
  assert.equal(game.guess("Eisenhauer"), null);
  assert.deepEqual(game.guess("Eisenhauer", { fuzzy: true }).ids, ["eisenhower"]);
  assert.deepEqual(game.guess("Jeffersen", { fuzzy: true }).ids, ["jefferson"]);
  assert.equal(game.guess("Harison", { fuzzy: true }).ids.length, 2);
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

test("easy mode initials", () => {
  assert.equal(RollCall.initials("Abraham Lincoln"), "A. L.");
  assert.equal(RollCall.initials("Ulysses S. Grant"), "U. S. G.");
  assert.equal(RollCall.initials("George H. W. Bush"), "G. H. W. B.");
  assert.equal(RollCall.initials("Martin Van Buren"), "M. V. B.");
});

test("tracks which answers needed a hint", () => {
  const game = RollCall.createGame(PRESIDENTS);
  game.guess("Lincoln");
  assert.equal(game.hint("lincoln"), false, "a hint after naming doesn't count");
  assert.equal(game.hint("polk"), true);
  assert.equal(game.hint("polk"), false);
  game.hint("biden");
  game.guess("Polk");
  assert.ok(game.isHinted("polk"));
  assert.ok(!game.isHinted("lincoln"));
  assert.equal(game.found.size, 2);
  assert.equal(game.unaided(), 1, "Lincoln on their own, Polk with a hint, Biden not named");
});

const { BILL_OF_RIGHTS } = require("../roll-call/js/quizzes/bill-of-rights.js");

test("Bill of Rights data is complete", () => {
  assert.equal(BILL_OF_RIGHTS.mode, "say");
  assert.equal(BILL_OF_RIGHTS.slots.length, 10);
  BILL_OF_RIGHTS.slots.forEach((slot) => {
    const a = BILL_OF_RIGHTS.answers[slot.answer];
    assert.ok(a && a.name && a.hint, `${slot.label} needs a name and a hint`);
  });
});

test("the quizmaster can tick answers off and undo a mis-tap", () => {
  const game = RollCall.createGame(BILL_OF_RIGHTS);
  assert.equal(game.toggle("a2"), true);
  game.hint("a5");
  assert.equal(game.toggle("a5"), true);
  assert.equal(game.toggle("a7"), true);
  assert.equal(game.toggle("a7"), false, "tapping again unticks");
  assert.equal(game.found.size, 2);
  assert.equal(game.unaided(), 1);
  assert.equal(game.missed().length, 8);
});
