import { useCallback, useMemo } from "react";
import { useSchoolInfo } from "@/hooks/useSchoolInfo";
import {
  formatMoney,
  formatMoneyCompact,
  getCurrencySymbol,
  normalizeCurrencyCode,
  type FormatMoneyOptions,
} from "@/lib/currency";

/** School display currency from admin billing settings — symbol updates when currency changes. */
export function useSchoolCurrency() {
  const { currentSchool, refetch, isLoading } = useSchoolInfo();

  const currency = useMemo(
    () => normalizeCurrencyCode(currentSchool?.currency),
    [currentSchool?.currency],
  );

  const symbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const format = useCallback(
    (amount: number, overrideCode?: string | null, options?: FormatMoneyOptions) =>
      formatMoney(amount, overrideCode ?? currency, options),
    [currency],
  );

  const formatCompact = useCallback(
    (amount: number, overrideCode?: string | null) =>
      formatMoneyCompact(amount, overrideCode ?? currency),
    [currency],
  );

  return { currency, symbol, format, formatCompact, refetch, loading: isLoading };
}
