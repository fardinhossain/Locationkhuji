const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/locationkhuji";

const listingSchema = new mongoose.Schema({
  category: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const Listing = mongoose.models.Listing || mongoose.model("Listing", listingSchema);

async function fix() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB to clean up fake restaurants...");
    
    // Find all restaurants that don't have a cuisine field
    // (These are actually the old fashion/market items that got renamed)
    const result = await Listing.deleteMany({
      category: "restaurant",
      "details.cuisine": { $exists: false }
    });
    
    console.log(`Deleted ${result.deletedCount} non-restaurant items that were miscategorized.`);
    
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

fix();
