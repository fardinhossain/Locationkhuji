import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

function assertFirebaseConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value || String(value).startsWith("your_"))
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase config: ${missing.join(", ")}`);
  }
}

function getFirebaseAuth() {
  assertFirebaseConfig();
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getAuth(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Initiates a Google sign-in redirect. Call this to start the flow;
 * the browser will navigate away to Google and return to the app.
 * Store any state (role, mode) in sessionStorage before calling.
 */
export function signInWithGoogleRedirect() {
  return signInWithRedirect(getFirebaseAuth(), googleProvider);
}

/**
 * Resolves the Google redirect result after returning from Google.
 * Returns null if no redirect result is pending.
 */
export async function getGoogleRedirectResult() {
  const result = await getRedirectResult(getFirebaseAuth());
  if (!result) return null;
  const idToken = await result.user.getIdToken();
  return { idToken, refreshToken: result.user.refreshToken, firebaseUser: result.user };
}
