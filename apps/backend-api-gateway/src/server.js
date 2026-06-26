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
const { 
  normalizeBengaliText, 
  normalizeLocationText, 
  tokenizeLocationText, 
  BDLocationEngine, 
  CATEGORY_SYNONYMS, 
  BUSINESS_NAMES, 
  BENGALI_PREPOSITIONS,
  isBusinessOrCategoryName,
  splitQueryIntoLocationAndKeyword
} = require("shared-config");
const { resolveLocationFromQuery } = require("./locationResolver");

const { Server } = require("socket.io");

const PORT = process.env.PORT || 8001;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "locationkhuji";
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const APP_NAME = "locationkhuji";
const FIREBASE_SA = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
const DEV_MODE = process.env.NODE_ENV === "development" && (!FIREBASE_SA || FIREBASE_SA.includes("your-project-id") || FIREBASE_SA.includes("MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSj"));
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const LEGACY_TEST_ACCOUNT_EMAILS = [
  "admin@locationkhuji.com",
  "owner@locationkhuji.com",
  "user@locationkhuji.com",
];

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "your_openrouter_api_key_here") {
  console.log("OpenRouter API configuration detected. DeepSeek V3 will act as the secondary fallback search engine.");
} else {
  console.warn("⚠️ OPENROUTER_API_KEY is not configured. OpenRouter DeepSeek V3 search integration will be bypassed.");
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
if (GROQ_API_KEY && GROQ_API_KEY !== "your_groq_api_key_here") {
  console.log("Groq API configuration detected. Llama 3 will act as the primary search engine.");
} else {
  console.warn("⚠️ GROQ_API_KEY is not configured. Groq Llama 3 search integration will be bypassed.");
}

const ALLOWED_ROLES = ["user", "owner", "admin"];
const ALLOWED_CATEGORIES = ["flat", "pharmacy", "hospital", "restaurant", "service"];
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
    is_active: user.is_active !== false,
    is_verified: !!user.is_verified,
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

function configuredAdminEmail() {
  return (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
}

function configuredAdminPassword() {
  return (process.env.ADMIN_PASSWORD || "").trim();
}

function configuredAdminName() {
  return (process.env.ADMIN_NAME || "LocationKhuji Admin").trim();
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

async function firebaseSendVerificationEmail(idToken) {
  if (!FIREBASE_WEB_API_KEY) throw apiError(503, "Firebase auth is not configured");
  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
    { requestType: "VERIFY_EMAIL", idToken },
    { timeout: 30000 }
  );
  return response.data;
}

async function sendResendEmail(to, subject, html) {
  if (!RESEND_API_KEY) {
    throw new Error("Resend API key is not configured");
  }
  const response = await axios.post(
    "https://api.resend.com/emails",
    {
      from: "LocationKhuji <no-reply@novosoftai.dev>",
      to,
      subject,
      html
    },
    {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 30000
    }
  );
  return response.data;
}

function buildVerificationHtml(name, link) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify your LocationKhuji Account</title>
      <style>
        body {
          background-color: #0B0E11;
          color: #CBD5E1;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #141A21;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .logo {
          font-size: 28px;
          font-weight: 800;
          text-align: center;
          color: #F8FAFC;
          letter-spacing: -0.05em;
          margin-bottom: 30px;
        }
        .logo span {
          color: #00C9A7;
        }
        h1 {
          font-size: 22px;
          font-weight: 700;
          color: #F8FAFC;
          margin-top: 0;
          margin-bottom: 20px;
        }
        p {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .btn-container {
          text-align: center;
          margin-bottom: 35px;
        }
        .btn {
          display: inline-block;
          background-color: #00C9A7;
          color: #0B0E11;
          font-weight: 700;
          font-size: 16px;
          text-decoration: none;
          padding: 14px 32px;
          border-radius: 30px;
          box-shadow: 0 0 15px rgba(0, 201, 167, 0.3);
          transition: all 0.3s ease;
        }
        .footer {
          font-size: 12px;
          color: #64748B;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          margin-top: 20px;
        }
        .link-text {
          word-break: break-all;
          color: #00C9A7;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Location<span>Khuji</span></div>
        <h1>Hello ${name},</h1>
        <p>Thank you for registering on LocationKhuji, Bangladesh's premium location discovery platform. Please verify your email address to unlock your owner account, enable listing creation, and get your premium verification badge.</p>
        <div class="btn-container">
          <a href="${link}" class="btn" target="_blank">Verify My Account</a>
        </div>
        <p>If the button doesn't work, copy and paste this URL into your browser:</p>
        <p class="link-text">${link}</p>
        <div class="footer">
          This email was sent by LocationKhuji. If you did not register for this account, you can safely ignore this email.
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildPasswordResetHtml(name, code) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset your LocationKhuji Password</title>
      <style>
        body {
          background-color: #0B0E11;
          color: #CBD5E1;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          margin: 0;
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #141A21;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .logo {
          font-size: 28px;
          font-weight: 800;
          text-align: center;
          color: #F8FAFC;
          letter-spacing: -0.05em;
          margin-bottom: 30px;
        }
        .logo span {
          color: #00C9A7;
        }
        h1 {
          font-size: 22px;
          font-weight: 700;
          color: #F8FAFC;
          margin-top: 0;
          margin-bottom: 20px;
        }
        p {
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .code-container {
          text-align: center;
          margin-bottom: 35px;
          background-color: #1C242D;
          border: 1px dashed rgba(0, 201, 167, 0.3);
          border-radius: 8px;
          padding: 20px;
        }
        .code {
          font-family: monospace;
          font-size: 36px;
          font-weight: 800;
          letter-spacing: 0.15em;
          color: #00C9A7;
        }
        .footer {
          font-size: 12px;
          color: #64748B;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Location<span>Khuji</span></div>
        <h1>Hello ${name},</h1>
        <p>We received a request to reset the password for your LocationKhuji account. Please use the following 6-digit verification code to proceed. This code is valid for 10 minutes:</p>
        <div class="code-container">
          <div class="code">${code}</div>
        </div>
        <p>If you did not request a password reset, please secure your account or ignore this email.</p>
        <div class="footer">
          This email was sent by LocationKhuji.
        </div>
      </div>
    </body>
    </html>
  `;
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
  if (user) {
    // Sync verification status from Firebase User
    if (!user.is_verified && firebaseUser.emailVerified) {
      user.is_verified = true;
      await User.updateOne({ _id: user._id }, { is_verified: true });
    }
    return user;
  }

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

    // Dev mode bypass - use "dev-test-token" or "dev-test-token-${email}" to bypass Firebase auth in development
    if (DEV_MODE && token && (token === "dev-test-token" || token.startsWith("dev-test-token-"))) {
      let email = configuredAdminEmail();
      if (token.startsWith("dev-test-token-")) {
        email = token.slice("dev-test-token-".length);
      }
      const devUser = await User.findOne({ email }).lean();
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

// Optional auth - attaches req.user if valid token present, but does NOT reject unauthenticated requests
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      req.user = null;
      return next();
    }

    // Dev mode bypass
    if (DEV_MODE && token && (token === "dev-test-token" || token.startsWith("dev-test-token-"))) {
      let email = configuredAdminEmail();
      if (token.startsWith("dev-test-token-")) {
        email = token.slice("dev-test-token-".length);
      }
      const devUser = await User.findOne({ email }).lean();
      if (devUser) {
        req.auth = { uid: devUser.id };
        req.user = toPlain(devUser);
        return next();
      }
    }

    // Check if Firebase is initialized
    if (admin.apps.length === 0) {
      req.user = null;
      return next();
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const firebaseUser = await admin.auth().getUser(decoded.uid);
    const mongoUser = await ensureMongoUser(firebaseUser, {
      name: firebaseUser.displayName,
      email: firebaseUser.email,
      role: firebaseUser.customClaims?.role,
    });

    if (!mongoUser.is_active) {
      req.user = null;
      return next();
    }

    req.auth = decoded;
    req.firebaseUser = firebaseUser;
    req.user = toPlain(mongoUser);
    next();
  } catch {
    req.user = null;
    next();
  }
}

function validateListingBody(body) {
  const required = ["title", "description", "category", "address", "area", "lat", "lng", "contact_phone"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      throw apiError(400, `Missing field: ${field}`);
    }
  }
  if (!ALLOWED_CATEGORIES.includes(String(body.category))) throw apiError(400, "Invalid category");

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (isNaN(lat) || isNaN(lng)) throw apiError(400, "Coordinates must be valid numbers");
  
  // Enforce Bangladesh bounding box: SW [20.3, 88.0], NE [26.7, 92.7]
  if (lat < 20.3 || lat > 26.7 || lng < 88.0 || lng > 92.7) {
    throw apiError(400, "Coordinates must be strictly within Bangladesh");
  }
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
    city: body.city || undefined,
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

  // Enforce consistent geography boundaries
  const resolvedGeo = BDLocationEngine.reverseGeocode(payload.location.coordinates[1], payload.location.coordinates[0]);
  if (resolvedGeo) {
    payload.division = resolvedGeo.division;
    payload.district = resolvedGeo.district;
    // Attempt to extract Thana from area or address if not manually specified
    if (!payload.thana && (payload.area || payload.address)) {
      const textToCheck = `${payload.area} ${payload.address}`;
      const resolvedText = BDLocationEngine.resolveLocation(textToCheck);
      if (resolvedText && resolvedText.type === "upazila" && resolvedText.district.id === resolvedGeo.districtId) {
        payload.thana = resolvedText.item.name;
      }
    }
  }

  // Strip 'Dhaka' from city/area if district is NOT Dhaka
  if (payload.district && payload.district !== "Dhaka") {
    if (payload.city === "Dhaka") payload.city = "";
    if (payload.area === "Dhaka Area" || payload.area === "Dhaka") {
      payload.area = payload.thana || payload.district;
    }
  }

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
    division: { type: String },
    city: { type: String },
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

const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    code: { type: String, required: true },
    expires_at: { type: Date, required: true },
  },
  { versionKey: false }
);
passwordResetSchema.index({ email: 1 });
const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

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
    const update = {
      displayName: name,
      emailVerified: true,
    };
    if (password) update.password = password;
    await admin.auth().updateUser(firebaseUser.uid, update);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    if (!password) {
      throw new Error("Admin user does not exist in Firebase. Set ADMIN_PASSWORD once to create it, then remove it.");
    }
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
  const existing = await User.findOne({
    $or: [{ id: firebaseUser.uid }, { email }],
  });
  if (existing) {
    existing.id = firebaseUser.uid;
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

async function removeLegacyTestAccounts() {
  const adminEmail = configuredAdminEmail();
  const legacyEmails = LEGACY_TEST_ACCOUNT_EMAILS.filter((email) => email !== adminEmail);
  if (legacyEmails.length === 0) return;

  const mongoResult = await User.deleteMany({ email: { $in: legacyEmails } });
  if (mongoResult.deletedCount > 0) {
    console.log(`Removed ${mongoResult.deletedCount} legacy test account(s) from MongoDB`);
  }

  if (admin.apps.length === 0) return;

  for (const email of legacyEmails) {
    try {
      const firebaseUser = await admin.auth().getUserByEmail(email);
      await admin.auth().deleteUser(firebaseUser.uid);
      console.log(`Removed legacy Firebase test account: ${email}`);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        console.warn(`Could not remove legacy Firebase test account ${email}: ${error.message}`);
      }
    }
  }
}

async function seedAuthUsers() {
  if (admin.apps.length === 0) {
    console.warn("Skipping seed users - Firebase not initialized");
    return;
  }

  const adminEmail = configuredAdminEmail();
  const adminPassword = configuredAdminPassword();
  if (!adminEmail) {
    console.warn("Skipping admin seed - set ADMIN_EMAIL");
    return;
  }

  const seeds = [
    { email: adminEmail, password: adminPassword, name: configuredAdminName(), role: "admin" },
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
  const adminEmail = configuredAdminEmail();
  if (!adminEmail) {
    console.warn("Skipping dev admin seed - set ADMIN_EMAIL");
    return;
  }

  const seeds = [
    { id: "dev-admin-001", email: adminEmail, name: configuredAdminName(), role: "admin" },
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
  console.log("Dev admin ready");
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

    location: { type: "Point", coordinates: [sample.lng, sample.lat] },
    contact: { phone: "+8801700000000", whatsapp: "+8801700000000", email: null },
    details: sample.details,
    tags: [],

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

    // Generate email verification link
    let verificationLink = "";
    try {
      verificationLink = await admin.auth().generateEmailVerificationLink(normalizedEmail);
      console.log("\n=======================================================");
      console.log(`📧 [Email Verification Link] Sent to: ${normalizedEmail}`);
      console.log(`🔗 Link: ${verificationLink}`);
      console.log("=======================================================\n");
    } catch (linkErr) {
      console.warn(`⚠️ [Firebase Warning] Could not generate email verification link: ${linkErr.message}`);
    }

    const authResponse = await firebaseSignIn(normalizedEmail, password);

    // Send real verification email via Resend or fallback to Firebase REST API
    let mailDispatched = false;
    if (RESEND_API_KEY) {
      try {
        const html = buildVerificationHtml(name, verificationLink);
        await sendResendEmail(normalizedEmail, "Verify your LocationKhuji Account 🪐", html);
        console.log(`📧 [Resend Email] Custom HTML verification email dispatched successfully to: ${normalizedEmail}`);
        mailDispatched = true;
      } catch (resendErr) {
        console.warn(`⚠️ [Resend Email Error] Could not dispatch custom verification email: ${resendErr.message}. Falling back to Firebase...`);
      }
    }

    if (!mailDispatched) {
      try {
        await firebaseSendVerificationEmail(authResponse.idToken);
        console.log(`📧 [Firebase Email] Real verification email dispatched successfully to: ${normalizedEmail}`);
      } catch (mailErr) {
        console.warn(`⚠️ [Firebase Email Warning] Could not dispatch fallback verification email: ${mailErr.message}`);
      }
    }

    sendAuthCookies(res, authResponse.idToken, authResponse.refreshToken);
    res.json({ 
      access_token: authResponse.idToken, 
      user: serializeUser(user),
      dev_verification_link: (process.env.NODE_ENV === "development" || DEV_MODE) ? verificationLink : undefined
    });
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

    // Dev mode bypass - if in DEV_MODE, let's bypass Firebase!
    if (DEV_MODE) {
      const devUser = await User.findOne({ email: normalizedEmail }).lean();
      if (devUser) {
        const adminEmail = configuredAdminEmail();
        const adminPassword = configuredAdminPassword();
        if (adminPassword && devUser.role === "admin" && normalizedEmail === adminEmail && adminPassword === password) {
          const mockToken = `dev-test-token-${normalizedEmail}`;
          sendAuthCookies(res, mockToken, "dev-refresh-token");
          return res.json({ access_token: mockToken, user: serializeUser(devUser) });
        }
      }
    }

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

api.post("/auth/google", async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) throw apiError(400, "Missing Google ID token");
    if (admin.apps.length === 0) {
      throw apiError(503, "Firebase not configured - set FIREBASE_SERVICE_ACCOUNT_JSON");
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const firebaseUser = await admin.auth().getUser(decoded.uid);
    const normalizedEmail = String(firebaseUser.email || "").toLowerCase();
    if (!normalizedEmail) throw apiError(400, "Google account email is required");

    const existingUser = await User.findOne({
      $or: [{ id: firebaseUser.uid }, { email: normalizedEmail }],
    });
    const role = existingUser?.role || firebaseUser.customClaims?.role || "user";

    if (firebaseUser.customClaims?.role !== role) {
      await admin.auth().setCustomUserClaims(firebaseUser.uid, {
        ...(firebaseUser.customClaims || {}),
        role,
      });
    }

    const user = await ensureMongoUser(firebaseUser, {
      name: firebaseUser.displayName,
      email: normalizedEmail,
      role,
      avatar: firebaseUser.photoURL,
    });

    if (!user.is_active) throw apiError(401, "Invalid credentials");

    sendAuthCookies(res, idToken);
    res.json({ access_token: idToken, user: serializeUser(user) });
  } catch (error) {
    const message = error.code === "auth/id-token-expired" ? "Google session expired" : error.message;
    next(error.status ? error : apiError(401, message || "Google sign-in failed"));
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

api.get("/auth/me", requireAuth, async (req, res) => {
  try {
    // If not verified in MongoDB yet, check Firebase's live emailVerified status
    if (!req.user.is_verified) {
      const firebaseUser = await admin.auth().getUser(req.user.id);
      if (firebaseUser.emailVerified) {
        await User.updateOne({ id: req.user.id }, { is_verified: true });
        req.user.is_verified = true;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Firebase Sync] Could not sync emailVerified status in auth/me: ${err.message}`);
  }
  res.json(serializeUser(req.user));
});

api.post("/auth/verify-me-dev", requireAuth, async (req, res, next) => {
  try {
    // Enforce that direct bypass is only allowed in local development/testing mode
    if (process.env.NODE_ENV !== "development" && !DEV_MODE) {
      throw apiError(403, "Direct verification bypass is only allowed in development/testing mode");
    }

    console.log(`🔒 [Dev Bypass] Manually verifying email in Firebase and MongoDB for user: ${req.user.email}`);

    // Update Firebase user directly
    try {
      await admin.auth().updateUser(req.user.id, { emailVerified: true });
      console.log(`   Firebase emailVerified status updated to true`);
    } catch (fbErr) {
      console.warn(`   Could not update Firebase emailVerified status: ${fbErr.message}`);
    }

    // Update MongoDB user directly
    await User.updateOne({ id: req.user.id }, { is_verified: true });
    console.log(`   MongoDB is_verified updated to true`);

    req.user.is_verified = true;
    res.json({ success: true, user: serializeUser(req.user) });
  } catch (err) {
    next(apiError(400, err.message));
  }
});

api.post("/auth/resend-verification", requireAuth, async (req, res, next) => {
  try {
    if (req.user.is_verified) {
      throw apiError(400, "Email is already verified");
    }

    const name = req.user.name || "User";
    const email = req.user.email;

    console.log(`📧 [Resend Verification Request] Generating link for: ${email}`);

    // Generate link
    let verificationLink = "";
    try {
      verificationLink = await admin.auth().generateEmailVerificationLink(email);
      console.log(`🔗 Fresh Link: ${verificationLink}`);
    } catch (linkErr) {
      throw apiError(400, `Could not generate email verification link: ${linkErr.message}`);
    }

    // Try sending with Resend first
    let mailDispatched = false;
    if (RESEND_API_KEY) {
      try {
        const html = buildVerificationHtml(name, verificationLink);
        await sendResendEmail(email, "Verify your LocationKhuji Account 🪐", html);
        console.log(`📧 [Resend Email] Custom HTML verification email resent successfully to: ${email}`);
        mailDispatched = true;
      } catch (resendErr) {
        console.warn(`⚠️ [Resend Email Error] Could not resend custom verification email: ${resendErr.message}. Falling back to Firebase...`);
      }
    }

    // Fallback to Firebase REST API
    if (!mailDispatched) {
      try {
        const idToken = extractToken(req);
        if (idToken && idToken !== "dev-test-token") {
          await firebaseSendVerificationEmail(idToken);
          console.log(`📧 [Firebase Email] Verification email resent successfully to: ${email}`);
          mailDispatched = true;
        } else {
          console.warn("⚠️ No valid Firebase ID token found in request headers/cookies to trigger Firebase REST mailer fallback.");
        }
      } catch (mailErr) {
        console.warn(`⚠️ [Firebase Email Warning] Could not resend verification email fallback: ${mailErr.message}`);
      }
    }

    res.json({
      success: true,
      message: "Verification email resent successfully.",
      dev_verification_link: (process.env.NODE_ENV === "development" || DEV_MODE) ? verificationLink : undefined
    });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to resend verification email"));
  }
});



api.post("/auth/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) throw apiError(400, "Email is required");

    const normalizedEmail = String(email).toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) throw apiError(404, "No account found with this email");

    // Generate random 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Save token to DB (upsert for same email to avoid clutter)
    await PasswordReset.findOneAndUpdate(
      { email: normalizedEmail },
      { code, expires_at: expiresAt },
      { upsert: true, new: true }
    );

    // Print to console logs clearly so developer can see it
    console.log("\n=======================================================");
    console.log(`📧 [Verification Code] Send to: ${normalizedEmail}`);
    console.log(`🔑 Verification Code: ${code}`);
    console.log(`⏰ Expires at: ${expiresAt.toLocaleTimeString()}`);
    console.log("=======================================================\n");

    // Send real custom HTML email via Resend if configured
    let mailDispatched = false;
    if (RESEND_API_KEY) {
      try {
        const html = buildPasswordResetHtml(user.name || "User", code);
        await sendResendEmail(normalizedEmail, "Reset your LocationKhuji Password 🔑", html);
        console.log(`📧 [Resend Email] Custom HTML password reset email dispatched successfully to: ${normalizedEmail}`);
        mailDispatched = true;
      } catch (resendErr) {
        console.warn(`⚠️ [Resend Email Error] Could not dispatch custom password reset email: ${resendErr.message}`);
      }
    }

    if (!mailDispatched) {
      console.log(`ℹ️ [Forgot Password Fallback] Resend email was not dispatched. Reset code is printed to the server console.`);
    }

    res.json({
      message: "Verification code sent to your email. Check server console logs in dev mode.",
      email: normalizedEmail,
      dev_code: (process.env.NODE_ENV === "development" || DEV_MODE) ? code : undefined
    });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to send reset code"));
  }
});

