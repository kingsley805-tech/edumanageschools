-- Run this in Supabase SQL Editor if report save still fails with RLS errors.
-- Fixes teacher access + adds upsert_term_report_card() RPC.

\ir ../migrations/20260528020000_report_teacher_class_subjects_bridge.sql
\ir ../migrations/20260528030000_fix_term_report_rls_branding.sql
\ir ../migrations/20260528040000_term_report_cards_upsert_rls.sql
