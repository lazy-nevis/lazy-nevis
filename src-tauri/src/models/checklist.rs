use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistCategory {
    pub id: String,
    pub name: String,
    pub tone: String,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    #[default]
    None,
    Low,
    Medium,
    High,
    Urgent,
}

impl Priority {
    pub fn from_db(value: i64) -> Self {
        match value {
            1 => Self::Low,
            2 => Self::Medium,
            3 => Self::High,
            4 => Self::Urgent,
            _ => Self::None,
        }
    }

    pub fn to_db(self) -> i64 {
        match self {
            Self::None => 0,
            Self::Low => 1,
            Self::Medium => 2,
            Self::High => 3,
            Self::Urgent => 4,
        }
    }

    pub fn parse_token(token: &str) -> Option<Self> {
        let lower = token.trim().to_lowercase();
        match lower.as_str() {
            "1" | "urgent" | "urgente" => Some(Self::Urgent),
            "2" | "high" | "alta" => Some(Self::High),
            "3" | "medium" | "media" | "média" => Some(Self::Medium),
            "4" | "low" | "baixa" => Some(Self::Low),
            _ => None,
        }
    }
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
    pub parent_id: Option<String>,
    #[serde(default)]
    pub category: Option<ChecklistCategory>,
    #[serde(default)]
    pub priority: Priority,
    #[serde(default)]
    pub due_has_time: bool,
    #[serde(default)]
    pub tags: Vec<Tag>,
}

pub const ALLOWED_TONES: &[&str] = &[
    "slate", "sky", "violet", "rose", "orange", "amber", "emerald", "teal",
];

pub fn validate_tone(tone: &str) -> bool {
    ALLOWED_TONES.contains(&tone)
}
