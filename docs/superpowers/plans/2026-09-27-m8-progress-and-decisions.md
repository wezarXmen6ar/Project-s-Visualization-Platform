# Milestone 8: Progress and Decisions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track what really happens to each project and ask for a decision whenever the plan and reality part. The user can:
- see **Baseline 1** (the original plan) for every project, next to the current plan;
- record **% complete** and **actual dates**. Each phase and sub-phase bar fills in a darker shade of its colour, and a **pace** indicator compares progress with the working time used;
- **Mark done** every phase and sub-phase, done today or on an earlier date;
- answer a **shift prompt** (Yes / No / Partially) whenever a phase finishes early or late, or its dates move. Every date change is recorded as an **event** with its cause, delay days and responsibility;
- get **four lateness warnings** (overdue, behind schedule, project end at risk, and a reminder before the end) in a **"Needs your decision"** inbox, on the project page and in the phase side panel;
- add **public holidays**, with a prompt to shift the phases they affect;
- **Delay a phase** from the overbooking prompt, which now works;
- enter the **original plan and actual dates for past projects** (record-history mode);
- show stakeholders the first **Where did the time go?** and **Why did the end date move?** charts, with a **Department** filter for presenting to one business owner.

Smaller pieces follow the core:
- **phase ownership** (Technical / Business / Joint), with a distinct outline for business-owned phases;
- **to-do history and priority**;
- the first **project summary**, with a new "date requested" field and **starred key documents**;
- **storage protection**: files in the daily backup, a backup location of the user's choice, a storage page with a low-space warning, and deleted files emptied after 90 days;
- the first **status report slides** (cover, Summary and Timeline).

Everything ships in Arabic and English.

**Architecture:**
- **Scheduling stays a pure engine in `shared/`.** Today a project's dates are always recomputed as a chain from its start date and the phases' working days (`schedulePhases`). M8 adds two optional inputs to every phase and sub-phase:
  - a **fixed start** (`pinnedStart`), used when a phase must keep its dates;
  - a **fixed end** (`fixedEnd`), used for done phases, which end on their confirmed date.

  A new `shared/shift.ts` works out what a change does to the phases that follow (Yes / No / Partially). It is used by the server to save, and by the client to preview "UAT moves to Sun 8 Nov (+5 working days)" before the user confirms.
- **Storage:** seven new schema versions, 19 to 25.
  - **19:** progress columns on `phases`, `phase_progress`, `baselines` and `baseline_phases`. Baseline 1 is created for every existing project.
  - **20:** the `events` table grows causes, delay days, responsibility, project-end before/after and evidence, with `event_phase_changes`, `event_responsibility`, `event_edits`, and two editable lists (delay causes and responsibility).
  - **21:** warning dismissals.
  - **22:** holidays move out of the settings JSON into a `holidays` table, with `holiday_decisions`.
  - **23:** phase ownership.
  - **24:** to-do priority and `todo_updates`.
  - **25:** the project's date requested, and the key-document star on attachments.
- **One event per decision.** A decision (a late finish, a new expected end, a holiday, a plan edit) writes one `events` row, carrying the delay days once, plus one `event_phase_changes` row for every phase it moved. So "each day is counted once" in the charts, and nothing about the history is lost.
- **Warnings are computed, not stored.** `shared/warnings.ts` derives them from the project, its events and two settings (the behind-schedule gap and the reminder lead). Only the user's dismissals are stored.
- **Screens:**
  - a new **Progress** tab on the project page;
  - dialogs for Mark done, the shift prompt, and the reason (cause and responsibility);
  - the inbox on the dashboard;
  - a Holidays card and a Progress warnings card in Settings;
  - a Storage page;
  - the two charts on the presentation side;
  - the project summary on both sides;
  - print-ready slide pages for the status report.

**Tech Stack:** as before — Node 24, TypeScript, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite`, Vitest 3, Testing Library, jsdom. **No new npm dependencies.** Charts are hand-made SVG, like the Gantt chart. The PDF is the browser's own print-to-PDF. Disk space uses Node's built-in `fs.statfsSync`.

**Spec:**
- Key decisions table: the rows **Progress**, **Confirming done**, **Lateness warnings**, **Early or late finish** and **Holidays**;
- §1: delivery principles (record history from the moment a feature exists; record-history mode; the stakeholder charts grow each milestone);
- §2: `Phase` (actual dates, % complete, the darker fill), `Baseline`, `Event`, `Responsibility`, `Holiday`, and "Past and future projects";
- §3.2: Step 5 History;
- §3.3: the dashboard's "Needs your decision" inbox and the project table;
- §3.4: the project page header;
- §3.7: the decision prompt's Delay a phase, and holidays on the heatmap;
- §3.8: to-do history and priority;
- §4.1: Where did the time go? and presenting to one business owner;
- §4.3: Why did the end date move?;
- §4.4a: phase ownership;
- §4.4b: Project summary, the M8 part;
- §4.5: status report slides, the M8 part;
- §5.3: history is never silently rewritten, and storage protection;
- §8: Arabic first.

**Not in M8** (the user said so): a "data location" setting. The database stays in `data/pm.db`.

**Glossary:** `docs/superpowers/glossary-ar.md`. The new terms are proposed below. Task 1 adds them to the glossary, under "Proposed for M8", for the user's approval.

**Decisions confirmed with the user (2026-09-26, recorded in the spec):**
- **Confirming done.** Every phase and sub-phase must be confirmed done; reaching 100% alone doesn't finish it.
  - **Mark done** asks for the date it was really finished: **today**, or **an earlier date**.
  - That date is the actual end. It drives early and late detection and the charts. A phase finished on time but recorded late is **not** late.
  - A phase with sub-phases is done when its last sub-phase is confirmed, and takes that date.
- **Four lateness warnings,** on the dashboard ("Needs your decision"), the project page and the phase side panel:
  1. **Overdue:** the planned end has passed and the phase isn't confirmed done. It asks for the reason (cause and responsibility) and a new expected end date.
  2. **Behind schedule:** % complete is clearly behind the working time used. The gap threshold is a setting. The reason can be recorded then.
  3. **Project end at risk:** the likely end, worked out from the slips so far, compared with the committed end. It says how many working days late, and which recorded reasons caused it.
  4. **Reminder before the end:** a set number of days before each phase's and the project's planned end (default 14, a setting), whatever the progress.
- **Early or late finish:** the app asks each time whether to shift the phases that follow: **Yes / No / Partially**. A late finish also asks for the cause.
- **Holidays** are single dated entries or ranges, with no recurring rules. Adding one prompts to shift the affected phases. The cause is recorded as "Public holiday", and the responsibility as Calendar.
- **Record-history mode:** past items are recorded as the events that already happened, with **no decision prompts**.
- **To-do history and priority:**
  - a meeting's form has **To-dos discussed** (مهام نوقشت). Each to-do picked gets a dated update linked to the meeting, and can change its due date, assignee or priority in the same step;
  - an update can also be added outside a meeting;
  - the to-do shows its history;
  - priority is **Normal / Important / Urgent** (عادي، مهم، عاجل).
- **Project summary, first version:** key dates (including the new **date requested**, تاريخ الطلب), on track or late, the overall and development %, and **starred key documents** (⭐ مستند رئيسي). It's on the presentation side and at the top of the project page.
- **A Department filter** (spec: الجهة) on the presentation dashboard and the portfolio.
- **Storage protection:**
  - files are copied in the daily backup;
  - a backup location of the user's choice, falling back to `backups/` when it can't be reached;
  - a storage page, and a dashboard warning below 5 GB free;
  - `_deleted` files are removed after 90 days, with **Empty deleted files** to clear them sooner.
- **Status report slides, first version:** cover, Summary and Timeline slides, for one or several projects, printed with the browser's print-to-PDF.

**Deliberate choices (flag if you disagree):**
- **A new Progress tab (التقدّم)** sits second in the tab bar (History, **Progress**, To-dos, People, Attachments, Details). It holds the phase table (original plan, current plan, actual dates, %, pace, status, Mark done) and the **Date changes** log. History stays the default tab.
- **"Late" is measured against the current plan,** as the spec's Progress row says ("Late only when the planned end passes"). **"Project end at risk" is measured against the latest baseline** (Baseline 1 in M8), which is the committed end.
- **Keeping dates.** When a follower must keep its dates (the **No** or **Partially** answers), it gets a fixed start at its current start date, and it keeps its working days. Followers that move keep their fixed start too, shifted by the same number of working days, so a gap chosen earlier survives.
- **Done phases never move.** Their bars show their actual start and confirmed end. In **Edit phases**, a done phase can't be resized, dragged or removed; **Reopen** it from the Progress tab first.
- **Actual start** is recorded automatically the first time % goes above 0. It uses the "Started on" date in the progress form, which defaults to the planned start when that has passed, otherwise today. Mark done fills it in if it's missing. The actual start is information: it doesn't move the plan.
- **A phase with sub-phases** has no Mark done button of its own ("Done when all its sub-phases are done"). Its % is worked out from its sub-phases (open question 1).
- **Early finishes** don't ask for a cause. They're recorded with the cause "Finished early" (أُنجزت مبكراً), the responsibility Technical team, and negative delay days (time saved). The user can change the responsibility in the prompt.
- **The reason's responsibility** is preselected as Technical team, and as Business user for a business-owned phase (from Task 12). **Delay a phase** preselects nothing: the user must choose.
- **Event notes are private.** The presentation side shows each event's cause, days and responsibility, never the note. Evidence (a meeting, an update or a file linked to the event) is shown to stakeholders only when the entry is highlighted, or the file belongs to a highlighted entry or is a starred key document.
- **Plan edits on a project that has started** need a reason, like any other date change. The Edit phases page asks "Why are the dates changing?" before saving. A project that hasn't started saves as before, and Baseline 1 follows those edits (open question 5).
- **The shift prompt defaults to Yes** (move the following phases), as a plan normally does.
- **Holidays:** each affected project gets **Shift the phases**, **Keep the dates** or **Decide later**. Decide later waits in the inbox. A holiday that is already over is simply saved, with no prompt (record-history). Deleting a future holiday asks the same question in reverse: pull the phases back, or keep the dates.
- **Reminders** cover top-level phases, sub-phases and the project end, 14 calendar days ahead by default. A reminder can be dismissed ("Got it"). It comes back only if that end date changes.
- **The soft pace indicator** reads "On pace" within ±10 percentage points, "Behind pace (n%)" or "Ahead (n%)" beyond. The **behind-schedule warning** starts at a 20-point gap (a setting).
- **The inbox** groups its items: **Needs your decision** (overdue phases without a new expected end, phases at 100% waiting for Mark done, behind schedule without a recorded reason, project end at risk, holiday decisions, overbooked people) and **Coming up** (reminders). Overbooking moves into the inbox with the same wording as today's notice.
- **Baseline 1 as dashed outlines** on single-project charts (the project page, the focus view and the Timeline slide), shown only where the current dates differ. M9 adds later baselines.
- **Where did the time go?** counts the delay days of events whose date falls in the chosen year. **Why did the end date move?** steps through the events that moved the project end. Any difference they can't explain (for example, changes made before M8) is one grey "Other changes" step.
- **Phase ownership** is set per top-level phase, and sub-phases inherit it. The defaults are Business for UAT and "Requirements sign-off", and Technical for the rest. Business-owned phases get a **solid 2px outline** in a new ink colour. Joint phases get the same outline, 1px. Dashes stay reserved for baselines.
- **To-do history** also records edits made outside meetings: every change to the due date, assignee or priority is logged automatically, with no note. So the history is complete.
- **Starred key documents are shown to stakeholders** in the project summary and on the Summary slide (open question 7). M7's key dates (contract end, licence expiry…) stay private.
- **Status report:** the cover slide is always included, even for one project. The report's language is picked on the report page, defaulting to the app's language.
- **The storage page** is its own page (`/manage/storage`), linked from Settings. The backups card on Settings moves onto it.

**New glossary terms (proposed; added to the glossary in Task 1 for approval):**

| English | Arabic |
|---|---|
| Progress (tab) | التقدّم |
| % complete | نسبة الإنجاز |
| Update progress | تحديث نسبة الإنجاز |
| Started on | تاريخ البدء الفعلي |
| Mark done | تأكيد الإنجاز |
| Done today / Done on an earlier date | أُنجزت اليوم / أُنجزت في تاريخ سابق |
| Done on {date} | أُنجزت في {date} |
| Reopen | إعادة فتح |
| Actual start / Actual end | البدء الفعلي / الانتهاء الفعلي |
| Original plan (Baseline 1) | الخطة الأصلية (خط الأساس 1) |
| Current plan | الخطة الحالية |
| Expected finish | الانتهاء المتوقع |
| Pace: On pace / Behind pace / Ahead | الوتيرة: ضمن المتوقع / أبطأ من المتوقع / أسرع من المتوقع |
| Overdue (a phase) | تجاوزت موعد انتهائها |
| Behind schedule | الإنجاز أقل من المتوقع |
| Project end at risk | انتهاء المشروع مهدَّد بالتأخير |
| Reminder before the end | تذكير قبل الانتهاء |
| Needs your decision | بانتظار قرارك |
| Coming up | قريباً |
| Shift the following phases? Yes / No / Partially | هل تريد تحريك المراحل التالية؟ نعم / لا / جزئياً |
| Move up to and including… | تحريك المراحل حتى… |
| Keep the dates | الإبقاء على التواريخ |
| Reason / Cause | السبب |
| Responsibility | المسؤولية |
| Technical team / Business user / Decision makers / External / Calendar | الفريق التقني / مالك العملية / متخذو القرار / جهة خارجية / التقويم (العطل الرسمية) |
| Delay causes: Took longer than planned, Waiting for the business user, Waiting for a decision, External party, Team overbooked, Other | استغرق العمل وقتاً أطول من المخطط، بانتظار مالك العملية، بانتظار قرار، جهة خارجية، تجاوز الحِمل على الفريق، أخرى |
| Finished early (cause) | أُنجزت مبكراً |
| Delay days / Time saved | أيام التأخير / الوقت الموفَّر |
| Date changes (log) | سجل تغيير التواريخ |
| Evidence | المستند الداعم |
| New expected end | موعد الانتهاء المتوقع الجديد |
| Record past dates | تسجيل التواريخ السابقة |
| Actual dates (wizard step) | التواريخ الفعلية |
| Public holidays (card) / Add holiday | العطل الرسمية / إضافة عطلة |
| Shift the phases / Decide later | تحريك المراحل / القرار لاحقاً |
| Progress warnings (Settings) | تنبيهات التقدّم |
| Where did the time go? | أين ذهب الوقت؟ |
| Why did the end date move? | لماذا تغيّر موعد الانتهاء؟ |
| By cause / By responsibility | حسب السبب / حسب المسؤولية |
| Other changes (chart) | تغييرات أخرى |
| Phase owner: Technical / Business / Joint | مالك المرحلة: الفريق التقني / مالك العملية / مشتركة |
| To-dos discussed | مهام نوقشت |
| To-do history | سجل المهمة |
| Priority: Normal / Important / Urgent | الأولوية: عادي / مهم / عاجل |
| Project summary | ملخص المشروع |
| Date requested | تاريخ الطلب |
| Plan created | تاريخ إعداد الخطة |
| First phase started | بدء أول مرحلة |
| On track / Late by {n} working days | وفق الخطة / متأخر {n} يوم عمل (Arabic plurals) |
| Overall progress / Development progress | نسبة الإنجاز الكلية / نسبة إنجاز التطوير |
| Key document (star) | مستند رئيسي |
| Department (filter) | مالك العملية (open question 6) |
| Storage | التخزين |
| Backup location | موقع النسخ الاحتياطية |
| Deleted files / Empty deleted files | الملفات المحذوفة / إفراغ الملفات المحذوفة |
| Free disk space | المساحة المتاحة على القرص |
| Status report | تقرير حالة المشاريع |
| Cover (slide) | الغلاف |
| Print or save as PDF | طباعة أو حفظ بصيغة PDF |

## Global Constraints
- **Branches:**
  - This plan is committed on `design/portfolio-spec`.
  - The build happens on `build/m8`, created from `design/portfolio-spec` at this commit.
  - Doc fixes that come out of reviewing the build go on `build/m8`.
  - **Never commit to `main`.**
  - On merge, every branch (`main`, `design/portfolio-spec`, `build/m1-m2`, `build/m2`…`build/m8`) is fast-forwarded to the same commit.
  - The intermediate checkpoint (after Task 10) may be merged the same way, and the build then continues on `build/m8`.
- **No new npm dependencies.**
- **Database:**
  - `node:sqlite`, with raw parameterised SQL.
  - **Append migrations only.** Migrations 1–18 exist; M8 adds 19 to 25, in task order.
  - Multi-row writes run in `transaction(db, …)`. A Mark done, a reschedule, a holiday decision or a plan edit writes the phases, the event, its phase changes and its responsibility rows in **one** transaction.
- **Dates:**
  - Working-day maths only through `shared/calendar.ts`.
  - "Today" on the server is `opts.today()` (the `buildApp` option); on the client, `todayLocal()`.
  - Timestamps are turned into local dates with `toLocalDate`, never `slice(0, 10)`.
- **Files:**
  - Uploaded files stay under `attachmentsDir`, as in M7.
  - Tests use temporary folders (`mkdtempSync(join(tmpdir(), 'pvp-…'))`) and close database handles before cleanup, because this is Windows.
  - Never touch `data/pm.db`, `attachments/` or `backups/` in tests.
- **Bilingual:**
  - Every user-visible string comes from `shared/i18n/en.ts` and `ar.ts` through `t(...)`. The Arabic is natural and follows the glossary, including Arabic plurals for day and item counts.
  - English stays byte-identical for existing tests; tests render in English unless they wrap in `<LanguageProvider lang="ar">`.
  - User content (names, titles, notes, file names, holiday names) gets `dir="auto"` and `data-user-content`.
  - Server errors carry `code` and `params` (the M6 pattern), and zod messages are catalogue keys.
  - Dates and percentages display only through `client/i18n/format.ts`.
  - The "no English left" guard (`client/i18n/noEnglish.test.tsx`) is extended to every new screen and dialog.
- **Right to left:**
  - Logical CSS properties only.
  - Gantt fills and baseline outlines are drawn as logical boxes from the bar's start date, so the existing `X()` flip puts them on the right in Arabic.
  - The charts' bars run from the inline start.
- **Presentation is read-only and private:**
  - Under `/present`, nothing can be edited.
  - No to-dos, no people's names, no event notes, no M7 key dates and no person documents appear.
  - Only highlighted entries (and their files) and starred key documents are shown.
  - The existing read-only guard tests are extended to every new presentation screen.
- **Tests:**
  - Every client test file starts with `// @vitest-environment jsdom`.
  - Fix "today" with `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(new Date('2026-10-20T09:00:00'))` on the client, and with `buildApp(db, { today: () => '2026-10-20' })` on the server.
  - Server route tests use `buildApp(db, { today, attachmentsDir, backupDir, dbPath, freeSpace })` with temporary folders.
  - Shared engines get thorough unit tests with realistic scenarios (for example "Eid falls inside Development while UAT slips").