api.post("/auth/reset-password", async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      throw apiError(400, "Email, verification code, and new password are required");
    }

    const normalizedEmail = String(email).toLowerCase();
    
    // Find active reset code
    const resetEntry = await PasswordReset.findOne({ email: normalizedEmail });
    if (!resetEntry) throw apiError(400, "Verification code not requested or expired");

    // Verify code match
    if (resetEntry.code !== String(code).trim()) {
      throw apiError(400, "Invalid verification code");
    }

    // Verify code expiration
    if (new Date() > resetEntry.expires_at) {
      await PasswordReset.deleteOne({ _id: resetEntry._id });
      throw apiError(400, "Verification code has expired");
    }

    // Find MongoDB User to get their Firebase UID
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) throw apiError(404, "User account not found");

    // Update password in Firebase Auth
    try {
      await admin.auth().updateUser(user.id, { password: newPassword });
    } catch (fbErr) {
      if (DEV_MODE) {
        console.warn(`⚠️ [Firebase Bypass] Could not update password in Firebase Auth for dev user (they might only exist in seeded MongoDB): ${fbErr.message}`);
      } else {
        throw fbErr;
      }
    }

    // Clean up reset entry
    await PasswordReset.deleteOne({ _id: resetEntry._id });

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to reset password"));
  }
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
    const division = req.query.division ? String(req.query.division) : null;
    const district = req.query.district ? String(req.query.district) : null;
    const thana = req.query.thana ? String(req.query.thana) : null;
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
    if (division) query.division = division;
    if (district) query.district = district;
    if (thana) query.thana = thana;
