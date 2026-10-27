//! Overlay queue decisions for reminder/habit/pomodoro fullscreen alerts.

use crate::models::overlay::OverlayAlertPayload;
use std::collections::VecDeque;

pub const OVERLAY_QUEUE_MAX: usize = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueueDecision {
    ShowNow,
    Enqueue,
    FallbackToNotification,
    PreemptAndRequeue,
}

pub fn overlay_kind(payload: &OverlayAlertPayload) -> &str {
    payload.kind.as_str()
}

pub fn is_distraction(payload: &OverlayAlertPayload) -> bool {
    overlay_kind(payload) == "distraction"
}

/// Pure policy for fullscreen overlay admission (unit-tested).
pub fn decide(
    current: Option<&OverlayAlertPayload>,
    incoming: &OverlayAlertPayload,
    queue_len: usize,
) -> QueueDecision {
    if is_distraction(incoming) {
        if let Some(active) = current {
            if !is_distraction(active) {
                return QueueDecision::PreemptAndRequeue;
            }
        }
        return QueueDecision::ShowNow;
    }

    if current.is_none() {
        return QueueDecision::ShowNow;
    }

    if current.is_some_and(is_distraction) {
        return QueueDecision::Enqueue;
    }

    if queue_len >= OVERLAY_QUEUE_MAX {
        return QueueDecision::FallbackToNotification;
    }

    QueueDecision::Enqueue
}

#[derive(Debug, Default)]
pub struct OverlayQueue {
    items: VecDeque<OverlayAlertPayload>,
}

impl OverlayQueue {
    pub fn new() -> Self {
        Self {
            items: VecDeque::new(),
        }
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    pub fn push_front(&mut self, payload: OverlayAlertPayload) {
        self.items.push_front(payload);
        while self.items.len() > OVERLAY_QUEUE_MAX {
            self.items.pop_back();
        }
    }

    pub fn push_back(&mut self, payload: OverlayAlertPayload) {
        if self.items.len() < OVERLAY_QUEUE_MAX {
            self.items.push_back(payload);
        }
    }

    pub fn pop_front(&mut self) -> Option<OverlayAlertPayload> {
        self.items.pop_front()
    }

    /// Apply queue policy and return the payload to show immediately, if any.
    pub fn admit(
        &mut self,
        current: Option<OverlayAlertPayload>,
        incoming: OverlayAlertPayload,
    ) -> OverlayAdmission {
        match decide(current.as_ref(), &incoming, self.len()) {
            QueueDecision::ShowNow => OverlayAdmission::Show(Box::new(incoming)),
            QueueDecision::Enqueue => {
                self.push_back(incoming);
                OverlayAdmission::Queued
            }
            QueueDecision::PreemptAndRequeue => {
                if let Some(active) = current {
                    self.push_front(active);
                }
                OverlayAdmission::Show(Box::new(incoming))
            }
            QueueDecision::FallbackToNotification => OverlayAdmission::Fallback,
        }
    }
}

#[derive(Debug, Clone)]
pub enum OverlayAdmission {
    Show(Box<OverlayAlertPayload>),
    Queued,
    Fallback,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::overlay::{OverlayAlertPayload, ReminderOverlay};

    fn distraction() -> OverlayAlertPayload {
        OverlayAlertPayload {
            kind: "distraction".into(),
            session_id: "s".into(),
            app_name: "app".into(),
            window_title: None,
            distracted_ms: 0,
            session_elapsed_ms: 0,
            focus_ms: 0,
            idle_ms: 0,
            alert_started_at_ms: 0,
            is_test: false,
            language: "en-US".into(),
            time_format: "24h".into(),
            reminder: None,
        }
    }

    fn reminder_overlay() -> OverlayAlertPayload {
        OverlayAlertPayload {
            kind: "reminder".into(),
            session_id: String::new(),
            app_name: String::new(),
            window_title: None,
            distracted_ms: 0,
            session_elapsed_ms: 0,
            focus_ms: 0,
            idle_ms: 0,
            alert_started_at_ms: 0,
            is_test: false,
            language: "en-US".into(),
            time_format: "24h".into(),
            reminder: Some(ReminderOverlay {
                event_id: "e".into(),
                owner_kind: "reminder".into(),
                owner_id: "r".into(),
                title: "t".into(),
                body_md: None,
                tone: "sky".into(),
                late: false,
                actions: vec!["done".into()],
            }),
        }
    }

    #[test]
    fn distraction_preempts_reminder() {
        let current = reminder_overlay();
        let incoming = distraction();
        assert_eq!(
            decide(Some(&current), &incoming, 0),
            QueueDecision::PreemptAndRequeue
        );
    }

    #[test]
    fn reminder_queues_behind_distraction() {
        let current = distraction();
        let incoming = reminder_overlay();
        assert_eq!(decide(Some(&current), &incoming, 0), QueueDecision::Enqueue);
    }

    #[test]
    fn full_queue_falls_back() {
        let current = reminder_overlay();
        let incoming = reminder_overlay();
        assert_eq!(
            decide(Some(&current), &incoming, OVERLAY_QUEUE_MAX),
            QueueDecision::FallbackToNotification
        );
    }

    #[test]
    fn admit_preempt_requeues_reminder() {
        let mut queue = OverlayQueue::new();
        let current = reminder_overlay();
        let incoming = distraction();
        let result = queue.admit(Some(current), incoming);
        assert!(matches!(result, OverlayAdmission::Show(_)));
        assert_eq!(queue.len(), 1);
    }

    #[test]
    fn admit_distraction_queues_reminder_behind() {
        let mut queue = OverlayQueue::new();
        let current = distraction();
        let incoming = reminder_overlay();
        let result = queue.admit(Some(current), incoming);
        assert!(matches!(result, OverlayAdmission::Queued));
        assert_eq!(queue.len(), 1);
    }
}
