import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { SESSION_COOKIE, SessionPayload } from "./auth.constants";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionPayload }>();
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException("נדרשת התחברות");

    try {
      request.user = await this.jwt.verifyAsync<SessionPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException("פג תוקף ההתחברות, יש להתחבר מחדש");
    }
  }
}
