# Content style guide

For `content-writer` and anyone else writing words the player reads. The engine decides every fact. You decide how it sounds.

## The one rule

**Text never carries a fact the engine did not give it.** Who was where, when, with whom, what was found, who owns what: all of that arrives through placeholders. If a sentence would still be informative with its placeholders removed, it is carrying a fact. Rewrite it.

- Allowed: "I was in {room}, {company}. One loses track of the hour over a decent brandy."
- Not allowed: "I was in {room}, {company}. I heard the Colonel's voice from the terrace." (invents a sighting)
- Not allowed: "I never left {room} all evening." (claims other time slots)
- Not allowed in a crack line: "Very well, I did it." (only the engine decides guilt)

If a scenario fact looks wrong or missing, report it. Do not write around it.

## Voice

- England, 1926. British spelling: colour, honour, grey, whisky.
- Dry, restrained, a little amused. Agatha Christie, not gothic horror. Nobody screams.
- No gore. "The wound was to the back of the head" is as far as it goes.
- No modern words: okay, guys, stressed, awesome, contact (as a verb), alibi used casually by servants.
- Titles as the period used them: Lord Edmund, Lady Margaret, Dr Penrose, Colonel Forsythe, Miss Marsh, Mr Finch. Family use first names for each other. Finch says "his lordship", "her ladyship", "Mr Julian", "Miss Beatrice".
- Times read as "half past ten", "a quarter to eleven". The `{time}` placeholder supplies them already written that way.

### Character voices

| Character | Sounds like |
|---|---|
| Lord Edmund | Blunt, impatient, short sentences. Treats questions as impertinence |
| Lady Margaret | Glacial and exact. Corrects the question before answering it |
| Julian | Breezy, deflecting, jokes when nervous |
| Beatrice | Clipped and observant. Says less than she knows |
| Dr Penrose | Smooth and clinical. Latin now and then |
| Miss Marsh | Precise, careful, answers exactly what was asked |
| Colonel Forsythe | Hearty, rambling, everything reminds him of the regiment |
| Mr Finch | Formal and discreet. "If I may say so, sir" |

The player is addressed as "Inspector".

## Placeholders