- **The Gantt chart and the phase editors stay intact:** segments, lanes, the details card, the label that opens phase details, the side panel click (M7), and mouse and touch dragging in the phase editors (see the "Browser drag testing" memory: re-check a real mouse drag in the browser after Tasks 4 and 12).
- **Review copy:** the user reviews from a **frozen worktree** of the checkpoint commit, served on ports other than 3001/5173, with its own reseeded database. Restart the dev server before every visual check (Vite on Windows can serve stale modules).

## Where M8 sits
M1–M7 are merged, and identical on every branch (`75c773c`). The app is Arabic first. It has:
- projects with sub-phases, people, to-dos, starter checklists, meetings, updates, attachments, key dates, outsourced people and person documents;
- the workload views with the overbooking prompt (Split, Reassign and Accept work; Pause and Delay are shown disabled);
- right-to-left Gantt charts, with a side panel per phase;
- daily database backups (`server/backup.ts`, 14 kept).

**What exists that M8 builds on:**
- The `events` table (migration 7) holds only `overload-resolved` rows, written by `recordDecision` in `server/assignments/repo.ts`.
- There is no holiday editor: `WorkCalendar.holidays` lives in the `settings` row `calendar` as JSON, and is always empty in practice.
- Phase dates are always recomputed by `schedulePhases(startDate, phases, cal)` (`shared/scheduler.ts`), as a chain.
  - `createProject` and `updateSchedule` (`server/projects/repo.ts`) store the result in `phases.planned_start` and `phases.planned_end`.
  - There are no actual dates, no % and no baselines yet.

## File Structure (M8)
```
shared/calendar.ts                 workingDaysBetween, shiftWorkingDays                          (Task 1)
shared/scheduler.ts                pinnedStart and fixedEnd on phases and sub-phases             (Task 1)
shared/shift.ts                    NEW: pieces, followers, applyPieceChange, applyHoliday        (Task 1)
shared/progress.ts                 NEW: expected %, roll-ups, pace, development %                (Task 2)
server/baselines/repo.ts           NEW: Baseline 1, refresh while not started, lookups           (Task 2)
server/progress/repo.ts            NEW: load/save pieces, progress, mark done, reopen, reschedule, history (Tasks 2, 3, 6)
server/events/repo.ts              NEW: record, list, edit (logged) events                        (Task 3)
client/gantt/Gantt.tsx, rows.ts    progress fill, baseline outline, % in the details card         (Task 4)
client/gantt/GanttLegend.tsx       NEW                                                            (Tasks 4, 12)
client/pages/manage/ProgressTab.tsx NEW: the phase table and the Date changes log                 (Task 5)
client/components/MarkDoneDialog.tsx, RescheduleDialog.tsx, ShiftChoiceFields.tsx, ReasonFields.tsx,
  ProgressControls.tsx             NEW                                                            (Task 5)
client/pages/manage/ActualsTable.tsx, RecordPastDatesPage.tsx NEW                                 (Task 6)
shared/warnings.ts                 NEW: the four warnings, confirm-done, forecast end             (Task 7)
server/warnings/repo.ts            NEW: warnings, dismissals, inbox                               (Task 7)
client/pages/manage/ProgressRulesCard.tsx NEW                                                     (Task 7)
server/holidays/repo.ts            NEW                                                            (Task 8)
client/pages/manage/HolidaysCard.tsx, HolidayDecisionDialog.tsx NEW                               (Task 8)
client/pages/manage/DecisionInbox.tsx, client/components/WarningList.tsx NEW                      (Task 9)
server/demoData.ts                 progress demo (Task 10), the rest (Task 17)
shared/delays.ts                   NEW: time breakdown and end-date steps (pure)                  (Task 11)
server/insights/repo.ts            NEW                                                            (Task 11)
client/pages/present/WhereTimeWentChart.tsx, WhyEndMovedChart.tsx, DepartmentFilter.tsx NEW       (Task 11)
server/todos/history.ts            NEW                                                            (Task 13)
client/components/ToDoHistory.tsx, PriorityBadge.tsx, DiscussedToDos.tsx NEW                      (Task 13)
server/summary/repo.ts             NEW                                                            (Task 14)
client/components/ProjectSummaryView.tsx NEW                                                      (Task 14)
server/storage.ts                  NEW: backup target, file mirror, storage report, purge         (Task 15)
client/pages/manage/StoragePage.tsx, BackupLocationCard.tsx, LowSpaceNotice.tsx NEW              (Task 15)
client/pages/present/ReportPickerPage.tsx, ReportSlidesPage.tsx NEW                               (Task 16)
server/db.ts                       migrations 19–25                                               (Tasks 2, 3, 7, 8, 12, 13, 14)
```

---

### Task 1: The scheduling engine — fixed starts, fixed ends and shifts

**Why:** every later task moves dates. This task keeps the rules in one pure, well-tested place, before any storage or screen uses them.

**Files:**
- Create: `shared/shift.ts`
- Modify: `shared/calendar.ts`, `shared/scheduler.ts`, `docs/superpowers/glossary-ar.md` (add the proposed M8 terms above under "Proposed for M8")
- Test: `shared/calendar.test.ts`, `shared/scheduler.test.ts`, `shared/shift.test.ts` (new)

**Interfaces:**
- `shared/calendar.ts`:
  ```ts
  /** Signed working days from a to b: 0 when a === b; positive when b is later (working days in (a, b]); negative when earlier (−working days in (b, a]). */
  export function workingDaysBetween(a: ISODate, b: ISODate, cal: WorkCalendar): number;
  /** The date n working days after d (n > 0) or before it (n < 0); n = 0 returns nextWorkingDay(d). The result is always a working day. */
  export function shiftWorkingDays(d: ISODate, n: number, cal: WorkCalendar): ISODate;
  ```
- `shared/scheduler.ts`: `SubPhaseInput` and `PhaseInput` both gain optional fields:
  ```ts
  /** Start here (rolled to a working day) instead of after the one before. Overlap with the one before is allowed. */
  pinnedStart?: ISODate | null;
  /** End on this date whatever durationDays says (a done phase); durationDays is recomputed from start to fixedEnd. */
  fixedEnd?: ISODate | null;
  ```
  The rules:
  - For a phase **with** sub-phases, its `pinnedStart` is where its first sub-phase may start. Its `fixedEnd` is ignored, because the end comes from its sub-phases.
  - If `fixedEnd` is before the computed start, the start becomes `fixedEnd` and the duration is 1.
  - The next phase or sub-phase follows the latest end so far, as today.
  - Every existing caller (the wizard, the preview, the editors) passes neither field, so its output is unchanged.
- `shared/shift.ts`:
  ```ts
  export interface PlanPiece {
    id: number; parentId: number | null; order: number;
    durationDays: number; withPrevious: boolean;
    pinnedStart: ISODate | null;
    actualStart: ISODate | null;
    /** The confirmed done date; set means done. */
    actualEnd: ISODate | null;
    /** The current plan, as stored. */
    start: ISODate; end: ISODate;
  }
  export type ShiftChoice = { mode: 'all' } | { mode: 'none' } | { mode: 'upTo'; lastMovedId: number };
  export interface PieceChange { id: number; before: DateRange; after: DateRange }
  export interface ShiftResult {
    pieces: PlanPiece[];                       // the whole plan after the change
    changes: PieceChange[];                    // every piece whose start or end moved, the changed piece first, then plan order
    projectEnd: { before: ISODate; after: ISODate };
    /** Signed working days the changed piece's end moved (its start, for a start change). */
    delayDays: number;
  }
  /** The pieces that may move after `id`, in plan order: later not-done sub-phases of the same parent, then later not-done top-level phases. Done pieces never move. */
  export function followersOf(pieces: PlanPiece[], id: number): PlanPiece[];
  /** Runs schedulePhases on the pieces: done pieces use (actualStart ?? start, actualEnd); others use pinnedStart and durationDays. */
  export function rescheduleAll(startDate: ISODate, pieces: PlanPiece[], cal: WorkCalendar): PlanPiece[];
  export function applyPieceChange(
    startDate: ISODate, pieces: PlanPiece[],
    change: { id: number; newEnd?: ISODate; newStart?: ISODate; done?: { start: ISODate; end: ISODate } },
    choice: ShiftChoice, cal: WorkCalendar,
  ): ShiftResult;
  /** A new holiday (newCal has it, oldCal doesn't): 'shift' lets not-done pieces move later; 'keep' keeps every not-done piece's dates by pinning its start and shortening its working days. */
  export function applyHoliday(startDate: ISODate, pieces: PlanPiece[], oldCal: WorkCalendar, newCal: WorkCalendar, decision: 'shift' | 'keep'): ShiftResult;
  /** Builds pieces from a ProjectRecord (top-level phases and sub-phases, in plan order). */
  export function piecesOf(project: ProjectRecord): PlanPiece[];
  ```

**Rules of `applyPieceChange`:**
1. Take the old dates of every piece.
2. Work out the followers with `followersOf`, and split them by the choice:
   - `all`: every follower moves;
   - `none`: none of them moves;
   - `upTo`: the followers up to and including `lastMovedId` move, and the rest keep their dates.
3. A follower that **keeps** its dates gets `pinnedStart = its current start`. A top-level follower's sub-phases need nothing more: they chain from the pinned parent start.
4. A follower that **moves** and already has a `pinnedStart` has that pin moved by `delta` working days (`shiftWorkingDays`). `delta` is the signed working days between the changed piece's old and new end (or its old and new start).
5. Apply the change to the changed piece:
   - `newEnd`: `durationDays = countWorkingDays(start, newEnd)`, at least 1;
   - `newStart`: `pinnedStart = newStart`, keeping the working days;
   - `done`: `actualStart` and `actualEnd` are set.
6. Run `rescheduleAll` from the project start date, and compare with the old dates.

`applyHoliday('shift')` moves every not-done piece's pin that falls on or after the holiday's start by the working days the holiday removes. `applyHoliday('keep')` pins every not-done piece that overlaps or follows the holiday, and recomputes its working days under `newCal`, so its start and end stay the same.

- [ ] **Step 1: Write the failing tests:**
  - **Calendar helpers.** `workingDaysBetween`:
    - Thu 8 Oct → Mon 12 Oct 2026 is `2`;
    - the reverse is `-2`;
    - the same day is `0`;
    - with a holiday on Fri 9 Oct, it is `1`.
  - `shiftWorkingDays('2026-10-08', -2)` is Tue 6 Oct, and it skips holidays.
  - **Scheduler.** A pinned second phase starts on its pin even when the first phase ends later (overlap), and the third phase follows the later of the two ends. A `fixedEnd` phase ends on that date, and its `durationDays` is recomputed. A pinned first sub-phase moves its parent's start. All existing scheduler tests pass unchanged.
  - **A late finish with Yes.** Requirements (5 working days) → Development (10) → UAT (5). Marking Requirements done 3 working days late, with `all`, moves Development and UAT by 3, and gives `delayDays 3`, `changes` with 3 pieces, and a `projectEnd.after` 3 working days later.
  - **No.** The same with `none`: Development and UAT keep their dates (both pinned), the project end is unchanged, `delayDays` is 3, and `changes` has only Requirements.
  - **Partially.** Four phases, with `upTo` the second follower: the first two followers move, the third keeps its dates.
  - **An early finish** with `all` pulls the followers earlier and gives a negative `delayDays`.
  - **A late sub-phase.** Increment 2 is late with `all`: Increment 3 moves, the parent's end moves, and QA moves. With `none`, Increment 3 and QA keep their dates, and the parent's end becomes the later of Increment 2 and Increment 3.
  - **Done pieces never move.** A done QA before a late UAT is not among the followers. After a holiday is added, `rescheduleAll` keeps a done phase on its actual dates.
  - **A moving follower that was pinned earlier** (with a deliberate 5-day gap) keeps that gap after an upstream slip of 2 days.
  - **`newStart` (Delay a phase):** a phase starting 5 working days later, with `all`, moves its followers by 5.
  - **`applyHoliday`:**
    - 'shift' with a 2-day holiday inside Development pushes Development's end, and UAT, by 2 working days;
    - 'keep' leaves every date the same and shortens Development by 2 working days;
    - a holiday entirely after the project changes nothing (`changes` is empty).
