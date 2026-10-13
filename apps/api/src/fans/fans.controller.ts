import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import type { SessionPayload } from "../auth/auth.constants";
import { ExistsDto, ImportFansDto } from "./dto/import-fans.dto";
import { FacetsQueryDto, QueryFansDto } from "./dto/query-fans.dto";
import { UpdateFanDto } from "./dto/update-fan.dto";
import { FansService } from "./fans.service";

@Controller("fans")
export class FansController {
  constructor(private readonly fans: FansService) {}

  @Get()
  list(@Query() query: QueryFansDto) {
    return this.fans.list(query);
  }

  @Get("facets")
  facets(@Query() query: FacetsQueryDto) {
    return this.fans.facets(query);
  }

  @Get("meta/cities")
  cities() {
    return this.fans.cities();
  }

  @Post("import")
  importRows(
    @Body() dto: ImportFansDto,
    @Req() req: Request & { user?: SessionPayload },
  ) {
    return this.fans.importRows(dto, req.user?.sub ?? null);
  }

  @Post("exists")
  exists(@Body() dto: ExistsDto) {
    return this.fans.exists(dto);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.fans.detail(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFanDto) {
    return this.fans.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.fans.remove(id);
  }
}
