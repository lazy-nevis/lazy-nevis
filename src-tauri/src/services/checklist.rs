//! Daily checklist persistence (spec: daily-checklist).
//!
//! Mirrors the `SessionLogger` pattern: holds the shared database handle and locks
//! internally per call. The database is the single source of truth — the completion
//! grace period is purely presentational and derived from `completed_at` by the UI.

use crate::db::{checklist_item_from_row, queries, tag_from_row, Database};
use crate::error::{AppError, Result};
use crate::models::{ChecklistItem, Tag};
use rusqlite::params;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HistorySort {
    Created,
    Due,
    Completed,
}

impl HistorySort {
    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "created" => Ok(Self::Created),
            "due" => Ok(Self::Due),
            "completed" => Ok(Self::Completed),
            other => Err(AppError::InvalidArgument(format!(
                "Invalid history sort '{other}'"
            ))),
        }
    }

    fn query(self) -> &'static str {
        match self {
            Self::Created => queries::SELECT_CHECKLIST_HISTORY_BY_CREATED,
            Self::Due => queries::SELECT_CHECKLIST_HISTORY_BY_DUE,
            Self::Completed => queries::SELECT_CHECKLIST_HISTORY_BY_COMPLETED,
        }
    }
}

/// Normalize a tag name: trim whitespace and a leading '#'.
/// Case is preserved on first use; uniqueness is case-insensitive (NOCASE).
pub fn normalize_tag(name: &str) -> String {
    name.trim().trim_start_matches('#').trim().to_string()
}

pub struct ChecklistService {
    db: Arc<Mutex<Database>>,
}

