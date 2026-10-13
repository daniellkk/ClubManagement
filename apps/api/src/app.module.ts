import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./auth/auth.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { FansModule } from "./fans/fans.module";
import { HealthController } from "./health/health.controller";
import { MessagingModule } from "./messaging/messaging.module";
import { PrismaModule } from "./prisma/prisma.module";
import { StatsModule } from "./stats/stats.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Dynamic cron jobs (one per scheduled campaign) live in the SchedulerRegistry
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    FansModule,
    StatsModule,
    MessagingModule,
    CampaignsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
