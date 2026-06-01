/**
 * seed_osm_full.js — Comprehensive Bangladesh OSM Seeder for LocationKhuji
 *
 * Covers ALL major cities and divisions of Bangladesh via multiple Overpass API
 * bounding boxes. Processes regions sequentially with a 3-second delay to avoid
 * overloading the Overpass API. Uses geo-aware UPSERT logic (title + 200m radius)
 * to prevent duplicates. Queries node, way, and relation types.
 *
 * Usage:
 *   node src/seed_osm_full.js
 *   npm run seed:full
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const axios = require("axios");
const { BDLocationEngine } = require("../../packages/shared-config");

// ─── Configuration ───────────────────────────────────────────────────────────

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "locationkhuji";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT = 180; // seconds for each query
const INTER_REGION_DELAY_MS = 3000; // delay between regions

if (!MONGO_URL) {
  console.error("❌ Error: MONGO_URL not found in environment.");
  console.error("   Make sure .env is correctly configured at apps/backend-api-gateway/.env");
  process.exit(1);
}

// ─── Regions (Bounding Boxes) ────────────────────────────────────────────────
// Format: { name, city, district, bbox: [south, west, north, east] }

const REGIONS = [
  { name: "Dhaka City",       city: "Dhaka",        district: "Dhaka",        bbox: [23.60, 90.20, 24.00, 90.60] },
  { name: "Gazipur / Tongi",  city: "Gazipur",      district: "Gazipur",      bbox: [23.90, 90.30, 24.10, 90.50] },
  { name: "Narayanganj",      city: "Narayanganj",  district: "Narayanganj",  bbox: [23.55, 90.45, 23.70, 90.55] },
  { name: "Chittagong",       city: "Chittagong",   district: "Chittagong",   bbox: [22.20, 91.70, 22.45, 91.90] },
  { name: "Sylhet",           city: "Sylhet",       district: "Sylhet",       bbox: [24.85, 91.80, 24.95, 91.92] },
  { name: "Rajshahi",         city: "Rajshahi",     district: "Rajshahi",     bbox: [24.30, 88.55, 24.45, 88.70] },
  { name: "Khulna",           city: "Khulna",       district: "Khulna",       bbox: [22.78, 89.50, 22.88, 89.60] },
  { name: "Barisal",          city: "Barisal",      district: "Barisal",      bbox: [22.65, 90.30, 22.75, 90.40] },
  { name: "Rangpur",          city: "Rangpur",      district: "Rangpur",      bbox: [25.70, 89.20, 25.80, 89.30] },
  { name: "Mymensingh",       city: "Mymensingh",   district: "Mymensingh",   bbox: [24.72, 90.38, 24.80, 90.44] },
  { name: "Comilla",          city: "Comilla",      district: "Comilla",      bbox: [23.43, 91.15, 23.50, 91.25] },
  { name: "Cox's Bazar",      city: "Cox's Bazar",  district: "Cox's Bazar",  bbox: [21.42, 91.95, 21.48, 92.02] },
  { name: "Bogura",           city: "Bogura",       district: "Bogura",       bbox: [24.83, 89.35, 24.88, 89.42] },
  { name: "Dinajpur",         city: "Dinajpur",     district: "Dinajpur",     bbox: [25.60, 88.60, 25.68, 88.68] },
];

// ─── OSM Tag Queries ─────────────────────────────────────────────────────────
// Each entry produces node + way + relation queries in the Overpass QL.
// All non-medical, non-pharmacy tags map to the "fashion" category (the
// existing catch-all for markets/shops in LocationKhuji).

const OSM_QUERIES = [
  // ── Hospitals & healthcare ──
  { key: "amenity",    value: "hospital" },
  { key: "amenity",    value: "clinic" },
  { key: "amenity",    value: "doctors" },
  { key: "amenity",    value: "dentist" },
  { key: "healthcare", value: "hospital" },
  { key: "healthcare", value: "clinic" },
  // ── Pharmacies ──
  { key: "amenity",    value: "pharmacy" },
  { key: "healthcare", value: "pharmacy" },
  { key: "shop",       value: "chemist" },
  // ── Fashion & clothing ──
  { key: "shop",       value: "clothes" },
  { key: "shop",       value: "shoes" },
  { key: "shop",       value: "jewelry" },
  { key: "shop",       value: "cosmetics" },
  // ── Markets & malls ──
  { key: "amenity",    value: "marketplace" },
  { key: "shop",       value: "mall" },
  { key: "shop",       value: "supermarket" },
  { key: "shop",       value: "department_store" },
  { key: "shop",       value: "convenience" },
  { key: "shop",       value: "variety_store" },
  { key: "shop",       value: "general" },
  { key: "shop",       value: "grocery" },
  // ── Electronics & tech ──
  { key: "shop",       value: "electronics" },
  { key: "shop",       value: "mobile_phone" },
  // ── Books & stationery ──
  { key: "shop",       value: "books" },
  { key: "shop",       value: "stationery" },
  // ── Home & hardware ──
  { key: "shop",       value: "hardware" },
  { key: "shop",       value: "furniture" },
  // ── Food ──
  { key: "shop",       value: "bakery" },
  { key: "shop",       value: "butcher" },
  { key: "shop",       value: "greengrocer" },
  { key: "amenity",    value: "restaurant" },
  { key: "amenity",    value: "fast_food" },
];

// ─── Mongoose Schema (matches server.js exactly) ─────────────────────────────

const ALLOWED_CATEGORIES = ["flat", "pharmacy", "hospital", "restaurant"];

const listingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: ALLOWED_CATEGORIES, required: true },
    owner_id: { type: String, required: true },
    images: { type: [String], default: [] },
    address: { type: String, required: true },
    area: { type: String, required: true },
    thana: { type: String },
    district: { type: String },
    city: { type: String },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    contact: {
      phone: { type: String, required: true },
      whatsapp: { type: String, default: null },
      email: { type: String, default: null },
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    is_featured: { type: Boolean, default: false },
    average_rating: { type: Number, default: 0 },
    total_reviews: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

listingSchema.index({ location: "2dsphere", category: 1, is_active: 1 });
listingSchema.index({ title: "text", area: "text", thana: "text" });

const Listing = mongoose.model("Listing", listingSchema);

// User schema (minimal, just to look up admin owner ID)
const userSchema = new mongoose.Schema({ id: String, role: String }, { versionKey: false, strict: false });
const User = mongoose.model("User", userSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the Overpass QL query string for a single region.
 * Queries node, way, and relation for every tag in OSM_QUERIES.
 */
