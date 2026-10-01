import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { EtimsIntegrationType } from '@prisma/client';

/**
 * KRA PIN format: one letter, nine digits, one letter (e.g. P051234567X).
 * Kept as a single exported constant so the API and tests agree.
 */
export const KRA_PIN_PATTERN = /^[A-Za-z]\d{9}[A-Za-z]$/;

export class SaveTaxRegistrationDto {
  @IsString()
  @Matches(KRA_PIN_PATTERN, {
    message: 'kraPin must be a valid KRA PIN (e.g. P051234567X)',
  })
  kraPin!: string;

  /** Defaults to VSCU. OSCU is stored but out of scope for this build. */
  @IsOptional()
  @IsEnum(EtimsIntegrationType)
  integrationType?: EtimsIntegrationType;
}
