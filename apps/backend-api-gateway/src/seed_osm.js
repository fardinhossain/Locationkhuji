require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const axios = require("axios");

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "locationkhuji";

if (!MONGO_URL) {
  console.error("Error: MONGO_URL not found in environment. Please make sure the .env file is set up correctly.");
  process.exit(1);
}

// 1. Define Mongoose Listing Schema
const listingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ["flat", "pharmacy", "hospital", "fashion"], required: true },
  owner_id: { type: String, required: true },
  images: { type: [String], default: [] },
  address: { type: String, required: true },
  area: { type: String, required: true },
  thana: { type: String },
  district: { type: String },
  city: { type: String, default: "Dhaka" },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] }, // [Longitude, Latitude]
  },
  contact: {
    phone: { type: String, required: true },
    whatsapp: { type: String, default: null },
    email: { type: String, default: null },
  },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  tags: { type: [String], default: [] },
  is_approved: { type: Boolean, default: true },
  is_active: { type: Boolean, default: true },
  is_featured: { type: Boolean, default: false },
  average_rating: { type: Number, default: 0 },
  total_reviews: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  created_at: { type: String, default: () => new Date().toISOString() },
});

const Listing = mongoose.model("Listing", listingSchema);

// Clean serialize method
function listingToOut(doc) {
  if (!doc) return null;
  const listing = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete listing._id;
  const coordinates = listing.location?.coordinates || [];
  listing.lng = coordinates.length === 2 ? coordinates[0] : 0;
  listing.lat = coordinates.length === 2 ? coordinates[1] : 0;
  return listing;
}

