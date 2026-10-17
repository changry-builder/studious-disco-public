// Pictures for the School supplies "Picture sprint" game.
// Images are Twemoji (CC BY 4.0, https://github.com/jdecked/twemoji), stored in img/supplies/<img>.svg.
//
// tier: 1 = everyday, 2 = classroom, lab and gym, 3 = harder to name.
// aka:  other names that count as right.

const SUPPLY_PICTURES = [
  // ---------- Tier 1 ----------
  { name: "Pencil", tier: 1, img: "270f", aka: ["Pencils", "Graphite pencil"] },
  { name: "Pen", tier: 1, img: "1f58a", aka: ["Ballpoint", "Ballpoint pen", "Biro", "Pens"] },
  { name: "Crayon", tier: 1, img: "1f58d", aka: ["Crayons", "Wax crayon"] },
  { name: "Ruler", tier: 1, img: "1f4cf", aka: ["Rule", "Straightedge", "Measuring stick"] },
  { name: "Scissors", tier: 1, img: "2702", aka: ["Scissor", "Pair of scissors"] },
  { name: "Paper clip", tier: 1, img: "1f4ce", aka: ["Paperclip", "Clip"] },
  { name: "Backpack", tier: 1, img: "1f392", aka: ["Rucksack", "Bookbag", "Book bag", "School bag", "Schoolbag", "Bag", "Knapsack"] },
  { name: "Folder", tier: 1, img: "1f4c1", aka: ["File folder", "File"] },
  { name: "Books", tier: 1, img: "1f4da", aka: ["Book", "Textbooks", "Textbook", "Stack of books", "Pile of books"] },
  { name: "Apple", tier: 1, img: "1f34e", aka: ["Red apple"] },
  { name: "School bus", tier: 1, img: "1f68c", aka: ["Bus"] },
  { name: "Laptop", tier: 1, img: "1f4bb", aka: ["Laptop computer", "Notebook computer", "Chromebook"] },
  { name: "Alarm clock", tier: 1, img: "23f0", aka: ["Clock", "Alarm"] },
  { name: "Bell", tier: 1, img: "1f514", aka: ["School bell"] },
  { name: "Headphones", tier: 1, img: "1f3a7", aka: ["Headphone", "Headset", "Earphones"] },
  { name: "Calendar", tier: 1, img: "1f4c5", aka: ["Date"] },
  { name: "Basketball", tier: 1, img: "1f3c0", aka: ["Basket ball"] },
  { name: "Soccer ball", tier: 1, img: "26bd", aka: ["Soccer", "Football"] },
  { name: "Chair", tier: 1, img: "1fa91", aka: ["Seat", "Wooden chair"] },
  { name: "Trophy", tier: 1, img: "1f3c6", aka: ["Cup", "Trophy cup"] },
  { name: "Light bulb", tier: 1, img: "1f4a1", aka: ["Lightbulb", "Bulb"] },
  { name: "Juice box", tier: 1, img: "1f9c3", aka: ["Juice", "Drink box", "Juice carton", "Carton"] },

  // ---------- Tier 2 ----------
  { name: "Paintbrush", tier: 2, img: "1f58c", aka: ["Paint brush", "Brush"] },
  { name: "Thumbtack", tier: 2, img: "1f4cc", aka: ["Thumb tack", "Drawing pin", "Push pin", "Pushpin", "Pin", "Tack"] },
  { name: "Notebook", tier: 2, img: "1f4d3", aka: ["Composition book", "Composition notebook", "Exercise book"] },
  { name: "Notepad", tier: 2, img: "1f5d2", aka: ["Spiral notepad", "Note pad", "Memo pad", "Spiral notebook", "Writing pad"] },
  { name: "Clipboard", tier: 2, img: "1f4cb", aka: ["Clip board"] },
  { name: "Microscope", tier: 2, img: "1f52c", aka: ["Microscopes"] },
  { name: "Test tube", tier: 2, img: "1f9ea", aka: ["Testtube", "Test tubes", "Vial"] },
  { name: "Magnifying glass", tier: 2, img: "1f50d", aka: ["Magnifier", "Hand lens", "Magnifying lens"] },
  { name: "Bookmark", tier: 2, img: "1f516", aka: ["Book mark"] },
  { name: "Paint palette", tier: 2, img: "1f3a8", aka: ["Palette", "Artist's palette", "Artists palette", "Paints"] },
  { name: "Computer", tier: 2, img: "1f5a5", aka: ["Desktop", "Desktop computer", "Monitor", "PC"] },
  { name: "Keyboard", tier: 2, img: "2328", aka: ["Computer keyboard"] },
  { name: "Computer mouse", tier: 2, img: "1f5b1", aka: ["Mouse"] },
  { name: "Magnet", tier: 2, img: "1f9f2", aka: ["Horseshoe magnet"] },
  { name: "Telescope", tier: 2, img: "1f52d", aka: ["Telescopes"] },
  { name: "Puzzle", tier: 2, img: "1f9e9", aka: ["Puzzle piece", "Jigsaw", "Jigsaw piece", "Jigsaw puzzle"] },
  { name: "Hourglass", tier: 2, img: "231b", aka: ["Sand timer", "Egg timer", "Sandglass"] },
  { name: "Teacher", tier: 2, img: "1f9d1-200d-1f3eb", aka: ["Teachers", "Professor"] },
  { name: "School", tier: 2, img: "1f3eb", aka: ["School building", "Schoolhouse"] },
  { name: "American football", tier: 2, img: "1f3c8", aka: ["Football", "Rugby ball"] },
  { name: "Volleyball", tier: 2, img: "1f3d0", aka: ["Volley ball"] },
  { name: "Tennis ball", tier: 2, img: "1f3be", aka: ["Tennis"] },
  { name: "Trash can", tier: 2, img: "1f5d1", aka: ["Trash", "Bin", "Wastebasket", "Waste basket", "Garbage can", "Trash bin", "Wastepaper basket", "Rubbish bin"] },
  { name: "Megaphone", tier: 2, img: "1f4e3", aka: ["Bullhorn", "Loudspeaker", "Cheer megaphone"] },
  { name: "Lunch box", tier: 2, img: "1f371", aka: ["Lunchbox", "Bento", "Bento box", "Lunch"] },

  // ---------- Tier 3 ----------
  { name: "Set square", tier: 3, img: "1f4d0", aka: ["Setsquare", "Triangle", "Triangle ruler", "Triangular ruler", "Drafting triangle"] },
  { name: "Abacus", tier: 3, img: "1f9ee", aka: ["Counting frame"] },
  { name: "Safety goggles", tier: 3, img: "1f97d", aka: ["Goggles", "Lab goggles", "Safety glasses"] },
  { name: "Petri dish", tier: 3, img: "1f9eb", aka: ["Petri", "Culture dish"] },
  { name: "Lab coat", tier: 3, img: "1f97c", aka: ["Labcoat", "White coat", "Laboratory coat"] },
  { name: "Floppy disk", tier: 3, img: "1f4be", aka: ["Floppy", "Floppy disc", "Diskette", "Save icon"] },
  { name: "Ball of yarn", tier: 3, img: "1f9f6", aka: ["Yarn", "Wool", "Ball of wool"] },
  { name: "Bar chart", tier: 3, img: "1f4ca", aka: ["Bar graph", "Chart", "Graph"] },
  { name: "Thermometer", tier: 3, img: "1f321", aka: ["Thermometers"] },
  { name: "Balance scale", tier: 3, img: "2696", aka: ["Scales", "Scale", "Balance", "Weighing scales"] },
  { name: "Battery", tier: 3, img: "1f50b", aka: ["Batteries", "Cell"] },
  { name: "Scroll", tier: 3, img: "1f4dc", aka: ["Diploma", "Parchment"] },
];

if (typeof module !== "undefined") module.exports = { SUPPLY_PICTURES };
