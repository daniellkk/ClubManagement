import { afterEach, describe, expect, it } from "vitest";
import { FirebaseService, parseFirebaseObject } from "./firebase.service";

// Exactly what the Firebase console shows under "SDK setup and configuration"
const CONSOLE_SNIPPET = `const firebaseConfig = {
  apiKey: "AIzaSyExample",
  authDomain: "club-demo.firebaseapp.com",
  projectId: "club-demo",
  storageBucket: "club-demo.firebasestorage.app",
  messagingSenderId: "123456",
  appId: "1:123456:web:abc",
  measurementId: "G-XYZ",
};`;

const ENV_KEYS = [
  "FIREBASE_WEB_CONFIG",
  "FIREBASE_SERVICE_ACCOUNT",
  "FIREBASE_WEB_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
];

describe("parseFirebaseObject", () => {
  it("reads the console's JS object literal as well as plain JSON", () => {
    const fromSnippet = parseFirebaseObject<{ apiKey: string; projectId: string }>(CONSOLE_SNIPPET);
    expect(fromSnippet).toMatchObject({ apiKey: "AIzaSyExample", projectId: "club-demo" });
    expect(parseFirebaseObject('{"apiKey":"k","projectId":"p"}')).toEqual({ apiKey: "k", projectId: "p" });
    expect(parseFirebaseObject("{ apiKey: 'k', projectId: 'p', }")).toEqual({ apiKey: "k", projectId: "p" });
  });
});

describe("FirebaseService configuration", () => {
  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it("stays off when nothing is set", () => {
    const s = new FirebaseService();
    expect(s.configured()).toBe(false);
    expect(s.webConfig()).toBeNull();
  });

  it("is enabled by the web config alone — no service account needed to verify sign-ins", () => {
    process.env.FIREBASE_WEB_CONFIG = CONSOLE_SNIPPET.replace(/\n/g, " ");
    const s = new FirebaseService();
    expect(s.configured()).toBe(true);
    expect(s.webConfig()).toEqual({
      apiKey: "AIzaSyExample",
      authDomain: "club-demo.firebaseapp.com",
      projectId: "club-demo",
    });
  });

  it("accepts the separate keys and derives the auth domain", () => {
    process.env.FIREBASE_WEB_API_KEY = "AIzaKey";
    process.env.FIREBASE_PROJECT_ID = "club-demo";
    const s = new FirebaseService();
    expect(s.webConfig()).toEqual({ apiKey: "AIzaKey", authDomain: "club-demo.firebaseapp.com", projectId: "club-demo" });
  });

  it("stays off, without throwing, when the api key is missing", () => {
    process.env.FIREBASE_PROJECT_ID = "club-demo";
    const s = new FirebaseService();
    expect(s.configured()).toBe(false);
  });
});
