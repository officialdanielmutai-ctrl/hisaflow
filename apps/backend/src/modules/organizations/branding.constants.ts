/**
 * Logo overrides are either a public http(s) URL or a client-compressed image
 * data URL. The size is capped by the Settings uploader before it reaches the
 * API, so a logo can be stored without a separate file-storage service.
 */
export const MAX_LOGO_URL_LENGTH = 80_000
export const MAX_LOGO_DATA_URL_LENGTH = 80_000

export const LOGO_DATA_URL_PATTERN =
  /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/]+={0,2}$/i
