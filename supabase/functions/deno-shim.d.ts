/**
 * IDE-only type shims for Supabase Edge Functions (Deno URL imports).
 * Runtime on Supabase still resolves these URLs via Deno — do not import from npm here.
 */
declare module "https://esm.sh/@supabase/supabase-js@2" {
  export type SupabaseClient = any;
  export function createClient(...args: any[]): SupabaseClient;
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.0" {
  export type SupabaseClient = any;
  export function createClient(...args: any[]): SupabaseClient;
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: {
      port?: number;
      hostname?: string;
      signal?: AbortSignal;
      onListen?: (params: { hostname: string; port: number }) => void;
    },
  ): Promise<void>;
}

declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}
