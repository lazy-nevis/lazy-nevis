use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistItem {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub due_date: Option<i64>,
    pub sort_order: i64,
    #[serde(default)]
    pub tags: Vec<Tag>,
}
