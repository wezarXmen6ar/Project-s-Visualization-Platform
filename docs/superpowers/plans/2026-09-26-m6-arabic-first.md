# Milestone 6: Arabic First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app opens in natural Arabic, laid out right to left (including Gantt charts), with a switch to English. Everything the app says, on every existing screen, is available in both languages, using an approved glossary. From here on, every milestone ships both languages.

**Architecture:**
- **Message catalogues.** English and Arabic live in `shared/i18n/`. English is the source; the Arabic catalogue is typed against it, so a missing Arabic string is a **type error**. Messages support `{name}` placeholders and Arabic plural forms (through the built-in `Intl.PluralRules`).
- **React side.** A `LanguageProvider` holds the current language (Arabic by default, remembered per device) and sets `<html lang dir>`. `useT()` returns `t(key, params)` plus date and number formatters built on `Intl.DateTimeFormat` / `Intl.NumberFormat`, with Western digits.
- **Server messages.** The server keeps sending English `message`s, and now also sends a `code` and `params` for every validation issue and error, so the browser shows them in the user's language.
- **Lists.** List values (phases, roles, project types, goals, departments, main projects) get an optional Arabic name.
- **Layout.** CSS moves to logical properties (`margin-inline-start`, and so on) so the whole page mirrors. The Gantt chart mirrors its time axis in Arabic.

**Tech Stack:** Node 24, TypeScript 5, React 19, React Router 7, Vite 6, Fastify 5, zod 3, `node:sqlite`, Vitest 3, Testing Library, jsdom. **No new dependencies:** `Intl` provides dates, numbers and plural rules, and Node 24 ships full ICU.

**Spec:** §8 "Language: Arabic first", and the delivery principles in §1. **Glossary:** `docs/superpowers/glossary-ar.md`, which the user approves together with this plan.

**Decisions confirmed with the user (2026-09-26):**
- Arabic comes now, as M6, before meetings. The app **opens in Arabic** with an English switch.
- **Western digits (0–9).**
- **Right-to-left Gantt charts** in Arabic.
- **Natural Arabic, not a literal translation.** Terms follow the approved glossary.
- **Use as little English as possible.** An English term stays only when the team really says it in English at work. "Change Request" is the user's example. Acronyms can follow the Arabic in brackets, e.g. "ضمان الجودة (QA)".

**Deliberate choices (flag if you disagree):**
- **The two open questions from the spec:**
  - **List values get an optional Arabic name.** The ones the app ships with (the default phases and roles, the project types and goals) come with the Arabic from the glossary. Settings lets you edit both names. A value created from the Arabic interface stores what you typed as its main name.
  - **The presentation side uses the same language switch.** You choose the language on the presenting device.
- **Phase names on projects stay as stored text.** The app shows the Arabic name whenever a phase's name matches a list value, ignoring case. The colour palette also recognises the Arabic default names, so "التطوير" is Development's colour. Sub-phase names are what the user typed and are never translated.
- **The language is remembered per device, in `localStorage` (`pvp.lang`).** There's one user, so there's no account setting.
- **Tests stay in English.** Components rendered without a provider use English, so the ~450 existing tests keep asserting English text unchanged. Arabic gets its own tests, plus one guard test that renders the main pages in Arabic and fails if any app-generated English text is left.
- **The demo stays mostly English** (its projects and people are user content), but it gains Arabic names for its list values, plus one fully Arabic project, so right-to-left and mixed-direction text can be reviewed.

## Global Constraints

- **Branches:**
  - This plan and the glossary are committed on `design/portfolio-spec`.
  - The build happens on `build/m6`, created from `design/portfolio-spec` at that commit.
  - Doc fixes that come out of reviewing the build go on `build/m6`.
  - **Never commit to `main`.**
  - On merge, every branch (`main`, `design/portfolio-spec`, `build/m1-m2`, `build/m2`…`build/m6`) is fast-forwarded to the same commit.