// ... existing code ...
    const items = await Listing.find(query).skip((page - 1) * limit).limit(limit).lean();
    
    // Fallback to OSM search if no listings found
    let withOwners = await populateListingOwners(items.map(listingToOut));
    if (withOwners.length === 0) {
      const osmListings = await fetchFromOSMOverpass(category, lat, lng, radius, req.app.get("io"));
      const filteredOsmListings = category && category !== 'all'
        ? osmListings.filter(l => l.category === category)
        : osmListings;
      withOwners = await populateListingOwners(filteredOsmListings.map(listingToOut));
    }
    
    res.json({ listings: withOwners, page, limit });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to load nearby listings"));
  }
});

const osmCache = new Map();

async function fetchFromOSMOverpass(category, lat, lng, radiusKm, io, keywords = []) {
  try {
    // If category is flat or service, do not fetch from OSM since OSM does not map them
    if (category === 'flat' || category === 'service') {
      return [];
    }

    // Generate a cache key that groups requests within ~110 meters (3 decimal places)
    // This prevents map panning from aggressively hitting the Overpass API rate limits
    const cacheKey = `${category}_${Number(lat).toFixed(3)}_${Number(lng).toFixed(3)}_${radiusKm}_${keywords.join("|")}`;
    
    if (osmCache.has(cacheKey)) {
      console.log(`🗺️ [OSM Cache] Used cached Overpass results for category: "${category}" around [${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}]`);
      return osmCache.get(cacheKey);
    }

    console.log(`Live OSM Overpass fallback query triggered for category: "${category}" around [${lat}, ${lng}]`);
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    
    const offset = (radiusKm || 2) * 0.01;
    const south = lat - offset;
    const west = lng - offset;
    const north = lat + offset;
    const east = lng + offset;
    let stmts = [];
    if (category === 'pharmacy') {
      stmts = [
        `node["amenity"="pharmacy"](${south},${west},${north},${east});`,
        `way["amenity"="pharmacy"](${south},${west},${north},${east});`
      ];
    } else if (category === 'hospital') {
      stmts = [
        `node["amenity"="hospital"](${south},${west},${north},${east});`,
        `node["amenity"="clinic"](${south},${west},${north},${east});`,
        `node["amenity"="dentist"](${south},${west},${north},${east});`,
        `node["healthcare"="dentist"](${south},${west},${north},${east});`,
        `way["amenity"="hospital"](${south},${west},${north},${east});`
      ];
    } else if (category === 'restaurant') {
      stmts = [
        `node["amenity"="restaurant"](${south},${west},${north},${east});`,
        `node["amenity"="cafe"](${south},${west},${north},${east});`,
        `node["amenity"="fast_food"](${south},${west},${north},${east});`,
        `node["amenity"="food_court"](${south},${west},${north},${east});`,
        `way["amenity"="restaurant"](${south},${west},${north},${east});`,
        `way["amenity"="fast_food"](${south},${west},${north},${east});`
      ];
    } else {
      stmts = [
        `node["amenity"="pharmacy"](${south},${west},${north},${east});`,
        `node["amenity"="hospital"](${south},${west},${north},${east});`,
        `node["amenity"="clinic"](${south},${west},${north},${east});`,
        `node["amenity"="restaurant"](${south},${west},${north},${east});`,
        `node["amenity"="cafe"](${south},${west},${north},${east});`,
        `node["amenity"="fast_food"](${south},${west},${north},${east});`
      ];
    }
    const query = `[out:json][timeout:15];\n(\n${stmts.join("\n")}\n);\nout center body;`;

    // Fetch from Overpass API using axios
    const response = await axios.post(overpassUrl, `data=${encodeURIComponent(query)}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "LocationKhuji/1.0 (contact@locationkhuji.com)"
      },
      timeout: 10000
    });

    const elements = response.data?.elements || [];
    console.log(`OSM Overpass live query returned ${elements.length} elements.`);

    const newlySeededListings = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags["name:en"] || tags["name:bn"];
      if (!name) continue;

      const placeLat = el.lat || el.center?.lat;
      const placeLng = el.lon || el.center?.lon;
      if (!placeLat || !placeLng) continue;

      // Strict JS keyword filtering so we don't spam the UI with irrelevant OSM pins
      if (keywords && keywords.length > 0) {
        const matchesAll = keywords.every(kwGroup => {
          const synonyms = kwGroup.split('|').map(k => k.trim());
          return synonyms.some(kw => {
            let safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            safeKw = safeKw.replace(/dental/i, 'dent');
            const regex = new RegExp(safeKw, 'i');
            const amenity = tags.amenity || tags.healthcare || "";
            return regex.test(name) || regex.test(amenity);
          });
        });
        if (!matchesAll) continue;
      }

      // Determine category mapping from OSM tags
      let itemCategory = "restaurant";
      let details = {};
      let description = "";

      if (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.healthcare === "hospital" || tags.healthcare === "clinic" || tags.amenity === "dentist" || tags.healthcare === "dentist") {
        itemCategory = "hospital";
        details = { specialty: ["General Medical"], beds: 100, open_hours: "24/7", emergency: true };
        description = `${name} is an active healthcare facility providing medical care and professional services.`;
      } else if (tags.amenity === "pharmacy" || tags.healthcare === "pharmacy") {
        itemCategory = "pharmacy";
        details = { open_hours: "9 AM - 10 PM", emergency: true, delivery: true };
        description = `${name} is a licensed pharmacy stocking medicines, healthcare essentials, and prescriptions.`;
      } else {
        itemCategory = "restaurant";
        details = { cuisine: "Local", price_range: "Mid", delivery: true };
        description = `${name} is a local restaurant offering delicious meals and dining experiences.`;
      }

      // Check if this listing already exists in MongoDB
      const existing = await Listing.findOne({
        title: name,
        location: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [placeLng, placeLat] },
            $maxDistance: 100 // within 100 meters
          }
        }
      }).lean();

      if (existing) {
        newlySeededListings.push(existing);
        continue;
      }

      // Address helpers
      const street = tags["addr:street"] || tags["addr:road"] || "";
      const suburb = tags["addr:suburb"] || tags["addr:neighbourhood"] || "";
      const city = tags["addr:city"] || "";

      // Create new Listing document in MongoDB
      const resolvedGeo = BDLocationEngine.reverseGeocode(placeLat, placeLng);
      let resolvedThana = null;
      if (resolvedGeo) {
        const textToCheck = `${suburb} ${street} ${name}`;
        const resolvedText = BDLocationEngine.resolveLocation(textToCheck);
        if (resolvedText && resolvedText.type === "upazila" && resolvedText.district.id === resolvedGeo.districtId) {
          resolvedThana = resolvedText.item.name;
        }
      }

      // Use reverse geocoded data as fallback for location fields
      const derivedDistrict = resolvedGeo?.district || "";
      const derivedArea = suburb || resolvedThana || derivedDistrict || "";
      const fullAddress = tags["addr:full"] || [street, derivedArea, city].filter(Boolean).join(", ") || `${name}, ${derivedDistrict || "Bangladesh"}`;

      const doc = await Listing.create({
        id: new mongoose.Types.ObjectId().toString(),
        title: name,
        description: description,
        category: itemCategory,
        owner_id: "dev-admin-001",
        images: [],
        address: fullAddress,
        area: derivedArea,
        thana: resolvedThana,
        district: resolvedGeo?.district || null,
        division: resolvedGeo?.division || null,
        city: "",
        location: {
          type: "Point",
          coordinates: [placeLng, placeLat]
        },
        contact: {
          phone: tags.phone || "+8801700000000",
          whatsapp: "+8801700000000",
          email: null
        },
        details: details,
        tags: ["osm-live", "live-search"],

        is_active: true,
        is_featured: false,
        average_rating: 0,
        total_reviews: 0,
        created_at: new Date().toISOString()
      });

      const out = doc.toObject();
      newlySeededListings.push(out);
      if (io) {
        const [populatedOut] = await populateListingOwners([listingToOut(out)]);
        io.emit("new_listing", populatedOut);
      }
    }

    // Save to cache
    osmCache.set(cacheKey, newlySeededListings);
    // Prevent memory leak
    if (osmCache.size > 500) {
      const firstKey = osmCache.keys().next().value;
      osmCache.delete(firstKey);
    }

    return newlySeededListings;
  } catch (err) {
    console.error("OSM Overpass fallback query failed:", err.message);
    return [];
  }
}


function cleanQueryKeywords(q, category) {
  if (!q) return "";
  let cleanQ = q.toLowerCase();

  // Remove common category-specific keywords
  const categoryKeywords = {
    flat: /\b(flat|rent|apartment|room|sublet|mess|basa|bari|flatRental)\b/gi,
    pharmacy: /\b(pharmacy|medicine|drug|osudh|pharmacist|osud|pharmacies|drugstore)\b/gi,
    hospital: /\b(hospital|clinic|doctor|mbbs|medical|ambulance|icu|ccu|hospitals)\b/gi,
    restaurant: /\b(restaurant|cafe|food|dining|biryani|burger|pizza|eat|hotel|kacchi|fast food|bakery|kabab|khabar)\b/gi,
    service: /\b(service|hire|mechanic|plumber|electrician|tutor|photographer|cleaner|maid|painter|carpenter|ac technician|pest control|babysitter|moving|event manager)\b/gi
  };

  // Remove radius/range/km suffixes
  cleanQ = cleanQ.replace(/\d+\s*(?:km|k\.m\.|kilometer|kilometers|কিলোমিটার|কিমি|\bmeters?\b|\brange\b)/gi, "");

  // Remove prepositions and search noise
  cleanQ = cleanQ.replace(/\b(in|near|around|inside|at|under|find|search|me|show|for)\b/gi, "");

  // Also remove category keywords for all categories if a specific category is requested
  if (category) {
    for (const [cat, regex] of Object.entries(categoryKeywords)) {
      cleanQ = cleanQ.replace(regex, "");
    }
  }

  // Clean extra spaces
  cleanQ = cleanQ.replace(/\s+/g, " ").trim();
  return cleanQ;
}

const geocodeCache = new Map();

async function geocodeLocation(query) {
  try {
    const q = encodeURIComponent(`${query}`);
    const cacheKey = q.toLowerCase();
    
    if (geocodeCache.has(cacheKey)) {
      console.log(`🌐 [Geocoding Cache] Used cached coordinates for: "${query}"`);
      return geocodeCache.get(cacheKey);
    }
    
    console.log(`🌐 [Geocoding Request] Nominatim searching for: "${query}"`);
    // viewbox for Dhaka to heavily prefer Dhaka results when ambiguous (bounded=0 means it can still find places outside Dhaka)
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=bd&limit=1&viewbox=90.3,23.9,90.5,23.6&bounded=0`,
      {
        headers: { "User-Agent": "LocationKhuji/1.0 (contact@locationkhuji.com)" },
        timeout: 5000
      }
    );
    if (response.data && response.data.length > 0) {
      const first = response.data[0];
      const result = {
        lat: parseFloat(first.lat),
        lng: parseFloat(first.lon),
        displayName: first.display_name
      };
      
      // Save to cache
      geocodeCache.set(cacheKey, result);
      // Prevent memory leak
      if (geocodeCache.size > 1000) {
        const firstKey = geocodeCache.keys().next().value;
        geocodeCache.delete(firstKey);
      }
      
      return result;
    }
  } catch (err) {
    console.warn(`⚠️ [Geocoding Warning] Nominatim failed: ${err.message}`);
  }
  return null;
}

