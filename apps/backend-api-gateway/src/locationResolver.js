const axios = require("axios");
const {
  normalizeLocationText,
  tokenizeLocationText,
  extractLocationNumbers,
  findLocationMatch,
  CATEGORY_SYNONYMS,
  BENGALI_PREPOSITIONS,
  BUSINESS_NAMES
} = require("shared-config");

const geocodeCache = new Map();
const resolutionCache = new Map();

const REQUIRED_TOKENS = new Set([
  "sector", "sec", "road", "rd", "block", "blk", "phase", "zone",
  "সেক্টর", "রোড", "ব্লক"
]);

const BASE_DHAKA_TOKENS = new Set([
  "dhaka", "mirpur", "dhanmondi", "gulshan", "banani", "uttara",
  "mohammadpur", "bashundhara", "farmgate", "tejgaon"
]);

const LOCATION_STOPWORDS = new Set([
  "in", "near", "around", "inside", "at", "find", "search", "me", "show",
  "for", "the", "a", "an", "best", "good", "cheap", "under", "below",
  "with", "want", "need", "looking", "please", "area", "place", "places"
]);

const dhakaViewbox = "90.3,23.9,90.5,23.6";

const debugLog = (enabled, prefix, message, payload) => {
  if (!enabled) return;
  const label = prefix ? `[${prefix}] ` : "";
  if (payload !== undefined) {
    console.log(`${label}${message}`, payload);
  } else {
    console.log(`${label}${message}`);
  }
};

const stripLocationNoise = (text) => {
  let out = normalizeLocationText(text);

  out = out.replace(CATEGORY_SYNONYMS.flat, " ")
    .replace(CATEGORY_SYNONYMS.pharmacy, " ")
    .replace(CATEGORY_SYNONYMS.hospital, " ")
    .replace(CATEGORY_SYNONYMS.restaurant, " ")
    .replace(CATEGORY_SYNONYMS.service, " ");

  out = out.replace(/\d+\s*(?:km|k\.m\.|kilometer|kilometers|কিলোমিটার|কিমি|meters?|range)/gi, " ");

  const prepStr = BENGALI_PREPOSITIONS.join("|");
  out = out.replace(new RegExp(`\\b(?:in|near|around|inside|at|find|search|me|show|for|the|a|an|best|good|cheap|under|below|with|want|need|looking|please|${prepStr})\\b`, "gi"), " ");

  out = out.replace(/\s+/g, " ").trim();
  return out;
};

const extractLocationCandidates = (query) => {
  const normalized = normalizeLocationText(query);
  const candidates = new Set();

  const prepStr = BENGALI_PREPOSITIONS.join("|");
  const prepMatch = normalized.match(new RegExp(`(?:^|\\s)(?:in|near|around|inside|at|${prepStr})\\s+([a-z0-9\\u0980-\\u09FF\s-]+)`, "i"));
  if (prepMatch && prepMatch[1]) {
    const cleaned = stripLocationNoise(prepMatch[1]);
    if (cleaned) candidates.add(cleaned);
  }

  const residual = stripLocationNoise(normalized);
  if (residual) candidates.add(residual);

  return Array.from(candidates).filter((c) => c.length > 2);
};

const shouldPreferDhaka = (normalizedQuery) => {
  for (const token of tokenizeLocationText(normalizedQuery)) {
    if (BASE_DHAKA_TOKENS.has(token)) return true;
  }
  return false;
};

const hasRequiredTokenMismatch = (queryTokens, candidateTokens) => {
  const required = queryTokens.filter((t) => REQUIRED_TOKENS.has(t));
  if (!required.length) return false;
  return !required.every((t) => candidateTokens.includes(t));
};

const scoreCandidate = (query, candidate) => {
  const normalizedQuery = normalizeLocationText(query);
  const candidateText = candidate.display_name || "";
  const normalizedCandidate = normalizeLocationText(candidateText);

  const queryTokens = tokenizeLocationText(normalizedQuery).filter((t) => !LOCATION_STOPWORDS.has(t));
  const candidateTokens = tokenizeLocationText(normalizedCandidate);

  const queryNumbers = extractLocationNumbers(normalizedQuery);
  const candidateNumbers = extractLocationNumbers(normalizedCandidate);

  if (queryNumbers.length > 0) {
    const hasAllNumbers = queryNumbers.every((n) => candidateNumbers.includes(n));
    if (!hasAllNumbers) {
      return { accepted: false, score: -1, reason: "number-mismatch" };
    }
  }

  if (hasRequiredTokenMismatch(queryTokens, candidateTokens)) {
    return { accepted: false, score: -1, reason: "required-token-mismatch" };
  }

  if (queryTokens.length > 0) {
    const tokenMatches = queryTokens.filter((t) => candidateTokens.includes(t));
    if (!tokenMatches.length) {
      return { accepted: false, score: -1, reason: "token-mismatch" };
    }
  }

  if (candidate.address?.country_code && candidate.address.country_code !== "bd") {
    return { accepted: false, score: -1, reason: "country-mismatch" };
  }

  let score = 0;
  for (const token of queryTokens) {
    if (candidateTokens.includes(token)) score += 2;
  }

  if (normalizedCandidate.includes(normalizedQuery)) score += 6;
  if (candidate.address?.state?.toLowerCase() === "dhaka") score += 2;
  if (candidate.address?.city?.toLowerCase() === "dhaka") score += 2;
  if (candidate.type === "administrative") score += 1;

  return { accepted: score >= 6, score, reason: score >= 6 ? "accepted" : "low-score" };
};

