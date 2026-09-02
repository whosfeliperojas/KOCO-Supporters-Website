import { randomBytes } from "node:crypto";

/**
 * Fresh random temp password per account — never a shared constant, so
 * reading the source (e.g. a public repo) never reveals a working password
 * for any not-yet-activated account. Excludes visually ambiguous characters
 * (0/O, 1/l/I) since a human has to read and retype this once.
 */
export function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}
