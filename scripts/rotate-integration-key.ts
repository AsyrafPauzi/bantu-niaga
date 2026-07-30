#!/usr/bin/env npx tsx
/**
 * Generate a new INTEGRATION_ENCRYPTION_KEY for .env / Vercel.
 * Does NOT rotate existing sealed data — use only before first deploy
 * or with a planned re-encryption migration.
 */
import { randomBytes } from "node:crypto";

const key = randomBytes(32).toString("hex");
console.log("INTEGRATION_ENCRYPTION_KEY=" + key);
console.log("\nAdd to Vercel production + .env.local before saving integration secrets.");
