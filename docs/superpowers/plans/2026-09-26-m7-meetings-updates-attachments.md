# Milestone 7: Meetings, Updates and Attachments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every project a history. The user can:
- record **meetings** (with attendees and follow-up to-dos) and **updates**, each dated the day it really happened;
- **upload files** of any type (up to 50 MB), with a type and an optional phase, and preview PDFs and images inside the app;
- see all of it in a **History** tab, and in a **side panel** that opens when a Gantt bar is clicked.

Entries marked **"show in presentation"** appear to stakeholders in the focus view. The project page moves its sections into **tabs**. Everything ships in Arabic and English.

**Architecture:**
- **Storage:** two new schema versions.
  - Migration 13 adds `entries` (a meeting or an update), `entry_attendees`, and `todos.source_entry_id`.
  - Migration 14 adds `attachments` and an editable **attachment type** list.
- **Files:**
  - Stored under `attachments/<projectId>/`, with unique names, so they are never overwritten.
  - Deleting an attachment moves its file to `attachments/_deleted/` instead of erasing it.
  - Uploads are sent as the raw request body (`application/octet-stream`), with the file name in a header, so no new dependency is needed.
- **Screens:**
  - **Project page tabs:** History, To-dos, People, Attachments, Details. Details holds the old Details, Description, Scope and Phases cards. The Gantt chart and "My next steps" stay above the tabs.
  - **Phase side panel:** clicking a phase or sub-phase bar opens a panel that slides in from the inline end (the left in Arabic). It lists that phase's meetings, updates, to-dos and attachments in date order, with add buttons already set to that phase.
  - **Focus view:** the same panel, read-only, showing highlighted entries only.

