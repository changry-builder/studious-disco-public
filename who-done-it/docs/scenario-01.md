# Scenario 01: Blackthorn Hall

The first hand-written scenario. Everything in the tables below is a **fact the engine depends on**. It becomes `src/scenarios/blackthorn/facts.ts`. Changing any of it changes generated cases, so it needs the lead architect's sign-off and a `GEN_VERSION` bump.

The prose around the tables is guidance for `content-writer`, who writes the display text in `text.ts` and must not contradict a table.

- Scenario id: `blackthorn`. Index: `0`.
- Setting: Blackthorn Hall, a country house in the North Riding of Yorkshire. New Year's Eve, 1926. Snow since the afternoon; the drive is impassable and the telephone line to the village still works.
- The household gathers in the Great Hall for the midnight toast. One of them does not come. The body is found moments later.

## Time slots

| Id | Label |
|---|---|
| 0 | 9:00 pm |
| 1 | 9:30 pm |
| 2 | 10:00 pm |
| 3 | 10:30 pm |
| 4 | 11:00 pm |
| 5 | 11:30 pm |

Dinner ends at nine. Each slot is the half-hour starting at its label.

## Rooms

`proofSpot` is where a presence record for that room is found when the generator needs one (see `case-engine.md`, items of kind `presence`). The "record" column says what that record is in the fiction.

| Id | Name | Adjacent (map only) | Spots | proofSpot | Presence record |
|---|---|---|---|---|---|
| `hall` | Great Hall | drawing, dining, library, study, gallery | `telephone-table`, `coat-stand`, `long-case-clock` | `telephone-table` | exchange slip for a trunk call, timed and named |
| `drawing` | Drawing Room | hall, conservatory | `fireplace`, `card-table`, `piano` | `card-table` | bridge score sheet, initialled and timed |
| `dining` | Dining Room | hall, kitchen | `sideboard`, `table` | `sideboard` | decanter book, signed and timed |
| `library` | Library | hall, study | `reading-desk`, `shelves`, `globe` | `reading-desk` | lending ledger entry |
| `study` | Study | hall, library | `desk`, `safe`, `wastepaper-basket` | `desk` | the master's appointment diary |
| `billiard` | Billiard Room | gallery | `table`, `cue-rack`, `drinks-cabinet` | `cue-rack` | marker's score book |
| `conservatory` | Conservatory | drawing | `potting-bench`, `tool-cabinet`, `wicker-chairs` | `potting-bench` | hothouse log, initialled at each stoking |
| `kitchen` | Kitchen | dining, cellar | `range`, `pantry`, `bell-board` | `bell-board` | cook's slate of bells answered |
| `cellar` | Wine Cellar | kitchen | `racks`, `crates` | `racks` | cellar book |
| `gallery` | Long Gallery | hall, billiard | `window-seat`, `portraits`, `linen-chest` | `window-seat` | housemaid's fire-lighting chit |

## Cast

Eight people. Three may be the victim: `edmund`, `penrose`, `forsythe`.

| Id | Name | Age | Role | One line | Secret errand (room / evidence spot) |
|---|---|---|---|---|---|
| `edmund` | Lord Edmund Blackthorn | 68 | Master of the house | Made his money in coal and his enemies at home | Telephoning his solicitor in secret (`hall` / `telephone-table`) |
| `margaret` | Lady Margaret Blackthorn | 61 | His wife | Runs the house and forgives nothing | Swapping her pearls for paste copies (`gallery` / `portraits`) |
| `julian` | Julian Blackthorn | 34 | Son and heir | Charming, idle, and in debt | Trying the combination of his father's safe (`study` / `safe`) |
| `beatrice` | Beatrice Blackthorn | 29 | Daughter | Sharp, watchful, planning to leave | Hiding a packed valise (`conservatory` / `wicker-chairs`) |
| `penrose` | Dr Arthur Penrose | 55 | Family physician | Knows every ailment in the county, and what each is worth | At the laudanum in the medicine store (`kitchen` / `pantry`) |
| `violet` | Miss Violet Marsh | 27 | Lord Edmund's secretary | Efficient, new, and not who her references say | Copying papers from the desk (`study` / `desk`) |
| `forsythe` | Colonel Hugh Forsythe | 63 | Old comrade and business partner | A war hero, by his own account | Cutting a page from the regimental history (`library` / `shelves`) |
| `finch` | Mr Thomas Finch | 58 | Butler | Thirty years of service and a long memory | Drinking the 1908 port (`cellar` / `racks`) |

## Bonds

`from` would lie to protect `to`. Secret bonds need a document the player can find.

| From | To | Public | Why | Document (room / spot) |
|---|---|---|---|---|
| `margaret` | `julian` | yes | mother and favourite child | |
| `margaret` | `beatrice` | yes | mother and daughter | |
| `beatrice` | `julian` | yes | sister who has always covered for him | |
| `finch` | `margaret` | yes | a retainer's loyalty to his mistress | |
| `forsythe` | `edmund` | yes | owes him his life from the war | |
| `penrose` | `margaret` | no | a devotion of twenty years, never spoken | unsent letter (`conservatory` / `potting-bench`) |
| `violet` | `julian` | no | secretly engaged | love note (`gallery` / `linen-chest`) |
| `julian` | `violet` | no | secretly engaged | the same love note (`gallery` / `linen-chest`) |

## Weapons

Three wound classes. No firearms and no poison in this scenario (see `case-engine.md`, future extensions).