- [ ] **Step 2:** Run `npx vitest run shared` and confirm the new tests FAIL.
- [ ] **Step 3:** Implement. Keep `shift.ts` free of any database or UI imports, and add the glossary terms.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: the scheduling engine keeps fixed starts and confirmed ends, and works out what a shift does to the following phases`.

---

### Task 2: Baseline 1, % complete and actual dates — storage and API

**Files:**
- Create: `server/baselines/repo.ts`, `server/progress/repo.ts`, `shared/progress.ts`
- Modify: `server/db.ts` (migration 19), `shared/types.ts` (the progress fields), `shared/schemas.ts` (`progressInputSchema`; `schedulePhaseSchema` and `scheduleSubPhaseSchema` gain an optional `pinnedStart`), `server/projects/repo.ts` (read the new columns; `createProject` makes Baseline 1; `updateSchedule` passes the pins and done dates to the scheduler, refuses to remove done phases, and refreshes Baseline 1 while not started), `server/app.ts`, `shared/i18n/en.ts` and `ar.ts`, `client/api.ts`, `client/testing/mockFetch.ts` (`sampleProject` gets the new fields, defaulting to "not started")
- Test: `server/progress/progress.test.ts` (new), `server/baselines/baselines.test.ts` (new), `shared/progress.test.ts` (new), `server/db.test.ts`, `server/projects/projects.test.ts`, `server/app.test.ts`

**Migration 19:**
```sql
ALTER TABLE phases ADD COLUMN pinned_start TEXT;
ALTER TABLE phases ADD COLUMN actual_start TEXT;
ALTER TABLE phases ADD COLUMN actual_end TEXT;
ALTER TABLE phases ADD COLUMN percent_complete INTEGER NOT NULL DEFAULT 0 CHECK (percent_complete BETWEEN 0 AND 100);
CREATE TABLE phase_progress (
  id INTEGER PRIMARY KEY,
  phase_id INTEGER NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  effective_date TEXT NOT NULL,
  percent_complete INTEGER NOT NULL CHECK (percent_complete BETWEEN 0 AND 100),
  created_at TEXT NOT NULL
);
CREATE INDEX phase_progress_phase ON phase_progress(phase_id, effective_date);
CREATE TABLE baselines (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'saved' CHECK (source IN ('saved', 'existing-plan', 'record-history')),
  created_at TEXT NOT NULL,
  UNIQUE (project_id, number)
);
CREATE TABLE baseline_phases (
  baseline_id INTEGER NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
  phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
  parent_phase_id INTEGER,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL
);
CREATE INDEX baseline_phases_baseline ON baseline_phases(baseline_id);
INSERT INTO baselines (project_id, number, source, created_at)
  SELECT id, 1, 'existing-plan', created_at FROM projects;
INSERT INTO baseline_phases (baseline_id, phase_id, parent_phase_id, name, sort_order, planned_start, planned_end)
  SELECT b.id, p.id, p.parent_id, p.name, p.sort_order, p.planned_start, p.planned_end
  FROM phases p JOIN baselines b ON b.project_id = p.project_id AND b.number = 1;
```

**Interfaces:**
- `shared/types.ts`:
  ```ts
  export interface ProgressFields {
    /** 0–100. A phase with sub-phases: worked out from them (rollupPercent), never stored. */
    percentComplete: number;
    actualStart: ISODate | null;
    /** The confirmed done date (the actual end). Null while not done. */
    doneDate: ISODate | null;
    /** A fixed start that keeps its dates; null when it follows the one before. */
    pinnedStart: ISODate | null;
    /** Its dates in the latest baseline (Baseline 1 in M8); null when it was added after the baseline. */
    baseline: DateRange | null;
  }
  // SubPhaseRecord and PhaseRecord both extend ProgressFields.
  // ProjectRecord gains:
  createdAt: string;
  /** The latest baseline's project end; null only for a project without phases. */
  baselineEnd: ISODate | null;
  percentComplete: number;          // projectPercent
  developmentPercent: number | null;
  ```
- `shared/progress.ts`:
  ```ts
  /** 0 before the start, 100 after the end, else round(working days from start through today ÷ working days in the span × 100). */
  export function expectedPercent(start: ISODate, end: ISODate, today: ISODate, cal: WorkCalendar): number;
  /** Working-day weighted average of the items' percentComplete, rounded. 0 for an empty list. */
  export function rollupPercent(items: { durationDays: number; percentComplete: number }[]): number;
  export const PACE_BAND = 10;
  export type Pace = 'not-started' | 'on-pace' | 'behind' | 'ahead' | 'done';
  export function paceOf(piece: { start: ISODate; end: ISODate; percentComplete: number; doneDate: ISODate | null }, today: ISODate, cal: WorkCalendar): { pace: Pace; expected: number; gap: number };
  /** Top-level phases, working-day weighted. */
  export function projectPercent(phases: { durationDays: number; percentComplete: number }[]): number;
  /** Development phases (normalised names: development, dev, التطوير, with or without a bracketed acronym) combined; null if none. */
  export function developmentPercent(phases: { name: string; durationDays: number; percentComplete: number }[]): number | null;
  ```
  `gap` is `percentComplete − expected`. `on-pace` means `|gap| < PACE_BAND`.
- `shared/schemas.ts`: `progressInputSchema = z.object({ percent: z.number().int('validation.percentWhole').min(0, 'validation.percentRange').max(100, 'validation.percentRange'), startedOn: isoDate.nullish() })`. `schedulePhaseSchema` and `scheduleSubPhaseSchema` gain `pinnedStart: isoDate.nullish()`: `undefined` keeps the stored value, and `null` clears it.
- **Routes:**

  | Route | Behaviour |
  |---|---|
  | `PUT /api/phases/:id/progress` | Body `{ percent, startedOn }`. It updates `percent_complete` and writes a `phase_progress` row dated today. It returns the `ProjectRecord`. |
  | `GET /api/projects/:id/baselines` | `[{ number, source, createdAt, phases: [{ phaseId, parentPhaseId, name, start, end }] }]`. |

- `server/progress/repo.ts`: `loadPieces(db, projectId): { startDate: ISODate; pieces: PlanPiece[] }`, `savePieces(db, pieces)` (writes `pinned_start`, `duration_days`, `planned_start`, `planned_end`, `actual_start` and `actual_end`), and `setProgress(db, phaseId, input, today)`.
- `server/baselines/repo.ts`: `createBaselineOne(db, projectId, source, createdAt)`, `refreshBaselineOne(db, projectId)`, `baselineDates(db, projectId): Map<phaseId, DateRange>`, and `projectStarted(db, projectId, today): boolean`.

**Rules:**
- **Progress on a phase that has sub-phases** is refused with `error.progressFromSubPhases`: "This phase's progress comes from its sub-phases" / «نسبة إنجاز هذه المرحلة تُحسب من مراحلها الفرعية».
- **Progress on a done phase** is refused with `error.phaseIsDone`: "This phase is done. Reopen it to change its progress" / «هذه المرحلة منجزة. أعد فتحها لتعديل نسبة إنجازها».
- **100% doesn't finish a phase.**
- **The first time % goes above 0,** `actual_start` is set from `startedOn`, or else the planned start if it is on or before today, or else today. `startedOn` must not be after today (`validation.notInFuture`).
- **Baseline 1** is created by `createProject` in the same transaction, with `source 'saved'` and the project's `created_at`.
- **A project has started** when its start date is on or before today, or any phase has an actual start. Until then, `updateSchedule` calls `refreshBaselineOne`, which replaces Baseline 1's phases with the new plan.
- **`updateSchedule`:**
  - it reads each kept phase's stored pin and actual dates, and passes them to `schedulePhases`;
  - it refuses to remove a done phase (`error.cannotRemoveDonePhase`: "A done phase can't be removed. Reopen it first" / «لا يمكن حذف مرحلة منجزة. أعد فتحها أولاً»);
  - Task 3 adds the reason rule.
- **Reading a project** fills `baseline` on each phase and sub-phase from `baselineDates`. `baselineEnd` is the latest of the baseline's ends. The parent % is `rollupPercent(subPhases)`.

- [ ] **Step 1: Write the failing tests:**
  - migration 19 upgrades a version-18 database with two projects, gives each project one baseline with every phase (`integrity_check` ok), and existing phases get `percent_complete 0`;
  - creating a project makes Baseline 1 (`source 'saved'`), and each phase's `baseline` equals its dates;
  - editing the schedule of a project that hasn't started changes Baseline 1 too; editing one that has started leaves Baseline 1 alone, and `baseline` differs from the new dates;
  - a phase added after the project started has `baseline: null`;
  - `PUT /progress` 40% on a sub-phase sets its actual start to its planned start (in the past) and writes a history row, and the parent shows the working-day-weighted % (2 sub-phases: 10 days at 40%, 30 days at 0% → 10%);
  - progress on a parent with sub-phases answers 400 `error.progressFromSubPhases`, and on a done phase 400 `error.phaseIsDone`;
  - `startedOn` in the future answers 400;
  - `updateSchedule` keeps a stored pin when `pinnedStart` is omitted, and clears it with `null`;
  - removing a done phase answers 400 `error.cannotRemoveDonePhase` (set `actual_end` directly in the test);
  - **shared/progress:**
    - `expectedPercent` for a 10-working-day phase, 7 days in, is 70;
    - `paceOf` at 40% with 70% expected is `behind`, with a gap of −30;
    - at 65% it's `on-pace`;
    - `developmentPercent` finds "Development" and "التطوير" and returns null without one.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement. Update `sampleProject` and any hand-built `PhaseRecord` in tests with the defaults (`percentComplete: 0, actualStart: null, doneDate: null, pinnedStart: null, baseline: null`) without changing their assertions.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: Baseline 1 for every project, % complete with its history, and actual start dates`.

---

### Task 3: Events with cause and responsibility — Mark done, reschedule and plan edits recorded

**Files:**
- Create: `server/events/repo.ts`
- Modify: `server/db.ts` (migration 20), `shared/types.ts` (`LIST_NAMES` gains `'delayCause'` and `'responsibility'`; the event types), `shared/schemas.ts`, `server/progress/repo.ts` (`markDone`, `reopenPhase`, `reschedulePhase`), `server/projects/repo.ts` (`updateSchedule` records a `plan-changed` event), `server/lists/repo.ts` (the in-use rule for the two new lists), `server/assignments/repo.ts` (`listDecisions` keeps reading only `overload-resolved` rows), `server/app.ts`, `shared/i18n/*`, `client/api.ts`, `client/testing/mockFetch.ts` (`sampleEvents()`)
- Test: `server/events/events.test.ts` (new), `server/progress/progress.test.ts`, `server/projects/projects.test.ts`, `server/lists/lists.test.ts`, `server/db.test.ts`, `server/app.test.ts`

**Migration 20:**
```sql
ALTER TABLE events ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN cause_kind TEXT CHECK (cause_kind IN ('listed', 'early', 'holiday'));
ALTER TABLE events ADD COLUMN cause_id INTEGER REFERENCES list_values(id);
ALTER TABLE events ADD COLUMN delay_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN project_end_before TEXT;
ALTER TABLE events ADD COLUMN project_end_after TEXT;
ALTER TABLE events ADD COLUMN entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN attachment_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN source TEXT NOT NULL DEFAULT 'prompt' CHECK (source IN ('prompt', 'record-history', 'automatic'));
ALTER TABLE events ADD COLUMN holiday_id INTEGER;
CREATE INDEX events_project ON events(project_id, effective_date);
CREATE TABLE event_phase_changes (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
  phase_name TEXT NOT NULL,
  parent_name TEXT,
  before_start TEXT NOT NULL,
  before_end TEXT NOT NULL,
  after_start TEXT NOT NULL,
  after_end TEXT NOT NULL
);
CREATE INDEX event_phase_changes_event ON event_phase_changes(event_id);
CREATE TABLE event_responsibility (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  party_id INTEGER REFERENCES list_values(id),
  days REAL NOT NULL
);
CREATE INDEX event_responsibility_event ON event_responsibility(event_id);
CREATE TABLE event_edits (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  edited_at TEXT NOT NULL,
  before_json TEXT NOT NULL
);
INSERT INTO list_values (list, name, name_ar, sort_order) VALUES
  ('delayCause', 'Took longer than planned', 'استغرق العمل وقتاً أطول من المخطط', 0),
  ('delayCause', 'Waiting for the business user', 'بانتظار مالك العملية', 1),
  ('delayCause', 'Waiting for a decision', 'بانتظار قرار', 2),
  ('delayCause', 'External party', 'جهة خارجية', 3),
  ('delayCause', 'Team overbooked', 'تجاوز الحِمل على الفريق', 4),
  ('delayCause', 'Other', 'أخرى', 5),
  ('responsibility', 'Technical team', 'الفريق التقني', 0),
  ('responsibility', 'Business user', 'مالك العملية', 1),
  ('responsibility', 'Decision makers', 'متخذو القرار', 2),
  ('responsibility', 'External', 'جهة خارجية', 3);
```
`holiday_id` stays a plain integer, because the `holidays` table only arrives in migration 22. `event_responsibility.party_id` is NULL for **Calendar** (automatic, holidays only).

**Interfaces:**
- `shared/types.ts`:
  ```ts
  export const EVENT_TYPES = ['overload-resolved', 'phase-started', 'phase-finished', 'phase-reopened', 'date-shifted',
    'plan-changed', 'holiday-applied', 'reason-recorded'] as const;
  export type EventType = (typeof EVENT_TYPES)[number];
  export type CauseKind = 'listed' | 'early' | 'holiday';
  export type EventSource = 'prompt' | 'record-history' | 'automatic';
  export interface ProjectEvent {
    id: number; type: EventType; projectId: number;
    phase: (Ref & PhaseNameParts) | null;
    effectiveDate: ISODate; createdAt: string;
    causeKind: CauseKind | null; cause: Ref | null;
    /** Signed working days; negative = time saved. */
    delayDays: number;
    projectEnd: { before: ISODate; after: ISODate } | null;
    /** party null = Calendar. Days are split evenly unless adjusted; they add up to delayDays. */
    responsibility: { party: Ref | null; days: number }[];
    changes: { phaseId: number | null; name: string; parentName: string | null; before: DateRange; after: DateRange }[];
    note: string | null;
    entryId: number | null; attachmentId: number | null;
    source: EventSource; holidayId: number | null;
    edited: boolean;
  }
  ```
- `shared/schemas.ts`:
  ```ts
  export const responsibilitySchema = z.array(z.object({ partyId: z.number().int().positive(), days: z.number().optional() }))
    .min(1, 'validation.chooseResponsibility').max(4);
  export const reasonSchema = z.object({
    causeId: z.number({ invalid_type_error: 'validation.chooseCause' }).int().positive('validation.chooseCause'),
    responsibility: responsibilitySchema,
    note: optionalText(2000),
    entryId: optionalId, attachmentId: optionalId,
  });
  export const shiftChoiceSchema = z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('all') }), z.object({ mode: z.literal('none') }),
    z.object({ mode: z.literal('upTo'), lastMovedId: z.number().int().positive() }),
  ]);
  export const markDoneSchema = z.object({
    doneDate: isoDate, shift: shiftChoiceSchema.default({ mode: 'all' }),
    reason: reasonSchema.nullish(),                  // required when late
    responsibility: responsibilitySchema.optional(), // early finish: defaults to Technical team
    note: optionalText(2000),
  });
  export const rescheduleSchema = z.object({
    newEnd: isoDate.optional(), newStart: isoDate.optional(),
    shift: shiftChoiceSchema.default({ mode: 'all' }),
    reason: reasonSchema,
    overload: z.object({ resourceId: z.number().int().positive(), weekStart: isoDate }).optional(), // Delay a phase (Task 9)
  }).refine((v) => (v.newEnd === undefined) !== (v.newStart === undefined), { message: 'validation.newDateRequired', path: ['newEnd'] });
  export const eventEditSchema = reasonSchema; // cause, responsibility, note and evidence; never the dates
  // scheduleUpdateSchema gains: change: reasonSchema.optional()
  ```
- **Routes:**

  | Route | Behaviour |
  |---|---|
  | `POST /api/phases/:id/done` | Body `markDoneSchema`. Returns `{ project: ProjectRecord, event: ProjectEvent }`. |
  | `POST /api/phases/:id/reopen` | Clears the done date, and records `phase-reopened`. Returns the `ProjectRecord`. |
  | `POST /api/phases/:id/reschedule` | Body `rescheduleSchema`: a new expected end (overdue, or a known slip) or a new start (Delay a phase). Returns `{ project, event }`. |
  | `POST /api/phases/:id/preview` | Body `{ kind: 'done' \| 'end' \| 'start', date, shift }`. Returns `ShiftResult` **without saving**, for the prompt's preview. |
  | `GET /api/projects/:id/events` | `ProjectEvent[]`, newest `effectiveDate` first, excluding `overload-resolved`. |
  | `PUT /api/events/:id` | Body `eventEditSchema`. It writes an `event_edits` row with the event's previous cause, responsibility, note and evidence as JSON, then updates. Returns the `ProjectEvent` with `edited: true`. |

- `server/events/repo.ts`: `recordEvent(db, e: NewEvent): number` (writes the event, its changes and its responsibility rows), `listEvents(db, projectId)`, `getEvent`, and `updateEvent(db, id, input, nowIso)`.

