# Visual Project Portfolio Tool — Design Spec

**Status:** Design complete, all sections approved. Awaiting final review of the written spec.
**Date:** 2026-09-24

## 0. Purpose

A project management tool that is visual first. It has two main features:

1. **Project Management.** Create and manage projects, phases, requirements, resources, workload, meetings, updates, actions and attachments.
2. **Project Presentation.** Show the portfolio to stakeholders visually: dashboard, portfolio Gantt, focus on a single project, playback, and a what-if sandbox.

**The core problem it solves:** stakeholders don't see the history of a project. Delays get blamed on development when the real causes were change requests, holds (resources pulled to other projects), missing requirement information, or holidays. Stakeholders also can't see the price of a new requirement before they ask for it.

Feature 2 is the more important of the two, but it depends entirely on the data captured by Feature 1.

## Key decisions (from Q&A)

| Topic | Decision |
|---|---|
| Users / hosting | Single user (the PM), runs locally. No logins. |
| Form | Local web app: a small Node server plus a browser UI. Data lives in a local folder. |
| "Price" of a change | Time plus effort: date shifts, extra person-days by role, overloaded people. No money figures, which could be added later. |
| Cross-project ripple | Only through explicit links. Overloads **prompt a decision**: pause one project (creates a linked hold), delay a phase, split allocation, reassign, or accept the risk. Each decision is recorded as a dated event with its cause. |
| Baselines | Baseline 1 at kickoff, and a new baseline for every approved change request, with its cause attributed. |
| Progress | Manual % per phase. Expected % is calculated from working days elapsed, and the gap shows as a soft pace indicator. **"Late" only when the planned end passes without the phase finishing.** Early finish is allowed. |
| Effective dates | Every entry has an effective date (when it happened) separate from the date it was typed in. |
| Early or late finish | The tool asks each time whether to shift the phases that follow: Yes / No / Partially. Late finishes also ask for the cause of the slip. |
| Holidays | Individual dated entries or ranges, added whenever they are announced (no recurring rules). Adding one prompts to shift affected phases, and the cause is recorded as "Public holiday". |
| Playback | Works for a single project and for the whole portfolio year. |
| Tech stack | TypeScript throughout: React + Vite client, Node + Fastify server, SQLite (Drizzle), and a custom SVG Gantt renderer. |

## 1. Architecture and build order (APPROVED)

```
server/   Node + Fastify + SQLite (Drizzle ORM); REST API; uploads → attachments/; pm.db
shared/   Pure TypeScript engines (no UI or database), unit-tested:
          calendar · scheduler · capacity · baselines · timeline
client/   React + Vite
          gantt/    custom SVG Gantt renderer used by every view
          manage/   Feature 1 screens
          present/  Feature 2 screens
```

- The engines in `shared/` run the same way on real data and on sandbox data. The sandbox loads the real plan into memory, applies hypothetical changes and re-runs the engines. It never writes to the database.
- **Build order**, each with its own spec, plan and build cycle:
  1. Foundation and project management
  2. Portfolio presentation
  3. Playback
  4. What-if sandbox
- The data model covers all four from the start.
- This spec is the umbrella design. The first implementation plan covers **sub-project 1 only**. Sub-projects 2–4 each get a short follow-up spec that refines the relevant section here.

## 2. Data model (APPROVED)

**People and calendar**
- `Resource`: name, role (PM, tech lead, BA, developer, designer, QA, DB engineer, InfoSec, business owner), specialisation (front end, back end or full stack), email, capacity % (default 100), active flag.
- `Holiday`: name, start date, end date. `Leave`: resource, start date, end date. Weekend days are a setting.

**Projects**
- `Project`: the fields listed in §3.2, plus status (**proposed**, planned, active, on hold, done, cancelled) and a reference to its main project. *Proposed* projects come from the sandbox and are left out of capacity checks and the real portfolio until promoted to *Planned*.
- `MainProject`: name. Can be created inline.
- `ScopeItem`: project, kind (scope, out-of-scope, problem, objective), text, order, `addedByChangeRequestId` (nullable), date added.
- `Phase`: project, name, order, planned start and end, duration in working days, actual start and end, % complete, `parentId` (sub-phases are optional on **any** phase and one level deep), weight.
- **Requirement fields** (on sub-phases under development): source (original or added later), date received, linked change request, linked scope item, readiness (incomplete or ready), start-at-risk flag and reason.
- `RequirementEvidence`: requirement, then **either** an attachment **or** an entry (a meeting), plus a confirmation date. A requirement can have several pieces of evidence. Readiness counts from the earliest one.
- `Assignment`: phase, resource, allocation %, role (responsible or contributor).

