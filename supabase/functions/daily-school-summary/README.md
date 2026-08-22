# Daily School Summary — cron wiring
#
# Default: enabled, 10:00, Africa/Accra (per school_settings).
#
# Deploy:
#   supabase functions deploy daily-school-summary
#   supabase secrets set DAILY_SUMMARY_CRON_SECRET=your-secret
#   (optional) reuse SUBSCRIPTION_CRON_SECRET if DAILY_SUMMARY_CRON_SECRET is unset
#
# Recommended schedule: hourly HTTP call so each school's local hour is matched.
#
# Example (GitHub Actions / external cron / pg_cron net.http_post):
#   curl -X POST "$SUPABASE_URL/functions/v1/daily-school-summary" \
#     -H "x-cron-secret: $DAILY_SUMMARY_CRON_SECRET" \
#     -H "Content-Type: application/json" \
#     -d '{}'
#
# Manual / test from admin UI:
#   POST with Authorization Bearer <admin JWT> and body { "manual": true, "school_id": "<uuid>", "force": true }
#
# Ghana: set school_settings.timezone = 'Africa/Accra' (migration default).
