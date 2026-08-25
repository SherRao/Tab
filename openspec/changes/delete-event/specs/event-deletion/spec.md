## Purpose

Allows the event (tab) creator to permanently delete their event, cascading to all dependent data and invalidating the share link.

## ADDED Requirements

### Requirement: Creator can delete an event

The system SHALL allow the event owner to permanently delete an event via a confirmation action. All associated data (participants, expenses, line items, share shares) are removed from the database.

#### Scenario: Owner deletes event from event page

- **WHEN** the event owner clicks the "Delete tab" button on their event page
- **AND** confirms the deletion in the confirmation dialog
- **THEN** the event is permanently deleted from the database and all cascading dependent data (participants, expenses with line items and shares) are also removed
- **AND** the share link `/e/<token>` becomes invalid, showing "event deleted" state
- **AND** the user is redirected to their tabs list with a success toast

### Requirement: Non-owner cannot delete event

The system SHALL prevent non-owners from deleting an event.

#### Scenario: Non-owner attempts to delete event

- **WHEN** a non-owner user attempts to delete an event
- **THEN** the delete action is rejected and the user is redirected back to the event page
- **AND** an error message is displayed: "Only the event owner can delete this tab"

### Requirement: Share link is invalidated after deletion

The system SHALL invalidate the share token immediately upon event deletion.

#### Scenario: Share link after deletion

- **WHEN** an event is deleted
- **THEN** any existing share link `/e/<token>` no longer provides access to the event
- **AND** visitors to the share link see: "This event has been deleted"
- **AND** the owner sees a notification that the share link has been invalidated