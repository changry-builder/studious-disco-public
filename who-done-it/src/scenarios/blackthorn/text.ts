// Blackthorn Hall display text. Written to docs/content-style-guide.md.
// Facts come from facts.ts and docs/scenario-01.md. Text never adds a fact the engine did not give.

export const text: Record<string, string | string[]> = {
  // Scenario
  "scenario.title": "Blackthorn Hall",
  "scenario.blurb": "New Year's Eve, 1926. Snow has cut off the drive, and the household is gathering for the midnight toast.",

  // Briefings, one per possible victim
  "briefing.edmund": "Inspector, snow has shut the drive at Blackthorn Hall, though the telephone to the village still works. The household has gathered for the New Year, as it does every year. Lord Edmund Blackthorn, master of the house, has not come down. Someone is sent to fetch him. The family has barely begun to grumble when the body is found, just as the midnight toast is about to be raised.",
  "briefing.penrose": "Inspector, snow has shut the drive at Blackthorn Hall, though the telephone to the village still works. The household has gathered for the New Year, as it does every year. Dr Arthur Penrose, the family physician, has not come down. Someone is sent to fetch him. The family has barely begun to grumble when the body is found, just as the midnight toast is about to be raised.",
  "briefing.forsythe": "Inspector, snow has shut the drive at Blackthorn Hall, though the telephone to the village still works. The household has gathered for the New Year, as it does every year. Colonel Hugh Forsythe, old comrade of the master of the house, has not come down. Someone is sent to fetch him. The family has barely begun to grumble when the body is found, just as the midnight toast is about to be raised.",

  // Lord Edmund Blackthorn
  "char.edmund.name": "Lord Edmund Blackthorn",
  "char.edmund.role": "Master of the house",
  "char.edmund.line": "Made his money in coal and his enemies at home",
  "char.edmund.bio": "Lord Edmund Blackthorn, sixty-eight, master of the house. He made his fortune in coal, and his enemies, it is said, at home. He has never been a man to mince his words, nor to suffer a question he does not care for.",
  "char.edmund.address.margaret": "Margaret",
  "char.edmund.address.julian": "Julian",
  "char.edmund.address.beatrice": "Beatrice",
  "char.edmund.address.penrose": "Penrose",
  "char.edmund.address.violet": "Miss Marsh",
  "char.edmund.address.forsythe": "Forsythe",
  "char.edmund.address.finch": "Finch",
  "char.edmund.claim.alone": [
    "I was in {room} at {time}. Alone. Is that what you wanted to know?",
    "{room}, {time}. Alone. Kindly move on, Inspector.",
    "I was in {room} at {time}, by myself. Next question."
  ],
  "char.edmund.claim.with": [
    "I was in {room} at {time}, {company}. Now, may we get on?",
    "{room}, at {time}, {company}. I have nothing to add to that.",
    "I was in {room} at {time}, {company}. Ask me something sensible."
  ],
  "char.edmund.firm": [
    "I have told you where I was. I shall not be asked twice.",
    "Don't waste my evening, Inspector. My answer is the same as before."
  ],
  "char.edmund.crack": [
    "No. That won't do. I spoke too quickly. Strike it out.",
    "Hang on. I put that badly, and I want it taken back before we go on."
  ],
  "char.edmund.confess": "Very well. I was telephoning my solicitor, in secret. I'd be obliged if that went no further.",
  "char.edmund.retractVouch": "I said {name} was with me. That was not so. Don't make a meal of it.",

  // Lady Margaret Blackthorn
  "char.margaret.name": "Lady Margaret Blackthorn",
  "char.margaret.role": "Lord Edmund's wife",
  "char.margaret.line": "Runs the house and forgives nothing",
  "char.margaret.bio": "Lady Margaret Blackthorn, sixty-one, wife of Lord Edmund and mistress of the house. She runs the household with exactness and forgives nothing. She is devoted to her children, and Julian is her favourite.",
  "char.margaret.address.edmund": "Edmund",
  "char.margaret.address.julian": "Julian",
  "char.margaret.address.beatrice": "Beatrice",
  "char.margaret.address.penrose": "Dr Penrose",
  "char.margaret.address.violet": "Miss Marsh",
  "char.margaret.address.forsythe": "Colonel Forsythe",
  "char.margaret.address.finch": "Finch",
  "char.margaret.claim.alone": [
    "You mean where was I at {time}. I was in {room}, and alone.",
    "I was in {room} at {time}, and I was alone. I expect you meant to ask that.",
    "Alone, Inspector, in {room}, at {time}. Your question was rather longer than the answer."
  ],
  "char.margaret.claim.with": [
    "You mean where I was at {time}. I was in {room}, {company}.",
    "I was in {room} at {time}, {company}. I should have thought that was plain.",
    "In {room} at {time}, {company}. You may write that down, Inspector."
  ],
  "char.margaret.firm": [
    "I have answered you, Inspector. I shall not repeat myself.",
    "Asking again will not change the answer, and I do not care for being pressed."
  ],
  "char.margaret.crack": [
    "That was careless of me. I will not have it on the record as it stood.",
    "I misspoke, and I am not in the habit of it. Strike that, if you please."
  ],
  "char.margaret.confess": "Very well. I was swapping my pearls for paste copies. You will be discreet about it, Inspector.",
  "char.margaret.retractVouch": "I told you {name} was with me. I was wrong, and I shall not say so twice.",

  // Julian Blackthorn
  "char.julian.name": "Julian Blackthorn",
  "char.julian.role": "Son and heir",
  "char.julian.line": "Charming, idle, and in debt",
  "char.julian.bio": "Julian Blackthorn, thirty-four, son and heir to the Blackthorn fortune. Charming, idle and in debt, though he would rather not discuss the last. His mother's favourite, and he knows it.",
  "char.julian.address.edmund": "my father",
  "char.julian.address.margaret": "my mother",
  "char.julian.address.beatrice": "Beatrice",
  "char.julian.address.penrose": "Dr Penrose",
  "char.julian.address.violet": "Miss Marsh",
  "char.julian.address.forsythe": "the Colonel",
  "char.julian.address.finch": "Finch",
  "char.julian.claim.alone": [
    "I was in {room} at {time}, all on my own. Sorry to be so dull about it.",
    "In {room} at {time}, quite alone. Not the most thrilling evening, I'm afraid.",
    "{room}, {time}, on my own, Inspector. I'm afraid I've no better story than that."
  ],
  "char.julian.claim.with": [
    "I was in {room} at {time}, {company}. Terribly dull of me, I know.",
    "{room}, {time}, {company}. Sorry, Inspector, that's the whole of it.",
    "I was in {room} at {time}, {company}, and I can't do better than that, I'm afraid."
  ],
  "char.julian.firm": [
    "Ask me again and I'll only say the same thing, with less charm.",
    "I've told you, Inspector. Shall we have a drink instead?"
  ],
  "char.julian.crack": [
    "Oh, hang it. I'm making a hash of this. Let's start again, shall we?",
    "Hmm. No, that came out all wrong. Strike it, there's a good chap."
  ],
  "char.julian.confess": "All right, all right. I was trying the combination on my father's safe. Don't look at me like that.",
  "char.julian.retractVouch": "I said {name} was with me. Didn't quite happen that way, I'm afraid.",

  // Miss Beatrice Blackthorn
  "char.beatrice.name": "Beatrice Blackthorn",
  "char.beatrice.role": "Daughter",
  "char.beatrice.line": "Sharp, watchful, planning to leave",
  "char.beatrice.bio": "Beatrice Blackthorn, twenty-nine, daughter of the house. Sharp and watchful, she says less than she knows. She has always covered for her brother Julian, and she has plans of her own for leaving the Hall.",
  "char.beatrice.address.edmund": "Father",
  "char.beatrice.address.margaret": "Mother",
  "char.beatrice.address.julian": "Julian",
  "char.beatrice.address.penrose": "Dr Penrose",
  "char.beatrice.address.violet": "Miss Marsh",
  "char.beatrice.address.forsythe": "the Colonel",
  "char.beatrice.address.finch": "Finch",
  "char.beatrice.claim.alone": [
    "{room}. {time}. Alone. You may write that down.",
    "I was in {room} at {time}. Alone. Is there anything else?",
    "In {room} at {time}, with nobody. I shall not elaborate."
  ],
  "char.beatrice.claim.with": [
    "{room}, at {time}, {company}. That is all I shall say on it.",
    "I was in {room} at {time}, {company}. I think that answers you.",
    "In {room} at {time}, {company}. You asked, and I have told you."
  ],
  "char.beatrice.firm": [
    "I have said what I know. That is not the same as saying more.",
    "You will get no more from me by repeating the question."
  ],
  "char.beatrice.crack": [
    "I put that badly. I should like it taken back, please.",
    "No. That was not quite right. Let me correct it before you write it down."
  ],
  "char.beatrice.confess": "Yes. I was hiding a packed valise. I am not sorry, and I'd thank you not to ask why.",
  "char.beatrice.retractVouch": "{name} was not with me. I said otherwise, and I was wrong to.",

  // Dr Arthur Penrose
  "char.penrose.name": "Dr Arthur Penrose",
  "char.penrose.role": "Family physician",
  "char.penrose.line": "Knows every ailment in the county, and what each is worth",
  "char.penrose.bio": "Dr Arthur Penrose, fifty-five, family physician to the Blackthorns. He knows every ailment in the county, and what each is worth. Smooth and clinical, he is fond of a Latin tag, and rarely fails to find one.",
  "char.penrose.address.edmund": "Lord Edmund",
  "char.penrose.address.margaret": "Lady Margaret",
  "char.penrose.address.julian": "Julian",
  "char.penrose.address.beatrice": "Beatrice",
  "char.penrose.address.violet": "Miss Marsh",
  "char.penrose.address.forsythe": "Colonel Forsythe",
  "char.penrose.address.finch": "Finch",
  "char.penrose.claim.alone": [
    "Solus, Inspector, as the Romans would say. In {room} at {time}.",
    "In {room} at {time}, and entirely alone. Pro forma, I am glad to be asked.",
    "I was in {room} at {time}, alone. Nothing remarkable, I assure you."
  ],
  "char.penrose.claim.with": [
    "In {room} at {time}, {company}. Entirely unremarkable, as far as one may judge.",
    "I was in {room} at {time}, {company}. Quite the usual thing, Inspector.",
    "{room}, {time}, {company}. Nihil ad addendum, Inspector."
  ],
  "char.penrose.firm": [
    "Repetition does not alter the facts, Inspector. Nor does insistence.",
    "I have given you my account. I see no reason to revise it."
  ],
  "char.penrose.crack": [
    "A lapse of memory, Inspector. My mistake. Strike it, if you please.",
    "I am not myself on this subject. Let that be disregarded, please."
  ],
  "char.penrose.confess": "I was at the laudanum in the medicine store. Let us not dress it up as anything grander.",
  "char.penrose.retractVouch": "I said {name} was in my company. I am obliged to correct that. They were not.",

  // Miss Violet Marsh
  "char.violet.name": "Miss Violet Marsh",
  "char.violet.role": "Lord Edmund's secretary",
  "char.violet.line": "Efficient, new, and not who her references say",
  "char.violet.bio": "Miss Violet Marsh, twenty-seven, secretary to Lord Edmund. Efficient, careful and new to the household. Her references are generous, and not everyone is persuaded by them.",
  "char.violet.address.edmund": "Lord Edmund",
  "char.violet.address.margaret": "Lady Margaret",
  "char.violet.address.julian": "Mr Julian",
  "char.violet.address.beatrice": "Miss Blackthorn",
  "char.violet.address.penrose": "Dr Penrose",
  "char.violet.address.forsythe": "Colonel Forsythe",
  "char.violet.address.finch": "Mr Finch",
  "char.violet.claim.alone": [
    "I was in {room} at {time}. I was alone.",
    "Alone. I was in {room} at {time}, and I can say no more than that exactly.",
    "At {time} I was in {room}, and I was by myself. That is all."
  ],
  "char.violet.claim.with": [
    "I was in {room} at {time}, {company}. That is exact, and I have nothing to add.",
    "At {time} I was in {room}, {company}. I have answered what you asked.",
    "I was in {room} at {time}, {company}. I can give you no more precision than that."
  ],
  "char.violet.firm": [
    "I have given you my answer. It has not changed, and it will not.",
    "I can only repeat what I have said, Inspector. I am sorry it is not more helpful."
  ],
  "char.violet.crack": [
    "No. That was not correct. I must put it right before I go on.",
    "I should not have said that. Please strike it from your notes."
  ],
  "char.violet.confess": "I was copying papers from the desk. I do not regret it, and I shall not pretend otherwise.",
  "char.violet.retractVouch": "I told you {name} was with me. That was not correct, and I apologise.",

  // Colonel Hugh Forsythe
  "char.forsythe.name": "Colonel Hugh Forsythe",
  "char.forsythe.role": "Old comrade and partner",
  "char.forsythe.line": "A war hero, by his own account",
  "char.forsythe.bio": "Colonel Hugh Forsythe, sixty-three, old comrade and business partner of Lord Edmund. A war hero, by his own account, and he has never let anyone forget the regiment. Hearty, rambling, and fond of the old days.",
  "char.forsythe.address.edmund": "old Edmund",
  "char.forsythe.address.margaret": "Lady Margaret",
  "char.forsythe.address.julian": "young Julian",
  "char.forsythe.address.beatrice": "Miss Beatrice",
  "char.forsythe.address.penrose": "Dr Penrose",
  "char.forsythe.address.violet": "Miss Marsh",
  "char.forsythe.address.finch": "Finch",
  "char.forsythe.claim.alone": [
    "{room}, {time}, alone! Like a sentry at his post, Inspector. All very quiet.",
    "I was in {room} at {time}, and alone. One gets used to it, in the army.",
    "Alone! In {room} at {time}. Nothing to report, Inspector. Dismissed!"
  ],
  "char.forsythe.claim.with": [
    "{room}, {time}, {company}! Like old times in the mess, Inspector. Splendid company.",
    "I was in {room} at {time}, {company}. Capital company, Inspector, capital.",
    "In {room} at {time}, {company}. Shoulder to shoulder, as it were. Nothing to report."
  ],
  "char.forsythe.firm": [
    "I've said my piece, Inspector. Stood my ground in France, and I'm standing it now.",
    "Ask me again and you'll get the same answer, and a bit more of the regiment besides."
  ],
  "char.forsythe.crack": [
    "Blast it, I've got my dates tangled. Scrap what I said, Inspector.",
    "No, no, that's not right at all. Strike it out, there's a good fellow."
  ],
  "char.forsythe.confess": "Right, I'll own it. I was cutting a page from the regimental history. Damned awkward, but there it is.",
  "char.forsythe.retractVouch": "I said {name} was with me, Inspector. That was a fib. They were not there at all.",

  // Mr Thomas Finch
  "char.finch.name": "Mr Thomas Finch",
  "char.finch.role": "Butler",
  "char.finch.line": "Thirty years of service and a long memory",
  "char.finch.bio": "Mr Thomas Finch, fifty-eight, butler to the house. Thirty years in the family's service, and a long memory. Formal and discreet, he has seen every family quarrel from the back of the room, and has said nothing of any of them.",
  "char.finch.address.edmund": "his lordship",
  "char.finch.address.margaret": "her ladyship",
  "char.finch.address.julian": "Mr Julian",
  "char.finch.address.beatrice": "Miss Beatrice",
  "char.finch.address.penrose": "Dr Penrose",
  "char.finch.address.violet": "Miss Marsh",
  "char.finch.address.forsythe": "the Colonel",
  "char.finch.claim.alone": [
    "I was in {room} at {time}, Inspector. Alone.",
    "If I may say so, Inspector, I was in {room} at {time}, and on my own.",
    "In {room} at {time}, Inspector, and by myself. I trust that is of assistance."
  ],
  "char.finch.claim.with": [
    "I was in {room} at {time}, {company}, Inspector. I trust that answers your question.",
    "If I may say so, Inspector, I was in {room} at {time}, {company}.",
    "In {room} at {time}, {company}. I have nothing further to add, Inspector."
  ],
  "char.finch.firm": [
    "I have told you what I can, Inspector. I could add nothing without guessing.",
    "I am not in the habit of repeating myself, Inspector, and I shall not begin now."
  ],
  "char.finch.crack": [
    "Forgive me, Inspector. I spoke out of turn. That must be withdrawn.",
    "I beg your pardon. I was mistaken in what I said. Please disregard it."
  ],
  "char.finch.confess": "I was drinking the 1908 port, Inspector. I will not deny it, though I'd be grateful for your discretion.",
  "char.finch.retractVouch": "I said {name} was with me, Inspector. I should not have. They were not.",

  // Rooms: name, description, inline, presence record
  "room.hall.name": "Great Hall",
  "room.hall.desc": "A high, cold hall, with the telephone on its table and the long-case clock ticking steadily.",
  "room.hall.inline": "the Great Hall",
  "room.hall.proof": "The exchange slip for the trunk call, signed by {name} and timed {time}.",
  "room.hall.spot.telephone-table.name": "Telephone table",
  "room.hall.spot.telephone-table.inline": "the telephone table",
  "room.hall.spot.telephone-table.empty": "Nothing on the telephone table but the directory and a pencil.",
  "room.hall.spot.coat-stand.name": "Coat stand",
  "room.hall.spot.coat-stand.inline": "the coat stand",
  "room.hall.spot.coat-stand.empty": "Coats, scarves and a walking stick, none of them of interest.",
  "room.hall.spot.long-case-clock.name": "Long-case clock",
  "room.hall.spot.long-case-clock.inline": "the long-case clock",
  "room.hall.spot.long-case-clock.empty": "The clock ticks on. Nothing has been left beside it.",

  "room.drawing.name": "Drawing Room",
  "room.drawing.desc": "Chairs drawn up to the fire, a card table, and a piano.",
  "room.drawing.inline": "the Drawing Room",
  "room.drawing.proof": "The bridge score sheet, initialled by {name} and timed {time}.",
  "room.drawing.spot.fireplace.name": "Fireplace",
  "room.drawing.spot.fireplace.inline": "the fireplace",
  "room.drawing.spot.fireplace.empty": "Cold ash and a fender, and nothing else.",
  "room.drawing.spot.card-table.name": "Card table",
  "room.drawing.spot.card-table.inline": "the card table",
  "room.drawing.spot.card-table.empty": "The baize is smooth, and the cards are packed away.",
  "room.drawing.spot.piano.name": "Piano",
  "room.drawing.spot.piano.inline": "the piano",
  "room.drawing.spot.piano.empty": "The lid is shut and the music is in its stand. Nothing beneath it.",

  "room.dining.name": "Dining Room",
  "room.dining.desc": "The cloth has been cleared and the silver put away. A sideboard, and a long table with the chairs pushed back.",
  "room.dining.inline": "the Dining Room",
  "room.dining.proof": "The decanter book, signed by {name} and timed {time}.",
  "room.dining.spot.sideboard.name": "Sideboard",
  "room.dining.spot.sideboard.inline": "the sideboard",
  "room.dining.spot.sideboard.empty": "Napkins, a spare cruet, and nothing out of place.",
  "room.dining.spot.table.name": "Dining table",
  "room.dining.spot.table.inline": "the dining table",
  "room.dining.spot.table.empty": "The cloth is bare and the chairs are pushed in.",

  "room.library.name": "Library",
  "room.library.desc": "Shelves to the ceiling, a reading desk by the window, and a globe on its stand.",
  "room.library.inline": "the library",
  "room.library.proof": "The lending ledger has an entry for {name}, timed {time}.",
  "room.library.spot.reading-desk.name": "Reading desk",
  "room.library.spot.reading-desk.inline": "the reading desk",
  "room.library.spot.reading-desk.empty": "A blotter and a pen tray, and nothing more.",
  "room.library.spot.shelves.name": "Shelves",
  "room.library.spot.shelves.inline": "the shelves",
  "room.library.spot.shelves.empty": "Row upon row of calf bindings, all in their places.",
  "room.library.spot.globe.name": "Globe",
  "room.library.spot.globe.inline": "the globe",
  "room.library.spot.globe.empty": "It turns smoothly under the hand, and nothing is hidden inside.",

  "room.study.name": "Study",
  "room.study.desc": "The master's room: a desk, a safe in the corner, and a wastepaper basket beside the desk.",
  "room.study.inline": "the study",
  "room.study.proof": "The master's appointment diary has {name} entered for {time}.",
  "room.study.spot.desk.name": "Desk",
  "room.study.spot.desk.inline": "the desk",
  "room.study.spot.desk.empty": "A blotter, an inkstand and a tidy stack of letters. Nothing more.",
  "room.study.spot.safe.name": "Safe",
  "room.study.spot.safe.inline": "the safe",
  "room.study.spot.safe.empty": "The door is shut and locked, and nothing is to be seen beside it.",
  "room.study.spot.wastepaper-basket.name": "Wastepaper basket",
  "room.study.spot.wastepaper-basket.inline": "the wastepaper basket",
  "room.study.spot.wastepaper-basket.empty": "Torn envelopes and blotting paper, nothing of note.",

  "room.billiard.name": "Billiard Room",
  "room.billiard.desc": "A green table under a hanging lamp, the cues racked on the wall, and the drinks cabinet by the door.",
  "room.billiard.inline": "the billiard room",
  "room.billiard.proof": "The marker's score book has {name} noted against {time}.",
  "room.billiard.spot.table.name": "Billiard table",
  "room.billiard.spot.table.inline": "the billiard table",
  "room.billiard.spot.table.empty": "The baize is bare and the balls are racked away.",
  "room.billiard.spot.cue-rack.name": "Cue rack",
  "room.billiard.spot.cue-rack.inline": "the cue rack",
  "room.billiard.spot.cue-rack.empty": "The cues stand in their rack, straight and in order.",
  "room.billiard.spot.drinks-cabinet.name": "Drinks cabinet",
  "room.billiard.spot.drinks-cabinet.inline": "the drinks cabinet",
  "room.billiard.spot.drinks-cabinet.empty": "Decanters and glasses, and nothing out of place.",

  "room.conservatory.name": "Conservatory",
  "room.conservatory.desc": "Glass on three sides, warm and damp, smelling of earth and paraffin. Wicker chairs, and a potting bench.",
  "room.conservatory.inline": "the conservatory",
  "room.conservatory.proof": "The hothouse log, initialled by {name} at {time}.",
  "room.conservatory.spot.potting-bench.name": "Potting bench",
  "room.conservatory.spot.potting-bench.inline": "the potting bench",
  "room.conservatory.spot.potting-bench.empty": "Pots, trowels and a bag of compost. Nothing else.",
  "room.conservatory.spot.tool-cabinet.name": "Tool cabinet",
  "room.conservatory.spot.tool-cabinet.inline": "the tool cabinet",
  "room.conservatory.spot.tool-cabinet.empty": "Garden shears and twine, and nothing that should not be there.",
  "room.conservatory.spot.wicker-chairs.name": "Wicker chairs",
  "room.conservatory.spot.wicker-chairs.inline": "the wicker chairs",
  "room.conservatory.spot.wicker-chairs.empty": "Two chairs, a rug folded over one, and nothing beneath them.",

  "room.kitchen.name": "Kitchen",
  "room.kitchen.desc": "A long scrubbed table, a range banked low, and the bell board on the wall above the door.",
  "room.kitchen.inline": "the kitchen",
  "room.kitchen.proof": "The cook's slate of bells answered has {name} against {time}.",
  "room.kitchen.spot.range.name": "Range",
  "room.kitchen.spot.range.inline": "the range",
  "room.kitchen.spot.range.empty": "Ash pan and kindling, and nothing beside them.",
  "room.kitchen.spot.pantry.name": "Pantry",
  "room.kitchen.spot.pantry.inline": "the pantry",
  "room.kitchen.spot.pantry.empty": "Jars, tins and a row of bottles. Nothing out of its place.",
  "room.kitchen.spot.bell-board.name": "Bell board",
  "room.kitchen.spot.bell-board.inline": "the bell board",
  "room.kitchen.spot.bell-board.empty": "The bells hang still on their wires.",

  "room.cellar.name": "Wine Cellar",
  "room.cellar.desc": "Cool and dark, with racks of bottles and crates stacked by the steps.",
  "room.cellar.inline": "the wine cellar",
  "room.cellar.proof": "The cellar book has {name} entered at {time}.",
  "room.cellar.spot.racks.name": "Wine racks",
  "room.cellar.spot.racks.inline": "the wine racks",
  "room.cellar.spot.racks.empty": "Dusty bottles lie in their racks, undisturbed.",
  "room.cellar.spot.crates.name": "Crates",
  "room.cellar.spot.crates.inline": "the crates",
  "room.cellar.spot.crates.empty": "Straw and empty crates, and nothing more.",

  "room.gallery.name": "Long Gallery",
  "room.gallery.desc": "Portraits of the family line the walls above a window seat, and a linen chest stands at the far end.",
  "room.gallery.inline": "the Long Gallery",
  "room.gallery.proof": "The housemaid's fire-lighting chit, with {name} against {time}.",
  "room.gallery.spot.window-seat.name": "Window seat",
  "room.gallery.spot.window-seat.inline": "the window seat",
  "room.gallery.spot.window-seat.empty": "The cushion is plump, and the seat is empty.",
  "room.gallery.spot.portraits.name": "Portraits",
  "room.gallery.spot.portraits.inline": "the portraits",
  "room.gallery.spot.portraits.empty": "Stern faces in gilt frames look down. Nothing is hidden behind them.",
  "room.gallery.spot.linen-chest.name": "Linen chest",
  "room.gallery.spot.linen-chest.inline": "the linen chest",
  "room.gallery.spot.linen-chest.empty": "Sheets, pillowcases and lavender bags. Nothing else.",

  // Weapons
  "weapon.poker.name": "Fire poker",
  "weapon.poker.inline": "the fire poker",
  "weapon.poker.inPlace": "The fire poker is in its place at {spot}, clean and undisturbed.",
  "weapon.poker.missing": "The fire poker is not at {spot}. Its place is empty.",
  "weapon.poker.foundClean": "The fire poker has turned up in {room}, at {spot}. It looks clean.",
  "weapon.poker.foundUsed": "The fire poker has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.candlestick.name": "Bronze candlestick",
  "weapon.candlestick.inline": "the bronze candlestick",
  "weapon.candlestick.inPlace": "The bronze candlestick stands at {spot}, polished and in its place.",
  "weapon.candlestick.missing": "The bronze candlestick is not at {spot}. Its place is empty.",
  "weapon.candlestick.foundClean": "The bronze candlestick has turned up in {room}, at {spot}. It looks clean.",
  "weapon.candlestick.foundUsed": "The bronze candlestick has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.bookend.name": "Marble bookend",
  "weapon.bookend.inline": "the marble bookend",
  "weapon.bookend.inPlace": "The marble bookend stands at {spot}, clean and in its place.",
  "weapon.bookend.missing": "The marble bookend is not at {spot}. Its place is empty.",
  "weapon.bookend.foundClean": "The marble bookend has turned up in {room}, at {spot}. It looks clean.",
  "weapon.bookend.foundUsed": "The marble bookend has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.letter-opener.name": "Silver letter opener",
  "weapon.letter-opener.inline": "the silver letter opener",
  "weapon.letter-opener.inPlace": "The silver letter opener lies at {spot}, clean and in its place.",
  "weapon.letter-opener.missing": "The silver letter opener is not at {spot}. Its place is empty.",
  "weapon.letter-opener.foundClean": "The silver letter opener has turned up in {room}, at {spot}. It looks clean.",
  "weapon.letter-opener.foundUsed": "The silver letter opener has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.carving-knife.name": "Carving knife",
  "weapon.carving-knife.inline": "the carving knife",
  "weapon.carving-knife.inPlace": "The carving knife is at {spot}, clean and in its place.",
  "weapon.carving-knife.missing": "The carving knife is not at {spot}. Its place is empty.",
  "weapon.carving-knife.foundClean": "The carving knife has turned up in {room}, at {spot}. It looks clean.",
  "weapon.carving-knife.foundUsed": "The carving knife has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.pruning-knife.name": "Pruning knife",
  "weapon.pruning-knife.inline": "the pruning knife",
  "weapon.pruning-knife.inPlace": "The pruning knife is at {spot}, clean and in its place.",
  "weapon.pruning-knife.missing": "The pruning knife is not at {spot}. Its place is empty.",
  "weapon.pruning-knife.foundClean": "The pruning knife has turned up in {room}, at {spot}. It looks clean.",
  "weapon.pruning-knife.foundUsed": "The pruning knife has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.curtain-cord.name": "Curtain cord",
  "weapon.curtain-cord.inline": "the curtain cord",
  "weapon.curtain-cord.inPlace": "The curtain cord lies at {spot}, clean and in its place.",
  "weapon.curtain-cord.missing": "The curtain cord is not at {spot}. Its place is empty.",
  "weapon.curtain-cord.foundClean": "The curtain cord has turned up in {room}, at {spot}. It looks clean.",
  "weapon.curtain-cord.foundUsed": "The curtain cord has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  "weapon.picture-wire.name": "Picture wire",
  "weapon.picture-wire.inline": "the picture wire",
  "weapon.picture-wire.inPlace": "The picture wire is at {spot}, coiled and in its place.",
  "weapon.picture-wire.missing": "The picture wire is not at {spot}. Its place is empty.",
  "weapon.picture-wire.foundClean": "The picture wire has turned up in {room}, at {spot}. It looks clean.",
  "weapon.picture-wire.foundUsed": "The picture wire has turned up in {room}, at {spot}. It is the weapon used, and the marks show it.",

  // Motive documents: suspect-victim-type
  "motive.margaret-edmund-jealousy.title": "Letters to a London woman",
  "motive.margaret-edmund-jealousy.text": "Letters from Lord Edmund to a woman in London, warm and frequent. In them he plans to leave his wife for her. A wife who learned of it would have cause for jealousy.",
  "motive.julian-edmund-inheritance.title": "Draft will",
  "motive.julian-edmund-inheritance.text": "A draft of a new will, in which Lord Edmund cuts his son Julian out of the inheritance entirely.",
  "motive.julian-edmund-debt.title": "Bookmaker's demand",
  "motive.julian-edmund-debt.text": "A bookmaker's demand for an unpaid debt. Lord Edmund refused to pay it, and the bookmaker is losing patience. Debt of this kind does not wait.",
  "motive.beatrice-edmund-revenge.title": "Cheque stub",
  "motive.beatrice-edmund-revenge.text": "A cheque stub in Lord Edmund's hand, for money paid to Miss Beatrice's fiancé to make him disappear. Revenge is the natural result of such a wrong.",
  "motive.penrose-edmund-exposure.title": "Draft complaint",
  "motive.penrose-edmund-exposure.text": "A draft complaint from Lord Edmund to the Medical Council, reporting Dr Penrose. If the complaint were sent, Dr Penrose would be exposed before his profession.",
  "motive.violet-edmund-exposure.title": "Agency's reply",
  "motive.violet-edmund-exposure.text": "A reply from an employment agency to Lord Edmund. It shows that Miss Marsh's references were forged, and that Lord Edmund has found it out. Exposure is the danger here.",
  "motive.forsythe-edmund-debt.title": "Promissory note",
  "motive.forsythe-edmund-debt.text": "A promissory note for a ruinous sum, falling due on New Year's Day. Colonel Forsythe has no means of meeting it. A debt that cannot be met is a debt that breaks a man.",
  "motive.finch-edmund-revenge.title": "Notice of dismissal",
  "motive.finch-edmund-revenge.text": "A notice dismissing Mr Finch after thirty years' service, with no pension. Thirty years is a long time to remember a thing like that. Revenge is the word for it.",
  "motive.finch-edmund-inheritance.title": "Cancelled codicil",
  "motive.finch-edmund-inheritance.text": "A codicil to the will, with the legacy to Mr Finch struck through in a firm hand. The codicil was to have given him something, and now it gives him nothing. Inheritance, plainly.",

  "motive.edmund-penrose-blackmail.title": "Demand in Penrose's hand",
  "motive.edmund-penrose-blackmail.text": "A demand written by Dr Penrose, concerning a child in Leeds. He knew the child's story, and he was paid to keep quiet about it. That is blackmail, in plain terms.",
  "motive.margaret-penrose-blackmail.title": "Pawn ticket",
  "motive.margaret-penrose-blackmail.text": "A pawn ticket for Lady Margaret's pearls, with a note in Dr Penrose's hand. He knew the pearls were pawned, and he used that knowledge against her. That is blackmail.",
  "motive.julian-penrose-blackmail.title": "The forged cheque",
  "motive.julian-penrose-blackmail.text": "A cheque in Julian's hand, forged, and held by Dr Penrose. The doctor held it over Julian as a threat. That is blackmail, plainly.",
  "motive.beatrice-penrose-revenge.title": "Certificate",
  "motive.beatrice-penrose-revenge.text": "A certificate signed by Dr Penrose, sending Miss Beatrice to a rest home for a year. A year of that is not easily forgiven. Revenge is the natural result.",
  "motive.violet-penrose-blackmail.title": "Newspaper clipping",
  "motive.violet-penrose-blackmail.text": "A newspaper clipping with a sum pencilled on it. Dr Penrose recognised Miss Marsh from another name and another town, and set a price on his silence. That is blackmail.",
  "motive.forsythe-penrose-exposure.title": "Manuscript chapter",
  "motive.forsythe-penrose-exposure.text": "A chapter from Dr Penrose's memoir, telling what Colonel Forsythe really did at Loos. The memoir was to expose the Colonel. That is exposure, plainly.",
  "motive.finch-penrose-revenge.title": "Inquest report",
  "motive.finch-penrose-revenge.text": "An inquest report on the death of Mrs Finch, who died under Dr Penrose's care. Mr Finch did not forget it. Revenge is the natural result of such a loss.",

  "motive.edmund-forsythe-revenge.title": "Engineer's report",
  "motive.edmund-forsythe-revenge.text": "An engineer's report on the Colonel's mining venture, which proves to be a swindle. Lord Edmund has just learned it, and he has cause for revenge.",
  "motive.margaret-forsythe-exposure.title": "One of the letters",
  "motive.margaret-forsythe-exposure.text": "One of Lady Margaret's old letters, kept by Colonel Forsythe, who meant to use it against her. That is exposure, plainly.",
  "motive.julian-forsythe-debt.title": "The IOUs",
  "motive.julian-forsythe-debt.text": "A bundle of IOUs in Julian's hand, all of them in the Colonel's pocket-book. The debt is Julian's, and the Colonel holds it.",
  "motive.beatrice-forsythe-revenge.title": "Court-martial letter",
  "motive.beatrice-forsythe-revenge.text": "A letter concerning a court-martial. Miss Beatrice's fiancé was tried because of the Colonel's doing. Revenge is the natural result of such a wrong.",
  "motive.penrose-forsythe-exposure.title": "Copy of a certificate",
  "motive.penrose-forsythe-exposure.text": "A copy of a death certificate that Dr Penrose falsified, and that Colonel Forsythe knew about. The Colonel could expose the doctor. That is exposure, plainly.",
  "motive.violet-forsythe-inheritance.title": "Birth certificate",
  "motive.violet-forsythe-inheritance.text": "A birth certificate naming Miss Violet Marsh as the Colonel's daughter, which he never acknowledged. She is named in his will. That is inheritance, plainly.",
  "motive.finch-forsythe-blackmail.title": "Prison discharge",
  "motive.finch-forsythe-blackmail.text": "A prison discharge paper for Mr Finch, concerning his prison record. Colonel Forsythe knew of it and held it over him. That is blackmail, plainly.",

  // Bonds: public dossier lines
  "bond.margaret-julian.public": "Lady Margaret is Julian's mother, and he is her favourite child.",
  "bond.margaret-beatrice.public": "Lady Margaret is Beatrice's mother.",
  "bond.beatrice-julian.public": "Beatrice has always covered for her brother Julian.",
  "bond.finch-margaret.public": "Mr Finch is loyal to Lady Margaret, as a retainer is to his mistress.",
  "bond.forsythe-edmund.public": "The Colonel owes Lord Edmund his life, from the war.",

  // Bonds: secret documents
  "bond.penrose-margaret.title": "Unsent letter",
  "bond.penrose-margaret.text": "A letter from Dr Penrose to Lady Margaret, never sent. It confesses a devotion of twenty years, never spoken. He has kept it to himself all this time, and he would lie to shield her.",
  "bond.violet-julian.title": "Love note",
  "bond.violet-julian.text": "A love note between Miss Marsh and Julian. The two are secretly engaged. Each would lie to protect the other.",

  // Secret errand traces
  "secret.edmund.trace": "A scrap of paper with a telephone number on it, and the name of a solicitor.",
  "secret.margaret.trace": "A paste pearl, dropped and not picked up.",
  "secret.julian.trace": "Fresh scratches on the dial of a safe, as if someone had turned it again and again.",
  "secret.beatrice.trace": "A strap from a travelling bag, caught on the edge of a chair.",
  "secret.penrose.trace": "A glass dropper with a little laudanum still on its rim.",
  "secret.violet.trace": "A sheet of carbon paper, creased and smudged with ink.",
  "secret.forsythe.trace": "A ragged stub at the edge of a book, where a page has been cut away.",
  "secret.finch.trace": "A port glass, rinsed and set back, with a dark ring at its foot.",

  // Body
  "body.wound.blunt": "The wound was to the back of the head, and the blow was heavy.",
  "body.wound.blade": "The wound was narrow and deep, made by something with an edge.",
  "body.wound.ligature": "There are marks about the neck, the width of a thin cord.",
  "body.tod.exact": "Death came at {time}, by the doctor's reckoning.",
  "body.tod.window": "Death came between {from} and {to}, by the doctor's reckoning.",

  // Motive type labels
  "motiveType.inheritance": "Inheritance",
  "motiveType.jealousy": "Jealousy",
  "motiveType.revenge": "Revenge",
  "motiveType.debt": "Debt",
  "motiveType.blackmail": "Blackmail",
  "motiveType.exposure": "Exposure",

  // Time slots inside a sentence
  "slot.0.inline": "nine o'clock",
  "slot.1.inline": "half past nine",
  "slot.2.inline": "ten o'clock",
  "slot.3.inline": "half past ten",
  "slot.4.inline": "eleven o'clock",
  "slot.5.inline": "half past eleven",
};
