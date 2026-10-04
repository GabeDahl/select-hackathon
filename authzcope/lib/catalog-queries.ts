// Static catalog SQL only; never interpolate user input or execute app routines.
// Definitions are deparsed with a controlled search_path, not original repo SQL.
const nonSystem = (alias: string) => `${alias}.nspname !~ '^pg_' AND ${alias}.nspname <> 'information_schema'`;
const extension = (catalog: string, oid: string) => `(SELECT e.extname FROM pg_catalog.pg_depend d
  JOIN pg_catalog.pg_extension e ON e.oid = d.refobjid
  WHERE d.classid = 'pg_catalog.${catalog}'::regclass AND d.objid = ${oid}
    AND d.refclassid = 'pg_catalog.pg_extension'::regclass AND d.deptype = 'e' LIMIT 1)`;
const grants = (acl: string) => `COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'grantor', pg_catalog.pg_get_userbyid(x.grantor),
  'grantee', CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(x.grantee) END,
  'privilege', x.privilege_type, 'grantable', x.is_grantable) ORDER BY x.grantee, x.privilege_type)
  FROM pg_catalog.aclexplode(${acl}) x), '[]'::jsonb)`;

function object(catalog: string, oid: string, kind: string, schema: string,
  name: string, identity: string, details: string, definition = "NULL::text") {
  return `'pg_catalog.${catalog}'::regclass::oid::bigint AS class_id,
    ${oid}::bigint AS object_id, 0 AS sub_id, '${kind}' AS kind,
    ${schema} AS schema, ${name} AS name, ${identity} AS identity,
    pg_catalog.obj_description(${oid}, '${catalog}') AS comment,
    ${definition} AS definition, ${extension(catalog, oid)} AS extension,
    ${details} AS details`;
}

