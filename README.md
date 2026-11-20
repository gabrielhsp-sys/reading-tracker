# Reading Tracker

A web application that replaces a reading log kept in a Word document: authors, books and
readings as structured data, with consistent input and a sortable reading log.

Semester assignment for **Full Stack Web Development** (UNIFAL-MG), Prof. Rodrigo Martins Pagliares.
This repository currently holds **Delivery 1 – Frontend**: vanilla HTML, CSS and JavaScript, with the
data stored in the browser (`localStorage`).

## Team members

| Name | Student ID |
|---|---|
| Gabriel Henrique Silva Pereira | 2025.1.08.036 |
| Pedro Gustavo da S. Fernandes | 2026.1.08.039 |

The team composition is final and will not change for Delivery 2.

## How to run

The pages load `data/seed.json` with `fetch`, which does not work when `index.html` is opened
directly from disk (`file://`). Serve the folder with any static server:

1. Clone the repository and enter the folder:
   ```bash
   git clone https://github.com/gabrielhsp-sys/reading-tracker.git
   cd reading-tracker
   ```
2. Start a static server in the project folder, using **one** of these:
   - Python 3: `python3 -m http.server 8000` (on Windows: `py -m http.server 8000`)
   - VS Code: open the folder and click **Go Live** (Live Server extension) with `index.html` open.
3. Open <http://localhost:8000> (Live Server opens the browser by itself, usually on port 5500).

On the first visit the application loads the seed data into `localStorage`. Later visits read only
from `localStorage`. **Reset data** (top right) deletes all changes and loads the seed again.

**Java version:** not applicable to Delivery 1 (there is no backend yet).

### Automated tests (optional)

The rules of Section 4, the reading log ordering and the data module are covered by tests that use
Node's built-in test runner (no npm, no packages). With Node.js 22 or newer, from the project folder:

```bash
node --test
```

The suite checks every Section 4 rule, that **every record of the seed passes validation**, the FR-05
ordering, and runs the real `js/store.js` against an in-memory `localStorage` (seed loaded only once,
IDs, reset, 400/404/409 errors, cascade delete).

## Requirement checklist

### Core (mandatory)

| ID | Requirement | Status | Where to see it |
|---|---|---|---|
| FR-01 | Manage authors | Implemented | **Authors**: create, view (click a name), edit, delete. Deleting an author linked to books shows a message naming the books, e.g. "Author is linked to 2 books: …", and nothing is deleted. |
| FR-02 | Manage books | Implemented | **Books**: create, view, edit, delete. Authors and themes are chosen from existing records; a new theme can be created on the spot from the book form (duplicates, ignoring case, are rejected). |
| FR-03 | Manage readings | Implemented | Book page → **Add reading**, Edit, Delete. **New book** has an optional *First reading* section, so one Save creates the book and its reading (e.g. a wishlist entry). Deleting a book asks for confirmation stating how many readings will be deleted, then deletes them too. |
| FR-04 | Status workflow | Implemented | Reading form: the five statuses; Read requires a year read; leaving Want to read clears the priority and keeps recommendation and notes; moving to a status that does not allow year read or grade asks for confirmation before clearing them (Cancel keeps the old status). Fields not allowed by the status are disabled. |
| FR-05 | Reading log | Implemented | **Reading log**: title, authors, status, year read, grade; click a column header to sort (again to reverse). Missing values show as "-" and sort after filled values in both directions. Default: year read (most recent first), then ID ascending. |
| FR-06 | Validation | Implemented | Every Section 4 rule is checked in the form, with the message next to the field; `store.js` checks the same rules again and refuses invalid data, so invalid data is never saved. |
| FR-07 | Seed data | Implemented | Seed loaded on first use only; data survives reloads; **Reset data** asks for confirmation, clears this app's `localStorage` keys and loads the seed again (IDs start from 1 again). |

### Optional (not graded)

| ID | Requirement | Status |
|---|---|---|
| FR-08 | Filters and search | Implemented: reading log filters by status, year read, author, form and theme, plus search by title or author name (partial, case- and accent-insensitive). Filters combine. |
| FR-09 | Wishlist | Implemented: **Wishlist** lists readings with status Want to read, sorted by priority (High, Medium, Low, then none), with who recommended each book. |
| FR-10 – FR-18 | | Not implemented. |

