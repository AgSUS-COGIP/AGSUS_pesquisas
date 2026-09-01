begin;

revoke all on function public.validate_survey_version_integrity(uuid)
from public, anon, authenticated, service_role;

commit;
