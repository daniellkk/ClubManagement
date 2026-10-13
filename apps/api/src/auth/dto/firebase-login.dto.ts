import { IsString, MaxLength, MinLength } from "class-validator";

export class FirebaseLoginDto {
  /** Firebase ID token from the web SDK after the Google popup */
  @IsString()
  @MinLength(20)
  @MaxLength(8192)
  idToken!: string;
}
