//! Daily checklist persistence (spec: daily-checklist, checklist-organization).

use crate::db::{checklist_item_from_row, queries, tag_from_row, Database};
use crate::error::{AppError, Result};
use crate::models::{
    validate_tone, ChecklistCategory, ChecklistItem, Priority, Tag, ALLOWED_TONES,
};
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

#[derive(Debug, Clone)]
pub struct CreateItem {
    pub title: String,
    pub due_date: Option<i64>,
    pub due_has_time: bool,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub priority: Priority,
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct UpdateItem {
    pub title: String,
    pub due_date: Option<i64>,
    pub due_has_time: bool,
    pub tags: Vec<String>,
    pub category: Option<String>,
    pub priority: Priority,
}

/// Normalize a tag name: trim whitespace and a leading '#'.
pub fn normalize_tag(name: &str) -> String {
    name.trim().trim_start_matches('#').trim().to_string()
}

const MAX_CATEGORY_NAME_LEN: usize = 40;

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

    pub fn create(&self, input: CreateItem, now: i64) -> Result<ChecklistItem> {
        let parent_category_id = if let Some(parent_id) = &input.parent_id {
            let db = self.lock()?;
            let parent = get_item_row(&db, parent_id)?;
            if parent.completed_at.is_some() {
                return Err(AppError::InvalidArgument(
                    "Cannot add sub-item to a completed parent".into(),
                ));
            }
            if parent.parent_id.is_some() {
                return Err(AppError::InvalidArgument(
                    "Sub-items cannot have their own sub-items".into(),
                ));
            }
            parent.category_id()
        } else {
            None
        };

        let id = Uuid::new_v4().to_string();
        let mut db = self.lock()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;

        let category_id = if input.parent_id.is_some() {
            parent_category_id
        } else {
            resolve_category_id(&tx, input.category.as_deref(), now)?
        };

        let parent_key: Option<&str> = input.parent_id.as_deref();
        let sort_order: i64 = tx
            .query_row(
                queries::SELECT_MAX_CHECKLIST_SORT_ORDER,
                params![parent_key],
                |row| row.get(0),
            )
            .map_err(AppError::Database)?;

        let due_has_time = if input.due_date.is_some() {
            input.due_has_time
        } else {
            false
        };

        tx.execute(
            queries::INSERT_CHECKLIST_ITEM,
            params![
                id,
                input.title,
                now,
                input.due_date,
                sort_order + 1,
                input.parent_id,
                category_id,
                input.priority.to_db(),
                if due_has_time { 1 } else { 0 },
            ],
        )
        .map_err(AppError::Database)?;
        set_item_tags(&tx, &id, &input.tags, now)?;
        tx.commit().map_err(AppError::Database)?;
        get_item(&db, &id)
    }

    pub fn update(&self, id: &str, input: UpdateItem, now: i64) -> Result<ChecklistItem> {
        let mut db = self.lock()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;

        let existing = get_item_row_tx(&tx, id)?;
        let is_sub = existing.parent_id.is_some();

        let category_id = if is_sub {
            existing.category_id()
        } else {
            resolve_category_id(&tx, input.category.as_deref(), now)?
        };

        let due_has_time = if input.due_date.is_some() {
            input.due_has_time
        } else {
            false
        };

        let updated = tx
            .execute(
                queries::UPDATE_CHECKLIST_ITEM,
                params![
                    input.title,
                    input.due_date,
                    if due_has_time { 1 } else { 0 },
                    category_id,
                    input.priority.to_db(),
                    id,
                ],
            )
            .map_err(AppError::Database)?;
        if updated == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }

        if !is_sub && category_id != existing.category_id() {
            tx.execute(queries::UPDATE_CHILDREN_CATEGORY, params![category_id, id])
                .map_err(AppError::Database)?;
        }

