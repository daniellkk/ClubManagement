import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  SESSION_COOKIE,
  SessionPayload,
  sessionCookieOptions,
} from "./auth.constants";
import { AuthService } from "./auth.service";
import { FirebaseLoginDto } from "./dto/firebase-login.dto";
import { LoginDto } from "./dto/login.dto";
import { OnboardingDto } from "./dto/onboarding.dto";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.loginWithPassword(
      dto.email,
      dto.password,
    );
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return user;
  }

  /** Which sign-in methods are configured (public: the login page reads it) */
  @Public()
  @Get("config")
  config() {
    return this.auth.authConfig();
  }

  @Public()
  @Post("firebase")
  async firebase(
    @Body() dto: FirebaseLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.loginWithFirebase(dto.idToken);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return user;
  }

  @Public()
  @Get("google")
  async google(@Res() res: Response) {
    res.redirect(await this.auth.googleAuthUrl());
  }

  @Public()
  @Get("google/callback")
  async googleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    const adminUrl = process.env.ADMIN_APP_URL ?? "http://localhost:5173";
    if (error || !code || !state) {
      return res.redirect(`${adminUrl}/login?error=google`);
    }
    try {
      const { token } = await this.auth.loginWithGoogle(code, state);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
      return res.redirect(adminUrl);
    } catch (e) {
      const reason =
        e instanceof ForbiddenException ? "not_invited" : "google";
      return res.redirect(`${adminUrl}/login?error=${reason}`);
    }
  }

  @Public()
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  me(@Req() req: Request & { user: SessionPayload }) {
    return this.auth.me(req.user.sub);
  }

  @Get("team-symbols")
  teamSymbols() {
    return this.auth.teamSymbols();
  }

  @Post("onboarding")
  onboarding(
    @Req() req: Request & { user: SessionPayload },
    @Body() dto: OnboardingDto,
  ) {
    return this.auth.completeOnboarding(req.user.sub, dto);
  }
}
