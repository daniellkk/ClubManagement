import { Module } from "@nestjs/common";
import { FansController } from "./fans.controller";
import { FansService } from "./fans.service";

@Module({
  controllers: [FansController],
  providers: [FansService],
})
export class FansModule {}
