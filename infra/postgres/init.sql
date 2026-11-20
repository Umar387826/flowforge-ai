-- Initialize FlowForge PostgreSQL Extensions and Least-Privilege Roles
-- flowforge_owner owns the database and executes migrations/DDL.
-- flowforge_app is a non-superuser, NOBYPASSRLS runtime role used by Django & Celery.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'flowforge_app') THEN
        CREATE ROLE flowforge_app WITH LOGIN PASSWORD 'flowforge_app_dev_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    END IF;
END
$$;

GRANT CONNECT ON DATABASE flowforge TO flowforge_app;
GRANT USAGE ON SCHEMA public TO flowforge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO flowforge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO flowforge_app;