        tx.execute(queries::DELETE_CHECKLIST_ITEM_TAGS, params![id])
            .map_err(AppError::Database)?;
        set_item_tags(&tx, id, &input.tags, now)?;
        tx.commit().map_err(AppError::Database)?;
        get_item(&db, id)
    }

    pub fn set_completed(&self, id: &str, completed_at: Option<i64>) -> Result<ChecklistItem> {
        let mut db = self.lock()?;
        let tx = db.conn_mut().transaction().map_err(AppError::Database)?;

        let existing = get_item_row_tx(&tx, id)?;
        let previous_completed = existing.completed_at;

        if completed_at.is_some() {
            tx.execute(
                queries::UPDATE_CHECKLIST_COMPLETED_AT,
                params![completed_at, id],
            )
            .map_err(AppError::Database)?;
            if existing.parent_id.is_none() {
                tx.execute(
                    queries::CASCADE_COMPLETE_CHILDREN,
                    params![completed_at, id],
                )
                .map_err(AppError::Database)?;
            }
        } else {
            tx.execute(
                queries::UPDATE_CHECKLIST_COMPLETED_AT,
                params![None::<i64>, id],
            )
            .map_err(AppError::Database)?;
            if existing.parent_id.is_none() && previous_completed.is_some() {
                tx.execute(
                    queries::CASCADE_UNCOMPLETE_CHILDREN,
                    params![id, previous_completed],
                )
                .map_err(AppError::Database)?;
            }
        }

        tx.commit().map_err(AppError::Database)?;
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

    pub fn count_subitems(&self, parent_id: &str) -> Result<i64> {
        let db = self.lock()?;
        db.conn()
            .query_row(queries::COUNT_SUBITEMS, params![parent_id], |row| {
                row.get(0)
            })
            .map_err(AppError::Database)
    }

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
        attach_relations(&db, items)
    }

    pub fn list_history(
        &self,
        from: Option<i64>,
        to: Option<i64>,
        sort: HistorySort,
        tags: &[String],
        categories: &[String],
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
        let items = attach_relations(&db, items)?;
        let items = filter_by_tags(items, tags);
        Ok(filter_by_categories(items, categories))
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

    pub fn list_categories(&self) -> Result<Vec<ChecklistCategory>> {
        let db = self.lock()?;
        let mut statement = db
            .conn()
            .prepare(queries::SELECT_ALL_CHECKLIST_CATEGORIES)
            .map_err(AppError::Database)?;
        let categories = statement
            .query_map([], category_from_row)
            .map_err(AppError::Database)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(AppError::Database)?;
        Ok(categories)
    }

    pub fn create_category(
        &self,
        name: String,
        tone: Option<String>,
        now: i64,
    ) -> Result<ChecklistCategory> {
        let trimmed = validate_category_name(&name)?;
        let tone = tone
            .filter(|t| validate_tone(t))
            .unwrap_or_else(|| next_category_tone(self).unwrap_or_else(|_| "slate".to_string()));

        let id = Uuid::new_v4().to_string();
        let db = self.lock()?;
        let sort_order: i64 = db
            .conn()
            .query_row(queries::SELECT_MAX_CATEGORY_SORT_ORDER, [], |row| {
                row.get(0)
            })
            .map_err(AppError::Database)?;
        db.conn()
            .execute(
                queries::INSERT_CHECKLIST_CATEGORY,
                params![id, trimmed, tone, sort_order + 1, now],
            )
            .map_err(AppError::Database)?;
        get_category(&db, &id)
    }

    pub fn update_category(
        &self,
        id: &str,
        name: String,
        tone: String,
    ) -> Result<ChecklistCategory> {
        let trimmed = validate_category_name(&name)?;
        if !validate_tone(&tone) {
            return Err(AppError::InvalidArgument("Invalid category tone".into()));
        }
        let db = self.lock()?;
        let updated = db
            .conn()
            .execute(
                queries::UPDATE_CHECKLIST_CATEGORY,
                params![trimmed, tone, id],
            )
            .map_err(AppError::Database)?;
        if updated == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        get_category(&db, id)
    }

    pub fn delete_category(&self, id: &str) -> Result<()> {
        let db = self.lock()?;
        let deleted = db
            .conn()
            .execute(queries::DELETE_CHECKLIST_CATEGORY, params![id])
            .map_err(AppError::Database)?;
        if deleted == 0 {
            return Err(AppError::NotFound(id.to_string()));
        }
        Ok(())
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
            Some(item) => Ok(Some(with_relations(&db, item)?)),
            None => Ok(None),
        }
    }
}

