-- Portal permissions for teacher result entry (/teacher/scores)

INSERT INTO public.permissions (category, module, action, code, description) VALUES
  ('examinations', 'portal.result_scores', 'view', 'portal.result_scores.view', 'View Enter Scores'),
  ('examinations', 'portal.result_scores', 'create', 'portal.result_scores.create', 'Create Enter Scores'),
  ('examinations', 'portal.result_scores', 'edit', 'portal.result_scores.edit', 'Edit Enter Scores'),
  ('examinations', 'portal.result_scores', 'manage', 'portal.result_scores.manage', 'Manage Enter Scores')
ON CONFLICT (code) DO NOTHING;
