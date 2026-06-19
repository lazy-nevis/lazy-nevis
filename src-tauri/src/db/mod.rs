pub mod queries;

use crate::error::{AppError, Result};
use rusqlite::Connection;
use std::path::Path;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).map_err(AppError::Database)?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(AppError::Database)?;

        let mut db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory().map_err(AppError::Database)?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")
            .map_err(AppError::Database)?;
        let mut db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&mut self) -> Result<()> {
        self.conn
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at INTEGER NOT NULL
                );",
            )
            .map_err(AppError::Database)?;

        if !migration_applied(&self.conn, 1)? {
            let transaction = self.conn.transaction().map_err(AppError::Database)?;
            transaction
                .execute_batch(include_str!("migrations/0001_initial.sql"))
                .map_err(AppError::Database)?;
            let has_idle_column = has_column(&transaction, "sessions", "total_idle_ms")?;
            if !has_idle_column {
                transaction
                    .execute(
                        "ALTER TABLE sessions ADD COLUMN total_idle_ms INTEGER NOT NULL DEFAULT 0",
                        [],
                    )
                    .map_err(AppError::Database)?;
            }
            mark_migration(&transaction, 1)?;
            transaction.commit().map_err(AppError::Database)?;
        }
        apply_sql_migration(
            &mut self.conn,
            2,
            include_str!("migrations/0002_session_runtime.sql"),
        )?;
        apply_sql_migration(
            &mut self.conn,
            3,
            include_str!("migrations/0003_recent_audio_files.sql"),
        )?;
        Ok(())
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn conn_mut(&mut self) -> &mut Connection {
        &mut self.conn
    }

    #[allow(dead_code)]
    pub fn execute(&self, sql: &str, params: impl rusqlite::Params) -> Result<usize> {
        self.conn.execute(sql, params).map_err(AppError::Database)
    }

    #[allow(dead_code)]
    pub fn last_insert_rowid(&self) -> i64 {
        self.conn.last_insert_rowid()
    }

    #[allow(dead_code)]
    pub fn delete_all_data(&self) -> Result<()> {
        self.conn
            .execute_batch(queries::DELETE_ALL_USER_ACTIVITY)
            .map_err(AppError::Database)?;
        Ok(())
    }
}

fn migration_applied(conn: &Connection, version: i64) -> Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
        [version],
        |row| row.get(0),
    )
    .map_err(AppError::Database)
}

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut statement = conn
        .prepare(&format!("PRAGMA table_info({table})"))
        .map_err(AppError::Database)?;
    let columns = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(columns.iter().any(|candidate| candidate == column))
}

fn mark_migration(conn: &Connection, version: i64) -> Result<()> {
    conn.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, strftime('%s','now') * 1000)",
        [version],
    )
    .map_err(AppError::Database)?;
    Ok(())
}

fn apply_sql_migration(conn: &mut Connection, version: i64, sql: &str) -> Result<()> {
    if migration_applied(conn, version)? {
        return Ok(());
    }
    let transaction = conn.transaction().map_err(AppError::Database)?;
    transaction.execute_batch(sql).map_err(AppError::Database)?;
    mark_migration(&transaction, version)?;
    transaction.commit().map_err(AppError::Database)?;
    Ok(())
}

pub fn session_from_row(row: &rusqlite::Row) -> rusqlite::Result<crate::models::Session> {
    use crate::models::Session;
    Ok(Session {
        id: row.get(0)?,
        label: row.get(1)?,
        started_at: row.get(2)?,
        ended_at: row.get(3)?,
        total_focus_ms: row.get(4)?,
        total_distracted_ms: row.get(5)?,
        total_idle_ms: row.get(6)?,
        total_alerts: row.get(7)?,
        notes: row.get(8)?,
        settings_snapshot: row.get(9)?,
    })
}

pub fn event_from_row(row: &rusqlite::Row) -> rusqlite::Result<crate::models::TimelineEvent> {
    use crate::models::TimelineEvent;
    Ok(TimelineEvent {
        id: row.get(0)?,
        session_id: row.get(1)?,
        started_at: row.get(2)?,
        ended_at: row.get(3)?,
        duration_ms: row.get(4)?,
        event_type: row.get(5)?,
        app_name: row.get(6)?,
        app_exe: row.get(7)?,
        window_title: row.get(8)?,
        is_browser: {
            let v: i64 = row.get(9)?;
            v != 0
        },
        is_distraction: {
            let v: i64 = row.get(10)?;
            v != 0
        },
        alert_type: row.get(11)?,
    })
}

pub fn checkpoint_from_row(row: &rusqlite::Row) -> rusqlite::Result<crate::models::Checkpoint> {
    use crate::models::Checkpoint;
    Ok(Checkpoint {
        id: row.get(0)?,
        session_id: row.get(1)?,
        created_at: row.get(2)?,
        label: row.get(3)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_existing_database_with_idle_and_runtime_state() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("legacy.db");
        let legacy = Connection::open(&path).unwrap();
        legacy
            .execute_batch(include_str!("migrations/0001_initial.sql"))
            .unwrap();
        drop(legacy);

        let db = Database::open(&path).unwrap();
        let idle_column_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name = 'total_idle_ms'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let runtime_table_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'session_runtime'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let recent_audio_table_count: i64 = db
            .conn()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'recent_audio_files'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let migration_count: i64 = db
            .conn()
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(idle_column_count, 1);
        assert_eq!(runtime_table_count, 1);
        assert_eq!(recent_audio_table_count, 1);
        assert_eq!(migration_count, 3);

        drop(db);
        Database::open(&path).unwrap();
    }
}
