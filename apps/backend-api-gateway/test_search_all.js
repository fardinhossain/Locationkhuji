const axios = require("axios");

const BASE_URL = "http://localhost:8001/api";

async function runTests() {
  console.log("=== LocationKhuji Comprehensive Search System Test ===\n");
  let passed = 0;
  let failed = 0;
  let bugsFound = [];

  function assert(condition, message, bugDesc) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
      if (bugDesc) bugsFound.push(bugDesc);
    }
  }

  try {
    // ---------------------------------------------------------
    // TEST SUITE 1: CATEGORY INFERENCE (AI & KEYWORDS)
    // ---------------------------------------------------------
    console.log("--- SUITE 1: Multi-Category AI Search ---");
    
    // 1A. Flat category
    const t_flat = await axios.get(`${BASE_URL}/listings/search?q=flat rent banani 3 beds`);
    assert(t_flat.data.listings !== undefined, "Flat search returned valid response structure", "Search API failed on 'flat rent banani'");
    
    // 1B. Pharmacy / Emergency category
    const t_pharm = await axios.get(`${BASE_URL}/listings/search?q=24 hour pharmacy dhanmondi`);
    assert(t_pharm.data.listings !== undefined, "Pharmacy search returned valid response structure", "Search API failed on 'pharmacy'");
    
    // 1C. Hospital category
    const t_hosp = await axios.get(`${BASE_URL}/listings/search?q=hospital icu mirpur`);
    assert(t_hosp.data.listings !== undefined, "Hospital search returned valid response structure", "Search API failed on 'hospital'");

    // 1D. Restaurant category
    const t_rest = await axios.get(`${BASE_URL}/listings/search?q=kacchi biryani gulshan`);
    assert(t_rest.data.listings !== undefined, "Restaurant search returned valid response structure", "Search API failed on 'restaurant'");

    // ---------------------------------------------------------
    // TEST SUITE 2: EDGE CASES AND VULNERABILITIES
    // ---------------------------------------------------------
    console.log("\n--- SUITE 2: Edge Cases & Validation ---");
    
    // 2A. Empty Query
    const t_empty = await axios.get(`${BASE_URL}/listings/search?q=`);
    // Depending on logic, empty query should return recent listings or throw valid error, shouldn't crash
    assert(t_empty.status === 200, "Empty query handled gracefully", "API crashed on empty query string");

    // 2B. Invalid Coordinates (Strings instead of numbers)
    const t_bad_coords = await axios.get(`${BASE_URL}/listings/search?lat=abc&lng=xyz&radius=5`);
    // Should fallback or return 200 with empty/all results rather than 500 error
    assert(t_bad_coords.status === 200 || t_bad_coords.status === 400, "Invalid coordinates handled gracefully", "API 500 error on invalid lat/lng type");

    // 2C. Extreme Radius
    const t_huge_rad = await axios.get(`${BASE_URL}/listings/search?lat=23.8&lng=90.4&radius=9999999`);
    assert(t_huge_rad.status === 200, "Extreme radius handled gracefully", "API crashed on extremely large radius");

    // 2D. NoSQL Injection attempts
    const t_nosql = await axios.get(`${BASE_URL}/listings/search?q={"$gt": ""}`);
    assert(t_nosql.status === 200, "NoSQL injection payloads sanitized/handled", "Vulnerable to basic NoSQL injection in query");

    // ---------------------------------------------------------
    // TEST SUITE 3: PAGINATION & LIMITS
    // ---------------------------------------------------------
    console.log("\n--- SUITE 3: Pagination ---");
    const t_page1 = await axios.get(`${BASE_URL}/listings/search?limit=2&page=1`);
    const t_page2 = await axios.get(`${BASE_URL}/listings/search?limit=2&page=2`);
    assert(t_page1.data.listings.length <= 2, "Limit parameter enforced", "Limit parameter ignored");
    
    // Check if pagination works (results should be different or empty)
    let isDifferent = true;
    if (t_page1.data.listings.length > 0 && t_page2.data.listings.length > 0) {
      if (t_page1.data.listings[0].id === t_page2.data.listings[0].id) {
        isDifferent = false;
      }
    }
    assert(isDifferent, "Pagination (page 1 vs 2) returns distinct results", "Pagination is broken, page 2 returns page 1 data");

    // ---------------------------------------------------------
    // TEST SUITE 4: GEOSPATIAL DATABASE INDEX VALIDATION
    // ---------------------------------------------------------
    console.log("\n--- SUITE 4: Geospatial Index Health ---");
    // Search strictly by coordinates with no query to verify 2dsphere index doesn't throw
    const t_geo = await axios.get(`${BASE_URL}/listings/search?lat=23.7&lng=90.3&radius=1`);
    assert(t_geo.status === 200, "Raw Geospatial 2dsphere search operates without text query", "$nearSphere index is corrupted or missing");

    console.log(`\n=== Final Report ===`);
    console.log(`Tests Passed: ${passed}`);
    console.log(`Tests Failed: ${failed}`);
    if (bugsFound.length > 0) {
      console.log("\n[!] BUGS FOUND:");
      bugsFound.forEach((b, i) => console.log(`  ${i+1}. ${b}`));
    } else {
      console.log("\n✅ ZERO BUGS FOUND IN CORE SEARCH ENGINE!");
    }

  } catch (err) {
    console.error("\n❌ SYSTEM CRASH DURING TEST EXECUTION:");
    if (err.response) {
      console.error(`Status: ${err.response.status}`);
      console.error(`Data: ${JSON.stringify(err.response.data)}`);
      console.error(`Route: ${err.config.url}`);
    } else {
      console.error(err.message);
    }
  }
}

runTests();
