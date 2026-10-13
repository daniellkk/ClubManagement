import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AdminUser } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { SessionPayload } from "./auth.constants";
import { OnboardingDto } from "./dto/onboarding.dto";
import type { DecodedIdToken } from "firebase-admin/auth";
import { FirebaseService } from "./firebase.service";
import { TEAM_SYMBOLS, type TeamSymbol } from "./team-symbols";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

/** Club fields the frontend needs alongside the session user */
const CLUB_SELECT = {
  select: {
    name: true,
    primaryColor: true,
    logoUrl: true,
    symbol: true,
    onboardedAt: true,
  },
} as const;

interface ClubInfo {
  name: string;
  primaryColor: string;
  logoUrl: string | null;
  symbol: string | null;
  onboardedAt: Date | null;
}

export interface SafeAdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  googleLinked: boolean;
  clubId: string;
  clubName: string;
  clubPrimaryColor: string;
  clubLogoUrl: string | null;
  clubSymbol: string | null;
  onboarded: boolean;
}

interface GoogleUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly firebase: FirebaseService,
  ) {}

  /** What the login page may offer: direct Google OAuth and/or Firebase Auth. */
  authConfig() {
    return { google: this.googleConfigured(), firebase: this.firebase.webConfig() };
  }

  // ── Email + password ───────────────────────────────────────────────────────

  async loginWithPassword(email: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { club: CLUB_SELECT },
    });
    // Same error for wrong email and wrong password — don't leak which admins exist
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException("אימייל או סיסמה שגויים");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("אימייל או סיסמה שגויים");

    return this.startSession(user, user.club);
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────

  googleConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  async googleAuthUrl(): Promise<string> {
    if (!this.googleConfigured()) {
      throw new ServiceUnavailableException(
        "התחברות עם Google אינה מוגדרת עדיין",
      );
    }
    // Short-lived signed state token protects the callback against CSRF
    const state = await this.jwt.signAsync(
      { purpose: "google_oauth" },
      { expiresIn: "10m" },
    );
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: this.googleRedirectUri(),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async loginWithGoogle(code: string, state: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ purpose: string }>(state);
      if (payload.purpose !== "google_oauth") throw new Error("bad state");
    } catch {
      throw new UnauthorizedException("בקשת ההתחברות אינה תקינה, נסה שוב");
    }

    return this.signInWithGoogleIdentity(await this.fetchGoogleUser(code));
  }

  // ── Firebase Authentication (Google popup in the browser) ─────────────────

  async loginWithFirebase(idToken: string) {
    if (!this.firebase.configured()) {
      throw new ServiceUnavailableException("התחברות עם Firebase אינה מוגדרת עדיין");
    }
    let decoded: DecodedIdToken;
    try {
      decoded = await this.firebase.verifyIdToken(idToken);
    } catch (e) {
      // Server log only — the reason (expired, wrong project, clock skew…) never reaches the browser
      this.logger.warn(`Firebase ID token rejected: ${(e as Error).message}`);
      throw new UnauthorizedException("ההתחברות עם Google נכשלה");
    }
    // Same person, same key: Firebase exposes the Google account id under identities
    const googleIds = decoded.firebase?.identities?.["google.com"] as unknown;
    const sub = Array.isArray(googleIds) && googleIds[0] ? String(googleIds[0]) : decoded.uid;
    return this.signInWithGoogleIdentity({
      sub,
      email: decoded.email,
      email_verified: decoded.email_verified,
      name: decoded.name as string | undefined,
      picture: decoded.picture,
    });
  }

  /** Invite-only check + account linking shared by both Google paths. */
  private async signInWithGoogleIdentity(info: GoogleUserInfo) {
    if (!info.email || info.email_verified === false) {
      throw new UnauthorizedException("חשבון Google ללא אימייל מאומת");
    }

    const user = await this.prisma.adminUser.findUnique({
      where: { email: info.email.toLowerCase() },
      include: { club: CLUB_SELECT },
    });
    // Invite-only: the email must already exist as an admin
    if (!user || !user.isActive) {
      throw new ForbiddenException("not_invited");
    }
    if (user.googleId && user.googleId !== info.sub) {
      throw new ForbiddenException("not_invited");
    }

    // An invited admin starts with no name — take it from the Google profile
    const needsName = !user.name.trim() && Boolean(info.name);
    if (!user.googleId || (!user.avatarUrl && info.picture) || needsName) {
      const data = {
        googleId: info.sub,
        avatarUrl: user.avatarUrl ?? info.picture ?? null,
        ...(needsName ? { name: info.name!.trim() } : {}),
      };
      await this.prisma.adminUser.update({ where: { id: user.id }, data });
      Object.assign(user, data);
    }

    return this.startSession(user, user.club);
  }

  private async fetchGoogleUser(code: string): Promise<GoogleUserInfo> {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: this.googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException("ההתחברות עם Google נכשלה");
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new UnauthorizedException("ההתחברות עם Google נכשלה");
    }

    const infoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) {
      throw new UnauthorizedException("ההתחברות עם Google נכשלה");
    }
    return (await infoRes.json()) as GoogleUserInfo;
  }

  private googleRedirectUri(): string {
    return (
      process.env.GOOGLE_REDIRECT_URI ??
      "http://localhost:3000/api/auth/google/callback"
    );
  }

  // ── Session ────────────────────────────────────────────────────────────────

  async me(userId: string): Promise<SafeAdminUser> {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      include: { club: CLUB_SELECT },
    });
    // Deactivated admins lose access as soon as the app re-checks the session
    if (!user || !user.isActive) throw new UnauthorizedException("נדרשת התחברות");
    return this.toSafeUser(user, user.club);
  }

  /** Team symbols offered by the onboarding wizard (single source: team-symbols.ts). */
  teamSymbols(): readonly TeamSymbol[] {
    return TEAM_SYMBOLS;
  }

  /** First-login wizard: owner name, team symbol + name, logo and brand color. */
  async completeOnboarding(
    userId: string,
    dto: OnboardingDto,
  ): Promise<SafeAdminUser> {
    const user = await this.prisma.adminUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException("נדרשת התחברות");
    const [updatedUser, club] = await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: userId },
        data: { name: dto.ownerName.trim() },
      }),
      this.prisma.club.update({
        where: { id: user.clubId },
        data: {
          name: dto.clubName.trim(),
          symbol: dto.symbol,
          primaryColor: dto.primaryColor.toLowerCase(),
          // undefined = keep the current logo, null = remove, string = replace
          logoUrl: dto.logoDataUrl === undefined ? undefined : dto.logoDataUrl,
          onboardedAt: new Date(),
        },
        select: CLUB_SELECT.select,
      }),
    ]);
    return this.toSafeUser(updatedUser, club);
  }

  private async startSession(user: AdminUser, club: ClubInfo) {
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const payload: SessionPayload = {
      sub: user.id,
      clubId: user.clubId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = await this.jwt.signAsync(payload);
    return { token, user: this.toSafeUser(user, club) };
  }

  private toSafeUser(user: AdminUser, club: ClubInfo): SafeAdminUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      googleLinked: Boolean(user.googleId),
      clubId: user.clubId,
      clubName: club.name,
      clubPrimaryColor: club.primaryColor,
      clubLogoUrl: club.logoUrl,
      clubSymbol: club.symbol,
      onboarded: club.onboardedAt !== null,
    };
  }
}