const aiIntentCache = new Map();

async function parseWithGroq(searchQuery, parsedLat, parsedLng) {
  if (!GROQ_API_KEY || GROQ_API_KEY === "your_groq_api_key_here") {
    throw new Error("Groq API key is not configured");
  }

  const prompt = `
    You are the AI Location Assistant for LocationKhuji, a map-first search platform in Bangladesh.
    User coordinates: Latitude ${parsedLat}, Longitude ${parsedLng}.
    Analyze the user's conversational search query: "${searchQuery}".
    
    Extract and output a strict JSON object with:
    1. "category": strictly one of: "flat", "pharmacy", "hospital", "restaurant", "service", or "all" (default is "all").
    2. "keywords": an array of descriptive search keywords extracted from the query. Keep these concise. DO NOT INCLUDE locations/streets. CRITICAL: For each keyword, provide a pipe-separated string containing the English word, its direct Bengali translation, and common Banglish synonyms (e.g., "balcony|বারান্দা|baranda", "generator|জেনারেটর", "dental|ডেন্টাল|dentist").
    3. "isEmergency": boolean indicating if this is an urgent/emergency medical/pharmacy search (e.g. ICU, ambulance, urgent delivery, 24h).
    4. "maxPrice": number (null if not specified) representing maximum rent or price limit mentioned in the query.
    5. "bedrooms": number (null if not specified) representing requested bedroom count (e.g. 2 beds, 3 bedroom).
    6. "location": string (null if not specified) representing ONLY the geographical area, neighborhood, or street name (e.g. "Mirpur 02", "Dhanmondi", "Gulshan"). CRITICAL: DO NOT include business names or fragments of business names (like "Pizza", "Burg", "KFC", "Hospital") in this field! If the user types "Pizza Burg Mirpur 02", the location MUST be strictly "Mirpur 02".

    Respond ONLY in this JSON format:
    {
      "category": "category_name",
      "keywords": ["keyword1", "keyword2"],
      "isEmergency": false,
      "maxPrice": null,
      "bedrooms": null,
      "location": "string"
    }
  `;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1024
    },
    {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 5000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response content from Groq API");
  }

  return JSON.parse(content.trim());
}

