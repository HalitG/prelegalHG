/** The account rules, as the backend checks them (backend/app/auth.py). */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;
export const MAX_NAME = 100;

export function looksLikeEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());
}
