# Focus Sessions Specification

## ADDED Requirements

### Requirement: Linked checklist item completion prompt

The system SHALL offer to complete the linked checklist item when a session started from that
item is stopped while the item is still open, SHALL NOT complete the item without explicit user
confirmation, and SHALL treat declining as a no-op.

#### Scenario: Prompt on stop
- **GIVEN** an active session linked to an open checklist item
- **WHEN** the user stops the session (UI, shortcut, or tray)
- **THEN** a confirmation offers to complete the linked item

#### Scenario: Decline keeps item open
- **GIVEN** the completion prompt is shown
- **WHEN** the user declines
- **THEN** the session ends normally and the item remains open