async function parseWithOpenRouter(searchQuery, parsedLat, parsedLng) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "your_openrouter_api_key_here") {
    throw new Error("OpenRouter API key is not configured");
  }

  const prompt = `
    You are the AI Location Assistant for LocationKhuji, a map-first search platform in Bangladesh.
    User coordinates: Latitude ${parsedLat}, Longitude ${parsedLng}.
    Analyze the user's conversational search query: "${searchQuery}".
    
    Extract and output a strict JSON object with:
    1. "category": strictly one of: "flat", "pharmacy", "hospital", "restaurant", "service", or "all" (default is "all").
    2. "keywords": an array of descriptive search keywords extracted from the query. Keep these concise. DO NOT INCLUDE locations/streets. CRITICAL: For each keyword, provide a pipe-separated string containing the English word, its direct Bengali translation, and common Banglish synonyms (e.g., "balcony|বারান্দা|baranda", "generator|জেনারেটর", "dental|ডেন্টাল|dentist").
    3. "isEmergency": boolean indicating if this is an urgent/emergency medical/pharmacy search (e.g. ICU, ambulance, urgent delivery, 24h).
    4. "maxPrice": number (null if not specified) representing maximum rent or price limit mentioned in the query.
    5. "bedrooms": number (null if not specified) representing requested bedroom count (e.g. 2 beds, 3 bedroom).
    6. "location": string (null if not specified) representing ONLY the geographical area, neighborhood, or street name (e.g. "Mirpur 02", "Dhanmondi", "Gulshan"). CRITICAL: DO NOT include business names or fragments of business names (like "Pizza", "Burg", "KFC", "Hospital") in this field! If the user types "Pizza Burg Mirpur 02", the location MUST be strictly "Mirpur 02".

    Respond ONLY in this JSON format:
    {
      "category": "category_name",
      "keywords": ["keyword1", "keyword2"],
      "isEmergency": false,
      "maxPrice": null,
      "bedrooms": null,
      "location": "string"
    }
  `;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    },
    {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: 8000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response content from OpenRouter API");
  }

  return JSON.parse(content.trim());
}

