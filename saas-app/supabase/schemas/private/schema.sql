create schema private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
comment on schema private is 'Internal authorization helpers. Not exposed through the Data API.';
