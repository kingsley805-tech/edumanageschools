# Deploy Edge Functions (Supabase)

The app calls Edge Functions for Paystack payments, user provisioning, etc.  
If you see **"The paystack Edge Function is not reachable"**, the function is not deployed on your project yet.

## Required for Payment gateways page

| Secret | Purpose |
|--------|---------|
| `PAYMENT_SECRETS_ENCRYPTION_KEY` | Encrypt/decrypt school Paystack secret keys (base64-encoded 32 random bytes) |
| `SUPABASE_URL` | Usually auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Usually auto-injected by Supabase |

Generate encryption key (run once, save the output):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Option A — Supabase CLI (recommended)

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli) and log in:
   ```bash
   supabase login
   ```

2. Link your project:
   ```bash
   cd school-hub
   supabase link --project-ref xbhhpjtwawfawifhpxbe
   ```

3. Deploy Paystack (required for gateway settings + online fees):
   ```bash
   supabase functions deploy paystack
   ```

4. Set secrets:
   ```bash
   supabase secrets set PAYMENT_SECRETS_ENCRYPTION_KEY=PASTE_YOUR_BASE64_KEY_HERE
   ```

5. Deploy other functions (optional):
   ```bash
   npm run functions:deploy
   ```

If deploy returns **403**, your Supabase account may not have deploy access on this project. Use **Option B** or ask the project owner to deploy.

## Option B — Supabase Dashboard

1. Open [Edge Functions](https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/functions) for the project.
2. Deploy or redeploy function **`paystack`** from this repo: `supabase/functions/paystack/index.ts`.
3. Open **Secrets** for the project and add `PAYMENT_SECRETS_ENCRYPTION_KEY` (same value you will use when saving keys in the app).
4. Confirm the function status is **Active**.

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