- **No new npm dependencies.** Use `Intl` only.
- **Database:** `node:sqlite`, with raw parameterised SQL. **Append migrations only.** Migrations 1–10 exist; M6 adds 11.
- **Dates:**
  - ISO `YYYY-MM-DD` strings in code, and weeks start on Monday.
  - Displayed dates come only from the formatters in `client/i18n/format.ts`. Nothing else may keep its own month or day name arrays after Task 1.
  - **Western digits in both languages:** format Arabic with the locale `ar-AE-u-nu-latn`.
- **Text:**
  - After this milestone, **no user-visible English string may be hard-coded** in a component. It comes from the catalogues through `t(...)`. This includes `aria-label`s, `title`s, placeholders and `alt` text.
  - **Brand names and codes stay as they are:** "Jira", "CR", "QA", "UAT", project Jira keys, and UAE phone and email formats.
  - Every new English key must have its Arabic in the same commit. The typed catalogue enforces this.
- **Right to left:**
  - Use CSS logical properties (`margin-inline-start/end`, `padding-inline-*`, `inset-inline-*`, `text-align: start/end`, `border-inline-*`). There must be no physical left or right properties in `client/styles.css`, except where the direction really is physical, such as Gantt geometry calculated in JavaScript.
  - Icons that point somewhere (back and next arrows) flip in right-to-left pages.