async function getAIIntent(searchQuery, parsedLat, parsedLng) {
  const lowerQuery = normalizeBengaliText(searchQuery.toLowerCase());
  
  // 1. Check Cache first to avoid hitting API rate limits for the same text query
  if (aiIntentCache.has(lowerQuery)) {
    const cached = aiIntentCache.get(lowerQuery);
    console.log(`🧠 [AI Cache] Used cached intent for query: "${searchQuery}"`);
    return {
      intent: {
        category: "all",
        keywords: [],
        isEmergency: false,
        maxPrice: null,
        bedrooms: null,
        ...cached
      },
      processedByAI: true
    };
  }

  let intent = {
    category: "all",
    keywords: [],
    isEmergency: false,
    maxPrice: null,
    bedrooms: null,
  };
  let processedByAI = false;

  // 2. Stage 1: Groq API (Llama 3)
  if (GROQ_API_KEY && GROQ_API_KEY !== "your_groq_api_key_here") {
    try {
      console.log("[AI SEARCH] Using Groq Primary");
      console.log(`⚡ [AI Search - Stage 1] Querying Groq (Llama 3) for: "${searchQuery}"`);
      const parsed = await parseWithGroq(searchQuery, parsedLat, parsedLng);
      if (parsed && typeof parsed === "object") {
        intent.category = parsed.category || "all";
        intent.keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
        intent.isEmergency = !!parsed.isEmergency;
        intent.maxPrice = parsed.maxPrice !== undefined ? parsed.maxPrice : null;
        intent.bedrooms = parsed.bedrooms !== undefined ? parsed.bedrooms : null;
        if (parsed.location) {
          intent.aiLocation = parsed.location;
        }
        processedByAI = true;
        console.log("⚡ [AI Search - Stage 1] Groq successfully parsed search query.");
      }
    } catch (err) {
      console.log("[AI SEARCH] Groq failed, switching to OpenRouter");
      console.warn(`⚠️ [AI Search - Stage 1 Failed] Groq/Llama 3 parsing failed: ${err.message}.`);
    }
  } else {
    console.log("[AI SEARCH] Groq failed, switching to OpenRouter");
  }

  // 3. Stage 2: OpenRouter API (DeepSeek V3 Fallback)
  if (!processedByAI && OPENROUTER_API_KEY && OPENROUTER_API_KEY !== "your_openrouter_api_key_here") {
    try {
      console.log(`🧠 [AI Search - Stage 2] Querying OpenRouter DeepSeek V3 for: "${searchQuery}"`);
      const parsed = await parseWithOpenRouter(searchQuery, parsedLat, parsedLng);
      if (parsed && typeof parsed === "object") {
        intent.category = parsed.category || "all";
        intent.keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
        intent.isEmergency = !!parsed.isEmergency;
        intent.maxPrice = parsed.maxPrice !== undefined ? parsed.maxPrice : null;
        intent.bedrooms = parsed.bedrooms !== undefined ? parsed.bedrooms : null;
        if (parsed.location) {
          intent.aiLocation = parsed.location;
        }
        processedByAI = true;
        console.log("⚡ [AI Search - Stage 2] OpenRouter successfully parsed search query.");
      }
    } catch (err) {
      console.log("[AI SEARCH] OpenRouter failed, using Regex");
      console.error("[OpenRouter Error]", err.response?.data || err.message);
    }
  } else if (!processedByAI) {
    console.log("[AI SEARCH] OpenRouter failed, using Regex");
  }

  // Save to Cache if processed by AI
  if (processedByAI) {
    aiIntentCache.set(lowerQuery, {
      category: intent.category,
      keywords: [...intent.keywords],
      isEmergency: intent.isEmergency,
      maxPrice: intent.maxPrice,
      bedrooms: intent.bedrooms,
      aiLocation: intent.aiLocation
    });
    // Prevent memory leak
    if (aiIntentCache.size > 1000) {
      const firstKey = aiIntentCache.keys().next().value;
      aiIntentCache.delete(firstKey);
    }
    return { intent, processedByAI: true };
  }

  // 4. Stage 3: Smart Regex Offline Engine (Fallback)
  console.log(`🤖 [AI Search - Stage 3] Falling back to Smart Offline Regex for: "${searchQuery}"`);
  
  // 1. Detect Category
  if (CATEGORY_SYNONYMS.flat.test(lowerQuery)) intent.category = "flat";
  else if (CATEGORY_SYNONYMS.pharmacy.test(lowerQuery)) intent.category = "pharmacy";
  else if (CATEGORY_SYNONYMS.hospital.test(lowerQuery)) intent.category = "hospital";
  else if (CATEGORY_SYNONYMS.restaurant.test(lowerQuery)) intent.category = "restaurant";
  else if (CATEGORY_SYNONYMS.service.test(lowerQuery)) intent.category = "service";

  // 2. Detect Emergency status
  if (/\b(emergency|urgent|critical|accident|blood|immediate|dying|oxygen|heart attack|icu|24h|24\/7)\b/i.test(lowerQuery)) {
    intent.isEmergency = true;
  }

  // 3. Extract Price Limit (e.g. under 20k, under 20000, max 25000)
  const kMatch = lowerQuery.match(/(?:under|below|less than|max|maximum|up to|rent)?\s*(\d+)\s*k\b/i);
  if (kMatch) {
    intent.maxPrice = Number(kMatch[1]) * 1000;
  } else {
    const numMatch = lowerQuery.match(/(?:under|below|less than|max|maximum|up to|rent)?\s*(\d{4,6})\b/i);
    if (numMatch) {
      intent.maxPrice = Number(numMatch[1]);
    }
  }

  // 4. Extract Bedrooms count (e.g. 2 bed, 3 bedroom, 2basa)
  const bedMatch = lowerQuery.match(/(\d)\s*(?:bed|bedroom|room|basa)\b/i);
  if (bedMatch) {
    intent.bedrooms = Number(bedMatch[1]);
  }

  // 5. Extract Keywords (clean out noise and common words)
  const stopWords = new Set([
    "find", "search", "me", "near", "in", "a", "the", "at", "for", "with", "under", 
    "show", "please", "want", "need", "looking", "located", "place", "places", "spot", "spots",
    "dhaka", "bangladesh", "of", "to", "and", "under", "taka", "tk", "bdt", "rent", "cheap", "best"
  ]);
  const rawWords = lowerQuery
    .replace(/[^\w\s\u0980-\u09FF]/g, "") // support English and Bengali letters
    .split(/\s+/);
  
  intent.keywords = rawWords.filter(word => word.length > 2 && !stopWords.has(word));

  return { intent, processedByAI: false };
}

