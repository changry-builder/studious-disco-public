(function (root) {
  const WTE = (root.WTE = root.WTE || {});

  // Compact row helper keeps the table readable; every entry becomes a full Cuisine object.
  function c(id, name, emoji, color, accent, pattern, blurb, tags, osmCuisine, osmExtra) {
    return { id, name, emoji, color, accent, pattern, blurb, tags, osmCuisine, osmExtra: osmExtra || [] };
  }

  const LIST = [
    c("pizza", "Pizza", "🍕", "#C62828", "#FFD54F", "dots", "Slices, crust, melty cheese.", ["european", "comfort", "quick"], ["pizza"]),
    c("italian", "Italian", "🍝", "#2E7D32", "#FFF3C4", "stripes", "Pasta, risotto, red sauce.", ["european", "comfort"], ["italian", "pasta", "trattoria", "italian_pizza"]),
    c("mexican", "Mexican", "🌮", "#BF360C", "#FFD166", "zigzag", "Tacos, burritos, fresh salsa.", ["latin", "spicy", "quick"], ["mexican", "tex-mex", "tex_mex", "tacos", "taco", "burrito"]),
    c("chinese", "Chinese", "🥟", "#AD1457", "#FFD9A0", "rings", "Dumplings, noodles, wok fire.", ["asian", "comfort"], ["chinese", "cantonese", "sichuan", "szechuan", "dim_sum", "dumpling", "dumplings", "hot_pot", "hunan", "shanghainese", "taiwanese"]),
    c("japanese", "Japanese", "🍣", "#283593", "#FFC6D0", "waves", "Sushi, ramen, izakaya bites.", ["asian", "healthy"], ["japanese", "sushi", "ramen", "izakaya", "udon", "soba", "teriyaki", "tonkatsu", "yakitori"]),
    c("korean", "Korean", "🍲", "#7B1FA2", "#FFE08A", "grid", "Barbecue, stews, kimchi kick.", ["asian", "spicy"], ["korean", "korean_bbq", "bibimbap"]),
    c("thai", "Thai", "🌶️", "#CB4B16", "#FFD166", "dots", "Curries, noodles, basil heat.", ["asian", "spicy"], ["thai"]),
    c("vietnamese", "Vietnamese", "🍜", "#00796B", "#C8F2D4", "waves", "Pho, banh mi, fresh herbs.", ["asian", "healthy"], ["vietnamese", "pho", "banh_mi"]),
    c("indian", "Indian", "🍛", "#A65E00", "#FFE08A", "zigzag", "Curries, tandoor, warm spice.", ["asian", "spicy", "veggie"], ["indian", "curry", "punjabi", "south_indian", "north_indian", "tandoori", "biryani", "pakistani", "nepalese", "bangladeshi", "sri_lankan"]),
    c("burger", "Burgers", "🍔", "#8D4B1F", "#FFCA6B", "stripes", "Stacked patties and fries.", ["american", "comfort", "quick"], ["burger", "hamburger"]),
    c("american", "American", "🌭", "#1E5FAF", "#FF9E9E", "stripes", "Diners, dogs, southern comfort.", ["american", "comfort"], ["american", "diner", "hot_dog", "soul_food", "southern", "cajun", "new_american"]),
    c("bbq", "Barbecue", "🍖", "#A33B1D", "#F6C177", "grid", "Slow smoke, ribs, brisket.", ["american", "comfort"], ["barbecue", "bbq", "smokehouse"]),
    c("steak", "Steakhouse", "🥩", "#5D2A2A", "#F4A6A6", "rings", "Seared cuts and classic sides.", ["american", "comfort"], ["steak_house", "steak", "steakhouse"]),
    c("chicken", "Chicken & wings", "🍗", "#B54708", "#FFE29A", "dots", "Fried, grilled, roasted, saucy.", ["american", "comfort", "quick"], ["chicken", "fried_chicken", "wings", "chicken_wings", "rotisserie"]),
    c("seafood", "Seafood", "🦞", "#01579B", "#8FE3F7", "waves", "Fish, shellfish, ocean fresh.", ["healthy"], ["seafood", "fish", "fish_and_chips", "oyster", "poke", "hawaiian"]),
    c("sandwich", "Sandwiches", "🥪", "#5B7A1D", "#F7E7A8", "stripes", "Subs, wraps, deli stacks.", ["american", "quick"], ["sandwich", "sub", "deli", "wrap", "wraps", "bagel"]),
    c("mediterranean", "Mediterranean", "🫒", "#00697A", "#F5E9B8", "zigzag", "Gyros, olives, sunny plates.", ["european", "healthy"], ["mediterranean", "greek", "gyro", "gyros", "cypriot"]),
    c("middle_eastern", "Middle Eastern", "🧆", "#8B2E5F", "#F9C98B", "grid", "Shawarma, falafel, mezze.", ["middle_eastern", "healthy", "veggie"], ["middle_eastern", "lebanese", "turkish", "kebab", "doner", "shawarma", "falafel", "persian", "iranian", "israeli", "arab", "syrian", "afghan"]),
    c("spanish", "Spanish & tapas", "🥘", "#B7410E", "#FFD369", "rings", "Tapas, paella, shared plates.", ["european"], ["spanish", "tapas", "paella", "portuguese"]),
    c("french", "French", "🥐", "#3F51B5", "#F8D7E8", "stripes", "Bistro classics and crepes.", ["european"], ["french", "bistro", "brasserie", "crepe", "crepes", "creperie"]),
    c("german", "German", "🥨", "#556B2F", "#F2D16B", "grid", "Pretzels, schnitzel, beer hall.", ["european", "comfort", "drinks"], ["german", "austrian", "bavarian", "schnitzel", "currywurst"], [["amenity", "biergarten"]]),
    c("caribbean", "Caribbean", "🌴", "#00838F", "#FFE066", "waves", "Jerk, plantains, island spice.", ["latin", "spicy"], ["caribbean", "jamaican", "cuban", "puerto_rican", "haitian", "dominican", "trinidadian"]),
    c("latin", "Latin American", "🫓", "#9C4221", "#FFD27D", "zigzag", "Arepas, empanadas, ceviche.", ["latin"], ["latin_american", "peruvian", "brazilian", "colombian", "venezuelan", "arepa", "arepas", "salvadoran", "argentinian", "argentine", "empanada", "empanadas"]),
    c("african", "African", "🫘", "#6D4C41", "#F6B26B", "rings", "Stews, injera, bold flavors.", ["african", "spicy"], ["african", "ethiopian", "eritrean", "nigerian", "west_african", "somali", "senegalese", "moroccan"]),
    c("veggie", "Veggie & vegan", "🥗", "#3A7D1E", "#E6FFB0", "dots", "Plant-based and fresh.", ["healthy", "veggie"], ["vegetarian", "vegan", "salad", "plant_based"]),
    c("breakfast", "Breakfast & brunch", "🍳", "#B85C00", "#FFF1A8", "stripes", "Eggs, pancakes, all-day brunch.", ["breakfast", "comfort"], ["breakfast", "brunch", "pancake", "pancakes", "waffle", "waffles"]),
    c("coffee", "Coffee & tea", "☕", "#6F4E37", "#E8CBA7", "rings", "Espresso, tea, a quiet seat.", ["drinks", "breakfast", "quick"], ["coffee_shop", "coffee", "tea", "bubble_tea", "juice", "smoothie"], [["amenity", "cafe"]]),
    c("dessert", "Sweets & ice cream", "🍦", "#C2185B", "#FFE1F0", "dots", "Scoops, cake, something sweet.", ["sweet"], ["ice_cream", "dessert", "desserts", "frozen_yogurt", "gelato", "donut", "doughnut", "donuts", "cake", "chocolate"], [["amenity", "ice_cream"], ["shop", "confectionery"]]),
    c("bakery", "Bakery", "🥖", "#8F5A2C", "#FFE6B3", "waves", "Bread, pastries, fresh-baked.", ["breakfast", "sweet", "quick"], ["bakery", "pastry", "patisserie"], [["shop", "bakery"], ["shop", "pastry"]]),
  ];

  const BY_ID = Object.create(null);
  const BY_TOKEN = Object.create(null);
  LIST.forEach(function (cu) {
    BY_ID[cu.id] = cu;
    cu.osmCuisine.forEach(function (tok) {
      if (!(tok in BY_TOKEN)) BY_TOKEN[tok] = cu.id;
    });
  });

  WTE.Cuisines = {
    LIST: LIST,
    byId: function (id) {
      return typeof id === "string" && id in BY_ID ? BY_ID[id] : null;
    },
    ids: function () {
      return LIST.map(function (cu) {
        return cu.id;
      });
    },
    forOsmValue: function (token) {
      return typeof token === "string" && token in BY_TOKEN ? BY_TOKEN[token] : null;
    },
  };

  if (typeof module !== "undefined") module.exports = WTE.Cuisines;
})(typeof window !== "undefined" ? window : globalThis);
