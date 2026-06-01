# Platform SaaS Control Center

Multi-tenant subscription, licensing, and feature access for School Hub.

## Setup

1. Run in Supabase SQL Editor: `public/sql/apply-platform-saas-control.sql`
2. Reload API schema (`NOTIFY pgrst` is included in the script)
3. Sign in as **super_admin** and open **Platform Control** (`/platform`)

## Architecture

| Layer | Purpose |
|-------|---------|
| `subscription_plans` | Product catalog (Basic, Standard, Premium, Enterprise) |
| `school_subscriptions` | Per-school plan, status, expiry, storage limits |
| `platform_modules` | SaaS module catalog (maps to portal RBAC keys where applicable) |
| `school_module_entitlements` | Per-school feature matrix (enabled + CRUD flags) |
| `platform_tenant_overview_v` | Monitoring view for dashboard & tenant list |

## Enforcement

- **Legacy schools** (no `school_subscriptions` row): full module access (backward compatible).
- **Licensed schools**: navigation and routes filtered via `useSchoolEntitlements` + `usePortalAccess`.
- **Super admin**: bypasses all module restrictions.
- **RPCs**: `school_has_platform_module`, `school_subscription_writable`, `apply_subscription_plan_to_school`, `save_school_module_entitlements`.

## Super Admin UI

| Route | Page |
|-------|------|
| `/platform` | Dashboard — org counts, expiring tenants |
| `/platform/tenants` | Tenant management table |
| `/platform/tenants/:schoolId` | Feature matrix + plan assignment |
| `/platform/plans` | Subscription plan catalog |

## Next phases (not yet implemented)

- Automated expiry emails (30/14/7/3/1 day)
- Usage event ingestion & charts
- Storage metering from uploads
- Edge function `403` checks on every API
- PDF/Excel export for platform reports
