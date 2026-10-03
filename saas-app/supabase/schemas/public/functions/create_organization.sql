-- Data API entry point; privileged implementation stays in the private schema.
create function public.create_organization(p_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_organization(p_name); $$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated, service_role;
