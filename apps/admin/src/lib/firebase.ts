import type { FirebaseWebConfig } from "./auth";

type FirebaseModules = [typeof import("firebase/app"), typeof import("firebase/auth")];
let modules: Promise<FirebaseModules> | null = null;

/**
 * Loads the Firebase SDK once. Call it when the login page mounts: the browser
 * only lets `signInWithPopup` open a window shortly after the click, and a cold
 * dynamic import (Vite pre-bundling on first use in dev) can blow that window
 * and surface as "auth/popup-blocked" on the first attempt only.
 */
export function preloadFirebase(): Promise<FirebaseModules> {
  if (!modules) {
    modules = Promise.all([import("firebase/app"), import("firebase/auth")]).catch((e: unknown) => {
      modules = null; // let the next attempt retry the import
      throw e;
    });
  }
  return modules;
}

/**
 * Google sign-in through Firebase Authentication.
 * Opens the Google popup, returns a fresh Firebase ID token for the API to
 * verify, and signs the Firebase session out again — the API session cookie
 * is the only session this app keeps.
 *
 * Resolves to null when the user simply closed the popup.
 */
export async function googleIdTokenViaFirebase(config: FirebaseWebConfig): Promise<string | null> {
  const [{ getApp, getApps, initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut }] =
    await preloadFirebase();
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const credential = await signInWithPopup(auth, provider);
    return await credential.user.getIdToken();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
    throw e;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}
