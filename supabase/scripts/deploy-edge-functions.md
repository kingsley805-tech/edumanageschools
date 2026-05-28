# Deploy Edge Functions (Supabase)

The app calls Edge Functions for Paystack payments, user provisioning, etc.  
If you see **"Failed to send a request to the Edge Function"**, the function is not deployed (or not reachable) on your project.

## One-time setup

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and log in:
   ```bash
   supabase login
   ```

2. Link your project (replace with your project ref):
   ```bash
   cd school-hub
   supabase link --project-ref xbhhpjtwawfawifhpxbe
   ```

3. Deploy all functions:
   ```bash
   supabase functions deploy paystack
   supabase functions deploy create-user-account
   supabase functions deploy delete-user-account
   supabase functions deploy create-payment-intent
   supabase functions deploy send-contact-email
   supabase functions deploy stripe-webhook
   supabase functions deploy billing-process-job
   ```

## Database (payment gateway tables)

Run once in SQL Editor (after `billing_invoices` exists):

- `supabase/scripts/apply-payment-gateway.sql`

Then **Settings → API → Reload schema**.

## Paystack secrets (required for online fees)

In **Dashboard → Edge Functions → paystack → Secrets**, set:

- `PAYSTACK_SECRET_KEY` — your Paystack secret key  
- `PAYMENT_SECRETS_ENCRYPTION_KEY` — same key used when saving gateway settings in the app (base64 32-byte)

Or via CLI:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
```

## Verify

Dashboard → **Edge Functions** — each function should show **Active** with a recent deploy time.

Test **Pay now** on student/parent billing after deploy.
