import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { SessionPayload } from "../auth/auth.constants";
import { CampaignsService } from "./campaigns.service";
import {
  CampaignInputDto,
  EstimateDto,
  PagedQueryDto,
  QueryCampaignsDto,
  SetEnabledDto,
  TestSendDto,
} from "./dto/campaign.dto";

type Req = Request & { user: SessionPayload };

@Controller("campaigns")
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get("meta")
  meta() {
    return this.campaigns.meta();
  }

  @Get()
  list(@Req() req: Req, @Query() query: QueryCampaignsDto) {
    return this.campaigns.list(req.user.clubId, query);
  }

  @Post("estimate")
  estimate(@Req() req: Req, @Body() dto: EstimateDto) {
    return this.campaigns.estimate(req.user.clubId, dto);
  }

  /** Base audience + how many of it match each behaviour trigger (birthday month, missed games, inactive) */
  @Post("insights")
  insights(@Req() req: Req, @Body() dto: EstimateDto) {
    return this.campaigns.insights(req.user.clubId, dto);
  }

  @Post()
  create(@Req() req: Req, @Body() dto: CampaignInputDto) {
    return this.campaigns.create(req.user.clubId, req.user.sub, dto);
  }

  @Get(":id")
  get(@Req() req: Req, @Param("id") id: string) {
    return this.campaigns.get(req.user.clubId, id);
  }

  @Put(":id")
  update(@Req() req: Req, @Param("id") id: string, @Body() dto: CampaignInputDto) {
    return this.campaigns.update(req.user.clubId, id, dto);
  }

  @Delete(":id")
  remove(@Req() req: Req, @Param("id") id: string) {
    return this.campaigns.remove(req.user.clubId, id);
  }

  @Post(":id/run")
  run(@Req() req: Req, @Param("id") id: string) {
    return this.campaigns.run(req.user.clubId, id);
  }

  @Post(":id/enabled")
  setEnabled(@Req() req: Req, @Param("id") id: string, @Body() dto: SetEnabledDto) {
    return this.campaigns.setEnabled(req.user.clubId, id, dto.enabled);
  }

  @Post(":id/test")
  testSend(@Req() req: Req, @Param("id") id: string, @Body() dto: TestSendDto) {
    return this.campaigns.testSend(req.user.clubId, id, dto);
  }

  @Get(":id/messages")
  messages(@Req() req: Req, @Param("id") id: string, @Query() query: PagedQueryDto) {
    return this.campaigns.messages(req.user.clubId, id, query);
  }
}
