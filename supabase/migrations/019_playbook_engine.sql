-- Phase 7: Due Diligence Playbook Engine provenance on snapshots.
-- Playbook selection reuses company_assessment_goals.goal (1:1 with playbook id).
-- Definitions live in code; this column freezes the engine version at publish.

alter table public.analysis_snapshots
  add column if not exists playbook_version text;

comment on column public.analysis_snapshots.playbook_version is
  'Playbook engine version frozen at publish (e.g. playbook-engine-v1). Playbook id mirrors assessment_goal.';