export const catalogQueries = [
  {
    name: "schemas",
    sql: `SELECT ${object("pg_namespace", "n.oid", "schema", "n.nspname", "n.nspname",
      "format('%I', n.nspname)", `jsonb_build_object('owner', pg_get_userbyid(n.nspowner),
      'rawAcl', n.nspacl, 'grants', ${grants("COALESCE(n.nspacl, acldefault('n', n.nspowner))")})`)}
      FROM pg_catalog.pg_namespace n ORDER BY n.nspname LIMIT 10001`,
  },
  {
    name: "relations",
    sql: `SELECT ${object("pg_class", "c.oid", "relation", "n.nspname", "c.relname",
      "format('%I.%I', n.nspname, c.relname)", `jsonb_build_object(
      'relationKind', c.relkind, 'owner', pg_get_userbyid(c.relowner),
      'rlsEnabled', c.relrowsecurity, 'rlsForced', c.relforcerowsecurity,
      'options', c.reloptions, 'rawAcl', c.relacl,
      'grants', ${grants("COALESCE(c.relacl, acldefault((CASE WHEN c.relkind = 'S' THEN 'S' ELSE 'r' END)::\"char\", c.relowner))")},
      'partitionKey', CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) END,
      'partitionBound', pg_get_expr(c.relpartbound, c.oid),
      'parents', COALESCE((SELECT jsonb_agg(format('%I.%I', pn.nspname, pc.relname) ORDER BY i.inhseqno)
        FROM pg_catalog.pg_inherits i JOIN pg_catalog.pg_class pc ON pc.oid = i.inhparent
        JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace WHERE i.inhrelid = c.oid), '[]'::jsonb),
      'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname, 'position', a.attnum, 'type', format_type(a.atttypid, a.atttypmod),
        'nullable', NOT a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
        'defaultExpression', pg_get_expr(ad.adbin, ad.adrelid),
        'comment', col_description(c.oid, a.attnum), 'rawAcl', a.attacl,
        'grants', ${grants("a.attacl")}) ORDER BY a.attnum)
        FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef ad
          ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped), '[]'::jsonb))`,
      "CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, false) END")}
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE ${nonSystem("n")} AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
      ORDER BY n.nspname, c.relname LIMIT 10001`,
  },
  {
    name: "routines",
    sql: `SELECT ${object("pg_proc", "p.oid", "routine", "n.nspname", "p.proname",
      "format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))",
      `jsonb_build_object('routineKind', p.prokind, 'owner', pg_get_userbyid(p.proowner),
      'language', l.lanname, 'securityDefiner', p.prosecdef, 'settings', p.proconfig,
      'volatility', p.provolatile, 'strict', p.proisstrict, 'leakproof', p.proleakproof,
      'arguments', pg_get_function_arguments(p.oid), 'result', pg_get_function_result(p.oid),
      'rawAcl', p.proacl, 'grants', ${grants("COALESCE(p.proacl, acldefault('f', p.proowner))")})`,
      "CASE WHEN p.prokind IN ('f', 'p') THEN pg_get_functiondef(p.oid) END")}
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_catalog.pg_language l ON l.oid = p.prolang WHERE ${nonSystem("n")}
      ORDER BY n.nspname, p.proname, p.oid LIMIT 10001`,
  },
  {
    name: "policies",
    sql: `SELECT ${object("pg_policy", "p.oid", "policy", "n.nspname", "p.polname",
      "format('%I.%I POLICY %I', n.nspname, c.relname, p.polname)",
      `jsonb_build_object('relation', format('%I.%I', n.nspname, c.relname),
      'command', CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE' ELSE 'ALL' END, 'permissive', p.polpermissive,
      'roles', (SELECT jsonb_agg(CASE WHEN r = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r)
        FROM unnest(p.polroles) r),
      'using', pg_get_expr(p.polqual, p.polrelid), 'withCheck', pg_get_expr(p.polwithcheck, p.polrelid))`,
      `format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;', p.polname, n.nspname, c.relname,
        CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
        CASE p.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
        (SELECT string_agg(CASE WHEN r = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(r)) END, ', ' ORDER BY r) FROM unnest(p.polroles) r),
        CASE WHEN p.polqual IS NOT NULL THEN ' USING (' || pg_get_expr(p.polqual, p.polrelid) || ')' ELSE '' END,
        CASE WHEN p.polwithcheck IS NOT NULL THEN ' WITH CHECK (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')' ELSE '' END)`)}
      FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid = p.polrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE ${nonSystem("n")}
      ORDER BY n.nspname, c.relname, p.polname LIMIT 10001`,
  },
  {
    name: "constraints",
    sql: `SELECT ${object("pg_constraint", "k.oid", "constraint", "n.nspname", "k.conname",
      "format('%I.%I CONSTRAINT %I', n.nspname, COALESCE(c.relname, t.typname), k.conname)",
      `jsonb_build_object('relation', CASE WHEN c.oid IS NOT NULL THEN format('%I.%I', n.nspname, c.relname) END,
      'domain', CASE WHEN t.oid IS NOT NULL THEN format('%I.%I', n.nspname, t.typname) END,
      'constraintKind', k.contype, 'validated', k.convalidated, 'deferrable', k.condeferrable,
      'initiallyDeferred', k.condeferred,
      'columns', (SELECT jsonb_agg(a.attname ORDER BY u.position) FROM unnest(k.conkey) WITH ORDINALITY u(num, position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.num),
      'referencedRelation', CASE WHEN rc.oid IS NOT NULL THEN format('%I.%I', rn.nspname, rc.relname) END,
      'referencedColumns', (SELECT jsonb_agg(a.attname ORDER BY u.position) FROM unnest(k.confkey) WITH ORDINALITY u(num, position)
        JOIN pg_catalog.pg_attribute a ON a.attrelid = k.confrelid AND a.attnum = u.num))`, "pg_get_constraintdef(k.oid, false)")}
      FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_namespace n ON n.oid = k.connamespace
      LEFT JOIN pg_catalog.pg_class c ON c.oid = k.conrelid LEFT JOIN pg_catalog.pg_type t ON t.oid = k.contypid
      LEFT JOIN pg_catalog.pg_class rc ON rc.oid = k.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid = rc.relnamespace
      WHERE ${nonSystem("n")} ORDER BY n.nspname, k.conname, k.oid LIMIT 10001`,
  },
  {
    name: "indexes",
    sql: `SELECT ${object("pg_class", "c.oid", "index", "n.nspname", "c.relname",
      "format('%I.%I', n.nspname, c.relname)",
      `jsonb_build_object('relation', format('%I.%I', n.nspname, t.relname),
      'unique', i.indisunique, 'primary', i.indisprimary, 'valid', i.indisvalid,
      'predicate', pg_get_expr(i.indpred, i.indrelid), 'expressions', pg_get_expr(i.indexprs, i.indrelid))`, "pg_get_indexdef(c.oid)")}
      FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
      JOIN pg_catalog.pg_class t ON t.oid = i.indrelid JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE ${nonSystem("n")} ORDER BY n.nspname, c.relname LIMIT 10001`,
  },
  {
    name: "triggers",
    sql: `SELECT ${object("pg_trigger", "t.oid", "trigger", "n.nspname", "t.tgname",
      "format('%I.%I TRIGGER %I', n.nspname, c.relname, t.tgname)",
      `jsonb_build_object('relation', format('%I.%I', n.nspname, c.relname),
      'enabled', t.tgenabled, 'internal', t.tgisinternal,
      'function', format('%I.%I(%s)', pn.nspname, p.proname, pg_get_function_identity_arguments(p.oid)))`, "pg_get_triggerdef(t.oid, false)")}
      FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
      JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace WHERE ${nonSystem("n")}
      ORDER BY n.nspname, c.relname, t.tgname LIMIT 10001`,
  },
  {
    name: "rules",
    sql: `SELECT ${object("pg_rewrite", "r.oid", "rule", "n.nspname", "r.rulename",
      "format('%I.%I RULE %I', n.nspname, c.relname, r.rulename)",
      "jsonb_build_object('relation', format('%I.%I', n.nspname, c.relname), 'enabled', r.ev_enabled)", "pg_get_ruledef(r.oid, false)")}
      FROM pg_catalog.pg_rewrite r JOIN pg_catalog.pg_class c ON c.oid = r.ev_class
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace WHERE ${nonSystem("n")}
      ORDER BY n.nspname, c.relname, r.rulename LIMIT 10001`,
  },
  {
    name: "types",
    sql: `SELECT ${object("pg_type", "t.oid", "type", "n.nspname", "t.typname",
      "format('%I.%I', n.nspname, t.typname)",
      `jsonb_build_object('typeKind', t.typtype, 'owner', pg_get_userbyid(t.typowner),
      'baseType', CASE WHEN t.typbasetype <> 0 THEN format_type(t.typbasetype, t.typtypmod) END,
      'nullable', NOT t.typnotnull, 'defaultExpression', t.typdefault,
      'enumValues', COALESCE((SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder)
        FROM pg_catalog.pg_enum e WHERE e.enumtypid = t.oid), '[]'::jsonb),
      'rawAcl', t.typacl, 'grants', ${grants("COALESCE(t.typacl, acldefault('T', t.typowner))")})`)}
      FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      LEFT JOIN pg_catalog.pg_class c ON c.oid = t.typrelid WHERE ${nonSystem("n")}
      AND t.typisdefined AND t.typelem = 0 AND (t.typrelid = 0 OR c.relkind = 'c')
      ORDER BY n.nspname, t.typname LIMIT 10001`,
  },
  {
    name: "roles",
    sql: `SELECT ${object("pg_authid", "r.oid", "role", "NULL::text", "r.rolname", "quote_ident(r.rolname)",
      `jsonb_build_object('superuser', r.rolsuper, 'inherits', r.rolinherit, 'bypassRls', r.rolbypassrls,
      'canLogin', r.rolcanlogin, 'canCreateRole', r.rolcreaterole, 'canCreateDatabase', r.rolcreatedb)`)}
      FROM pg_catalog.pg_roles r ORDER BY r.rolname LIMIT 10001`,
  },
  {
    name: "role memberships",
    sql: `SELECT 'pg_catalog.pg_auth_members'::regclass::oid::bigint AS class_id,
      COALESCE((to_jsonb(m)->>'oid')::bigint, 0) AS object_id, 0 AS sub_id,
      'role_membership' AS kind, NULL::text AS schema, pg_get_userbyid(m.member) AS name,
      format('%I MEMBER OF %I GRANTED BY %I', pg_get_userbyid(m.member), pg_get_userbyid(m.roleid), pg_get_userbyid(m.grantor)) AS identity,
      NULL::text AS comment, NULL::text AS definition, NULL::text AS extension,
      jsonb_build_object('role', pg_get_userbyid(m.roleid), 'member', pg_get_userbyid(m.member),
      'grantor', pg_get_userbyid(m.grantor), 'adminOption', m.admin_option,
      'inheritOption', to_jsonb(m)->'inherit_option', 'setOption', to_jsonb(m)->'set_option') AS details
      FROM pg_catalog.pg_auth_members m ORDER BY m.roleid, m.member, m.grantor LIMIT 10001`,
  },
  {
    name: "default privileges",
    sql: `SELECT ${object("pg_default_acl", "a.oid", "default_privileges", "n.nspname",
      "pg_get_userbyid(a.defaclrole)",
      "format('%I %s DEFAULT PRIVILEGES IN %s', pg_get_userbyid(a.defaclrole), a.defaclobjtype, COALESCE(quote_ident(n.nspname), 'ALL SCHEMAS'))",
      `jsonb_build_object('owner', pg_get_userbyid(a.defaclrole), 'objectType', a.defaclobjtype,
      'rawAcl', a.defaclacl, 'grants', ${grants("a.defaclacl")})`)}
      FROM pg_catalog.pg_default_acl a LEFT JOIN pg_catalog.pg_namespace n ON n.oid = a.defaclnamespace
      ORDER BY a.defaclrole, a.defaclnamespace, a.defaclobjtype LIMIT 10001`,
  },
  {
    name: "extensions",
    sql: `SELECT ${object("pg_extension", "e.oid", "extension", "n.nspname", "e.extname", "quote_ident(e.extname)",
      "jsonb_build_object('version', e.extversion, 'owner', pg_get_userbyid(e.extowner))")}
      FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
      ORDER BY e.extname LIMIT 10001`,
  },
  {
    name: "operators",
    sql: `SELECT ${object("pg_operator", "o.oid", "operator", "n.nspname", "o.oprname",
      "format('%I.%s(%s,%s)', n.nspname, o.oprname, format_type(o.oprleft, NULL), format_type(o.oprright, NULL))",
      "jsonb_build_object('function', o.oprcode::regprocedure::text, 'resultType', format_type(o.oprresult, NULL))")}
      FROM pg_catalog.pg_operator o JOIN pg_catalog.pg_namespace n ON n.oid = o.oprnamespace
      WHERE ${nonSystem("n")} ORDER BY n.nspname, o.oprname, o.oid LIMIT 10001`,
  },
  {
    name: "casts",
    sql: `SELECT ${object("pg_cast", "c.oid", "cast", "NULL::text",
      "format('%s AS %s', format_type(c.castsource, NULL), format_type(c.casttarget, NULL))",
      "format('CAST (%s AS %s)', format_type(c.castsource, NULL), format_type(c.casttarget, NULL))",
      "jsonb_build_object('function', c.castfunc::regprocedure::text, 'context', c.castcontext, 'method', c.castmethod)")}
      FROM pg_catalog.pg_cast c JOIN pg_catalog.pg_type s ON s.oid = c.castsource
      JOIN pg_catalog.pg_type t ON t.oid = c.casttarget
      JOIN pg_catalog.pg_namespace sn ON sn.oid = s.typnamespace JOIN pg_catalog.pg_namespace tn ON tn.oid = t.typnamespace
      LEFT JOIN pg_catalog.pg_proc p ON p.oid = c.castfunc LEFT JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace
      WHERE (${nonSystem("sn")}) OR (${nonSystem("tn")}) OR (${nonSystem("pn")})
      ORDER BY c.castsource, c.casttarget LIMIT 10001`,
  },
] as const;

export const dependencyQuery = `WITH captured AS (
  SELECT class_id::oid, object_id::oid FROM jsonb_to_recordset($1::jsonb) AS x(class_id bigint, object_id bigint)
), edges AS (
  SELECT d.classid AS from_class, d.objid AS from_object, d.objsubid AS from_sub,
    d.refclassid AS to_class, d.refobjid AS to_object, d.refobjsubid AS to_sub,
    d.deptype AS dependency_type, 'pg_depend' AS source
  FROM pg_catalog.pg_depend d WHERE
    EXISTS (SELECT 1 FROM captured c WHERE c.class_id = d.classid AND c.object_id = d.objid) OR
    EXISTS (SELECT 1 FROM captured c WHERE c.class_id = d.refclassid AND c.object_id = d.refobjid)
  UNION ALL
  SELECT d.classid, d.objid, d.objsubid, d.refclassid, d.refobjid, 0, d.deptype, 'pg_shdepend'
  FROM pg_catalog.pg_shdepend d WHERE d.dbid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
    AND EXISTS (SELECT 1 FROM captured c WHERE c.class_id = d.classid AND c.object_id = d.objid)
)
SELECT e.*, (pg_identify_object(e.from_class, e.from_object, e.from_sub)).identity AS from_identity,
  (pg_identify_object(e.to_class, e.to_object, e.to_sub)).identity AS to_identity
FROM edges e ORDER BY e.from_class, e.from_object, e.from_sub, e.to_class, e.to_object, e.to_sub, e.source, e.dependency_type
LIMIT 50001`;
