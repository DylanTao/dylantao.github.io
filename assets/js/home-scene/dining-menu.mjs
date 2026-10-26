// What Sirui eats and drinks today (Sirui, 2026-10-24: "you should prep differnt gormetn food and
// drink and deserts for differnt day"). A pure, deterministic rotation by Pacific date: every
// course cycles through its whole list before repeating, each on its own stride, so a day's dishes
// (seven dinners against five of each other course) recur together only every 35 days. Dishes are
// models in assets/models/home/table-setting/ (bin/build_coastal_table_setting.py); `utensil` names what the
// leading hand holds (dining-motion.mjs choreographs fork, spoon and chopsticks), `side` what the
// other hand works with. Labels are plain English for the evidence and captions.

export const BREAKFASTS = Object.freeze([
  { id: "avocado-toast", label: "Avocado toast with a jammy egg", utensil: "fork", side: "knife", juice: "orange" },
  { id: "ricotta-pancakes", label: "Ricotta pancakes, berries and maple", utensil: "fork", side: "knife", juice: null },
  { id: "congee", label: "Chicken congee with ginger and scallion", utensil: "spoon", side: null, juice: null },
  { id: "shakshuka", label: "Shakshuka with feta and grilled bread", utensil: "spoon", side: null, juice: "orange" },
  { id: "french-toast", label: "Brioche French toast with berries", utensil: "fork", side: "knife", juice: "orange" },
]);

export const LUNCHES = Object.freeze([
  { id: "poke-bowl", label: "Ahi poke bowl", utensil: "chopsticks", side: null, drink: "iced-tea" },
  { id: "burrata", label: "Burrata, heirloom tomatoes and basil", utensil: "fork", side: "knife", drink: "sparkling" },
  { id: "ramen", label: "Tonkotsu ramen", utensil: "chopsticks", side: null, drink: "iced-tea" },
  { id: "shrimp-bowl", label: "Grilled shrimp and quinoa bowl", utensil: "fork", side: null, drink: "sparkling" },
  { id: "nicoise", label: "Salade niçoise", utensil: "fork", side: "knife", drink: "sparkling" },
]);

// Dinner pairs its own drink: red with the ribeye, tea with the dumplings, white otherwise.
export const DINNERS = Object.freeze([
  { id: "salmon", label: "Seared salmon, asparagus and beurre blanc", utensil: "fork", side: "knife", drink: "white-wine" },
  { id: "ribeye", label: "Ribeye, herb butter and crisp potatoes", utensil: "fork", side: "knife", drink: "red-wine" },
  { id: "risotto", label: "Wild mushroom risotto with parmesan", utensil: "fork", side: null, drink: "white-wine" },
  { id: "cacio-e-pepe", label: "Tonnarelli cacio e pepe", utensil: "fork", side: null, drink: "red-wine" },
  { id: "black-cod", label: "Miso black cod, bok choy and rice", utensil: "chopsticks", side: null, drink: "white-wine" },
  { id: "scallops", label: "Seared scallops, pea purée and pancetta", utensil: "fork", side: "knife", drink: "white-wine" },
  { id: "xiaolongbao", label: "Xiaolongbao and garlic greens", utensil: "chopsticks", side: null, drink: "jasmine-tea" },
]);

export const DESSERTS = Object.freeze([
  { id: "tiramisu", label: "Tiramisu", utensil: "spoon" },
  { id: "creme-brulee", label: "Crème brûlée with raspberries", utensil: "spoon" },
  { id: "chocolate-fondant", label: "Chocolate fondant and vanilla ice cream", utensil: "spoon" },
  { id: "panna-cotta", label: "Panna cotta with berry coulis", utensil: "spoon" },
  { id: "matcha-cheesecake", label: "Matcha cheesecake", utensil: "spoon" },
]);

// The machine at the coffee bar makes espresso drinks; the cup is the bar's own authored cup.
export const COFFEES = Object.freeze([
  { id: "espresso", label: "Espresso" },
  { id: "cortado", label: "Cortado" },
  { id: "cappuccino", label: "Cappuccino" },
  { id: "flat-white", label: "Flat white" },
]);

// routine.mjs chooses the evening's kind (whiskey, cocktail, beer, coffee); the menu chooses
// which one, so the brief's rotation stays the single source of the kind.
export const EVENING = Object.freeze({
  whiskey: Object.freeze([
    { id: "whisky-rocks", label: "Japanese whisky on one clear cube", glass: "rocks" },
    { id: "highball", label: "Whisky highball", glass: "highball" },
  ]),
  cocktail: Object.freeze([
    { id: "negroni", label: "Negroni", glass: "rocks" },
    { id: "margarita", label: "Margarita with a salt rim", glass: "coupe" },
    { id: "espresso-martini", label: "Espresso martini", glass: "coupe" },
    { id: "old-fashioned", label: "Old fashioned", glass: "rocks" },
  ]),
  beer: Object.freeze([
    { id: "hazy-ipa", label: "San Diego hazy IPA", glass: "tulip" },
    { id: "pilsner", label: "Pilsner", glass: "tulip" },
  ]),
  coffee: Object.freeze([{ id: "evening-cortado", label: "Decaf cortado", glass: "gibraltar" }]),
});

export const DRINKS = Object.freeze({
  "white-wine": { label: "White wine", glass: "wine" },
  "red-wine": { label: "Red wine", glass: "wine" },
  "jasmine-tea": { label: "Jasmine tea", glass: "tea" },
  "iced-tea": { label: "Iced jasmine tea", glass: "tumbler" },
  sparkling: { label: "Sparkling water with lemon", glass: "tumbler" },
  orange: { label: "Fresh orange juice", glass: "juice" },
});

// Days since 1970-01-01 for a Pacific "YYYY-MM-DD" date key (routine.mjs pacificClock).
export function dayNumber(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return 0;
  return Math.round(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

// A stride coprime with the list's length visits every entry once per cycle in a shuffled order.
function pick(list, day, stride, offset) {
  const n = list.length;
  return list[(((day * stride + offset) % n) + n) % n];
}

export function menuFor(dateKey, eveningKind = "cocktail") {
  const day = dayNumber(dateKey);
  const dinner = pick(DINNERS, day, 3, 1);
  const breakfast = pick(BREAKFASTS, day, 2, 0);
  const lunch = pick(LUNCHES, day, 3, 2);
  const evening = EVENING[eveningKind] || EVENING.cocktail;
  return {
    dateKey,
    day,
    breakfast,
    coffee: pick(COFFEES, day, 3, 1),
    lunch,
    dinner,
    dessert: pick(DESSERTS, day, 2, 3),
    // Drinks by meal: the dinner pairing, lunch's own, and breakfast's juice when the dish has one.
    drinks: {
      breakfast: breakfast.juice || null,
      lunch: lunch.drink,
      dinner: dinner.drink,
    },
    evening: pick(evening, day, 1, 0),
  };
}

// The course a meal activity serves, or null for activities without a setting.
export function courseFor(menu, activity) {
  if (!menu) return null;
  if (activity === "breakfast") return { meal: "breakfast", dish: menu.breakfast, drink: menu.drinks.breakfast, coffee: menu.coffee };
  if (activity === "lunch") return { meal: "lunch", dish: menu.lunch, drink: menu.drinks.lunch };
  if (activity === "dinner") return { meal: "dinner", dish: menu.dinner, drink: menu.drinks.dinner, dessert: menu.dessert };
  if (activity === "lounge") return { meal: "evening", drink: menu.evening };
  return null;
}
