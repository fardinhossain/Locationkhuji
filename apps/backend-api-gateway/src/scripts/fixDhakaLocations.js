/**
 * fixDhakaLocations.js — One-shot script to fix all listings that
 * incorrectly display "Dhaka" / "Dhaka Area" when their physical
 * coordinates are NOT in Dhaka district.
 *
 * Usage: node src/scripts/fixDhakaLocations.js
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "locationkhuji";

if (!MONGO_URL) {
  console.error("MONGO_URL not set");
  process.exit(1);
}

// Inline the BDLocationEngine reverse geocode data so there are NO import issues
// District center coordinates for reverse geocoding
const DISTRICTS = [
  { name: "Dhaka", division: "Dhaka", lat: 23.8103, lng: 90.4125 },
  { name: "Chattogram", division: "Chattogram", lat: 22.3569, lng: 91.7832 },
  { name: "Rajshahi", division: "Rajshahi", lat: 24.3745, lng: 88.6042 },
  { name: "Khulna", division: "Khulna", lat: 22.8456, lng: 89.5403 },
  { name: "Sylhet", division: "Sylhet", lat: 24.8949, lng: 91.8687 },
  { name: "Rangpur", division: "Rangpur", lat: 25.7439, lng: 89.2752 },
  { name: "Barishal", division: "Barishal", lat: 22.7010, lng: 90.3535 },
  { name: "Mymensingh", division: "Mymensingh", lat: 24.7471, lng: 90.4203 },
  { name: "Gazipur", division: "Dhaka", lat: 24.0023, lng: 90.4264 },
  { name: "Narayanganj", division: "Dhaka", lat: 23.6238, lng: 90.5000 },
  { name: "Comilla", division: "Chattogram", lat: 23.4607, lng: 91.1809 },
  { name: "Cox's Bazar", division: "Chattogram", lat: 21.4272, lng: 92.0058 },
  { name: "Bogura", division: "Rajshahi", lat: 24.8466, lng: 89.3773 },
  { name: "Dinajpur", division: "Rangpur", lat: 25.6279, lng: 88.6332 },
  { name: "Tangail", division: "Dhaka", lat: 24.2513, lng: 89.9165 },
  { name: "Jashore", division: "Khulna", lat: 23.1665, lng: 89.2095 },
  { name: "Narsingdi", division: "Dhaka", lat: 23.9322, lng: 90.7152 },
  { name: "Manikganj", division: "Dhaka", lat: 23.8617, lng: 90.0003 },
  { name: "Munshiganj", division: "Dhaka", lat: 23.5422, lng: 90.5305 },
  { name: "Faridpur", division: "Dhaka", lat: 23.6070, lng: 89.8420 },
  { name: "Madaripur", division: "Dhaka", lat: 23.1641, lng: 90.1897 },
  { name: "Gopalganj", division: "Dhaka", lat: 23.0051, lng: 89.8266 },
  { name: "Shariatpur", division: "Dhaka", lat: 23.2423, lng: 90.4348 },
  { name: "Rajbari", division: "Dhaka", lat: 23.7574, lng: 89.6445 },
  { name: "Kishoreganj", division: "Dhaka", lat: 24.4449, lng: 90.7766 },
  { name: "Netrokona", division: "Mymensingh", lat: 24.8863, lng: 90.7279 },
  { name: "Jamalpur", division: "Mymensingh", lat: 24.9375, lng: 89.9372 },
  { name: "Sherpur", division: "Mymensingh", lat: 25.0190, lng: 90.0171 },
  { name: "Feni", division: "Chattogram", lat: 23.0239, lng: 91.3962 },
  { name: "Noakhali", division: "Chattogram", lat: 22.8696, lng: 91.0995 },
  { name: "Lakshmipur", division: "Chattogram", lat: 22.9424, lng: 90.8282 },
  { name: "Chandpur", division: "Chattogram", lat: 23.2333, lng: 90.6712 },
  { name: "Brahmanbaria", division: "Chattogram", lat: 23.9571, lng: 91.1115 },
  { name: "Habiganj", division: "Sylhet", lat: 24.3840, lng: 91.4157 },
  { name: "Moulvibazar", division: "Sylhet", lat: 24.4829, lng: 91.7774 },
  { name: "Sunamganj", division: "Sylhet", lat: 25.0658, lng: 91.3950 },
  { name: "Rangamati", division: "Chattogram", lat: 22.6324, lng: 92.1037 },
  { name: "Bandarban", division: "Chattogram", lat: 22.1953, lng: 92.2184 },
  { name: "Khagrachhari", division: "Chattogram", lat: 23.1193, lng: 91.9847 },
  { name: "Kushtia", division: "Khulna", lat: 23.9013, lng: 89.1207 },
  { name: "Meherpur", division: "Khulna", lat: 23.7622, lng: 88.6318 },
  { name: "Chuadanga", division: "Khulna", lat: 23.6402, lng: 88.8420 },
  { name: "Jhenaidah", division: "Khulna", lat: 23.5442, lng: 89.1726 },
  { name: "Magura", division: "Khulna", lat: 23.4873, lng: 89.4190 },
  { name: "Narail", division: "Khulna", lat: 23.1724, lng: 89.5126 },
  { name: "Satkhira", division: "Khulna", lat: 22.7185, lng: 89.0715 },
  { name: "Bagerhat", division: "Khulna", lat: 22.6512, lng: 89.7851 },
  { name: "Pirojpur", division: "Barishal", lat: 22.5841, lng: 89.9720 },
  { name: "Jhalokati", division: "Barishal", lat: 22.6406, lng: 90.1987 },
  { name: "Barguna", division: "Barishal", lat: 22.1530, lng: 90.1266 },
  { name: "Patuakhali", division: "Barishal", lat: 22.3596, lng: 90.3293 },
  { name: "Bhola", division: "Barishal", lat: 22.6859, lng: 90.6482 },
  { name: "Natore", division: "Rajshahi", lat: 24.4206, lng: 89.0000 },
  { name: "Naogaon", division: "Rajshahi", lat: 24.7936, lng: 88.9318 },
  { name: "Nawabganj", division: "Rajshahi", lat: 24.5941, lng: 88.2775 },
  { name: "Pabna", division: "Rajshahi", lat: 24.0064, lng: 89.2372 },
  { name: "Sirajganj", division: "Rajshahi", lat: 24.4534, lng: 89.7006 },
  { name: "Joypurhat", division: "Rajshahi", lat: 25.0968, lng: 89.0228 },
  { name: "Nilphamari", division: "Rangpur", lat: 25.9316, lng: 88.8560 },
  { name: "Lalmonirhat", division: "Rangpur", lat: 25.9923, lng: 89.2847 },
  { name: "Kurigram", division: "Rangpur", lat: 25.8054, lng: 89.6362 },
  { name: "Gaibandha", division: "Rangpur", lat: 25.3288, lng: 89.5286 },
  { name: "Thakurgaon", division: "Rangpur", lat: 26.0336, lng: 88.4616 },
  { name: "Panchagarh", division: "Rangpur", lat: 26.3411, lng: 88.5542 },
];

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findClosestDistrict(lat, lng) {
  let closest = null;
  let minDist = Infinity;
  for (const d of DISTRICTS) {
    const dist = haversineDistance(lat, lng, d.lat, d.lng);
    if (dist < minDist) {
      minDist = dist;
      closest = d;
    }
  }
  return closest;
}

async function run() {
  console.log("=== Fix Dhaka Locations Script ===");
  console.log("Connecting to MongoDB...");
  
  const conn = await mongoose.connect(MONGO_URL, { dbName: DB_NAME });
  const db = conn.connection.db;
  const collection = db.collection("listings");
  
  const allListings = await collection.find({}).toArray();
  console.log(`Total listings in DB: ${allListings.length}`);
  
  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const listing of allListings) {
    try {
      // Skip listings without coordinates
      if (!listing.location || !listing.location.coordinates) {
        skippedCount++;
        continue;
      }
      
      const [lng, lat] = listing.location.coordinates;
      if (!lat || !lng || lat === 0 || lng === 0) {
        skippedCount++;
        continue;
      }
      
      const closest = findClosestDistrict(lat, lng);
      if (!closest) {
        skippedCount++;
        continue;
      }
      
      // Check if this listing has wrong location data
      const hasDhakaCity = listing.city === "Dhaka";
      const hasDhakaArea = listing.area === "Dhaka Area" || listing.area === "Dhaka";
      const hasDhakaAddress = listing.address === "Dhaka";
      const hasDhakaInAddress = listing.address && listing.address.includes("Dhaka");
      const hasDhakaDistrict = listing.district === "Dhaka";
      
      const isActuallyInDhaka = closest.name === "Dhaka";
      
      // If the listing is NOT in Dhaka but has Dhaka data, fix it
      if (!isActuallyInDhaka && (hasDhakaCity || hasDhakaArea || hasDhakaAddress || hasDhakaDistrict)) {
        const updateFields = {
          district: closest.name,
          division: closest.division,
        };
        
        if (hasDhakaCity) {
          updateFields.city = "";
        }
        
        if (hasDhakaArea) {
          updateFields.area = closest.name;
        }
        
        if (hasDhakaAddress) {
          updateFields.address = closest.name;
        } else if (listing.address && listing.address.endsWith(", Dhaka")) {
          updateFields.address = listing.address.replace(/, Dhaka$/, `, ${closest.name}`);
        }
        
        // Also fix description if it mentions "in Dhaka"
        if (listing.description && listing.description.includes("in Dhaka")) {
          updateFields.description = listing.description.replace(/in Dhaka/g, `in ${closest.name}`);
        }
        
        await collection.updateOne(
          { _id: listing._id },
          { $set: updateFields }
        );
        
        fixedCount++;
        console.log(`  ✅ Fixed: "${listing.title}" → ${closest.name} (${closest.division})`);
      }
      // If the listing IS in Dhaka but is missing district/division, fill them in
      else if (isActuallyInDhaka && (!listing.district || !listing.division)) {
        const updateFields = {};
        if (!listing.district) updateFields.district = "Dhaka";
        if (!listing.division) updateFields.division = "Dhaka";
        
        if (Object.keys(updateFields).length > 0) {
          await collection.updateOne(
            { _id: listing._id },
            { $set: updateFields }
          );
          fixedCount++;
          console.log(`  ✅ Fixed Dhaka listing: "${listing.title}" (added missing district/division)`);
        }
      }
      // For non-Dhaka listings that don't have Dhaka in them but may be missing district/division
      else if (!isActuallyInDhaka && (!listing.district || !listing.division)) {
        const updateFields = {};
        if (!listing.district) updateFields.district = closest.name;
        if (!listing.division) updateFields.division = closest.division;
        
        if (Object.keys(updateFields).length > 0) {
          await collection.updateOne(
            { _id: listing._id },
            { $set: updateFields }
          );
          fixedCount++;
          console.log(`  ✅ Fixed: "${listing.title}" (added missing geo: ${closest.name})`);
        }
      } else {
        skippedCount++;
      }
    } catch (err) {
      errorCount++;
      console.error(`  ❌ Error on "${listing.title}": ${err.message}`);
    }
  }
  
  console.log(`\n=== RESULTS ===`);
  console.log(`  Fixed:   ${fixedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log(`  Total:   ${allListings.length}`);
  
  await mongoose.disconnect();
  console.log("Done.");
  process.exit(0);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
