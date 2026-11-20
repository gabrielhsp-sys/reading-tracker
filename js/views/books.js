// FR-02 books list and FR-02/FR-03 book detail with its readings.
import { getBook, getBookReadings, deleteBook, deleteReading } from '../store.js';
import { STR, MISSING } from '../strings.js';
import { h, clear, formatYear, formatGrade, statusChip, show, confirmDialog, toast, alertDialog } from '../ui.js';
import { loadAll, authorNames, pageHeader, emptyState, tableWrap, td } from './common.js';
import { openBookForm } from '../forms/book-form.js';
import { openReadingForm } from '../forms/reading-form.js';

/** Confirms with the number of readings that will be deleted, then deletes (FR-03). */
export async function confirmDeleteBook(book) {
  const readings = await getBookReadings(book.id);
  const ok = await confirmDialog(STR.confirm.deleteBook(book.title, readings.length), { confirmLabel: STR.actions.delete, danger: true });
  if (!ok) return false;
  await deleteBook(book.id);
  toast(STR.text.deleted);
  return true;
}

export async function renderBooks(view, refresh) {
  const data = await loadAll();
  const readingCount = new Map();
  data.readings.forEach((r) => readingCount.set(r.bookId, (readingCount.get(r.bookId) || 0) + 1));
  const books = data.books.slice().sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));

  const body = books.length === 0
    ? emptyState(STR.text.emptyBooks)
    : tableWrap(h('table', { class: 'table' },
      h('caption', { class: 'visually-hidden' }, STR.titles.books),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, STR.fields.title),
        h('th', { scope: 'col' }, STR.fields.authors),
        h('th', { scope: 'col', class: 'num' }, STR.fields.yearShort),
        h('th', { scope: 'col' }, STR.fields.form),
        h('th', { scope: 'col', class: 'num' }, STR.fields.readings),
        h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, STR.fields.actions)),
      )),
      h('tbody', {}, books.map((book) => h('tr', {},
        td(STR.fields.title, h('a', { href: `#/books/${book.id}`, class: 'book-title' }, book.title), 'cell-title'),
        td(STR.fields.authors, authorNames(book, data).join(', ') || MISSING),
        td(STR.fields.yearShort, formatYear(book.publicationYear), 'num'),
        td(STR.fields.form, show(book.form)),
        td(STR.fields.readings, String(readingCount.get(book.id) || 0), 'num'),
        td(STR.fields.actions, h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'btn btn--small', 'aria-label': `${STR.actions.edit} ${book.title}`, on: { click: () => openBookForm(book, refresh) } }, STR.actions.edit),
          h('button', {
            type: 'button', class: 'btn btn--small btn--danger-quiet', 'aria-label': `${STR.actions.delete} ${book.title}`,
            on: { click: async () => { if (await confirmDeleteBook(book)) refresh(); } },
          }, STR.actions.delete),
        ), 'cell-actions'),
      ))),
    ));

  clear(view).append(
    pageHeader(STR.titles.books, `${STR.text.booksIntro} ${STR.text.booksCount(books.length)}.`,
      h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openBookForm(null, (saved) => { location.hash = `#/books/${saved.id}`; }) } }, STR.actions.newBook)),
    body,
  );
}

function dl(pairs) {
  return h('dl', { class: 'facts' }, pairs.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)]));
}

export async function renderBookDetail(view, refresh, id) {
  let book;
  try {
    book = await getBook(id);
  } catch (error) {
    if (error.status === 404) {
      clear(view).append(pageHeader(STR.titles.notFound, STR.text.bookNotFound), h('p', {}, h('a', { href: '#/books' }, STR.text.backTo(STR.titles.books))));
      return;
    }
    throw error;
  }
  const data = await loadAll();
  const readings = data.readings.filter((r) => r.bookId === book.id).sort((a, b) => a.id - b.id);
  const authors = (book.authorIds || []).map((aid) => data.authorById.get(aid)).filter(Boolean);
  const themes = (book.themeIds || []).map((tid) => data.themeById.get(tid)).filter(Boolean);

  const authorLinks = authors.length
    ? h('span', {}, authors.flatMap((a, i) => [i ? ', ' : '', h('a', { href: `#/authors/${a.id}` }, a.name)]))
    : MISSING;
  const themeList = themes.length
    ? h('ul', { class: 'tags' }, themes.map((t) => h('li', { class: 'tag' }, t.name)))
    : MISSING;

  const readingItems = readings.length === 0
    ? emptyState(STR.text.emptyReadings)
    : h('ol', { class: 'readings' }, readings.map((r) => h('li', { class: 'reading' },
      h('div', { class: 'reading__main' },
        statusChip(r.status),
        h('span', { class: 'reading__meta' }, `${STR.fields.yearRead}: ${formatYear(r.yearRead)}`),
        h('span', { class: 'reading__meta' }, `${STR.fields.grade}: `, h('strong', { class: 'grade' }, formatGrade(r.grade))),
        r.priority ? h('span', { class: 'reading__meta' }, `${STR.fields.priority}: ${r.priority}`) : null,
        r.recommendedBy ? h('span', { class: 'reading__meta' }, `${STR.fields.recommendedBy}: ${r.recommendedBy}`) : null,
      ),
      r.notes ? h('p', { class: 'reading__notes' }, r.notes) : null,
      h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'btn btn--small', on: { click: () => openReadingForm(book, r, refresh) } }, STR.actions.edit),
        h('button', {
          type: 'button', class: 'btn btn--small btn--danger-quiet',
          on: {
            click: async () => {
              if (!(await confirmDialog(STR.confirm.deleteReading(book.title), { confirmLabel: STR.actions.delete, danger: true }))) return;
              try {
                await deleteReading(r.id);
                toast(STR.text.deleted);
              } catch (error) {
                await alertDialog(error.message);
              }
              refresh();
            },
          },
        }, STR.actions.delete),
      ),
    )));

  clear(view).append(
    h('p', { class: 'crumbs' }, h('a', { href: '#/books' }, STR.titles.books)),
    h('div', { class: 'page-head' },
      h('div', { class: 'page-head__text' }, h('h1', { class: 'page-title book-title' }, book.title)),
      h('div', { class: 'page-head__actions' },
        h('button', { type: 'button', class: 'btn', on: { click: () => openBookForm(book, refresh) } }, STR.actions.edit),
        h('button', {
          type: 'button', class: 'btn btn--danger-quiet',
          on: { click: async () => { if (await confirmDeleteBook(book)) location.hash = '#/books'; } },
        }, STR.actions.delete),
      ),
    ),
    dl([
      [STR.fields.authors, authorLinks],
      [STR.fields.publicationYear, formatYear(book.publicationYear)],
      [STR.fields.form, show(book.form)],
      [STR.fields.mode, show(book.mode)],
      [STR.fields.content, show(book.content)],
      [STR.fields.themes, themeList],
    ]),
    h('section', { class: 'section', 'aria-labelledby': 'readings-title' },
      h('div', { class: 'section__head' },
        h('h2', { id: 'readings-title' }, `${STR.fields.readings} (${readings.length})`),
        h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openReadingForm(book, null, refresh) } }, STR.actions.addReading),
      ),
      readingItems,
    ),
  );
}
