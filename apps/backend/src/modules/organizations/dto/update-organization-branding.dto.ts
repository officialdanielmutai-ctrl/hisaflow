import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateOrganizationBrandingDto {
  /**
   * Public image URL used in the signed-in app shell. `null` or an empty
   * string clears the override so the email-domain logo / monogram returns.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string | null
}