## Rules as implemented

Section 4 of the statement is the source of truth. Where it left room for interpretation:

- **Author** – name required and unique ignoring case (surrounding spaces ignored); nationality from
  the fixed country list of the seed (countries cannot be created, edited or deleted); birth date not
  in the future; death date after the birth date (and, as a consequence of being a past event, not
  in the future).
- **Book** – title required; zero or more authors, chosen from existing authors, never retyped;
  publication year a whole number, not in the future, negative for BC, `0` rejected; form, mode and
  content from the lists of Section 4; zero or more themes, existing or created on the spot, no
  duplicates. Changing the publication year of a book is refused if a reading of that book would then
  have a year read earlier than the publication year.
- **Reading** – book required; status from the list; year read required for Read, optional for
  Abandoned, empty otherwise, not in the future and not earlier than the book's publication year;
  grade from 0.0 to 10.0 in steps of 0.5, only for Read or Abandoned (the form accepts `7,5` as well as
  `7.5`); priority Low/Medium/High only for Want to read; recommended by and notes are free text.
- **New book with a first reading** – the book and the reading are both validated before anything is
  saved, so a failed Save never leaves a book without its reading.
- **Missing values** are always shown as `-`, never as `null`, `undefined` or `NaN`.

## Project structure

```
index.html              single page; loads js/main.js as an ES module
css/style.css           all styles (no inline styles, no <style> blocks)
data/seed.json          instructor-provided seed data (unchanged)
js/
  main.js               entry point: start-up, hash router, Reset data
  store.js              DATA ACCESS – the only module that reads or writes data
  validation.js         VALIDATION – Section 4 rules as pure functions
  domain.js             controlled values (forms, modes, contents, statuses, priorities)
  status.js             FR-04 status transition rules
  sort.js               FR-05 reading log ordering
  strings.js            all interface text (US English) in one place
  ui.js                 RENDERING helpers: elements, dialogs, toasts, inline field errors
  views/                RENDERING of each page (log, books, authors, wishlist)
  forms/                RENDERING and event handling of the forms
tests/                  node:test suites (validation, sorting, store, seed)
```

Events are attached with `addEventListener` only; there are no `onclick` or `style` attributes.

## Prepared for Delivery 2

All data access goes through `js/store.js`. Every exported function is `async` and is called with
`await`: `getAuthors`, `getAuthor`, `saveAuthor`, `deleteAuthor`, `getBooks`, `getBook`, `saveBook`,
`deleteBook`, `getReadings`, `getBookReadings`, `getReading`, `saveReading`, `deleteReading`,
`getThemes`, `saveTheme`, `getCountries`, `resetData`. Records use the shapes of `seed.json`
(e.g. a book has `authorIds` and `themeIds`). On failure they throw an error with the API format:

```json
{ "status": 400, "message": "Validation failed",
  "errors": [{ "field": "yearRead", "message": "Year read is required when status is Read" }] }
```

with `404` for a missing record and `409` (empty `errors`) for conflicts: deleting an author linked to
books, or creating an author or theme whose name already exists. The interface never relies on
specific ID values. In Delivery 2 only `store.js` will be rewritten to call the REST API.

## Libraries and external resources

- Google Fonts (Source Serif 4 and Public Sans), allowed by Section 3. Without network access the
  page falls back to system fonts.
- No other library, framework, build tool or npm package is used.

## Notes on the seed data

`data/seed.json` is used exactly as provided. Its counts are 27 countries, 101 authors, **135** themes,
143 books and 143 readings (115 Read, 12 Paused, 16 Want to read). The *Seed_Data_Guide* lists 132
themes; the application uses the file as it is.

## AI usage statement

| Tool | Used for | Parts affected |
|---|---|---|
| Claude Code (Anthropic) | Generated the code, the tests and this README for Delivery 1, from the assignment statement and the team's instructions; also ran the tests and a headless-browser check of each requirement | All files in the repository (except `data/seed.json`, provided by the instructor) |

Every team member is responsible for understanding and being able to explain any part of this code (Section 10).
