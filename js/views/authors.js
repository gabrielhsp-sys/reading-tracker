// FR-01 authors list and author detail.
import { getAuthor, getBooks, deleteAuthor } from '../store.js';
import { STR, MISSING } from '../strings.js';
import { h, clear, formatDate, formatYear, confirmDialog, toast, alertDialog } from '../ui.js';
import { loadAll, pageHeader, emptyState, tableWrap, td } from './common.js';
import { openAuthorForm } from '../forms/author-form.js';

async function confirmDeleteAuthor(author) {
  // FR-01: a linked author cannot be deleted; show the books instead of asking to confirm.
  const linked = (await getBooks()).filter((b) => (b.authorIds || []).includes(author.id));
  if (linked.length) {
    await alertDialog(STR.errors.authorLinked(linked.length, linked.map((b) => b.title)), STR.titles.cannotDeleteAuthor);
    return false;
  }
  const ok = await confirmDialog(STR.confirm.deleteAuthor(author.name), { confirmLabel: STR.actions.delete, danger: true });
  if (!ok) return false;
  try {
    await deleteAuthor(author.id);
  } catch (error) {
    // 409: the author is linked to books; the message names them.
    await alertDialog(error.message, STR.titles.cannotDeleteAuthor);
    return false;
  }
  toast(STR.text.deleted);
  return true;
}

export async function renderAuthors(view, refresh) {
  const data = await loadAll();
  const bookCount = new Map();
  data.books.forEach((b) => (b.authorIds || []).forEach((id) => bookCount.set(id, (bookCount.get(id) || 0) + 1)));
  const authors = data.authors.slice().sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  const country = (a) => (a.countryId != null && data.countryById.get(a.countryId)?.name) || MISSING;

  const body = authors.length === 0
    ? emptyState(STR.text.emptyAuthors)
    : tableWrap(h('table', { class: 'table' },
      h('caption', { class: 'visually-hidden' }, STR.titles.authors),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, STR.fields.name),
        h('th', { scope: 'col' }, STR.fields.nationality),
        h('th', { scope: 'col' }, STR.fields.birthDate),
        h('th', { scope: 'col' }, STR.fields.deathDate),
        h('th', { scope: 'col', class: 'num' }, STR.fields.books),
        h('th', { scope: 'col' }, h('span', { class: 'visually-hidden' }, STR.fields.actions)),
      )),
      h('tbody', {}, authors.map((a) => h('tr', {},
        td(STR.fields.name, h('a', { href: `#/authors/${a.id}` }, a.name), 'cell-title'),
        td(STR.fields.nationality, country(a)),
        td(STR.fields.birthDate, formatDate(a.birthDate)),
        td(STR.fields.deathDate, formatDate(a.deathDate)),
        td(STR.fields.books, String(bookCount.get(a.id) || 0), 'num'),
        td(STR.fields.actions, h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'btn btn--small', 'aria-label': `${STR.actions.edit} ${a.name}`, on: { click: () => openAuthorForm(a, refresh) } }, STR.actions.edit),
          h('button', {
            type: 'button', class: 'btn btn--small btn--danger-quiet', 'aria-label': `${STR.actions.delete} ${a.name}`,
            on: { click: async () => { if (await confirmDeleteAuthor(a)) refresh(); } },
          }, STR.actions.delete),
        ), 'cell-actions'),
      ))),
    ));

  clear(view).append(
    pageHeader(STR.titles.authors, `${STR.text.authorsIntro} ${STR.text.authorsCount(authors.length)}.`,
      h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openAuthorForm(null, refresh) } }, STR.actions.newAuthor)),
    body,
  );
}

export async function renderAuthorDetail(view, refresh, id) {
  let author;
  try {
    author = await getAuthor(id);
  } catch (error) {
    if (error.status === 404) {
      clear(view).append(pageHeader(STR.titles.notFound, STR.text.authorNotFound), h('p', {}, h('a', { href: '#/authors' }, STR.text.backTo(STR.titles.authors))));
      return;
    }
    throw error;
  }
  const data = await loadAll();
  const books = data.books
    .filter((b) => (b.authorIds || []).includes(author.id))
    .sort((a, b) => (a.publicationYear ?? Infinity) - (b.publicationYear ?? Infinity) || a.id - b.id);
  const country = author.countryId != null ? data.countryById.get(author.countryId)?.name : null;

  clear(view).append(
    h('p', { class: 'crumbs' }, h('a', { href: '#/authors' }, STR.titles.authors)),
    h('div', { class: 'page-head' },
      h('div', { class: 'page-head__text' }, h('h1', { class: 'page-title' }, author.name)),
      h('div', { class: 'page-head__actions' },
        h('button', { type: 'button', class: 'btn', on: { click: () => openAuthorForm(author, refresh) } }, STR.actions.edit),
        h('button', {
          type: 'button', class: 'btn btn--danger-quiet',
          on: { click: async () => { if (await confirmDeleteAuthor(author)) location.hash = '#/authors'; } },
        }, STR.actions.delete),
      ),
    ),
    h('dl', { class: 'facts' },
      h('dt', {}, STR.fields.nationality), h('dd', {}, country || MISSING),
      h('dt', {}, STR.fields.birthDate), h('dd', {}, formatDate(author.birthDate)),
      h('dt', {}, STR.fields.deathDate), h('dd', {}, formatDate(author.deathDate)),
    ),
    h('section', { class: 'section', 'aria-labelledby': 'author-books' },
      h('h2', { id: 'author-books' }, `${STR.text.linkedBooks} (${books.length})`),
      books.length === 0
        ? emptyState(STR.text.noBooksForAuthor)
        : h('ul', { class: 'book-list' }, books.map((b) => h('li', {},
          h('a', { href: `#/books/${b.id}`, class: 'book-title' }, b.title),
          h('span', { class: 'muted' }, ` (${formatYear(b.publicationYear)})`)))),
    ),
  );
}
