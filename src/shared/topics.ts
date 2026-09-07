/**
 * Quarry — curated Mount Rushmore-style topic bank.
 * Each topic should support ~40+ distinct plausible answers (10 players × 4 picks).
 */

export type TopicScope =
  | "sports"
  | "food"
  | "everyday"
  | "entertainment"
  | "custom";

export interface Topic {
  id: string;
  text: string;
  scope: Exclude<TopicScope, "custom">;
  /** Clarifies what's in/out of scope — shown before draft */
  scopeBoundary: string;
}

export const TOPICS: Topic[] = [
  // ── Sports (30) ──────────────────────────────────────────────────────────
  {
    id: "greatest-nba-players",
    text: "Greatest NBA players of all time",
    scope: "sports",
    scopeBoundary: "Pro basketball players only — any era, any team.",
  },
  {
    id: "best-nfl-quarterbacks",
    text: "Best NFL quarterbacks ever",
    scope: "sports",
    scopeBoundary: "NFL QBs only — starters, any era. No college or other sports.",
  },
  {
    id: "most-clutch-athletes",
    text: "Most clutch athletes",
    scope: "sports",
    scopeBoundary: "Any sport, any era. Known for coming through in big moments.",
  },
  {
    id: "best-soccer-players",
    text: "Greatest soccer players of all time",
    scope: "sports",
    scopeBoundary: "Men's or women's pro football/soccer. Clubs or national teams.",
  },
  {
    id: "best-olympic-moments",
    text: "Most iconic Olympic moments",
    scope: "sports",
    scopeBoundary: "Specific moments, performances, or upsets — not entire careers.",
  },
  {
    id: "best-sports-movies",
    text: "Best sports movies",
    scope: "sports",
    scopeBoundary: "Feature films centered on sports. Docs and TV series don't count.",
  },
  {
    id: "greatest-mlb-players",
    text: "Greatest MLB players of all time",
    scope: "sports",
    scopeBoundary: "Major League Baseball players only — any position, any era.",
  },
  {
    id: "best-nhl-players",
    text: "Best NHL players ever",
    scope: "sports",
    scopeBoundary: "NHL hockey players only. No other leagues or sports.",
  },
  {
    id: "best-college-sports-traditions",
    text: "Best college sports traditions",
    scope: "sports",
    scopeBoundary: "School traditions, chants, rivalries, or game-day rituals — not players.",
  },
  {
    id: "best-sports-nicknames",
    text: "Best sports nicknames",
    scope: "sports",
    scopeBoundary: "Famous athlete nicknames across any sport. Team names don't count.",
  },
  {
    id: "most-exciting-sports-to-watch",
    text: "Most exciting sports to watch",
    scope: "sports",
    scopeBoundary: "Any sport or competition format. Focus on spectator thrill.",
  },
  {
    id: "best-super-bowl-halftime-shows",
    text: "Best Super Bowl halftime shows",
    scope: "sports",
    scopeBoundary: "Halftime performers or specific years' shows — not the games themselves.",
  },
  {
    id: "greatest-tennis-players",
    text: "Greatest tennis players of all time",
    scope: "sports",
    scopeBoundary: "Men's or women's pro tennis. Singles or doubles stars welcome.",
  },
  {
    id: "best-golfers-ever",
    text: "Best golfers of all time",
    scope: "sports",
    scopeBoundary: "Pro golfers, any tour or era. Course names don't count.",
  },
  {
    id: "best-sports-rivalries",
    text: "Best sports rivalries",
    scope: "sports",
    scopeBoundary: "Team vs team or athlete vs athlete. Any sport, any level.",
  },
  {
    id: "best-nba-dunkers",
    text: "Best dunkers in NBA history",
    scope: "sports",
    scopeBoundary: "NBA dunkers known for highlight dunks or dunk contests.",
  },
  {
    id: "best-fantasy-sports-advice",
    text: "Best fantasy sports draft strategies",
    scope: "sports",
    scopeBoundary: "Draft approaches and strategy types — not specific player names.",
  },
  {
    id: "greatest-boxing-fighters",
    text: "Greatest boxers of all time",
    scope: "sports",
    scopeBoundary: "Pro boxers, any weight class or era. MMA fighters don't count.",
  },
  {
    id: "best-world-cup-moments",
    text: "Best World Cup moments",
    scope: "sports",
    scopeBoundary: "FIFA World Cup (men's or women's) moments, goals, or upsets.",
  },
  {
    id: "best-sports-broadcast-calls",
    text: "Best sports broadcast calls",
    scope: "sports",
    scopeBoundary: "Famous play-by-play lines or announcer moments. Any sport.",
  },
  {
    id: "best-march-madness-underdogs",
    text: "Best March Madness underdog runs",
    scope: "sports",
    scopeBoundary: "NCAA tournament Cinderella teams or memorable upset runs.",
  },
  {
    id: "best-winter-olympics-events",
    text: "Best Winter Olympics events to watch",
    scope: "sports",
    scopeBoundary: "Winter Olympic sports/disciplines only — not specific athletes.",
  },
  {
    id: "best-sports-uniforms",
    text: "Best sports uniforms of all time",
    scope: "sports",
    scopeBoundary: "Specific team uniforms or eras. Any sport. Jerseys, kits, unis.",
  },
  {
    id: "greatest-nfl-receivers",
    text: "Greatest NFL wide receivers",
    scope: "sports",
    scopeBoundary: "NFL wide receivers only. Tight ends and RBs don't count.",
  },
  {
    id: "best-sports-video-games",
    text: "Best sports video games",
    scope: "sports",
    scopeBoundary: "Games that simulate or center on real sports. Fighting games don't count.",
  },
  {
    id: "best-nba-franchises",
    text: "Best NBA franchises of all time",
    scope: "sports",
    scopeBoundary: "NBA teams as franchises — legacy, titles, culture. Not single seasons.",
  },
  {
    id: "best-athletes-turned-personalities",
    text: "Best athletes turned media personalities",
    scope: "sports",
    scopeBoundary: "Athletes known for podcasts, commentary, hosting, or entertainment.",
  },
  {
    id: "best-pickup-sports",
    text: "Best sports to play casually with friends",
    scope: "sports",
    scopeBoundary: "Rec / pickup / backyard sports. Pro leagues and esports don't count.",
  },
  {
    id: "greatest-formula-one-drivers",
    text: "Greatest Formula 1 drivers",
    scope: "sports",
    scopeBoundary: "F1 drivers only. Other racing series don't count.",
  },
  {
    id: "best-sports-comebacks",
    text: "Best sports comebacks",
    scope: "sports",
    scopeBoundary: "Games, series, or seasons with legendary comebacks. Any sport.",
  },

  // ── Food (30) ────────────────────────────────────────────────────────────
  {
    id: "best-pizza-toppings",
    text: "Best pizza toppings",
    scope: "food",
    scopeBoundary: "Individual toppings only — not whole pizza styles or brands.",
  },
  {
    id: "greatest-comfort-foods",
    text: "Greatest comfort foods",
    scope: "food",
    scopeBoundary: "Dishes or snacks that feel cozy. Drinks are fine if food-adjacent.",
  },
  {
    id: "best-ice-cream-flavors",
    text: "Best ice cream flavors",
    scope: "food",
    scopeBoundary: "Flavors only — not brands or specific shops.",
  },
  {
    id: "best-breakfast-foods",
    text: "Best breakfast foods",
    scope: "food",
    scopeBoundary: "Anything commonly eaten for breakfast. Brunch dishes welcome.",
  },
  {
    id: "best-fast-food-chains",
    text: "Best fast food chains",
    scope: "food",
    scopeBoundary: "National/regional chains with counter or drive-thru service.",
  },
  {
    id: "best-candy",
    text: "Best candy",
    scope: "food",
    scopeBoundary: "Packaged candy and chocolate. Homemade desserts don't count.",
  },
  {
    id: "best-chip-flavors",
    text: "Best potato chip flavors",
    scope: "food",
    scopeBoundary: "Chip/crisp flavors — any brand. Other snacks don't count.",
  },
  {
    id: "best-sandwich-fillings",
    text: "Best sandwich fillings",
    scope: "food",
    scopeBoundary: "Proteins, spreads, and fillings — not the full sandwich name.",
  },
  {
    id: "best-taco-fillings",
    text: "Best taco fillings",
    scope: "food",
    scopeBoundary: "Meats, veggies, and classic taco fillings. Shells/salsas alone don't count.",
  },
  {
    id: "best-pasta-dishes",
    text: "Best pasta dishes",
    scope: "food",
    scopeBoundary: "Named pasta dishes or preparations. Plain noodle shapes alone don't count.",
  },
  {
    id: "best-coffee-drinks",
    text: "Best coffee drinks",
    scope: "food",
    scopeBoundary: "Coffee-based drinks only. Tea, soda, and energy drinks don't count.",
  },
  {
    id: "best-cocktails",
    text: "Best cocktails",
    scope: "food",
    scopeBoundary: "Named mixed drinks. Beer, wine, and shots don't count.",
  },
  {
    id: "best-grilling-foods",
    text: "Best foods to throw on the grill",
    scope: "food",
    scopeBoundary: "Things you cook on a grill or BBQ. Indoor-only dishes don't count.",
  },
  {
    id: "best-road-trip-snacks",
    text: "Best road trip snacks",
    scope: "food",
    scopeBoundary: "Portable snacks for car trips. Full meals and sit-down food don't count.",
  },
  {
    id: "best-cheese",
    text: "Best cheeses",
    scope: "food",
    scopeBoundary: "Cheese varieties/types. Brands and cheese dishes don't count.",
  },
  {
    id: "best-soup",
    text: "Best soups",
    scope: "food",
    scopeBoundary: "Soup styles and named soups. Stews and chili are fair game.",
  },
  {
    id: "best-dessert",
    text: "Best desserts",
    scope: "food",
    scopeBoundary: "Sweet dishes and desserts. Candy bars alone are better under candy.",
  },
  {
    id: "best-asian-takeout",
    text: "Best Asian takeout dishes",
    scope: "food",
    scopeBoundary: "Common takeout/delivery dishes from Asian cuisines. Not restaurant names.",
  },
  {
    id: "best-burger-toppings",
    text: "Best burger toppings",
    scope: "food",
    scopeBoundary: "Toppings and condiments for burgers — not the patty type or brand.",
  },
  {
    id: "best-cereal",
    text: "Best breakfast cereals",
    scope: "food",
    scopeBoundary: "Packaged breakfast cereals. Oatmeal and granola bars don't count.",
  },
  {
    id: "best-mexican-food",
    text: "Best Mexican food dishes",
    scope: "food",
    scopeBoundary: "Dishes from Mexican cuisine. Restaurant chains don't count.",
  },
  {
    id: "best-soda-flavors",
    text: "Best soda flavors",
    scope: "food",
    scopeBoundary: "Soft drink flavors or classic sodas. Energy drinks don't count.",
  },
  {
    id: "best-cookie-types",
    text: "Best cookie types",
    scope: "food",
    scopeBoundary: "Cookie styles/flavors — not bakery brands.",
  },
  {
    id: "best-brunch-orders",
    text: "Best brunch orders",
    scope: "food",
    scopeBoundary: "Classic brunch dishes and drinks. Dinner entrees don't count.",
  },
  {
    id: "best-holiday-foods",
    text: "Best holiday foods",
    scope: "food",
    scopeBoundary: "Foods associated with holidays or festive seasons. Any culture.",
  },
  {
    id: "best-street-foods",
    text: "Best street foods around the world",
    scope: "food",
    scopeBoundary: "Portable street foods and snacks. Fine dining doesn't count.",
  },
  {
    id: "best-condiments",
    text: "Best condiments and sauces",
    scope: "food",
    scopeBoundary: "Condiments, dips, and sauces. Main dishes don't count.",
  },
  {
    id: "best-midnight-snacks",
    text: "Best midnight snacks",
    scope: "food",
    scopeBoundary: "Things you'd actually eat late at night. Full cook-from-scratch meals don't count.",
  },
  {
    id: "best-fruit",
    text: "Best fruits",
    scope: "food",
    scopeBoundary: "Fruits only — fresh, dried, or tropical. Vegetables don't count.",
  },
  {
    id: "best-food-pairings",
    text: "Best classic food pairings",
    scope: "food",
    scopeBoundary: "Two things that famously go together (e.g. peanut butter & jelly).",
  },

  // ── Everyday (30) ────────────────────────────────────────────────────────
  {
    id: "best-road-trip-destinations",
    text: "Best road trip destinations",
    scope: "everyday",
    scopeBoundary: "Places worth driving to. Flights-only destinations don't count.",
  },
  {
    id: "best-apps-on-your-phone",
    text: "Best apps on your phone",
    scope: "everyday",
    scopeBoundary: "Mobile apps you'd recommend. Websites-only services don't count.",
  },
  {
    id: "best-ways-to-waste-an-afternoon",
    text: "Best ways to waste an afternoon",
    scope: "everyday",
    scopeBoundary: "Casual, low-stakes activities. Work and chores don't count.",
  },
  {
    id: "best-board-games",
    text: "Best board games",
    scope: "everyday",
    scopeBoundary: "Physical board/card/tabletop games. Video games don't count.",
  },
  {
    id: "best-party-games",
    text: "Best party games",
    scope: "everyday",
    scopeBoundary: "Games great with a group. Solo hobbies don't count.",
  },
  {
    id: "best-date-night-ideas",
    text: "Best date night ideas",
    scope: "everyday",
    scopeBoundary: "Activities for a fun date. Gifts and long vacations don't count.",
  },
  {
    id: "best-dog-breeds",
    text: "Best dog breeds",
    scope: "everyday",
    scopeBoundary: "Dog breeds only. Individual famous dogs don't count.",
  },
  {
    id: "best-vacation-types",
    text: "Best types of vacations",
    scope: "everyday",
    scopeBoundary: "Vacation styles (beach, city, camping…) — not specific destinations.",
  },
  {
    id: "best-household-hacks",
    text: "Best household life hacks",
    scope: "everyday",
    scopeBoundary: "Practical home tips and tricks. Products alone don't count.",
  },
  {
    id: "best-things-to-do-on-a-rainy-day",
    text: "Best rainy day activities",
    scope: "everyday",
    scopeBoundary: "Indoor or rain-friendly activities. Fair-weather outdoor sports don't count.",
  },
  {
    id: "best-podcast-topics",
    text: "Best podcast genres",
    scope: "everyday",
    scopeBoundary: "Podcast genres/categories — not specific show titles.",
  },
  {
    id: "best-weekend-hobbies",
    text: "Best weekend hobbies",
    scope: "everyday",
    scopeBoundary: "Hobbies you can actually do on a weekend. Full careers don't count.",
  },
  {
    id: "best-ways-to-celebrate",
    text: "Best ways to celebrate a win",
    scope: "everyday",
    scopeBoundary: "Celebration ideas for good news. Everyday routines don't count.",
  },
  {
    id: "best-gifts-under-fifty",
    text: "Best gift ideas under $50",
    scope: "everyday",
    scopeBoundary: "Affordable gift ideas. Experiences okay if plausibly under $50.",
  },
  {
    id: "best-room-in-the-house",
    text: "Best rooms to hang out in",
    scope: "everyday",
    scopeBoundary: "Rooms or spaces in a home. Outdoor destinations don't count.",
  },
  {
    id: "best-excuses-to-cancel-plans",
    text: "Best socially acceptable excuses to cancel plans",
    scope: "everyday",
    scopeBoundary: "Mild, believable excuses. Mean or harmful ones don't count.",
  },
  {
    id: "best-things-about-summer",
    text: "Best things about summer",
    scope: "everyday",
    scopeBoundary: "Summer vibes, activities, foods, or feelings. Other seasons don't count.",
  },
  {
    id: "best-things-about-fall",
    text: "Best things about fall",
    scope: "everyday",
    scopeBoundary: "Fall vibes, activities, foods, or feelings. Other seasons don't count.",
  },
  {
    id: "best-ways-to-spend-a-bonus",
    text: "Best ways to spend a surprise bonus",
    scope: "everyday",
    scopeBoundary: "Fun or smart uses for unexpected cash. Illegal stuff doesn't count.",
  },
  {
    id: "best-childhood-toys",
    text: "Best childhood toys",
    scope: "everyday",
    scopeBoundary: "Toys and playthings from childhood. Video game consoles are okay.",
  },
  {
    id: "best-places-to-people-watch",
    text: "Best places to people-watch",
    scope: "everyday",
    scopeBoundary: "Public places great for people-watching. Private homes don't count.",
  },
  {
    id: "best-group-chat-energy",
    text: "Best group chat personalities",
    scope: "everyday",
    scopeBoundary: "Archetypes of people in a group chat — not real friends' names.",
  },
  {
    id: "best-ways-to-kill-time-at-the-airport",
    text: "Best ways to kill time at the airport",
    scope: "everyday",
    scopeBoundary: "Airport-friendly pastimes. Activities requiring leaving security don't count.",
  },
  {
    id: "best-picnic-essentials",
    text: "Best picnic essentials",
    scope: "everyday",
    scopeBoundary: "Items or foods that make a picnic better. Full restaurant meals don't count.",
  },
  {
    id: "best-home-workout-ideas",
    text: "Best at-home workout ideas",
    scope: "everyday",
    scopeBoundary: "Exercises or routines doable at home. Gym-only machines don't count.",
  },
  {
    id: "best-ways-to-start-the-morning",
    text: "Best ways to start the morning",
    scope: "everyday",
    scopeBoundary: "Morning routines and rituals. Late-night habits don't count.",
  },
  {
    id: "best-things-to-do-with-housemates",
    text: "Best things to do with housemates",
    scope: "everyday",
    scopeBoundary: "Shared activities for roommates or cohabitants. Solo hobbies don't count.",
  },
  {
    id: "best-thrift-finds",
    text: "Best thrift store finds",
    scope: "everyday",
    scopeBoundary: "Categories of great thrift/secondhand scores. Brand-new luxury doesn't count.",
  },
  {
    id: "best-plants-for-apartments",
    text: "Best plants for apartments",
    scope: "everyday",
    scopeBoundary: "Houseplants that work indoors. Outdoor trees and shrubs don't count.",
  },
  {
    id: "best-ways-to-make-a-tuesday-fun",
    text: "Best ways to make a random Tuesday fun",
    scope: "everyday",
    scopeBoundary: "Small joys and midweek treats. Major vacations don't count.",
  },

  // ── Entertainment (30) ───────────────────────────────────────────────────
  {
    id: "most-rewatchable-sitcoms",
    text: "Most rewatchable sitcoms",
    scope: "entertainment",
    scopeBoundary: "Comedy TV sitcoms only. Dramas and movies don't count.",
  },
  {
    id: "best-marvel-movies",
    text: "Best Marvel movies",
    scope: "entertainment",
    scopeBoundary: "MCU or Marvel-branded films. TV shows and comics don't count.",
  },
  {
    id: "best-disney-animated-movies",
    text: "Best Disney animated movies",
    scope: "entertainment",
    scopeBoundary: "Disney (or Pixar under Disney) animated features. Live-action remakes don't count.",
  },
  {
    id: "best-90s-songs",
    text: "Best songs of the 1990s",
    scope: "entertainment",
    scopeBoundary: "Songs released in the 1990s. Albums-as-a-whole don't count.",
  },
  {
    id: "best-2000s-hits",
    text: "Best hits of the 2000s",
    scope: "entertainment",
    scopeBoundary: "Popular songs from 2000–2009. Albums don't count as answers.",
  },
  {
    id: "best-reality-tv-shows",
    text: "Best reality TV shows",
    scope: "entertainment",
    scopeBoundary: "Reality / competition / docu-style TV. Scripted shows don't count.",
  },
  {
    id: "best-comedy-movies",
    text: "Best comedy movies",
    scope: "entertainment",
    scopeBoundary: "Feature films primarily sold as comedies. TV episodes don't count.",
  },
  {
    id: "best-horror-movies",
    text: "Best horror movies",
    scope: "entertainment",
    scopeBoundary: "Horror feature films. Thrillers without horror vibes don't count.",
  },
  {
    id: "best-streaming-shows",
    text: "Best streaming original series",
    scope: "entertainment",
    scopeBoundary: "Shows that premiered on a streaming platform. Network-only classics don't count.",
  },
  {
    id: "best-video-games",
    text: "Best video games of all time",
    scope: "entertainment",
    scopeBoundary: "Any platform or genre. Board games don't count.",
  },
  {
    id: "best-movie-soundtracks",
    text: "Best movie soundtracks",
    scope: "entertainment",
    scopeBoundary: "Film soundtracks / scores. Album soundtracks for other media okay if film-based.",
  },
  {
    id: "best-animated-tv-shows",
    text: "Best animated TV shows",
    scope: "entertainment",
    scopeBoundary: "Animated series for any age. Animated feature films don't count.",
  },
  {
    id: "best-stand-up-specials",
    text: "Best stand-up comedy specials",
    scope: "entertainment",
    scopeBoundary: "Released stand-up specials or iconic sets. Sketch shows don't count.",
  },
  {
    id: "best-rom-coms",
    text: "Best romantic comedies",
    scope: "entertainment",
    scopeBoundary: "Rom-com movies primarily. TV shows and dramas without comedy don't count.",
  },
  {
    id: "best-superhero-characters",
    text: "Best superhero characters",
    scope: "entertainment",
    scopeBoundary: "Comic / movie / TV superheroes. Villains and sidekicks without powers are fine if iconic.",
  },
  {
    id: "best-musicians-to-see-live",
    text: "Best musicians to see live",
    scope: "entertainment",
    scopeBoundary: "Artists or bands known for great live shows. Studio-only acts less ideal.",
  },
  {
    id: "best-binge-worthy-dramas",
    text: "Best binge-worthy dramas",
    scope: "entertainment",
    scopeBoundary: "Dramatic TV series. Sitcoms and movies don't count.",
  },
  {
    id: "best-movie-quotes",
    text: "Best movie quotes",
    scope: "entertainment",
    scopeBoundary: "Famous lines from films. TV quotes don't count.",
  },
  {
    id: "best-tv-theme-songs",
    text: "Best TV theme songs",
    scope: "entertainment",
    scopeBoundary: "Opening themes from TV shows. Movie score cues don't count.",
  },
  {
    id: "best-comedians",
    text: "Best comedians of all time",
    scope: "entertainment",
    scopeBoundary: "Stand-up or comedy performers. Fictional characters don't count.",
  },
  {
    id: "best-fantasy-book-series",
    text: "Best fantasy book series",
    scope: "entertainment",
    scopeBoundary: "Fantasy book series (or epic standalone cycles). Sci-fi-only worlds don't count.",
  },
  {
    id: "best-podcasts",
    text: "Best podcasts",
    scope: "entertainment",
    scopeBoundary: "Specific podcast show titles. Genres alone don't count.",
  },
  {
    id: "best-youtube-channels",
    text: "Best YouTube channels",
    scope: "entertainment",
    scopeBoundary: "YouTube channels (creators or brands). Individual videos don't count.",
  },
  {
    id: "best-musical-artists-2010s",
    text: "Best musical artists of the 2010s",
    scope: "entertainment",
    scopeBoundary: "Artists who peaked or dominated in the 2010s. One-hit wonders okay.",
  },
  {
    id: "best-feel-good-movies",
    text: "Best feel-good movies",
    scope: "entertainment",
    scopeBoundary: "Movies that leave you happy. Dark thrillers don't count.",
  },
  {
    id: "best-fictional-friend-groups",
    text: "Best fictional friend groups",
    scope: "entertainment",
    scopeBoundary: "Named friend groups from TV, film, books, or games.",
  },
  {
    id: "best-kid-cartoons-we-still-love",
    text: "Best kids' cartoons we still love",
    scope: "entertainment",
    scopeBoundary: "Cartoons aimed at kids that adults still enjoy. Adult animation ok if nostalgic.",
  },
  {
    id: "best-movie-franchises",
    text: "Best movie franchises",
    scope: "entertainment",
    scopeBoundary: "Film series / franchises with multiple entries. Single films don't count.",
  },
  {
    id: "best-dance-songs",
    text: "Best songs to dance to",
    scope: "entertainment",
    scopeBoundary: "Songs that fill a dance floor. Ballads and spoken-word don't count.",
  },
  {
    id: "best-guilty-pleasure-shows",
    text: "Best guilty-pleasure TV shows",
    scope: "entertainment",
    scopeBoundary: "Shows people love but pretend not to. Prestige-only dramas less ideal.",
  },

  // ── Extra mix for depth (8+ each scope) ──────────────────────────────────
  {
    id: "best-nba-arenas",
    text: "Best NBA arena atmospheres",
    scope: "sports",
    scopeBoundary: "NBA home crowds / arenas known for energy. Other sports venues don't count.",
  },
  {
    id: "best-sports-documentaries",
    text: "Best sports documentaries",
    scope: "sports",
    scopeBoundary: "Docs about sports or athletes. Fictional sports movies don't count.",
  },
  {
    id: "best-fantasy-football-team-names",
    text: "Best fantasy football team name vibes",
    scope: "sports",
    scopeBoundary: "Name styles or classic joke name patterns — keep it clean.",
  },
  {
    id: "best-winter-sports",
    text: "Best winter sports",
    scope: "sports",
    scopeBoundary: "Sports played on snow or ice. Summer sports don't count.",
  },
  {
    id: "best-sports-podcasts",
    text: "Best sports podcasts",
    scope: "sports",
    scopeBoundary: "Podcasts focused on sports. General entertainment pods don't count.",
  },
  {
    id: "best-mlb-ballparks",
    text: "Best MLB ballparks",
    scope: "sports",
    scopeBoundary: "Major League Baseball stadiums. Minor league parks don't count.",
  },
  {
    id: "best-soccer-clubs",
    text: "Best soccer clubs in the world",
    scope: "sports",
    scopeBoundary: "Professional club teams. National teams don't count.",
  },
  {
    id: "best-sports-catchphrases",
    text: "Best sports catchphrases",
    scope: "sports",
    scopeBoundary: "Famous slogans, chants, or athlete catchphrases. Any sport.",
  },

  {
    id: "best-bagel-toppings",
    text: "Best bagel toppings and spreads",
    scope: "food",
    scopeBoundary: "Spreads and toppings for bagels — not bagel brands.",
  },
  {
    id: "best-smoothie-ingredients",
    text: "Best smoothie ingredients",
    scope: "food",
    scopeBoundary: "Fruits, add-ins, and bases for smoothies. Whole meals don't count.",
  },
  {
    id: "best-bbq-sides",
    text: "Best BBQ side dishes",
    scope: "food",
    scopeBoundary: "Sides that go with barbecue. The main smoked meats don't count.",
  },
  {
    id: "best-noodles",
    text: "Best noodle dishes",
    scope: "food",
    scopeBoundary: "Noodle-based dishes from any cuisine. Plain pasta shapes alone don't count.",
  },
  {
    id: "best-hot-sauce",
    text: "Best hot sauces",
    scope: "food",
    scopeBoundary: "Hot sauce brands or styles. Mild ketchup doesn't count.",
  },
  {
    id: "best-bakery-items",
    text: "Best bakery items",
    scope: "food",
    scopeBoundary: "Things you'd grab at a bakery. Grocery-aisle candy doesn't count.",
  },
  {
    id: "best-frozen-treats",
    text: "Best frozen treats",
    scope: "food",
    scopeBoundary: "Ice cream, popsicles, frozen yogurt, and similar. Hot desserts don't count.",
  },
  {
    id: "best-diner-classics",
    text: "Best diner classics",
    scope: "food",
    scopeBoundary: "Classic American diner menu items. Fine dining doesn't count.",
  },

  {
    id: "best-pet-names",
    text: "Best pet names",
    scope: "everyday",
    scopeBoundary: "Names you'd give a pet. Human celebrity names only if used as pet names.",
  },
  {
    id: "best-road-trip-playlist-songs",
    text: "Best road trip playlist songs",
    scope: "everyday",
    scopeBoundary: "Songs that slap on a long drive. Podcasts don't count.",
  },
  {
    id: "best-ways-to-stay-cozy",
    text: "Best ways to stay cozy",
    scope: "everyday",
    scopeBoundary: "Cozy habits, items, or setups. Extreme sports don't count.",
  },
  {
    id: "best-farmers-market-finds",
    text: "Best farmers market finds",
    scope: "everyday",
    scopeBoundary: "Things worth buying at a farmers market. Big-box groceries don't count.",
  },
  {
    id: "best-city-day-trips",
    text: "Best day-trip ideas from a city",
    scope: "everyday",
    scopeBoundary: "Day-trip activities or destination types. Multi-week trips don't count.",
  },
  {
    id: "best-roommate-agreements",
    text: "Best unofficial roommate rules",
    scope: "everyday",
    scopeBoundary: "House rules that keep the peace. Lease legalese doesn't count.",
  },
  {
    id: "best-ways-to-use-a-day-off",
    text: "Best ways to use a random day off",
    scope: "everyday",
    scopeBoundary: "One-day plans. Long vacations don't count.",
  },
  {
    id: "best-things-in-a-junk-drawer",
    text: "Best surprising junk drawer treasures",
    scope: "everyday",
    scopeBoundary: "Useful or funny things found in a junk drawer. Valuables vault items don't count.",
  },

  {
    id: "best-heist-movies",
    text: "Best heist movies",
    scope: "entertainment",
    scopeBoundary: "Heist / caper films. True-crime docs don't count.",
  },
  {
    id: "best-scifi-movies",
    text: "Best sci-fi movies",
    scope: "entertainment",
    scopeBoundary: "Science fiction feature films. Pure fantasy without sci-fi doesn't count.",
  },
  {
    id: "best-tv-antiheroes",
    text: "Best TV antiheroes",
    scope: "entertainment",
    scopeBoundary: "Complicated protagonists from TV. Pure villains without sympathy less ideal.",
  },
  {
    id: "best-musical-theater-songs",
    text: "Best musical theater songs",
    scope: "entertainment",
    scopeBoundary: "Songs from stage musicals. Movie-only pop songs don't count.",
  },
  {
    id: "best-album-openers",
    text: "Best album opening tracks",
    scope: "entertainment",
    scopeBoundary: "Songs that open a well-known album. Singles that aren't openers don't count.",
  },
  {
    id: "best-fictional-cities",
    text: "Best fictional cities",
    scope: "entertainment",
    scopeBoundary: "Cities from fiction (books, film, games, TV). Real cities don't count.",
  },
  {
    id: "best-movie-end-credits-songs",
    text: "Best end-credits movie songs",
    scope: "entertainment",
    scopeBoundary: "Songs that play over movie end credits. Opening themes don't count.",
  },
  {
    id: "best-game-show-formats",
    text: "Best game show formats",
    scope: "entertainment",
    scopeBoundary: "Game show titles or classic formats. Reality dating shows don't count.",
  },
];

export const TOPIC_COUNT = TOPICS.length;

export function topicsByScope(scope: TopicScope): Topic[] {
  if (scope === "custom") return [];
  return TOPICS.filter((t) => t.scope === scope);
}

export function getTopicById(id: string): Topic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function pickRandomTopics(
  count: number,
  excludeIds: string[],
  rng: () => number = Math.random,
): Topic[] {
  const exclude = new Set(excludeIds);
  const pool = TOPICS.filter((t) => !exclude.has(t.id));

  // Fisher–Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }

  return pool.slice(0, Math.max(0, count));
}
