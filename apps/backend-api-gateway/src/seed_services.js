const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/locationkhuji";

const listingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  owner_id: { type: String, required: true },
  address: { type: String, required: true },
  area: { type: String, required: true },
  thana: { type: String },
  district: { type: String, default: "Dhaka" },
  city: { type: String, default: "Dhaka" },
  location: {
    type: { type: String, default: "Point" },
    coordinates: { type: [Number], required: true },
  },
  contact: { phone: { type: String, required: true } },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  is_active: { type: Boolean, default: true },
});

const Listing = mongoose.models.Listing || mongoose.model("Listing", listingSchema);

const areas = [
  { name: "Dhanmondi", lat: 23.746, lng: 90.380 },
  { name: "Gulshan", lat: 23.792, lng: 90.410 },
  { name: "Banani", lat: 23.794, lng: 90.400 },
  { name: "Mirpur", lat: 23.822, lng: 90.368 },
  { name: "Uttara", lat: 23.873, lng: 90.396 }
];

const enServices = [
  { t: "Expert Plumber", desc: "Reliable plumbing services for home and office. Pipe fitting and repair.", sub: "Plumber", exp: "5 Years" },
  { t: "Quick Electrician", desc: "Wiring, switchboard repair, and full house electrical setup.", sub: "Electrician", exp: "8 Years" },
  { t: "Pro AC Technician", desc: "AC repair, gas refill, and installation services.", sub: "AC Technician", exp: "3 Years" },
  { t: "Home Cleaning Service", desc: "Deep cleaning for residential and commercial spaces.", sub: "Cleaner", exp: "2 Years" },
  { t: "Furniture Carpenter", desc: "Custom furniture design and repair. Door and window fixing.", sub: "Carpenter", exp: "10 Years" },
  { t: "Event Manager Pro", desc: "Wedding, birthday, and corporate event management.", sub: "Event Manager", exp: "6 Years" },
  { t: "Professional Photographer", desc: "Wedding, portrait, and product photography services.", sub: "Photographer", exp: "4 Years" },
  { t: "Pest Control Masters", desc: "Cockroach, bedbug, and termite eradication with warranty.", sub: "Pest Control", exp: "7 Years" },
  { t: "General Fixing Service", desc: "Handyman for TV mounting, curtain hanging, and small repairs.", sub: "Fixing Service", exp: "5 Years" },
  { t: "Home Painter", desc: "Interior and exterior house painting services. Quality colors.", sub: "Painter", exp: "12 Years" }
];

const bnServices = [
  { t: "দক্ষ প্লাম্বার", desc: "বাসা ও অফিসের জন্য নির্ভরযোগ্য স্যানিটারি ও প্লাম্বিং কাজ। পাইপ মেরামত।", sub: "Plumber", exp: "৫ বছর" },
  { t: "দ্রুত ইলেকট্রিশিয়ান", desc: "ওয়্যারিং, সুইচবোর্ড মেরামত এবং পুরো বাড়ির বৈদ্যুতিক কাজ।", sub: "Electrician", exp: "৮ বছর" },
  { t: "প্রো এসি টেকনিশিয়ান", desc: "এসি মেরামত, গ্যাস রিফিল এবং ইনস্টলেশন সার্ভিস।", sub: "AC Technician", exp: "৩ বছর" },
  { t: "হোম ক্লিনিং সার্ভিস", desc: "আবাসিক ও বাণিজ্যিক স্থানের জন্য ডিপ ক্লিনিং সুবিধা।", sub: "Cleaner", exp: "২ বছর" },
  { t: "ফার্নিচার কার্পেন্টার", desc: "কাস্টম আসবাবপত্র ডিজাইন এবং মেরামত। দরজা ও জানালা ঠিক করা।", sub: "Carpenter", exp: "১০ বছর" },
  { t: "ইভেন্ট ম্যানেজার প্রো", desc: "বিয়ে, জন্মদিন এবং কর্পোরেট ইভেন্ট ম্যানেজমেন্ট।", sub: "Event Manager", exp: "৬ বছর" },
  { t: "প্রফেশনাল ফটোগ্রাফার", desc: "বিয়ে, পোর্ট্রেট এবং প্রোডাক্ট ফটোগ্রাফি সার্ভিস।", sub: "Photographer", exp: "৪ বছর" },
  { t: "পেস্ট কন্ট্রোল মাস্টার্স", desc: "তেলাপোকা, ছারপোকা এবং উইপোকা ধ্বংস করার গ্যারান্টি।", sub: "Pest Control", exp: "৭ বছর" },
  { t: "জেনারেল ফিক্সিং সার্ভিস", desc: "টিভি মাউন্টিং, পর্দা টাঙানো এবং ছোটখাটো মেরামতের জন্য হ্যান্ডিম্যান।", sub: "Fixing Service", exp: "৫ বছর" },
  { t: "হোম পেইন্টার", desc: "বাসার ভেতরের এবং বাইরের রঙের কাজ। উন্নত মানের রং।", sub: "Painter", exp: "১২ বছর" }
];

function randomCoords(baseLat, baseLng) {
  const r = 0.02; 
  const lat = baseLat + (Math.random() - 0.5) * r;
  const lng = baseLng + (Math.random() - 0.5) * r;
  return [lng, lat];
}

async function seedServices() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB.");

    await Listing.deleteMany({ category: "service" });
    console.log("Cleared existing services.");

    let count = 0;
    for (let i = 0; i < 100; i++) {
      const isEnglish = i % 2 === 0;
      const svcTemplate = isEnglish 
        ? enServices[Math.floor(Math.random() * enServices.length)]
        : bnServices[Math.floor(Math.random() * bnServices.length)];
      
      const areaTemplate = areas[Math.floor(Math.random() * areas.length)];
      const coords = randomCoords(areaTemplate.lat, areaTemplate.lng);

      const listing = new Listing({
        id: `svc_seed_${i}_${Date.now()}`,
        title: `${svcTemplate.t} - ${areaTemplate.name}`,
        description: svcTemplate.desc,
        category: "service",
        owner_id: "owner@locationkhuji.com",
        address: `${Math.floor(Math.random() * 100) + 1} Main Road, ${areaTemplate.name}`,
        area: areaTemplate.name,
        thana: areaTemplate.name,
        district: "Dhaka",
        city: "Dhaka",
        location: {
          type: "Point",
          coordinates: coords
        },
        contact: { phone: `+88017${Math.floor(10000000 + Math.random() * 90000000)}` },
        details: {
          service_type: svcTemplate.sub,
          experience: svcTemplate.exp,
          availability: isEnglish ? "Mon - Sat" : "শনি - বৃহস্পতি"
        }
      });

      await listing.save();
      count++;
    }

    console.log(`Successfully seeded ${count} dummy service providers in Dhaka!`);
    mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding services:", error);
    process.exit(1);
  }
}

seedServices();
