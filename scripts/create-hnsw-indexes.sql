CREATE INDEX IF NOT EXISTS idx_usermemory_embedding_cos
  ON "UserMemory"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_memorychunk_embedding_cos
  ON "MemoryChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_auditlog_createdat_brin
  ON "AuditLogEntry"
  USING brin ("createdAt");

CREATE INDEX IF NOT EXISTS idx_pendingtask_dueat_brin
  ON "PendingTask"
  USING brin ("dueAt");