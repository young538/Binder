/**
 * Sentinel placeholder written by migration 0003 to satisfy NOT NULL on
 * pre-existing rows. Runtime backfillUserId() in ./client swaps this for the
 * real admin ULID once the users table is seeded.
 *
 * Lives in a leaf module (no imports) to break a circular import: schema.ts
 * needs this constant for column .default() values, and client.ts imports
 * schema.ts. Keeping the constant here means schema.ts and client.ts both
 * import a third file rather than each other. (Turbopack hits a TDZ at module
 * init when the cycle is between client.ts and schema.ts directly.)
 */
export const PENDING_ADMIN_USER_ID = 'pending-admin';
