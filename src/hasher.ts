import { createHash } from "node:crypto";

/**
 * Produces a SHA-256 hex digest of the given string.
 * Used as the delivery proof for the CROO CAP protocol
 * to verify that the audit result was actually delivered.
 */
export function hashResult(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}