function buildOverpassQuery(bbox) {
  const bboxStr = bbox.join(",");
  const stmts = [];
  for (const q of OSM_QUERIES) {
    for (const type of ["node", "way", "relation"]) {
      stmts.push(`  ${type}["${q.key}"="${q.value}"](${bboxStr});`);
    }
  }
  return `[out:json][timeout:${OVERPASS_TIMEOUT}];\n(\n${stmts.join("\n")}\n);\nout center body;`;
}

/**
 * Map an OSM element's tags to a LocationKhuji category.
 */
function mapCategory(tags) {
  // Hospital / healthcare
  if (
    tags.amenity === "hospital" ||
    tags.amenity === "clinic" ||
    tags.amenity === "doctors" ||
    tags.amenity === "dentist" ||
    tags.healthcare === "hospital" ||
    tags.healthcare === "clinic"
  ) {
    return "hospital";
  }
  // Pharmacy
  if (
    tags.amenity === "pharmacy" ||
    tags.healthcare === "pharmacy" ||
    tags.shop === "chemist"
  ) {
    return "pharmacy";
  }
  // Restaurant (fallback)
  return "restaurant";
}

/**
 * Build rich details object based on category and OSM tags.
 */
function buildDetails(category, tags) {
  if (category === "hospital") {
    return {
      specialty: tags.speciality || tags["healthcare:speciality"]
        ? (tags.speciality || tags["healthcare:speciality"]).split(";").map((s) => s.trim())
        : ["General Medical"],
      beds: tags.beds ? parseInt(tags.beds, 10) : null,
      open_hours: tags.opening_hours || "24/7",
      emergency: tags.emergency === "yes" || tags.amenity === "hospital",
    };
  }
  if (category === "pharmacy") {
    return {
      open_hours: tags.opening_hours || "9 AM - 10 PM",
      emergency: tags.opening_hours === "24/7" || tags.dispensing === "yes",
      delivery: true,
    };
  }
  // restaurant (catch-all for food, etc.)
  const result = {
    open_hours: tags.opening_hours || "10 AM - 8 PM",
    price_range: "Mid",
  };
  if (tags.brand) result.brands = tags.brand.split(";").map((s) => s.trim());
  if (tags.cuisine) result.cuisine = tags.cuisine.split(";").map((s) => s.trim());
  return result;
}