api.post("/listings/ai-search", async (req, res, next) => {
  try {
    const { query: searchQuery, userLat, userLng, radiusKm = 30 } = req.body || {};
    if (!searchQuery) throw apiError(400, "Search query is required");

    let parsedLat = Number(userLat) || 23.8103;
    let parsedLng = Number(userLng) || 90.4125;
    
    // Extract search radius in KM if specified in the query (e.g., "2km range", "5 km")
    let userExplicitRadius = false;
    let parsedRadius = 1; // Default to 1km for precise location-aware searches
    const radiusMatch = searchQuery.match(/(\d+)\s*(?:km|k.m.|kilometer|kilometers|কিলোমিটার|কিমি)/i);
    if (radiusMatch) {
      parsedRadius = Number(radiusMatch[1]);
      userExplicitRadius = true;
      console.log(`🎯 [Radius Extraction] Found custom radius in query: ${parsedRadius} km`);
    }

    // Smart location centering based on popular area names in the query
    const AREA_COORDS = {
      savar: [90.2667, 23.8583],
      সাভার: [90.2667, 23.8583],
      dhanmondi: [90.3742, 23.7461],
      ধানমন্ডি: [90.3742, 23.7461],
      gulshan: [90.4078, 23.7925],
      গুলশান: [90.4078, 23.7925],
      banani: [90.4043, 23.7940],
      বনানী: [90.4043, 23.7940],
      mirpur: [90.3665, 23.8223],
      মিরপুর: [90.3665, 23.8223],
      "mirpur 1": [90.3541, 23.7956],
      "mirpur 2": [90.3615, 23.8045],
      "mirpur 10": [90.3688, 23.8069],
      "mirpur 11": [90.3698, 23.8183],
      "mirpur 12": [90.3644, 23.8242],
      "mirpur 14": [90.3846, 23.8063],
      "mirpur dohs": [90.3841, 23.8327],
      panthapath: [90.3817, 23.7519],
      পান্থপথ: [90.3817, 23.7519],
      kuril: [90.4248, 23.8134],
      কুড়িল: [90.4248, 23.8134],
      uttara: [90.3907, 23.8759],
      উত্তরা: [90.3907, 23.8759],
      bashundhara: [90.4497, 23.8193],
      বসুন্ধরা: [90.4497, 23.8193],
      badda: [90.4258, 23.7805],
      বাড্ডা: [90.4258, 23.7805],
      mohammadpur: [90.3625, 23.7542],
      মোহাম্মদপুর: [90.3625, 23.7542],
      motijheel: [90.4194, 23.7330],
      মতিঝিল: [90.4194, 23.7330],
      khilgaon: [90.4203, 23.7507],
      খিলগাঁও: [90.4203, 23.7507],
      chittagong: [91.7832, 22.3569],
      চট্টগ্রাম: [91.7832, 22.3569],
      sylhet: [91.8687, 24.8949],
      সিলেট: [91.8687, 24.8949],
      rampura: [90.4237, 23.7614],
      রামপুরা: [90.4237, 23.7614],
      tejgaon: [90.3903, 23.7620],
      তেজগাঁও: [90.3903, 23.7620],
      farmgate: [90.3878, 23.7567],
      ফার্মগেট: [90.3878, 23.7567],
      wari: [90.4069, 23.7139],
      ওয়ারী: [90.4069, 23.7139],
      lalbagh: [90.3887, 23.7193],
      লালবাগ: [90.3887, 23.7193],
      shyamoli: [90.3641, 23.7710],
      শ্যামলী: [90.3641, 23.7710],
      agargaon: [90.3759, 23.7781],
      আগারগাঁও: [90.3759, 23.7781],
      azimpur: [90.3826, 23.7295],
      আজিমপুর: [90.3826, 23.7295],
      jatrabari: [90.4251, 23.7100],
      যাত্রাবাড়ী: [90.4251, 23.7100],
      shahbag: [90.3956, 23.7393],
      शाहबाग: [90.3956, 23.7393],
      malibagh: [90.4151, 23.7492],
      মালিবাগ: [90.4151, 23.7492],
      lalmatia: [90.3711, 23.7530],
      লালমাটিয়া: [90.3711, 23.7530],
      newmarket: [90.3857, 23.7339],
      নিউমার্কেট: [90.3857, 23.7339],
      kakrail: [90.4100, 23.7410],
      কাকরাইল: [90.4100, 23.7410],
      kallyanpur: [90.3610, 23.7870],
      কল্যাণপুর: [90.3610, 23.7870],
      narayanganj: [90.5000, 23.6238],
      নারায়ণগঞ্জ: [90.5000, 23.6238],
      gazipur: [90.4013, 23.9999],
      গাজীপুর: [90.4013, 23.9999]
    };

    const lowerQuery = normalizeBengaliText(searchQuery.toLowerCase());
    const locationDebug = process.env.LOCATION_DEBUG === "true";
    let resolvedAreaName = "";
    let overriddenLocation = false;

    const initialLocationResult = await resolveLocationFromQuery(searchQuery, {
      preferDhaka: true,
      debug: locationDebug,
      logPrefix: "AI-SEARCH"
    });

    if (initialLocationResult?.found) {
      parsedLat = initialLocationResult.lat;
      parsedLng = initialLocationResult.lng;
      overriddenLocation = true;
      resolvedAreaName = initialLocationResult.displayName || "";
    }

    // Resolve Intent through Groq -> Gemini -> Regex waterfall helper
    const { intent, processedByAI } = await getAIIntent(searchQuery, parsedLat, parsedLng);

    if (intent.aiLocation && isBusinessOrCategoryName(intent.aiLocation)) {
      console.log(`⚠️ [AI Search] Rejected business/category name "${intent.aiLocation}" as a location.`);
      intent.aiLocation = null;
    }

    // If AI found a specific location name BUT our geocoders completely failed to resolve it,
    // we MUST NOT fallback to a nationwide search. We must return 0 results.
    const hasUnresolvedLocation = intent.aiLocation && !overriddenLocation;

    if (hasUnresolvedLocation) {
      console.log(`🚫 [Strict Filter] AI detected location "${intent.aiLocation}" but it couldn't be resolved. Returning 0 results to prevent false positives.`);
      return res.json({
        intent,
        listings: [],
        processedByAI,
        searchCenter: null,
        radius: parsedRadius,
        locationDetected: false
      });
    }

    // If NO location was specified at all, and no radius specified, search nationwide
    if (!overriddenLocation && !userExplicitRadius) {
      parsedRadius = 50; // Use a large radius for nationwide-style search
    }

    // Build Mongoose Geospatial Query
    const mongoQuery = {
      is_active: true,
    };

    // Only apply geo constraint when a specific location was detected
    if (overriddenLocation) {
      mongoQuery.location = {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [parsedLng, parsedLat] },
          $maxDistance: parsedRadius * 1000,
        },
      };
    }

    if (intent.category !== "all") {
      mongoQuery.category = intent.category;
    }

    // Apply Emergency filters
    if (intent.isEmergency) {
      mongoQuery.$or = [
        { "details.emergency": true },
        { "details.open_hours": /24\/7|24 hours|24h/i }
      ];
    }

    // Apply Price Filters
    if (intent.maxPrice) {
      mongoQuery["details.rent_price"] = { $lte: Number(intent.maxPrice) };
    }

    // Apply Bedrooms Filters
    if (intent.bedrooms) {
      mongoQuery["details.bedrooms"] = Number(intent.bedrooms);
    }

    // If keywords exist, build an AND query matching title, description, area, district, etc.
    // Strip out base category words from keywords to avoid forcing them into the strict $and requirement.
    // If a user says "dental hospital", and we force "hospital" to be in the title, we miss "Dental Clinic".
    const baseCategoryWords = new Set(["hospital", "clinic", "pharmacy", "restaurant", "cafe", "flat", "rent"]);
    const strictKeywords = intent.keywords.filter(kw => !baseCategoryWords.has(kw.toLowerCase()));

    if (strictKeywords && strictKeywords.length > 0) {
      const keywordQueries = strictKeywords.map(kwGroup => {
        // AI now returns pipe-separated synonyms (e.g., "balcony|বারান্দা|baranda")
        const synonyms = kwGroup.split('|').map(k => k.trim());
        
        const regexQueries = synonyms.map(kw => {
          const safeKw = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return { $regex: safeKw, $options: "i" };
        });

        return {
          $or: regexQueries.flatMap(regexQuery => [
            { title: regexQuery },
            { description: regexQuery },
            { area: regexQuery },
            { address: regexQuery },
            { "details.features": regexQuery },
            { "details.specialty": regexQuery },
            { "details.cuisine": regexQuery },
            { "details.brands": regexQuery },
            { tags: regexQuery }
          ])
        };
      });

      // Merge using $and to enforce strict matching of ALL keywords
      if (mongoQuery.$or) {
        mongoQuery.$and = [
          { $or: mongoQuery.$or },
          ...keywordQueries
        ];
        delete mongoQuery.$or;
      } else {
        mongoQuery.$and = keywordQueries;
      }
    }

    let listings = await Listing.find(mongoQuery).limit(5000).lean();
    
    // For AI Search, the user's raw query is already a conversational string.
    // We previously used Google Places here, but now we go straight to OSM Overpass.
    
    const withOwners = await populateListingOwners(listings.map(listingToOut));

    res.json({
      intent,
      listings: withOwners,
      processedByAI,
      searchCenter: overriddenLocation ? { lat: parsedLat, lng: parsedLng, displayName: resolvedAreaName || undefined } : null,
      radius: parsedRadius,
      locationDetected: overriddenLocation
    });

    // Run live fetch in the background to not block the UI
    (async () => {
      try {
        const io = req.app.get("io");
        await fetchFromOSMOverpass(intent.category, parsedLat, parsedLng, parsedRadius, io, strictKeywords);
      } catch (err) {
        console.error("Background AI OSM fetch error:", err.message);
      }
    })();
  } catch (error) {
    next(error.status ? error : apiError(500, error.message || "AI Search failed"));
  }
});