| Id | Name | Class | Home (room / spot) | Access |
|---|---|---|---|---|
| `poker` | Fire poker | blunt | `drawing` / `fireplace` | anyone |
| `candlestick` | Bronze candlestick | blunt | `dining` / `sideboard` | anyone |
| `bookend` | Marble bookend | blunt | `library` / `shelves` | anyone |
| `letter-opener` | Silver letter opener | blade | `study` / `desk` | anyone |
| `carving-knife` | Carving knife | blade | `kitchen` / `pantry` | anyone |
| `pruning-knife` | Pruning knife | blade | `conservatory` / `tool-cabinet` | `margaret`, `finch` (the cabinet is locked; they hold the keys) |
| `curtain-cord` | Curtain cord | ligature | `gallery` / `window-seat` | anyone |
| `picture-wire` | Picture wire | ligature | `cellar` / `crates` | anyone |

## Motives

Motive types: `inheritance`, `jealousy`, `revenge`, `debt`, `blackmail` (the victim was blackmailing the suspect), `exposure` (the victim was about to expose the suspect).

Link id format: `<suspect>-<victim>-<type>`. In any one case only some links are "activated": the killer's, plus red herrings. Only activated links have their document placed. The others are not true in that telling of the evening.

### If Lord Edmund is the victim

| Suspect | Type | The story | Document (room / spot) |
|---|---|---|---|
| `margaret` | jealousy | He meant to leave her for a woman in London | his letters to the woman (`gallery` / `linen-chest`) |
| `julian` | inheritance | A new will cuts Julian out | draft will (`study` / `safe`) |
| `julian` | debt | Edmund refused to pay his bookmaker, who is losing patience | bookmaker's demand (`billiard` / `drinks-cabinet`) |
| `beatrice` | revenge | Edmund paid her fiancé to disappear | cheque stub (`library` / `reading-desk`) |
| `penrose` | exposure | Edmund was reporting him to the Medical Council | draft of the complaint (`study` / `wastepaper-basket`) |
| `violet` | exposure | Edmund had found her references were forged | agency's reply (`hall` / `coat-stand`) |
| `forsythe` | debt | A ruinous note falls due on New Year's Day | promissory note (`study` / `desk`) |
| `finch` | revenge | Dismissed after thirty years, with no pension | notice of dismissal (`kitchen` / `pantry`) |
| `finch` | inheritance | The new will strikes out his legacy | cancelled codicil (`library` / `shelves`) |

### If Dr Penrose is the victim

| Suspect | Type | The story | Document (room / spot) |
|---|---|---|---|
| `edmund` | blackmail | Penrose knew of a child in Leeds and was paid to forget | demand, in Penrose's hand (`study` / `safe`) |
| `margaret` | blackmail | He knew her pearls were pawned | pawn ticket with his note (`gallery` / `portraits`) |
| `julian` | blackmail | He held a cheque Julian forged | the forged cheque (`billiard` / `cue-rack`) |
| `beatrice` | revenge | He signed the certificate that sent her to a "rest home" for a year | the certificate (`library` / `globe`) |
| `violet` | blackmail | He recognised her from another name and another town | newspaper clipping with a sum pencilled on it (`hall` / `telephone-table`) |
| `forsythe` | exposure | His memoir tells what the Colonel really did at Loos | manuscript chapter (`library` / `shelves`) |
| `finch` | revenge | Mrs Finch died under his care | inquest report (`kitchen` / `range`) |

### If Colonel Forsythe is the victim

| Suspect | Type | The story | Document (room / spot) |
|---|---|---|---|
| `edmund` | revenge | The Colonel's mining venture was a swindle, and Edmund has just learned it | engineer's report (`study` / `desk`) |
| `margaret` | exposure | He kept her old letters and meant to use them | one of the letters (`drawing` / `piano`) |
| `julian` | debt | Julian's IOUs are all in the Colonel's pocket-book | the IOUs (`billiard` / `table`) |
| `beatrice` | revenge | Her fiancé's court-martial was the Colonel's doing | court-martial letter (`gallery` / `window-seat`) |
| `penrose` | exposure | The Colonel knew of a death certificate he falsified | copy of the certificate (`conservatory` / `wicker-chairs`) |
| `violet` | inheritance | She is his unacknowledged daughter and named in his will | birth certificate (`hall` / `long-case-clock`) |
| `finch` | blackmail | He knew of Finch's prison record | prison discharge paper (`cellar` / `crates`) |

## Validation checklist

`validateScenario` must pass on this data. By hand:
- 10 rooms, which is at least the hard suspect count (6) plus 3.
- Each victim has 7 suspects with at least one link (the rule needs 4).
- No suspect has two links of the same type against one victim.
- Every wound class has at least 2 weapons (blunt 3, blade 3, ligature 2).
- Every secret bond has a document. Every document spot exists in its room.
- Every character has a secret errand, so anyone can be the secret-keeper.

## Notes for content-writer

- Briefings: write one per victim (three in all), about 80 words, ending with the body being found at the midnight toast. Do not state the time or cause of death. The engine supplies those as clues.
- Each character needs: a bio (60 words or fewer), statement templates in their voice, crack lines, and a confession line for their secret errand. Keys and limits are in `content-style-guide.md`.
- Each weapon needs three short descriptions: in place and clean; missing from its place; found elsewhere (one clean version, one used version).
- Each motive document and bond document needs a title and a text of 50 words or fewer that makes the "story" column plain.
- Each room needs a description (40 words or fewer), a line for each empty spot, and wording for its presence record that takes `{name}` and `{time}`.
