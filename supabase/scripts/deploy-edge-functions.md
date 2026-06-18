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

## Option B — Supabase Dashboard (no CLI)

Works with **Lovable-linked Supabase** when you cannot run `supabase login`.

1. Open your project: [Supabase Dashboard → Edge Functions](https://supabase.com/dashboard/project/xbhhpjtwawfawifhpxbe/functions)
2. **Create or open** function `platform-subscription-init`
3. Paste the entire contents of **`supabase/functions/platform-subscription-init/index.ts`** (single file, no imports from other folders)
4. Click **Deploy**
5. Open function **`paystack`**, redeploy from repo after a git push, or paste an updated `paystack/index.ts` if you maintain it manually
6. **Edge Functions → Secrets**: ensure `PLATFORM_PAYSTACK_SECRET_KEY` is set (and `PAYSTACK_SECRET_KEY` if you use that instead)

## Option C — Lovable + Git push

If your app is built on Lovable and connected to GitHub:

1. **Commit and push** this repo (includes `supabase/functions/platform-subscription-init/` and updated `paystack/`)
2. In Lovable, sync/deploy backend (or wait for automatic Supabase function deploy if enabled)
3. Confirm in Supabase Dashboard → Edge Functions that **`platform-subscription-init`** shows **Active** with a recent deploy time
4. Run SQL migrations in **Supabase → SQL Editor** (no CLI): see `public/sql/SUBSCRIPTION-MIGRATIONS-ORDER.txt`

The frontend calls `platform-subscription-init` first; if that function is missing, it falls back to `paystack` with action `platform-subscription-init` (requires redeployed `paystack` too).

## Option D — Supabase Dashboard (legacy paystack-only)

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

- `PAYSTACK_SECRET_KEY` — your Paystack secret key (school fee payments)  
- `PAYMENT_SECRETS_ENCRYPTION_KEY` — same key used when saving gateway settings in the app (base64 32-byte)

Or via CLI:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxx
```

## Platform organization subscriptions (`/admin/subscription`)

Deploy **both** functions (or at minimum `platform-subscription-init`):

```bash
supabase functions deploy platform-subscription-init --project-ref xbhhpjtwawfawifhpxbe
supabase functions deploy paystack --project-ref xbhhpjtwawfawifhpxbe
```

`platform-subscription-init` charges **package + SMS** on Paystack when SMS is enabled at checkout.

Set secrets:

- `PLATFORM_PAYSTACK_SECRET_KEY` — Paystack secret used for **organization** plan checkout (can be the same as `PAYSTACK_SECRET_KEY` for testing)
- `PLATFORM_PAYSTACK_WEBHOOK_SECRET` — optional; defaults to platform secret

Requires SQL step 2 (`apply-organization-subscription-billing.sql`) and step 6 (`apply-sms-subscription-billing.sql`) for checkout columns.

```bash
supabase secrets set PLATFORM_PAYSTACK_SECRET_KEY=sk_test_xxx --project-ref xbhhpjtwawfawifhpxbe
```

### Dashboard deploy (if CLI returns 403)

1. Create function **`platform-subscription-init`** from `supabase/functions/platform-subscription-init/index.ts`
2. Include shared file `supabase/functions/_shared/platformSubscriptionInit.ts` in the deploy bundle (CLI does this automatically)
3. Redeploy **`paystack`** as well

## Verify

Dashboard → **Edge Functions** — each function should show **Active** with a recent deploy time.

Test **Pay now** on student/parent billing after deploy.
