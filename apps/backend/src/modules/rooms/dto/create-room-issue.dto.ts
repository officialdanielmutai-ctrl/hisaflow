import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsIn } from 'class-validator';

/** Kinds of room faults we let a reporter classify. Free-form detail still
 * goes in the mandatory `description`. */
export const ROOM_ISSUE_CATEGORIES = [
  'REPAIR',
  'PLUMBING',
  'ELECTRICAL',
  'APPLIANCE',
  'CLEANING',
  'OTHER',
] as const;

export class CreateRoomIssueDto {
  /** Mandatory: what actually broke, written by the reporter. */
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  @IsIn(ROOM_ISSUE_CATEGORIES)
  category?: string;

  /** How expensive the fault was/is (optional at report time). */
  @IsNumber()
  @IsOptional()
  @Min(0)
  cost?: number;
}
