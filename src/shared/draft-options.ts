import { normalizePick } from "./types";
import { getTopicById } from "./topics";

/** Starting points, not a ranking. Players can always enter their own answer. */
const STARTERS: Record<string, string[]> = {
  "greatest-nba-players": ["Michael Jordan", "LeBron James", "Kareem Abdul-Jabbar", "Bill Russell", "Magic Johnson", "Larry Bird", "Wilt Chamberlain", "Kobe Bryant", "Shaquille O'Neal", "Tim Duncan", "Stephen Curry", "Hakeem Olajuwon", "Kevin Durant", "Oscar Robertson", "Jerry West", "Moses Malone", "Julius Erving", "Dirk Nowitzki", "Kevin Garnett", "Karl Malone", "Charles Barkley", "David Robinson", "John Stockton", "Dwyane Wade", "Elgin Baylor", "Giannis Antetokounmpo", "Nikola Jokic", "Isiah Thomas", "Chris Paul", "Allen Iverson", "Scottie Pippen", "Kawhi Leonard", "Steve Nash", "Jason Kidd", "Patrick Ewing", "Clyde Drexler", "Reggie Miller", "Ray Allen", "Bob Pettit", "Walt Frazier", "Rick Barry", "George Gervin", "James Harden", "Russell Westbrook", "Paul Pierce", "Gary Payton", "Kevin McHale", "Elvin Hayes", "Dominique Wilkins", "Dolph Schayes"],
  "best-nfl-quarterbacks": ["Tom Brady", "Patrick Mahomes", "Peyton Manning", "Joe Montana", "Johnny Unitas", "Dan Marino", "Aaron Rodgers", "Drew Brees", "Brett Favre", "John Elway", "Steve Young", "Roger Staubach", "Otto Graham", "Fran Tarkenton", "Terry Bradshaw", "Troy Aikman", "Kurt Warner", "Warren Moon", "Jim Kelly", "Bart Starr", "Dan Fouts", "Ben Roethlisberger", "Eli Manning", "Philip Rivers", "Russell Wilson", "Lamar Jackson", "Josh Allen", "Joe Burrow", "Justin Herbert", "Matthew Stafford", "Matt Ryan", "Cam Newton", "Michael Vick", "Donovan McNabb", "Randall Cunningham", "Boomer Esiason", "Ken Anderson", "Ken Stabler", "Sonny Jurgensen", "Len Dawson", "Joe Namath", "Y.A. Tittle", "Bobby Layne", "Norm Van Brocklin", "Bob Griese", "Roman Gabriel", "Rich Gannon", "Steve McNair", "Daunte Culpepper", "Drew Bledsoe"],
  "best-road-trip-snacks": ["Beef jerky", "Sour Patch Kids", "Cheez-Its", "Pretzels", "Trail mix", "Peanut M&Ms", "Gummy bears", "Sunflower seeds", "Goldfish", "Pringles", "Doritos", "Cheetos", "Popcorn", "Twizzlers", "Skittles", "Reese's Pieces", "Snickers", "Granola bars", "Protein bars", "Roasted almonds", "Cashews", "Pistachios", "Peanuts", "Dried mango", "Banana chips", "Fruit leather", "Rice cakes", "Corn Nuts", "Combos", "Bugles", "Fritos", "Takis", "Oreos", "Nutter Butters", "Chocolate chip cookies", "Peanut butter crackers", "Cheese crackers", "Apples", "Bananas", "Clementines", "Grapes", "String cheese", "Baby carrots", "Snap peas", "Pepperoni sticks", "Rice Krispies Treats", "Mini muffins", "Bagel chips", "Wasabi peas", "Chex Mix"],
};

export function cleanDraftOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of value.slice(0, 120)) {
    if (typeof item !== "string") continue;
    const text = item.trim().replace(/\s+/g, " ");
    const normalized = normalizePick(text);
    if (!text || text.length > 48 || seen.has(normalized)) continue;
    seen.add(normalized);
    options.push(text);
    if (options.length === 80) break;
  }
  return options;
}

export function starterDraftOptions(topicId: string, topicText = ""): string[] {
  const key = STARTERS[topicId] ? topicId : Object.keys(STARTERS).find((id) => normalizePick(getTopicById(id)?.text ?? "") === normalizePick(topicText));
  return [...(key ? STARTERS[key] : [])];
}
