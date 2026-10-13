import { Injectable, Logger } from "@nestjs/common";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

/** Public Firebase web config the login page needs to open the Google popup. */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

interface ServiceAccountJson {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}

/**
 * Parses the object the Firebase console hands out. It is a JS literal
 * (`const firebaseConfig = { apiKey: "…", … };`), not JSON, so unquoted keys,
 * trailing commas, single quotes and the surrounding statement are tolerated.
 */
export function parseFirebaseObject<T extends object>(text: string): T {
  let s = text.trim();
  s = s.replace(/^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
  try {
    return JSON.parse(s) as T;
  } catch {
    const loose = s
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":') // quote keys
      .replace(/'([^'\\]*)'/g, '"$1"') // single → double quotes
      .replace(/,(\s*[}\]])/g, "$1"); // trailing commas
    return JSON.parse(loose) as T;
  }
}

/**
 * Firebase Authentication bridge (login "option B"):
 * the admin app signs in with the Firebase web SDK, sends the ID token here,
 * and we verify it before issuing our own session cookie.
 *
 * Env (apps/api/.env):
 *   FIREBASE_WEB_CONFIG     the web app config object from the Firebase console, on one line
 *                           in single quotes — apiKey / authDomain / projectId are used
 *   FIREBASE_SERVICE_ACCOUNT optional: service-account JSON (inline or a file path). Not
 *                           needed to verify sign-ins (Google's public keys do that); it only
 *                           enables server-side admin operations later.
 *   FIREBASE_WEB_API_KEY / FIREBASE_AUTH_DOMAIN / FIREBASE_PROJECT_ID — alternative to the
 *                           config object, or overrides.
 */
@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private web: FirebaseWebConfig | null = null;

  constructor() {
    const anySet = ["FIREBASE_WEB_CONFIG", "FIREBASE_SERVICE_ACCOUNT", "FIREBASE_WEB_API_KEY", "FIREBASE_PROJECT_ID"].some(
      (k) => process.env[k]?.trim(),
    );
    if (!anySet) return;
    try {
      const webConfig = this.readWebConfig();
      const account = this.readServiceAccount();
      const projectId =
        process.env.FIREBASE_PROJECT_ID?.trim() || account?.project_id || webConfig?.projectId || null;
      const apiKey = process.env.FIREBASE_WEB_API_KEY?.trim() || webConfig?.apiKey || null;
      if (!projectId || !apiKey) {
        this.logger.warn(
          `Firebase Authentication not enabled — missing ${!apiKey ? "apiKey (FIREBASE_WEB_CONFIG or FIREBASE_WEB_API_KEY)" : "projectId"}`,
        );
        return;
      }
      this.web = {
        apiKey,
        projectId,
        authDomain:
          process.env.FIREBASE_AUTH_DOMAIN?.trim() || webConfig?.authDomain || `${projectId}.firebaseapp.com`,
      };
      this.app = getApps().length
        ? getApp()
        : initializeApp(
            account
              ? {
                  projectId,
                  credential: cert({
                    projectId: account.project_id,
                    clientEmail: account.client_email,
                    // a JSON pasted into .env may carry escaped "\n" inside the key
                    privateKey: account.private_key?.replace(/\\n/g, "\n"),
                  }),
                }
              : { projectId },
          );
      this.logger.log(
        `Firebase Authentication enabled for project ${projectId} (service account: ${account ? "yes" : "no"})`,
      );
    } catch (e) {
      this.logger.error(`Firebase configuration could not be loaded: ${(e as Error).message}`);
      this.app = null;
      this.web = null;
    }
  }

  private readWebConfig(): Partial<FirebaseWebConfig> | null {
    const value = process.env.FIREBASE_WEB_CONFIG?.trim();
    return value ? parseFirebaseObject<Partial<FirebaseWebConfig>>(value) : null;
  }

  private readServiceAccount(): ServiceAccountJson | null {
    const value = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (!value) return null;
    const text = value.startsWith("{") ? value : readFileSync(value, "utf8");
    return parseFirebaseObject<ServiceAccountJson>(text);
  }

  configured(): boolean {
    return this.app !== null && this.web !== null;
  }

  webConfig(): FirebaseWebConfig | null {
    return this.web;
  }

  /** Verified against Google's public signing keys; needs only the project id. */
  verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.app) throw new Error("Firebase is not configured");
    return getAuth(this.app).verifyIdToken(idToken);
  }
}
