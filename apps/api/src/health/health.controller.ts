import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    let db = "up";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    return { status: "ok", db, timestamp: new Date().toISOString() };
  }
}
