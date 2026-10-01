import { IsEnum, IsString, MinLength } from 'class-validator';
import { EtimsRegistrationStatus } from '@prisma/client';

/**
 * Records a KRA-reported outcome the org owner has observed on the KRA portal.
 * The service rejects statuses that are not legitimately reportable here.
 */
export class RecordKraOutcomeDto {
  @IsEnum(EtimsRegistrationStatus)
  status!: EtimsRegistrationStatus;

  /** Required: what KRA said / the reference, so the trail is auditable. */
  @IsString()
  @MinLength(3)
  note!: string;
}
