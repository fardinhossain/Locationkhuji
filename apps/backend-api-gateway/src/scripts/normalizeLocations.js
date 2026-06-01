const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const listingSchema = new mongoose.Schema({}, { strict: false });
const Listing = mongoose.model("Listing", listingSchema, "listings");
const { BDLocationEngine } = require("../../../../packages/shared-config/index");

// Haversine distance formula to find closest district center
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URL);
  console.log("Connected.");

  const listings = await Listing.find({});
  console.log(`Found ${listings.length} listings. Validating locations...`);

  let updatedCount = 0;

  for (const listing of listings) {
    if (!listing.location || !listing.location.coordinates) continue;

    const [lng, lat] = listing.location.coordinates;
    
    // Find closest district
    const districts = BDLocationEngine.getDistricts();
    let closestDistrict = null;
    let minDistance = Infinity;

    for (const d of districts) {
      if (d.coordinates && d.coordinates.latitude) {
        const dist = getDistance(lat, lng, d.coordinates.latitude, d.coordinates.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          closestDistrict = d;
        }
      }
    }

    if (!closestDistrict) continue;

    // We now have the definitive physical district
    const division = BDLocationEngine.getDivisions().find(div => div.id === closestDistrict.divisionId);

    // Try to extract Thana from text, but ONLY accept it if it matches the physical district
    const textToCheck = `${listing.area} ${listing.address} ${listing.title} ${listing.thana || ""}`;
    const resolved = BDLocationEngine.resolveLocation(textToCheck);
    
    let validThana = null;
    if (resolved && resolved.type === "upazila" && resolved.district.id === closestDistrict.id) {
      validThana = resolved.item.name;
    } else if (resolved && resolved.type === "district" && resolved.item.id === closestDistrict.id) {
       // Just district match
    }

    // Prepare update
    const update = {
      division: division.name,
      district: closestDistrict.name,
      thana: validThana || null
    };

    // Strip "Dhaka" or "Dhaka Area" from city/area if physical district is NOT Dhaka
    if (closestDistrict.name !== "Dhaka") {
      if (listing.city === "Dhaka") update.city = "";
      if (listing.area === "Dhaka Area" || listing.area === "Dhaka") update.area = validThana || closestDistrict.name;
      if (listing.address === "Dhaka") update.address = validThana || closestDistrict.name;
      else if (listing.address && listing.address.endsWith(", Dhaka")) update.address = listing.address.replace(/, Dhaka$/, "");
    }

    // Force strict updates
    await Listing.updateOne({ id: listing.id }, { $set: update });
    updatedCount++;
    console.log(`Updated [${listing.title}] -> ${update.division} > ${update.district} > ${update.thana || 'N/A'}`);
  }

  console.log(`\nMigration complete. Updated ${updatedCount} listings.`);
  process.exit(0);
}

run().catch(console.error);
