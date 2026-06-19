# Database Architecture

SQLite is local and bundled through `rusqlite`. Numbered migrations in `src-tauri/src/db/migrations/` create durable schema; new SQL constants belong in `src-tauri/src/db/queries.rs`. Sessions, timeline events, checkpoints, settings, and crash-recovery runtime snapshots are persisted. Recent audio history is local metadata.

Migrations are forward-only, ordered in `schema_migrations`, transactional, and tested against fresh and upgraded databases. Foreign keys cascade session deletion to timeline events, checkpoints, and runtime state. Exports are user-created copies, not database backups. Schema changes require an OpenSpec proposal with migration and privacy consequences.

## Location And Backup

The database is `lazynevis.db` in Tauri's operating-system application-data directory for `br.dev.sims.lazynevis`. Quit LazyNevis before backup, then copy the database together with any adjacent `lazynevis.db-wal` and `lazynevis.db-shm` files. Restore only while the app is stopped and keep the original copy until the restored database opens successfully. On Unix, LazyNevis sets the data directory to mode `0700` and the database to `0600`.
