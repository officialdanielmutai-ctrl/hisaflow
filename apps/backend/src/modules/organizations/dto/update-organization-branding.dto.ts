import { IsOptional, IsString, MaxLength } from 'class-validator'
import { MAX_LOGO_URL_LENGTH } from '../branding.constants'

export class UpdateOrganizationBrandingDto {
  /**
   * Public image URL, or a client-compressed `data:image/...` URL, used in the
   * signed-in app shell. `null` or an empty string clears the override so the
   * email-domain logo / monogram returns.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LOGO_URL_LENGTH)
  logoUrl?: string | null
}