**Rules:**
- **Mark done:**
  - `doneDate` must be on or before today (`validation.notInFuture`), and on or after the actual start, if any (`validation.doneBeforeStart`: "The done date can't be before the day it started" / «لا يمكن أن يسبق تاريخ الإنجاز تاريخ البدء»).
  - A phase with sub-phases is refused (`error.doneFromSubPhases`: "This phase is done when all its sub-phases are done" / «تُنجز هذه المرحلة عند إنجاز جميع مراحلها الفرعية»).
  - `percent_complete` becomes 100. A missing actual start is filled with the planned start, or the done date if that is earlier.
  - **Late** means `doneDate` is after the current planned end. A late finish needs `reason`; without one, it answers 400 `validation.reasonRequired` at `reason.causeId`.
  - **Early** means before the planned end. It records `cause_kind 'early'`, with the responsibility given or Technical team.
  - **On time** records `phase-finished` with `delay_days 0` and no cause.
  - `delay_days = workingDaysBetween(old planned end, doneDate)`.
  - One `phase-finished` event carries every moved piece in `event_phase_changes`, and `project_end_before` and `project_end_after`.
  - When the last not-done sub-phase is marked done, the parent is done with that date (its `actual_end` is set in the same transaction). No separate event is recorded for the parent.
  - If the phase had no actual start, a `phase-started` event is recorded too, with the start date as its date and `source 'automatic'`.
- **Reschedule:**
  - `newEnd` must be after today when the phase is overdue (`validation.newEndInPast`). It records a `date-shifted` event with `cause_kind 'listed'`.
  - `newStart` must be a working day on or after today. It records `date-shifted` too.
- **Responsibility:**
  - Parties must be `responsibility` list values (`error.unknownParty`).
  - Days default to an even split of `|delay_days|`, rounded to 0.5, with the last party taking the remainder. Given days must add up to `|delay_days|` (`validation.splitMustAddUp`: "The days must add up to {days}" / «يجب أن يكون مجموع الأيام {days}»).
  - The sign follows `delay_days`.
- **Cause:** `causeId` must be a `delayCause` value (`error.unknownCause`).
- **Evidence:** `entryId` and `attachmentId` must be the same project's (`error.unknownEntry`, `error.unknownAttachment`).
- **Plan edits:**
  - `updateSchedule` on a project that has started, where any phase's start or end changes, needs `change`. Without it, it answers 400 `validation.reasonRequired` at `change.causeId`.
  - It records one `plan-changed` event. `delay_days` is the project end's movement in working days, and every moved phase goes into `event_phase_changes`.
  - A project that hasn't started records nothing.
- **Deleting a list value** used by an event (a cause or a party) is refused, with the existing in-use message pattern.
- **Nothing is deleted from events.** Reopening a phase adds an event; it doesn't remove the finish.

- [ ] **Step 1: Write the failing tests:**
  - migration 20 upgrades a version-19 database that has an `overload-resolved` row; the row survives, and `GET /api/workload` still lists the decision;
  - **Mark done late with Yes:** Requirements planned to end Thu 8 Oct, done Mon 12 Oct, with a cause and Business user. The response has `delayDays 2`, three changes, and a project end 2 working days later. The event lists the responsibility `[{ party: Business user, days: 2 }]`.
  - Mark done late **without** a reason answers 400 `validation.reasonRequired`, and nothing changes (the phase isn't done, and there's no event);
  - **Mark done early with No:** `delayDays −3`, the cause kind is `early`, the responsibility is Technical team −3, and the followers keep their dates;
  - done in the future answers 400; done before the actual start answers 400;
  - marking the last sub-phase done makes the parent done with the same date; marking the parent answers 400 `error.doneFromSubPhases`;
  - **a responsibility split** of Technical team and Business user over 5 days defaults to 2.5 + 2.5; given 4 + 2 answers 400 `validation.splitMustAddUp`;
  - **reschedule** with `newEnd` on an overdue phase (today fixed after its end) records `date-shifted`, and the phase is no longer overdue;
  - **preview** returns the same dates the save would produce, and writes nothing (the event count is unchanged);
  - **edit an event:** `PUT /api/events/:id` changes the cause, and an `event_edits` row keeps the old cause; `edited` is true, and the dates are unchanged;
  - **plan edits:** editing phases of a started project without `change` answers 400; with it, it records `plan-changed` with the project-end movement; a not-started project records none;
  - deleting the "Team overbooked" cause after it is used answers 409, with the in-use message.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement, using `applyPieceChange` from Task 1 for every date change, and saving pieces, event, changes and responsibility in one transaction.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: Mark done, new expected ends and plan edits are recorded as events with cause, delay days and responsibility`.

---

### Task 4: Progress on the Gantt chart — the darker fill, the %, and the original plan

**Files:**
- Create: `client/gantt/GanttLegend.tsx`
- Modify: `client/gantt/Gantt.tsx` (`GanttBar.progress`, `GanttSegment.progress`, `GanttBar.baseline`, the `showBaseline` prop), `client/gantt/rows.ts` (`phaseRows` and `portfolioRows` pass the progress, done state and baseline; new detail lines; `darkerShade(color)`), `client/pages/manage/ProjectPage.tsx`, `client/pages/present/FocusPage.tsx`, `client/pages/manage/ManageDashboardPage.tsx`, `client/pages/present/PortfolioPage.tsx` (they pass nothing new; the rows carry it), `shared/i18n/*`, `client/styles.css`
- Test: `client/gantt/Gantt.test.tsx`, `client/gantt/rows.test.ts`, `client/gantt/GanttLegend.test.tsx` (new), plus Arabic tests

**What the user sees:**
- **Each phase, sub-phase and lane bar fills from its start** (the left in English, the right in Arabic) in a **darker shade of its own colour**, as far as its % complete. A done piece is filled completely.
  - `darkerShade` lowers the OKLCH lightness of the palette colours from 0.62 to 0.47. For any other colour string, it falls back to `color-mix(in oklch, <color> 72%, black)`.
- **The details card** (hover, focus or tap) gains:
  - "40% complete" / «نسبة الإنجاز 40%»;
  - when done, "Done on Mon 12 Oct" / «أُنجزت في الاثنين 12 أكتوبر»;
  - when the dates differ from Baseline 1, "Original plan: 5 Oct – 16 Oct" / «الخطة الأصلية: 5 أكتوبر – 16 أكتوبر».
- **The original plan:** on single-project charts (the project page and the focus view), `showBaseline` draws Baseline 1 as a **thin dashed outline** behind any bar whose baseline dates differ from its current dates. It sits slightly taller than the bar, so both stay visible.
  - A toggle above the project page chart, "Show the original plan" (إظهار الخطة الأصلية), is on by default, and the choice is remembered on this device (localStorage, wrapped in try/catch).
  - The portfolio and the dashboard chart don't show baselines.
- **A legend** (`GanttLegend`) under single-project charts shows swatches for "% complete (darker)" and "Original plan (dashed)". Task 12 adds the ownership outlines.
- **Nothing else changes:** the segments, lanes, labels, date labels, today line, the click that opens the side panel, and the tap behaviour all stay as they are.

- [ ] **Step 1: Write the failing tests:**
  - `phaseRows` gives a bar `progress 40` for a 40% phase, `100` for a done one, segment progress per sub-phase, and `baseline` only when the dates differ;
  - the detail lines include the %, the done date and the original plan in English and Arabic (with formatted dates, and no ISO dates in Arabic);
  - **the Gantt chart:**
    - it renders a fill `rect` with class `gantt-progress` whose width is 40% of the bar's width, starting at the bar's start x in LTR;
    - in RTL, the fill's right edge equals the bar's right edge;
    - a dashed `gantt-baseline` rect appears only with `showBaseline` and a differing baseline;
  - `darkerShade('oklch(0.62 0.12 147)')` returns `oklch(0.47 0.12 147)`;
  - the existing Gantt tests (click to open, tap, lanes, labels, date labels) pass unchanged;
  - the legend renders both swatches with Arabic labels in Arabic.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement. Draw the fill and the outline as logical boxes, through the same `box()`/`X()` helpers as the bars.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass. Restart the dev server, and check a real mouse drag in Edit phases and a bar click in the browser.
- [ ] **Step 5:** Commit with `feat: phase bars fill in a darker shade as they progress, show their % and the original plan as a dashed outline`.

---

### Task 5: The Progress tab, Mark done and the shift prompt

**Files:**
- Create: `client/pages/manage/ProgressTab.tsx`, `client/pages/manage/DateChangesLog.tsx`, `client/components/MarkDoneDialog.tsx`, `client/components/RescheduleDialog.tsx`, `client/components/ShiftChoiceFields.tsx`, `client/components/ReasonFields.tsx`, `client/components/ProgressControls.tsx`
- Modify: `client/pages/manage/ProjectPage.tsx` (`TAB_KEYS` gains `'progress'`, second; the header line), `client/pages/manage/ProjectTabs.tsx`, `client/components/PhasePanel.tsx` (manage mode: `ProgressControls` in its summary), `client/pages/manage/EditPhasesPage.tsx` (the "Why are the dates changing?" section; done phases locked; a pinned phase shows "Fixed start" with "Follow the one before"), `client/pages/manage/PhasesFields.tsx` and `SubPhaseList.tsx` (the locked and fixed-start display), `client/api.ts`, `shared/i18n/*`, `client/styles.css`
- Test: `client/pages/manage/ProgressTab.test.tsx` (new), `client/components/MarkDoneDialog.test.tsx` (new), `client/components/RescheduleDialog.test.tsx` (new), `client/components/PhasePanel.test.tsx`, `client/pages/manage/EditPhasesPage.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `projectScreens.ar.test.tsx`, `client/i18n/noEnglish.test.tsx`

**What the user sees:**
- **The project header** gains one line under the span: "Original end Thu 3 Dec · Current end Tue 8 Dec (+3 working days) · 42% complete · Behind pace (12%)" / «الانتهاء في الخطة الأصلية: … · الانتهاء الحالي: … (+3 أيام عمل) · نسبة الإنجاز 42% · أبطأ من المتوقع (12%)». When the two ends are equal, it reads "On the original plan" / «وفق الخطة الأصلية».
- **The Progress tab (التقدّم):**
  - **A phase table** with one row per phase, and its sub-phases indented under it. The columns:
    - name;
    - original plan (Baseline 1 dates, or "Added later" / «أُضيفت لاحقاً»);
    - current plan;
    - actual start;
    - done date;
    - % complete (a number input 0–100 with a Save button per row, disabled for parents, which show their worked-out %);
    - pace ("On pace", "Behind pace (12%)" or "Ahead (8%)");
    - status ("Not started", "In progress", "Done", or "Overdue" in red);
    - actions: **Mark done**, or **Reopen** for a done row. A parent shows neither, and its tooltip explains why.
  - **Update progress:** changing a % and saving sends `PUT /progress`. The first save above 0 on a not-started row asks for **Started on**, defaulting as Task 2 describes.
  - **The Date changes log** (سجل تغيير التواريخ), newest first. Each event shows:
    - its date;
    - an icon for its type;
    - the phase;
    - "Finished 2 working days late" / "Finished 3 working days early" / "New expected end: Tue 20 Oct" / "Phases edited" / "Public holiday: {name}";
    - its cause, its responsibility as tags with their days ("Business user · 2 days" / «مالك العملية · يومان»);
    - the phases it moved (collapsed: "Moved 3 phases" → the before → after dates);
    - the project end's movement;
    - its note and evidence link;
    - an "edited" tag.

    **Edit** opens `ReasonFields` for the cause, responsibility, note and evidence (never the dates).
- **`MarkDoneDialog`** (`role="dialog"`, `aria-modal`, Escape closes it, focus is trapped and returned):
  - **When was it finished?** **Today** (the default) or **On an earlier date**, with a date input limited to today at most.
  - When the chosen date differs from the planned end, it says "That's 2 working days late" / «أي بعد موعدها المخطط بيومَي عمل» (or early). Then:
    - **`ShiftChoiceFields`:** "Shift the following phases?" with **Yes** (the default), **No — keep their dates** and **Partially**. Partially shows "Move up to and including…" with a select over the followers, in order. Below the choice, a **live preview** (from `POST /preview`) lists what moves: "UAT: Sun 8 Nov → Wed 11 Nov (+3)", then the project end "Current end: Tue 8 Dec → Fri 11 Dec". With no followers, the question isn't shown.
    - **`ReasonFields`, for a late finish (required):**
      - **Cause**, a select over the Delay causes list, with "+ Add new cause…" inline;
      - **Responsibility**, checkboxes over the Responsibility list. When two or more are ticked, "Adjust the split" shows days per party, which must add up;
      - **Note**, optional;
      - **Evidence**, optional: a select of the project's meetings and updates, and one of its files.
    - **For an early finish:** a Responsibility line, preset to Technical team, and a note.
  - **Save** sends `POST /done`. Errors show through `messagesOf`.
- **`RescheduleDialog`:** "The phase is overdue. When do you now expect it to end?" / «تجاوزت المرحلة موعد انتهائها. متى تتوقع انتهاءها الآن؟». It has a **New expected end** (after today), the same `ShiftChoiceFields` with a preview, and the required `ReasonFields`. It's used from the Progress tab's "Overdue" status ("Record the reason" link), the side panel and the inbox (Task 9).
- **The phase side panel (manage mode)** shows `ProgressControls` in its summary: the %, with Save, the pace, Mark done or Reopen, and for an overdue phase "Record the reason and a new expected end". Read-only mode (the focus view) shows only "40% complete" or "Done on …".
- **Edit phases:**
  - a done phase shows "Done" (منجزة) with its dates; its working days are read-only, and it has no drag handle and no remove button;
  - a phase with a fixed start shows "Starts on Sun 8 Nov (fixed)" / «تبدأ في … (تاريخ ثابت)» and a **Follow the one before** button, which sends `pinnedStart: null` for it;
  - when the project has started and saving would move any date, a **Why are the dates changing?** section appears above Save, with `ReasonFields` (required), and the request carries `change`.

- [ ] **Step 1: Write the failing tests:**
  - the Progress tab lists phases and sub-phases with their original and current dates, and a parent's % input is disabled and shows the worked-out %;
  - saving 40% on a not-started sub-phase asks for Started on, then sends `PUT /progress` with `{ percent: 40, startedOn }`;
  - **Mark done late:** choosing "On an earlier date" with a date 2 working days after the planned end shows "2 working days late", the shift question with Yes selected, and a preview line for UAT. Saving without a cause shows "Choose a cause" / «اختر السبب» and sends nothing. With a cause and Business user, it sends `POST /done` with `shift {mode:'all'}` and the reason.
  - **Partially:** choosing the second follower sends `{ mode: 'upTo', lastMovedId }`;
  - **early finish:** no cause field, Technical team preset;
  - **a parent row** has no Mark done;
  - **Reopen** sends `POST /reopen`;
  - **the Date changes log** shows a late finish with "Business user · 2 days", its moved phases after expanding, and "edited" after an edit. Editing sends `PUT /api/events/:id`;
  - **the side panel** (manage) shows the % and Mark done; the focus view panel shows "40% complete" and no buttons;
  - **Edit phases:** a done phase has no drag handle or remove button; saving a started project with a moved date shows the reason section and blocks Save until a cause and responsibility are chosen;
  - **the header** shows the original and current ends with "+3 working days";
  - **Arabic renders** of the tab and both dialogs, with the Arabic dual («يومَي عمل»);
  - **the no-English guard** covers the Progress tab, `MarkDoneDialog` open with a preview, and `RescheduleDialog`.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass. Restart the dev server, and try Mark done late, and a real mouse drag in Edit phases.
- [ ] **Step 5:** Commit with `feat: the Progress tab — update progress, Mark done today or earlier, and decide whether the following phases move, with the cause and who was responsible`.

---

### Task 6: Record-history mode — the wizard's Actual dates step and Record past dates

**Why:** past projects need their original plan and what really happened, recorded without decision prompts, so the charts tell their true story.

**Files:**
- Create: `client/pages/manage/ActualsTable.tsx`, `client/pages/manage/RecordPastDatesPage.tsx`
- Modify: `shared/schemas.ts` (`historyInputSchema`; `newProjectSchema` gains `history`), `server/progress/repo.ts` (`recordHistory`), `server/projects/repo.ts` (`createProject` applies `history` inside its transaction), `server/baselines/repo.ts` (`replaceBaselineOne`), `server/app.ts`, `client/pages/manage/CreateProjectPage.tsx` (step 5), `client/pages/manage/projectDraft.ts`, `client/App.tsx` (route `/manage/projects/:id/actuals`), `client/pages/manage/ProgressTab.tsx` (the "Record past dates" link), `shared/i18n/*`
- Test: `server/progress/history.test.ts` (new), `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/RecordPastDatesPage.test.tsx` (new), plus Arabic tests and the no-English guard

**Interfaces:**
```ts
const historyRow = {
  actualStart: isoDate.nullish(), doneDate: isoDate.nullish(),
  percent: z.number().int().min(0).max(100).nullish(),
  reason: z.object({ causeId: optionalId, responsibility: responsibilitySchema.optional(), note: optionalText(2000) }).nullish(),
};
export const historyInputSchema = z.object({
  phases: z.array(z.object({ phaseId: z.number().int().positive(), ...historyRow })).max(500),
  /** Only while the project has no recorded events: the original plan's working days per phase id. */
  originalPlan: z.array(z.object({ phaseId: z.number().int().positive(), durationDays: workingDays })).optional(),
});
// newProjectSchema gains:
history: z.array(z.object({ phaseIndex: z.number().int().min(0), subIndex: z.number().int().min(0).nullable(), ...historyRow })).default([]),
```
- **Route:** `POST /api/projects/:id/history` with `historyInputSchema` returns the `ProjectRecord`.

**Rules:**
- **Order.** Rows are applied in plan order: top-level phases by order, each one's sub-phases before the next.
  - An actual start is recorded as a `phase-started` event.
  - A done date goes through `applyPieceChange` with **`{ mode: 'all' }`** (no prompt), and records `phase-finished` with `source 'record-history'` and `effective_date = doneDate`.
  - A late row without a reason is recorded with `cause_kind` and `cause_id` NULL, and shows as "Reason not recorded" (السبب غير مسجّل). An early row gets `cause_kind 'early'`.
- **Validation:**
  - dates must be on or before today (`validation.notInFuture`);
  - a done date must be on or after the actual start;
  - a parent with sub-phases takes no done date or % (`error.doneFromSubPhases`);
  - issues are reported at `phases.<i>.<field>` (or `history.<i>.<field>` in the wizard), and **nothing** is saved.
- **The wizard:** the phases entered are the original plan. Baseline 1 is saved with `source 'record-history'` before the history is applied.
- **`originalPlan`** (existing projects only):
  - it's allowed only while the project has **no events** other than `overload-resolved` (`error.historyAlreadyRecorded`: "Dates are already recorded for this project, so its original plan can't change" / «سُجّلت تواريخ لهذا المشروع، لذا لا يمكن تعديل خطته الأصلية»);
  - it recomputes the baseline dates with `schedulePhases` from the project's start date and those working days, replaces Baseline 1 (`source 'record-history'`), and leaves the current plan alone;
  - the history rows are then applied.

**What the user sees:**
- **Wizard step 5, Actual dates (التواريخ الفعلية)**, appears only when the start date is before today.
  - The hint: "This project has already started. Enter what really happened; the phases above are its original plan." / «بدأ هذا المشروع بالفعل. أدخل ما حدث فعلاً، فالمراحل التي أدخلتها هي خطته الأصلية.»
  - `ActualsTable` has one row per phase and sub-phase: its planned dates (read-only), **Actual start**, **Done on**, **% complete** (for ones not done) and, when the done date is after the planned end, an optional **Reason** (cause and responsibility).
  - Rows can be left empty.
  - The wizard's steps show five steps only in that case.
- **Record past dates (تسجيل التواريخ السابقة):** a page for an existing project, linked from the Progress tab.
  - It has the same `ActualsTable`, pre-filled with what is recorded, with already-done rows read-only.
  - While the project has no recorded events, an **"Original plan"** section above it lets the user enter each phase's original working days, with a live preview of the original dates.
  - Save sends `POST /history`.

- [ ] **Step 1: Write the failing tests:**
  - **The server.** Recording done dates for three phases in order, where Development finished 4 working days late with no reason, gives three `phase-finished` events with `source 'record-history'`. The late one has a null cause, the followers moved automatically, and the project end moved +4.
  - a past-project wizard POST with `history` creates the project, Baseline 1 (`source 'record-history'`) equal to the entered plan, and the actual dates;
  - an invalid row (a done date before the actual start) saves **nothing**, not even the project;
  - `originalPlan` on a project without events replaces Baseline 1; after an event, it answers 409 `error.historyAlreadyRecorded`;
  - **the wizard** shows step 5 only for a past start date, and sends `history` rows with `phaseIndex` and `subIndex`;
  - **Record past dates** pre-fills the recorded dates and sends the rows; the Original plan section is hidden once events exist;
  - Arabic renders and the no-English guard for step 5 and the page.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: record-history mode — enter a past project's original plan and actual dates, recorded without prompts`.