const geocodeLocationWithConfidence = async (query, options = {}) => {
  const normalizedQuery = normalizeLocationText(query);
  if (!normalizedQuery) return null;

  const cacheKey = normalizedQuery.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const preferDhaka = options.preferDhaka || shouldPreferDhaka(normalizedQuery);
  const viewbox = preferDhaka ? `&viewbox=${dhakaViewbox}&bounded=0` : "";

  debugLog(options.debug, options.logPrefix, "Geocoding query", { query, preferDhaka });

  const response = await axios.get(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&countrycodes=bd&limit=5${viewbox}`,
    {
      headers: { "User-Agent": "LocationKhuji/1.0 (contact@locationkhuji.com)" },
      timeout: 5000
    }
  );

  const results = Array.isArray(response.data) ? response.data : [];
  const scored = [];

  for (const candidate of results) {
    const verdict = scoreCandidate(query, candidate);
    debugLog(options.debug, options.logPrefix, "Geocode candidate", {
      displayName: candidate.display_name,
      score: verdict.score,
      reason: verdict.reason
    });
    if (verdict.accepted) {
      scored.push({ candidate, score: verdict.score });
    }
  }

  const best = scored.sort((a, b) => b.score - a.score)[0];
  if (!best) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const result = {
    lat: parseFloat(best.candidate.lat),
    lng: parseFloat(best.candidate.lon),
    displayName: best.candidate.display_name
  };

  geocodeCache.set(cacheKey, result);
  if (geocodeCache.size > 1000) {
    const firstKey = geocodeCache.keys().next().value;
    geocodeCache.delete(firstKey);
  }

  return result;
};

const resolveLocationFromQuery = async (query, options = {}) => {
  const normalizedQuery = normalizeLocationText(query);
  if (!normalizedQuery) return { found: false };

  if (resolutionCache.has(normalizedQuery)) {
    return resolutionCache.get(normalizedQuery);
  }

  const debug = !!options.debug;
  const logPrefix = options.logPrefix || "LOCATION";

  debugLog(debug, logPrefix, "Normalized query", normalizedQuery);

  const directMatch = findLocationMatch(query);
  if (directMatch && directMatch.area) {
    const resolved = {
      found: true,
      lat: directMatch.area.lat,
      lng: directMatch.area.lng,
      displayName: directMatch.area.canonical,
      matchType: directMatch.matchType,
      matchedAlias: directMatch.alias,
      confidence: 1.0,
      source: "dictionary"
    };
    debugLog(debug, logPrefix, "Matched alias", resolved);
    resolutionCache.set(normalizedQuery, resolved);
    if (resolutionCache.size > 1000) {
      const firstKey = resolutionCache.keys().next().value;
      resolutionCache.delete(firstKey);
    }
    return resolved;
  }

  const candidates = extractLocationCandidates(query);
  debugLog(debug, logPrefix, "Extracted candidates", candidates);

  for (const candidate of candidates) {
    const lowerCandidate = normalizeLocationText(candidate);
    const hasBusinessName = BUSINESS_NAMES.some((b) => lowerCandidate.includes(b));
    if (hasBusinessName) {
      debugLog(debug, logPrefix, "Rejected business candidate", candidate);
      continue;
    }

    const geocoded = await geocodeLocationWithConfidence(candidate, {
      preferDhaka: options.preferDhaka,
      debug,
      logPrefix
    });

    if (geocoded) {
      const resolved = {
        found: true,
        lat: geocoded.lat,
        lng: geocoded.lng,
        displayName: geocoded.displayName,
        matchType: "geocode",
        matchedAlias: candidate,
        confidence: 0.7,
        source: "geocoder"
      };
      debugLog(debug, logPrefix, "Resolved location", resolved);
      resolutionCache.set(normalizedQuery, resolved);
      if (resolutionCache.size > 1000) {
        const firstKey = resolutionCache.keys().next().value;
        resolutionCache.delete(firstKey);
      }
      return resolved;
    }

    debugLog(debug, logPrefix, "Rejected candidate", candidate);
  }

  const fallback = { found: false };
  resolutionCache.set(normalizedQuery, fallback);
  if (resolutionCache.size > 1000) {
    const firstKey = resolutionCache.keys().next().value;
    resolutionCache.delete(firstKey);
  }
  return fallback;
};

module.exports = {
  resolveLocationFromQuery
};
