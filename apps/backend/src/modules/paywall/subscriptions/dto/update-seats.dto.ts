import { IsInt, Min } from 'class-validator';

/**
 * Additional seats beyond the tier's included allowance. `0` removes any
 * purchased seats (you cannot go below the tier's base allowance — that is what
 * changing plan is for). See Section 7 item 4
 * (auto-bill overage rather than block).
 */
export class UpdateSeatsDto {
  @IsInt()
  @Min(0)
  additionalSeats!: number;
}