---

### Task 7: Lateness warnings — the engine, the settings, reasons and dismissals

**Files:**
- Create: `shared/warnings.ts`, `server/warnings/repo.ts`, `client/pages/manage/ProgressRulesCard.tsx`
- Modify: `server/db.ts` (migration 21), `server/settings.ts` (`getProgressRules`, `setProgressRules`), `shared/types.ts`, `shared/schemas.ts` (`progressRulesSchema`, `phaseReasonSchema`), `server/app.ts`, `client/pages/manage/SettingsPage.tsx`, `shared/i18n/*`, `client/api.ts`, `client/testing/mockFetch.ts` (`sampleWarnings()`)
- Test: `shared/warnings.test.ts` (new), `server/warnings/warnings.test.ts` (new), `client/pages/manage/SettingsPage.test.tsx`

**Migration 21:**
```sql
CREATE TABLE warning_dismissals (
  key TEXT PRIMARY KEY,
  dismissed_at TEXT NOT NULL
);
```

**Interfaces:**
```ts
export const WARNING_KINDS = ['overdue', 'behind', 'end-at-risk', 'reminder', 'confirm-done'] as const;
export type WarningKind = (typeof WARNING_KINDS)[number];
export interface ProgressRules { behindThreshold: number; reminderDays: number }
export const DEFAULT_PROGRESS_RULES: ProgressRules = { behindThreshold: 20, reminderDays: 14 };
export interface Warning {
  kind: WarningKind;
  project: { id: number; name: string };
  /** null = the project itself (end-at-risk, the project's reminder). */
  phase: (Ref & PhaseNameParts) | null;
  /** The end date concerned: the planned end, the forecast end (end-at-risk) or the reminder's end. */
  date: ISODate;
  /** overdue: working days past; behind: the gap in points; end-at-risk: working days late; reminder: calendar days left. */
  days: number;
  expected: number | null; actual: number | null;           // behind only
  committedEnd: ISODate | null;                             // end-at-risk only
  /** end-at-risk: the recorded causes of the slips, largest first; behind: the recorded reason, if any. */
  reasons: { causeKind: CauseKind | null; cause: Ref | null; days: number }[];
  needsDecision: boolean;
  /** kind:subject:value — a new value (e.g. a later end date) gives a new key, so a dismissed warning comes back when it changes. */
  key: string;
  dismissed: boolean;
}
/** The current plan, with each overdue not-done piece assumed to end on the next working day after today and every follower moving. */
export function forecastEnd(project: ProjectRecord, today: ISODate, cal: WorkCalendar): ISODate | null;
export function projectWarnings(project: ProjectRecord, events: ProjectEvent[], rules: ProgressRules, today: ISODate, cal: WorkCalendar): Warning[];
```
- **Routes:**

  | Route | Behaviour |
  |---|---|
  | `GET /api/warnings` | Every project's warnings, with `dismissed` set from the table. Projects whose phases are all done are skipped. |
  | `GET /api/projects/:id/warnings` | One project's warnings. |
  | `POST /api/warnings/dismiss` | Body `{ key }`. Only `reminder` and `end-at-risk` keys can be dismissed (`error.cannotDismiss`). |
  | `GET /api/settings/progress-rules`, `PUT /api/settings/progress-rules` | `{ behindThreshold: 5–90, reminderDays: 1–90 }`. |
  | `POST /api/phases/:id/reason` | Body `reasonSchema`. Records a `reason-recorded` event (`delay_days 0`, no date changes) for a behind-schedule phase. |

**Rules:**
- **Overdue:** a not-done phase or sub-phase whose current planned end is before today. `days = workingDaysBetween(end, today)`. `needsDecision` is true. A parent is overdue only if it has no sub-phases; its overdue sub-phases speak for it.
- **Confirm done:** a not-done piece at 100%, whether before or after its end, has `needsDecision` true ("{phase} reached 100% — confirm when it was finished" / «بلغت {phase} نسبة 100% — أكّد تاريخ إنجازها»). A piece that is both overdue and at 100% shows only confirm-done.
- **Behind:**
  - an in-progress, not-overdue piece whose `gap ≤ −behindThreshold`;
  - `needsDecision` is true until a `reason-recorded` event exists for that phase; after that it shows on the project page with the reason, but not in the inbox.
- **End at risk:**
  - `forecastEnd` is later than `project.baselineEnd` by at least one working day;
  - `days` is the working days late;
  - `reasons` sums the events' `delay_days > 0` by cause (cause kind and cause), largest first;
  - it can be dismissed, and comes back when `days` grows (the value is in the key).
