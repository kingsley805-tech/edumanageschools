# RBAC System — School Hub

## Overview

Two-layer access model:

| Layer | Table | Purpose |
|-------|--------|---------|
| **Portal role** | `user_roles` (`app_role` enum) | Login routing: `/admin`, `/accountant`, `/teacher`, etc. |
| **RBAC** | `roles`, `permissions`, `role_permissions`, `user_role_assignments` | Granular module/action permissions per school |

## Default roles (seeded)

- `super_admin` — all permissions (platform)
- `school_admin` — full school management
- `accountant` — billing, invoices, payments (no delete invoice / admin users)
- `auditor` — read-only financial + audit logs
- `teacher` / `parent` — portal defaults

## Frontend usage

```tsx
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissions";

const { hasPermission } = usePermissions();
if (hasPermission(PERMISSIONS.invoices.generateBulk)) { /* ... */ }

<PermissionGate permission={PERMISSIONS.admin.manageRoles} showDenied>
  <RoleManagement />
</PermissionGate>
```

```tsx
<ProtectedRoute
  allowedRoles={["admin", "accountant"]}
  requiredPermission={PERMISSIONS.payments.allocate}
>
  <AllocatePayments />
</ProtectedRoute>
```

## Database functions

- `has_permission(user_id, code, school_id)`
- `get_user_permissions(user_id, school_id)`
- `user_can_access_school(user_id, school_id)`
- `write_audit_log(...)`

## Admin UI

- `/admin/roles` — Roles & Permissions management
- `/admin/audit-logs` — Immutable audit trail
- `/admin/approvals` — Sensitive action approvals
- `/accountant` — Finance dashboard
- `/auditor` — Read-only compliance dashboard

## Apply migration

```bash
supabase db push
# or
supabase migration up
```

## Assign accountant to a user

1. Open **Roles & Permissions** → **User Assignments**
2. Select staff user → role **Accountant / Bursar**
3. System sets portal `user_roles.role = accountant` and RBAC assignment