**History (feeds the presentation)**
- `Entry`: type (meeting, update, action-only), project, optional phase, **effective date**, created date, title, body, **highlight-in-presentation** flag. Has 0..n attachments.
- `Action`: source entry, assignee, due date, status, linked phase or requirement, tag (for example *Clarification*).
- `Attachment`: file, name, **type** (editable list: Meeting Minutes, Approval, Change Request, Business Analysis Document, BRD, Documentation, Design, Test Report, Other), entry (optional), phase, deliverable date.
- `Event`: machine-recorded history, append-only. Types: phase started or finished, hold started or ended, change request proposed, approved or rejected, requirement added, requirement ready, date shifted, overload resolved, holiday applied. Each has an effective date, a **cause**, **delay days** (signed: negative means time saved; these feed Where did the time go? and Why did the end date move?), responsibility, and optional links (other project, change request, holiday, resource).
- `Hold`: project, start date, end date, reason, **receiving project**.
- **Responsibility** (on change requests, requirements, holds, slip causes, waiting periods, and the delay days of each `Event`): one or more of **Technical team · Business user · Decision makers · External** (list editable in Settings), plus Calendar (automatic, for holidays only). When several parties share responsibility, delay days are split evenly by default and the split can be adjusted. Defaults: change request, requirement and waiting period → Business user; hold → Decision makers; holiday → Calendar; late-phase cause → chosen in the prompt.
- `Milestone`: either a ⭐ flag on a phase or requirement end, with a stakeholder-friendly name, or a standalone milestone (date and name, no duration). A flagged milestone's date follows the plan automatically.
- `ChangeRequest`: project, requested by, description, extra days by role, status (proposed, approved, rejected), approval attachment.
- `Baseline`: a numbered snapshot of all phase dates. Created at kickoff and for each approved change request.
- `ProjectLink`: finish-to-start dependency between phases in different projects.

**Past and future projects**
- *Planned* projects have no actuals. They count in "scheduled this year" and take part in overload checks.
- *Past* projects use **record-history mode**: enter the original plan (which becomes Baseline 1), the actual dates, and any holds, change requests and documents with their real dates. Decision prompts are switched off because each item is recorded as the event that already happened. Projects already in progress use this mode for their past, then normal mode from today.
- Sandbox scenarios are not saved unless the user chooses "Save as proposed change request".

## 3. Project management screens (APPROVED)

### 3.1 Landing page
Two tiles: **Project Management** and **Project Presentation**.

### 3.2 Create project wizard
**Step 1: Basic info and classification**
- Project name, Jira key (reference text, no integration), colour, priority, project manager, business owner (person).
- Main project: Standalone, or Part of a main project (dropdown, with **+ Add new** inline).
- Categorisation: Strategic / Operational.
- Project type: Criminal / Customer / Management. **"Other" adds a new value to the list.**
- Goal: "Digitalisation of internal operations" / Other. **"Other" adds a new value to the list.**
- Requester: checkboxes, **Internal** and **External** (both ticked means Both).
- Business user (department): dropdown with **+ Add new** inline.
- Beneficiary: checkboxes, **Employees** and **Customers**.
- Every list can be edited in Settings.

**Step 2: Description and scope**
- Background and summary (free text).
- Tables for **Scope**, **Out of scope**, **Problem statements** and **Objectives**. Each works the same way: type an item, click Add, and it is auto-numbered. Rows can be edited, deleted and reordered by dragging. There is no limit on rows.
- Scope items added by an approved change request are tagged "Added by CR-x (date)", which drives the scope growth views.

**Step 3: Phases.** Ordered phases with durations in working days. End dates are calculated from the working calendar. Optional sub-phases on any phase. Live Gantt preview.

**Step 4: People.** Assign resources to phases with an allocation %. Overload warnings appear immediately.

**Step 5: History.** Only shown if any dates are in the past (record-history mode).

Saving creates Baseline 1.

### 3.3 Dashboard
- Tiles: active, on hold, planned, overdue phases, open actions, overloaded people, **requirements waiting for information**, **unapproved work in progress**.
- Mini portfolio Gantt chart. Project table: name, Jira key, PM, status, current phase, %, pace, baseline end vs current end.
- **"Needs your decision" inbox**: overloads, overdue phases without a cause, early or late finishes, holiday shifts.

### 3.4 Project page
- Header: status, pace, baseline end vs current end.
- Actions: Add meeting, Add update, Upload attachment, Record hold, Change request, Update progress.
- **Gantt chart as the centrepiece.** Clicking a bar opens a **slide-in side panel** with a chronological, collapsible timeline (grouped by week or type) of the phase's entries, actions and attachments.
- Tabs: Timeline, Attachments (filter by type or phase), Actions, **Requirements**, Change requests, Baselines.

