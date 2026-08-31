begin;

drop policy if exists survey_assets_manage_select on storage.objects;

create policy survey_assets_manage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'survey-assets'
  and public.can_manage_surveys()
);

commit;
