## Purpose

Defines how Tab's interface is composed: recurring UI patterns are defined once as shared primitives, feature screens compose domain components instead of inlining them, money rendering follows one formatting discipline, and structural refactors never change what users see or interact with.

## ADDED Requirements

### Requirement: Shared UI patterns are single-sourced

The system SHALL define each recurring UI pattern — error note, labeled field, section heading, empty state, watermark, money input, and participant chip toggle group — exactly once as a shared primitive, and every screen that presents one of these patterns SHALL compose the shared primitive rather than re-implementing its markup.

#### Scenario: Inline error on any form

- **WHEN** any page or form needs to surface an error message
- **THEN** it renders through the shared error-note primitive (page-level and form-level variants) instead of hand-written red banner markup

#### Scenario: Participant selection in two places

- **WHEN** more than one feature needs toggleable participant chips (line-item assignees, even-split picker)
- **THEN** both use the same chip toggle-group primitive, varying only size/selection props

#### Scenario: Repeated heading pattern

- **WHEN** a screen renders a mono-labeled ruled section heading
- **THEN** the heading comes from the shared section-heading primitive

### Requirement: Money formatting discipline

All money values derived from integer cents SHALL be formatted for display through a single shared helper that produces US-dollar currency output (e.g., `$17.74`, thousands-separated); converting cents into editable decimal strings and parsing user-entered money strings SHALL each go through single shared helpers used by the expense editor and receipt flows.

#### Scenario: Dashboard amounts

- **WHEN** balances, transfer amounts, grand total, or receipt line items render on the event dashboard
- **THEN** every amount is produced by the shared display formatter with consistent currency formatting

#### Scenario: Editor prefill

- **WHEN** the edit-expense form loads stored cent values into string inputs
- **THEN** values are produced by the shared cents-to-string helper as exact two-decimal decimals

### Requirement: Domain components live outside route files

Feature screens SHALL be data-fetching-and-composition files: reusable blocks specific to a domain (event dashboard sections, expense editing, people picking, auth forms, marketing sections) SHALL live in their domain folder under the shared components directory rather than being defined inline in route files.

#### Scenario: Event dashboard page slimming

- **WHEN** the event dashboard route is read
- **THEN** it contains queries, ledger computation, and composition of named components — no inline section component definitions

#### Scenario: Landing page decomposition

- **WHEN** the landing route is read
- **THEN** hero, receipt stack, feature list, how-it-works, header, and footer come from named marketing components

### Requirement: Refactors preserve rendered output

Structural refactors to components SHALL NOT alter DOM structure, class names, visible text content, routing, or interaction behavior of any existing screen; variation between usages of a shared primitive SHALL be carried by explicit props, not divergent copies of markup.

#### Scenario: Extraction parity

- **WHEN** a component is extracted from a page into a shared or domain location
- **THEN** the server-rendered HTML of affected routes is unchanged compared to before the extraction

#### Scenario: Server/client boundary respect

- **WHEN** a primitive has no interactivity of its own (error note, field, section heading, empty state, watermark)
- **THEN** it remains usable directly inside server components without becoming a client component

### Requirement: Existing capabilities unaffected

This restructuring SHALL NOT change the behavior specified by existing capabilities — tab creation, expense splitting, receipt scanning, participant management, and event deletion continue to satisfy their current specs without modification.

#### Scenario: Regression gates

- **WHEN** the test suite, lint, and production build run after the restructure
- **THEN** all pass without test changes beyond import-path updates caused by file moves