/**
 * Determine the sub-type label of a restaurant listing for richer descriptions.
 */
function getShopSubType(tags) {
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "fast_food") return "fast_food";
  if (tags.amenity === "marketplace") return "marketplace";
  if (tags.shop === "mall") return "mall";
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.shop === "department_store") return "department_store";
  if (tags.shop === "convenience" || tags.shop === "general" || tags.shop === "variety_store") return "convenience";
  if (tags.shop === "grocery" || tags.shop === "greengrocer") return "grocery";
  if (tags.shop === "clothes" || tags.shop === "shoes") return "shop";
  if (tags.shop === "jewelry" || tags.shop === "cosmetics") return "accessories";
  if (tags.shop === "electronics" || tags.shop === "mobile_phone") return "electronics";
  if (tags.shop === "books" || tags.shop === "stationery") return "books";
  if (tags.shop === "hardware" || tags.shop === "furniture") return "home";
  if (tags.shop === "bakery") return "bakery";
  if (tags.shop === "butcher") return "butcher";
  return "shop";
}

/** Sub-type → human-readable description fragments. */
const SUBTYPE_DESCRIPTIONS = {
  restaurant:       "a popular dining spot offering delicious cuisine",
  fast_food:        "a quick-service food outlet for fast and affordable meals",
  marketplace:      "a vibrant marketplace and trading hub with diverse vendors",
  mall:             "a modern shopping mall with retail stores and entertainment",
  supermarket:      "a well-stocked supermarket for groceries and household essentials",
  department_store: "a multi-floor department store carrying a wide range of products",
  convenience:      "a convenient neighborhood shop for everyday essentials",
  grocery:          "a grocery and fresh-produce store for daily needs",
  fashion:          "a fashion and clothing destination with trendy selections",
  accessories:      "a jewelry, cosmetics, and accessories boutique",
  electronics:      "an electronics and gadget shop for phones, computers, and devices",
  books:            "a bookshop and stationery store for readers and students",
  home:             "a home improvement and furniture store",
  bakery:           "a bakery and confectionery offering fresh baked goods",
  butcher:          "a meat shop and butchery providing fresh cuts",
  shop:             "a retail and shopping destination",
};

/**
 * Build a human-readable description based on category and OSM tags.
 */
function buildDescription(name, category, cityName, tags) {
  if (category === "hospital") {
    return `${name} is an active healthcare facility in ${cityName}, providing medical care and professional healthcare services.`;
  }
  if (category === "pharmacy") {
    return `${name} is a licensed pharmacy in ${cityName}, stocking medicines, healthcare essentials, and prescriptions.`;
  }
  // Restaurant — use sub-type for a specific description
  const subType = getShopSubType(tags);
  const fragment = SUBTYPE_DESCRIPTIONS[subType] || SUBTYPE_DESCRIPTIONS.shop;
  return `${name} is ${fragment} in ${cityName}.`;
}

/**
 * Extract a phone number from OSM tags, with fallback.
 */
function extractPhone(tags) {
  const raw = tags.phone || tags["contact:phone"] || tags["phone:mobile"] || "";
  if (raw) {
    // Take the first number if semicolon-separated
    const first = raw.split(";")[0].trim();
    if (first) return first;
  }
  return "+8801700000000"; // fallback placeholder
}

/**
 * Parse a single OSM element into a LocationKhuji listing document.
 */
