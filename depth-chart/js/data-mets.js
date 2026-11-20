/* New York Mets, 2026 Opening Day (set March 25, 2026).
 * Contract fields, all seasons inclusive:
 *   guaranteed  last season of a signed, guaranteed deal
 *   control     last season under team control (pre-arb/arbitration), when longer than the deal
 *   options     seasons that are club options
 *   optOuts     seasons after which the player may opt out
 *   roster      "26" (active), "40" (40-man, optioned), "IL" (injured list)
 * `verify: true` marks details gathered from secondary sources that still need checking.
 */
(function (root) {
  const P = (id, name, pos, extra) => Object.assign({ id, name, pos, roster: "26" }, extra);
  const METS = {
    id: "mets",
    sport: "baseball",
    name: "New York Mets",
    short: "Mets",
    baseSeason: 2026,
    seasons: [2026, 2027, 2028, 2029, 2030, 2031],
    asOf: "2026 Opening Day roster (March 26, 2026)",
    players: [
      // Starting pitchers
      P("peralta", "Freddy Peralta", ["SP"], { throws: "R", guaranteed: 2026 }),
      P("senga", "Kodai Senga", ["SP"], { num: 34, throws: "R", guaranteed: 2027, options: [2028], verify: true }),
      P("holmes", "Clay Holmes", ["SP", "RP"], { num: 35, throws: "R", guaranteed: 2027, optOuts: [2026] }),
      P("manaea", "Sean Manaea", ["SP", "RP"], { num: 59, throws: "L", guaranteed: 2027 }),
      P("peterson", "David Peterson", ["SP"], { num: 23, throws: "L", control: 2027 }),
      P("mclean", "Nolan McLean", ["SP"], { num: 26, throws: "R", control: 2031 }),
      // Relievers
      P("williams", "Devin Williams", ["CL", "RP"], { throws: "R", guaranteed: 2028 }),
      P("weaver", "Luke Weaver", ["SU", "RP"], { throws: "R", guaranteed: 2027 }),
      P("raley", "Brooks Raley", ["RP"], { num: 25, throws: "L", guaranteed: 2026 }),
      P("garcia", "Luis Garcia", ["RP"], { throws: "R", guaranteed: 2026, verify: true }),
      P("brazoban", "Huascar Brazoban", ["RP"], { num: 43, throws: "R", control: 2028 }),
      P("lovelady", "Richard Lovelady", ["RP"], { throws: "L", control: 2026, verify: true }),
      P("myers", "Tobias Myers", ["RP", "SP"], { throws: "R", control: 2029, verify: true }),
      // Catchers
      P("alvarez", "Francisco Alvarez", ["C"], { num: 4, bats: "R", control: 2028 }),
      P("torrens", "Luis Torrens", ["C"], { num: 13, bats: "R", control: 2027 }),
      // Infielders
      P("lindor", "Francisco Lindor", ["SS"], { num: 12, bats: "S", guaranteed: 2031 }),
      P("bichette", "Bo Bichette", ["3B", "SS"], { bats: "R", guaranteed: 2028, optOuts: [2026, 2027] }),
      P("semien", "Marcus Semien", ["2B"], { bats: "R", guaranteed: 2028 }),
      P("polanco", "Jorge Polanco", ["1B", "2B", "DH"], { bats: "S", guaranteed: 2027 }),
      P("vientos", "Mark Vientos", ["3B", "1B", "DH"], { num: 27, bats: "R", control: 2028 }),
      P("baty", "Brett Baty", ["3B", "2B"], { bats: "L", control: 2028 }),
      P("young", "Jared Young", ["1B", "DH", "LF"], { bats: "L", control: 2029, verify: true }),
      // Outfielders
      P("soto", "Juan Soto", ["LF", "RF", "DH"], { num: 22, bats: "L", guaranteed: 2039, optOuts: [2029] }),
      P("robert", "Luis Robert Jr.", ["CF"], { num: 88, bats: "R", guaranteed: 2026, options: [2027] }),
      P("benge", "Carson Benge", ["RF", "CF"], { bats: "L", control: 2031 }),
      P("taylor", "Tyrone Taylor", ["CF", "LF", "RF"], { num: 15, bats: "R", control: 2026 }),
      // Injured list
      P("minter", "A.J. Minter", ["RP"], { throws: "L", guaranteed: 2026, roster: "IL", note: "15-day IL to open 2026" }),
      // 40-man, optioned to the minors in March 2026
      P("tong", "Jonah Tong", ["SP"], { throws: "R", control: 2031, roster: "40" }),
      P("scott", "Christian Scott", ["SP"], { throws: "R", control: 2030, roster: "40" }),
      P("ross", "Dylan Ross", ["RP"], { throws: "R", control: 2031, roster: "40" }),
      P("gerber", "Joey Gerber", ["RP"], { throws: "R", control: 2028, roster: "40", verify: true }),
      P("warren", "Austin Warren", ["RP"], { throws: "R", control: 2029, roster: "40", verify: true }),
      P("pintaro", "Jonathan Pintaro", ["RP"], { throws: "R", control: 2031, roster: "40", verify: true }),
      P("senger", "Hayden Senger", ["C"], { bats: "R", control: 2030, roster: "40", verify: true }),
      P("mauricio", "Ronny Mauricio", ["3B", "SS", "2B"], { bats: "S", control: 2029, roster: "40" }),
      P("melendez", "MJ Melendez", ["LF", "RF"], { bats: "L", control: 2027, roster: "40", verify: true }),
      P("morabito", "Nick Morabito", ["CF"], { bats: "R", control: 2031, roster: "40", verify: true }),
    ],
    depth: {
      C: ["alvarez", "torrens", "senger"],
      "1B": ["polanco", "young", "vientos"],
      "2B": ["semien", "baty", "polanco"],
      "3B": ["bichette", "vientos", "baty", "mauricio"],
      SS: ["lindor", "bichette", "mauricio"],
      LF: ["soto", "taylor", "melendez"],
      CF: ["robert", "taylor", "morabito"],
      RF: ["benge", "taylor", "melendez"],
      DH: ["vientos", "young"],
      SP: ["peralta", "senga", "holmes", "mclean", "peterson", "manaea", "tong", "scott"],
      CL: ["williams", "weaver"],
      SU: ["weaver", "raley", "garcia"],
      RP: ["brazoban", "lovelady", "myers", "minter", "ross", "gerber", "warren", "pintaro"],
    },
  };
  root.DC_TEAMS = root.DC_TEAMS || {};
  root.DC_TEAMS.mets = METS;
  if (typeof module !== "undefined") module.exports = METS;
})(typeof window !== "undefined" ? window : globalThis);