fn next_category_tone(service: &ChecklistService) -> Result<String> {
    let categories = service.list_categories()?;
    let index = categories.len() % ALLOWED_TONES.len();
    Ok(ALLOWED_TONES[index].to_string())
}

fn validate_category_name(name: &str) -> Result<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_CATEGORY_NAME_LEN {
        return Err(AppError::InvalidArgument(format!(
            "Category name must be 1–{MAX_CATEGORY_NAME_LEN} characters"
        )));
    }
    Ok(trimmed.to_string())
}

fn category_from_row(row: &rusqlite::Row) -> rusqlite::Result<ChecklistCategory> {
    Ok(ChecklistCategory {
        id: row.get(0)?,
        name: row.get(1)?,
        tone: row.get(2)?,
        sort_order: row.get(3)?,
        created_at: row.get(4)?,
    })
}

struct ItemRow {
    parent_id: Option<String>,
    completed_at: Option<i64>,
    category_id: Option<String>,
}

impl ItemRow {
    fn category_id(&self) -> Option<String> {
        self.category_id.clone()
    }
}

fn item_row_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ItemRow> {
    Ok(ItemRow {
        parent_id: row.get(0)?,
        completed_at: row.get(1)?,
        category_id: row.get(2)?,
    })
}

fn item_row_error(id: &str, error: rusqlite::Error) -> AppError {
    match error {
        rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(id.to_string()),
        other => AppError::Database(other),
    }
}

fn get_item_row(db: &Database, id: &str) -> Result<ItemRow> {
    db.conn()
        .query_row(
            queries::SELECT_CHECKLIST_ITEM_ROW,
            params![id],
            item_row_from_row,
        )
        .map_err(|error| item_row_error(id, error))
}

fn get_item_row_tx(tx: &rusqlite::Transaction<'_>, id: &str) -> Result<ItemRow> {
    tx.query_row(
        queries::SELECT_CHECKLIST_ITEM_ROW,
        params![id],
        item_row_from_row,
    )
    .map_err(|error| item_row_error(id, error))
}

