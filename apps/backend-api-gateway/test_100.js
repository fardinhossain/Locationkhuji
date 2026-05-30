const axios = require("axios");

const BASE_URL = "http://localhost:8001/api";

const categories = ["flat", "hospital", "pharmacy", "restaurant", "service", "all", "invalid_cat"];
const keywords = [
  "plumber", "3 bed apartment", "kacchi biryani", "icu hospital", 
  "24/7 medicine", "লোক নিয়োগ", "mechanic in gulshan", "rent", 
  "pizza", "electrician", "cleaner", "doctor", "", "   ", "a", 
  "123", "!@#$%^&*", "SELECT * FROM listings", "{ \"$gt\": \"\" }"
];
const areas = [
  "dhanmondi", "gulshan", "banani", "mirpur", "uttara", 
  "chittagong", "sylhet", "nowhere_city", ""
];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomLat() {
  // Bangladesh approx: 20.0 to 27.0
  return (Math.random() * 7 + 20).toFixed(4);
}

function getRandomLng() {
  // Bangladesh approx: 88.0 to 93.0
  return (Math.random() * 5 + 88).toFixed(4);
}

async function runFuzzTest() {
  console.log("=== LocationKhuji 100-Query Fuzz Test ===");
  console.log("Firing 100 randomized complex API requests...");

  let passed = 0;
  let failed = 0;
  let errorLog = [];

  const promises = [];

  for (let i = 1; i <= 100; i++) {
    // Generate chaotic query
    const q = encodeURIComponent(`${getRandom(keywords)} ${getRandom(areas)}`.trim());
    const cat = Math.random() > 0.3 ? `category=${getRandom(categories)}` : "";
    
    // Sometimes send coords, sometimes don't. Sometimes send invalid coords.
    let coords = "";
    const coordRoll = Math.random();
    if (coordRoll > 0.5) {
      coords = `lat=${getRandomLat()}&lng=${getRandomLng()}`;
    } else if (coordRoll > 0.4) {
      coords = `lat=invalid&lng=also_invalid`;
    }

    const radius = Math.random() > 0.5 ? `radius=${Math.floor(Math.random() * 100)}` : "";
    const limit = `limit=${Math.floor(Math.random() * 200)}`;

    const params = [q ? `q=${q}` : "", cat, coords, radius, limit].filter(p => p).join("&");
    const url = `${BASE_URL}/listings/search?${params}`;

    // Fire request sequentially with delay
    try {
      const res = await axios.get(url, { timeout: 10000 });
      if (res.status === 200 && res.data.success && res.data.listings !== undefined) {
        passed++;
      } else {
        failed++;
        errorLog.push(`Request ${i} returned abnormal data structure: ${url}`);
      }
    } catch (err) {
      failed++;
      const status = err.response ? err.response.status : "NETWORK_ERROR";
      if (status === 400) {
        passed++;
        failed--;
      } else {
         errorLog.push(`Request ${i} Failed [${status}]: ${url}`);
      }
    }
    // Small delay to avoid DDOSing Nominatim OpenStreetMap
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log("\n=== 100-Test Execution Complete ===");
  console.log(`✅ Successes/Handled: ${passed}`);
  console.log(`❌ Crashes/Failures: ${failed}`);

  if (errorLog.length > 0) {
    console.log("\n[!] Error Details:");
    errorLog.slice(0, 10).forEach(e => console.log("  - " + e));
    if (errorLog.length > 10) console.log(`  ...and ${errorLog.length - 10} more.`);
  } else {
    console.log("\n🎉 The server survived 100 randomized chaos queries without a single crash!");
  }
}

runFuzzTest();
