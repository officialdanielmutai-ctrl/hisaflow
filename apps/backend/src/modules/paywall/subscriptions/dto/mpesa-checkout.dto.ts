import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';
import { HisaflowPlanTier } from '@prisma/client';

/** Kenyan mobile number: 07.., 01.., 2547.., +2547.. . */
const KENYAN_PHONE = /^(\+?254|0)(7|1)\d{8}$/;

export class MpesaCheckoutDto {
  @IsEnum(HisaflowPlanTier)
  tier!: HisaflowPlanTier;

  @IsString()
  @Matches(KENYAN_PHONE, {
    message: 'mpesaPhone must be a valid Kenyan mobile number',
  })
  mpesaPhone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;
}
