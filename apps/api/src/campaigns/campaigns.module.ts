import { Module } from "@nestjs/common";
import { MessagingModule } from "../messaging/messaging.module";
import { CampaignRunnerService } from "./campaign-runner.service";
import { CampaignSchedulerService } from "./campaign-scheduler.service";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";

@Module({
  imports: [MessagingModule],
  controllers: [CampaignsController],
  providers: [CampaignRunnerService, CampaignSchedulerService, CampaignsService],
})
export class CampaignsModule {}
