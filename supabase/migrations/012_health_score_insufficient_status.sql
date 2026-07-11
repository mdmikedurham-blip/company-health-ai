-- Allow health_scores.status = 'insufficient' when evidence does not support a score.

alter table public.health_scores
  drop constraint if exists health_scores_status_check;

alter table public.health_scores
  add constraint health_scores_status_check
  check (status in ('healthy', 'watch', 'at-risk', 'insufficient'));
