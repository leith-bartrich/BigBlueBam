-- 0116_rls_foundation.sql
-- Why: Row-level security foundation. Defines policies on 11 core tables gated by current_setting('app.current_org_id'). Inactive by default; the api plugin sets the setting in a preHandler on every request. Defense-in-depth against code-level org-scoping bugs.
-- Client impact: additive only. Policies are created but initially the app role has BYPASSRLS, so behavior is unchanged. When BBB_RLS_ENFORCE=1 is set and the rls-boot hook alters the role to NOBYPASSRLS, policies become enforcing.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['organizations', 'projects', 'tasks', 'sprints', 'phases',
                         'activity_log', 'organization_memberships', 'api_keys',
                         'sessions', 'custom_field_definitions',
                         'attachments'])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    END IF;
  END LOOP;
END $$;

-- Direct org_id tables

DROP POLICY IF EXISTS organizations_org_isolation ON organizations;
CREATE POLICY organizations_org_isolation ON organizations
  FOR ALL USING (id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS projects_org_isolation ON projects;
CREATE POLICY projects_org_isolation ON projects
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS organization_memberships_org_isolation ON organization_memberships;
CREATE POLICY organization_memberships_org_isolation ON organization_memberships
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

DROP POLICY IF EXISTS api_keys_org_isolation ON api_keys;
CREATE POLICY api_keys_org_isolation ON api_keys
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Project-scoped tables (no direct org_id column; join through projects)

DROP POLICY IF EXISTS tasks_org_isolation ON tasks;
CREATE POLICY tasks_org_isolation ON tasks
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

DROP POLICY IF EXISTS sprints_org_isolation ON sprints;
CREATE POLICY sprints_org_isolation ON sprints
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

DROP POLICY IF EXISTS activity_log_org_isolation ON activity_log;
CREATE POLICY activity_log_org_isolation ON activity_log
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

DROP POLICY IF EXISTS phases_org_isolation ON phases;
CREATE POLICY phases_org_isolation ON phases
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

DROP POLICY IF EXISTS custom_field_definitions_org_isolation ON custom_field_definitions;
CREATE POLICY custom_field_definitions_org_isolation ON custom_field_definitions
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- Task-scoped (custom_field_values lives as JSONB on tasks itself in this
-- codebase, so no separate policy is needed; attachments is a real table
-- that references tasks.id):

DROP POLICY IF EXISTS attachments_org_isolation ON attachments;
CREATE POLICY attachments_org_isolation ON attachments
  FOR ALL USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE p.org_id = current_setting('app.current_org_id', true)::uuid
    )
  );

-- User-scoped: sessions joins through organization_memberships

DROP POLICY IF EXISTS sessions_org_isolation ON sessions;
CREATE POLICY sessions_org_isolation ON sessions
  FOR ALL USING (
    user_id IN (
      SELECT user_id FROM organization_memberships
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
    )
  );
