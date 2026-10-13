import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";
import type { FirebaseService } from "./firebase.service";

const club = { name: "הפועל באר שבע", primaryColor: "#dc2626", logoUrl: null, symbol: null, onboardedAt: null };

const invitedOwner = {
  id: "u1",
  clubId: "c1",
  email: "owner@example.com",
  name: "",
  role: "OWNER",
  isActive: true,
  googleId: null as string | null,
  avatarUrl: null as string | null,
  passwordHash: null,
  club,
};

/** A Firebase ID token after a Google popup, as firebase-admin decodes it */
const decoded = {
  uid: "firebase-uid",
  email: "Owner@Example.com",
  email_verified: true,
  name: "Daniel K",
  picture: "https://lh3.example/photo.png",
  firebase: { identities: { "google.com": ["google-sub-1"] }, sign_in_provider: "google.com" },
};

function setup(opts: { admin?: typeof invitedOwner | null; token?: Record<string, unknown>; configured?: boolean } = {}) {
  const admin = opts.admin === undefined ? { ...invitedOwner } : opts.admin;
  const prisma = {
    adminUser: {
      findUnique: vi.fn(async (_args: { where: { email?: string; id?: string } }) => admin),
      update: vi.fn(async (_args: { where: { id: string }; data: Record<string, unknown> }) => admin),
    },
  };
  const jwt = { signAsync: vi.fn(async () => "session-token"), verifyAsync: vi.fn() };
  const firebase = {
    configured: () => opts.configured ?? true,
    webConfig: () => null,
    verifyIdToken: vi.fn(async () => opts.token ?? decoded),
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    firebase as unknown as FirebaseService,
  );
  return { service, prisma, jwt, firebase };
}

describe("AuthService.loginWithFirebase — invite-only Google sign-in through Firebase", () => {
  it("is unavailable until the service account is configured", async () => {
    const { service } = setup({ configured: false });
    await expect(service.loginWithFirebase("token")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects a token firebase-admin cannot verify", async () => {
    const { service, firebase } = setup();
    firebase.verifyIdToken.mockRejectedValueOnce(new Error("expired"));
    await expect(service.loginWithFirebase("token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects emails that were never invited, without creating anything", async () => {
    const { service, prisma } = setup({ admin: null });
    await expect(service.loginWithFirebase("token")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.adminUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "owner@example.com" } }),
    );
    expect(prisma.adminUser.update).not.toHaveBeenCalled();
  });

  it("links the invited admin to the Google account, copies the profile, and starts a session", async () => {
    const { service, prisma, jwt } = setup();
    const res = await service.loginWithFirebase("token");
    // first update = linking (the second one stamps lastLoginAt)
    expect(prisma.adminUser.update.mock.calls[0][0]).toMatchObject({
      where: { id: "u1" },
      data: { googleId: "google-sub-1", avatarUrl: "https://lh3.example/photo.png", name: "Daniel K" },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: "u1", email: "owner@example.com" }));
    expect(res.token).toBe("session-token");
    expect(res.user).toMatchObject({ email: "owner@example.com", name: "Daniel K", googleLinked: true, onboarded: false });
  });

  it("falls back to the Firebase uid when the token has no Google identity", async () => {
    const { service, prisma } = setup({ token: { ...decoded, firebase: { identities: {}, sign_in_provider: "custom" } } });
    await service.loginWithFirebase("token");
    expect(prisma.adminUser.update.mock.calls[0][0]).toMatchObject({ data: { googleId: "firebase-uid" } });
  });

  it("refuses a different Google account on an already-linked admin", async () => {
    const { service } = setup({ admin: { ...invitedOwner, googleId: "someone-else" } });
    await expect(service.loginWithFirebase("token")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses unverified emails", async () => {
    const { service } = setup({ token: { ...decoded, email_verified: false } });
    await expect(service.loginWithFirebase("token")).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
