const path = require("path");
const mongoose = require("mongoose");
const admin = require("firebase-admin");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "locationkhuji";

function normalizePrivateKey(privateKey) {
  return privateKey ? privateKey.replace(/\\n/g, "\n") : privateKey;
}

function usage() {
  console.error("Usage: npm run make-admin -- email@example.com");
}

function getEmailArg() {
  const email = process.argv[2];
  if (!email || email.startsWith("-") || !email.includes("@")) {
    usage();
    process.exit(1);
  }
  return email.trim().toLowerCase();
}

function createFirebaseAdminApp() {
  if (admin.apps.length) return;

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!rawServiceAccount) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required");
  }

  const serviceAccount = JSON.parse(rawServiceAccount);
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id || serviceAccount.projectId,
      clientEmail: serviceAccount.client_email || serviceAccount.clientEmail,
      privateKey: normalizePrivateKey(serviceAccount.private_key || serviceAccount.privateKey),
    }),
    projectId: serviceAccount.project_id || serviceAccount.projectId,
  });
}

async function promoteAdmin(email) {
  if (!MONGO_URL) throw new Error("MONGO_URL is required");

  createFirebaseAdminApp();
  await mongoose.connect(MONGO_URL, { dbName: DB_NAME });

  let firebaseUser;
  try {
    firebaseUser = await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new Error(`No Firebase user found for ${email}. Register or create the user first, then run this again.`);
    }
    throw error;
  }

  await admin.auth().setCustomUserClaims(firebaseUser.uid, {
    ...(firebaseUser.customClaims || {}),
    role: "admin",
  });

  const users = mongoose.connection.collection("users");
  const name = firebaseUser.displayName || email.split("@")[0] || "Admin";
  await users.updateOne(
    { email },
    {
      $set: {
        id: firebaseUser.uid,
        name,
        email,
        role: "admin",
        is_active: true,
        is_verified: Boolean(firebaseUser.emailVerified),
      },
      $setOnInsert: {
        avatar: firebaseUser.photoURL || null,
        phone: null,
        saved_listings: [],
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  console.log(`${email} is now an admin.`);
}

async function main() {
  const email = getEmailArg();
  await promoteAdmin(email);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
    if (admin.apps.length) await admin.app().delete().catch(() => {});
  });
