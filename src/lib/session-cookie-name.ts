/**
 * Standalone module so it can be safely imported from the Edge runtime
 * (middleware.ts) without dragging in node:crypto.
 */
export const SESSION_COOKIE_NAME = "makara_sid";
