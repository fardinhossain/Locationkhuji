const axios = require('axios');

async function testOSM() {
  const lat = 23.765; // roughly nakhalpara
  const lng = 90.395;
  const radiusKm = 5;
  const category = 'all';

  const offset = (radiusKm || 2) * 0.01;
  const south = lat - offset;
  const west = lng - offset;
  const north = lat + offset;
  const east = lng + offset;

  let stmts = [
    `node["amenity"="pharmacy"](${south},${west},${north},${east});`,
    `node["amenity"="hospital"](${south},${west},${north},${east});`,
    `node["amenity"="restaurant"](${south},${west},${north},${east});`,
    `node["amenity"="cafe"](${south},${west},${north},${east});`
  ];

  const query = `[out:json][timeout:15];\n(\n${stmts.join("\n")}\n);\nout center body;`;
  console.log("Query:", query);
  
  try {
    const response = await axios.post("https://overpass-api.de/api/interpreter", `data=${encodeURIComponent(query)}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "LocationKhujiSeeder/2.0"
      },
      timeout: 20000
    });
    
    console.log("Elements fetched:", response.data?.elements?.length);
    if (response.data?.elements?.length > 0) {
      console.log("Sample element:", response.data.elements[0]);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testOSM();
