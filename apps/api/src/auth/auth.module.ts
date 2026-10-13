import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { SESSION_TTL_DAYS } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { FirebaseService } from "./firebase.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          if (process.env.NODE_ENV === "production") {
            throw new Error("JWT_SECRET must be set in production");
          }
          console.warn(
            "⚠ JWT_SECRET not set — using an insecure dev-only secret",
          );
        }
        return {
          secret: secret ?? "dev-only-insecure-secret",
          signOptions: { expiresIn: `${SESSION_TTL_DAYS}d` },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseService,
    // Every route requires a session unless marked @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}