api.get("/listings/search", async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : null;
    const category = req.query.category && req.query.category !== 'all' ? String(req.query.category) : null;
    let lat = req.query.lat !== undefined && req.query.lat !== "" ? Number(req.query.lat) : null;
    let lng = req.query.lng !== undefined && req.query.lng !== "" ? Number(req.query.lng) : null;
    let radius = Number(req.query.radius || 50);
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 150), 5000);

    let results = [];
    const baseFilter = { is_active: true };
    if (category) baseFilter.category = category;

    let searchKeywords = q;
    let isLocationQuery = false;
    let resolvedAreaName = "";

    if (q) {
      const locationCheck = await resolveLocationFromQuery(q, { preferDhaka: true });
      if (locationCheck.found) {
        isLocationQuery = true;
        if (!lat || !lng) {
          lat = locationCheck.lat;
          lng = locationCheck.lng;
        }
        resolvedAreaName = locationCheck.displayName || "";
        
        // Dynamically adjust radius for Standard Search if resolved from q and not explicitly set small by frontend
        if (req.query.radius === undefined || req.query.radius === "") {
          if (locationCheck.matchType === "division") {
            radius = 30;
          } else if (locationCheck.matchType === "district") {
            radius = 15;
          } else if (locationCheck.matchType === "upazila" || locationCheck.matchType === "thana") {
            radius = 5;
          } else {
            radius = 2; // default to 2km for neighborhoods
          }
          console.log(`📏 [Standard Search Dynamic Radius] Set radius to ${radius} km based on location type: ${locationCheck.matchType}`);
        }
        
        // Strip the matched location name from the keywords so we don't apply it to text filter
        const escapedAlias = locationCheck.matchedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchKeywords = q.replace(new RegExp(escapedAlias, 'gi'), ' ').replace(/\s+/g, ' ').trim();
      }
    }

    if (searchKeywords) {
      const escapedKeywords = searchKeywords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const simpleRegex = { $regex: escapedKeywords, $options: "i" };

      // Split into words to match in any order (e.g. "flat banani" matches "3-bed Family Flat in Banani")
      const words = searchKeywords.split(/\s+/).filter(w => w.length > 1);
      let wordRegex = simpleRegex;
      if (words.length > 0) {
        const regexParts = words.map(w => `(?=.*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
        wordRegex = { $regex: regexParts.join(''), $options: "i" };
      }

      // Priority 1: Title matches
      const titleMatches = await Listing.find({
        ...baseFilter,
        title: wordRegex
      }).limit(limit).lean();

      // Priority 2: Area/address/thana/district matches
      const areaMatches = await Listing.find({
        ...baseFilter,
        title: { $not: wordRegex },
        $or: [
          { area: wordRegex },
          { address: wordRegex },
          { thana: wordRegex },
          { district: wordRegex },
        ]
      }).limit(limit).lean();

      // Priority 3: Description/tags matches
      const descMatches = await Listing.find({
        ...baseFilter,
        title: { $not: wordRegex },
        area: { $not: wordRegex },
        address: { $not: wordRegex },
        $or: [
          { description: wordRegex },
          { tags: wordRegex },
        ]
      }).limit(Math.max(limit - titleMatches.length - areaMatches.length, 10)).lean();

      // Combine with title matches first (most relevant)
      const seen = new Set();
      for (const batch of [titleMatches, areaMatches, descMatches]) {
        for (const item of batch) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            results.push(item);
          }
        }
      }

      // If location is also provided, sort nearby results higher
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        // Also fetch nearby results that match keywords within radius
        const nearbyQuery = {
          ...baseFilter,
          location: {
            $nearSphere: {
              $geometry: { type: "Point", coordinates: [lng, lat] },
              $maxDistance: radius * 1000,
            }
          },
          $or: [
            { title: wordRegex },
            { area: wordRegex },
            { address: wordRegex },
            { description: wordRegex },
          ]
        };

        const nearbyResults = await Listing.find(nearbyQuery).limit(limit).lean();

        // Merge: put nearby keyword matches at the top
        const nearbyIds = new Set(nearbyResults.map(r => r.id));
        const nearbyKeywordMatches = results.filter(r => nearbyIds.has(r.id));
        const otherResults = results.filter(r => !nearbyIds.has(r.id));
        const nearbyOnlyResults = nearbyResults.filter(r => !seen.has(r.id));

        results = [...nearbyKeywordMatches, ...nearbyOnlyResults];
      }
    } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // No keyword, just location-based
      const nearbyQuery = {
        ...baseFilter,
        location: {
          $nearSphere: {
            $geometry: { type: "Point", coordinates: [lng, lat] },
            $maxDistance: radius * 1000,
          }
        }
      };
      results = await Listing.find(nearbyQuery).limit(limit).lean();
    } else {
      // No query, no location - return recent listings
      results = await Listing.find(baseFilter).sort({ created_at: -1 }).limit(limit).lean();
    }

    // Paginate
    const paginatedResults = results.slice((page - 1) * limit, page * limit);

    const withOwners = await populateListingOwners(paginatedResults.map(listingToOut));
    res.json({ listings: withOwners, page, limit, total: results.length });

    // Run live fetch in the background to not block the UI (no longer blocked by q || category)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      (async () => {
        try {
          const io = req.app.get("io");
          // Standard search cannot distinguish between area names (nakhalpara) and specific names (KFC).
          // To avoid filtering out all restaurants in Nakhalpara simply because their name isn't 'nakhalpara',
          // we pass an empty keyword array and let the location radius do the work.
          await fetchFromOSMOverpass(category || "all", lat, lng, radius, io, []);
        } catch (err) {
          console.error("Background search fetch error:", err.message);
        }
      })();
    }
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

api.get("/listings/:lid", optionalAuth, async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ id: req.params.lid }).lean();
    if (!listing) throw apiError(404, "Not found");
    const owner = await User.findOne({ id: listing.owner_id }).lean();
    const out = listingToOut(listing);
    out.owner = ownerInfo(owner);

    // Strip contact info for unauthenticated (guest) requests
    if (!req.user) {
      out.contact = {
        phone: null,
        whatsapp: null,
        email: null,
      };
    }

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

api.post("/listings/:lid/report", requireAuth, async (req, res, next) => {
  try {
    const existing = await Listing.findOne({ id: req.params.lid });
    if (!existing) throw apiError(404, "Not found");
    await Listing.updateOne({ id: req.params.lid }, { $inc: { reportCount: 1 } });
    res.json({ ok: true, reported: true });
  } catch (error) {
    next(error.status ? error : apiError(400, error.message || "Failed to report listing"));
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
    const pending = 0; // Deprecated: listings are active by default
    const totalReviews = await Review.countDocuments();
    const byCategory = {};
    for (const category of ALLOWED_CATEGORIES) {
      byCategory[category] = await Listing.countDocuments({ category, is_active: true });
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
      // Deprecated, no pending state.
      query.is_active = false; // Just return nothing or inactive if needed, but since it's removed, return empty
    } else if (status === "approved") {
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

api.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LocationKhuji API Running"
  });
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
  await removeLegacyTestAccounts();
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
