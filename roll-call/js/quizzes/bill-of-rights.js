// Quiz: the Bill of Rights, played out loud.
//
// A "say" quiz has no typing. One person holds the phone and sees the answers; the
// other names them out loud, and the phone holder taps each one they get. Each
// answer has a `hint` the phone holder can read out.

(function (root) {
  // [amendment, what it protects, key points, hint to read out]
  const AMENDMENTS = [
    ["1st", "Freedom of religion, speech and the press",
      "Also the right to assemble peacefully and to petition the government",
      "Five freedoms: what you believe, say, print, and gathering to protest"],
    ["2nd", "Right to keep and bear arms",
      "“A well regulated militia…”",
      "It's often in the news when people debate gun laws"],
    ["3rd", "No quartering of soldiers",
      "Soldiers can't be housed in your home in peacetime without your consent",
      "The British army used to do this in colonists' homes"],
    ["4th", "No unreasonable searches and seizures",
      "Warrants need probable cause",
      "What the police need from a judge before searching your house"],
    ["5th", "Rights of the accused: no self-incrimination or double jeopardy",
      "Also grand juries, due process, and fair pay if the government takes your property",
      "“I plead the …”"],
    ["6th", "Right to a speedy and public trial",
      "With an impartial jury, a lawyer, and the chance to confront witnesses",
      "Criminal trials: quick, open to the public, and you get a lawyer"],
    ["7th", "Right to a jury trial in civil cases",
      "For lawsuits over $20",
      "Like the trial one, but for lawsuits between people, not crimes"],
    ["8th", "No excessive bail or cruel and unusual punishment",
      "Also no excessive fines",
      "It limits how harshly someone can be punished"],
    ["9th", "Rights not listed are still kept by the people",
      "Listing some rights doesn't take away others",
      "Just because a right isn't written down…"],
    ["10th", "Powers not given to the federal government belong to the states or the people",
      "",
      "States' rights"],
  ];

  const answers = {};
  const slots = [];
  for (const [label, name, detail, hint] of AMENDMENTS) {
    const id = `a${parseInt(label, 10)}`;
    answers[id] = { name, detail, hint };
    slots.push({ label, sub: "", answer: id });
  }

  const BILL_OF_RIGHTS = {
    id: "bill-of-rights",
    mode: "say",
    title: "The Bill of Rights",
    blurb: "Two players. One reads, one answers out loud.",
    prompt: "Name the 10 amendments in the Bill of Rights",
    noun: "amendments",
    seconds: 5 * 60,
    instructions: [
      "For two people. The <strong>quizmaster</strong> holds the phone; the <strong>player</strong> names what each amendment protects, out loud.",
      "After you press Start, the phone shows the answers, so keep it out of the player's view. Tap an amendment when they get it (tap again to undo). Tap 💡 for a hint you can read out; at the end you'll see which ones needed one.",
      "Decide together how strict to be: does the player need the amendment's number, or only what it protects?",
    ],
    answers,
    slots,
  };

  if (typeof module === "object" && module.exports) module.exports = { BILL_OF_RIGHTS };
  else (root.ROLL_CALL_QUIZZES = root.ROLL_CALL_QUIZZES || []).push(BILL_OF_RIGHTS);
})(this);
