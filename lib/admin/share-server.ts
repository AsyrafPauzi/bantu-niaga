import "server-only";

import { generateShareHash } from "@/lib/utils/share-hash";

export function newAdminFileShareHash(): string {
  return generateShareHash();
}
