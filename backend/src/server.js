// Express backend for LocationKhuji with Firebase Auth, MongoDB, and Cloudinary.

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const mongoose = require("mongoose");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const admin = require("firebase-admin");
const { Readable } = require("stream");

const { Server } = require("socket.io");

const PORT = process.env.PORT || 8001;
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "locationkhuji";
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const APP_NAME = "locationkhuji";
const FIREBASE_SA = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
const DEV_MODE = process.env.NODE_ENV === "development" && (!FIREBASE_SA || FIREBASE_SA.includes("your-project-id"));

const ALLOWED_ROLES = ["user", "owner", "admin"];
const ALLOWED_CATEGORIES = ["flat", "pharmacy", "hospital", "fashion"];
const FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function apiError(status, detail) {
  const err = new Error(detail);
  err.status = status;
  return err;
}

function normalizePrivateKey(privateKey) {
  return privateKey ? privateKey.replace(/\\n/g, "\n") : privateKey;
}

function toPlain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") return doc.toObject();
  return { ...doc };
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    avatar: user.avatar || null,
    phone: user.phone || null,
    saved_listings: user.saved_listings || [],
    created_at: user.created_at || null,
  };
}

function listingToOut(doc) {
  const listing = toPlain(doc);
  if (!listing) return null;
  delete listing._id;
  const coordinates = listing.location?.coordinates || [];
  listing.lng = coordinates.length === 2 ? coordinates[0] : 0;
  listing.lat = coordinates.length === 2 ? coordinates[1] : 0;
  return listing;
}

function ownerInfo(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || null,
    avatar: user.avatar || null,
    phone: user.phone || null,
  };
}

function parseRole(value) {
  if (!value) return "user";
  return String(value).toLowerCase();
}

function extractToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  if (req.cookies?.access_token) return req.cookies.access_token;
  return null;
}

function sendAuthCookies(res, accessToken, refreshToken) {
  const secure = process.env.NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 60 * 1000,
    path: "/",
  });
  if (refreshToken) {
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }
}

async function firebaseSignIn(email, password) {
  if (!FIREBASE_WEB_API_KEY) throw apiError(503, "Firebase auth is not configured");
  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
    { email, password, returnSecureToken: true },
    { timeout: 30000 }
  );
  return response.data;
}

async function firebaseSignUp(email, password) {
  if (!FIREBASE_WEB_API_KEY) throw apiError(503, "Firebase auth is not configured");
  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`,
    { email, password, returnSecureToken: true },
    { timeout: 30000 }
  );
  return response.data;
}

async function firebaseRefresh(refreshToken) {
  if (!FIREBASE_WEB_API_KEY) throw apiError(503, "Firebase auth is not configured");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const response = await axios.post(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_API_KEY}`,
    body,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 30000 }
  );
  return response.data;
}

function cloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

