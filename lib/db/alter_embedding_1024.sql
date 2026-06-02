-- Ajusta a dimensão do vetor de keywords de 1536 (OpenAI) para 1024 (Voyage voyage-3.5).
-- Rode UMA VEZ no Neon → SQL Editor (a coluna está toda NULL, então é seguro).
-- Se você acabou de rodar o init.sql atualizado (já com vector(1024)), NÃO precisa disto.

DROP INDEX IF EXISTS keywords_embedding_idx;
ALTER TABLE keywords ALTER COLUMN embedding TYPE vector(1024);
CREATE INDEX IF NOT EXISTS keywords_embedding_idx
  ON keywords USING hnsw (embedding vector_cosine_ops);
