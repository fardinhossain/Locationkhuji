const BENGALI_NUMBER_MAP = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const BENGALI_DIGIT_MAP = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
  '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
};

const normalizeBengaliText = (text) => {
  if (!text) return "";
  return text.replace(/[০-৯]/g, (match) => BENGALI_NUMBER_MAP[match] || match);
};

const normalizeLocationText = (text) => {
  if (!text) return "";
  let out = normalizeBengaliText(String(text).toLowerCase());
  out = out.replace(/[\/_.,]+/g, " ");
  out = out.replace(/[-]+/g, " ");
  out = out.replace(/([a-z\u0980-\u09FF])(\d)/g, "$1 $2");
  out = out.replace(/(\d)([a-z\u0980-\u09FF])/g, "$1 $2");
  out = out.replace(/\b0+(\d)\b/g, "$1");
  out = out.replace(/\s+/g, " ").trim();
  return out;
};

const tokenizeLocationText = (text) => {
  return normalizeLocationText(text).split(" ").filter(Boolean);
};

const extractLocationNumbers = (text) => {
  const normalized = normalizeLocationText(text);
  const matches = normalized.match(/\b\d+\b/g);
  return matches ? matches.map((n) => String(Number(n))) : [];
};

const CATEGORY_SYNONYMS = {
  flat: /\b(flat|rent|apartment|room|sublet|mess|basa|bari|ফ্ল্যাট|ভাড়া|এপার্টমেন্ট|রুম|সাবলেট|মেস|বাসা|বাড়ি)\b/i,
  pharmacy: /\b(pharmacy|medicine|drug|osudh|pharmacist|osud|pharmacies|ফার্মেসি|ওষুধ|মেডিসিন)\b/i,
  hospital: /\b(hospital|clinic|doctor|mbbs|medical|ambulance|icu|ccu|hospitals|dental|ডেন্টাল|হাসপাতাল|ক্লিনিক|ডাক্তার)\b/i,
  restaurant: /\b(restaurant|cafe|food|dining|biryani|burger|pizza|pizzaburg|eat|hotel|kacchi|kacchi bhai|fast food|bakery|kabab|khabar|রেস্টুরেন্ট|ক্যাফে|খাবার|বিরিয়ানি|পিৎজা|কাচ্চি|হোটেল)\b/i,
  service: /\b(service|hire|mechanic|plumber|electrician|tutor|photographer|cleaner|maid|painter|carpenter|technician|pest control|babysitter|moving|event|service|সার্ভিস|মিস্ত্রি|ইলেকট্রিশিয়ান|ফটোগ্রাফার)\b/i,
};

// Words that typically mean a nationwide business or category name, NOT a geographical location
const BUSINESS_NAMES = [
  "pizzaburg", "kacchi bhai", "dental hospital", "dental", "pizza burg", "kfc", "burger king", "aarong", "apex", "bata"
];

const BENGALI_PREPOSITIONS = [
  "এ", "তে", "এর কাছে", "পাশে", "নিকটে", "থেকে", "এর আশেপাশে"
];

const LOCATION_STOPWORDS = [
  "in", "near", "around", "inside", "at", "find", "search", "me", "show",
  "for", "the", "a", "an", "best", "good", "cheap", "under", "below",
  "with", "want", "need", "looking", "please", "area", "place", "places",
  "road", "rd", "sector", "sec", "block", "blk", "phase", "zone",
  "এ", "তে", "এর", "এর কাছে", "পাশে", "নিকটে", "থেকে", "এর আশেপাশে"
];

const toBengaliNumber = (num) => {
  return String(num).split("").map((d) => BENGALI_DIGIT_MAP[d] || d).join("");
};

const makeNumberedAreas = ({
  canonicalBase,
  aliasBases = [],
  aliasBasesBn = [],
  numbers = [],
  coordsByNumber = {},
  fallbackLat,
  fallbackLng,
  type = "area",
  region = "dhaka"
}) => {
  return numbers.map((num) => {
    const bnNum = toBengaliNumber(num);
    const canonical = `${canonicalBase} ${num}`;
    const aliases = [];

    for (const base of [canonicalBase, ...aliasBases]) {
      aliases.push(`${base} ${num}`);
      aliases.push(`${base}-${num}`);
      aliases.push(`${base}${num}`);
      aliases.push(`${base} ${String(num).padStart(2, "0")}`);
      aliases.push(`${base}-${String(num).padStart(2, "0")}`);
    }

    for (const baseBn of aliasBasesBn) {
      aliases.push(`${baseBn} ${bnNum}`);
      aliases.push(`${baseBn}-${bnNum}`);
      aliases.push(`${baseBn}${bnNum}`);
    }

    const coords = coordsByNumber[num] || [fallbackLat, fallbackLng];

    return {
      canonical,
      aliases,
      lat: coords[0],
      lng: coords[1],
      type,
      region,
      number: num,
      keywords: [canonicalBase]
    };
  });
};