async function uploadBufferToCloudinary(buffer, filename) {
  if (!cloudinaryConfigured()) {
    throw apiError(503, "Cloudinary is not configured");
  }
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${APP_NAME}/uploads`,
        resource_type: "image",
        public_id: filename,
      },
      (error, output) => {
        if (error) reject(error);
        else resolve(output);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
  return result;
}

async function ensureMongoUser(firebaseUser, fallback = {}) {
  let user = await User.findOne({ id: firebaseUser.uid });
  if (user) return user;

  try {
    const created = await User.create({
      id: firebaseUser.uid,
      name: firebaseUser.name || firebaseUser.displayName || fallback.name || firebaseUser.email?.split("@")[0] || "User",
      email: (firebaseUser.email || fallback.email || "").toLowerCase(),
      role: parseRole(firebaseUser.role || firebaseUser.customClaims?.role || fallback.role),
      avatar: firebaseUser.picture || firebaseUser.photoURL || fallback.avatar || null,
      phone: fallback.phone || null,
      saved_listings: [],
      is_active: true,
      is_verified: Boolean(firebaseUser.emailVerified),
      created_at: new Date().toISOString(),
    });
    return created;
  } catch (e) {
    if (e.code === 11000 && e.keyPattern?.email) {
      // Email exists but with different ID - update to use Firebase UID
      const existing = await User.findOne({ email: (firebaseUser.email || fallback.email || "").toLowerCase() });
      if (existing) {
        existing.id = firebaseUser.uid;
        await existing.save();
        return existing;
      }
    }
    throw e;
  }
}

async function populateListingOwners(listings) {
  const ownerIds = [...new Set(listings.map((item) => item.owner_id).filter(Boolean))];
  const owners = await User.find({ id: { $in: ownerIds } }).lean();
  const map = new Map(owners.map((owner) => [owner.id, owner]));
  return listings.map((item) => {
    const owner = map.get(item.owner_id);
    return {
      ...item,
      owner: ownerInfo(owner),
    };
  });
}

async function recomputeListingRating(listingId) {
  const stats = await Review.aggregate([
    { $match: { listing_id: listingId } },
    {
      $group: {
        _id: "$listing_id",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Listing.updateOne(
      { id: listingId },
      { $set: { average_rating: Math.round(stats[0].avg * 100) / 100, total_reviews: stats[0].count } }
    );
    return;
  }

  await Listing.updateOne({ id: listingId }, { $set: { average_rating: 0, total_reviews: 0 } });
}

async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw apiError(401, "Not authenticated");

    // Dev mode bypass - use "dev-test-token" to bypass Firebase auth in development
    if (DEV_MODE && token === "dev-test-token") {
      const devUser = await User.findOne({ email: "admin@locationkhuji.com" }).lean();
      if (devUser) {
        req.auth = { uid: devUser.id };
        req.user = toPlain(devUser);
        return next();
      }
    }

    // Check if Firebase is initialized
    if (admin.apps.length === 0) {
      throw apiError(503, "Firebase not configured - set FIREBASE_SERVICE_ACCOUNT_JSON");
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const firebaseUser = await admin.auth().getUser(decoded.uid);
    const mongoUser = await ensureMongoUser(firebaseUser, {
      name: firebaseUser.displayName,
      email: firebaseUser.email,
      role: firebaseUser.customClaims?.role,
    });

    if (!mongoUser.is_active) {
      throw apiError(401, "User not found");
    }

    req.auth = decoded;
    req.firebaseUser = firebaseUser;
    req.user = toPlain(mongoUser);
    next();
  } catch (error) {
    if (error.status) return next(error);
    if (error.code === "auth/id-token-expired") return next(apiError(401, "Token expired"));
    return next(apiError(401, "Invalid token"));
  }
}

function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(apiError(401, "Not authenticated"));
    if (!roles.includes(req.user.role)) return next(apiError(403, "Forbidden"));
    return next();
  };
}

function validateListingBody(body) {
  const required = ["title", "description", "category", "address", "area", "lat", "lng", "contact_phone"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw apiError(400, `Missing field: ${field}`);
    }
  }
  if (!ALLOWED_CATEGORIES.includes(String(body.category))) throw apiError(400, "Invalid category");
}

function buildListingPayload(body, user, existing) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
  const details = body.details && typeof body.details === "object" ? body.details : {};
  const tags = Array.isArray(body.tags) ? body.tags : [];

  const payload = {
    title: body.title,
    description: body.description,
    category: body.category,
    images,
    address: body.address,
    area: body.area,
    thana: body.thana || null,
    district: body.district || null,
    city: body.city || "Dhaka",
    location: {
      type: "Point",
      coordinates: [Number(body.lng), Number(body.lat)],
    },
    contact: {
      phone: body.contact_phone,
      whatsapp: body.contact_whatsapp || null,
      email: body.contact_email || null,
    },
    details,
    tags,
  };

  return payload;
}

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ALLOWED_ROLES, default: "user" },
    avatar: { type: String, default: null },
    phone: { type: String, default: null },
    saved_listings: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    is_verified: { type: Boolean, default: false },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

const listingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, enum: ALLOWED_CATEGORIES, required: true },
    owner_id: { type: String, required: true },
    images: { type: [String], default: [] },
    address: { type: String, required: true },
    area: { type: String, required: true },
    thana: { type: String },
    district: { type: String },
    city: { type: String, default: "Dhaka" },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    contact: {
      phone: { type: String, required: true },
      whatsapp: { type: String, default: null },
      email: { type: String, default: null },
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },
    is_approved: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    is_featured: { type: Boolean, default: false },
    average_rating: { type: Number, default: 0 },
    total_reviews: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

listingSchema.index({ location: "2dsphere", category: 1, is_active: 1 });
listingSchema.index({ title: "text", area: "text", thana: "text" });

const reportSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    listing_id: { type: String, required: true },
    reporter_id: { type: String, required: true },
    reason: { type: String, enum: ['fake', 'wrong_location', 'spam', 'offensive'], required: true },
    details: { type: String },
    status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

const reviewSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    listing_id: { type: String, required: true },
    user_id: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 500 },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

reviewSchema.index({ listing_id: 1, user_id: 1 }, { unique: true });

const fileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    user_id: { type: String, required: true },
    cloudinary_public_id: { type: String, required: true },
    cloudinary_secure_url: { type: String, required: true },
    content_type: { type: String, required: true },
    size: { type: Number, required: true },
    original_name: { type: String, default: null },
    is_deleted: { type: Boolean, default: false },
    created_at: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false }
);

const User = mongoose.model("User", userSchema);
const Listing = mongoose.model("Listing", listingSchema);
const Review = mongoose.model("Review", reviewSchema);
const FileRecord = mongoose.model("FileRecord", fileSchema);

function createFirebaseAdminApp() {
  if (admin.apps.length) return;

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  console.log("Firebase service account provided:", !!rawServiceAccount);

  if (rawServiceAccount && rawServiceAccount.startsWith("{")) {
    try {
      const serviceAccount = JSON.parse(rawServiceAccount);
      console.log("Parsed service account, has private_key:", !!serviceAccount.private_key);
      if (serviceAccount.private_key && serviceAccount.client_email) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: serviceAccount.project_id || serviceAccount.projectId,
            clientEmail: serviceAccount.client_email || serviceAccount.clientEmail,
            privateKey: normalizePrivateKey(serviceAccount.private_key || serviceAccount.privateKey),
          }),
          projectId: serviceAccount.project_id || serviceAccount.projectId,
        });
        console.log("Firebase Admin initialized successfully");
        return;
      }
    } catch (e) {
      console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  console.warn("Firebase Admin SDK not initialized - set FIREBASE_SERVICE_ACCOUNT_JSON to enable");
}

async function upsertFirebaseUser({ email, password, name, role }) {
  let firebaseUser;
  try {
    firebaseUser = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(firebaseUser.uid, {
      password,
      displayName: name,
      emailVerified: true,
    });
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
  }
  await admin.auth().setCustomUserClaims(firebaseUser.uid, { role });
  return firebaseUser;
}

async function upsertMongoSeedUser({ firebaseUser, email, name, role }) {
  const existing = await User.findOne({ id: firebaseUser.uid });
  if (existing) {
    existing.name = name;
    existing.email = email;
    existing.role = role;
    existing.is_active = true;
    existing.is_verified = true;
    await existing.save();
    return existing;
  }

  return User.create({
    id: firebaseUser.uid,
    name,
    email,
    role,
    avatar: null,
    phone: null,
    saved_listings: [],
    is_active: true,
    is_verified: true,
    created_at: new Date().toISOString(),
  });
}

async function seedAuthUsers() {
  if (admin.apps.length === 0) {
    console.warn("Skipping seed users - Firebase not initialized");
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || "admin@locationkhuji.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
  const demoUserEmail = process.env.DEMO_USER_EMAIL || "user@locationkhuji.com";
  const demoUserPassword = process.env.DEMO_USER_PASSWORD || "User@123";
  const demoOwnerEmail = process.env.DEMO_OWNER_EMAIL || "owner@locationkhuji.com";
  const demoOwnerPassword = process.env.DEMO_OWNER_PASSWORD || "Owner@123";

  const seeds = [
    { email: adminEmail, password: adminPassword, name: "Admin", role: "admin" },
    { email: demoUserEmail, password: demoUserPassword, name: "Demo User", role: "user" },
    { email: demoOwnerEmail, password: demoOwnerPassword, name: "Demo Owner", role: "owner" },
  ];

  for (const seed of seeds) {
    try {
      const firebaseUser = await upsertFirebaseUser(seed);
      await upsertMongoSeedUser({ firebaseUser, email: seed.email.toLowerCase(), name: seed.name, role: seed.role });
    } catch (e) {
      if (e.code !== 11000) console.error(`Seed error for ${seed.email}:`, e.message);
    }
  }
}

async function seedDevUsers() {
  if (!DEV_MODE) return;
  const adminEmail = "admin@locationkhuji.com";
  const demoUserEmail = "user@locationkhuji.com";
  const demoOwnerEmail = "owner@locationkhuji.com";

  const seeds = [
    { id: "dev-admin-001", email: adminEmail, name: "Admin", role: "admin" },
    { id: "dev-user-001", email: demoUserEmail, name: "Demo User", role: "user" },
    { id: "dev-owner-001", email: demoOwnerEmail, name: "Demo Owner", role: "owner" },
  ];

  for (const seed of seeds) {
    try {
      const existing = await User.findOne({ email: seed.email });
      if (!existing) {
        await User.create({
          id: seed.id,
          name: seed.name,
          email: seed.email,
          role: seed.role,
          avatar: null,
          phone: null,
          saved_listings: [],
          is_active: true,
          is_verified: true,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      // Ignore duplicate errors
    }
  }
  console.log("Dev users ready for testing");
}

async function seedListingsIfNeeded() {
  const count = await Listing.countDocuments();
  if (count > 0) return;

  const adminUser = await User.findOne({ role: "admin" }).lean();
  const ownerId = adminUser?.id || `seed-${Date.now()}`;
  const samples = [
    { title: "Modern 2-bed flat in Dhanmondi", category: "flat", lat: 23.7461, lng: 90.3742, address: "House 12, Road 5, Dhanmondi", area: "Dhanmondi", details: { bedrooms: 2, bathrooms: 2, area_sqft: 1100, rent_price: 18000, furnished: true }, description: "Spacious 2-bedroom apartment with modern amenities, balcony, lift access." },
    { title: "Luxury Studio in Gulshan 1", category: "flat", lat: 23.7925, lng: 90.4078, address: "Gulshan Avenue, Gulshan 1", area: "Gulshan", details: { bedrooms: 1, bathrooms: 1, area_sqft: 650, rent_price: 25000, furnished: true }, description: "Premium furnished studio near Gulshan Circle with 24/7 security." },
    { title: "3-bed Family Flat in Banani", category: "flat", lat: 23.7941, lng: 90.4028, address: "Road 11, Banani", area: "Banani", details: { bedrooms: 3, bathrooms: 3, area_sqft: 1600, rent_price: 35000, furnished: false }, description: "Family-sized apartment in central Banani. Walking distance to schools and markets." },
    { title: "Affordable 1-bed in Mirpur 10", category: "flat", lat: 23.8223, lng: 90.3654, address: "Section 10, Mirpur", area: "Mirpur", details: { bedrooms: 1, bathrooms: 1, area_sqft: 500, rent_price: 9000, furnished: false }, description: "Budget-friendly flat near Mirpur 10 metro station." },
    { title: "Square Pharmacy - Panthapath", category: "pharmacy", lat: 23.7519, lng: 90.3817, address: "Panthapath", area: "Panthapath", details: { open_hours: "8 AM - 11 PM", emergency: true, delivery: true }, description: "Trusted pharmacy with 24/7 emergency services and home delivery." },
    { title: "Popular Pharmacy - Dhanmondi 27", category: "pharmacy", lat: 23.7465, lng: 90.3700, address: "Road 27, Dhanmondi", area: "Dhanmondi", details: { open_hours: "9 AM - 10 PM", emergency: false, delivery: true }, description: "Wide range of medicines and health products with delivery." },
    { title: "Ibn Sina Pharmacy - Gulshan", category: "pharmacy", lat: 23.7923, lng: 90.4100, address: "Gulshan 2", area: "Gulshan", details: { open_hours: "24/7", emergency: true, delivery: true }, description: "24-hour pharmacy with full prescription services." },
    { title: "Square Hospital", category: "hospital", lat: 23.7519, lng: 90.3796, address: "Panthapath", area: "Panthapath", details: { specialty: ["Cardiology", "Orthopedics", "Neurology"], emergency: true, beds: 400, open_hours: "24/7" }, description: "Internationally accredited multi-specialty hospital." },
    { title: "Dhaka Medical College Hospital", category: "hospital", lat: 23.7258, lng: 90.3965, address: "Bakshibazar", area: "Bakshibazar", details: { specialty: ["General Medicine", "Surgery", "Pediatrics"], emergency: true, beds: 2300, open_hours: "24/7" }, description: "Largest government medical college hospital in Bangladesh." },
    { title: "United Hospital - Gulshan", category: "hospital", lat: 23.7937, lng: 90.4215, address: "Plot 15, Road 71, Gulshan", area: "Gulshan", details: { specialty: ["Cardiology", "Oncology", "Transplant"], emergency: true, beds: 500, open_hours: "24/7" }, description: "Premier private tertiary care hospital." },
    { title: "Bashundhara City Mall", category: "fashion", lat: 23.7516, lng: 90.3928, address: "Panthapath", area: "Panthapath", details: { brands: ["Aarong", "Ecstasy", "Yellow", "Cats Eye"], open_hours: "10 AM - 9 PM", price_range: "Mid to High" }, description: "South Asia's largest shopping mall with over 2000 stores." },
    { title: "Jamuna Future Park", category: "fashion", lat: 23.8134, lng: 90.4248, address: "Kuril, Dhaka", area: "Kuril", details: { brands: ["Westecs", "Plus Point", "Gentle Park"], open_hours: "10 AM - 10 PM", price_range: "Mid" }, description: "Massive shopping and entertainment complex." },
    { title: "Rifles Square", category: "fashion", lat: 23.7503, lng: 90.3705, address: "Dhanmondi", area: "Dhanmondi", details: { brands: ["Aarong", "Ecstasy", "Sailor"], open_hours: "10 AM - 9 PM", price_range: "Mid" }, description: "Popular shopping destination in Dhanmondi." },
  ];

  const docs = samples.map((sample) => ({
    id: new mongoose.Types.ObjectId().toString(),
    title: sample.title,
    description: sample.description,
    category: sample.category,
    owner_id: ownerId,
    images: [],
    address: sample.address,
    area: sample.area,
    city: "Dhaka",
    location: { type: "Point", coordinates: [sample.lng, sample.lat] },
    contact: { phone: "+8801700000000", whatsapp: "+8801700000000", email: null },
    details: sample.details,
    tags: [],
    is_approved: true,
    is_active: true,
    is_featured: false,
    average_rating: 0,
    total_reviews: 0,
    created_at: new Date().toISOString(),
  }));

  await Listing.insertMany(docs);
}

const app = express();

const corsOrigin = process.env.CORS_ORIGIN === "true" ? true : process.env.CORS_ORIGIN || true;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    if (!FILE_EXTENSIONS.has(ext) || !String(file.mimetype || "").startsWith("image/")) {
      return cb(apiError(400, "Unsupported file type"));
    }
    return cb(null, true);
  },
});

const api = express.Router();

api.get("/", (_req, res) => {
  res.json({ app: "LocationKhuji", status: "ok" });
});

api.post("/auth/register", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) throw apiError(400, "Missing required fields");

    const normalizedEmail = String(email).toLowerCase();
    const normalizedRole = parseRole(role);
    if (!["user", "owner"].includes(normalizedRole)) throw apiError(400, "Invalid role");

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) throw apiError(400, "Email already registered");

    const firebaseUser = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: name,
      emailVerified: false,
    });

    await admin.auth().setCustomUserClaims(firebaseUser.uid, { role: normalizedRole });

    const user = await User.create({
      id: firebaseUser.uid,
      name,
      email: normalizedEmail,
      role: normalizedRole,
      avatar: null,
      phone: null,
      saved_listings: [],
      is_active: true,
      is_verified: false,
      created_at: new Date().toISOString(),
    });

    const authResponse = await firebaseSignIn(normalizedEmail, password);
    sendAuthCookies(res, authResponse.idToken, authResponse.refreshToken);
    res.json({ access_token: authResponse.idToken, user: serializeUser(user) });
  } catch (error) {
    const firebaseMessage = error.response?.data?.error?.message || error.code;
    if (firebaseMessage === "EMAIL_EXISTS" || firebaseMessage === "auth/email-already-exists") {
      return next(apiError(400, "Email already registered"));
    }
    next(error.status ? error : apiError(400, error.message || "Registration failed"));
  }
});

api.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw apiError(400, "Missing required fields");

    const normalizedEmail = String(email).toLowerCase();
    const authResponse = await firebaseSignIn(normalizedEmail, password);
    const firebaseUser = await admin.auth().getUser(authResponse.localId);
    const user = await ensureMongoUser(firebaseUser, {
      name: firebaseUser.displayName,
      email: normalizedEmail,
      role: firebaseUser.customClaims?.role,
    });

    if (!user.is_active) throw apiError(401, "Invalid credentials");

    sendAuthCookies(res, authResponse.idToken, authResponse.refreshToken);
    res.json({ access_token: authResponse.idToken, user: serializeUser(user) });
  } catch (error) {
    const message = error.response?.data?.error?.message;
    if (message === "EMAIL_NOT_FOUND" || message === "INVALID_PASSWORD" || message === "USER_DISABLED") {
      return next(apiError(401, "Invalid credentials"));
    }
    next(error.status ? error : apiError(401, error.message || "Invalid credentials"));
  }
});

api.post("/auth/logout", (_req, res) => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.json({ ok: true });
});

api.post("/auth/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token || req.body?.refreshToken;
    if (!refreshToken) throw apiError(401, "No refresh token");
    const authResponse = await firebaseRefresh(refreshToken);
    const newAccessToken = authResponse.access_token;
    const newRefreshToken = authResponse.refresh_token;
    sendAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({ access_token: newAccessToken });
  } catch (error) {
    next(error.status ? error : apiError(401, "Invalid token"));
  }
});

api.get("/auth/me", requireAuth, (req, res) => {
  res.json(serializeUser(req.user));
});

api.post("/listings", requireAuth, requireRoles("owner", "admin"), async (req, res, next) => {
  try {
    validateListingBody(req.body || {});
    const payload = buildListingPayload(req.body || {}, req.user);
    const listing = await Listing.create({
      id: new mongoose.Types.ObjectId().toString(),
      owner_id: req.user.id,
      ...payload,
    });
    
    const out = listingToOut(listing);
    out.owner = ownerInfo(req.user); // Optimistically add owner info

    const io = req.app.get("io");
    if (io) {
      io.emit("new_listing", out);
    }

    res.json(out);
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to create listing"));
  }
});

api.get("/listings/nearby", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius || 5);
    const category = req.query.category ? String(req.query.category) : null;
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 24), 100);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw apiError(400, "Missing coordinates");

    const query = {
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radius * 1000,
        },
      },
      is_active: true,
    };

    if (category) query.category = category;

    const items = await Listing.find(query).skip((page - 1) * limit).limit(limit).lean();
    const withOwners = await populateListingOwners(items.map(listingToOut));
    res.json({ listings: withOwners, page, limit });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to load nearby listings"));
  }
});

api.get("/listings/search", async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q) : null;
    const category = req.query.category && req.query.category !== 'all' ? String(req.query.category) : null;
    const lat = req.query.lat !== undefined && req.query.lat !== "" ? Number(req.query.lat) : null;
    const lng = req.query.lng !== undefined && req.query.lng !== "" ? Number(req.query.lng) : null;
    const radius = Number(req.query.radius || 10);
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 24), 100);

    const query = { is_active: true };
    if (category) query.category = category;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      query.location = {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radius * 1000,
        },
      };
    }

    if (q) {
      const regexQuery = { $regex: q, $options: "i" };
      const textFilters = [
        { title: regexQuery },
        { description: regexQuery },
        { area: regexQuery },
        { address: regexQuery },
        { thana: regexQuery },
        { district: regexQuery }
      ];
      
      if (query.location) {
        // If we have location AND text query, we must use $and
        query.$or = textFilters;
      } else {
        query.$or = textFilters;
      }
    }

    const items = await Listing.find(query).skip((page - 1) * limit).limit(limit).lean();
    const withOwners = await populateListingOwners(items.map(listingToOut));
    res.json({ listings: withOwners, page, limit });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to search listings"));
  }
});

api.get("/listings/my", requireAuth, requireRoles("owner", "admin"), async (req, res, next) => {
  try {
    const items = await Listing.find({ owner_id: req.user.id }).sort({ created_at: -1 }).lean();
    res.json({ listings: items.map(listingToOut) });
  } catch (error) {
    next(apiError(500, "Failed to load listings"));
  }
});

api.get("/listings/:lid", async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ id: req.params.lid }).lean();
    if (!listing) throw apiError(404, "Not found");
    const owner = await User.findOne({ id: listing.owner_id }).lean();
    const out = listingToOut(listing);
    out.owner = ownerInfo(owner);
    res.json(out);
  } catch (error) {
    next(error.status ? error : apiError(404, "Not found"));
  }
});

api.put("/listings/:lid", requireAuth, async (req, res, next) => {
  try {
    validateListingBody(req.body || {});
    const existing = await Listing.findOne({ id: req.params.lid });
    if (!existing) throw apiError(404, "Not found");
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) throw apiError(403, "Forbidden");

    const payload = buildListingPayload(req.body || {}, req.user, existing);
    await Listing.updateOne({ id: req.params.lid }, { $set: payload });
    const updated = await Listing.findOne({ id: req.params.lid }).lean();
    const owner = await User.findOne({ id: updated.owner_id }).lean();
    const out = listingToOut(updated);
    out.owner = ownerInfo(owner);
    res.json(out);
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to update listing"));
  }
});

api.delete("/listings/:lid", requireAuth, async (req, res, next) => {
  try {
    const existing = await Listing.findOne({ id: req.params.lid });
    if (!existing) throw apiError(404, "Not found");
    if (req.user.role !== "admin" && existing.owner_id !== req.user.id) throw apiError(403, "Forbidden");
    await Listing.updateOne({ id: req.params.lid }, { $set: { is_active: false } });
    res.json({ ok: true });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to delete listing"));
  }
});

api.post("/listings/:lid/save", requireAuth, async (req, res, next) => {
  try {
    const listingId = req.params.lid;
    const savedListings = req.user.saved_listings || [];
    if (savedListings.includes(listingId)) {
      await User.updateOne({ id: req.user.id }, { $pull: { saved_listings: listingId } });
      return res.json({ saved: false });
    }
    await User.updateOne({ id: req.user.id }, { $addToSet: { saved_listings: listingId } });
    res.json({ saved: true });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to save listing"));
  }
});

api.get("/users/me/saved", requireAuth, async (req, res, next) => {
  try {
    const currentUser = await User.findOne({ id: req.user.id }).lean();
    const savedIds = currentUser?.saved_listings || [];
    if (!savedIds.length) return res.json({ listings: [] });
    const listings = await Listing.find({ id: { $in: savedIds }, is_active: true }).lean();
    const withOwners = await populateListingOwners(listings.map(listingToOut));
    res.json({ listings: withOwners });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to load saved listings"));
  }
});

api.get("/listings/:lid/reviews", async (req, res, next) => {
  try {
    const reviews = await Review.find({ listing_id: req.params.lid }).sort({ created_at: -1 }).lean();
    const userIds = [...new Set(reviews.map((review) => review.user_id).filter(Boolean))];
    const users = await User.find({ id: { $in: userIds } }).lean();
    const map = new Map(users.map((user) => [user.id, user]));
    const items = reviews.map((review) => ({
      ...review,
      user: ownerInfo(map.get(review.user_id)),
    }));
    res.json({ reviews: items });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to load reviews"));
  }
});

api.post("/listings/:lid/reviews", requireAuth, async (req, res, next) => {
  try {
    const rating = Number(req.body?.rating);
    const comment = String(req.body?.comment || "").trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw apiError(400, "Invalid rating");
    if (!comment) throw apiError(400, "Comment is required");

    const listing = await Listing.findOne({ id: req.params.lid }).lean();
    if (!listing) throw apiError(404, "Listing not found");
    if (listing.owner_id === req.user.id) throw apiError(400, "Cannot review your own listing");

    const existing = await Review.findOne({ listing_id: req.params.lid, user_id: req.user.id }).lean();
    if (existing) throw apiError(400, "Already reviewed");

    const review = await Review.create({
      id: new mongoose.Types.ObjectId().toString(),
      listing_id: req.params.lid,
      user_id: req.user.id,
      rating,
      comment,
      created_at: new Date().toISOString(),
    });

    await recomputeListingRating(req.params.lid);
    const out = toPlain(review);
    out.user = ownerInfo(req.user);
    res.json(out);
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to add review"));
  }
});

api.delete("/reviews/:rid", requireAuth, async (req, res, next) => {
  try {
    const review = await Review.findOne({ id: req.params.rid }).lean();
    if (!review) throw apiError(404, "Not found");
    if (req.user.role !== "admin" && review.user_id !== req.user.id) throw apiError(403, "Forbidden");
    await Review.deleteOne({ id: req.params.rid });
    await recomputeListingRating(review.listing_id);
    res.json({ ok: true });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to delete review"));
  }
});

api.put("/users/me", requireAuth, async (req, res, next) => {
  try {
    const update = {};
    if (req.body?.name !== undefined) update.name = req.body.name;
    if (req.body?.phone !== undefined) update.phone = req.body.phone;
    if (req.body?.avatar !== undefined) update.avatar = req.body.avatar;
    if (Object.keys(update).length) {
      await User.updateOne({ id: req.user.id }, { $set: update });
    }
    const updated = await User.findOne({ id: req.user.id }).lean();
    res.json(serializeUser(updated));
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to update profile"));
  }
});

api.post("/uploads", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw apiError(400, "File is required");

    const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase();
    if (!FILE_EXTENSIONS.has(ext)) throw apiError(400, "Unsupported file type");

    const uploaded = await uploadBufferToCloudinary(req.file.buffer, `${req.user.id}-${Date.now()}`);
    const record = await FileRecord.create({
      id: new mongoose.Types.ObjectId().toString(),
      user_id: req.user.id,
      cloudinary_public_id: uploaded.public_id,
      cloudinary_secure_url: uploaded.secure_url,
      content_type: req.file.mimetype || "image/jpeg",
      size: req.file.size,
      original_name: req.file.originalname || null,
      is_deleted: false,
      created_at: new Date().toISOString(),
    });

    res.json({ id: record.id, url: `/api/files/${record.id}`, path: uploaded.public_id });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to upload file"));
  }
});

api.get("/files/:fid", async (req, res, next) => {
  try {
    const file = await FileRecord.findOne({ id: req.params.fid, is_deleted: false }).lean();
    if (!file) throw apiError(404, "Not found");
    return res.redirect(file.cloudinary_secure_url);
  } catch (error) {
    next(error.status ? error : apiError(404, "Not found"));
  }
});

api.get("/admin/stats", requireAuth, requireRoles("admin"), async (_req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalOwners = await User.countDocuments({ role: "owner" });
    const totalListings = await Listing.countDocuments({ is_active: true });
    const pending = await Listing.countDocuments({ is_approved: false, is_active: true });
    const totalReviews = await Review.countDocuments();
    const byCategory = {};
    for (const category of ALLOWED_CATEGORIES) {
      byCategory[category] = await Listing.countDocuments({ category, is_active: true, is_approved: true });
    }
    res.json({
      total_users: totalUsers,
      total_owners: totalOwners,
      total_listings: totalListings,
      pending,
      total_reviews: totalReviews,
      by_category: byCategory,
    });
  } catch (error) {
    next(apiError(500, "Failed to load admin stats"));
  }
});

api.get("/admin/users", requireAuth, requireRoles("admin"), async (_req, res, next) => {
  try {
    const users = await User.find().sort({ created_at: -1 }).lean();
    res.json({ users: users.map(serializeUser) });
  } catch (error) {
    next(apiError(500, "Failed to load users"));
  }
});

api.put("/admin/users/:uid", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const update = {};
    if (req.body?.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
    if (req.body?.role !== undefined) {
      const role = parseRole(req.body.role);
      if (!ALLOWED_ROLES.includes(role)) throw apiError(400, "Invalid role");
      update.role = role;
    }
    if (Object.keys(update).length) {
      await User.updateOne({ id: req.params.uid }, { $set: update });
      if (update.role) {
        await admin.auth().setCustomUserClaims(req.params.uid, { role: update.role });
      }
    }
    res.json({ ok: true });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to update user"));
  }
});

api.get("/admin/listings", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const query = {};
    if (status === "pending") {
      query.is_approved = false;
      query.is_active = true;
    } else if (status === "approved") {
      query.is_approved = true;
      query.is_active = true;
    } else if (status === "rejected") {
      query.is_active = false;
    }

    const listings = await Listing.find(query).sort({ created_at: -1 }).lean();
    const withOwners = await populateListingOwners(listings.map(listingToOut));
    res.json({ listings: withOwners });
  } catch (error) {
    next(apiError(500, "Failed to load listings"));
  }
});

api.put("/admin/listings/:lid/approve", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    await Listing.updateOne({ id: req.params.lid }, { $set: { is_approved: true, is_active: true } });
    res.json({ ok: true });
  } catch (error) {
    next(apiError(400, "Failed to approve listing"));
  }
});

api.put("/admin/listings/:lid/reject", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    await Listing.updateOne({ id: req.params.lid }, { $set: { is_approved: false, is_active: false } });
    res.json({ ok: true });
  } catch (error) {
    next(apiError(400, "Failed to reject listing"));
  }
});

api.put("/admin/listings/:lid/feature", requireAuth, requireRoles("admin"), async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ id: req.params.lid }).lean();
    if (!listing) throw apiError(404, "Not found");
    await Listing.updateOne({ id: req.params.lid }, { $set: { is_featured: !listing.is_featured } });
    res.json({ ok: true });
  } catch (error) {
    next(error.status ? error : apiError(400, "Failed to update feature status"));
  }
});

app.use("/api", api);

app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ detail: "File too large (max 5MB)" });
  }
  const status = err.status || 500;
  const detail = err.message || "Internal server error";
  res.status(status).json({ detail });
});

async function initialize() {
  if (!MONGO_URL) throw new Error("MONGO_URL is required");
  createFirebaseAdminApp();

  if (cloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  await mongoose.connect(MONGO_URL, { dbName: DB_NAME });
  await seedDevUsers();
  await seedAuthUsers();
  await seedListingsIfNeeded();
}

async function start() {
  await initialize();
  const server = app.listen(PORT, () => {
    console.log(`LocationKhuji API listening on ${PORT}`);
  });

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN === "true" ? true : process.env.CORS_ORIGIN || true,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected via Socket.IO");
    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });

  app.set("io", io);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
      console.error(`To kill: npx kill-port ${PORT} or taskkill /F /IM node.exe`);
      process.exit(1);
    }
    throw err;
  });

  return server;
}

if (require.main === module) {
  const seedOnly = process.argv.includes("--seed-only");
  if (seedOnly) {
    initialize()
      .then(() => {
        console.log("Seeding completed successfully");
        process.exit(0);
      })
      .catch((error) => {
        console.error("Seeding failed:", error);
        process.exit(1);
      });
  } else {
    start().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}

module.exports = { app, initialize, start };