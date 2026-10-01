import { IsBoolean } from 'class-validator';

export class SubmitTaxRegistrationDto {
  /**
   * The eTIMS Commitment Form is a KRA-side requirement the org completes
   * outside HisaFlow. This is the org owner acknowledging it was submitted,
   * not HisaFlow claiming KRA has approved anything.
   */
  @IsBoolean()
  commitmentFormAcknowledged!: boolean;
}