const makeBlockAreas = ({
  canonicalBase,
  aliasBases = [],
  aliasBasesBn = [],
  blocks = [],
  fallbackLat,
  fallbackLng,
  type = "block",
  region = "dhaka"
}) => {
  return blocks.map((block) => {
    const canonical = `${canonicalBase} block ${block}`;
    const aliases = [];

    for (const base of [canonicalBase, ...aliasBases]) {
      aliases.push(`${base} block ${block}`);
      aliases.push(`${base} blk ${block}`);
      aliases.push(`${base} ${block}`);
    }

    for (const baseBn of aliasBasesBn) {
      aliases.push(`${baseBn} ব্লক ${block}`);
      aliases.push(`${baseBn} ${block}`);
    }

    return {
      canonical,
      aliases,
      lat: fallbackLat,
      lng: fallbackLng,
      type,
      region,
      block: block,
      keywords: [canonicalBase]
    };
  });
};

const MIRPUR_COORDS = {
  1: [23.7956, 90.3541],
  2: [23.8045, 90.3615],
  10: [23.8069, 90.3688],
  11: [23.8183, 90.3698],
  12: [23.8242, 90.3644],
  14: [23.8063, 90.3846]
};

const LOCATION_AREAS = [
  ...makeNumberedAreas({
    canonicalBase: "mirpur",
    aliasBases: ["mirpur"],
    aliasBasesBn: ["মিরপুর"],
    numbers: [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
    coordsByNumber: MIRPUR_COORDS,
    fallbackLat: 23.8223,
    fallbackLng: 90.3665,
    type: "area"
  }),
  ...makeNumberedAreas({
    canonicalBase: "dhanmondi",
    aliasBases: ["dhanmondi road", "dhanmondi rd"],
    aliasBasesBn: ["ধানমন্ডি", "ধানমন্ডি রোড"],
    numbers: Array.from({ length: 32 }, (_, i) => i + 1),
    fallbackLat: 23.7461,
    fallbackLng: 90.3742,
    type: "road"
  }),
  ...makeNumberedAreas({
    canonicalBase: "uttara sector",
    aliasBases: ["sector", "uttara"],
    aliasBasesBn: ["উত্তরা সেক্টর", "সেক্টর"],
    numbers: [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
    fallbackLat: 23.8759,
    fallbackLng: 90.3907,
    type: "sector"
  }),
  ...makeNumberedAreas({
    canonicalBase: "banani road",
    aliasBases: ["banani"],
    aliasBasesBn: ["বনানী রোড", "বনানী"],
    numbers: [1,2,3,4,5,6,7,8,9,10,11],
    fallbackLat: 23.7940,
    fallbackLng: 90.4043,
    type: "road"
  }),
  ...makeNumberedAreas({
    canonicalBase: "gulshan",
    aliasBases: ["gulshan"],
    aliasBasesBn: ["গুলশান"],
    numbers: [1,2],
    fallbackLat: 23.7925,
    fallbackLng: 90.4078,
    type: "area"
  }),
  ...makeBlockAreas({
    canonicalBase: "mohammadpur",
    aliasBases: ["mohammadpur"],
    aliasBasesBn: ["মোহাম্মদপুর"],
    blocks: ["A","B","C","D","E","F"],
    fallbackLat: 23.7542,
    fallbackLng: 90.3625
  }),
  ...makeBlockAreas({
    canonicalBase: "bashundhara",
    aliasBases: ["bashundhara"],
    aliasBasesBn: ["বসুন্ধরা"],
    blocks: ["A","B","C","D","E","F","G","H","I","J","K"],
    fallbackLat: 23.8193,
    fallbackLng: 90.4497
  })
];

const LOCATION_ALIAS_ENTRIES = [];
const LOCATION_ALIAS_INDEX = new Map();
const LOCATION_CANONICAL_INDEX = new Map();

const addAliasEntry = (area, alias) => {
  const normalizedAlias = normalizeLocationText(alias);
  if (!normalizedAlias) return;
  const tokens = tokenizeLocationText(normalizedAlias);
  const entry = { area, alias, normalizedAlias, tokens };
  LOCATION_ALIAS_ENTRIES.push(entry);
  if (!LOCATION_ALIAS_INDEX.has(normalizedAlias)) {
    LOCATION_ALIAS_INDEX.set(normalizedAlias, entry);
  }
};

for (const area of LOCATION_AREAS) {
  LOCATION_CANONICAL_INDEX.set(normalizeLocationText(area.canonical), area);
  addAliasEntry(area, area.canonical);
  for (const alias of area.aliases || []) {
    addAliasEntry(area, alias);
  }
}

const tokensContainSequence = (queryTokens, aliasTokens) => {
  if (!queryTokens.length || aliasTokens.length > queryTokens.length) return false;
  for (let i = 0; i <= queryTokens.length - aliasTokens.length; i += 1) {
    let match = true;
    for (let j = 0; j < aliasTokens.length; j += 1) {
      if (queryTokens[i + j] !== aliasTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
};

const findLocationMatch = (query) => {
  const normalizedQuery = normalizeLocationText(query);
  if (!normalizedQuery) return null;

  const direct = LOCATION_ALIAS_INDEX.get(normalizedQuery);
  if (direct) {
    return {
      area: direct.area,
      alias: direct.alias,
      matchType: "alias-exact",
      normalizedQuery
    };
  }

  const queryTokens = tokenizeLocationText(normalizedQuery);
  let best = null;
  for (const entry of LOCATION_ALIAS_ENTRIES) {
    if (tokensContainSequence(queryTokens, entry.tokens)) {
      const score = entry.tokens.length * 10;
      if (!best || score > best.score) {
        best = { entry, score };
      }
    }
  }

  if (best) {
    return {
      area: best.entry.area,
      alias: best.entry.alias,
      matchType: "alias-token",
      normalizedQuery
    };
  }

  return null;
};

const getLocationSuggestions = (query, limit = 5) => {
  const raw = normalizeBengaliText(String(query || "").toLowerCase());
  const normalizedQuery = normalizeLocationText(raw);
  if (!normalizedQuery) return [];

  const queryTokens = tokenizeLocationText(normalizedQuery);
  const lastToken = queryTokens[queryTokens.length - 1] || "";
  const lastTokenIsZero = lastToken === "0";

  const seen = new Set();
  const scored = [];

  for (const entry of LOCATION_ALIAS_ENTRIES) {
    const area = entry.area;
    const canonicalKey = normalizeLocationText(area.canonical);
    if (seen.has(canonicalKey)) continue;

    let score = 0;
    let allow = false;

    if (entry.normalizedAlias.startsWith(normalizedQuery)) {
      score += 10;
      allow = true;
    }

    if (!allow && queryTokens.length > 0) {
      const prefixMatch = entry.tokens.slice(0, queryTokens.length).every((t, i) => t === queryTokens[i]);
      if (prefixMatch) {
        score += 8;
        allow = true;
      }
    }

    if (!allow && lastTokenIsZero && queryTokens.length >= 2) {
      const baseTokens = queryTokens.slice(0, -1);
      const baseMatch = entry.tokens.slice(0, baseTokens.length).every((t, i) => t === baseTokens[i]);
      if (baseMatch && area.number && area.number < 10) {
        score += 6;
        allow = true;
      }
    }

    if (!allow) continue;

    if (area.number && lastToken && lastToken !== "0") {
      const normalizedNum = String(area.number);
      if (normalizedNum.startsWith(lastToken)) score += 4;
      if (normalizedNum === lastToken) score += 6;
    }

    score += entry.tokens.length;

    seen.add(canonicalKey);
    scored.push({ area, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ area }) => ({
      display_name: `${area.canonical}, Dhaka, Bangladesh`,
      lat: area.lat,
      lon: area.lng,
      canonical: area.canonical,
      source: "local"
    }));
};

module.exports = {
  BENGALI_NUMBER_MAP,
  BENGALI_DIGIT_MAP,
  normalizeBengaliText,
  normalizeLocationText,
  tokenizeLocationText,
  extractLocationNumbers,
  CATEGORY_SYNONYMS,
  BUSINESS_NAMES,
  BENGALI_PREPOSITIONS,
  LOCATION_AREAS,
  LOCATION_ALIAS_ENTRIES,
  LOCATION_ALIAS_INDEX,
  LOCATION_CANONICAL_INDEX,
  LOCATION_STOPWORDS,
  findLocationMatch,
  getLocationSuggestions
};
