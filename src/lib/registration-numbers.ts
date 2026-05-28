/**
 * @deprecated Import from `@/lib/admission-numbers` instead.
 * Kept for backward compatibility during auth restructure.
 */
export {
  type RegistrationPoolType as RegistrationNumberType,
  generateRegistrationNumber,
  fetchSchoolPrefixById,
  buildAdmissionNumber,
  formatExample,
  normalizeAdmissionNumber,
  parseAdmissionNumber,
  getNextSequenceNumber,
  POOL_TO_ROLE,
  ROLE_TO_POOL,
} from "@/lib/admission-numbers";

import type { RegistrationPoolType } from "@/lib/admission-numbers";
import {
  fetchSchoolPrefixById,
  getNextSequenceNumber as getNextSeq,
} from "@/lib/admission-numbers";

/** @deprecated Use getNextSequenceNumber from admission-numbers with schoolPrefix */
export async function getLegacyNextSequenceNumber(
  schoolId: string,
  type: RegistrationPoolType,
  year: number = new Date().getFullYear()
): Promise<number> {
  const schoolPrefix = await fetchSchoolPrefixById(schoolId);
  return getNextSeq(schoolId, type, schoolPrefix, year);
}

/** @deprecated */
export function getRegistrationPrefix(type: RegistrationPoolType, year: number = new Date().getFullYear()): string {
  return type === "student" ? `ADM-${year}-` : `EMP-${year}-`;
}