- **User content** (project names, scope items, to-do titles and notes, sub-phase names, people's names) is **never translated**. Every element or input that shows it gets `dir="auto"`, so English inside Arabic, and Arabic inside English, reads correctly.
- **Tests:**
  - Every client test file starts with `// @vitest-environment jsdom`.
  - Existing English assertions stay valid, because tests render in English unless they wrap the component in `<LanguageProvider lang="ar">`.
  - Fix "today" with `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(...)` where needed.
- **Presentation side:** read-only, as always. To-dos never appear there.

## Where M6 sits
M1–M5 are merged to `main` at `7697fdb`. The app has English-only screens:
- Landing;
- the Projects dashboard;
- the project page, with its Timeline, Details, Description, Scope, Phases, People, My next steps, To-dos and starter offer;
- the new-project wizard (4 steps), Edit details and Edit phases;
- Resources: the People table and the Days/Weeks heatmap with the overload panel;
- the person page, with Working on, To-dos and Leave;
- the To-dos page and Settings (lists, I am, starter to-dos, backups);
- the presentation portfolio and focus view.

## File Structure (M6)
```
shared/i18n/
  types.ts            Lang = 'ar' | 'en'; Message = string | PluralForms; Params; MessageKey
  en.ts               English catalogue, grouped by area; the source of MessageKey          (Tasks 1–6)
  ar.ts               Arabic catalogue: Record<MessageKey, Message>, so a missing key fails typecheck (Tasks 1–6)
  translate.ts        translate(lang, key, params) with {placeholders} and Intl.PluralRules    (Task 1)
client/i18n/
  LanguageProvider.tsx  context, the useLang() / useT() hooks, localStorage, <html lang dir>  (Task 1)
  format.ts           dayDate, formatDate, shortDate, monthLabel, yearLabel, weekdayLetter,
                      barDates, percent, count, for 'ar' and 'en'                              (Task 1)
  LanguageSwitch.tsx  "العربية | English" toggle                                              (Task 1)
client/components/AppShell.tsx  a thin top bar with the language switch, around every route   (Task 1)
server/db.ts          migration 11: list_values.name_ar                                        (Task 3)
docs/superpowers/glossary-ar.md                                                               (committed with this plan)
```

---

### Task 1: The language foundation — catalogues, provider, switch, formatters, and right-to-left CSS

**Files:**
- Create: `shared/i18n/types.ts`, `shared/i18n/en.ts`, `shared/i18n/ar.ts`, `shared/i18n/translate.ts`, `client/i18n/LanguageProvider.tsx`, `client/i18n/format.ts`, `client/i18n/LanguageSwitch.tsx`, `client/components/AppShell.tsx`
- Modify:
  - `client/main.tsx` (wrap in `LanguageProvider`), `client/App.tsx` (wrap routes in `AppShell`);
  - `client/styles.css` (logical properties, font stack, `[dir='rtl']` icon flip);
  - `client/icons.tsx` (arrows get class `icon-directional`);
  - `client/pages/Landing.tsx` and `client/pages/NotFound.tsx` (the first screens translated);
  - every file with its own `MONTHS` or `DAYS` array (`client/overloads.ts`, `client/pages/manage/labels.ts`, `client/gantt/scale.ts`, `client/gantt/barDates.ts`): they delegate to `format.ts`, and the English output stays **byte-identical**.
- Test: `shared/i18n/translate.test.ts`, `client/i18n/format.test.ts`, `client/i18n/LanguageProvider.test.tsx`, `client/pages/Landing.test.tsx`

**Interfaces:**
- `shared/i18n/types.ts`:
  ```ts
  export type Lang = 'ar' | 'en';
  export interface PluralForms { zero?: string; one: string; two?: string; few?: string; many?: string; other: string }
  export type Message = string | PluralForms;
  export type Params = Record<string, string | number>;
  ```
- `shared/i18n/en.ts`:
  - `export const en = { … } satisfies Record<string, Message>`, with keys namespaced by area (`common.save`, `landing.manage`, `nav.back`, …);
  - `export type MessageKey = keyof typeof en;`.
- `shared/i18n/ar.ts`: `export const ar: Record<MessageKey, Message> = { … }`. A missing key, or an extra key, is a type error.
- `shared/i18n/translate.ts`:
  - `export function translate(lang: Lang, key: MessageKey, params?: Params): string`.
  - It fills in `{name}` placeholders.
  - For a `PluralForms` message it picks the form with `new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en').select(Number(params.count))`, falling back to `other`, and replaces `{count}`.
  - An unknown key returns the key itself, so it's never blank.
- `client/i18n/LanguageProvider.tsx`:
  - `export function LanguageProvider(props: { lang?: Lang; children })`. It's controlled when `lang` is given (tests use this); otherwise it starts from `localStorage['pvp.lang']` (with try/catch), defaulting to `'ar'`.
  - Hooks: `useLang(): { lang: Lang; dir: 'rtl' | 'ltr'; setLang(l: Lang): void }` and `useT(): (key: MessageKey, params?: Params) => string`.
  - **Without a provider, the context default is English, with no change of `dir`,** which keeps every existing test valid.
  - While mounted and uncontrolled, it sets `document.documentElement.lang` and `.dir`.
- `client/i18n/format.ts`, all pure and taking `lang` as the first argument:
  - `dayDate(lang, iso)`: "Mon 12 Oct" / "الاثنين 12 أكتوبر";
  - `formatDate(lang, iso)`: "Mon 12 Oct 2026" / "الاثنين 12 أكتوبر 2026";
  - `shortDate(lang, iso)`: "12 Oct" / "12 أكتوبر";
  - `monthLabel(lang, iso)`: "Oct" / "أكتوبر";
  - `weekdayLetter(lang, iso)`: "M" / "ن";
  - `barDates(lang, start, end)`: the Task 12 M5 rules, with the year only when the two years differ;
  - `percent(lang, n)`: "60%";
  - `useFormat()`: a hook that binds them to the current language.

  Arabic uses `Intl.DateTimeFormat('ar-AE-u-nu-latn', …)` and strips the Arabic comma "،" that Intl puts after the weekday, so the result is "الاثنين 12 أكتوبر". English output must match today's formats exactly: reuse the existing arrays for English, or check against them in tests.
- `LanguageSwitch`:
  - two buttons, "العربية" and "English", with `aria-pressed`;
  - it lives in a thin `AppShell` bar at the top end of every page, and doesn't add a second navigation.

**Right-to-left CSS:**
- Replace every physical property in `client/styles.css` (about 17: `margin-left/right`, `padding-left/right`, `left:`/`right:`, `text-align: left/right`, `border-left/right`) with its logical equivalent.
- Add `[dir='rtl'] .icon-directional { transform: scaleX(-1); }`.
- **Font stack:** `'Segoe UI', 'Noto Sans Arabic', Tahoma, system-ui, sans-serif`. Segoe UI on Windows renders Arabic well. In Arabic, raise `line-height` slightly to 1.6, and don't use letter-spacing on Arabic text (letter-spacing breaks joined letters). Also turn off `text-transform: uppercase` in Arabic; the uppercase table headers must not apply there.

**The first translated screens:**
- **Landing:** "Project Management" becomes "إدارة المشاريع", "Project Presentation" becomes "عرض المشاريع", along with their descriptions. Write the Arabic naturally, following the glossary's style guide.
- **NotFound.**
- **The AppShell switch.**

- [ ] **Step 1: Write the failing tests**
  - `translate.test.ts`:
    - placeholders are filled;
    - an unknown key returns the key;
    - Arabic plurals for a test message `{ zero: 'لا مهام', one: 'مهمة واحدة', two: 'مهمتان', few: '{count} مهام', many: '{count} مهمة', other: '{count} مهمة' }` give "لا مهام" (0), "مهمة واحدة" (1), "مهمتان" (2), "3 مهام" (3), "11 مهمة" (11) and "100 مهمة" (100);
    - English one/other works.

    Test the pure translator with a small local catalogue, so the assertions don't depend on production strings.
  - `format.test.ts`:
    - for 2026-10-12, `dayDate` is 'Mon 12 Oct' / 'الاثنين 12 أكتوبر', `formatDate` is 'Mon 12 Oct 2026' / 'الاثنين 12 أكتوبر 2026', and `monthLabel` is 'Oct' / 'أكتوبر';
    - there are no Arabic-Indic digits in any Arabic output (`/[٠-٩]/` doesn't match);
    - `barDates('ar', '2026-11-30', '2027-02-19')` contains both years.
  - `LanguageProvider.test.tsx`:
    - without a provider, `useT()` gives English;
    - uncontrolled with empty storage, it gives Arabic and sets `html[dir=rtl][lang=ar]`;
    - clicking "English" in `LanguageSwitch` changes the text and `dir`, and stores `pvp.lang=en`;
    - a stored `en` is honoured on the next mount;
    - a throwing `localStorage` falls back to Arabic.
  - `Landing.test.tsx`: keep the English tests. Add an Arabic render (`<LanguageProvider lang="ar">`) showing "إدارة المشاريع" and "عرض المشاريع".
  - **Type-level check:** delete one key from `ar.ts` locally, confirm that `npm run typecheck` fails, then restore it. Note the result in the report; don't commit a failing file.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement. Keep every existing English string outside Landing and NotFound unchanged; the other screens are converted in Tasks 5 and 6.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass. **No existing test may change its expected English text.**
- [ ] **Step 5:** Commit with `feat: language foundation — Arabic and English catalogues, a remembered switch, Arabic dates with Western digits, and a right-to-left layout`.

---

### Task 2: Validation and server messages in both languages

**Why:** errors such as "Phase name is required", "Rami Saleh isn't on this project" or "…can't be deleted because they are assigned to 3 phases" come from shared zod schemas and server code, in English. The browser must show them in the user's language.

**Files:**
- Modify: `shared/schemas.ts`, `shared/i18n/en.ts` and `ar.ts` (a `validation.*` and `error.*` section), every server repo or route that builds a message (grep `server/` for `message:`, `error:`, `issues.push`, `reason:` and `\`…\``), `client/errors.ts` (`messagesOf`), and every client place that renders `ValidationIssue.message` or `ApiError.message` directly
- Test: `shared/schemas.test.ts` (or wherever schema messages are tested), `server/app.test.ts`, `client/errors.test.ts` (new)

**Interfaces:**
- `ValidationIssue` gains `code?: MessageKey; params?: Params`. API errors gain `{ error, code?, params? }`, and `ApiError` carries `code` and `params`.
- **Schemas:** each custom zod message becomes a **message key**, e.g. `min(1, 'validation.phaseNameRequired')`. `toIssues` turns it into `{ path, message: translate('en', key, params), code: key, params }`, so **the English `message` text stays identical** and existing server tests keep passing. Zod's own built-in messages (no custom text) map to a generic `validation.invalid` code, keeping their English text as the message.
- **Server-built messages** (unknown person, not on this project, can't delete because…, can't change side because…, starter list in use, …) return `code` and `params` too.
  - Multi-part reasons (for example "they are assigned to 3 phases and they have 1 to-do") are sent as `params.reasons: string[]` of **codes** with counts. The client joins them with the right conjunction for the language ("و" in Arabic).
  - Build the English text with `translate('en', …)`, so the English `message` stays byte-identical.
- **Client:** `messagesOf(err, t)` (or a `useErrorMessages()` hook) prefers `t(code, params)` and falls back to `message`. Every place that shows issues uses it.

- [ ] **Step 1: Write the failing tests**
  - Server: `POST /api/projects` with an empty phase name answers 400 with the issue `{ path: 'phases.0.name', message: 'Phase name is required', code: 'validation.phaseNameRequired' }`.
  - Deleting a person who is in use answers 409 with `code`, and `params.reasons` holding the reason codes and counts, while the English `error` text is unchanged.
  - `client/errors.test.ts`: with `lang='ar'`, an `ApiError` carrying `code: 'validation.phaseNameRequired'` is shown in Arabic. One with an unknown code falls back to `message`. A reasons list joins naturally in Arabic.
  - Every existing test that asserts an English error message still passes **unchanged**.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement. Write the Arabic for every message following the glossary. For example "Phase name is required" becomes "اسم المرحلة مطلوب", and "Rami Saleh isn't on this project" becomes "رامي صالح ليس ضمن فريق هذا المشروع" (the name is a parameter and stays as written).
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: validation and server messages carry codes, shown in Arabic or English`.

---

### Task 3: List values with Arabic names

**Files:**
- Modify: `server/db.ts` (migration 11), `server/lists/repo.ts`, `shared/types.ts` (`ListValue.nameAr: string | null`), `shared/schemas.ts` (list value input gains an optional `nameAr`), `server/app.ts`, `client/api.ts`, `client/components/OptionPicker.tsx`, `client/pages/manage/ListEditor.tsx`, `client/gantt/rows.ts` (`phaseColorFor` learns the Arabic default names), and every place that shows a phase or list name (the project page, wizard, Gantt, people cards, workload, to-dos, starters)
- Create: `client/i18n/listNames.ts`
- Test: `server/db.test.ts`, `server/lists/*.test.ts`, `client/i18n/listNames.test.ts`, `client/gantt/rows.test.ts`, `client/pages/manage/SettingsPage.test.tsx`

**Rules:**
- **Migration 11:**

  ```sql
  ALTER TABLE list_values ADD COLUMN name_ar TEXT;
  UPDATE list_values SET name_ar = CASE list || '|' || name
    WHEN 'phase|Requirements gathering' THEN 'جمع المتطلبات'
    ...
  END WHERE name_ar IS NULL;
  ```

  - It fills Arabic names from the glossary for every value the app ships with: the 10 phase names (including Design), the 8 roles, project types Criminal (جنائي), Customer (المتعاملون) and Management (إداري), and the goal "Digitalisation of internal operations" (رقمنة العمليات الداخلية).
  - Matching ignores case (`COLLATE NOCASE`), and names already renamed by the user are left alone.
  - Write the full `CASE` list in the migration.
- **Display:**
  - `listName(value, lang)` returns `nameAr ?? name` in Arabic, and `name` in English.
  - `phaseName(name, lists, lang)` finds the Phases-list value whose `name` matches ignoring case and returns its Arabic name in Arabic. Otherwise it returns the stored text unchanged.
  - Sub-phase names are never looked up.
- **Editing:** Settings' list editor shows each value's English name and Arabic name, and both can be renamed. "Other…" in a dropdown stores the typed text as `name`, whichever the interface language is, with `name_ar` empty; the Arabic name can be added later in Settings.
- **Colours:** `phaseColorFor` also recognises the Arabic default names (and "ضمان الجودة", "اختبار قبول المستخدم" and so on, with or without the bracketed acronym), so a phase typed in Arabic gets the standard colour.
- **The server** keeps matching phase names on the `name` column. Its rename and in-use rules are unchanged.

- [ ] **Step 1: Write the failing tests**
  - Migrating a version-10 database fills `name_ar` for the defaults and leaves a custom value with `null`. `integrity_check` is ok.
  - `PUT /api/lists/phase/:id` with `{ name, nameAr }` saves both.
  - In Arabic, the phase name "development" shows "التطوير". An unknown name shows as typed.
  - `phaseColorFor('التطوير') === phaseColorFor('Development')`.
  - In Arabic, the Settings list editor shows both names, and renaming the Arabic name sends `nameAr`.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: list values have Arabic names, shown and edited in the user's language`.

---

### Task 4: Right-to-left Gantt charts and heatmaps

**Files:**
- Modify: `client/gantt/Gantt.tsx`, `client/gantt/scale.ts`, `client/gantt/barDates.ts` (uses `format.ts`), `client/pages/manage/DayHeatmap.tsx`, `client/pages/manage/WorkloadHeatmap.tsx`, `client/styles.css`
- Test: `client/gantt/Gantt.test.tsx`, `client/gantt/scale.test.ts`, `client/pages/manage/DayHeatmap.test.tsx`

**Rules:**
- **Mirrored Gantt.** In Arabic, `Gantt` puts the name column on the **right**, and time runs **right to left**: a date's x-position is mirrored, `x' = chartLeft + chartW - (x + width)`.
  - Everything drawn by position mirrors: bars, segments, dividers, gaps, the today line, the week and month lines, the bar-date labels (placed **left** of a bar's end, which is now on its left, with the same fit rules mirrored) and the details card position.
  - SVG text stays readable. Don't flip text with a transform; set `text-anchor` and `direction="rtl"` so Arabic labels render correctly.
  - The header rows (year, month, week numbers) use `format.ts` month labels in the current language.
- **Test ids stay as they are.** Tests get the direction from `useLang()`, or from a `dir` prop that the chart takes with a default from context.
- **Heatmaps** are HTML tables, so `dir="rtl"` already orders their columns from right to left. Check that:
  - the sticky name column sticks to the **right** in RTL (`inset-inline-start: 0`);
  - the day letters and week headers use `format.ts`;
  - the leave stripes and the "today" marker are correct.
- **Portfolio and dashboard charts** mirror the same way.

- [ ] **Step 1: Write the failing tests**
  - `Gantt.test.tsx`, rendered in Arabic: a bar for an earlier phase has a **larger** x than a later one. The name labels sit at x greater than the chart area. The month labels are Arabic ("أكتوبر"). The today line is mirrored.
  - Rendered in English, the output is unchanged from before: every existing test passes.
  - `DayHeatmap.test.tsx` in Arabic: the day letters are Arabic, and the week heading is "12–16 أكتوبر".
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: Gantt charts and heatmaps run right to left in Arabic`.

---

### Task 5: Translate the project screens

**Scope:** every piece of user-visible text (headings, labels, buttons, hints, empty states, placeholders, `aria-label`s, confirmations and generated lines) in:
- `ManageDashboardPage` and `MyNextSteps`;
- `ProjectPage` with all its cards: Details, Description, Scope and goals, Phases table, `ProjectPeople`, `NextUp` ("My next steps"), `ProjectToDos` and `ToDoForm`, `StarterOffer`;
- `CreateProjectPage` with `DetailsFields`, `ScopeFields`, `ItemTable`, `PhasesFields`, `SubPhaseList` and `PeopleFields`;
- `AssignmentsEditor`, `PersonPicker` and `OptionPicker`;
- `EditProjectPage` and `EditPhasesPage` (including the removal warning with its Arabic plural counts);
- `client/pages/present/PortfolioPage.tsx` and `FocusPage.tsx`;
- `client/pages/manage/labels.ts`: `PRIORITY_LABEL`, `CATEGORY_LABEL`, the scope table titles, and the requester and beneficiary labels, which become catalogue keys;
- `client/todos.ts` label builders (`dueLabel`, `formerPhaseLabel`, the assignee choices' "(project manager)" and so on) and `ToDoMetaLine`.

**Rules:**
- **Arabic:** write it naturally, following the glossary and its style guide. Use plural messages for every count ("1 person / N people", "N working days", "N open to-dos", "Add N to-dos", …).
- **English:** keep every existing string byte-identical, so the existing tests pass untouched. Where a string was built by concatenation, make it one message with placeholders, so Arabic word order can differ.
- **User content:** add `dir="auto"` to every element or input that shows it (project name, scope item text, to-do title and note, sub-phase names, people's names in lists).

- [ ] **Step 1: Write the failing tests.** For each converted page, add one Arabic render test with `<LanguageProvider lang="ar">`, asserting 3–5 key Arabic strings, for example:
  - the dashboard heading "المشاريع", "خطواتي التالية" and "إضافة مشروع جديد" (or the glossary's wording);
  - the project page's "الجدول الزمني", "التفاصيل", "تعديل المراحل" and "المهام";
  - the wizard steps "المعلومات الأساسية", "الوصف والنطاق", "المراحل" and "الأشخاص";
  - an Arabic plural in the Edit phases warning.

  Also test that `html` has `dir="rtl"` when the app shell is used.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement, file by file. Add keys to `en.ts` and `ar.ts` under `project.*`, `wizard.*`, `todo.*`, `present.*` and `common.*`.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass. **No existing English assertion changes.**
- [ ] **Step 5:** Commit with `feat: project, wizard, to-do and presentation screens in Arabic`.

---

### Task 6: Translate resources, the workload views, the person page, the To-dos page and Settings

**Scope:** every piece of user-visible text in:
- `ResourcesPage` (the People table, including its column headers and sort labels, the filters, the heatmap legend, the Days/Weeks switch and the navigation);
- `WorkloadHeatmap`, `DayHeatmap` and `OverloadPanel` (the decision prompt: Split, Reassign, Accept, and the disabled Pause and Delay with their explanation);
- `client/overloads.ts` warning lines;
- `PersonPage` (the form, side, specialisation, capacity, leave card, and the delete and deactivate messages), `PersonWork` and the person's To-dos card;
- `ToDosPage` (its filters, including "Mine", "Unassigned", "From removed phases" and "Show done");
- `SettingsPage` (the list editors, `MeSetting`, `StarterEditor`, `BackupsCard`);
- `peopleTable.ts` labels;
- the dashboard's overbooking notice.

**Rules:** the same as Task 5. Watch in particular:
- **Workload sentences:** "Aisha Khan is overbooked in the next 4 weeks" becomes "عائشة خان فوق طاقتها خلال الأسابيع الأربعة القادمة". Use a gender-neutral wording where the gender isn't known, e.g. "تجاوز الحِمل لدى عائشة خان…", and document the choice in the glossary.
- **Booked vs available lines:** "Mon 5 Oct – Fri 9 Oct: 150% booked, 100% available".
- **Leave lines.**

- [ ] **Step 1: Write the failing tests.** Add one Arabic render test per converted page, asserting 3–5 key strings each:
  - the Resources heading "الموارد" and the "أيام | أسابيع" switch;
  - the People table's column headers;
  - an overload warning line in Arabic;
  - Settings' "المستخدم الحالي" and "مهام جاهزة";
  - the To-dos page filters.
- [ ] **Step 2:** Run the tests and confirm they FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: resources, workload, person, to-dos and settings screens in Arabic`.

---

### Task 7: The "no English left behind" guard, mixed-direction text, and the Arabic demo

**Files:**
- Create: `client/i18n/noEnglish.test.tsx`
- Modify: `server/demoData.ts` (Arabic names for the demo's list values, plus one Arabic project), `server/demoData.test.ts`, `docs/superpowers/glossary-ar.md` (add any term the translation tasks introduced, and mark it as added)

**The guard test:**
- Render these pages in Arabic with **Arabic fixture content** (project, people and to-do names in Arabic):
  - the dashboard, project page, wizard steps 1–4, Edit phases;
  - Resources, the person page, To-dos, Settings;
  - the portfolio and focus view.
- Walk every text node, and every `aria-label`, `placeholder` and `title` attribute.
- **Fail** on any run of two or more consecutive Latin-letter words, except an allowlist: `Jira`, `CR`, `QA`, `UAT`, `PRJ-` keys, email addresses, and anything inside an element marked `data-user-content`.
- The failure message lists each English string and where it was found, so a missing translation is easy to fix.

**Mixed direction:**
- A test renders an Arabic page containing an English project name ("E-Services Mobile App"). The name's element has `dir="auto"`.
- An English page containing an Arabic to-do title works the same way.

**The Arabic demo:**
- The demo's departments, main projects and goals get Arabic names (`name_ar`).
- Add a 7th demo project, fully in Arabic:
  - **"بوابة الخدمات الذكية"** (the Smart Services Portal), main project **"الخدمات الرقمية"**, with the Arabic background, summary, scope items, problems and objectives written naturally;
  - standard phases (whose names show in Arabic through the list values), starting 2027-01-10;
  - people from the existing team, and two to-dos in Arabic.
- The seed message becomes "Added 7 demo projects." Update any test that counts demo projects. The M4 and M5 demo scenarios must be unchanged; place the new project so it doesn't touch those weeks.

- [ ] **Step 1: Write the failing tests:** the guard test, the mixed-direction tests, and the demo test (7 projects, the Arabic project's phases resolve to Arabic names in Arabic).
- [ ] **Step 2:** Run them and confirm they FAIL. The guard may already pass if Tasks 5–6 were complete; if it does, prove it can fail by temporarily adding an English string and noting the result.
- [ ] **Step 3:** Fix whatever the guard finds, then implement the demo.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck`, and confirm both pass.
- [ ] **Step 5:** Commit with `feat: guard against untranslated text, mixed-direction content, and an Arabic demo project`.

---

### ✅ M6 checkpoint: stop and demo to the user
1. Stop `npm run dev`, delete `data/pm.db`, and run `npm run seed`. Expected: "Added 7 demo projects." Then run `npm run dev` and **restart it before checking**, because Vite can serve stale files.
2. **The app opens in Arabic, right to left:**
   - Landing, the dashboard, a project page, the wizard, Resources, the person page, To-dos and Settings;
   - the presentation portfolio and focus view.
3. **The switch** at the top changes to English and back, and the choice survives a reload.
4. **Gantt charts in Arabic** run from right to left, with Arabic month names, Friday week numbers and bar dates in Arabic. The sub-phase details card is in Arabic.
5. **Heatmaps:** Days and Weeks run right to left, with Arabic day letters and an Arabic legend and decision panel.
6. **Errors appear in Arabic.** For example, save a phase with an empty name, or try to delete a person who is in use.
7. **Settings:** the lists show and edit both names, and "التطوير" keeps Development's colour.
8. **The demo's Arabic project** reads naturally, and the English project names display correctly inside the Arabic pages.
9. **Ask the user to review the Arabic wording page by page,** and record any term changes in the glossary.

**When M6 is approved, fast-forward every branch to `build/m6`. Then write the M7 plan (meetings, updates, attachments) on `design/portfolio-spec`, bilingual from the start.**