- **Reminder:** a not-done top-level phase, sub-phase or the project end, where `0 ≤ daysBetween(today, end) ≤ reminderDays`. `needsDecision` is false. It can be dismissed per end date.
- **Warnings are only for projects that have started** (Task 2's rule), apart from reminders, which also cover the first phase of a project starting within the window.

**What the user sees (Settings):** a **Progress warnings** card (تنبيهات التقدّم):
- "Warn when progress is behind the time used by [20] percentage points" / «نبّهني عندما تقل نسبة الإنجاز عن الوقت المنقضي بمقدار [20] نقطة مئوية»;
- "Remind me [14] days before a phase or project ends" / «ذكّرني قبل انتهاء المرحلة أو المشروع بـ[14] يوماً»;
- Save.

- [ ] **Step 1: Write the failing tests** (`shared/warnings.test.ts` with today fixed and a hand-built project):
  - a phase that ended yesterday and isn't done is overdue by 1 working day; after a `newEnd` reschedule, it isn't;
  - a phase at 100% before its end gives confirm-done only;
  - **behind:** 40% with 70% expected and threshold 20 gives `behind` with gap 30; with threshold 35, it gives nothing; after a `reason-recorded` event, `needsDecision` is false;
  - **end at risk:** a project with a +3 late finish (Business user) and an overdue UAT gives `forecastEnd` beyond the baseline end, `days` = 3 + the overdue days, and the reasons list the cause;
  - **reminders:** a phase ending in 10 days gives a reminder with `days 10`; one ending in 20 days gives none; a done phase gives none;
  - a project not yet started gives no warnings except a reminder for its first phase;
  - **the server:**
    - dismissing a reminder hides it from `GET /api/warnings` (`dismissed: true`);
    - moving that phase's end brings it back;
    - dismissing an overdue key answers 400 `error.cannotDismiss`;
    - `PUT /progress-rules` validates its ranges;
  - **the Settings card** saves both values, and renders in Arabic.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: four lateness warnings — overdue, behind schedule, project end at risk and a reminder before the end — with their settings`.

---

### Task 8: Public holidays, with the shift prompt

**Files:**
- Create: `server/holidays/repo.ts`, `client/pages/manage/HolidaysCard.tsx`, `client/pages/manage/HolidayDecisionDialog.tsx`
- Modify: `server/db.ts` (migration 22), `server/settings.ts` (`getCalendar` reads the holidays from the table; `setCalendar` writes only the weekend), `shared/schemas.ts` (`holidayInputSchema`, `holidayDecisionsSchema`), `shared/types.ts` (`HolidayRecord`, `HolidayImpact`, `PendingHolidayDecision`), `shared/capacity.ts` (a `holiday` flag on `DayLoad`), `client/pages/manage/DayHeatmap.tsx` and `WorkloadHeatmap.tsx` (holiday days shown in their own style), `server/app.ts`, `client/pages/manage/SettingsPage.tsx`, `shared/i18n/*`, `client/api.ts`, `client/styles.css`
- Test: `server/holidays/holidays.test.ts` (new), `shared/capacity.test.ts`, `client/pages/manage/HolidaysCard.test.tsx` (new), `client/pages/manage/DayHeatmap.test.tsx`, plus Arabic tests and the no-English guard

**Migration 22:**
```sql
CREATE TABLE holidays (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE holiday_decisions (
  holiday_id INTEGER NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'add' CHECK (kind IN ('add', 'remove')),
  decision TEXT CHECK (decision IN ('shift', 'keep')),
  decided_on TEXT,
  PRIMARY KEY (holiday_id, project_id, kind)
);
INSERT INTO holidays (name, start_date, end_date, created_at)
  SELECT 'Public holiday', json_extract(h.value, '$.start'), json_extract(h.value, '$.end'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM settings s, json_each(s.value, '$.holidays') h WHERE s.key = 'calendar';
UPDATE settings SET value = json_set(value, '$.holidays', json('[]')) WHERE key = 'calendar';
```
A removed holiday's row is deleted only once every `remove` decision has been answered. Until then, it is kept with `kind 'remove'` rows pending, and `getCalendar` leaves it out.

**Interfaces:**
- `HolidayRecord { id; name; start: ISODate; end: ISODate; workingDays: number }`.
- `HolidayImpact { project: { id; name }; changes: PieceChange[]; projectEnd: { before; after } }`: the preview of **Shift**.
- **Routes:**

  | Route | Behaviour |
  |---|---|
  | `GET /api/holidays` | Returns the holidays, soonest first. |
  | `POST /api/holidays` | Body `{ name, start, end }`. Returns `{ holiday, affected: HolidayImpact[] }`. It creates one pending `holiday_decisions` row per affected project. A holiday that ends before today affects nothing, so no rows. |
  | `POST /api/holidays/:id/decisions` | Body `{ decisions: [{ projectId, decision: 'shift' \| 'keep' \| 'later' }] }`. It applies each decided one with `applyHoliday` in one transaction, and records one `holiday-applied` event per project. |
  | `DELETE /api/holidays/:id` | Returns `{ affected }` in reverse (the phases would move back). With none affected, it deletes straight away. |
  | `GET /api/holidays/pending` | Returns `PendingHolidayDecision[]` for the inbox. |

**Rules:**
- **Validation:** the name is required (1–100 characters), and the end is not before the start (`validation.endBeforeStart`).
- **Affected** means the project has a not-done piece whose current span includes a working day inside the holiday.
- **The `holiday-applied` event:** `cause_kind 'holiday'`, `holiday_id`, `effective_date` = the holiday's start, and `delay_days` = the project end's movement in working days (0 for **keep**). It has one responsibility row, `party_id NULL` (Calendar), with the same days, and every moved piece in `event_phase_changes`.
- **Decide later** leaves the row pending.
- **Two holidays at once:** until a pending project is decided, its dates are as before. `rescheduleAll` then uses the calendar **without** that holiday for that project, so a later unrelated reschedule doesn't silently apply it. `getCalendarFor(db, projectId)` returns the calendar minus the holidays still pending for that project. Every schedule computation in `server/progress/repo.ts` uses it.
- **The heatmap:** a holiday day is shown as a block with a holiday style and the label "Holiday" / «عطلة رسمية», instead of being hidden. It isn't counted as available or booked.

**What the user sees:**
- **Settings, a Public holidays card (العطل الرسمية):**
  - a list of name, dates (with weekdays) and working days, soonest first, with past ones in a collapsed "Past holidays (N)" list;
  - **+ Add holiday** takes a name, a start and an end (defaulting to the start).
- **`HolidayDecisionDialog`** opens after adding a holiday that affects projects:
  - "Eid Al Adha (Mon 25 May – Thu 28 May) falls inside 3 projects' plans. What should happen to their phases?" / «تقع عطلة … ضمن خطط 3 مشاريع. ماذا تريد أن يحدث لمراحلها؟»;
  - one row per project: its name, "Shift the phases (+2 working days, ends Tue 8 Dec)", **Keep the dates** and **Decide later**, with Shift chosen by default. Expanding a row shows the phases that would move;
  - **Save**.
- **Deleting** a future holiday with affected projects opens the same dialog in reverse: **Move the phases back** or **Keep the dates**.
- **The Resources heatmap** shows holiday days in their own style.

- [ ] **Step 1: Write the failing tests:**
  - migration 22 moves a JSON holiday into the table, and `getCalendar` returns it;
  - adding a 2-day holiday inside Development returns one affected project, with a preview end 2 working days later;
  - **shift:** deciding `shift` moves Development and UAT, and records `holiday-applied` with `delay_days 2` and a Calendar responsibility (party null, 2 days);
  - **keep:** the dates are unchanged, the working days are shortened, and the event has `delay_days 0`;
  - **later:** the decision stays pending in `GET /api/holidays/pending`; a Mark done on another phase of that project meanwhile doesn't apply the holiday; deciding later applies it;
  - a holiday entirely in the past creates no decisions;
  - deleting a holiday with a `shift` applied offers "move back", and deciding it pulls the phases 2 working days earlier (`delay_days −2`);
  - **the heatmap:** `DayLoad.holiday` is true on the holiday, and the day shows "Holiday" and is not red;
  - **the Settings card** adds a holiday, opens the dialog, and sends the decisions; Arabic renders and the no-English guard cover the card and the dialog.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: public holidays in Settings — adding one asks whether to shift each affected project's phases, recorded as a Calendar cause`.

---

### Task 9: The "Needs your decision" inbox, warnings on the project page and panel, and Delay a phase

**Files:**
- Create: `client/pages/manage/DecisionInbox.tsx`, `client/components/WarningList.tsx`
- Modify: `client/pages/manage/ManageDashboardPage.tsx` (the inbox replaces the overbooking notice; the project table gains Current phase, %, Pace and Original vs current end), `client/pages/manage/ProjectPage.tsx` (a warnings strip above the tabs), `client/components/PhasePanel.tsx` (manage mode: that phase's warnings), `client/pages/manage/OverloadPanel.tsx` (**Delay a phase** switches on), `shared/types.ts` (`OVERLOAD_DECISIONS` gains `'delay'`), `server/progress/repo.ts` (a reschedule with `overload` also records the overload decision `delay`), `shared/i18n/*`, `client/styles.css`
- Test: `client/pages/manage/DecisionInbox.test.tsx` (new), `client/pages/manage/ManageDashboardPage.test.tsx`, `client/pages/manage/OverloadPanel.test.tsx`, `client/pages/manage/ProjectPage.test.tsx`, `client/components/PhasePanel.test.tsx`, `server/progress/progress.test.ts`, plus Arabic tests and the no-English guard

**What the user sees:**
- **The dashboard's "Needs your decision" (بانتظار قرارك) card** is at the top, with a count in its heading. It is loaded from `GET /api/warnings`, `GET /api/holidays/pending` and the workload.
  - **Needs your decision** items, most urgent first:
    - **Overdue:** "Case Management System › UAT is 3 working days overdue" / «تجاوزت مرحلة … موعد انتهائها بـ3 أيام عمل», with **Record the reason** (opens `RescheduleDialog`);
    - **Confirm done:** "… › QA reached 100% — confirm when it was finished", with **Mark done** (opens `MarkDoneDialog`);
    - **Behind schedule:** "… › Development: 40% done, 70% of the time used" / «… الإنجاز 40% بعد مضي 70% من الوقت», with **Record a reason** (a small dialog with `ReasonFields`, which sends `POST /reason`);
    - **Project end at risk:** "Internal Reporting Dashboard is likely to finish 6 working days after its committed end (Thu 6 Aug): Waiting for the business user 4 days, Reason not recorded 2 days", with **See the project** and **Got it** (dismiss);
    - **Holiday decisions:** "National Day: decide for 1 project", with **Decide** (opens `HolidayDecisionDialog` for the pending ones);
    - **Overbooked people:** the existing notice's text (`dashboard.overbookedOne` / `overbookedMany`), with **See the workload**.
  - **Coming up** (قريباً), collapsed when there's more than 3: reminders, such as "UAT ends in 10 days (Mon 2 Nov)" / «تنتهي مرحلة … خلال 10 أيام (الاثنين 2 نوفمبر)», each with **Got it**.
  - When everything is clear: "Nothing needs your decision." / «لا يوجد ما ينتظر قرارك».
- **The project table** gains **Current phase** (the first not-done top-level phase whose span includes today, or the next one), **%**, **Pace**, and **Original end → Current end**, the second in amber when later.
- **The project page:** a **warnings strip** above the tabs lists this project's warnings (dismissed ones muted), using `WarningList` with the same actions.
- **The phase side panel (manage):** that phase's warnings at the top of its summary, with their actions.
- **The overbooking prompt:** **Delay a phase** (تأجيل مرحلة) is enabled.
  - It lists that week's phases of the overbooked person ("Case Management › Development") with a **New start** date input, defaulting to the Monday after the week.
  - Then `ShiftChoiceFields` with a preview, and `ReasonFields`: the cause is preselected as "Team overbooked", and the responsibility is left empty.
  - Saving sends `POST /api/phases/:id/reschedule` with `newStart` and `overload: { resourceId, weekStart }`. The server records the `date-shifted` event **and** an `overload-resolved` decision `delay` for that week, in one transaction. The week then shows as resolved, like Accept.
  - **Pause a project** stays disabled until M11.

- [ ] **Step 1: Write the failing tests:**
  - **the inbox** shows an overdue item, a confirm-done item, a behind item, an end-at-risk item with its reasons, a holiday item and the overbooking text, in that order, and a reminder under Coming up;
  - **Record the reason** opens `RescheduleDialog`, and saving refreshes the inbox;
  - **Got it** sends `POST /api/warnings/dismiss` and removes the item;
  - with nothing to show, the empty sentence appears;
  - the existing dashboard tests pass (the overbooking wording is unchanged, now inside the inbox);
  - **the project table** shows the current phase, %, pace and both ends;
  - **the project page** shows its warnings strip, and **the side panel** shows the phase's overdue warning with its action;
  - **Delay a phase:**
    - the button is enabled;
    - choosing a phase and a new start sends the reschedule with `overload`;
    - the server test confirms both the `date-shifted` event and the `delay` decision, and the week is no longer counted as overbooked;
  - Arabic renders of the inbox with Arabic plurals ("3 أيام عمل", "يوما عمل"), and the no-English guard for the dashboard with every item kind.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: the "Needs your decision" inbox on the dashboard, warnings on the project page and side panel, and Delay a phase in the overbooking prompt`.

---

### Task 10: Demo progress, lateness, holidays and history (for the intermediate checkpoint)

**Files:**
- Modify: `server/demoData.ts`, `server/demoData.test.ts`
- Test: `server/demoData.test.ts`

**The data** (every date is fixed, never `todayLocal()`, and every change goes through the repo functions of Tasks 2–8, so the events are real):
- **Legacy Archive Migration** (2025, past), recorded with `recordHistory`:
  - all phases done;
  - Development finished **8 working days late**, "Waiting for the business user", Business user;
  - QA finished **2 working days early**;
  - Baseline 1 is the demo plan.
- **Customer Portal Revamp** (the first half of 2026, past), recorded with `recordHistory`:
  - Design finished **3 working days early**;
  - UAT finished **5 working days late**, "Waiting for the business user", Business user, with the note "Business testers were only available from the second week";
  - Security testing and Launch finished on time;
  - everything is done.
- **HR Self-Service** (past): every phase done on time (a clean project for comparison).
- **Case Management System** (active):
  - Requirements gathering to Design are done;
  - Business analysis finished **4 working days late** ("Took longer than planned", Technical team) with **No — keep the following dates**, so the M4/M5 demo weeks don't move;
  - Development is at **40%**, so the behind-schedule warning shows during the review weeks;
  - one of its sub-phases, if it has any, is done on time.
- **Internal Reporting Dashboard** (June–August 2026):
  - Requirements and Development are done;
  - QA is at **100%, not confirmed** (confirm-done);
  - **UAT is overdue, with no reason** (overdue, and project end at risk).
- **A public holiday:** **National Day / اليوم الوطني**, Wed 2 Dec – Thu 3 Dec 2026.
  - Case Management System **shift**, if the M4/M5 demo assertions still hold; otherwise **keep**, and note it in the test.
  - E-Services Mobile App: **Decide later**, so it waits in the inbox.
- **The Arabic project and E-Services** have no progress yet (they start in the future).
- **Existing demo assertions** (M4–M7) stay unchanged. If a workload week moves, choose "keep the dates" for that change, rather than editing an expected value.

- [ ] **Step 1: Write the failing test** (with `buildApp(db, { today: () => '2026-09-26' })` after seeding):
  - Legacy Archive and Customer Portal have every phase done, and `GET /api/projects/:id/events` shows the late and early finishes with their causes;
  - Customer Portal's current end is 2 working days after its Baseline 1 end (+5 −3);
  - Case Management's Business analysis event has `delayDays 4` and no moved followers;
  - `GET /api/warnings` includes Internal Reporting's overdue UAT, the QA confirm-done, the end-at-risk, and Case Management's behind-schedule Development;
  - `GET /api/holidays/pending` lists E-Services for National Day;
  - the M4–M7 demo assertions pass unchanged.
- [ ] **Step 2:** Run the test and confirm it FAILS.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: demo progress, late and early finishes, warnings and a public holiday`.

---

### ✅ Checkpoint A: stop and let the user review the core

1. In a **frozen worktree** of this commit (ports other than 3001/5173): delete its `data/pm.db` and `attachments/`, run `npm run seed` ("Added 7 demo projects."), then `npm run dev`. Give the LAN URL too.
2. **The dashboard, in Arabic:** «بانتظار قرارك» shows Internal Reporting's overdue UAT, QA at 100% waiting for confirmation, the project end at risk with its reasons, Case Management's Development behind schedule, the National Day decision for E-Services, and any overbooking. Try **Record the reason** on the overdue UAT, with a new expected end and **Partially**.
3. **Internal Reporting → Progress:** Mark QA done **on an earlier date** that is on time (it isn't late); watch the bars fill darker.
4. **Case Management → Progress:** update Development's %; Mark a phase done late with **Yes**, then look at the **Date changes** log and the dashed original plan on the chart.
5. **Customer Portal Revamp → Progress:** the recorded history; open **Record past dates**.
6. **Settings:** add a holiday that falls inside an active project and choose **Shift**; change the Progress warnings values.
7. **Resources:** an overbooked week → **Delay a phase**.
8. **Create a project that started last month:** the **Actual dates** step.
9. **Arabic:** read every new screen and dialog; review the new glossary terms.

**If the user approves, the core can be merged (fast-forward every branch), and the build continues with Task 11 on `build/m8`.**

---

### Task 11: The stakeholder charts — Where did the time go? and Why did the end date move? — and the Department filter

**Files:**
- Create: `shared/delays.ts`, `server/insights/repo.ts`, `client/pages/present/WhereTimeWentChart.tsx`, `client/pages/present/WhyEndMovedChart.tsx`, `client/pages/present/DepartmentFilter.tsx`, `client/components/EventEvidenceDialog.tsx`
- Modify: `server/app.ts` (`/api/portfolio` takes `departmentId`), `client/pages/present/PortfolioPage.tsx`, `client/pages/present/FocusPage.tsx`, `shared/types.ts`, `shared/i18n/*`, `client/api.ts`, `client/styles.css`
- Test: `shared/delays.test.ts` (new), `server/insights/insights.test.ts` (new), `server/portfolio.test.ts`, `client/pages/present/WhereTimeWentChart.test.tsx` (new), `client/pages/present/WhyEndMovedChart.test.tsx` (new), `client/pages/present/PortfolioPage.test.tsx`, `client/pages/present/FocusPage.test.tsx`, `present.ar.test.tsx`, the no-English guard

**Interfaces:**
```ts
export interface CauseLabel { causeKind: CauseKind | null; cause: Ref | null }
export interface TimeBreakdown {
  year: number;
  /** Positive delay days in the year. */
  lateDays: number;
  /** Time saved by early finishes, as a positive number. */
  savedDays: number;
  byCause: { label: CauseLabel; days: number }[];              // signed, largest first; early finishes are one negative row
  byResponsibility: { party: Ref | null; days: number }[];     // signed; party null = Calendar
  rows: { project: { id: number; name: string }; label: CauseLabel; party: Ref | null; days: number }[]; // for drill-down
}
export interface EndDateSteps {
  originalEnd: ISODate | null; currentEnd: ISODate | null;
  steps: { eventId: number; date: ISODate; type: EventType; label: CauseLabel; days: number;
    responsibility: { party: Ref | null; days: number }[];
    evidence: { entry: { id: number; title: string; effectiveDate: ISODate } | null; attachment: { id: number; name: string; mime: string; previewable: boolean } | null } }[];
  /** Working days not explained by any event (changes before M8, etc.); 0 when none. */
  otherDays: number;
}
export function timeBreakdown(events: (ProjectEvent & { projectName: string })[], year: number): TimeBreakdown;
export function endDateSteps(events: ProjectEvent[], originalEnd: ISODate | null, currentEnd: ISODate | null, cal: WorkCalendar): EndDateSteps;
```
- **Routes:**

  | Route | Behaviour |
  |---|---|
  | `GET /api/insights/time?year=2026&departmentId=` | Returns `TimeBreakdown`. The events counted are `phase-finished`, `date-shifted`, `plan-changed` and `holiday-applied`, with non-zero `delay_days` and an effective date in the year, from projects in the department (when given). |
  | `GET /api/projects/:id/end-date-steps` | Returns `EndDateSteps`. Its evidence is filtered for the presentation side: an entry only if highlighted; an attachment only if it belongs to a highlighted entry or (from Task 14) is a starred key document. No notes. |
  | `GET /api/portfolio?year=&departmentId=` | Filters the projects and the stats. |

**What the user sees (presentation side, read-only):**
- **The Department filter (مالك العملية, open question 6):**
  - a select above the portfolio: **All departments**, then each department that has projects that year;
  - it's kept in the URL (`?department=<id>`), next to `year`;
  - the tiles, the Gantt chart and Where did the time go? all follow it;
  - the focus view's Back link keeps it.
- **Where did the time go?** (أين ذهب الوقت؟), a card under the tiles on the presentation dashboard:
  - a toggle, **By cause / By responsibility** (حسب السبب / حسب المسؤولية);
  - one horizontal stacked bar of the year's late days, one segment per cause or party, each labelled "Waiting for the business user · 13 days" (and in the legend when narrow);
  - time saved shows as a separate green bar below: "Time saved by early finishes: 5 days" / «الوقت الموفَّر بالإنجاز المبكر: 5 أيام»;
  - **clicking a segment** opens a breakdown under the chart: a table by project and by the other dimension ("Customer Portal Revamp · Business user · 5 days");
  - with no events: "No delays recorded in 2026." / «لا توجد تأخيرات مسجّلة في 2026».
- **Why did the end date move?** (لماذا تغيّر موعد الانتهاء؟), on the focus view under the chart:
  - a waterfall from **Original end** (a full bar) to **Current end**;
  - each step is one event: its date, its cause, "+5 working days" or "−3" (time saved in green), and its responsibility tags;
  - "Other changes" (grey) appears when `otherDays ≠ 0`;
  - the bars run from the inline start, so it mirrors in Arabic;
  - **clicking a step** opens `EventEvidenceDialog`, read-only: the cause, the days, the responsibility, and the evidence entry (title, date, its highlighted text) and file (Preview / Download), or "No evidence attached" / «لا يوجد مستند داعم»;
  - with no movement: "The end date hasn't moved from the original plan." / «لم يتغيّر موعد الانتهاء عن الخطة الأصلية».
- **Both charts are SVG**, with `role="img"` and an `aria-label` summary, plus a visually hidden table of the same numbers for screen readers.

- [ ] **Step 1: Write the failing tests:**
  - **`timeBreakdown`:**
    - it sums a +5 (Business user) and a +8 (Business user) as Waiting for the business user 13;
    - a −3 early finish as saved 3;
    - a holiday +2 as Calendar 2;
    - events from another year are left out;
    - split responsibility (2.5 + 2.5) is counted per party;
  - **`endDateSteps`:**
    - steps only for events whose project end moved, in date order;
    - `otherDays` reconciles `workingDaysBetween(originalEnd, currentEnd)` with the steps' sum;
  - **the server:**
    - `departmentId` filters `insights/time` and the portfolio stats;
    - end-date-steps hides a non-highlighted entry's evidence, and never returns a note;
  - **the portfolio:**
    - choosing a department updates the URL, the tiles and the chart;
    - the Where-the-time-went toggle switches the segments;
    - clicking a segment shows the breakdown rows;
  - **the focus view:**
    - the waterfall shows a green step for an early finish;
    - clicking a step opens the evidence dialog;
    - the focus view still has no editing controls (the read-only guard);
  - Arabic renders (RTL bars from the right, Arabic plurals) and the no-English guard for both charts and the filter.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement (hand-made SVG; follow the Gantt's colour tokens, with green for time saved and neutral grey for "Other changes").
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: stakeholders see where the time went and why the end date moved, filtered to one department when presenting to its owner`.

