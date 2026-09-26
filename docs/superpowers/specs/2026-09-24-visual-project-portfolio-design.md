# Visual Project Portfolio Tool — Design Spec

**Status:** Design complete, all sections approved. Awaiting final review of the written spec.
**Date:** 2026-09-24

## 0. Purpose

A project management tool that is visual first. It has two main features:

1. **Project Management.** Create and manage projects, phases, requirements, resources, workload, meetings, updates, to-dos and attachments.
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
| Confirming done (M8, user 2026-09-26) | **Every phase and sub-phase must be confirmed as done**; reaching 100% alone does not finish it. **Mark done** asks for the date it was really finished: **today**, or **an earlier date**, because the work may have finished on time and only been recorded late. That date is the actual end: it drives early/late detection and the stakeholder charts, and a phase finished on time but recorded late is not counted as late. A phase with sub-phases is done when its last sub-phase is confirmed, with that date. |
| Lateness warnings (M8, user 2026-09-26) | Four kinds, on the dashboard ("Needs your decision"), the project page and the phase side panel: **(1) Overdue:** a phase's planned end has passed and it is not confirmed done; it asks for the reason (cause and responsibility) and a new expected end date. **(2) Behind schedule:** % complete is clearly behind the working time used (for example 70% of the time gone and 40% done; the gap threshold is a setting), so the warning comes before the date passes, and the reason can be recorded then. **(3) Project end at risk:** from the slips so far, the likely project end date is worked out and compared with the committed end date; the warning says how many working days late and which recorded reasons caused them. **(4) Reminder before the end:** a set number of days (default 14, a setting) before each phase's and the project's planned end, whatever the progress. |
| Effective dates | Every entry has an effective date (when it happened) separate from the date it was typed in. |
| Early or late finish | The tool asks each time whether to shift the phases that follow: Yes / No / Partially. Late finishes also ask for the cause of the slip. |
| Holidays | Individual dated entries or ranges, added whenever they are announced (no recurring rules). Adding one prompts to shift affected phases, and the cause is recorded as "Public holiday". |
| Playback | Works for a single project and for the whole portfolio year. |
| Tech stack | TypeScript throughout: React + Vite client, Node + Fastify server, SQLite (Node's built-in `node:sqlite` with plain SQL and numbered migrations), and a custom SVG Gantt renderer. |

## 1. Architecture and build order (APPROVED)

```
server/   Node + Fastify + SQLite (node:sqlite, plain SQL); REST API; uploads → attachments/; pm.db
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
- **Arabic first (user decision, 2026-09-26).** The app is used mostly in Arabic. From M6, every milestone ships every piece of new text in both Arabic and English, and each checkpoint includes an Arabic review by the user. See §8.
- **Delivery principles (roadmap review, 2026-09-25).** The build runs as milestones M1–M16 (the roadmap table lives in the M1–M2 plan). Each one:
  - ends with something new to try on **both** sides where it makes sense, a management screen and what stakeholders see, and extends the **demo portfolio** so the new feature has real-looking data to test;
  - records history completely from the moment a feature exists. Every date change is an `Event` with its cause, delay days, responsibility and the dates before and after (from M8). History that was never recorded can't be rebuilt later for playback or the charts;
  - lets its own items be **recorded with a past date** (record-history mode), with no decision prompts for past-dated items, rather than leaving all of record-history to one late milestone;
  - grows the stakeholder charts. **Why did the end date move?** and **Where did the time go?** first appear in M8, with late finishes and holidays, and each later milestone adds its own cause: holds in M11, change requests in M9, and waiting for requirement information in M9.

## 2. Data model (APPROVED)

**People and calendar**
- `Resource`: name, **side** (Tech team or Business side), role, specialisation (front end, back end or full stack), email, phone (UAE mobile), capacity % (default 100), active flag. Roles are an editable list (Project manager, Tech lead, Business analyst, Developer, Designer, QA, DB engineer, InfoSec). **Business-side people (M4 decision, 2026-09-25)** are contacts, such as a project's business PM: they have a phone and email but no role, specialisation or capacity, are never assigned to phases and are not counted in workload. A person in use is made inactive rather than deleted. **Outsourced people (M7, user 2026-09-26):**
- A tech-team person is **Our team** or **Outsourced**. An outsourced person has a company (an editable list), the project they're hired for, and engagement start and end dates.
- They can be assigned to phases while engaged, but aren't counted in the workload heatmap.
- Resources shows them in their own section while engaged, and archives them in a collapsed "Past outsourced" list once their engagement ends. They're never deleted.

**Person documents (M7):**
- Each person keeps their own documents: NDA, police clearance, UAE ID, passport, company contract, information security approval, and others. The types are an editable list.
- Each document has an optional expiry date. The person's page and the dashboard warn 30 days before it expires, and mark expired documents.
- Person documents are private: they never appear on the presentation side.

**Accounts, residence and company (M7, user 2026-09-26):**
- Each person's **work accounts** (network, email, VPN, Jira and others, an editable list) have an expiry date and a reminder lead (default 30 days, set per account) because renewal can take weeks. The person page and the dashboard remind the user when it is time to apply for renewal, and mark expired accounts.
- A tech-team person **lives in the UAE or abroad**. Information only.
- **Our own team members can be contracted through a company** (optional); outsourced people must have one.

**Key dates (M7, user 2026-09-26):**
- A project keeps its **key dates**: contract end, license expiry, development end, warranty end, support end, and others. The types are an editable list.
- Uploading a **Contract** asks for its key dates (the end date first, then any more). A key date can also be added without a file.
- They show on the project's Details tab, soonest first. Each turns amber 30 days before and red once passed, and the dashboard reminds about dates that are soon or recently passed.
- Private to project management: never on the presentation side.
- `Holiday`: name, start date, end date. `Leave`: resource, start date, end date. Weekend days are a setting.

**Projects**
- `Project`: the fields listed in §3.2, plus status (**proposed**, planned, active, on hold, done, cancelled) and a reference to its main project. *Proposed* projects come from the sandbox and are left out of capacity checks and the real portfolio until promoted to *Planned*.
- `MainProject`: name. Can be created inline.
- `ScopeItem`: project, kind (scope, out-of-scope, problem, objective), text, order, `addedByChangeRequestId` (nullable), date added.
- `Phase`: project, name, order, planned start and end, duration in working days, actual start and end, % complete, `parentId` (sub-phases are optional on **any** phase and one level deep), weight. **Sub-phases arrive in M5 (M4 review, 2026-09-25)**, moved forward because nothing else they need comes later. They break a phase into named pieces (such as a development phase's 20 increments), each with its own working days inside its parent. **Sub-phases may run at the same time** (user decision, 2026-09-25): by default a new sub-phase starts after the previous one, and it can be set to start with another instead. It is not expected to be used often, but the flexibility is there. The parent phase spans from its first sub-phase's start to its last sub-phase's end. **On a Gantt chart (M5 review, 2026-09-25), a phase with sub-phases stays one bar, divided into its sub-phases.** Thin dividers separate the pieces, and each piece carries its name where it fits. Only sub-phases that run at the same time as another drop onto an extra row directly under the phase, and only as many rows as the overlap needs. Hovering over a sub-phase (or tapping it on a phone) shows its details: its name as "Phase › Sub-phase", its dates, its working days and the people on it. From M8, each phase and sub-phase also fills from the left in a darker shade of its colour as its % complete grows, and the details show the percentage. People can be assigned to a sub-phase as well as to a whole phase, so a person's page and the workload panel say exactly what they are on ("Case Management › Development › Increment 7 – Payment gateway"). Sub-phase weights, the development % rule and requirement fields on development sub-phases come in M9.
- **Phases can be edited after a project is created from M5.** Adding sub-phases to an existing project needs this. You can add, remove, reorder and resize phases and sub-phases. Before Baseline 1 exists this simply changes the plan. From M8, a change to a project that has started is recorded as an `Event`, with its cause.
- **Phase colour (post-M1-demo feedback, 2026-09-24):** not a field on `Phase`. Every Gantt bar is coloured from a **fixed palette keyed by the phase's name** (normalised: trimmed, case-insensitive) — "Requirements" is always the same colour, "Development" is always another, "UAT" another, and so on — shared across every project and every screen (project page, wizard live preview, portfolio, focus view). A set of standard phase names (Requirements, Analysis, Design, Development plan, Development, Testing/QA, UAT, Security testing, Deployment, Launch — with Go-live as an alias of Launch) is mapped to a 10-colour palette up front, neighbouring lifecycle phases getting clearly different hues; a phase named something else still gets a colour, deterministically derived from its name so the same custom name always lands on the same colour everywhere, without needing a name registry. A project's own `colour` (§3.2 Step 1) plays no part in this — it identifies the project elsewhere (lists, tags), not its phase bars.
- **Requirement fields** (M9, on sub-phases under development): source (original or added later), date received, linked change request, linked scope item, readiness (incomplete or ready), start-at-risk flag and reason.
- `RequirementEvidence`: requirement, then **either** an attachment **or** an entry (a meeting), plus a confirmation date. A requirement can have several pieces of evidence. Readiness counts from the earliest one.
- `Assignment`: phase, resource, allocation %, role (responsible or contributor).

**History (feeds the presentation)**
- `Entry`: type (meeting or update), project, optional phase, **effective date**, created date, title, body, **highlight-in-presentation** flag. Has 0..n attachments.
- `ToDo` (named **To-do** everywhere; the word "action" is not used for it, to avoid confusion): project, title, optional note, assignee, optional due date, status (open or done, with the date it was done), optional link to a phase, sub-phase or requirement, optional source meeting entry, optional tag (for example *Clarification*). The assignee is **me** (the PM using the tool) or anyone on that project: a tech-team person assigned to one of its phases, or either project manager, business-side contacts included. **To-dos are private to project management.** They never appear on the presentation side, in presenter mode, in PDF exports or in playback, and they do not count in workload.
- `StarterToDo`: a phase name, then a title. It is an optional checklist kept in Settings (see §3.9).
- `Attachment`: file, name, **type** (editable list: Meeting Minutes, Approval, Change Request, Business Analysis Document, BRD, Documentation, Design, Test Report, Other), entry (optional), phase, deliverable date.
- `Event`: machine-recorded history, append-only. Types: phase started or finished, hold started or ended, change request proposed, approved or rejected, requirement added, requirement ready, date shifted, overload resolved, holiday applied. Each has an effective date, the **dates before and after** for anything that moved, a **cause**, **delay days** (signed: negative means time saved; these feed Where did the time go? and Why did the end date move?), responsibility, and optional links (other project, change request, holiday, resource).
- `Hold`: project, start date, end date, reason, **receiving project**.
- **Responsibility** (on change requests, requirements, holds, slip causes, waiting periods, and the delay days of each `Event`): one or more of **Technical team · Business user · Decision makers · External** (list editable in Settings), plus Calendar (automatic, for holidays only). When several parties share responsibility, delay days are split evenly by default and the split can be adjusted. Defaults: change request, requirement and waiting period → Business user; hold → Decision makers; holiday → Calendar; late-phase cause → chosen in the prompt.
- `Milestone`: either a ⭐ flag on a phase or requirement end, with a stakeholder-friendly name, or a standalone milestone (date and name, no duration). A flagged milestone's date follows the plan automatically.
- `ChangeRequest`: project, requested by, description, extra days by role, status (proposed, approved, rejected), approval attachment.
- `Baseline`: a numbered snapshot of all phase dates. **Baseline 1 is created when a project is saved, from M8.** Projects that already exist then get theirs from their plan as it stands, and past projects get theirs from the original plan entered in record-history mode. A new baseline is created for each approved change request (M9).
- `ProjectLink`: finish-to-start dependency between phases in different projects.
- **Follow-on projects (M11):** `Project.followsProjectId` points at the project this one continues, for example a new phase of a launched project. See §3.10.

**Past and future projects**
- *Planned* projects have no actuals. They count in "scheduled this year" and take part in overload checks.
- *Past* projects use **record-history mode**: enter the original plan (which becomes Baseline 1), the actual dates, and any holds, change requests and documents with their real dates. Decision prompts are switched off because each item is recorded as the event that already happened. Projects already in progress use this mode for their past, then normal mode from today.
- Sandbox scenarios are not saved unless the user chooses "Save as proposed change request".

## 3. Project management screens (APPROVED)

### 3.1 Landing page
Two tiles: **Project Management** and **Project Presentation**.

### 3.2 Create project wizard
**Step 1: Basic info and classification**
- Project name, Jira key (reference text, no integration), colour (identifies the project in lists and tags — phase bars use the shared per-phase palette, see §2), priority.
- **People (post-M3-demo feedback, 2026-09-25):** every project has **two project managers** who run it together:
  - **Project manager (tech)** — from the technical team (the user's side).
  - **Business project manager** — the business owner's representative, with an optional **UAE mobile** (accepts +971 / 00971 / 971 / 0 in front of 5X XXX XXXX, with spaces or dashes; stored and shown as `+971 5X XXX XXXX`) and an optional **email**. Name, phone and email are each optional.
  - **Business owner** is the **Business user (department)** below, i.e. the department that owns the business side. There is no separate business-owner field.
  - From M4 both PMs are **chosen from Resources**: the tech PM from the tech team, the business PM from business-side contacts, whose phone and email live on their Resources entry. "+ Add new person…" adds someone inline.
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

**Step 3: Phases.** Each phase name is **chosen from a dropdown** over an editable **Phases** list (Settings), with **"Other…"** adding a new name to the list (post-M3-demo feedback, 2026-09-25). New projects start with nine phases: **Requirements gathering, Business analysis, Development plan, Development, QA, UAT, Security testing, Deployment, Launch**. "Design" stays in the list for projects that need it but is not a default. Ordered phases with durations in working days, **reordered by dragging** the row (post-M1-demo feedback, 2026-09-24 — not up/down buttons, to keep it to one motion). End dates are calculated from the working calendar and recompute immediately when the order changes. Optional sub-phases on any phase. Live Gantt preview: each bar is coloured by the shared, name-keyed palette (§2) — renaming a phase to a recognised name (e.g. typing "UAT") updates its colour live — and shows the **phase name written on the bar itself**, hidden only when the bar is too narrow to fit it.

**Step 4: People.** Assign tech-team people to phases with an allocation % (1–100) and a role (responsible or contributor). Overload warnings appear immediately. The same editor is on the project page, where people can be changed at any time.

**Step 5: History.** Only shown if any dates are in the past (record-history mode). From M8 it takes the original plan and the actual dates. Holds, change requests and documents with their real dates are recorded on the project page as each of those features arrives.

Saving creates Baseline 1.

### 3.3 Dashboard
- Tiles: active, on hold, planned, overdue phases, open to-dos, overloaded people, **requirements waiting for information**, **unapproved work in progress**.
- Mini portfolio Gantt chart. Project table: name, Jira key, PM, status, current phase, %, pace, baseline end vs current end.
- **"Needs your decision" inbox**: overloads, overdue phases without a cause, early or late finishes, holiday shifts.
- **My next steps (M5):** your open to-dos across all projects, overdue ones first and in red.

### 3.4 Project page
- Header: status, pace, baseline end vs current end.
- Buttons: Add to-do, Add meeting, Add update, Upload attachment, Record hold, Change request, Update progress, **Create follow-on project**.
- **My next steps (M5):** a card with your three most urgent open to-dos on this project. It was first called "Next up"; the user asked for the dashboard's wording (2026-09-26).
- **Project family (M11):** when a project follows another or has follow-ons, a strip shows the chain, e.g. "Case Management (launched Mar 2026) → Case Management Phase 2 (planned)".
- **Gantt chart as the centrepiece.** Clicking a bar opens a **slide-in side panel** with a chronological, collapsible timeline (grouped by week or type) of the phase's entries, to-dos and attachments.
- Tabs: Timeline, Attachments (filter by type or phase), To-dos, **Requirements**, Change requests, Baselines.
- **M7 decisions (user, 2026-09-26):**
  - **Tabs:** the project page's sections move into tabs: History (the spec's "Timeline" tab, renamed so it isn't confused with the Gantt chart's Timeline), To-dos, People, Attachments and Details. The chart and My next steps stay above them.
  - **Meetings** hold attendees (anyone in Resources) and can create follow-up to-dos.
  - **Uploads:** any file type up to 50 MB. PDFs and images preview in the app.
  - **Clicking a phase or sub-phase bar** opens a side panel from the inline end with that phase's history. It is read-only, and shows highlighted entries only, in the focus view.

- **Gantt readability (M5 review, 2026-09-25):**
  - Years sit on their own row above the months, so labels never run into each other.
  - Timeline charts use the full page width, not the narrow centre column.
  - A single project's chart (the project page, the wizard preview and the focus view) also shows **work-week lines**. Each work week is marked by its last working day, the Friday with the default weekend, so the line and its date ("11", "18", "25") fall on Friday and never on Saturday or Sunday. It also shows each bar's **exact dates** beside it, e.g. "8 Sep – 19 Sep".
  - The portfolio chart keeps months only, because it covers a whole year.
- **Reordering handles are clearly visible** (M5 review): the grip button has a visible icon, border and hover state, and a grab cursor. Dragging also works with a finger on a phone.
- **People's names on to-dos link to their page** (M5 review), wherever a to-do is shown.

### 3.5 Requirements (development sub-phases)
- Each requirement has: source (Original scope / Added later), date received, progress 0–100%, readiness.
- Date received: for original scope it is taken automatically from the approval date of the BRD, BA document or approval attachment on the analysis phase (can be overridden). For added later it is the date of arrival, or the change request date.
- **Development % rule:** only *counted* requirements share the 100% weight. Counted means original scope, plus requirements added later **with an approved change request**. Weights default to each requirement's share of working days, and can be set by hand. Requirements without approval are tracked but have zero weight. When a change request is approved, its requirements join the counted set, the weights rebalance, and a new baseline is created.
- Work in progress on a requirement with no approved change request is flagged as **"unapproved work in progress"**.
- Summary line on the Requirements tab: original count and days vs added-later count and days (+%).
- The Gantt chart marks requirements added later with an orange edge and tag.
- **Requirements from meetings (M9, user 2026-09-26):** a meeting can record the **requirements raised** in it. Each one keeps the meeting as its source and the meeting's date as its date received, and the meeting lists the requirements it raised.
- **Requirements bank (M9, user 2026-09-26):** a requirement that comes in during the project goes first into the project's **requirements bank** (بنك المتطلبات), whether it is within scope or out of scope, so it can be scheduled later, sent for approval, or turned into a change request. From the bank it is later **scheduled** into the plan (a development sub-phase, or an existing one), or declined and kept for the record. Each banked requirement is classed:
  - **Within scope:** it details something already agreed. Scheduling it needs no approval.
  - **Out of scope:** new work. It can be scheduled only with a change request (one click drafts one); until the change request is approved it counts as unapproved work.
  - **Not decided yet:** recorded now and classed later.
- **The bank's first version (user, 2026-09-26; with change requests in M9):** add a requirement from a meeting (linked back, the meeting's date as its date received) or directly in the bank; class it (within scope / out of scope / not decided) and track its status (**In the bank, Waiting for approval, Approved, Scheduled, Declined**), with filters and sorting on both; schedule it onto a phase or sub-phase, or create a new sub-phase for it (out of scope only after its change request is approved); and the two Gantt marks above.
- **Three looks on the Gantt chart (M9, user 2026-09-26):** original requirements look as they do today; a requirement **added later within scope** has its own mark (for example a blue edge and tag, "added later"); a requirement **out of scope, added with a change request** has a different mark (the orange edge and a CR tag, "change request"). The hover details and the legend name each one, so stakeholders can see which work came in later and why.

### 3.6 Requirement readiness
- Status is **Incomplete** (the default) or **Ready**.
- **Mark ready** requires linking at least one piece of evidence: an **attachment** or a **meeting entry**. More evidence can be added later.
- While a requirement is incomplete:
  - Clarification questions are to-dos tagged *Clarification*.
  - A waiting clock runs from the date received. It turns amber after 14 days and red after 30; both thresholds are configurable.
  - Development is locked. **Start at risk** overrides the lock but requires a reason and stays flagged.
- If the planned start passes while the requirement is still incomplete, the slip cause is set automatically to **"Waiting on requirement information"**.

### 3.7 Resources page
- A simple table with add and edit, filtered by side and role.
- **Projects column, sorting and a "Working on" filter (M4 review, 2026-09-25).** The People table has a **Projects** column listing the projects each person is on: a phase they are assigned to, or a project they manage (tech or business PM). Only projects where that work has not finished yet are listed (a phase counts until its planned end; a PM role until the project's last phase ends). A person with nothing current keeps the project they finished most recently, shown muted with "finished", so they still group with that team. Nothing at all shows "—". **Every column header is clickable to sort**, and clicking again reverses the order; the Projects column sorts by the project names, so people on the same project sit together. A **Working on** filter picks one project and shows everyone on it, including people who are also on other projects.
- A **workload heatmap** of people by weeks (Monday to Sunday), coloured by how much of each week is booked. Booked % = each assignment's allocation × the working days it covers that week ÷ the week's working days. Available % = capacity reduced by leave days. A week is overbooked when booked is more than available. Clicking a cell shows the conflict and opens the decision prompt.
- **Decision prompt (M4):** Split the time, Reassign work (with each person's load that week shown), or Accept the risk (with an optional reason); each is recorded as a dated event. Pause a project and Delay a phase are shown but switch on later: Delay a phase with progress and phase shifts (M8), and Pause a project with holds (M11). An accepted overbooking stays visible in its own style and no longer counts in the dashboard warning.
- Personal **leave** (dates and an optional note) is kept per person on their page; leave days reduce what they can give that week.
- **Days / Weeks switch (M4 second review, 2026-09-25).** In review, the one-column-per-week layout read as one column per day, and the thin strip of day slices was too small to see. So Fatima's full week of leave still looked like a single day. The heatmap now has a **Days | Weeks** switch above it. **Days** is the default, and the choice is remembered on this device.
  - **Days view:**
    - Every working day is its own block. Five blocks sit under each week heading ("12–16 Oct"), with a row of day letters and dates (M 12, T 13, …).
    - Four weeks (20 days) are shown at a time; the arrows move one week.
    - A day is coloured by that day's own load: booked % = the total allocation of the person's assignments that cover the day; available % = their capacity, or 0 on a leave day.
    - Leave days are striped and say "Leave", so Fatima's 12–16 Oct shows five striped blocks and Jonas's 19–21 Oct shows three. Public holidays (M8) will cover their days the same way, in their own style.
    - A day is red when its booked % is more than its available %. A red day inside a week that is not overbooked overall still shows red, because it is a real clash on that day. The panel explains it, but it does not count in the dashboard notice, which stays weekly.
    - Clicking any day opens that week's panel, so Split, Reassign and Accept work as before. In a week whose overbooking was accepted, the overbooked days show the accepted style, and the other days keep their normal colour.
  - **Weeks view:**
    - One block per week, for looking further ahead (13 weeks). The column heading reads "Week 42" over "12–16 Oct".
    - Each cell shows the week's booked %, plus a row of five clearly visible day squares, with leave days striped.
    - The arrows move four weeks.
- **Weeks and dates show the day of the week (M4 review, 2026-09-25).** People work Monday to Friday, so a week is labelled by its working days, not just its Monday: the heatmap column reads "Mon 12 Oct – Fri 16 Oct", and the decision prompt, the overbooking warnings ("Mon 5 Oct – Fri 9 Oct: 150% booked, 100% available") and the dashboard notice use the same label. The first and last working day come from the calendar in Settings. The decision prompt names the leave that falls in that week by its days ("On leave Mon 12 Oct – Fri 16 Oct · Annual leave"), and a person's leave list shows the weekday on each date plus the number of working days it covers.

### 3.8 To-dos (M5)
- **Where they are added:**
  - from the project page, with Add to-do;
  - from a phase's side panel, which links the to-do to that phase;
  - from a meeting while writing it up (M7).
- **The To-dos page** shows every to-do across projects, filtered by project and by assignee (including **Mine**), sorted by due date, with overdue ones highlighted. Done to-dos are hidden unless you ask for them.
- **Linked to-dos appear:**
  - in that phase's side panel;
  - on the assignee's person page, next to the work they belong to.
- **When a phase is removed (user decision, 2026-09-25),** its to-dos are not lost silently, and they don't pile up either.
  - **The warning.** The warning shown before saving the phase change also counts the removed phase's open to-dos, and asks what to do with them: **Keep them on the project** (the default) or **Delete them**. Done to-dos go with the phase either way.
  - **Kept to-dos remember where they came from.** Each shows a muted line: "Was on Development › Increment 2 (removed Fri 25 Sep)". The line goes away once the to-do is linked to another phase.
  - **Finding them.** The To-dos page has a **From removed phases** filter, so kept ones can be reviewed, relinked, ticked off or deleted in one place.
- **Starter checklists (optional):** Settings keeps a short list of to-dos per phase name, for example UAT: "Book UAT sessions", "Get UAT sign-off". The lists start empty. When a project is created, or a phase is added, the matching items are offered ticked, and you can untick any or all of them. Nothing is added unless you keep it.
- **"I am" (Settings):** you pick yourself from Resources, which is what **Mine** and **My next steps** use.

### 3.9 Settings
Weekend days, holidays, attachment types, roles, dropdown lists (main projects, project types, goals, business users, **phases**), waiting-clock thresholds, **"I am"**, and **starter to-dos per phase**. Renaming a phase in the list renames it on every project's phases; a phase name any project uses cannot be deleted.

### 3.10 Follow-on projects (M11)
- **Create follow-on project** on a project page opens the new-project wizard pre-filled from the original:
  - classification, department, requester and beneficiary;
  - both project managers;
  - the background;
  - the phase list with its durations;
  - optionally, the same people on the same phases.

  Dates, progress, history and documents are not copied.
- **Main project:**
  - If the original is under a main project, the follow-on joins it.
  - If not, the wizard offers to create a main project named after the original and put both in it. The portfolio already groups by main project, with a summary bar.
- **Carry-over:**
  - The original's **out-of-scope** items are offered as the new project's scope, ticked, and tagged "Carried over from <project>".
  - Its **open to-dos** can be moved across.
- **Start after the original:** optionally, the follow-on's first phase is linked to the original's last phase as a finish-to-start `ProjectLink`, so it moves if the launch slips, and the portfolio draws the arrow.
- **Stakeholders:** the focus view shows the project-family strip, so the story reads across phases.
- **Sandbox:** in the sandbox (M15), "Save as proposed project" can also mark the new project as a follow-on.

## 4. Presentation screens (APPROVED)

All read-only. The only exception is saving a sandbox scenario as a *proposed* change request. To-dos never appear here.

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
- A daily automatic backup of `pm.db` goes to `backups/`, keeping the last 14. This arrives in M5, before files and meeting notes that can't be recreated are entered. Attachment files are never overwritten.
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
- **End-to-end** (Playwright, a small number, set up in M11 when the first full flow exists): create a project → record a hold → the portfolio shows the arrow. Playback is added to the flow in M14.
- **Built-in demo portfolio**, with holds, change requests, waiting requirements and a completed historical project, used for tests and for rehearsing presentations.

## 7. Layout backlog (collected from the user's reviews, worked through in M12)
The user sends layout comments as they notice them. They are kept here, and M12 (layout pass) works through them. Functional readability problems, such as overlapping text, are fixed straight away in the milestone where they are found, not left for M12.
1. **Use the page width (2026-09-25).** Pages stack full-width cards one under another (for example the dashboard: My next steps, then Timeline, then Projects), so you keep scrolling while most of the screen is empty. Arrange cards side by side in a grid, for example a larger box beside a smaller one, each sized by how much it holds. This applies to almost every page.
2. **Gantt on a phone (2026-09-25, found in review).** The phase-name column takes about half of a phone's width, so the bars get squeezed into the rest. On narrow screens, the name column should shrink (or the names move onto the bars) so the timeline gets most of the width.
3. **Smaller to-do cards (2026-09-26).** The project page's "My next steps" card, and the to-do cards generally, take up far more room than three short lines need. Make them compact, for example a narrow box beside the timeline instead of a full-width card above it.

## 8. Language: Arabic first (user decision, 2026-09-26; built in M6)
- **The app opens in Arabic.** A language switch in the header changes it to English, and the choice is remembered on that device. Both the management and the presentation sides are bilingual.
- **The Arabic must be good, natural Arabic,** written the way a UAE government or business product would say it, not a word-for-word translation of the English. Sentences are rewritten so they read naturally in Arabic, and the tone is short, clear and professional.
- **As little English as possible (user, 2026-09-26).** A term stays in English only when the team really says it in English at work, where the Arabic would sound unnatural. "Change Request" is the user's example. Known acronyms may follow the Arabic in brackets, e.g. "ضمان الجودة (QA)". Everything else is Arabic.
- **A glossary comes first.** The key terms (project, main project, phase, sub-phase, to-do, workload, overbooked, leave, business project manager, change request, baseline, hold, and so on) are agreed with the user before the screens are translated, and are used the same way everywhere. The glossary lives in `docs/superpowers/glossary-ar.md` and grows with each milestone.
- **Right-to-left.** In Arabic the whole interface mirrors: navigation, tables, forms, cards, icons with a direction (arrows, "back"), and **Gantt charts, whose time runs from right to left** (earliest dates on the right, phase names on the right). The English version is unchanged.
- **Numbers and dates:**
  - Western digits (0–9) are used in both languages.
  - Dates use the Gregorian calendar with Arabic month and day names in Arabic, e.g. "الاثنين 12 أكتوبر 2026" (the month names used in the UAE: يناير، فبراير، …).
  - Percentages, Jira keys and UAE phone numbers keep their usual form.
- **What gets translated:** everything the app itself says: labels, buttons, headings, hints, empty states, confirmations, errors (including server validation messages), the default list values it ships with (phases, roles, project types, goals), demo wording where practical, and generated text such as "Was on … (removed …)".
- **What doesn't get translated:** anything people type in, such as project names, scope items, to-do titles and notes. It is shown as written, and text direction is detected per field, so English text inside the Arabic interface still reads correctly.
- **Font:** a font that renders Arabic well, with the same weight and size scale in both languages.
- **List values have an optional Arabic name** (M6 plan). The values the app ships with come with Arabic. Phase names on projects are shown in Arabic when they match a list value. **The presentation side uses the same device language switch.**

## 6. Out of scope (for now)
- Money or cost figures (these could be added later from rates per role).
- Multiple users, logins and hosting.
- Jira integration. The Jira key is a reference field only.
- Automatic resource levelling. Every schedule shift is a human decision.
- Team capacity views for stakeholders.

## 9. Later: vendor companies and contracts (M16, nice to have, user 2026-09-26)
Many of the user's own team are contracted through companies. A later, low-priority milestone gives each **company** its own page:
- the people from that company, our team and outsourced, current and past;
- **our contract with the company**: dates, the contract file, and its key dates (reusing M7's key dates);
- **money**: what we pay the company per year, and each person's monthly salary from that company;
- the **surplus**: the yearly amount paid minus the people's yearly salaries, so the user sees budget that isn't being used.
This information is confidential: never on the presentation side, and not in exports.

## 10. Team statistics (M10, user 2026-09-26)
For a chosen quarter or year, per person, with a sortable comparison table ("who finished the most", "best on-time rate"):
- **Everyone:** to-dos assigned, finished, the % finished on time (done on or before the due date), and how many are late now. To-dos from meetings and to-dos created directly both count.
- **Tech people (developers, QA and others):** the phases and sub-phases they worked on, their working days, and the % finished on time, from M8's confirmed done dates.
- **Project managers:** projects managed (active and finished), their projects' to-dos (open, done, late), meetings held, and the % of their projects finishing on time.
- **Fair rates:** only delays caused by the technical team count against a person's on-time rate. Delays caused by the business user, decision makers, external parties, approved change requests or the calendar (holidays, holds) are shown separately ("2 late, not their cause"), using the causes recorded in M8.
- **Admin only:** visible only to the admin (today, the single manage-mode user; when logins arrive, the admin role). Never on the presentation side, and not in stakeholder exports.
