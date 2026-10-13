import { Module } from "@nestjs/common";
import { InforuService } from "./inforu.service";

@Module({
  providers: [InforuService],
  exports: [InforuService],
})
export class MessagingModule {}
