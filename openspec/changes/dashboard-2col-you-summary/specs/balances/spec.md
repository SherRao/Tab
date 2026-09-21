## MODIFIED Requirements

### Requirement: Net balance derivation

The system SHALL compute each participant's net balance as total paid minus total consumed, where consumed includes allocated line-item costs plus proportional tax and tip. Net balances SHALL be derived from stored facts on demand, never stored as authoritative data. When the viewer is signed in and linked to a participant, the system SHALL additionally surface that participant's net balance and transfer count for use by the viewer summary banner.

#### Scenario: Single expense balance

- **WHEN** A paid $90 for lunch and dinner, consuming $40 of it, and no other expenses exist
- **THEN** A's net balance is +$50

#### Scenario: Balances sum to zero

- **WHEN** any set of expenses exists with no rounding error beyond one cent per allocation
- **THEN** the sum of all participants' net balances equals zero (within one cent)

#### Scenario: Recompute after change

- **WHEN** an expense is added, edited, or deleted
- **THEN** balances and settlements reflect the change immediately

#### Scenario: Viewer balance extraction

- **WHEN** a signed-in viewer is linked to participant P in an event
- **THEN** P's net balance from the computed balances and P's transfer count from the simplified settlement are available for the viewer summary without additional computation