async function run() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URL, { dbName: DB_NAME });
    console.log("Connected successfully to database:", DB_NAME);

    // Fetch one Admin User to be the default seed owner of these public points of interest
    const UserSchema = new mongoose.Schema({ id: String, role: String });
    const User = mongoose.model("User", UserSchema);
    const adminUser = await User.findOne({ role: "admin" }).lean();
    const defaultOwnerId = adminUser?.id || "dev-admin-001";
    console.log("Seeding listings under Owner ID:", defaultOwnerId);

    // 2. Query Overpass API for Dhaka locations
    // We target hospitals, pharmacies, marketplaces, and fashion shops in Dhaka area bounds
    console.log("Sending query to OpenStreetMap Overpass API (this can take up to 20-30 seconds)...");
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const overpassQuery = `
      [out:json][timeout:120];
      (
        node["amenity"="hospital"](23.68,90.33,23.90,90.50);
        node["amenity"="pharmacy"](23.68,90.33,23.90,90.50);
        node["amenity"="marketplace"](23.68,90.33,23.90,90.50);
        node["shop"="mall"](23.68,90.33,23.90,90.50);
        node["shop"="clothes"](23.68,90.33,23.90,90.50);
        
        way["amenity"="hospital"](23.68,90.33,23.90,90.50);
        way["amenity"="pharmacy"](23.68,90.33,23.90,90.50);
        way["amenity"="marketplace"](23.68,90.33,23.90,90.50);
        way["shop"="mall"](23.68,90.33,23.90,90.50);
      );
      out center body;
    `;

    const response = await axios.get(`${overpassUrl}?data=${encodeURIComponent(overpassQuery)}`, {
      headers: {
        "User-Agent": "LocationKhujiSeeder/1.0 (contact@locationkhuji.com)"
      }
    });

    const elements = response.data?.elements || [];
    console.log(`Successfully fetched ${elements.length} elements from OpenStreetMap!`);

    if (elements.length === 0) {
      console.log("No elements found. Exiting.");
      await mongoose.disconnect();
      return;
    }

    // 3. Parse and Map OSM nodes to LocationKhuji Listing Schema
    const listingsToInsert = [];
    const seenTitles = new Set();

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"] || tags["name:bn"];
      
      // Filter out elements that don't have names to ensure high quality titles
      if (!name) continue;

      // Deduplicate by name and coordinates to avoid overlapping seed duplicates
      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      if (!lat || !lng) continue;

      const dedupKey = `${name.toLowerCase().trim()}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
      if (seenTitles.has(dedupKey)) continue;
      seenTitles.add(dedupKey);

      // Map categories
      let category = "fashion";
      let details = {};
      let description = "";

      if (tags.amenity === "hospital" || tags.amenity === "clinic") {
        category = "hospital";
        details = {
          specialty: tags.speciality ? tags.speciality.split(";") : ["General Medical"],
          beds: tags.beds ? parseInt(tags.beds) : 100,
          open_hours: tags.opening_hours || "24/7",
          emergency: true
        };
        description = `${name} is an active healthcare facility in Dhaka, providing medical care and professional healthcare services.`;
      } else if (tags.amenity === "pharmacy") {
        category = "pharmacy";
        details = {
          open_hours: tags.opening_hours || "9 AM - 10 PM",
          emergency: tags.opening_hours === "24/7" || tags["dispensing"] === "yes",
          delivery: true
        };
        description = `${name} is a licensed pharmacy/osudh center in Dhaka, stocking generic medicines, healthcare essentials, and prescriptions.`;
      } else {
        // shop=mall, shop=clothes, amenity=marketplace
        category = "fashion";
        details = {
          brands: tags.brand ? tags.brand.split(";") : ["Local Retailers", "Premium Outlets"],
          open_hours: tags.opening_hours || "10 AM - 8 PM",
          price_range: "Mid"
        };
        description = `${name} is a busy shopping hub and retail center located in Dhaka, featuring fashion outlets, clothing selections, and consumer goods.`;
      }

      // Address mapping helpers
      const street = tags["addr:street"] || tags["addr:road"] || "";
      const citySub = tags["addr:suburb"] || tags["addr:city_district"] || tags["addr:neighbourhood"] || "";
      const city = tags["addr:city"] || "Dhaka";
      
      const fullAddress = tags["addr:full"] || 
        [street, citySub, city].filter(Boolean).join(", ") || 
        `${name}, Dhaka`;
        
      const area = citySub || tags.place || tags.suburb || "Dhaka Area";

      // Tags parsing
      const listingTags = [];
      if (tags.healthcare) listingTags.push("healthcare");
      if (tags.shop) listingTags.push("shopping");
      if (tags.brand) listingTags.push("brand");

      const doc = {
        id: new mongoose.Types.ObjectId().toString(),
        title: name,
        description: description,
        category: category,
        owner_id: defaultOwnerId,
        images: [],
        address: fullAddress,
        area: area,
        city: city,
        location: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)]
        },
        contact: {
          phone: tags.phone || tags["contact:phone"] || "+8801700000000",
          whatsapp: tags.whatsapp || "+8801700000000",
          email: tags.email || tags["contact:email"] || null
        },
        details: details,
        tags: listingTags,
        is_approved: true,
        is_active: true,
        is_featured: false,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString()
      };

      listingsToInsert.push(doc);
    }

    console.log(`Filtered and parsed ${listingsToInsert.length} high-fidelity listings ready for insertion.`);

    // 4. Bulk Write to Database
    if (listingsToInsert.length > 0) {
      console.log("Checking duplicates in database...");
      
      // Fetch existing listings within Dhaka coordinates to avoid duplicate seeding
      const existingCountBefore = await Listing.countDocuments();
      console.log(`Database currently has ${existingCountBefore} listings.`);

      // Let's execute bulk insertion!
      console.log("Inserting listings into MongoDB Atlas (this can take a few seconds)...");
      const result = await Listing.insertMany(listingsToInsert, { ordered: false });
      console.log(`Seeded successfully! Inserted ${result.length} real locations into the MongoDB database.`);

      const existingCountAfter = await Listing.countDocuments();
      console.log(`Database now has a total of ${existingCountAfter} listings.`);
    } else {
      console.log("No valid new listings to insert.");
    }

    await mongoose.disconnect();
    console.log("MongoDB connection closed cleanly.");
    process.exit(0);
  } catch (error) {
    console.error("Seeding operation failed:", error.message);
    if (mongoose.connection) await mongoose.disconnect();
    process.exit(1);
  }
}

run();