function parseElement(el, region, defaultOwnerId) {
  const tags = el.tags || {};

  // Must have a name
  const name = tags.name || tags["name:en"] || tags["name:bn"];
  if (!name) return null;

  // Resolve coordinates (node has lat/lon directly; way/relation use center)
  const lat = el.lat || el.center?.lat;
  const lng = el.lon || el.center?.lon;
  if (!lat || !lng) return null;

  const category = mapCategory(tags);
  const details = buildDetails(category, tags);
  const description = buildDescription(name, category, region.city, tags);

  // Geometric reverse geocoding
  const resolvedGeo = BDLocationEngine.reverseGeocode(Number(lat), Number(lng));
  const derivedCity = resolvedGeo?.district || region.city;
  const derivedArea = resolvedGeo?.thana || derivedCity || `${region.city} Area`;
  const derivedDivision = resolvedGeo?.division || region.city;

  // Address extraction
  const street = tags["addr:street"] || tags["addr:road"] || "";
  const suburb = tags["addr:suburb"] || tags["addr:city_district"] || tags["addr:neighbourhood"] || "";
  const addrCity = tags["addr:city"] || "";
  
  const area = suburb || tags.place || tags.suburb || derivedArea;
  
  const fullAddress =
    tags["addr:full"] ||
    [street, area, addrCity].filter(Boolean).join(", ") ||
    `${name}, ${derivedArea}`;

  const thana = resolvedGeo?.thana || tags["addr:subdistrict"] || tags["addr:suburb"] || null;
  const district = resolvedGeo?.district || tags["addr:district"] || region.district;
  const division = derivedDivision;

  // Tags for search / filtering
  const listingTags = [];
  if (tags.healthcare) listingTags.push("healthcare");
  if (tags.shop) listingTags.push("shopping");
  if (tags.brand) listingTags.push("brand");
  if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy" || tags.shop === "chemist") {
    listingTags.push("medicine");
  }
  if (tags.amenity === "hospital" || tags.amenity === "clinic") listingTags.push("emergency");
  if (tags.opening_hours === "24/7") listingTags.push("24/7");
  // Sub-type tags for richer filtering
  if (tags.amenity === "restaurant" || tags.amenity === "fast_food") listingTags.push("food", "restaurant");
  if (tags.shop === "electronics" || tags.shop === "mobile_phone") listingTags.push("electronics");
  if (tags.shop === "grocery" || tags.shop === "greengrocer" || tags.shop === "supermarket") listingTags.push("grocery");
  if (tags.shop === "bakery" || tags.shop === "butcher") listingTags.push("food");
  if (tags.shop === "jewelry" || tags.shop === "cosmetics") listingTags.push("accessories");
  if (tags.shop === "books" || tags.shop === "stationery") listingTags.push("books");
  if (tags.shop === "hardware" || tags.shop === "furniture") listingTags.push("home");
  if (tags.amenity === "marketplace") listingTags.push("market");
  if (tags.cuisine) listingTags.push(...tags.cuisine.split(";").map((s) => s.trim().toLowerCase()).slice(0, 3));

  return {
    id: new mongoose.Types.ObjectId().toString(),
    title: name,
    description,
    category,
    owner_id: defaultOwnerId,
    images: [],
    address: fullAddress,
    area,
    thana,
    district,
    division,
    city: addrCity,
    location: {
      type: "Point",
      coordinates: [Number(lng), Number(lat)],
    },
    contact: {
      phone: extractPhone(tags),
      whatsapp: tags.whatsapp || null,
      email: tags.email || tags["contact:email"] || null,
    },
    details,
    tags: listingTags,
    is_active: true,
    is_featured: false,
    average_rating: 0,
    total_reviews: 0,
    reportCount: 0,
    created_at: new Date().toISOString(),
  };
}

/**
 * UPSERT logic: Check if a listing with the same title already exists within
 * 200 meters. If so, skip the insert.
 */
async function upsertListing(doc) {
  const existing = await Listing.findOne({
    title: doc.title,
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: doc.location.coordinates,
        },
        $maxDistance: 200, // meters
      },
    },
  }).lean();

  if (existing) return false; // duplicate — skip

  try {
    await Listing.create(doc);
    return true; // inserted
  } catch (err) {
    // Handle duplicate key (e.g. id collision — extremely unlikely with ObjectId)
    if (err.code === 11000) return false;
    throw err;
  }
}

// ─── Region Fetcher ──────────────────────────────────────────────────────────