| Placeholder | Becomes |
|---|---|
| `{room}` | "the library" (lower case, with article) |
| `{time}` | "half past ten" |
| `{company}` | "with Miss Beatrice", "with Dr Penrose and the Colonel" (already in the speaker's form of address; includes the word "with") |
| `{name}` | a person's display name |
| `{weapon}` | "the fire poker" |
| `{spot}` | "the fireplace" |

Use only the placeholders listed for each key. A test fails on any unfilled or unknown placeholder.

## Text keys and limits

Limits are in characters for lines and in words for longer text. Count them and report the counts.

| Key | What | Placeholders | Limit | Variants |
|---|---|---|---|---|
| `scenario.title`, `scenario.blurb` | name and one-line pitch | none | 40 chars / 25 words | 1 |
| `briefing.<victim>` | case opening for each possible victim | none | 80 words | 1 |
| `char.<id>.name`, `.role`, `.line` | display name, role, one-liner | none | 30 / 30 / 80 chars | 1 |
| `char.<id>.bio` | dossier text | none | 60 words | 1 |
| `char.<id>.address.<otherId>` | how this speaker refers to another person | none | 30 chars | 1 |
| `char.<id>.claim.alone` | statement when alone | `{room}`, `{time}` | 140 chars | 3 |
| `char.<id>.claim.with` | statement with company | `{room}`, `{time}`, `{company}` | 140 chars | 3 |
| `char.<id>.firm` | reply to a press that fails | none | 100 chars | 2 |
| `char.<id>.crack` | withdrawing a statement, before the new one | none | 120 chars | 2 |
| `char.<id>.confess` | secret-keeper owning up to the errand; the new statement follows | none | 160 chars | 1 |
| `char.<id>.retractVouch` | a shield admitting the other person was not there | `{name}` | 140 chars | 1 |
| `room.<id>.name`, `.desc` | room name and description | none | 24 chars / 40 words | 1 |
| `room.<id>.spot.<spot>.name` | spot name | none | 24 chars | 1 |
| `room.<id>.spot.<spot>.empty` | searching a spot with nothing in it | none | 100 chars | 1 |
| `room.<id>.proof` | the presence record | `{name}`, `{time}` | 160 chars | 1 |
| `weapon.<id>.name` | weapon name | none | 24 chars | 1 |
| `weapon.<id>.inPlace` | found clean in its place | `{spot}` | 120 chars | 1 |
| `weapon.<id>.missing` | its place is empty | `{spot}` | 120 chars | 1 |
| `weapon.<id>.foundClean`, `.foundUsed` | found somewhere else | `{room}`, `{spot}` | 140 chars | 1 |
| `motive.<linkId>.title`, `.text` | the motive document | none | 40 chars / 50 words | 1 |
| `bond.<from>-<to>.public` | dossier line for a public bond | none | 100 chars | 1 |
| `bond.<from>-<to>.title`, `.text` | document for a secret bond | none | 40 chars / 50 words | 1 |
| `secret.<id>.trace` | flavor clue left by a secret errand | none | 120 chars | 1 |
| `body.wound.<class>` | what examining the body shows | none | 120 chars | 1 |
| `body.tod.exact`, `body.tod.window` | time of death | `{time}` / `{from}`, `{to}` | 140 chars | 1 |
| `motiveType.<type>` | label in the accusation picker | none | 20 chars | 1 |
| `room.<id>.inline` | the room inside a sentence: "the library", "the Great Hall" | none | 30 chars | 1 |
| `room.<id>.spot.<spot>.inline` | the spot inside a sentence: "the fireplace" | none | 30 chars | 1 |
| `weapon.<id>.inline` | the weapon inside a sentence: "the fire poker" | none | 30 chars | 1 |
| `slot.<n>.inline` | the time inside a sentence, for slots 0 to 5: "nine o'clock", "half past nine" | none | 24 chars | 1 |

Notes on the tricky ones:

- **Claims.** A claim template must fit any room, any time and any company. Do not mention what the speaker was doing in a way that fixes the room ("reading", "at billiards"). Keep it to manner and voice.
- **Crack lines** are said by killers and by second liars alike, so they must suit both: flustered, caught out, never confessing to anything specific. The new statement is appended by the engine.
- **Confess lines** name the errand (it is in the cast table) and nothing else. They are said only when that person really was on that errand.
- **Motive and bond documents** are the one place you state story facts, and those facts are fixed by the "story" column in `scenario-01.md`. A document must make its motive type unmistakable. It must not name a time or a room.
- **Weapon `foundUsed`** must make clear it was the weapon used, without detail.
- **`secret.<id>.trace`** shows someone was at the errand. It must not say when.

## File format

`src/scenarios/blackthorn/text.ts` exports one flat object. A key with one variant is a string; a key with several is an array of strings.

```ts
export const text: Record<string, string | string[]> = {
  "scenario.title": "Blackthorn Hall",
  "char.finch.claim.alone": ["I was in {room} at {time}, sir. Alone.", "...", "..."],
};
```

The `{room}`, `{spot}`, `{weapon}` and `{time}` placeholders are filled from the `.inline` keys. `{company}` is built from the speaker's `char.<id>.address.<otherId>` entries, joined with commas and "and", after the word "with" supplied by your template (write "... {company} ..." where `{company}` already reads "with Miss Beatrice and the Colonel", or "alone" is never passed: the `claim.alone` template is used instead). `{name}` is the `char.<id>.name` of the person meant.

## Process

1. Read `scenario-01.md` fully. List the facts you will rely on.
2. Write into `src/scenarios/blackthorn/text.ts` only.
3. Run the text tests.
4. Report: keys written, the count for each against its limit, and anything in the scenario that seemed inconsistent.