**Tech Stack:** as before — Node 24, TypeScript, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite`, Vitest 3, Testing Library, jsdom. **No new npm dependencies.**

**Spec:**
- §2: `Entry`, `Attachment`, and `ToDo.sourceEntry`;
- §3.4: the project page's tabs, the "Gantt chart as the centrepiece", the side panel;
- §3.8: to-dos from a meeting;
- §4.3: the focus view's side panel;
- §5.3: failed uploads and deleting evidence;
- §8: Arabic first.

**Glossary:** `docs/superpowers/glossary-ar.md`. The new terms are proposed below and added to the glossary with this plan, for the user's approval.

**Decisions confirmed with the user (2026-09-26):**
- **A meeting** holds its title, the date it happened, its notes, its **attendees** (chosen from Resources), an optional phase, and follow-up to-dos created right from the meeting.
- **The project page uses tabs.**
- **Uploads:** **any file up to 50 MB.** PDFs and images preview inside the app; other files download and open in their own program.
- **Clicking a Gantt bar** (a phase or a sub-phase) **opens a side panel with that phase's history.** Hovering still shows the quick details card.

**Deliberate choices (flag if you disagree):**
- **The tab is called "History" (السجل), not "Timeline".** The Gantt chart's card is already titled "Timeline" (الجدول الزمني), and two tabs with the same name would confuse. The spec's "Timeline tab" is this History tab.
- **Attendees** can be anyone in Resources, active or not, tech team or business side, because meetings often include people who aren't on the project.
- **An update** is the same as a meeting, minus attendees.
- **Follow-up to-dos** in the meeting form are quick rows: a title, an assignee from the project's usual choices, and an optional due date. They're created in the same save as the meeting, and remember which meeting they came from. The to-do shows "From the meeting on 12 Oct: <title>".
- **No half-saved entries.** Files attached in an entry form upload first. The entry is saved only after every upload has succeeded; a failed upload shows **Retry** and doesn't save the entry. An uploaded file whose entry is cancelled stays as an attachment of the project; nothing is lost.
- **Deleting a meeting or update** keeps its attachments (they become attachments of the project) and its to-dos (their "from the meeting" link is cleared). You confirm before deleting. In M12 (Requirement readiness), deleting something used as evidence will warn first.
- **Deleting an attachment** asks for confirmation, removes it from the app, and moves the file to `attachments/_deleted/`.
- **Dates:** an entry's date is **the day it happened**, which can be in the past (record-history mode). The day it was typed in is kept separately. Lists sort by the day it happened.
- **Highlighting.** An entry marked "show in presentation" (إظهار في العرض) is the only kind stakeholders see. It appears in the focus view's side panel with its attachments. To-dos never appear under `/present`.
- **Attachment types** are an editable list in Settings, seeded as follows:

  | English | Arabic |
  |---|---|
  | Meeting Minutes | محضر اجتماع |
  | Approval | موافقة |
  | Change Request | Change Request |
  | Business Analysis Document | الدراسة التحليلية |
  | BRD | وثيقة متطلبات الأعمال (BRD) |
  | Documentation | التوثيق |
  | Design | التصميم |
  | Test Report | تقرير الاختبار |
  | Other | أخرى |
- **On a touch screen, tapping a bar opens the side panel.** The panel shows the phase's details at the top, so the tap-to-pin card is no longer needed for bars. It stays for segments inside the panel's summary, if any.
- **Attachments aren't in the daily database backup.** They are never overwritten, and deleted ones are kept in `_deleted`. The layout pass or a later milestone can add copying the attachments folder if the user wants it.

**New glossary terms (proposed; added to the glossary for approval):**

| English | Arabic |
|---|---|
| Meeting / Meetings | اجتماع / الاجتماعات |
| Update / Updates | المستجدات (an update item and the list both read المستجدات) |
| History (tab) | السجل |
| Add meeting / Add update | إضافة اجتماع / إضافة مستجدات |
| Notes (meeting minutes) | محضر الاجتماع |
| Notes (update) | التفاصيل |
| Attendees | الحضور |
| Date it happened | تاريخ الحدث |
| Show in presentation | إظهار في العرض |
| Follow-up to-dos | مهام للمتابعة |
| Attachment / Attachments | مرفق / المرفقات |
| Upload file | رفع ملف |
| Attachment type | نوع المرفق |
| Document date | تاريخ المستند |
| Preview / Download | معاينة / تنزيل |
| Phase history (side panel) | سجل المرحلة |
| Group by week / by type | حسب الأسبوع / حسب النوع |
| From the meeting on {date} | من اجتماع {date} |
| Retry | إعادة المحاولة |

## Global Constraints
- **Branches:**
  - This plan is committed on `design/portfolio-spec`.
  - The build happens on `build/m7`, created from `design/portfolio-spec` at this commit.
  - Doc fixes that come out of reviewing the build go on `build/m7`.
  - **Never commit to `main`.**
  - On merge, every branch (`main`, `design/portfolio-spec`, `build/m1-m2`, `build/m2`…`build/m7`) is fast-forwarded.
- **No new npm dependencies.**
- **Database:** `node:sqlite`, with raw parameterised SQL. **Append migrations only.** Migrations 1–12 exist; M7 adds 13 and 14. Multi-row writes run in `transaction(db, …)`.
- **Files:**
  - They live under a configurable `attachmentsDir` (the `buildApp` option, default `'attachments'`), which is gitignored.
  - Stored names are `<uuid>-<sanitised original name>` inside `<attachmentsDir>/<projectId>/`, and are never overwritten.
  - The original name is kept in the database and used for downloads, with `Content-Disposition: attachment; filename*=UTF-8''…` so Arabic names work.
  - Tests use a temporary folder and close handles before cleanup, because this is Windows.
- **Bilingual:**
  - Every user-visible string comes from `shared/i18n/en.ts` and `ar.ts` through `t(...)`. The Arabic is natural and follows the glossary.
  - English stays byte-identical for existing tests; tests render in English unless they wrap in `<LanguageProvider lang="ar">`.
  - User content (titles, notes, file names, people's names) gets `dir="auto"` and `data-user-content`.
  - Server errors carry `code` and `params` (the M6 pattern).
  - Dates display only through `client/i18n/format.ts`.
  - The M6 "no English left" guard (`client/i18n/noEnglish.test.tsx`) must be extended to the new tab and the side panel.
- **Right to left:** the side panel slides in from the **inline end** (`inset-inline-end: 0`). Use logical CSS properties only.
- **Presentation is read-only.** The focus view shows only highlighted entries, and their attachments. It shows no to-dos, and no add, edit or delete controls.
- **Tests:**
  - Every client test file starts with `// @vitest-environment jsdom`.
  - Fix "today" where needed.
  - Server route tests use `buildApp(db, { today, attachmentsDir })` with a temporary folder.
- **Reordering and the existing Gantt interactions stay intact:** segments, lanes, the details card, the label that opens phase details, and mouse and touch dragging in the phase editors.

## Where M7 sits
M1–M6 are merged to `main` at `384b007`. The app is Arabic first. It has:
- projects with sub-phases, people, to-dos and starter checklists;
- the workload views;
- right-to-left charts;
- daily backups.

The project page is a long column of cards (My next steps, Timeline chart, Details, Description, Scope, Phases, People, To-dos). This milestone moves most of them into tabs.

