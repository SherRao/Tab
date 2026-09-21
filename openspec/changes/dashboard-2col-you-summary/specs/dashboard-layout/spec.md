## Purpose

Defines the responsive two-column layout for the event dashboard and the personalized viewer summary that orients signed-in participants at a glance.

## ADDED Requirements

### Requirement: Two-column responsive layout

The event dashboard SHALL render in a two-column grid at the `lg` breakpoint (1024px+), with a main content column (~60% width) and a sidebar column (~40% width). Below `lg`, the dashboard SHALL render as a single column.

#### Scenario: Wide viewport layout

- **WHEN** the viewport is 1024px or wider
- **THEN** the dashboard renders a left main column containing the event header, viewer summary, unassigned warnings, and receipts; and a right sidebar column containing balances, settle-up, claim requests, groups, and owner actions

#### Scenario: Narrow viewport layout

- **WHEN** the viewport is below 1024px
- **THEN** the dashboard renders all sections in a single column with the viewer summary placed after the event header

### Requirement: Sidebar stickiness

The sidebar column SHALL be position-sticky so that balances and settle-up remain visible while the user scrolls through receipts in the main column. The sticky offset SHALL account for any fixed site header.

#### Scenario: Scrolling receipts with sidebar visible

- **WHEN** the user scrolls down through 5+ receipts on a wide viewport
- **THEN** the sidebar (balances, settle-up) remains visible in the viewport

#### Scenario: Sidebar overflow

- **WHEN** the sidebar content exceeds the viewport height (many participants, many transfers)
- **THEN** the sidebar scrolls independently within its column without pushing main column content

### Requirement: Viewer summary banner

When the viewer is signed in and linked to a participant in the event, the dashboard SHALL display a personal summary banner showing the viewer's net balance position and the number of people involved in their transfers.

#### Scenario: Viewer owes money

- **WHEN** a signed-in viewer is linked to a participant whose net balance is negative (-$2300 cents)
- **THEN** the summary banner displays "You owe $23.00 to N person(s)" where N is the count of distinct people the viewer must pay in the simplified settlement

#### Scenario: Viewer is owed money

- **WHEN** a signed-in viewer is linked to a participant whose net balance is positive (+$4700 cents)
- **THEN** the summary banner displays "You get back $47.00 from N person(s)" where N is the count of distinct people who must pay the viewer in the simplified settlement

#### Scenario: Viewer is settled

- **WHEN** a signed-in viewer is linked to a participant whose net balance is zero
- **THEN** the summary banner displays "You're all settled up"

#### Scenario: Viewer not signed in

- **WHEN** the viewer is not signed in
- **THEN** no viewer summary banner is displayed (the sign-in prompt in the event header already covers this)

#### Scenario: Viewer signed in but not a participant

- **WHEN** the viewer is signed in but not linked to any participant in this event
- **THEN** no viewer summary banner is displayed

### Requirement: Summary banner links to settle-up

The viewer summary banner SHALL include a tap/click target that scrolls the viewport to the settle-up section.

#### Scenario: Tapping the summary on wide viewport

- **WHEN** the viewer taps the summary banner on a wide viewport where settle-up is in the sidebar
- **THEN** the settle-up section scrolls into view (or is already visible in the sticky sidebar)

#### Scenario: Tapping the summary on mobile

- **WHEN** the viewer taps the summary banner on a narrow viewport
- **THEN** the page scrolls to the settle-up section further down the single column

### Requirement: Layout preserves existing component behavior

The two-column restructure SHALL NOT alter the rendered output, interaction behavior, or data contracts of existing dashboard components (balance-list, settle-up-list, receipt-list, claim-requests, group-manager, delete-tab-button). Components move to different grid positions but their internal behavior is unchanged.

#### Scenario: Component parity

- **WHEN** the dashboard renders on any viewport width
- **THEN** every existing component renders the same content, accepts the same props, and handles interactions identically to the single-column layout