async function fetchAndSeedRegion(region, defaultOwnerId) {
  const { name, bbox } = region;
  const query = buildOverpassQuery(bbox);

  console.log(`\n┌─ 🌍 Region: ${name}`);
  console.log(`│  Bbox: [${bbox.join(", ")}]`);
  console.log(`│  Querying Overpass API…`);

  let elements = [];
  try {
    const response = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "LocationKhujiSeeder/2.0 (contact@locationkhuji.com)",
        },
        timeout: (OVERPASS_TIMEOUT + 30) * 1000, // HTTP timeout slightly longer than query timeout
      }
    );
    elements = response.data?.elements || [];
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.remark || err.message;
    console.log(`│  ❌ Overpass API error (HTTP ${status || "?"}): ${msg}`);
    console.log(`└─ Skipping ${name}, moving to next region.\n`);
    return { fetched: 0, parsed: 0, inserted: 0, skipped: 0, error: true };
  }

  console.log(`│  Fetched ${elements.length} raw OSM elements.`);

  // Deduplicate within this batch (by name + rounded coords)
  const localSeen = new Set();
  const parsed = [];

  for (const el of elements) {
    const doc = parseElement(el, region, defaultOwnerId);
    if (!doc) continue;

    const lat = doc.location.coordinates[1].toFixed(4);
    const lng = doc.location.coordinates[0].toFixed(4);
    const dedupKey = `${doc.title.toLowerCase().trim()}-${lat}-${lng}`;
    if (localSeen.has(dedupKey)) continue;
    localSeen.add(dedupKey);
    parsed.push(doc);
  }

  console.log(`│  Parsed ${parsed.length} named, unique listings.`);

  // Upsert into database in parallel batches of 50 (geo-dedup check)
  let inserted = 0;
  let skipped = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const chunk = parsed.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map(async (doc) => {
        try {
          const wasInserted = await upsertListing(doc);
          return wasInserted ? "inserted" : "skipped";
        } catch (err) {
          // Handle potential issues gracefully, don't crash
          return "error";
        }
      })
    );

    for (const res of results) {
      if (res === "inserted") inserted++;
      if (res === "skipped") skipped++;
    }
  }

  console.log(`│  ✅ Inserted: ${inserted} | ⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`└─ Done: ${name}`);

  return { fetched: elements.length, parsed: parsed.length, inserted, skipped, error: false };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  🗺️  LocationKhuji — Full Bangladesh OSM Seeder v2.0");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Regions:    ${REGIONS.length}`);
  console.log(`  OSM Tags:   ${OSM_QUERIES.length}`);
  console.log(`  Categories: hospital, pharmacy, restaurant`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  try {
    // 1. Connect to MongoDB
    console.log("🔌 Connecting to MongoDB Atlas…");
    await mongoose.connect(MONGO_URL, { dbName: DB_NAME });
    console.log(`✅ Connected to database: ${DB_NAME}`);

    // 2. Ensure the 2dsphere index exists (needed for $near queries in upsert)
    console.log("📐 Ensuring geospatial indexes…");
    await Listing.createIndexes();
    console.log("✅ Indexes ready.\n");

    // 3. Resolve default owner ID (admin user)
    const adminUser = await User.findOne({ role: "admin" }).lean();
    const defaultOwnerId = adminUser?.id || "dev-admin-001";
    console.log(`👤 Seeding listings under owner: ${defaultOwnerId}`);

    const countBefore = await Listing.countDocuments();
    console.log(`📊 Current listing count in database: ${countBefore}`);

    // 4. Process each region sequentially
    const totals = { fetched: 0, parsed: 0, inserted: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < REGIONS.length; i++) {
      const region = REGIONS[i];
      const progress = `[${i + 1}/${REGIONS.length}]`;
      console.log(`\n${progress} Processing ${region.name}…`);

      const result = await fetchAndSeedRegion(region, defaultOwnerId);
      totals.fetched += result.fetched;
      totals.parsed += result.parsed;
      totals.inserted += result.inserted;
      totals.skipped += result.skipped;
      if (result.error) totals.errors++;

      // Delay between regions (skip delay after the last one)
      if (i < REGIONS.length - 1) {
        console.log(`⏳ Waiting ${INTER_REGION_DELAY_MS / 1000}s before next region…`);
        await sleep(INTER_REGION_DELAY_MS);
      }
    }

    // 5. Print summary
    const countAfter = await Listing.countDocuments();

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  📋 SEEDING SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Regions processed :  ${REGIONS.length - totals.errors} / ${REGIONS.length}`);
    console.log(`  Regions failed    :  ${totals.errors}`);
    console.log(`  OSM elements      :  ${totals.fetched}`);
    console.log(`  Parsed listings   :  ${totals.parsed}`);
    console.log(`  Inserted (new)    :  ${totals.inserted}`);
    console.log(`  Skipped (dupes)   :  ${totals.skipped}`);
    console.log(`  DB before         :  ${countBefore}`);
    console.log(`  DB after          :  ${countAfter}`);
    console.log(`  Net new listings  :  ${countAfter - countBefore}`);
    console.log("═══════════════════════════════════════════════════════════════\n");

    await mongoose.disconnect();
    console.log("🔒 MongoDB connection closed cleanly.");
    process.exit(0);
  } catch (error) {
    console.error("\n💥 Fatal error during seeding:", error.message);
    console.error(error.stack);
    if (mongoose.connection) await mongoose.disconnect();
    process.exit(1);
  }
}

run();
