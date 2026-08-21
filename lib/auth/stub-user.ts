/**
 * Test-only stub user identity.
 *
 * Import this file ONLY from test files (*.test.ts / *.spec.ts).
 * Production code must use getCurrentUser() from ./current-user instead.
 *
 * This module is intentionally separate from current-user.ts so that importing
 * getCurrentUser() in production routes does NOT trigger this stub at
 * module-evaluation time (which would crash next build in NODE_ENV=production).
 */
import type { CurrentUser } from "./current-user";

export const STUB_BUSINESS_ID = "00000000-0000-0000-0000-000000000000";
const STUB_USER_ID = "00000000-0000-0000-0000-000000000001";

export const STUB_USER: CurrentUser = {
  id: STUB_USER_ID,
  role: "owner" as const,
  businessId: STUB_BUSINESS_ID,
  isStub: true,
};