### 3.5 Requirements (development sub-phases)
- Each requirement has: source (Original scope / Added later), date received, progress 0–100%, readiness.
- Date received: for original scope it is taken automatically from the approval date of the BRD, BA document or approval attachment on the analysis phase (can be overridden). For added later it is the date of arrival, or the change request date.
- **Development % rule:** only *counted* requirements share the 100% weight. Counted means original scope, plus requirements added later **with an approved change request**. Weights default to each requirement's share of working days, and can be set by hand. Requirements without approval are tracked but have zero weight. When a change request is approved, its requirements join the counted set, the weights rebalance, and a new baseline is created.
- Work in progress on a requirement with no approved change request is flagged as **"unapproved work in progress"**.
- Summary line on the Requirements tab: original count and days vs added-later count and days (+%).
- The Gantt chart marks requirements added later with an orange edge and tag.

### 3.6 Requirement readiness
- Status is **Incomplete** (the default) or **Ready**.
- **Mark ready** requires linking at least one piece of evidence: an **attachment** or a **meeting entry**. More evidence can be added later.
- While a requirement is incomplete:
  - Clarification questions are Actions tagged *Clarification*.
  - A waiting clock runs from the date received. It turns amber after 14 days and red after 30; both thresholds are configurable.
  - Development is locked. **Start at risk** overrides the lock but requires a reason and stays flagged.
- If the planned start passes while the requirement is still incomplete, the slip cause is set automatically to **"Waiting on requirement information"**.

### 3.7 Resources page
- A simple table with add and edit, filtered by role.
- A **workload heatmap** of people by weeks, coloured by allocation %. Clicking a cell shows the conflict and opens the decision prompt.

### 3.8 Actions page
All actions across projects, filtered by assignee (including "Mine") and sorted by due date.

### 3.9 Settings
Weekend days, holidays, attachment types, roles, dropdown lists, and waiting-clock thresholds.

## 4. Presentation screens (APPROVED)

All read-only. The only exception is saving a sandbox scenario as a *proposed* change request.

### 4.1 Presentation dashboard
- Tiles: active, finished this year, scheduled to start this year, on hold, waiting for business input. Year selector.
- **Where did the time go?** One bar showing all delay days for the selected year, with a toggle between **By cause** (change requests, holds, waiting for information, holidays, team slips) and **By responsibility** (Business user, Decision makers, Technical team, External, Calendar). Days come from recorded `Event`s, so each day is counted once. Time saved by early finishes counts as negative. Clicking a segment breaks it down by project and by the other dimension.
- **Upcoming milestones:** next 30, 60 or 90 days, showing each milestone's current date, original date and a "moved +Nd" note that links to the project's "Why did the end date move?" chart.

### 4.2 Portfolio Gantt chart
Every project in parallel, grouped by main project with summary bars. **Hold bars are hatched, with an arrow to the project that received the resources** (labelled, e.g. "3 devs"); arrows stay faint until hovered. Dependency arrows. Filters: all, hand-picked, by main project, department, category or status.

### 4.3 Focus mode (one project)
- The phase and requirement Gantt chart with dashed baseline outlines, added-later markers, grey "waiting for business input" segments, hold bars and ⭐ milestones.
- Clicking anything opens a read-only side panel that shows only highlighted entries.
- **Why did the end date move?** A step (waterfall) chart that goes from the original end date to the current end date. Each step is one event, shown with its cause, days and responsible-party tag; steps that saved time appear in green. Clicking a step opens its evidence. During playback the chart builds itself step by step.
- Scope tab: original vs added scope, plus the requirements table.

### 4.4 Project health
- Measured **against the currently agreed baseline**, not the original one.
- 🔵 **On track:** within tolerance (configurable, default 5%).
- ⚪ **Adjusted by decision:** moved because of a hold or decision that hasn't been through a change request yet. Neutral grey, with the reason shown.
- 🟠 **Needs attention:** a slip caused by the technical team, or not yet explained, beyond the tolerance.
- 🔴 **Only for "decision needed from stakeholders"**, for example a change request waiting for approval, or a requirement waiting for information for more than 30 days.

### 4.5 Export and presenter mode
- **Export to PDF:** portfolio Gantt chart, Where did the time go?, and focus view.
- **Presenter mode:** full screen, large text, no internal details (routine updates and unflagged entries are hidden).
- **Not included:** a team capacity view for stakeholders. Capacity stays on the project management side.

