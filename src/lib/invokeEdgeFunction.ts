import { supabase } from "@/integrations/supabase/client";

type InvokeOptions = {
  /** Pass false only for public functions (e.g. contact form). Default: send session JWT. */
  requireAuth?: boolean;
};

/**
 * PostgREST / Supabase client errors are plain objects — normalize for toasts.
 */
export function isEdgeFunctionUnreachable(error: unknown): boolean {
  if (error && typeof error === "object") {
    const e = error as { message?: string; name?: string; context?: Response };
    const msg = (e.message ?? "").trim();
    if (
      e.name === "FunctionsFetchError" ||
      e.name === "FunctionsHttpError" ||
      msg.includes("Failed to send a request to the Edge Function") ||
      (msg.includes("Edge Function") && msg.includes("not found")) ||
      msg.toLowerCase().includes("failed to fetch") ||
      msg.includes("404") ||
      msg.toLowerCase().includes("not reachable")
    ) {
      return true;
    }
    if (e.context && typeof e.context.status === "number" && e.context.status === 404) {
      return true;
    }
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("failed to send a request to the edge function") ||
      msg.includes("not reachable") ||
      msg.includes("not found") ||
      msg.includes("404")
    );
  }
  return false;
}

export function formatEdgeFunctionError(error: unknown, functionName: string): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; name?: string; context?: unknown };
    const msg = (e.message ?? "").trim();

    if (
      msg.includes("Failed to send a request to the Edge Function") ||
      e.name === "FunctionsFetchError" ||
      msg.toLowerCase().includes("failed to fetch") ||
      msg.toLowerCase().includes("network")
    ) {
      return (
        `The "${functionName}" Edge Function is not reachable. ` +
        `Deploy it in Supabase Dashboard → Edge Functions, or run: supabase functions deploy ${functionName}. ` +
        `Then set any required secrets (e.g. Paystack keys for "${functionName}").`
      );
    }

    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return `Edge Function "${functionName}" was not found. Deploy it with: supabase functions deploy ${functionName}`;
    }

    if (msg) return msg;
  }

  if (error instanceof Error && error.message) return error.message;
  return `Edge Function "${functionName}" failed.`;
}

async function readFunctionsHttpError(error: { context?: Response }): Promise<string | null> {
  try {
    const res = error.context;
    if (!res || typeof res.json !== "function") return null;
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? null;
  } catch {
    return null;
  }
}

/**
 * Invoke a Supabase Edge Function with session auth and clearer errors.
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options: InvokeOptions = {},
): Promise<T> {
  const requireAuth = options.requireAuth !== false;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (requireAuth && !token) {
    throw new Error("Please sign in again.");
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const { data, error } = await supabase.functions.invoke(functionName, { body, headers });

  if (error) {
    const errObj = error as { context?: Response; message?: string };
    if (errObj.context?.status === 404) {
      throw new Error(formatEdgeFunctionError(error, functionName));
    }
    const httpDetail =
      error && typeof error === "object" && "context" in error
        ? await readFunctionsHttpError(error as { context?: Response })
        : null;
    const detail = httpDetail ?? formatEdgeFunctionError(error, functionName);
    throw new Error(detail);
  }

  const payload = data as { error?: string } | null;
  if (payload && typeof payload === "object" && typeof payload.error === "string" && payload.error) {
    throw new Error(payload.error);
  }

  return data as T;
}
