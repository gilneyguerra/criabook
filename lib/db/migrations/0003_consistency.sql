-- Migration 0003 — Motor de Consistência e Continuidade (REGRAS_CONSISTENCIA)
-- Memória resgatável: fatos atômicos com proveniência + estado + issues.
-- Idempotente: seguro rodar mais de uma vez. Rode no SQL Editor do Neon.

-- Enums (DO block para idempotência — CREATE TYPE não aceita IF NOT EXISTS).
DO $$ BEGIN
  CREATE TYPE fact_status AS ENUM ('active', 'retconned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE thread_status AS ENUM ('open', 'resolved', 'abandoned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE consistency_issue_type AS ENUM
    ('hallucination', 'repetition', 'timeline', 'knowledge', 'thread');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE consistency_issue_severity AS ENUM ('hard', 'soft');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE consistency_issue_status AS ENUM ('open', 'resolved', 'ignored');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extensão do Event Ledger (timeline_events já existe na Bíblia).
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS participants jsonb;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS story_time text;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS caused_by uuid;

CREATE TABLE IF NOT EXISTS canon_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  subject text NOT NULL,
  attribute text NOT NULL,
  value text NOT NULL,
  established_in_chapter integer NOT NULL,
  status fact_status NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS canon_facts_book_subject_idx ON canon_facts (book_id, subject);

CREATE TABLE IF NOT EXISTS character_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  character text NOT NULL,
  fact text NOT NULL,
  learned_in_chapter integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS character_knowledge_book_char_idx ON character_knowledge (book_id, character);

CREATE TABLE IF NOT EXISTS plot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  description text NOT NULL,
  opened_in_chapter integer NOT NULL,
  closed_in_chapter integer,
  status thread_status NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plot_threads_book_status_idx ON plot_threads (book_id, status);

CREATE TABLE IF NOT EXISTS world_state_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  as_of_chapter integer NOT NULL,
  payload jsonb,
  summary text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_state_book_chapter_idx ON world_state_snapshots (book_id, as_of_chapter);

CREATE TABLE IF NOT EXISTS described_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  subject text NOT NULL,
  described_in_chapter integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS described_items_book_subject_idx ON described_items (book_id, subject);

CREATE TABLE IF NOT EXISTS consistency_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  chapter integer,
  type consistency_issue_type NOT NULL,
  severity consistency_issue_severity NOT NULL,
  description text NOT NULL,
  conflicts_with text,
  status consistency_issue_status NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consistency_issues_book_status_idx ON consistency_issues (book_id, status);
