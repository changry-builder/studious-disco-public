// Quiz: all 27 amendments to the US Constitution, played out loud.
//
// A "say" quiz has no typing. One person holds the phone; the other names the
// answers out loud, and the phone holder taps each one they get. The answers start
// hidden (the quizmaster can show them), and each has a `hint` that can be read out
// without giving the answer away.

(function (root) {
  // [amendment, year ratified, what it does, more detail, hint to read out]
  const AMENDMENTS = [
    // The Bill of Rights
    ["1st", 1791, "Freedom of religion, speech and the press",
      "Also the right to assemble peacefully and to petition the government",
      "Five freedoms: what you believe, say, print, and gathering to protest"],
    ["2nd", 1791, "Right to keep and bear arms",
      "“A well regulated militia…”",
      "It's often in the news when people debate gun laws"],
    ["3rd", 1791, "No quartering of soldiers",
      "Soldiers can't be housed in your home in peacetime without your consent",
      "The British army used to do this in colonists' homes"],
    ["4th", 1791, "No unreasonable searches and seizures",
      "Warrants need probable cause",
      "What the police need from a judge before going through your house"],
    ["5th", 1791, "Rights of the accused: no self-incrimination or double jeopardy",
      "Also grand juries, due process, and fair pay if the government takes your property",
      "“I plead the …”"],
    ["6th", 1791, "Right to a speedy and public trial",
      "With an impartial jury, a lawyer, and the chance to confront witnesses",
      "Criminal trials: how quickly, in front of whom, and who's on your side"],
    ["7th", 1791, "Right to a jury trial in civil cases",
      "For lawsuits over $20",
      "Like the criminal-trial one, but for disputes between people"],
    ["8th", 1791, "No excessive bail or cruel and unusual punishment",
      "Also no excessive fines",
      "It limits how harshly someone can be treated or punished"],
    ["9th", 1791, "Rights not listed are still kept by the people",
      "Listing some rights doesn't take away others",
      "Just because a right isn't written down…"],
    ["10th", 1791, "Powers not given to the federal government belong to the states or the people",
      "",
      "Where everything not handed to Washington ends up"],
    // Later amendments
    ["11th", 1795, "States can't be sued in federal court by people from other states or countries",
      "Sovereign immunity",
      "Limits who can take a state to court"],
    ["12th", 1804, "Separate electoral votes for president and vice president",
      "",
      "Fixed the Electoral College after the tied election of 1800"],
    ["13th", 1865, "Abolished slavery",
      "Except as punishment for a crime",
      "Ratified as the Civil War ended"],
    ["14th", 1868, "Citizenship, equal protection and due process",
      "Anyone born or naturalized in the US is a citizen; states must treat people equally under the law",
      "The second Reconstruction amendment; cited in Brown v. Board of Education"],
    ["15th", 1870, "Voting can't be denied because of race",
      "Or color, or having been enslaved",
      "The third Reconstruction amendment; it's about the ballot box"],
    ["16th", 1913, "Federal income tax",
      "",
      "Why people file with the IRS every April"],
    ["17th", 1913, "Senators elected directly by voters",
      "",
      "Before this, state legislatures chose them"],
    ["18th", 1919, "Prohibition of alcohol",
      "",
      "Speakeasies and bootleggers"],
    ["19th", 1920, "Women's right to vote",
      "",
      "The suffrage movement's big win"],
    ["20th", 1933, "Terms begin in January: the president on Jan 20, Congress on Jan 3",
      "The “Lame Duck” amendment",
      "Moved Inauguration Day from March"],
    ["21st", 1933, "Repealed Prohibition",
      "",
      "Undid an earlier amendment; the only one to do that"],
    ["22nd", 1951, "Presidents limited to two terms",
      "",
      "Passed after FDR won four elections"],
    ["23rd", 1961, "Electoral votes for Washington, D.C.",
      "",
      "Gave the nation's capital a say in choosing the president"],
    ["24th", 1964, "No poll taxes in federal elections",
      "",
      "You can't be charged money to …"],
    ["25th", 1967, "Presidential succession and disability",
      "Who takes over, and how a vice-presidency is filled",
      "What happens if the president dies or can't do the job"],
    ["26th", 1971, "Voting age lowered to 18",
      "",
      "“Old enough to fight, old enough to vote”"],
    ["27th", 1992, "Congressional pay raises wait until after the next election",
      "",
      "Proposed in 1789, ratified more than 200 years later"],
  ];

  const answers = {};
  const slots = [];
  for (const [label, year, name, detail, hint] of AMENDMENTS) {
    const id = `a${parseInt(label, 10)}`;
    answers[id] = { name, detail, hint };
    slots.push({ label, sub: String(year), answer: id });
  }

  const AMENDMENTS_QUIZ = {
    id: "amendments",
    mode: "say",
    title: "Constitutional Amendments",
    blurb: "All 27, from the Bill of Rights on. One person reads, one answers out loud.",
    prompt: "Name the 27 amendments to the US Constitution",
    noun: "amendments",
    seconds: 10 * 60,
    instructions: [
      "For two people. The <strong>quizmaster</strong> holds the phone; the <strong>player</strong> says what each amendment does, out loud.",
      "The answers start hidden. Tap 👁 <strong>Answers</strong> at the top to see them (keep the phone out of the player's view). Tap an amendment when the player gets it; tap again to undo.",
      "Tap 💡 on an amendment for a clue you can read out. It doesn't show the answer. At the end you'll see which ones needed a hint.",
      "Decide together how strict to be: does the player need the number, or only what it does?",
    ],
    answers,
    slots,
  };

  if (typeof module === "object" && module.exports) module.exports = { AMENDMENTS: AMENDMENTS_QUIZ };
  else (root.ROLL_CALL_QUIZZES = root.ROLL_CALL_QUIZZES || []).push(AMENDMENTS_QUIZ);
})(this);
