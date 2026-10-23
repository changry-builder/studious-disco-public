// Card text for Pivot Pitch.
//
// adjectives + nouns: one of each makes the product ("Sparkly Toaster").
//                     Keep them everyday words anyone knows.
// pivots:             the silly curveball questions asked after a pitch.

const PIVOT_CARDS = {
  adjectives: [
    "Stylish", "Tiny", "Giant", "Sleepy", "Spicy",
    "Fluffy", "Noisy", "Sparkly", "Grumpy", "Lazy",
    "Speedy", "Invisible", "Haunted", "Frozen", "Sticky",
    "Smelly", "Bouncy", "Fancy", "Cozy", "Glowing",
    "Wobbly", "Squishy", "Ancient", "Magic", "Rusty",
    "Shiny", "Silly", "Brave", "Shy", "Hairy",
    "Crunchy", "Floating", "Musical", "Polite", "Upside-down",
    "Waterproof", "Edible", "Electric", "Royal", "Secret",
    "Sweaty", "Talking", "Wooden", "Sneaky", "Dramatic",
  ],

  nouns: [
    "Airline", "Town", "Toaster", "Umbrella", "Bicycle",
    "Sandwich", "Hat", "Pillow", "Dog", "Library",
    "Sock", "Pizza", "Backpack", "Car", "Lamp",
    "Bathtub", "Garden", "Phone", "Shoe", "Cupcake",
    "Robot", "Bank", "Hotel", "Spoon", "Couch",
    "Tent", "Gym", "Mailbox", "Taco", "Elevator",
    "Restaurant", "Toothbrush", "Blanket", "Bus", "Watch",
    "Zoo", "Ladder", "Mirror", "Backyard", "Fridge",
    "Doorbell", "Boat", "Cookie", "School", "Alarm clock",
  ],

  pivots: [
    "Why did you send your product to space?",
    "How does your product work if electricity doesn't exist?",
    "How would you sell it to a vampire?",
    "What happens if a dog gets hold of it?",
    "How would a pirate use your product?",
    "Why is your product banned in Antarctica?",
    "How does your product save someone's wedding day?",
    "Which celebrity is your spokesperson, and why?",
    "How would you pitch it to a room full of toddlers?",
    "Why does your grandma refuse to use it?",
    "How does your product survive a zombie apocalypse?",
    "What does version 2.0 do that this one can't?",
    "How would a medieval knight use it?",
    "Why are cats terrified of your product?",
    "How do you sell it to a mermaid?",
    "What's your product's theme song? Sing a bit.",
    "How would aliens accidentally misuse it?",
    "Why does your product come with a warning label?",
    "How would you make it work for a dinosaur?",
    "What happens if it gets wet?",
    "How does Santa use your product on Christmas Eve?",
    "Why does every superhero need one?",
    "How would you sell it to someone who hates everything?",
    "What flavor is your product?",
    "Why is it the perfect first-date gift?",
    "How would a ghost feel about your product?",
    "What's your 10-second Super Bowl ad?",
    "Why is your product secretly a time machine?",
    "How would you sell it to a grumpy teenager?",
    "What should your product never, ever be used for?",
    "How does your product work at the bottom of the ocean?",
    "Why does your product need a babysitter?",
    "How would a chef use it in the kitchen?",
    "Why are pigeons obsessed with it?",
    "What happens when someone uses 100 of them at once?",
    "How would you sell it to a wizard?",
    "Your product just went viral. What's the video?",
    "How would a caveman use your product?",
    "Why would the President want one?",
    "What happens if your product falls in love?",
  ],
};

if (typeof module !== "undefined") module.exports = PIVOT_CARDS;
