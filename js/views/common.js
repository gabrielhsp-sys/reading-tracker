// Helpers shared by the views: joining records and page scaffolding.
import { getAuthors, getBooks, getReadings, getThemes, getCountries } from '../store.js';
import { h } from '../ui.js';

export async function loadAll() {
  const [authors, books, readings, themes, countries] = await Promise.all([
    getAuthors(), getBooks(), getReadings(), getThemes(), getCountries(),
  ]);
  const map = (list) => new Map(list.map((r) => [r.id, r]));
  return {
    authors, books, readings, themes, countries,
    authorById: map(authors), bookById: map(books), themeById: map(themes), countryById: map(countries),
  };
}

export function authorNames(book, data) {
  return (book.authorIds || [])
    .map((id) => data.authorById.get(id))
    .filter(Boolean)
    .map((a) => a.name);
}

export function pageHeader(title, intro, ...actions) {
  return h('div', { class: 'page-head' },
    h('div', { class: 'page-head__text' },
      h('h1', { class: 'page-title' }, title),
      intro ? h('p', { class: 'page-intro' }, intro) : null),
    actions.length ? h('div', { class: 'page-head__actions' }, ...actions) : null,
  );
}

export function emptyState(text, action) {
  return h('div', { class: 'empty' }, h('p', {}, text), action || null);
}

/** Wraps a table so it can scroll sideways on narrow screens if it must. */
export function tableWrap(table) {
  return h('div', { class: 'table-wrap' }, table);
}

/** A cell with a label for the stacked (phone) layout. */
export function td(label, content, cls) {
  return h('td', { dataset: { label }, class: cls }, content);
}
