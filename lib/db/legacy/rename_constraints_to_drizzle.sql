-- Renomeia constraints do schema legado para os nomes da baseline do Drizzle.
-- Idempotente: só renomeia se o nome antigo existir no schema public
-- (outros schemas, como neon_auth, têm tabelas homônimas e ficam intactos).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('account', 'account_user_id_fkey', 'account_user_id_user_id_fk'),
    ('book_meta', 'book_meta_book_id_fkey', 'book_meta_book_id_books_id_fk'),
    ('books', 'books_owner_id_fkey', 'books_owner_id_user_id_fk'),
    ('canon_facts', 'canon_facts_book_id_fkey', 'canon_facts_book_id_books_id_fk'),
    ('chapter_images', 'chapter_images_chapter_id_fkey', 'chapter_images_chapter_id_chapters_id_fk'),
    ('chapters', 'chapters_book_id_fkey', 'chapters_book_id_books_id_fk'),
    ('character_knowledge', 'character_knowledge_book_id_fkey', 'character_knowledge_book_id_books_id_fk'),
    ('characters', 'characters_book_id_fkey', 'characters_book_id_books_id_fk'),
    ('consistency_issues', 'consistency_issues_book_id_fkey', 'consistency_issues_book_id_books_id_fk'),
    ('covers', 'covers_book_id_fkey', 'covers_book_id_books_id_fk'),
    ('covers', 'covers_book_id_key', 'covers_book_id_unique'),
    ('credit_ledger', 'credit_ledger_user_id_fkey', 'credit_ledger_user_id_user_id_fk'),
    ('described_items', 'described_items_book_id_fkey', 'described_items_book_id_books_id_fk'),
    ('exports', 'exports_book_id_fkey', 'exports_book_id_books_id_fk'),
    ('generation_jobs', 'generation_jobs_book_id_fkey', 'generation_jobs_book_id_books_id_fk'),
    ('glossary_terms', 'glossary_terms_book_id_fkey', 'glossary_terms_book_id_books_id_fk'),
    ('keywords', 'keywords_created_by_fkey', 'keywords_created_by_user_id_fk'),
    ('locations', 'locations_book_id_fkey', 'locations_book_id_books_id_fk'),
    ('plot_threads', 'plot_threads_book_id_fkey', 'plot_threads_book_id_books_id_fk'),
    ('profiles', 'profiles_id_fkey', 'profiles_id_user_id_fk'),
    ('rag_chunks', 'rag_chunks_book_id_fkey', 'rag_chunks_book_id_books_id_fk'),
    ('session', 'session_user_id_fkey', 'session_user_id_user_id_fk'),
    ('session', 'session_token_key', 'session_token_unique'),
    ('story_beats', 'story_beats_book_id_fkey', 'story_beats_book_id_books_id_fk'),
    ('story_beats', 'story_beats_linked_chapter_id_fkey', 'story_beats_linked_chapter_id_chapters_id_fk'),
    ('timeline_events', 'timeline_events_book_id_fkey', 'timeline_events_book_id_books_id_fk'),
    ('user', 'user_email_key', 'user_email_unique'),
    ('versions', 'versions_book_id_fkey', 'versions_book_id_books_id_fk'),
    ('versions', 'versions_chapter_id_fkey', 'versions_chapter_id_chapters_id_fk'),
    ('versions', 'versions_created_by_fkey', 'versions_created_by_user_id_fk'),
    ('world_rules', 'world_rules_book_id_fkey', 'world_rules_book_id_books_id_fk'),
    ('world_state_snapshots', 'world_state_snapshots_book_id_fkey', 'world_state_snapshots_book_id_books_id_fk')
  ) AS v(tbl, old_name, new_name) LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class k ON k.oid = c.conrelid
               WHERE k.relnamespace = 'public'::regnamespace
                 AND k.relname = r.tbl AND c.conname = r.old_name) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', r.tbl, r.old_name, r.new_name);
    END IF;
  END LOOP;
END $$;
