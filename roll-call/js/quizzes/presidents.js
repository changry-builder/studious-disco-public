// Quiz: name every US president.
//
// A quiz has `answers` (the things to name, each with the spellings that count)
// and `slots` (the board's boxes, in order). One answer can fill several slots:
// Grover Cleveland and Donald Trump each served two non-consecutive terms.
//
// Each person accepts their surname, first name + surname and full name, plus any
// extras listed. A shared surname (Adams, Harrison, Johnson, Roosevelt, Bush) fills
// in everyone who has it; a first name or initials picks just one.
//
// `short` is what the board shows: the surname, with initials where it's shared.

(function (root) {
  // [id, full name, surname, extra accepted spellings, board label if not the surname]
  const PEOPLE = [
    ["washington", "George Washington", "Washington"],
    ["jadams", "John Adams", "Adams", [], "J. Adams"],
    ["jefferson", "Thomas Jefferson", "Jefferson"],
    ["madison", "James Madison", "Madison"],
    ["monroe", "James Monroe", "Monroe"],
    // "Quincy Adams" as the surname so "John Adams" only means #2.
    ["jqadams", "John Quincy Adams", "Quincy Adams", ["Adams", "JQA"], "J. Q. Adams"],
    ["jackson", "Andrew Jackson", "Jackson"],
    ["vanburen", "Martin Van Buren", "Van Buren"],
    ["whharrison", "William Henry Harrison", "Harrison", ["William Harrison", "WH Harrison"], "W. H. Harrison"],
    ["tyler", "John Tyler", "Tyler"],
    ["polk", "James K. Polk", "Polk"],
    ["taylor", "Zachary Taylor", "Taylor"],
    ["fillmore", "Millard Fillmore", "Fillmore"],
    ["pierce", "Franklin Pierce", "Pierce"],
    ["buchanan", "James Buchanan", "Buchanan"],
    ["lincoln", "Abraham Lincoln", "Lincoln", ["Abe Lincoln"]],
    ["ajohnson", "Andrew Johnson", "Johnson", [], "A. Johnson"],
    ["grant", "Ulysses S. Grant", "Grant"],
    ["hayes", "Rutherford B. Hayes", "Hayes"],
    ["garfield", "James A. Garfield", "Garfield"],
    ["arthur", "Chester A. Arthur", "Arthur"],
    ["cleveland", "Grover Cleveland", "Cleveland"],
    ["bharrison", "Benjamin Harrison", "Harrison", ["Ben Harrison"], "B. Harrison"],
    ["mckinley", "William McKinley", "McKinley"],
    ["troosevelt", "Theodore Roosevelt", "Roosevelt", ["Teddy Roosevelt", "Teddy"], "T. Roosevelt"],
    ["taft", "William Howard Taft", "Taft"],
    ["wilson", "Woodrow Wilson", "Wilson"],
    ["harding", "Warren G. Harding", "Harding"],
    ["coolidge", "Calvin Coolidge", "Coolidge"],
    ["hoover", "Herbert Hoover", "Hoover"],
    ["froosevelt", "Franklin D. Roosevelt", "Roosevelt", ["FDR", "Franklin Delano Roosevelt"], "F. D. Roosevelt"],
    ["truman", "Harry S. Truman", "Truman"],
    ["eisenhower", "Dwight D. Eisenhower", "Eisenhower", ["Ike"]],
    ["kennedy", "John F. Kennedy", "Kennedy", ["JFK", "John Fitzgerald Kennedy"]],
    ["ljohnson", "Lyndon B. Johnson", "Johnson", ["LBJ", "Lyndon Baines Johnson"], "L. B. Johnson"],
    ["nixon", "Richard Nixon", "Nixon", ["Richard M. Nixon", "Dick Nixon"]],
    ["ford", "Gerald Ford", "Ford", ["Gerald R. Ford"]],
    ["carter", "Jimmy Carter", "Carter", ["James Carter", "James Earl Carter"]],
    ["reagan", "Ronald Reagan", "Reagan", ["Ronald W. Reagan"]],
    ["ghwbush", "George H. W. Bush", "Bush", ["H. W. Bush", "George Bush Sr", "Bush Sr", "Bush 41", "GHWB"], "G. H. W. Bush"],
    ["clinton", "Bill Clinton", "Clinton", ["William Clinton", "William Jefferson Clinton"]],
    ["gwbush", "George W. Bush", "Bush", ["W. Bush", "George Bush Jr", "Bush Jr", "Bush 43", "Dubya", "GWB"], "G. W. Bush"],
    ["obama", "Barack Obama", "Obama", ["Barack Hussein Obama"]],
    ["trump", "Donald Trump", "Trump", ["Donald J. Trump"]],
    ["biden", "Joe Biden", "Biden", ["Joseph Biden", "Joseph R. Biden"]],
  ];

  // [president number, years in office, person id]
  const TERMS = [
    [1, "1789–1797", "washington"], [2, "1797–1801", "jadams"], [3, "1801–1809", "jefferson"],
    [4, "1809–1817", "madison"], [5, "1817–1825", "monroe"], [6, "1825–1829", "jqadams"],
    [7, "1829–1837", "jackson"], [8, "1837–1841", "vanburen"], [9, "1841", "whharrison"],
    [10, "1841–1845", "tyler"], [11, "1845–1849", "polk"], [12, "1849–1850", "taylor"],
    [13, "1850–1853", "fillmore"], [14, "1853–1857", "pierce"], [15, "1857–1861", "buchanan"],
    [16, "1861–1865", "lincoln"], [17, "1865–1869", "ajohnson"], [18, "1869–1877", "grant"],
    [19, "1877–1881", "hayes"], [20, "1881", "garfield"], [21, "1881–1885", "arthur"],
    [22, "1885–1889", "cleveland"], [23, "1889–1893", "bharrison"], [24, "1893–1897", "cleveland"],
    [25, "1897–1901", "mckinley"], [26, "1901–1909", "troosevelt"], [27, "1909–1913", "taft"],
    [28, "1913–1921", "wilson"], [29, "1921–1923", "harding"], [30, "1923–1929", "coolidge"],
    [31, "1929–1933", "hoover"], [32, "1933–1945", "froosevelt"], [33, "1945–1953", "truman"],
    [34, "1953–1961", "eisenhower"], [35, "1961–1963", "kennedy"], [36, "1963–1969", "ljohnson"],
    [37, "1969–1974", "nixon"], [38, "1974–1977", "ford"], [39, "1977–1981", "carter"],
    [40, "1981–1989", "reagan"], [41, "1989–1993", "ghwbush"], [42, "1993–2001", "clinton"],
    [43, "2001–2009", "gwbush"], [44, "2009–2017", "obama"], [45, "2017–2021", "trump"],
    [46, "2021–2025", "biden"], [47, "2025–", "trump"],
  ];

  const answers = {};
  for (const [id, name, surname, extra = [], short = surname] of PEOPLE) {
    const first = name.split(" ")[0];
    answers[id] = { name, short, accept: [surname, `${first} ${surname}`, name, ...extra] };
  }

  const PRESIDENTS = {
    id: "presidents",
    title: "US Presidents",
    prompt: "Name every US president",
    noun: "presidents",
    seconds: 10 * 60,
    answers,
    slots: TERMS.map(([n, years, answer]) => ({ label: `#${n}`, sub: years, answer })),
  };

  if (typeof module === "object" && module.exports) module.exports = { PRESIDENTS };
  else (root.ROLL_CALL_QUIZZES = root.ROLL_CALL_QUIZZES || []).push(PRESIDENTS);
})(this);