---

### Task 12: Phase ownership — Technical, Business or Joint

**Files:**
- Modify: `server/db.ts` (migration 23), `shared/types.ts` (`PHASE_OWNERSHIPS`; `PhaseRecord.ownership`), `shared/schemas.ts` (`ownership` on `phaseInputSchema` and `schedulePhaseSchema`, optional, where undefined means the default for its name), `server/projects/repo.ts`, `client/pages/manage/PhasesFields.tsx` (a small Owner select per top-level phase, in the wizard and Edit phases), `client/pages/manage/projectDraft.ts`, `client/gantt/Gantt.tsx` and `rows.ts` (`GanttBar.outline`), `client/gantt/GanttLegend.tsx`, `client/components/ReasonFields.tsx` (the default responsibility follows ownership), `shared/i18n/*`, `client/styles.css`
- Test: `server/projects/projects.test.ts`, `server/db.test.ts`, `client/gantt/Gantt.test.tsx`, `client/gantt/rows.test.ts`, `client/pages/manage/CreateProjectPage.test.tsx`, `client/pages/manage/EditPhasesPage.test.tsx`, `client/components/MarkDoneDialog.test.tsx`, plus Arabic tests

**Migration 23:**
```sql
ALTER TABLE phases ADD COLUMN ownership TEXT NOT NULL DEFAULT 'technical' CHECK (ownership IN ('technical', 'business', 'joint'));
UPDATE phases SET ownership = 'business'
  WHERE parent_id IS NULL
    AND lower(trim(name)) IN ('uat', 'user acceptance testing', 'requirements sign-off', 'اختبار قبول المستخدم (uat)', 'اختبار قبول المستخدم');
```

**Rules:**
- **`defaultOwnership(name)`** lives in `shared/progress.ts`. It returns Business for UAT and "Requirements sign-off" (by the same normalisation as the phase colours), and Technical otherwise. A new phase gets it when `ownership` is omitted.
- **Sub-phases inherit** their parent's ownership; their column is ignored.

**What the user sees:**
- **The phase editors** (wizard step 3 and Edit phases) show an **Owner** select on each top-level phase: Technical team / Business user / Joint (الفريق التقني / مالك العملية / مشتركة). UAT defaults to Business user.
- **Every Gantt chart:**
  - business-owned phases (and their segments and lanes) get a **solid 2px outline** in the new `--owner-business` ink colour;
  - joint phases get a 1px outline in the same colour;
  - the details card adds "Owner: Business user" / «مالك المرحلة: مالك العملية»;
  - the legend shows both outlines;
  - the portfolio's small bars get the outline too.
- **The late-finish and overdue prompts** preselect **Business user** for a business-owned phase, both Technical team and Business user for a joint phase, and Technical team otherwise.

- [ ] **Step 1: Write the failing tests:**
  - migration 23 marks an existing UAT as business;
  - a new project's UAT is business, and a custom "Requirements sign-off" is business;
  - the Owner select saves `joint`;
  - `phaseRows` gives UAT's bar `outline 'business'`, and the Gantt chart renders the `gantt-owner-business` class on it and on its segments;
  - the legend lists the outlines in Arabic;
  - Mark done late on UAT preselects Business user;
  - Edit phases still reorders by a real mouse drag (re-check in the browser after the tests pass).
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: phase ownership — business-owned phases stand out on every chart and default the responsibility for their delays`.

---

### Task 13: To-do history and priority

**Files:**
- Create: `server/todos/history.ts`, `client/components/ToDoHistory.tsx`, `client/components/PriorityBadge.tsx`, `client/components/DiscussedToDos.tsx`
- Modify: `server/db.ts` (migration 24), `shared/types.ts` (`TODO_PRIORITIES`, `ToDoPriority`, `ToDoRecord.priority`, `ToDoRecord.updateCount`, `ToDoHistoryItem`, `EntryRecord.discussed`), `shared/schemas.ts` (`toDoInputSchema.priority`, `toDoUpdateInputSchema`, `entryInputSchema.discussed`), `server/todos/repo.ts` (priority; log due, assignee and priority changes on update), `server/entries/repo.ts` (apply `discussed` in the entry's transaction; `EntryRecord.discussed`), `server/app.ts`, `client/components/ToDoForm.tsx` (Priority), `client/components/ToDoRow.tsx` and `ToDoMetaLine.tsx` (the badge, "History (3)"), `client/components/EntryForm.tsx` (the To-dos discussed section, meetings only), `client/components/EntryItem.tsx` (lists the to-dos discussed), `client/pages/manage/ToDosPage.tsx` and `ProjectToDos.tsx` (priority filter and sort), `client/todos.ts`, `shared/i18n/*`, `client/api.ts`, `client/testing/mockFetch.ts`
- Test: `server/todos/history.test.ts` (new), `server/todos/todos.test.ts`, `server/entries/entries.test.ts`, `client/components/ToDoHistory.test.tsx` (new), `client/components/EntryForm.test.tsx`, `client/pages/manage/ToDosPage.test.tsx`, plus Arabic tests and the no-English guard

**Migration 24:**
```sql
ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent'));
CREATE TABLE todo_updates (
  id INTEGER PRIMARY KEY,
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  effective_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  note TEXT,
  changes TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX todo_updates_todo ON todo_updates(todo_id, effective_date);
CREATE INDEX todo_updates_entry ON todo_updates(entry_id);
```
`changes` is JSON: `[{ "field": "dueDate", "from": "2026-10-14", "to": "2026-10-21" }, { "field": "assignee", "from": { "id": 3, "name": "Aisha Khan" }, "to": null }, { "field": "priority", "from": "normal", "to": "urgent" }]`.

**Interfaces:**
```ts
export const TODO_PRIORITIES = ['normal', 'important', 'urgent'] as const;   // not Priority — that name is the project's high/medium/low
export type ToDoPriority = (typeof TODO_PRIORITIES)[number];
export type ToDoChange =
  | { field: 'dueDate'; from: ISODate | null; to: ISODate | null }
  | { field: 'assignee'; from: Ref | null; to: Ref | null }
  | { field: 'priority'; from: ToDoPriority; to: ToDoPriority };
export type ToDoHistoryItem =
  | { kind: 'created'; date: ISODate; sourceEntry: { id: number; title: string; effectiveDate: ISODate } | null }
  | { kind: 'update'; id: number; date: ISODate; note: string | null; changes: ToDoChange[]; entry: { id: number; title: string; effectiveDate: ISODate } | null }
  | { kind: 'done'; date: ISODate };
export const toDoUpdateInputSchema = z.object({
  note: optionalText(2000), effectiveDate: isoDate,
  dueDate: isoDate.nullish(), assigneeId: z.number().int().positive().nullish(), priority: z.enum(TODO_PRIORITIES).optional(),
}); // undefined = no change; null = clear
// entryInputSchema gains (meetings only; create and update add new discussions, existing ones are never rewritten):
discussed: z.array(z.object({ todoId: z.number().int().positive(), note: optionalText(2000),
  dueDate: isoDate.nullish(), assigneeId: z.number().int().positive().nullish(), priority: z.enum(TODO_PRIORITIES).optional() })).max(50).default([]),
// EntryRecord gains: discussed: { todoId: number; title: string; note: string | null; changes: ToDoChange[] }[]
// ToDoRecord gains: priority: ToDoPriority; updateCount: number
```
- **Routes:** `GET /api/todos/:id/history` returns `ToDoHistoryItem[]`, oldest first. `POST /api/todos/:id/updates` with `toDoUpdateInputSchema` returns the `ToDoRecord`. `/api/todos` takes `priority=important|urgent`.

**Rules:**
- **A discussed to-do** must be an **open** to-do of the same project (`error.unknownToDo`), with the usual assignee rules. Any issue is reported at `discussed.<i>.<field>`, and **nothing** is saved (no entry, no updates).
  - Its update row is dated the meeting's date, linked to the meeting, and the changes are applied to the to-do.
- **`PUT /api/todos/:id`** that changes the due date, assignee or priority writes an update row automatically (today, no note, no entry). Ticking done doesn't write one; "done" comes from `done_date`.
- **Deleting a meeting** keeps its to-do updates, with `entry_id` NULL. They read "From a deleted meeting" / «من اجتماع محذوف».
- **Private:** to-do history never appears under `/present`.

**What the user sees:**
- **Priority:**
  - the to-do form has **Priority**: Normal (the default), Important, Urgent;
  - Important shows an amber badge «مهم» and Urgent a red badge «عاجل»; Normal has no badge;
  - the To-dos page and the project's To-dos tab get a **Priority** filter (All / Important / Urgent) and a **Sort by: Due date / Priority** switch;
  - My next steps keeps its order, with the badges.
- **History:**
  - each to-do line has **History (3)** / «السجل (3)», which expands `ToDoHistory` inline:
    - "Created Sat 3 Oct, from the meeting Requirements workshop";
    - "Tue 13 Oct · Requirements review: 'Waiting for the list from Mariam' · due moved 14 Oct → 21 Oct · priority Normal → Urgent" / «… · تغيّر موعد التسليم من 14 أكتوبر إلى 21 أكتوبر · تغيّرت الأولوية من عادي إلى عاجل»;
    - "Done Mon 19 Oct";
  - **+ Add update** takes a note, a date (today by default), and optional new due date, assignee and priority.
- **The meeting form** (meetings only) has **To-dos discussed (مهام نوقشت)**:
  - **+ Add a to-do discussed** picks from the project's open to-dos (searchable, overdue first);
  - each picked one shows its title and current due date and assignee, a **What was said** note, and **Change due date / assignee / priority** fields (empty means no change);
  - when editing a meeting, the ones already discussed show read-only, and more can be added.
- **A meeting in History** lists "To-dos discussed" with each note and its changes.

- [ ] **Step 1: Write the failing tests:**
  - migration 24: existing to-dos are `normal`;
  - creating a meeting with two discussed to-dos (one moving its due date, one changing priority to urgent) applies both changes, and writes two updates linked to the meeting and dated its date;
  - a discussed to-do that is done or from another project answers 400 at `discussed.0.todoId`, and nothing is saved;
  - `PUT /api/todos/:id` with a new assignee writes an automatic update; the history shows created → update → done in order;
  - deleting the meeting keeps the updates, with `entry: null`;
  - the priority filter returns only urgent ones;
  - **the client:**
    - the form sends `priority`;
    - the badges show;
    - sorting by priority puts urgent first;
    - `ToDoHistory` renders the lines in both languages ("due moved 14 Oct → 21 Oct");
    - **+ Add update** sends `POST /updates`;
    - `EntryForm` sends `discussed` with only the changed fields;
  - `/present` shows no to-do history (the read-only guard);
  - the no-English guard for the history and the discussed section.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: to-dos keep their history — discussed in meetings or updated directly — and have a priority`.

---

### Task 14: The project summary, date requested and starred key documents

**Files:**
- Create: `server/summary/repo.ts`, `client/components/ProjectSummaryView.tsx`
- Modify: `server/db.ts` (migration 25), `shared/types.ts` (`ProjectRecord.dateRequested`, `AttachmentRecord.keyDocument`, `ProjectSummary`), `shared/schemas.ts` (`projectDetailsSchema.dateRequested`; `attachmentUpdateSchema.keyDocument`), `server/projects/repo.ts`, `server/attachments/repo.ts`, `server/insights/repo.ts` (a starred attachment is presentable as evidence), `server/app.ts`, `client/pages/manage/DetailsFields.tsx` (Date requested), `client/pages/manage/AttachmentsTab.tsx` (a star toggle per row, and a "Key documents" filter), `client/pages/manage/ProjectPage.tsx` (the summary card above the chart), `client/pages/present/FocusPage.tsx` (the summary first), `shared/i18n/*`, `client/api.ts`, `client/styles.css`
- Test: `server/summary/summary.test.ts` (new), `server/attachments/attachments.test.ts`, `server/projects/details.test.ts`, `client/components/ProjectSummaryView.test.tsx` (new), `client/pages/manage/AttachmentsTab.test.tsx`, `client/pages/present/FocusPage.test.tsx`, plus Arabic tests and the no-English guard

**Migration 25:**
```sql
ALTER TABLE projects ADD COLUMN date_requested TEXT;
ALTER TABLE attachments ADD COLUMN key_document INTEGER NOT NULL DEFAULT 0;
```

**Interfaces:**
```ts
export interface ProjectSummary {
  projectId: number;
  dates: {
    requested: ISODate | null;
    /** The day the project was saved in the app (toLocalDate of createdAt). */
    planCreated: ISODate;
    firstStarted: ISODate | null;          // the earliest actual start
    expectedFinish: ISODate | null;        // forecastEnd (Task 7); the done date of the last phase once all are done
    originalFinish: ISODate | null;        // Baseline 1 end
    /** Working days, + later / − earlier. */
    differenceDays: number;
  };
  status: { state: 'not-started' | 'on-track' | 'late' | 'done'; days: number; latestCause: CauseLabel | null };
  progress: { overall: number; development: number | null };
  keyDocuments: { id: number; name: string; type: Ref | null; mime: string; previewable: boolean }[];
}
```
- **Route:** `GET /api/projects/:id/summary` returns `ProjectSummary`, the same for both sides. It holds nothing private: no people, no notes, no M7 key dates.
- `PUT /api/attachments/:id` accepts `keyDocument: boolean`. `projectDetailsSchema` gains `dateRequested: isoDate.nullish()`, which must not be after today (`validation.notInFuture`).

**Rules:**
- **Late** means `expectedFinish` is later than `originalFinish` by at least one working day. `days` is the working days. `latestCause` is the newest event with `delay_days > 0`.
- **Done** reports "Finished {date}, {n} working days late or early", or "on time".

**What the user sees:**
- **`ProjectSummaryView` (ملخص المشروع)**, compact, in four blocks:
  - **Key dates:** Date requested · Plan created · First phase started · **Expected finish** next to the **Originally planned finish**, with "+6 working days" (amber) or "−2" (green);
  - **Status:** "On track" (وفق الخطة), or "Late by 6 working days" (متأخر 6 أيام عمل), with the latest cause: "Latest cause: Waiting for the business user";
  - **Progress:** Overall 42% and Development 38%, as small progress bars (no Development row when there is no development phase);
  - **Key documents:** ⭐ each starred file with its type, and Preview and Download; or "No key documents yet".
- **The project page:** the summary is a card at the top, above My next steps and the chart. **The focus view:** it is the first thing under the title, read-only.
- **The Attachments tab:** a ☆/⭐ toggle on each row, "Key document" (مستند رئيسي), with a hint on first use: "Key documents appear in the project summary, which stakeholders see." There's also a **Key documents** filter.
- **Edit details:** a **Date requested** field (تاريخ الطلب), optional.

- [ ] **Step 1: Write the failing tests:**
  - the summary of a project with a +6 slip reads `late`, `days 6`, with the latest cause;
  - a finished project reads `done`;
  - a project without Development has `development: null`;
  - starring an attachment puts it in `keyDocuments`; a non-starred one isn't there;
  - `dateRequested` in the future answers 400;
  - `ProjectSummaryView` renders the four blocks in English and Arabic ("متأخر 6 أيام عمل");
  - the focus view shows the summary with Preview and Download, and no editing controls;
  - the Attachments tab star sends `PUT` with `keyDocument: true`;
  - the no-English guard for the summary on both sides.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: the project summary — key dates with date requested, on track or late, overall and development progress, and starred key documents`.

