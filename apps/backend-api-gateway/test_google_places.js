const axios = require('axios');
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "AIzaSyBlZMAI3wB5KYR__nHpOnL1hXMsBkYm0ls";

async function testPlaces() {
  console.log("Testing Google Places API with key: " + GOOGLE_PLACES_API_KEY.substring(0, 8) + "...");
  try {
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/textsearch/json", {
      params: {
        query: "hospital in dhaka",
        location: "23.8103,90.4125",
        radius: 5000,
        key: GOOGLE_PLACES_API_KEY
      }
    });
    console.log("Status:", response.status);
    console.log("Results count:", response.data?.results?.length);
    if (response.data.error_message) {
      console.log("Error from Google:", response.data.error_message);
    }
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

testPlaces();
