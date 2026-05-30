const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const axios = require("axios");

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/locationkhuji";

const listingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  owner_id: { type: String, required: true },
  images: { type: [String], default: [] },
  address: { type: String, required: true },
  area: { type: String, required: true },
  city: { type: String, default: "Dhaka" },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], default: [0, 0] },
  },
  contact: { phone: { type: String, required: true } },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  is_active: { type: Boolean, default: true },
}, { strict: false });

const Listing = mongoose.models.Listing || mongoose.model("Listing", listingSchema);

async function hardResetRestaurants() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to Database...");
    
    // 1. DANGEROUS BUT NECESSARY: Delete ALL listings currently categorized as "restaurant"
    // This wipes out all the fake "Bata Shoes", "Yellow", etc. that got mislabeled
    const delRes = await Listing.deleteMany({ category: "restaurant" });
    console.log(`Deleted ${delRes.deletedCount} items from the 'restaurant' category.`);
    
    // 2. Fetch fresh, strictly REAL restaurants from OpenStreetMap
    console.log("Fetching fresh legitimate restaurants from OSM...");
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="restaurant"](23.68,90.33,23.90,90.50);
        node["amenity"="cafe"](23.68,90.33,23.90,90.50);
        node["amenity"="fast_food"](23.68,90.33,23.90,90.50);
      );
      out center body;
    `;
    
    const response = await axios.get(`${overpassUrl}?data=${encodeURIComponent(overpassQuery)}`, {
      headers: { "User-Agent": "LocationKhujiFixer/1.0" }
    });
    
    const elements = response.data?.elements || [];
    console.log(`Found ${elements.length} real restaurants in Dhaka.`);
    
    let inserted = 0;
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"] || tags["name:bn"];
      if (!name) continue;
      
      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      if (!lat || !lng) continue;
      
      const cuisineStr = tags.cuisine || "Local";
      const doc = {
        id: new mongoose.Types.ObjectId().toString(),
        title: name,
        description: `${name} is a local dining establishment offering delicious meals.`,
        category: "restaurant",
        owner_id: "admin@locationkhuji.com",
        images: ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800"],
        address: tags["addr:full"] || tags["addr:street"] || `${name}, Dhaka`,
        area: tags["addr:suburb"] || "Dhaka Area",
        city: "Dhaka",
        location: { type: "Point", coordinates: [lng, lat] },
        contact: { phone: tags.phone || "01711000000" },
        details: {
          cuisine: cuisineStr.split(";").map(s => s.trim()),
          open_hours: tags.opening_hours || "10 AM - 10 PM",
          delivery: true
        }
      };
      
      await Listing.create(doc);
      inserted++;
      
      // Just seed up to 50 for quick testing
      if (inserted >= 50) break;
    }
    
    console.log(`Successfully re-seeded ${inserted} genuine restaurants!`);
    
  } catch (err) {
    console.error("Error during reset:", err);
  } finally {
    mongoose.disconnect();
  }
}

hardResetRestaurants();