---

### Task 15: Storage protection

**Files:**
- Create: `server/storage.ts`, `client/pages/manage/StoragePage.tsx`, `client/pages/manage/BackupLocationCard.tsx`, `client/pages/manage/LowSpaceNotice.tsx`
- Modify: `server/backup.ts` (`mirrorFiles`), `server/attachments/files.ts` (`moveAttachmentFileToDeleted` sets the moved file's modified time to now with `utimesSync`), `server/index.ts` (the hourly tick runs `runBackup` and `purgeDeleted`), `server/app.ts` (options `dbPath` and `freeSpace`; routes), `server/settings.ts` (`backupLocation` and `backupState`), `shared/types.ts` (`StorageReport`, `BackupState`; `BackupStatus` gains `location`, `fellBack` and `error`), `client/App.tsx` (route `/manage/storage`), `client/pages/manage/SettingsPage.tsx` (a Storage link; `BackupsCard` moves to the Storage page), `client/pages/manage/ManageDashboardPage.tsx` (`LowSpaceNotice`), `shared/i18n/*`, `client/api.ts`
- Test: `server/storage.test.ts` (new), `server/backup.test.ts`, `server/attachments/attachments.test.ts`, `client/pages/manage/StoragePage.test.tsx` (new), `client/pages/manage/ManageDashboardPage.test.tsx`, plus Arabic tests and the no-English guard

**Interfaces:**
```ts
// server/backup.ts
/** Copies every file under srcDir that destDir doesn't have yet (COPYFILE_EXCL); never overwrites or deletes. Returns how many were copied. */
export function mirrorFiles(srcDir: string, destDir: string): number;
// server/storage.ts
export function checkLocation(path: string, appDirs: { attachmentsDir: string; dataDir: string }): { ok: true } | { ok: false; code: 'error.backupLocationNotAbsolute' | 'error.backupLocationInsideApp' | 'error.backupLocationUnreachable' };
/** Daily: the database backup (backupIfDue) and the file mirror (<target>/files) to the chosen location, or to localDir when it can't be reached; saves the BackupState. */
export function runBackup(db: DatabaseSync, opts: { localDir: string; attachmentsDir: string; today: ISODate }): BackupState;
export function purgeDeleted(deletedDir: string, now: Date, days = 90): number;   // also removes the mirror's copy under <target>/files/_deleted
export function emptyDeleted(deletedDir: string): number;
export function storageReport(opts: { dbPath: string; attachmentsDir: string; localBackupDir: string; location: string | null; freeSpace: (dir: string) => number }): StorageReport;
export const LOW_SPACE_BYTES = 5 * 1024 ** 3;
export interface BackupState { lastRun: string | null; target: string; fellBack: boolean; error: string | null }
export interface StorageReport {
  databaseBytes: number; filesBytes: number; deletedBytes: number; deletedCount: number;
  backupsBytes: { local: number; location: number | null };
  freeBytes: number; lowSpace: boolean; location: string | null; lastBackup: BackupState;
}
```
- **Routes:**

  | Route | Behaviour |
  |---|---|
  | `GET /api/storage` | Returns `StorageReport`. |
  | `GET /api/storage/free` | Returns `{ freeBytes, lowSpace, backup: BackupState }`, a cheap call for the dashboard. |
  | `PUT /api/settings/backup-location` | Body `{ path: string \| null }`. `null` goes back to `backups/`. It answers 400 with the codes above. |
  | `POST /api/storage/empty-deleted` | Returns `{ removed }`. |

**Rules:**
- **The backup location** must be an absolute path (a drive path or a `\\server\share` network path), must not be inside the attachments or data folders, and must be writable **when saved**: the server creates it if missing, then writes and deletes a probe file.
  - At backup time, if it can't be reached, the backup goes to `backups/`, and `BackupState` records `fellBack: true` and the error.
- **The database backups** at the chosen location keep the newest 14, as before. **The file mirror** lives in `<target>/files/`, keeps the same folder layout (`<projectId>/`, `people/<id>/`, `_deleted/`), and only ever adds files.
- **Deleted files** older than 90 days (by modified time, which the move sets) are removed on each hourly tick, together with the mirror's copy. **Empty deleted files** removes them all now.
- **Free space** comes from `fs.statfsSync(dir)` (`bavail × bsize`) on the drive holding the database. Tests inject `freeSpace`.

**What the user sees:**
- **Settings** gets a **Storage** link, and a **Backup location** card (موقع النسخ الاحتياطية):
  - the current location ("The backups folder next to the app" when none is chosen);
  - a folder path field with the hint "For example another drive, a USB disk, a network folder or a OneDrive folder";
  - **Save**, and **Use the local folder**.
  - Errors: "Write the full folder path, like D:\Backups" / «اكتب المسار الكامل للمجلد، مثل D:\Backups»; "Choose a folder outside the app's own folders" / «اختر مجلداً خارج مجلدات التطبيق»; "This folder can't be reached or written to" / «لا يمكن الوصول إلى هذا المجلد أو الكتابة فيه».
- **The Storage page (التخزين):**
  - the space used by the database, files, deleted files (with their count) and backups (local and chosen location), and the free disk space, each formatted with `fileSize`;
  - the last backup's date and where it went ("Saved to the local backups folder because D:\Backups couldn't be reached" in amber when it fell back);
  - **Empty deleted files** (إفراغ الملفات المحذوفة), which confirms first: "Permanently remove 12 deleted files (340 MB)? This can't be undone." / «حذف 12 ملفاً محذوفاً (340 ميغابايت) نهائياً؟ لا يمكن التراجع عن ذلك.»;
  - the note: "Files deleted from the app are kept for 90 days, then removed. Sensitive documents rely on Windows sign-in; BitLocker disk encryption is recommended." (Arabic too).
- **The dashboard** shows a notice when free space is below 5 GB ("Only 3.2 GB free on the disk that holds your data" / «المساحة المتاحة على القرص الذي يحفظ بياناتك 3.2 غيغابايت فقط»), and another when the last backup fell back.

- [ ] **Step 1: Write the failing tests** (temporary folders; handles closed before cleanup):
  - `mirrorFiles` copies new files, and leaves an existing one untouched (its content isn't overwritten);
  - `runBackup` with a reachable location writes `pm-<date>.db` and `files/…` there; with an unreachable location (a path under a file, not a folder), it writes to `localDir` and records `fellBack`;
  - `checkLocation` refuses a relative path, a path inside `attachmentsDir`, and an unwritable one;
  - deleting an attachment sets the moved file's modified time to now;
  - `purgeDeleted` removes a file older than 90 days and keeps a newer one;
  - `emptyDeleted` removes all;
  - `storageReport` sums the folders, and `lowSpace` is true with an injected 3 GB;
  - **the Storage page** shows the sizes, and Empty deleted files confirms, then posts;
  - **the dashboard** shows the low-space notice with an injected low value;
  - the Backup location card shows each error in Arabic;
  - the no-English guard for the Storage page and the card.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: storage protection — files in the daily backup, a backup location of your choice, a storage page, a low-space warning, and deleted files emptied after 90 days`.

---

### Task 16: Status report slides, first version

**Files:**
- Create: `client/pages/present/ReportPickerPage.tsx`, `client/pages/present/ReportSlidesPage.tsx`
- Modify: `client/App.tsx` (routes `/present/report` and `/present/report/slides`), `client/components/AppShell.tsx` (the header gets `className="no-print"`), `client/pages/present/PortfolioPage.tsx` and `FocusPage.tsx` (a **Status report** button, prefilled with the department or the project), `shared/i18n/*`, `client/styles.css` (the slide layout and `@media print`)
- Test: `client/pages/present/ReportPickerPage.test.tsx` (new), `client/pages/present/ReportSlidesPage.test.tsx` (new), `present.ar.test.tsx`, the no-English guard

**What the user sees:**
- **The report page (تقرير حالة المشاريع):**
  - choose **projects** (checkboxes, grouped by main project), or **a whole department** (which ticks its projects);
  - choose the **language** (العربية / English, defaulting to the app's);
  - **Open the slides**.
  - The URL is `/present/report/slides?projects=3,5&lang=ar`.
- **The slides page:**
  - landscape slides (`section.slide`, A4 landscape through `@page { size: A4 landscape; margin: 0 }`, with a page break after each);
  - it renders inside `<LanguageProvider lang={lang}>`, so it is right to left in Arabic whatever the device setting;
  - a **Print or save as PDF** button (hidden when printing) calls `window.print()`.
  - **The cover** (always first): "Project status report" / «تقرير حالة المشاريع», the date (`formatDate`), the department if one was chosen, and the list of projects.
  - **Per project, the Summary slide:** the project name, with `ProjectSummaryView` from Task 14 laid out for the slide.
  - **Per project, the Timeline slide:** the project's Gantt chart at a fixed width (1040), with `showBaseline`, the fill, the ownership outlines and the legend, and the span line.
- **Only what the presentation side may show:** no to-dos, no people's names, no notes, and no M7 key dates.

- [ ] **Step 1: Write the failing tests:**
  - choosing a department ticks its projects, and **Open the slides** navigates with the right query;
  - two projects render 1 + 2 × 2 = 5 slides, in order (cover, Summary A, Timeline A, Summary B, Timeline B);
  - `lang=ar` renders `dir="rtl"`, Arabic headings and a right-to-left Gantt chart;
  - the print button calls `window.print` (mocked);
  - the slides contain no to-do titles and no people's names from the sample data (the read-only guard);
  - the no-English guard for the Arabic slides.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass. Print-preview both languages in Chrome and Edge, and check each slide fits one page.
- [ ] **Step 5:** Commit with `feat: status report slides — a cover, then Summary and Timeline slides for each chosen project, printed to PDF by the browser`.

---

### Task 17: Demo ownership, to-do history, summaries and key documents (completes M8)

**Files:**
- Modify: `server/demoData.ts`, `server/demoData.test.ts`
- Test: `server/demoData.test.ts`

**The data:**
- **Ownership:** UAT is Business on every demo project, by default. **Requirements gathering** on E-Services Mobile App is **Joint**.
- **Dates requested:**
  - E-Services Mobile App: 2026-07-15;
  - Case Management System: 2026-01-20;
  - Customer Portal Revamp: 2025-11-02;
  - the Arabic project: 2026-09-01.
- **Starred key documents:**
  - E-Services' "E-Services contract.pdf";
  - Case Management's "UAT sign-off.pdf";
  - Customer Portal's Test Report.
- **To-do priorities:**
  - Aisha's "Share the draft requirements list" is **Urgent**;
  - one Case Management to-do is **Important**.
- **To-do history:**
  - E-Services gets a second meeting, **Requirements review** on 2026-10-14 (in Requirements gathering, attendees Aisha Khan and Mariam Al Suwaidi, not highlighted).
  - It **discussed** "Share the draft requirements list", with the note "Mariam needs one more week to confirm the payment rules", moving its due date 14 → 21 Oct and its priority to Urgent.
  - The Arabic project's meeting discusses one of its to-dos in Arabic.
- **The earlier demo** (M4–M7, and Task 10) stays unchanged.

- [ ] **Step 1: Write the failing test:**
  - E-Services' UAT is business and its Requirements gathering is joint;
  - `GET /api/projects/:id/summary` for Customer Portal reads `done`, with the Test Report in `keyDocuments`;
  - for Internal Reporting, it reads `late`;
  - the to-do's history has created → update (from Requirements review, due 14 → 21 Oct, priority → urgent);
  - the review meeting's `discussed` lists it;
  - the M4–M7 and Task 10 assertions pass unchanged.
- [ ] **Step 2:** Run the test and confirm it FAILS.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: demo ownership, to-do history and priorities, dates requested and key documents`.

---

### ✅ M8 checkpoint: stop and demo to the user (in Arabic)
1. In a **frozen worktree** of the final commit (not ports 3001/5173): delete its `data/pm.db` and `attachments/`, run `npm run seed` ("Added 7 demo projects.") and `npm run dev`, and **restart the dev server before checking**. Give the LAN URL for the phone.
2. **لوحة المعلومات:** «بانتظار قرارك» with every kind of item, and «قريباً» with the reminders; the project table's current phase, %, pace and original vs current end.
3. **Internal Reporting Dashboard → التقدّم:** «تأكيد الإنجاز» on QA «في تاريخ سابق»; «تسجيل السبب» for the overdue UAT with «جزئياً»; then read «سجل تغيير التواريخ».
4. **The Gantt charts:** the darker fill, the % in the details card, the dashed original plan, and UAT's business outline, in both directions (RTL and LTR).
5. **Settings:** «العطل الرسمية» (add a holiday and choose «تحريك المراحل» for one project and «القرار لاحقاً» for another); «تنبيهات التقدّم»; «موقع النسخ الاحتياطية» (try a USB or OneDrive folder, and a wrong path); the **Storage** page and «إفراغ الملفات المحذوفة».
6. **Resources:** an overbooked week → «تأجيل مرحلة».
7. **E-Services → السجل:** add a meeting with «مهام نوقشت», change a due date and a priority, then open that to-do's «السجل»; filter and sort the To-dos page by priority.
8. **E-Services → المرفقات:** star a document, then see it in «ملخص المشروع» at the top of the page; set «تاريخ الطلب» in Edit details.
9. **عرض المشاريع:** filter by «مالك العملية» → Customer Service; «أين ذهب الوقت؟» by cause and by responsibility, clicking a segment; open Customer Portal Revamp → the summary first, then «لماذا تغيّر موعد الانتهاء؟», clicking a step for its evidence.
10. **تقرير حالة المشاريع:** choose two projects, open the slides in Arabic, and print to PDF.
11. **Create a past project:** the «التواريخ الفعلية» step.
12. **Arabic:** the whole flow reads naturally. Review the new glossary terms and the open questions below.

**When M8 is approved, fast-forward every branch to `build/m8`. Then write the M9 plan (requirements and change requests) on `design/portfolio-spec`.**

---

## Open questions for the user
Each has a recommended answer, which the plan already uses. Change any of them before the build starts.

1. **A parent phase's % before M9's weights.** *Recommended:* the working-day-weighted average of its sub-phases (a 30-day increment counts three times a 10-day one). M9 replaces this with the development % rule for development sub-phases.
2. **Warning defaults.** *Recommended:*
   - the behind-schedule warning starts at a **20-point gap** (for example 70% of the time used and 49% done);
   - the soft pace indicator says "on pace" within ±10 points;
   - the reminder comes **14 calendar days** before each phase's, sub-phase's and the project's end.

   Both numbers are settings.
3. **What "Partially" means in the shift prompt.** *Recommended:* the user picks the **last** following phase that moves. Everything up to and including it moves; everything after it keeps its dates (it gets a fixed start). Yes is the default.
4. **Past projects already in the app.** They were entered before M8, probably with their real dates as the plan, so Baseline 1 would show no delays. *Recommended:* the **Record past dates** page lets the user enter each phase's **original** working days, as long as no dates have been recorded for that project yet. After that, the original plan is locked.
5. **Baseline 1 before a project starts.** *Recommended:* until the project's start date arrives (or any phase starts), editing its phases also updates Baseline 1, so the "original plan" is the plan at kickoff, not the first draft.
6. **The Department filter's Arabic label.** The spec says «الجهة», but the glossary already uses «الجهة» for a person's Side (tech team or business side), and the project field is «مالك العملية». *Recommended:* label the filter **«مالك العملية»**, with "All" as «جميع ملّاك العمليات».
7. **Starred key documents on the presentation side.** *Recommended:* yes. A starred file (for example the BRD, the contract or the UAT sign-off) is shown to stakeholders in the project summary and on the Summary slide, with Preview and Download. M7's key dates (contract end, licence expiry…) stay private. If contracts shouldn't be seen by stakeholders, keep them unstarred.
8. **Backup location rules.** *Recommended:*
   - an absolute folder path (a drive, a USB disk, `\\server\share` or a OneDrive folder), outside the app's own folders;
   - it's refused when saved if it can't be written to;
   - if it later can't be reached, that day's backup goes to the local `backups/` folder, and the dashboard says so.
