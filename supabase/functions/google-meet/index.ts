/// <reference path="../deno-shim.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleGoogleMeet } from "../_shared/googleMeet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const body = (await req.json()) as Record<string, unknown>;

  return handleGoogleMeet(
    body,
    authHeader,
    {
      supabaseUrl: Deno.env.get("SUPABASE_URL")!,
      supabaseAnon: Deno.env.get("SUPABASE_ANON_KEY")!,
      serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    },
    jsonResponse,
  );
});