## 5. Playback, sandbox, errors and testing (APPROVED)

### 5.1 Playback
- **Mechanism:** the `timeline` engine merges events, highlighted entries, baselines and actual dates into one ordered stream. What the screen shows at a date is calculated directly as `state(date)`, so moving the timeline slider or jumping to a date is immediate and gives the same result every time.
- **Visual style (option B):** the baseline plan appears as dashed outlines from the start, and the actual bars fill in over them as time advances. Anything past the planned end (from the baseline in effect at that date) turns red. When a change request is approved, the outlines move (re-baseline). Hold arrows draw themselves at the moment of the hold. The "Why did the end date move?" chart builds step by step alongside.
- **Range:** a single project plays from its start to its end, or to today. The portfolio plays the selected year, January to December. After today, the playhead stops and the rest of the year shows as plan only (dashed outlines).
- **Pop-ups:** icon, date, title, one line of detail, a responsible-party tag, and a clickable line for each linked document. Clicking a document pauses playback and opens the in-app viewer (PDFs and images preview in the app; other files open in their default program). Pop-ups then collapse into pins.
  - A single project pops up every highlighted event and auto-pauses on change requests, holds, and phase starts or ends.
  - The portfolio pops up and auto-pauses only on change requests, holds and milestones. Phase changes show as pins, and no more than 3 pop-ups are on screen at once.
- **Controls:** play/pause, previous and next event, speed (default 1 week per second), timeline slider, auto-pause toggle.

### 5.2 What-if sandbox
- Opened from focus view or the portfolio. It runs the real engines on an **in-memory copy** and never writes to the database.
- **Stackable hypothetical changes**, each of which can be undone on its own:
  - add a requirement (days by role)
  - extend a phase
  - add a hold
  - move a start date
  - move a resource
  - **add a hypothetical project**
- **Hypothetical project:** name, optional main project, priority, start date, and phases with working days (optional sub-phases). Shown as a ghost row on the portfolio chart, and built live.
- **Anonymous resources:** stakeholders see role labels only ("Backend Dev 1"), never names, and the labels stay the same for the session. When a role is assigned to a phase, the picker lists everyone in that role, sorted by availability over the phase's dates:
  - 🟢 free for the whole phase
  - 🟡 free at first, then booked on another project from a date
  - 🔴 busy on another project
- **Conflicts:** choosing 🟡 or 🔴 brings up the standard decision prompt: delay the new project, delay the other project, pause the other project (hold plus arrow), or split time. Each decision updates the portfolio immediately, and can expose further conflicts that are handled the same way.
- **Resource pool strip:** one anonymous, summarised line per role under the chart (for example, "1 of 3 free, Mar–Apr"). Sandbox only.
- **Display:** a ghost overlay, with the current plan as dashed outlines, the simulated plan as solid bars, and red "+Nd" labels. Bars slide into place when a change is applied.
- **Price tag panel:** new go-live dates, extra effort by role, knock-on effects on other projects, and overloads.
- **Save:**
  - "Save as proposed change request" creates a *proposed* change request.
  - "Save as proposed project" creates a project with status *Proposed*.
  - Approval or promotion happens **only in project management**.
  - **Reset** discards everything.

### 5.3 Errors and data safety
- A daily automatic backup of `pm.db` goes to `backups/`, keeping the last 14. Attachment files are never overwritten.
- History is never silently rewritten. Edits to recorded events are themselves logged. Deleting an attachment or entry that is used as evidence or linked to a change request brings up a warning first.
- Validation:
  - sub-phase weights must total 100% (weights are set automatically unless you set them by hand)
  - circular dependencies between projects are blocked with a message naming the cycle
  - the end date must not be before the start date
  - a requirement cannot move past 0% while it is Incomplete, unless Start at risk is used
- A failed upload shows a retry and never leaves a half-saved entry. Each save is one database transaction.

### 5.4 Testing
- **Engines** (calendar, scheduler, capacity, baselines, timeline): thorough Vitest unit tests using realistic scenarios, for example a hold during Eid while a change request is approved.
- **API:** integration tests against a temporary SQLite database.
- **End-to-end** (Playwright, a small number): create a project → record a hold → the portfolio shows the arrow → playback runs.
- **Built-in demo portfolio**, with holds, change requests, waiting requirements and a completed historical project, used for tests and for rehearsing presentations.

## 6. Out of scope (for now)
- Money or cost figures (these could be added later from rates per role).
- Multiple users, logins and hosting.
- Jira integration. The Jira key is a reference field only.
- Automatic resource levelling. Every schedule shift is a human decision.
- Team capacity views for stakeholders.
