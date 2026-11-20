/* UCLA Bruins basketball, 2025-26 rosters.
 * `year` is the player's year in college during the base season (1 = freshman ... 5 = fifth year / graduate).
 * Projections assume every player stays five years, so year 5 is the last.
 * Each player is listed once, at their primary position (pos[0]); the first at each position starts.
 * `verify: true` marks details gathered from secondary sources that still need checking.
 */
(function (root) {
  const P = (id, name, num, pos, year, extra) => Object.assign({ id, name, num, pos, year }, extra);
  const seasons = [2025, 2026, 2027, 2028, 2029];

  const MEN = {
    id: "ucla-m",
    sport: "basketball",
    name: "UCLA Bruins (Men)",
    short: "UCLA Men",
    baseSeason: 2025,
    seasons,
    asOf: "2025-26 roster",
    players: [
      P("dent", "Donovan Dent", 2, ["PG"], 4, { ht: "6-2", from: "New Mexico" }),
      P("perry", "Trent Perry", 0, ["SG", "PG"], 2, { ht: "6-4", from: "USC" }),
      P("clark", "Skyy Clark", 55, ["SG", "PG"], 4, { ht: "6-3", from: "Louisville" }),
      P("dailey", "Eric Dailey Jr.", 3, ["SF", "PF"], 3, { ht: "6-8" }),
      P("bilodeau", "Tyler Bilodeau", 34, ["PF"], 4, { ht: "6-9", from: "Oregon State" }),
      P("booker", "Xavier Booker", 1, ["C", "PF"], 3, { ht: "6-11", from: "Michigan State" }),
      P("brown", "Jamar Brown", 4, ["SF", "SG"], 5, { from: "UMKC" }),
      P("jamerson", "Steven Jamerson II", 24, ["PF", "C"], 4, { from: "San Diego" }),
      P("bwilliams", "Brandon Williams", 5, ["SG"], 2),
      P("freeny", "Eric Freeny", 8, ["PG", "SG"], 1),
      P("peoples", "Anthony Peoples Jr.", 23, ["PG"], 5, { note: "Redshirt senior" }),
      P("horry", "Christian Horry", 7, ["SG"], 1),
      P("seidler", "Jack Seidler", 30, ["SG"], 4, { note: "Redshirt junior" }),
      P("alston", "Markell Alston", 21, ["SF"], 1, { verify: true }),
      P("jovic", "Filip Jovic", null, ["PF", "C"], 1, { verify: true }),
    ],
    depth: {
      PG: ["dent", "peoples", "freeny"],
      SG: ["perry", "clark", "bwilliams", "horry", "seidler"],
      SF: ["dailey", "brown", "alston"],
      PF: ["bilodeau", "jamerson", "jovic"],
      C: ["booker"],
    },
  };

  const WOMEN = {
    id: "ucla-w",
    sport: "basketball",
    name: "UCLA Bruins (Women)",
    short: "UCLA Women",
    baseSeason: 2025,
    seasons,
    asOf: "2025-26 roster (national champions)",
    players: [
      P("rice", "Kiki Rice", 1, ["PG"], 4, { ht: "5-11" }),
      P("karamouzi", "Christina Karamouzi", 3, ["PG", "SG"], 1),
      P("legerwalker", "Charlisse Leger-Walker", 5, ["SG", "PG"], 5, { ht: "5-10", from: "Washington State" }),
      P("aarnisalo", "Elina Aarnisalo", 7, ["SG"], 2, { verify: true }),
      P("kneepkens", "Gianna Kneepkens", 8, ["SG"], 4, { ht: "6-0", from: "Utah" }),
      P("bilic", "Lena Bilić", 9, ["SF", "SG"], 1, { ht: "6-3" }),
      P("jaquez", "Gabriela Jaquez", 11, ["SF"], 4, { ht: "6-0" }),
      P("sbetts", "Sienna Betts", 16, ["PF", "C"], 1, { ht: "6-4" }),
      P("gardiner", "Timea Gardiner", 30, ["PF"], 5, { ht: "6-3", from: "Oregon State" }),
      P("dugalic", "Angela Dugalić", 32, ["PF", "SF"], 5, { ht: "6-4", from: "Oregon" }),
      P("muse", "Amanda Muse", 33, ["C"], 2, { ht: "6-4" }),
      P("lbetts", "Lauren Betts", 51, ["C"], 4, { ht: "6-7", from: "Stanford" }),
      P("grant", "Megan Grant", null, ["SF", "PF"], 4, { verify: true }),
    ],
    depth: {
      PG: ["rice", "karamouzi"],
      SG: ["kneepkens", "legerwalker", "aarnisalo"],
      SF: ["jaquez", "bilic", "grant"],
      PF: ["gardiner", "dugalic", "sbetts"],
      C: ["lbetts", "muse"],
    },
  };

  root.DC_TEAMS = root.DC_TEAMS || {};
  root.DC_TEAMS["ucla-m"] = MEN;
  root.DC_TEAMS["ucla-w"] = WOMEN;
  if (typeof module !== "undefined") module.exports = { MEN, WOMEN };
})(typeof window !== "undefined" ? window : globalThis);