## File Structure (M7)
```
server/entries/repo.ts        NEW: meetings and updates, attendees, follow-up to-dos        (Task 1)
server/attachments/repo.ts    NEW: attachment rows, file storage, soft delete, listing      (Task 2)
server/attachments/files.ts   NEW: safe names, write, move to _deleted, stream               (Task 2)
server/db.ts                  migrations 13 and 14                                           (Tasks 1, 2)
server/app.ts                 routes; raw-body upload parser with a 50 MB limit              (Tasks 1, 2)
shared/types.ts, shared/schemas.ts  EntryRecord, AttachmentRecord, inputs                    (Tasks 1, 2)
client/pages/manage/ProjectTabs.tsx     NEW: the tab bar, with the tab in the URL (?tab=)    (Task 3)
client/pages/manage/ProjectDetailsTab.tsx NEW: the old Details/Description/Scope/Phases cards (Task 3)
client/pages/manage/HistoryTab.tsx      NEW: meetings and updates list                       (Task 4)
client/components/EntryForm.tsx         NEW: add/edit a meeting or update                    (Task 4)
client/pages/manage/AttachmentsTab.tsx  NEW                                                  (Task 5)
client/components/Uploader.tsx          NEW: pick files, upload with progress and retry      (Task 5)
client/components/FilePreview.tsx       NEW: PDF/image preview dialog                         (Task 5)
client/components/PhasePanel.tsx        NEW: the side panel (manage and read-only modes)      (Task 6)
client/gantt/Gantt.tsx                  onPieceOpen(phaseId)                                 (Task 6)
server/demoData.ts                      demo meetings, updates, attachments                  (Task 7)
```

---

### Task 1: Meetings and updates — storage and API

**Files:**
- Create: `server/entries/repo.ts`
- Modify: `server/db.ts` (migration 13), `shared/types.ts`, `shared/schemas.ts`, `shared/i18n/en.ts` and `ar.ts` (validation and error keys), `server/app.ts`, `server/todos/repo.ts` (`sourceEntry` on to-do records), `client/api.ts`, `client/testing/mockFetch.ts` (`sampleEntries()`)
- Test: `server/entries/entries.test.ts` (new), `server/app.test.ts`, `server/db.test.ts`, `server/todos/todos.test.ts`

**Migration 13:**
```sql
CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('meeting', 'update')),
  effective_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  highlight INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX entries_project ON entries(project_id, effective_date);
CREATE TABLE entry_attendees (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id),
  PRIMARY KEY (entry_id, resource_id)
);
ALTER TABLE todos ADD COLUMN source_entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL;
```

**Interfaces:**
- `shared/types.ts`:
  ```ts
  export const ENTRY_TYPES = ['meeting', 'update'] as const;
  export type EntryType = (typeof ENTRY_TYPES)[number];
  export interface EntryRecord {
    id: number; projectId: number; type: EntryType;
    /** The day it happened; may be in the past. */
    effectiveDate: ISODate;
    createdAt: string;
    title: string; body: string; highlight: boolean;
    /** Phase or sub-phase, with the structured names (M6). */
    phase: (Ref & PhaseNameParts) | null;
    attendees: Ref[];                 // meetings only; [] for updates, ordered by name
    attachmentIds: number[];          // filled from Task 2 on; [] until then
    followUpToDoIds: number[];
  }
  // ToDoRecord gains:
  sourceEntry: { id: number; title: string; effectiveDate: ISODate } | null;
  ```
- `shared/schemas.ts`:
  ```ts
  export const followUpInputSchema = z.object({ title: <the to-do title rule>, assigneeId: optionalId, dueDate: <optional iso> });
  export const entryInputSchema = z.object({
    type: z.enum(ENTRY_TYPES),
    effectiveDate: isoDate,
    title: <1–200, 'validation.entryTitleRequired' / validation.tooLong>,
    body: z.string().trim().max(20000, <tooLong>).default(''),
    phaseId: optionalId,
    highlight: z.boolean().default(false),
    attendeeIds: z.array(z.number().int().positive()).max(100).default([]),
    followUps: z.array(followUpInputSchema).max(50).default([]),   // on create only; ignored on update
    attachmentIds: z.array(z.number().int().positive()).max(50).default([]), // used from Task 2
  });
  ```
- Routes:

  | Route | Behaviour |
  |---|---|
  | `GET /api/projects/:id/entries?phaseId=` | `EntryRecord[]`, newest `effectiveDate` first, then `id` descending. With `phaseId`, it returns the entries of that phase **and of its sub-phases**, when the id is a top-level phase. A 404 for a missing project. |
  | `POST /api/projects/:id/entries` | 201 with `EntryRecord`. It creates the entry, its attendees and its follow-up to-dos (each with `source_entry_id`) in **one transaction**. |
  | `PUT /api/entries/:id` | 200 with `EntryRecord`. It updates the fields, the attendees (replaced) and the phase; `followUps` are ignored. |
  | `DELETE /api/entries/:id` | 204. |

- `client/api.ts`: `listEntries(projectId, phaseId?)`, `createEntry`, `updateEntry` and `deleteEntry`.

**Rules:**
- **Phase:** it must belong to the project, as a top-level phase or a sub-phase (`error.unknownPhase`).
- **Attendees:**
  - Only meetings have them. An update with attendees gets a 400 with `validation.updateHasAttendees` ("Only meetings have attendees" / "الحضور خاص بالاجتماعات فقط").
  - Each id must be an existing person (`error.unknownPerson`). Duplicates are removed.