impl ChecklistService {
    pub fn new(db: Arc<Mutex<Database>>) -> Self {
        Self { db }
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Database>> {
        self.db
            .lock()
            .map_err(|_| AppError::Internal("lock".into()))
    }

    pub fn create(
        &self,
        title: String,
        due_date: Option<i64>,
        tags: Vec<String>,
        now: i64,
    ) -> Result<ChecklistItem> {
        let id = Uuid::new_v4().to_string();
        let mut db = self.lock()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
        let sort_order: i64 = tx
            .query_row(queries::SELECT_MAX_CHECKLIST_SORT_ORDER, [], |row| {
                row.get(0)
            })
            .map_err(AppError::Database)?;
        tx.execute(
            queries::INSERT_CHECKLIST_ITEM,
            params![id, title, now, due_date, sort_order + 1],
        )
        .map_err(AppError::Database)?;
        set_item_tags(&tx, &id, &tags, now)?;
        tx.commit().map_err(AppError::Database)?;
        get_item(&db, &id)
    }

    pub fn update(
        &self,
        id: &str,
        title: String,
        due_date: Option<i64>,
        tags: Vec<String>,
        now: i64,
    ) -> Result<ChecklistItem> {
        let mut db = self.lock()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
        let updated = tx
            .execute(queries::UPDATE_CHECKLIST_ITEM, params![title, due_date, id])
            .map_err(AppError::Database)?;
        if updated == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        tx.execute(queries::DELETE_CHECKLIST_ITEM_TAGS, params![id])
            .map_err(AppError::Database)?;
        set_item_tags(&tx, id, &tags, now)?;
        tx.commit().map_err(AppError::Database)?;
        get_item(&db, id)
    }

    /// Sets or clears `completed_at`. Completion is persisted immediately; the UI
    /// keeps the item visible during the grace window
    /// (spec: daily-checklist/restart-during-grace).
    pub fn set_completed(&self, id: &str, completed_at: Option<i64>) -> Result<ChecklistItem> {
        let db = self.lock()?;
        let updated = db
            .conn()
            .execute(
                queries::UPDATE_CHECKLIST_COMPLETED_AT,
                params![completed_at, id],
            )
            .map_err(AppError::Database)?;
        if updated == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        get_item(&db, id)
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        let db = self.lock()?;
        let deleted = db
            .conn()
            .execute(queries::DELETE_CHECKLIST_ITEM, params![id])
            .map_err(AppError::Database)?;
        if deleted == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        Ok(())
    }

    /// Persists a full ordering of the open block (spec: daily-checklist/reorder-persists).
    pub fn reorder(&self, ids: &[String]) -> Result<()> {
        let mut db = self.lock()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;
        for (index, id) in ids.iter().enumerate() {
            tx.execute(
                queries::UPDATE_CHECKLIST_SORT_ORDER,
                params![index as i64 + 1, id],
            )
            .map_err(AppError::Database)?;
        }
        tx.commit().map_err(AppError::Database)?;
        Ok(())
    }

    /// Open items plus items completed at or after `grace_cutoff_ms`, so every
    /// window renders the same grace countdown.
    pub fn list_open(&self, grace_cutoff_ms: i64) -> Result<Vec<ChecklistItem>> {
        let db = self.lock()?;
        let mut statement = db
            .conn()
            .prepare(queries::SELECT_OPEN_OR_GRACE_CHECKLIST_ITEMS)
            .map_err(AppError::Database)?;
        let items = statement
            .query_map(params![grace_cutoff_ms], checklist_item_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        attach_tags(&db, items)
    }

    /// Completed items filtered by date range (on the active sort column) and,
    /// when `tags` is non-empty, restricted to items carrying at least one of them.
    pub fn list_history(
        &self,
        from: Option<i64>,
        to: Option<i64>,
        sort: HistorySort,
        tags: &[String],
    ) -> Result<Vec<ChecklistItem>> {
        let db = self.lock()?;
        let mut statement = db
            .conn()
            .prepare(sort.query())
            .map_err(AppError::Database)?;
        let items = statement
            .query_map(params![from, to], checklist_item_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        let items = attach_tags(&db, items)?;
        if tags.is_empty() {
            return Ok(items);
        }
        let wanted: Vec<String> = tags
            .iter()
            .map(|tag| normalize_tag(tag).to_lowercase())
            .filter(|tag| !tag.is_empty())
            .collect();
        Ok(items
            .into_iter()
            .filter(|item| {
                item.tags
                    .iter()
                    .any(|tag| wanted.contains(&tag.name.to_lowercase()))
            })
            .collect())
    }

    pub fn list_tags(&self) -> Result<Vec<Tag>> {
        let db = self.lock()?;
        let mut statement = db
            .conn()
            .prepare(queries::SELECT_ALL_TAGS)
            .map_err(AppError::Database)?;
        let tags = statement
            .query_map([], tag_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        Ok(tags)
    }

    pub fn link_session(&self, item_id: &str, session_id: &str, now: i64) -> Result<()> {
        let db = self.lock()?;
        db.conn()
            .execute(
                queries::INSERT_CHECKLIST_ITEM_SESSION,
                params![item_id, session_id, now],
            )
            .map_err(AppError::Database)?;
        Ok(())
    }

    /// Latest still-open item linked to the session; `None` once completed
    /// (spec: daily-checklist/item-already-completed).
    pub fn open_item_for_session(&self, session_id: &str) -> Result<Option<ChecklistItem>> {
        let db = self.lock()?;
        let item = db
            .conn()
            .query_row(
                queries::SELECT_OPEN_ITEM_FOR_SESSION,
                params![session_id],
                checklist_item_from_row,
            )
            .map(Some)
            .or_else(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(AppError::Database(other)),
            })?;
        match item {
            Some(item) => Ok(Some(with_tags(&db, item)?)),
            None => Ok(None),
        }
    }
}

fn set_item_tags(
    tx: &rusqlite::Transaction<'_>,
    item_id: &str,
    tags: &[String],
    now: i64,
) -> Result<()> {
    for raw in tags {
        let name = normalize_tag(raw);
        if name.is_empty() {
            continue;
        }
        // Upsert by NOCASE-unique name: first writer fixes the stored casing
        // (spec: daily-checklist/case-insensitive-reuse).
        tx.execute(
            queries::INSERT_TAG,
            params![Uuid::new_v4().to_string(), name, now],
        )
        .map_err(AppError::Database)?;
        let tag_id: String = tx
            .query_row(queries::SELECT_TAG_BY_NAME, params![name], |row| row.get(0))
            .map_err(AppError::Database)?;
        tx.execute(queries::INSERT_CHECKLIST_ITEM_TAG, params![item_id, tag_id])
            .map_err(AppError::Database)?;
    }
    Ok(())
}

fn get_item(db: &Database, id: &str) -> Result<ChecklistItem> {
    let item = db
        .conn()
        .query_row(
            queries::SELECT_CHECKLIST_ITEM_BY_ID,
            params![id],
            checklist_item_from_row,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(id.to_string()),
            other => AppError::Database(other),
        })?;
    with_tags(db, item)
}

fn with_tags(db: &Database, mut item: ChecklistItem) -> Result<ChecklistItem> {
    let mut statement = db
        .conn()
        .prepare(queries::SELECT_TAGS_FOR_CHECKLIST_ITEM)
        .map_err(AppError::Database)?;
    item.tags = statement
        .query_map(params![item.id], tag_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(item)
}

fn attach_tags(db: &Database, items: Vec<ChecklistItem>) -> Result<Vec<ChecklistItem>> {
    items.into_iter().map(|item| with_tags(db, item)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn service() -> ChecklistService {
        ChecklistService::new(Arc::new(Mutex::new(Database::open_in_memory().unwrap())))
    }

    fn create_session(service: &ChecklistService, id: &str) {
        let db = service.db.lock().unwrap();
        db.conn()
            .execute(
                queries::INSERT_SESSION,
                params![id, Option::<String>::None, 1_000_i64, "{}"],
            )
            .unwrap();
    }

    // Spec scenario: daily-checklist/rapid-entry + restart-during-grace
    #[test]
    fn test_checklist_create_complete_uncomplete_round_trip() {
        let service = service();
        let item = service
            .create("Write report".into(), None, vec![], 1_000)
            .unwrap();
        assert_eq!(item.sort_order, 1);
        assert!(item.completed_at.is_none());

        let done = service.set_completed(&item.id, Some(5_000)).unwrap();
        assert_eq!(done.completed_at, Some(5_000));
        // Completed items stay visible while inside the grace window…
        assert_eq!(service.list_open(4_000).unwrap().len(), 1);
        // …and leave the open block once the cutoff passes.
        assert_eq!(service.list_open(6_000).unwrap().len(), 0);

        let reopened = service.set_completed(&item.id, None).unwrap();
        assert!(reopened.completed_at.is_none());
        assert_eq!(service.list_open(0).unwrap().len(), 1);
    }

    // Spec scenario: daily-checklist/case-insensitive-reuse
    #[test]
    fn test_checklist_tags_dedupe_case_insensitively() {
        let service = service();
        let first = service
            .create("A".into(), None, vec!["#Work".into()], 1_000)
            .unwrap();
        let second = service
            .create("B".into(), None, vec!["work".into()], 2_000)
            .unwrap();
        assert_eq!(first.tags.len(), 1);
        assert_eq!(second.tags.len(), 1);
        assert_eq!(first.tags[0].id, second.tags[0].id);
        assert_eq!(first.tags[0].name, "Work"); // first writer fixes casing
        assert_eq!(service.list_tags().unwrap().len(), 1);
    }

    // Spec scenario: daily-checklist/reorder-persists
    #[test]
    fn test_checklist_reorder_persists() {
        let service = service();
        let a = service.create("A".into(), None, vec![], 1_000).unwrap();
        let b = service.create("B".into(), None, vec![], 2_000).unwrap();
        let c = service.create("C".into(), None, vec![], 3_000).unwrap();

        service
            .reorder(&[c.id.clone(), a.id.clone(), b.id.clone()])
            .unwrap();
        let open = service.list_open(0).unwrap();
        let titles: Vec<&str> = open.iter().map(|item| item.title.as_str()).collect();
        assert_eq!(titles, ["C", "A", "B"]);
    }

    // Spec scenarios: daily-checklist/date-stepping + combined-filters + sort-persistence
    #[test]
    fn test_checklist_history_filter_matrix() {
        let service = service();
        let early = service
            .create("Early".into(), Some(1_500), vec!["work".into()], 1_000)
            .unwrap();
        let late = service
            .create("Late".into(), None, vec!["home".into()], 10_000)
            .unwrap();
        service.set_completed(&early.id, Some(2_000)).unwrap();
        service.set_completed(&late.id, Some(20_000)).unwrap();

        // Date-only on the completed column.
        let by_completed = service
            .list_history(Some(1_000), Some(5_000), HistorySort::Completed, &[])
            .unwrap();
        assert_eq!(by_completed.len(), 1);
        assert_eq!(by_completed[0].title, "Early");

        // Tag-only (no date range).
        let by_tag = service
            .list_history(None, None, HistorySort::Created, &["HOME".into()])
            .unwrap();
        assert_eq!(by_tag.len(), 1);
        assert_eq!(by_tag[0].title, "Late");

        // Date AND tag combined — matching range but non-matching tag → empty.
        let combined = service
            .list_history(
                Some(1_000),
                Some(5_000),
                HistorySort::Completed,
                &["home".into()],
            )
            .unwrap();
        assert!(combined.is_empty());

        // Due-date sort: items without a due date are excluded when a range is set.
        let by_due = service
            .list_history(Some(1_000), Some(2_000), HistorySort::Due, &[])
            .unwrap();
        assert_eq!(by_due.len(), 1);
        assert_eq!(by_due[0].title, "Early");

        // No filters at all → everything completed.
        assert_eq!(
            service
                .list_history(None, None, HistorySort::Created, &[])
                .unwrap()
                .len(),
            2
        );
    }

    // Spec scenarios: daily-checklist/start-from-item + item-already-completed
    #[test]
    fn test_checklist_session_link_lifecycle() {
        let service = service();
        let item = service
            .create("Deep work".into(), None, vec![], 1_000)
            .unwrap();
        create_session(&service, "sess-1");
        service.link_session(&item.id, "sess-1", 1_500).unwrap();

        let linked = service.open_item_for_session("sess-1").unwrap();
        assert_eq!(linked.map(|found| found.id), Some(item.id.clone()));

        service.set_completed(&item.id, Some(2_000)).unwrap();
        assert!(service.open_item_for_session("sess-1").unwrap().is_none());
    }

    // Spec scenario: daily-checklist/confirmed-delete
    #[test]
    fn test_checklist_delete_cascades_links_and_keeps_shared_tags() {
        let service = service();
        let doomed = service
            .create("Doomed".into(), None, vec!["shared".into()], 1_000)
            .unwrap();
        let survivor = service
            .create("Survivor".into(), None, vec!["shared".into()], 2_000)
            .unwrap();
        create_session(&service, "sess-1");
        service.link_session(&doomed.id, "sess-1", 1_500).unwrap();

        service.delete(&doomed.id).unwrap();
        assert!(matches!(
            service.set_completed(&doomed.id, Some(3_000)),
            Err(AppError::NotFound(_))
        ));
        // Junction rows are gone, shared tag remains for the survivor.
        assert!(service.open_item_for_session("sess-1").unwrap().is_none());
        assert_eq!(service.list_tags().unwrap().len(), 1);
        let open = service.list_open(0).unwrap();
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].id, survivor.id);
        assert_eq!(open[0].tags.len(), 1);
    }

    #[test]
    fn normalize_tag_strips_hash_and_whitespace() {
        assert_eq!(normalize_tag("  #work "), "work");
        assert_eq!(normalize_tag("#"), "");
        assert_eq!(normalize_tag("plain"), "plain");
    }
}
