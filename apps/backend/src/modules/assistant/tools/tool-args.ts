import { BadRequestException } from '@nestjs/common';

/**
 * Shared argument coercion for assistant tools. Every tool validates the
 * model-supplied JSON before it is used, so a tool can never receive an
 * object, a negative quantity or an over-long string. Writes re-validate the
 * same args again at commit time via the executor's hash check.
 */
export function asRecord(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    throw new BadRequestException('Tool arguments must be an object.');
  }
  return args as Record<string, unknown>;
}

export function asString(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`"${field}" is required.`);
  }
  if (value.length > max) {
    throw new BadRequestException(`"${field}" is too long.`);
  }
  return value.trim();
}

export function asOptionalString(
  value: unknown,
  field: string,
  max = 2000,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException(`"${field}" must be text.`);
  }
  return value.slice(0, max);
}

export function asPositiveNumber(value: unknown, field: string): number {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) {
    throw new BadRequestException(`"${field}" must be a positive number.`);
  }
  return num;
}

export function asOptionalNonNegative(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num) || num < 0) {
    throw new BadRequestException(
      `"${field}" must be zero or a positive number.`,
    );
  }
  return num;
}

export function asLimit(value: unknown, fallback: number, max = 50): number {
  if (value === undefined) return fallback;
  const requested = asPositiveNumber(value, 'limit');
  return Math.min(max, Math.max(1, Math.floor(requested)));
}

/** Validates a required value against an allow-list (case-insensitively). */
export function asEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string') {
    throw new BadRequestException(`"${field}" must be one of ${allowed.join(', ')}.`);
  }
  const match = allowed.find(
    (entry) => entry.toLowerCase() === value.trim().toLowerCase(),
  );
  if (!match) {
    throw new BadRequestException(
      `"${field}" must be one of ${allowed.join(', ')}.`,
    );
  }
  return match;
}

export function asOptionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return asEnum(value, field, allowed);
}

/** Validates an optional email address. */
export function asOptionalEmail(
  value: unknown,
  field = 'email',
): string | undefined {
  const email = asOptionalString(value, field, 200);
  if (email === undefined) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException(`"${field}" must be a valid email address.`);
  }
  return email;
}

/** Validates a required date and normalises it to an ISO string. */
export function asDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`"${field}" is required.`);
  }
  if (value.length > 40) {
    throw new BadRequestException(`"${field}" is too long.`);
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`"${field}" must be a valid date.`);
  }
  return date.toISOString();
}

/** Validates an optional date and normalises it to an ISO string. */
export function asOptionalDate(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return asDate(value, field);
}
