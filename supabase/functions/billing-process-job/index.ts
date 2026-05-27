import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const jobId = body.jobId as string;
    const maxChunks = Math.min(Number(body.maxChunks ?? 50), 100);
    const chunkSize = Math.min(Number(body.chunkSize ?? 200), 500);

    if (!jobId) {
      return new Response(JSON.stringify({ error: "jobId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let progress = { processed: 0, total: 0, invoices_created: 0 };
    let chunks = 0;

    while (chunks < maxChunks) {
      const { data, error } = await supabase.rpc("process_billing_job_chunk", {
        p_job_id: jobId,
        p_chunk_size: chunkSize,
      });
      if (error) throw error;
      progress = data as typeof progress;
      chunks += 1;
      if (progress.total > 0 && progress.processed >= progress.total) break;
    }

    const { data: job } = await supabase
      .from("billing_jobs")
      .select("status, progress, error_message")
      .eq("id", jobId)
      .single();

    return new Response(
      JSON.stringify({ progress, job, chunksProcessed: chunks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Job processing failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
