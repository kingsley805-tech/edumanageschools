import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getAuthUser, requirePermission, unauthorizedResponse } from "../_shared/rbac.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const user = await getAuthUser(req, supabase);
    if (!user) {
      return unauthorizedResponse(corsHeaders, "Unauthorized");
    }

    const { invoiceId, amount } = await req.json();

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    const permCheck = await requirePermission(
      supabase,
      user.id,
      "payments.process",
      profile?.school_id
    );
    const isParent = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "parent")
      .maybeSingle();

    if (!permCheck.ok && !isParent.data) {
      return unauthorizedResponse(corsHeaders);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      metadata: { invoiceId, userId: user.id },
    });

    await supabase.from("payments").insert({
      invoice_id: invoiceId,
      payer_user_id: user.id,
      amount: amount,
      provider_reference: paymentIntent.id,
      payment_provider: "stripe",
      status: "pending",
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