fn resolve_category_id(
    tx: &rusqlite::Transaction<'_>,
    category_name: Option<&str>,
    now: i64,
) -> Result<Option<String>> {
    let name = category_name.map(str::trim).filter(|n| !n.is_empty());
    match name {
        None => Ok(None),
        Some(raw) => {
            let validated = validate_category_name(raw)?;
            if let Ok(existing) = tx.query_row(
                queries::SELECT_CHECKLIST_CATEGORY_BY_NAME,
                params![validated],
                category_from_row,
            ) {
                return Ok(Some(existing.id));
            }
            let id = Uuid::new_v4().to_string();
            let sort_order: i64 = tx
                .query_row(queries::SELECT_MAX_CATEGORY_SORT_ORDER, [], |row| {
                    row.get(0)
                })
                .map_err(AppError::Database)?;
            let tone_index = (sort_order as usize) % ALLOWED_TONES.len();
            let tone = ALLOWED_TONES[tone_index];
            tx.execute(
                queries::INSERT_CHECKLIST_CATEGORY,
                params![id, validated, tone, sort_order + 1, now],
            )
            .map_err(AppError::Database)?;
            Ok(Some(id))
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

fn get_category(db: &Database, id: &str) -> Result<ChecklistCategory> {
    db.conn()
        .query_row(
            queries::SELECT_CHECKLIST_CATEGORY_BY_ID,
            params![id],
            category_from_row,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::NotFound(id.to_string()),
            other => AppError::Database(other),
        })
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
    with_relations(db, item)
}

fn with_relations(db: &Database, mut item: ChecklistItem) -> Result<ChecklistItem> {
    let mut statement = db
        .conn()
        .prepare(queries::SELECT_TAGS_FOR_CHECKLIST_ITEM)
        .map_err(AppError::Database)?;
    item.tags = statement
        .query_map(params![item.id], tag_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;

    let category_id: Option<String> = db
        .conn()
        .query_row(
            queries::SELECT_CHECKLIST_ITEM_CATEGORY_ID,
            params![item.id],
            |row| row.get(0),
        )
        .map_err(AppError::Database)?;
    if let Some(cid) = category_id {
        item.category = get_category(db, &cid).ok();
    }
    Ok(item)
}

fn attach_relations(db: &Database, items: Vec<ChecklistItem>) -> Result<Vec<ChecklistItem>> {
    let categories = load_category_map(db)?;
    items
        .into_iter()
        .map(|mut item| {
            let category_id: Option<String> = db
                .conn()
                .query_row(
                    queries::SELECT_CHECKLIST_ITEM_CATEGORY_ID,
                    params![item.id],
                    |row| row.get(0),
                )
                .map_err(AppError::Database)?;
            if let Some(cid) = category_id {
                item.category = categories.get(&cid).cloned();
            }
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
        })
        .collect()
}

fn load_category_map(
    db: &Database,
) -> Result<std::collections::HashMap<String, ChecklistCategory>> {
    let mut statement = db
        .conn()
        .prepare(queries::SELECT_ALL_CHECKLIST_CATEGORIES)
        .map_err(AppError::Database)?;
    let categories = statement
        .query_map([], category_from_row)
        .map_err(AppError::Database)?
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(AppError::Database)?;
    Ok(categories.into_iter().map(|c| (c.id.clone(), c)).collect())
}

fn filter_by_tags(items: Vec<ChecklistItem>, tags: &[String]) -> Vec<ChecklistItem> {
    if tags.is_empty() {
        return items;
    }
    let wanted: Vec<String> = tags
        .iter()
        .map(|tag| normalize_tag(tag).to_lowercase())
        .filter(|tag| !tag.is_empty())
        .collect();
    items
        .into_iter()
        .filter(|item| {
            item.tags
                .iter()
                .any(|tag| wanted.contains(&tag.name.to_lowercase()))
        })
        .collect()
}

fn filter_by_categories(items: Vec<ChecklistItem>, categories: &[String]) -> Vec<ChecklistItem> {
    if categories.is_empty() {
        return items;
    }
    let wanted: std::collections::HashSet<String> =
        categories.iter().map(|id| id.to_lowercase()).collect();
    items
        .into_iter()
        .filter(|item| {
            item.category
                .as_ref()
                .map(|c| wanted.contains(&c.id.to_lowercase()))
                .unwrap_or(wanted.contains("none"))
        })
        .collect()
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

    fn simple_create(
        service: &ChecklistService,
        title: &str,
        tags: Vec<String>,
        now: i64,
    ) -> ChecklistItem {
        service
            .create(
                CreateItem {
                    title: title.into(),
                    due_date: None,
                    due_has_time: false,
                    tags,
                    category: None,
                    priority: Priority::None,
                    parent_id: None,
                },
                now,
            )
            .unwrap()
    }

    #[test]
    fn test_migration_0005_from_v4_fixture() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("v4.db");
        let legacy = rusqlite::Connection::open(&path).unwrap();
        legacy.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        legacy
            .execute_batch(include_str!("../db/migrations/0001_initial.sql"))
            .unwrap();
        legacy
            .execute_batch(include_str!("../db/migrations/0002_session_runtime.sql"))
            .unwrap();
        legacy
            .execute_batch(include_str!("../db/migrations/0003_recent_audio_files.sql"))
            .unwrap();
        legacy
            .execute_batch(include_str!("../db/migrations/0004_checklist.sql"))
            .unwrap();
        legacy
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS schema_migrations (
                    version INTEGER PRIMARY KEY,
                    applied_at INTEGER NOT NULL
                );",
            )
            .unwrap();
        for version in 1..=4 {
            legacy
                .execute(
                    "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, 1000)",
                    [version],
                )
                .unwrap();
        }
        legacy
            .execute(
                "INSERT INTO checklist_items (id, title, created_at, sort_order) VALUES ('a', 'Keep', 1000, 1)",
                [],
            )
            .unwrap();
        drop(legacy);

        let db = Database::open(&path).unwrap();
        let item = db
            .conn()
            .query_row(
                "SELECT title, priority, due_has_time FROM checklist_items WHERE id = 'a'",
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(item.0, "Keep");
        assert_eq!(item.1, 0);
        assert_eq!(item.2, 0);
    }

    #[test]
    fn test_checklist_create_complete_uncomplete_round_trip() {
        let service = service();
        let item = simple_create(&service, "Write report", vec![], 1_000);
        assert_eq!(item.sort_order, 1);
        assert!(item.completed_at.is_none());

        let done = service.set_completed(&item.id, Some(5_000)).unwrap();
        assert_eq!(done.completed_at, Some(5_000));
        assert_eq!(service.list_open(4_000).unwrap().len(), 1);
        assert_eq!(service.list_open(6_000).unwrap().len(), 0);

        let reopened = service.set_completed(&item.id, None).unwrap();
        assert!(reopened.completed_at.is_none());
        assert_eq!(service.list_open(0).unwrap().len(), 1);
    }

    #[test]
    fn test_subitem_depth_and_category_inheritance() {
        let service = service();
        let parent = service
            .create(
                CreateItem {
                    title: "Parent".into(),
                    due_date: None,
                    due_has_time: false,
                    tags: vec![],
                    category: Some("Work".into()),
                    priority: Priority::High,
                    parent_id: None,
                },
                1_000,
            )
            .unwrap();
        assert!(parent.category.is_some());

        let sub = service
            .create(
                CreateItem {
                    title: "Sub".into(),
                    due_date: None,
                    due_has_time: false,
                    tags: vec![],
                    category: None,
                    priority: Priority::Low,
                    parent_id: Some(parent.id.clone()),
                },
                2_000,
            )
            .unwrap();
        assert_eq!(sub.parent_id, Some(parent.id.clone()));
        assert_eq!(
            sub.category.as_ref().map(|c| c.id.clone()),
            parent.category.as_ref().map(|c| c.id.clone())
        );

        let err = service.create(
            CreateItem {
                title: "Too deep".into(),
                due_date: None,
                due_has_time: false,
                tags: vec![],
                category: None,
                priority: Priority::None,
                parent_id: Some(sub.id.clone()),
            },
            3_000,
        );
        assert!(err.is_err());
    }

    #[test]
    fn test_cascade_complete_and_undo() {
        let service = service();
        let parent = simple_create(&service, "P", vec![], 1_000);
        let sub_a = service
            .create(
                CreateItem {
                    title: "A".into(),
                    due_date: None,
                    due_has_time: false,
                    tags: vec![],
                    category: None,
                    priority: Priority::None,
                    parent_id: Some(parent.id.clone()),
                },
                1_100,
            )
            .unwrap();
        let sub_b = service
            .create(
                CreateItem {
                    title: "B".into(),
                    due_date: None,
                    due_has_time: false,
                    tags: vec![],
                    category: None,
                    priority: Priority::None,
                    parent_id: Some(parent.id.clone()),
                },
                1_200,
            )
            .unwrap();
        service.set_completed(&sub_a.id, Some(500)).unwrap();

        service.set_completed(&parent.id, Some(9_000)).unwrap();
        let open = service.list_open(0).unwrap();
        let sub_b_row = open.iter().find(|i| i.id == sub_b.id).unwrap();
        assert_eq!(sub_b_row.completed_at, Some(9_000));

        service.set_completed(&parent.id, None).unwrap();
        let open = service.list_open(0).unwrap();
        let sub_a_row = open.iter().find(|i| i.id == sub_a.id).unwrap();
        let sub_b_row = open.iter().find(|i| i.id == sub_b.id).unwrap();
        assert_eq!(sub_a_row.completed_at, Some(500));
        assert!(sub_b_row.completed_at.is_none());
    }

    #[test]
    fn test_category_crud_and_delete_uncategorizes() {
        let service = service();
        let cat = service
            .create_category("Namai".into(), Some("rose".into()), 1_000)
            .unwrap();
        let item = service
            .create(
                CreateItem {
                    title: "T".into(),
                    due_date: None,
                    due_has_time: false,
                    tags: vec![],
                    category: Some("Namai".into()),
                    priority: Priority::None,
                    parent_id: None,
                },
                2_000,
            )
            .unwrap();
        assert_eq!(
            item.category.as_ref().map(|c| c.id.clone()),
            Some(cat.id.clone())
        );

        service.delete_category(&cat.id).unwrap();
        let refreshed = service.list_open(0).unwrap();
        let row = refreshed.iter().find(|i| i.id == item.id).unwrap();
        assert!(row.category.is_none());
    }

    #[test]
    fn test_checklist_tags_dedupe_case_insensitively() {
        let service = service();
        let first = simple_create(&service, "A", vec!["#Work".into()], 1_000);
        let second = simple_create(&service, "B", vec!["work".into()], 2_000);
        assert_eq!(first.tags[0].id, second.tags[0].id);
    }

    #[test]
    fn test_checklist_reorder_persists() {
        let service = service();
        let a = simple_create(&service, "A", vec![], 1_000);
        let b = simple_create(&service, "B", vec![], 2_000);
        let c = simple_create(&service, "C", vec![], 3_000);
        service
            .reorder(&[c.id.clone(), a.id.clone(), b.id.clone()])
            .unwrap();
        let open = service.list_open(0).unwrap();
        let titles: Vec<&str> = open.iter().map(|item| item.title.as_str()).collect();
        assert_eq!(titles, ["C", "A", "B"]);
    }

    #[test]
    fn test_checklist_history_filter_matrix() {
        let service = service();
        let early = service
            .create(
                CreateItem {
                    title: "Early".into(),
                    due_date: Some(1_500),
                    due_has_time: false,
                    tags: vec!["work".into()],
                    category: None,
                    priority: Priority::None,
                    parent_id: None,
                },
                1_000,
            )
            .unwrap();
        let late = service
            .create(
                CreateItem {
                    title: "Late".into(),
                    due_date: None,
                    due_has_time: false,
                    tags: vec!["home".into()],
                    category: None,
                    priority: Priority::None,
                    parent_id: None,
                },
                10_000,
            )
            .unwrap();
        service.set_completed(&early.id, Some(2_000)).unwrap();
        service.set_completed(&late.id, Some(20_000)).unwrap();

        assert_eq!(
            service
                .list_history(Some(1_000), Some(5_000), HistorySort::Completed, &[], &[])
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            service
                .list_history(None, None, HistorySort::Created, &["HOME".into()], &[])
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn test_checklist_session_link_lifecycle() {
        let service = service();
        let item = simple_create(&service, "Deep work", vec![], 1_000);
        create_session(&service, "sess-1");
        service.link_session(&item.id, "sess-1", 1_500).unwrap();
        assert_eq!(
            service
                .open_item_for_session("sess-1")
                .unwrap()
                .map(|i| i.id),
            Some(item.id.clone())
        );
        service.set_completed(&item.id, Some(2_000)).unwrap();
        assert!(service.open_item_for_session("sess-1").unwrap().is_none());
    }

    #[test]
    fn test_checklist_delete_cascades_links_and_keeps_shared_tags() {
        let service = service();
        let doomed = simple_create(&service, "Doomed", vec!["shared".into()], 1_000);
        let _survivor = simple_create(&service, "Survivor", vec!["shared".into()], 2_000);
        create_session(&service, "sess-1");
        service.link_session(&doomed.id, "sess-1", 1_500).unwrap();
        service.delete(&doomed.id).unwrap();
        assert!(service.open_item_for_session("sess-1").unwrap().is_none());
        assert_eq!(service.list_open(0).unwrap().len(), 1);
    }

    #[test]
    fn normalize_tag_strips_hash_and_whitespace() {
        assert_eq!(normalize_tag("  #work "), "work");
    }
}
