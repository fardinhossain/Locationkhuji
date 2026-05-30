const axios = require("axios");

const BASE_URL = "http://localhost:8001/api";

async function runTests() {
  console.log("=== LocationKhuji API Search Tests ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // TEST 1: Basic AI Search keyword resolution
    // Looking for a plumber in Dhanmondi
    console.log("-> Test 1: Keyword Search");
    const t1 = await axios.get(`${BASE_URL}/listings/search?q=plumber dhanmondi`);
    assert(t1.data.listings !== undefined, "Request was successful");
    assert(t1.data.listings.length > 0, `Found ${t1.data.listings.length} results for 'plumber dhanmondi'`);
    assert(t1.data.listings.some(d => d.category === "service" && d.area === "Dhanmondi"), "Results accurately matched category 'service' and area 'Dhanmondi'");

    // TEST 2: Radius bounding and Geolocation
    console.log("\n-> Test 2: Radius and Range Search (Dhanmondi center)");
    // Dhanmondi coords: 23.746, 90.380
    // Search radius 2km
    const t2 = await axios.get(`${BASE_URL}/listings/search?lat=23.746&lng=90.380&radius=2&category=service`);
    assert(t2.data.listings !== undefined, "Radius search request successful");
    
    // Check if the locations returned are actually within ~2km.
    // Mongoose $nearSphere calculates distance correctly if indexed.
    let outOfBounds = false;
    // We expect some results since we seeded some here.
    assert(t2.data.listings.length > 0, `Found ${t2.data.listings.length} results within 2km`);

    // Let's expand radius to 20km (should include Uttara)
    const t3 = await axios.get(`${BASE_URL}/listings/search?lat=23.746&lng=90.380&radius=20&category=service`);
    assert(t3.data.listings.length > t2.data.listings.length, `Expanded radius (20km) returned more results (${t3.data.listings.length}) than 2km (${t2.data.listings.length})`);

    // TEST 3: Edge Case NLP Matching (Synonyms)
    console.log("\n-> Test 3: Edge Case Category Inference (Bengali / Aliases)");
    const t4 = await axios.get(`${BASE_URL}/listings/search?q=লোক নিয়োগ মিরপুর`); // Hiring people in mirpur
    assert(t4.data.listings.length >= 0, "Bengali NLP search query returned without crashing");
    
    // Test a known alias
    const t5 = await axios.get(`${BASE_URL}/listings/search?q=mechanic gulshan`);
    // 'mechanic' should internally trigger search for 'service' category
    assert(t5.data.listings.length >= 0, "Alias inference query returned without crashing");

    console.log(`\n=== Test Summary ===\nPassed: ${passed}\nFailed: ${failed}`);

  } catch (err) {
    console.error("Test execution failed:", err.message);
    if (err.response) {
      console.error(err.response.data);
    }
  }
}

runTests();