- **Follow-ups** go through the to-do rules exactly as `createToDo` does: the assignee is on the project, or is "I am". Any issue is reported at `followUps.<i>.<field>`, and **nothing is saved**.
- **The entry title** is required (`validation.entryTitleRequired`: "Write a title" / "اكتب عنواناً").
- **`createdAt`** is the server's clock.
- **Deleting an entry** leaves its to-dos with `source_entry_id` null through `ON DELETE SET NULL`. Task 2 makes attachments unlink too.
- **To-do records** carry `sourceEntry` when the link is set.

- [ ] **Step 1: Write the failing tests** (`server/entries/entries.test.ts` and `app.test.ts`):
  - Creating a meeting with two attendees and two follow-ups returns the entry, with `attendees` sorted and two `followUpToDoIds`. Each of those to-dos has `sourceEntry` = the meeting.
  - A follow-up with an off-project assignee returns 400 at `followUps.1.assigneeId`, and **nothing** is created (no entry, no to-dos).
  - An update with attendees returns 400 with `validation.updateHasAttendees`.
  - `GET ?phaseId=<Development>` includes the entries of Development's sub-phases, and `?phaseId=<sub>` returns only that sub-phase's entries.
  - A past `effectiveDate` is accepted, and sorting is by `effectiveDate` descending.
  - `PUT` replaces the attendees and changes the phase.
  - `DELETE` returns 204, and the meeting's to-dos remain with `sourceEntry: null`.
  - Deleting the project removes its entries.
  - Migration 13 upgrades a version-12 database (`integrity_check` ok).
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: meetings and updates with attendees and follow-up to-dos, storage and API`.

---

### Task 2: Attachments — storage, upload, download and API

**Files:**
- Create: `server/attachments/repo.ts`, `server/attachments/files.ts`
- Modify: `server/db.ts` (migration 14), `shared/types.ts` (`LIST_NAMES` gains `'attachmentType'`; `AttachmentRecord`), `shared/schemas.ts`, `shared/i18n/*`, `server/app.ts`, `server/entries/repo.ts` (link `attachmentIds`), `server/lists/repo.ts` (the in-use rule for attachment types), `client/api.ts`, `client/testing/mockFetch.ts`, `.gitignore` (`attachments/`)
- Test: `server/attachments/attachments.test.ts` (new), `server/app.test.ts`, `server/entries/entries.test.ts`, `server/lists/lists.test.ts`

**Migration 14:**
```sql
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id INTEGER REFERENCES phases(id) ON DELETE SET NULL,
  entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL,
  type_id INTEGER REFERENCES list_values(id),
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  document_date TEXT,
  uploaded_at TEXT NOT NULL
);
CREATE INDEX attachments_project ON attachments(project_id);
INSERT INTO list_values (list, name, name_ar, sort_order) VALUES
  ('attachmentType', 'Meeting Minutes', 'محضر اجتماع', 0),
  ('attachmentType', 'Approval', 'موافقة', 1),
  ('attachmentType', 'Change Request', 'Change Request', 2),
  ('attachmentType', 'Business Analysis Document', 'الدراسة التحليلية', 3),
  ('attachmentType', 'BRD', 'وثيقة متطلبات الأعمال (BRD)', 4),
  ('attachmentType', 'Documentation', 'التوثيق', 5),
  ('attachmentType', 'Design', 'التصميم', 6),
  ('attachmentType', 'Test Report', 'تقرير الاختبار', 7),
  ('attachmentType', 'Other', 'أخرى', 8);
```
Check the `list_values` columns and unique index in `server/db.ts` before writing the INSERT, and adjust it if needed.

**Interfaces:**
- `AttachmentRecord { id; projectId; phase: (Ref & PhaseNameParts) | null; entryId: number | null; type: Ref | null; name: string; mime: string; size: number; documentDate: ISODate | null; uploadedAt: string; previewable: boolean }`. `previewable` is true for `application/pdf` and `image/*`.
- **Upload:** `POST /api/projects/:id/attachments`.
  - The body is the raw file bytes (`Content-Type: application/octet-stream`).
  - The header `X-File-Name` carries the `encodeURIComponent` of the original name, and `X-File-Type` the MIME type (optional; otherwise it's guessed from the extension, with `application/octet-stream` as the fallback).
  - The query takes `typeId`, `phaseId`, `documentDate` and `entryId`, all optional.
  - Register `app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 50 * 1024 * 1024 }, …)`. Over the limit, it answers 413 with `code: 'error.fileTooLarge'` ("The file is larger than 50 MB" / "حجم الملف يتجاوز 50 ميغابايت"). An empty body gets 400 with `error.fileEmpty`.
  - It returns 201 with the `AttachmentRecord`.
- **Download:** `GET /api/attachments/:id/file?inline=1` streams the file with its MIME type.
  - Without `inline`, it adds `Content-Disposition: attachment; filename*=UTF-8''<encoded>`. With `inline=1`, and only for previewable types, it uses `inline`.
  - Always send `X-Content-Type-Options: nosniff`.
- **List:** `GET /api/projects/:id/attachments?phaseId=&typeId=` returns newest first. `phaseId` includes the phase's sub-phases, as entries do.
- **Update:** `PUT /api/attachments/:id` with `{ typeId, phaseId, documentDate, entryId }` changes the metadata only.
- **Delete:** `DELETE /api/attachments/:id` moves the file to `<attachmentsDir>/_deleted/<stored_name>` and deletes the row, then answers 204.
- **Entries:**
  - `entryInputSchema.attachmentIds` on create and update links the given attachments (same project only, `error.unknownAttachment`) to the entry by setting `entry_id`.
  - On update, attachments no longer listed are unlinked (`entry_id = NULL`), not deleted.
  - `EntryRecord.attachmentIds` is filled.

**Rules:**
- **Safe names:** `stored_name = <crypto.randomUUID()>-<sanitised>`. Sanitising keeps letters (including Arabic), digits, `.`, `-`, `_` and spaces, turns everything else into `_`, and cuts to 100 characters. No path parts: strip anything up to the last `/` or `\`.
- **Writing:** create the folder if it's missing, then write with the `wx` flag, so an existing file is never overwritten. The row is inserted only after the file is written; if the insert fails, remove the file.
- **Type:** it must be an `attachmentType` value. The phase must belong to the project.
- **Lists:** `attachmentType` is added to Settings, with the same in-use rule as the other lists (count attachments using the value).

- [ ] **Step 1: Write the failing tests** (they use a temporary `attachmentsDir`):
  - **An Arabic file name.** Uploading a small PDF buffer named "محضر الاجتماع.pdf" returns 201, `previewable: true`, the name unchanged and the size right. The file exists under `<dir>/<projectId>/`.
  - **Download.** Plain download returns the same bytes with an attachment `Content-Disposition` carrying `filename*=UTF-8''`. `?inline=1` returns `inline` for the PDF, and **not** for a `.exe`.
  - **Name collisions.** Two uploads with the same name get different stored names.
  - **A hostile name.** A name like `..\..\evil.txt` is stored safely inside the project folder.
  - **Limits.** Over 50 MB returns 413 with `error.fileTooLarge`; test with a lowered limit option, not a real 50 MB buffer. An empty body returns 400.
  - **Delete** moves the file to `_deleted`, and the row is gone.
  - **Entries.** Creating an entry with `attachmentIds` links them. Updating it without one unlinks it (the attachment remains). An attachment from another project is rejected.
  - **Settings.** The attachment types appear in `GET /api/lists` with Arabic names. A type in use can't be deleted.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement. Make the upload limit a `buildApp` option, `uploadLimitBytes` (default 50 MB), so tests can lower it.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: attachments of any type up to 50 MB, stored safely and never overwritten, with an editable type list`.

---

### Task 3: Project page tabs

**Files:**
- Create: `client/pages/manage/ProjectTabs.tsx`, `client/pages/manage/ProjectDetailsTab.tsx`
- Modify: `client/pages/manage/ProjectPage.tsx`, `client/styles.css`, `shared/i18n/*`
- Test: `client/pages/manage/ProjectPage.test.tsx`, `client/pages/manage/projectScreens.ar.test.tsx`

**What the user sees:**
- **Above the tabs, unchanged:** the header (the name, the span, Edit phases, Edit details), the starter offer, **My next steps** and the **Timeline** chart.
- **The tabs**, in this order: **History** (السجل), **To-dos** (المهام), **People** (الأشخاص), **Attachments** (المرفقات) and **Details** (التفاصيل).
  - They are a `role="tablist"` of buttons with `role="tab"` and `aria-selected`, controlling `role="tabpanel"`.
  - Arrow keys move between tabs, and Home and End jump to the first and last. In RTL, the arrow directions follow the visual order.
- **Details** holds the existing Details, Description, Scope and goals, and Phases table cards, unchanged inside.
- **To-dos** and **People** are the existing cards, unchanged.
- **History and Attachments** show "Coming in the next step" until Tasks 4 and 5 build them.
- **The chosen tab is in the URL:** `?tab=history|todos|people|attachments|details`. The default is **History**. The starter offer's `?starter` parameter must keep working together with `?tab`.
- **Tab counts:** labels show a count where it helps: To-dos shows the open count, e.g. "المهام (3)".

- [ ] **Step 1: Write the failing tests:**
  - by default the History tab is selected;
  - clicking To-dos shows the to-dos card, and the URL has `tab=todos`;
  - loading at `?tab=people` shows People;
  - ArrowRight moves the focus to the next tab (ArrowLeft in Arabic);
  - existing ProjectPage tests keep passing: switch to the right tab first where a test uses a card that's now inside one, **without changing its assertions**;
  - an Arabic render shows the Arabic tab names.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: the project page's sections move into tabs — History, To-dos, People, Attachments, Details`.

---

### Task 4: The History tab — meetings and updates

**Files:**
- Create: `client/pages/manage/HistoryTab.tsx`, `client/components/EntryForm.tsx`, `client/components/EntryItem.tsx`
- Modify: `ProjectPage.tsx` (wire the tab), `client/components/ToDoMetaLine.tsx` (show "From the meeting on {date}" when `sourceEntry` is set), `shared/i18n/*`, `client/styles.css`
- Test: `client/pages/manage/HistoryTab.test.tsx` (new), `client/components/EntryForm.test.tsx` (new), plus Arabic tests

**What the user sees:**
- **The History tab:**
  - It has two buttons, **Add meeting** and **Add update**, and a filter by phase: All phases, or each phase and sub-phase, using the phase choices from Task 5 of M5.
  - Below them is a list of entries, newest first. Each shows:
    - an icon for its type (a meeting or an update);
    - the title;
    - the date it happened (`formatDate`);
    - the phase label;
    - for a meeting, the attendees' names as links to their pages;
    - the notes, the first 3 lines collapsed, with **Show more**;
    - a "shown in presentation" badge when highlighted;
    - its attachments as links, once Task 5 has built them;
    - its follow-up to-dos as small lines with a done checkbox;
    - **Edit** and **Delete** buttons. Delete asks for confirmation first: "Delete this meeting? Its attachments and to-dos stay on the project."
  - With no entries: "No meetings or updates yet."
- **`EntryForm`** (add or edit), shown inline at the top of the list:
  - **Title**, required;
  - **Date it happened**, defaulting to today;
  - **Phase**, optional, with "Whole project" as the default;
  - **Notes**, a textarea;
  - for meetings, **Attendees**: a searchable multi-select over everyone in Resources. The project's PMs and the people assigned to it are listed first, as "On this project", then everyone else. Chosen people show as removable chips;
  - **Show in presentation**, a checkbox with a hint: "Stakeholders see this entry in the presentation.";
  - for a **new meeting** only, **Follow-up to-dos**: rows of title, assignee (the same choices as the to-do form) and due date, with "+ Add follow-up";
  - Save and Cancel. It validates with `entryInputSchema`, and server errors show through `messagesOf`.
  - Task 5 adds the file picker to this form.
- **To-dos created from a meeting** show "From the meeting on Mon 12 Oct: Requirements workshop" in their meta line, wherever to-dos appear.

- [ ] **Step 1: Write the failing tests:**
  - adding a meeting with two attendees and one follow-up sends the right POST body, and the list shows the new meeting with its attendees and follow-up;
  - an update form has no attendees field;
  - an empty title shows "Write a title";
  - the phase filter shows only matching entries;
  - Edit changes the title and highlight, and sends a PUT;
  - Delete asks for confirmation, then sends DELETE;
  - a follow-up to-do's meta line shows "From the meeting on …";
  - Arabic render tests for the tab and the form;
  - the no-English guard is extended to the History tab with an entry open.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: record meetings and updates with attendees, follow-up to-dos and a presentation flag`.

---

### Task 5: The Attachments tab, uploads in forms, and file preview

**Files:**
- Create: `client/pages/manage/AttachmentsTab.tsx`, `client/components/Uploader.tsx`, `client/components/FilePreview.tsx`, `client/components/AttachmentList.tsx`
- Modify: `EntryForm.tsx` and `EntryItem.tsx` (attach and show files), `SettingsPage.tsx` (the Attachment types list editor), `client/api.ts` (`uploadAttachment(projectId, file, meta, onProgress)` with `XMLHttpRequest`, for progress events), `shared/i18n/*`, `client/styles.css`
- Test: `client/pages/manage/AttachmentsTab.test.tsx`, `client/components/Uploader.test.tsx`, `client/components/FilePreview.test.tsx`, `EntryForm.test.tsx`, `SettingsPage.test.tsx`, plus Arabic tests

**What the user sees:**
- **The Attachments tab:**
  - An **Upload file** button (or dragging files onto the tab) opens the upload row: **Type** (from the list), **Phase** (optional), **Document date** (optional), and the chosen file names with their sizes.
  - Uploading shows a progress bar per file. A failed file shows its error with **Retry**; files that succeeded stay done.
  - Filters: **Type** and **Phase**.
  - A table of name (with a file icon), type, phase, document date, uploaded date, size (e.g. "2.4 MB" / "2.4 ميغابايت") and the meeting it belongs to, if any, as a link that opens History.
  - Row actions:
    - **Preview**, for PDFs and images only;
    - **Download**;
    - **Edit** (type, phase, document date);
    - **Delete**, after confirming "Delete this file? It is moved to the deleted-files folder and removed from the project."
  - With no attachments: "No files yet."
- **FilePreview:** a dialog (`role="dialog"`, `aria-modal`, closed by Escape) that shows a PDF in an `<iframe src="/api/attachments/:id/file?inline=1">` or an image in an `<img>`, with the file name and **Download**. Focus is trapped while it's open and returns to the button that opened it.
- **In `EntryForm`:** an **Attach files** picker uses `Uploader`, with the type defaulting to "Meeting Minutes" for meetings and "Other" for updates.
  - Saving uploads the files first. When all have succeeded, the entry is created with their `attachmentIds`.
  - A failed upload stops the save and shows **Retry**, and the entry isn't saved.
  - When editing, existing attachments can be unlinked, with an × on each chip.
- **`EntryItem`** lists its attachments with Preview and Download.
- **Settings** gets an **Attachment types** list editor. It is bilingual, like the other lists.
- **Size formatting** goes in `format.ts`: `fileSize(lang, bytes)` gives KB or MB with one decimal, e.g. "2.4 MB" / "2.4 ميغابايت", and "كيلوبايت" in Arabic.

- [ ] **Step 1: Write the failing tests.** `XMLHttpRequest` is mocked with a small fake that can fire progress, load and error.
  - Uploading two files sends two requests, with `X-File-Name` encoded (an Arabic name round-trips) and the query holding the type and phase.
  - A failure on the second file shows Retry for it only, and Retry resends it.
  - The table filters by type.
  - Preview opens a dialog with an iframe whose `src` ends with `?inline=1`, and Escape closes it.
  - Delete confirms, then sends DELETE.
  - In `EntryForm`, a failed upload means **no** entry POST. After a retry succeeds, the entry POST includes the `attachmentIds`.
  - `fileSize` in both languages.
  - Arabic render tests, and the no-English guard extended to this tab.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: upload, preview, filter and manage project files, and attach them to meetings and updates`.

---

### Task 6: The phase side panel, from a Gantt bar click, and read-only in the focus view

**Files:**
- Create: `client/components/PhasePanel.tsx`
- Modify: `client/gantt/Gantt.tsx` (a new `onPieceOpen?: (phaseId: number) => void`; the bars and segments of phase rows carry a `phaseId`; the tap and click behaviour), `client/gantt/rows.ts` (`phaseId` on phase bars and segments; lane bars carry their sub-phase id), `ProjectPage.tsx`, `client/pages/present/FocusPage.tsx`, `shared/i18n/*`, `client/styles.css`
- Test: `client/components/PhasePanel.test.tsx` (new), `client/gantt/Gantt.test.tsx`, `ProjectPage.test.tsx`, `client/pages/present/FocusPage.test.tsx`, plus Arabic tests

**Behaviour:**
- **The Gantt chart:** when `onPieceOpen` is given, **clicking** a phase bar, a segment (a sub-phase) or a lane bar calls it with that phase's or sub-phase's id. So does pressing Enter or Space on the focused piece.
  - Hover and focus still show the details card on devices that can hover.
  - On a no-hover (touch) device, a tap calls `onPieceOpen` instead of pinning the card.
  - The name label in the left column (the right in RTL) keeps showing the phase's details card on hover, and a click on it also opens the panel.
  - Without `onPieceOpen` (the portfolio, the dashboard, the wizard preview), behaviour is unchanged.
- **`PhasePanel`** (`role="dialog"`, `aria-modal="false"`, labelled by its heading):
  - It is a panel fixed to the viewport's **inline end**: the right in English, the left in Arabic. It's 420px wide, or the full width under 640px, and slides in with a short transition (none when `prefers-reduced-motion`).
  - The heading is the phase name. For a sub-phase: "Phase › Sub-phase".
  - The summary shows the dates with weekdays, the working days, and the people on it (manage mode only).
  - Then its **history**: entries (meetings and updates), to-dos (manage mode only) and attachments for that phase, including its sub-phases for a top-level phase.
    - They're in one list in date order: an entry's date it happened, a to-do's due date (or created date), an attachment's document date (or upload date). The newest come first.
    - A toggle groups them **By week** ("Mon 12 Oct – Fri 16 Oct") or **By type** (Meetings, Updates, To-dos, Files). Each group collapses.
  - **Manage mode** has buttons: **Add meeting**, **Add update**, **Add to-do** and **Upload file**. Each opens the matching form inside the panel with the phase preset (reusing `EntryForm`, `ToDoForm` and `Uploader`), and after saving the panel and the project page reload.
  - A close button (×) and Escape close it, and focus returns to the bar.
  - Only one panel is open at a time. Clicking another bar switches it.
- **The project page:** it passes `onPieceOpen` and renders the panel in manage mode. The open phase is kept in the URL as `?phase=<id>`, so reload and Back work.
- **The focus view (presentation):**
  - It renders the panel in **read-only mode**: no buttons, **no to-dos**, no people's names, and only **highlighted** entries, with their attachments (which can be previewed and downloaded).
  - With nothing highlighted for the phase: "Nothing to show for this phase yet." / "لا يوجد ما يُعرض لهذه المرحلة بعد."
  - The read-only guard: `FocusPage` still has no editing controls.

- [ ] **Step 1: Write the failing tests:**
  - **Gantt:** clicking a segment calls `onPieceOpen` with the sub-phase id; clicking the phase bar calls it with the phase id; Enter on a focused piece does the same. Without `onPieceOpen`, a click doesn't throw, and the old tap-pin behaviour is covered by its existing tests.
  - **`PhasePanel`:**
    - It lists a meeting, a to-do and a file in date order.
    - By type groups them.
    - Collapsing a group hides its items.
    - Add meeting opens `EntryForm` with the phase preset.
    - Escape closes it.
    - In Arabic the panel carries a class, or computed CSS, showing it's anchored at the inline end.
  - **The project page:** clicking a bar opens the panel, and the URL has `phase=`. Loading with `?phase=<id>` opens it.
  - **The focus view:** clicking a bar opens the read-only panel, which shows only highlighted entries. No to-dos appear, no buttons render inside the panel apart from close, preview and download, and there are no people's names.
  - **The no-English guard** is extended to the open panel in both modes.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: click a phase on the Gantt chart to open its history in a side panel, read-only for stakeholders`.

---

### Task 7: Demo meetings, updates and files (completes M7)

**Files:**
- Modify: `server/demoData.ts`, `server/demoData.test.ts`, `server/seed.ts` (pass the attachments folder)
- Test: `server/demoData.test.ts`

**The data** (write it naturally; the Arabic project's entries are in Arabic):
- **E-Services Mobile App** (English):
  - a **Requirements workshop** meeting on 2026-10-07:
    - phase: Requirements gathering;
    - attendees: Aisha Khan, Sara Ahmed, Mariam Al Suwaidi;
    - notes: 3–4 lines;
    - highlighted;
    - one follow-up to-do for Aisha, due 2026-10-14: "Share the draft requirements list";
    - a **Meeting Minutes** file "Requirements workshop minutes.pdf";
  - a **status update** on 2026-10-16, not highlighted: "Requirements gathering on track".
- **Case Management System:**
  - an **Approval** file "UAT sign-off.pdf" on the UAT phase, with document date 2026-10-09;
  - a highlighted update, "UAT signed off by the business", on 2026-10-09.
- **Customer Portal Revamp** (a past project, record history):
  - a highlighted meeting, **Launch go/no-go**, on 2026-06-16, with two attendees;
  - a **Test Report** file on QA.
- **بوابة الخدمات الذكية:**
  - a meeting **"ورشة جمع المتطلبات"** on 2027-01-13, in Requirements gathering, with attendees and Arabic notes, highlighted;
  - an **محضر اجتماع** file named **"محضر ورشة المتطلبات.pdf"**.
- **The demo files** are tiny valid PDFs, generated in code: a minimal one-page PDF with the file's title as text. Use Latin-safe text inside the PDF (the PDF's own content doesn't need Arabic glyphs); the file name can be Arabic. They're written through the same attachments repo, into the configured attachments folder.
- **`seedDemo`** takes an `attachmentsDir` parameter. `npm run seed` uses `'attachments'`, and tests use a temporary folder.
- **The M4/M5/M6 demo assertions** stay unchanged. If a count of to-dos changes because of the new follow-up, filter it in the test the way M6 did, keeping the expected values.

- [ ] **Step 1: Write the failing test:**
  - after seeding, E-Services has 2 entries;
  - the workshop has 3 attendees, a follow-up to-do linked back to it, and a Meeting Minutes attachment whose file exists and starts with `%PDF`;
  - the Arabic project's meeting has an Arabic title, and an attachment with an Arabic file name;
  - the highlighted entries total 4.
- [ ] **Step 2:** Run the test and confirm it FAILS.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: demo meetings, updates and files in English and Arabic`.

---

### ✅ M7 checkpoint: stop and demo to the user
1. Stop `npm run dev`. Back up and then delete `data/pm.db`, and delete the `attachments/` folder. Run `npm run seed` (it prints "Added 7 demo projects.") and `npm run dev`, and **restart the dev server before checking**.
2. **E-Services Mobile App project page:** the tabs, with History selected by default.
   - History shows the workshop (attendees, notes, a "shown in presentation" badge, the minutes PDF, the follow-up to-do) and the update.
   - **Add meeting** with two attendees, a follow-up and an attached file. Try a failed upload: stop the server mid-upload, see Retry, and no half-saved meeting.
3. **The Attachments tab:** upload any file (a Word or Excel file, for example), filter by type, preview a PDF, download, and delete it (it goes to `attachments/_deleted`).
4. **Click the Development bar,** then an increment. The side panel slides in from the right in English and from the left in Arabic, with that phase's history. Switch By week / By type, add an update from the panel, and close it with Escape.
5. **To-dos from a meeting** show "من اجتماع …" / "From the meeting on …".
6. **Settings** has the **Attachment types** list, in both languages.
7. **Presentation → focus view:** clicking a bar shows only highlighted entries and their files, with no to-dos and no editing.
8. **Arabic:** the whole flow reads naturally. Review the new glossary terms.

**When M7 is approved, fast-forward every branch to `build/m7`. Then write the M8 plan (progress and decisions) on `design/portfolio-spec`.**
