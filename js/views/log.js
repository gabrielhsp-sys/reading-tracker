// FR-05 reading log (sortable) with FR-08 filters and search.
import { STR, MISSING } from '../strings.js';
import { STATUSES, FORMS } from '../domain.js';
import { sortLogRows, DEFAULT_SORT, SORT_KEYS } from '../sort.js';
import { h, clear, formatYear, formatGrade, statusChip, selectControl } from '../ui.js';
import { loadAll, authorNames, pageHeader, emptyState, tableWrap, td } from './common.js';
import { openBookForm } from '../forms/book-form.js';

const COLUMN_LABELS = {
  title: STR.fields.title, authors: STR.fields.authors, status: STR.fields.status,
  yearRead: STR.fields.yearRead, grade: STR.fields.grade,
};

let sortState = { ...DEFAULT_SORT };
const filters = { q: '', status: '', year: '', authorId: '', form: '', themeId: '' };

function fold(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function filtersActive() {
  return Object.values(filters).some((v) => v !== '');
}

function buildRows(data) {
  return data.readings.map((r) => {
    const book = data.bookById.get(r.bookId) || { title: MISSING, authorIds: [], themeIds: [] };
    const names = authorNames(book, data);
    return {
      id: r.id, bookId: r.bookId, title: book.title, authors: names.join(', '),
      status: r.status, yearRead: r.yearRead, grade: r.grade,
      authorIds: book.authorIds || [], themeIds: book.themeIds || [], form: book.form,
    };
  });
}

function applyFilters(rows) {
  const q = fold(filters.q.trim());
  return rows.filter((row) =>
    (!q || fold(row.title).includes(q) || fold(row.authors).includes(q))
    && (!filters.status || row.status === filters.status)
    && (!filters.year || String(row.yearRead) === filters.year)
    && (!filters.authorId || row.authorIds.includes(Number(filters.authorId)))
    && (!filters.form || row.form === filters.form)
    && (!filters.themeId || row.themeIds.includes(Number(filters.themeId))));
}

export async function renderLog(view, refresh) {
  const data = await loadAll();
  const allRows = buildRows(data);
  const results = h('div', { class: 'log-results' });

  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const years = [...new Set(data.readings.map((r) => r.yearRead).filter((y) => y != null))].sort((a, b) => b - a);
  const control = (key, el) => {
    el.value = filters[key];
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => { filters[key] = el.value; draw(); });
    return el;
  };
  const filterField = (id, label, el) => h('div', { class: 'filter' }, h('label', { for: id }, label), Object.assign(el, { id }));

  const filterBar = h('form', { class: 'filters', role: 'search', on: { submit: (e) => e.preventDefault() } },
    filterField('flt-q', STR.fields.search, control('q', h('input', { type: 'search', autocomplete: 'off' }))),
    filterField('flt-status', STR.fields.status, control('status', selectControl(STATUSES, '', { emptyLabel: STR.placeholders.any }))),
    filterField('flt-year', STR.fields.year, control('year', selectControl(years, '', { emptyLabel: STR.placeholders.any }))),
    filterField('flt-author', STR.fields.author, control('authorId', selectControl(
      data.authors.slice().sort(byName).map((a) => ({ value: a.id, label: a.name })), '', { emptyLabel: STR.placeholders.any }))),
    filterField('flt-form', STR.fields.form, control('form', selectControl(FORMS, '', { emptyLabel: STR.placeholders.any }))),
    filterField('flt-theme', STR.fields.theme, control('themeId', selectControl(
      data.themes.slice().sort(byName).map((t) => ({ value: t.id, label: t.name })), '', { emptyLabel: STR.placeholders.any }))),
    h('button', {
      type: 'button', class: 'btn btn--quiet',
      on: { click: () => { Object.keys(filters).forEach((k) => { filters[k] = ''; }); refresh(); } },
    }, STR.actions.clearFilters),
  );

  function headerCell(key) {
    const active = sortState.key === key;
    const ariaSort = active ? (sortState.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    const arrow = active ? (sortState.dir === 'asc' ? '↑' : '↓') : '↕';
    return h('th', { scope: 'col', 'aria-sort': ariaSort, class: key === 'yearRead' || key === 'grade' ? 'num' : null },
      h('button', {
        type: 'button', class: 'sort-btn', title: STR.text.sortBy(COLUMN_LABELS[key]),
        on: {
          click: () => {
            const numeric = key === 'yearRead' || key === 'grade';
            sortState = active
              ? { key, dir: sortState.dir === 'asc' ? 'desc' : 'asc' }
              : { key, dir: numeric ? 'desc' : 'asc' };
            draw();
            results.querySelector(`th[aria-sort] .sort-btn[data-key="${key}"]`)?.focus();
          },
        },
        dataset: { key },
      }, COLUMN_LABELS[key], h('span', { class: 'sort-btn__arrow', 'aria-hidden': 'true' }, arrow)),
    );
  }

  function draw() {
    const rows = sortLogRows(applyFilters(allRows), sortState);
    clear(results);
    if (allRows.length === 0) {
      results.append(emptyState(STR.text.emptyLog));
      return;
    }
    results.append(h('p', { class: 'count', 'aria-live': 'polite' }, STR.text.shown(rows.length, allRows.length)));
    if (rows.length === 0) {
      results.append(emptyState(STR.text.emptyFiltered));
      return;
    }
    const table = h('table', { class: 'table table--log' },
      h('caption', { class: 'visually-hidden' }, STR.titles.log),
      h('thead', {}, h('tr', {}, SORT_KEYS.map(headerCell))),
      h('tbody', {}, rows.map((row) => h('tr', {},
        td(STR.fields.title, h('a', { href: `#/books/${row.bookId}`, class: 'book-title' }, row.title), 'cell-title'),
        td(STR.fields.authors, row.authors || MISSING),
        td(STR.fields.status, statusChip(row.status)),
        td(STR.fields.yearRead, formatYear(row.yearRead), 'num'),
        td(STR.fields.grade, formatGrade(row.grade), 'num grade'),
      ))),
    );
    results.append(tableWrap(table));
  }

  // Filters start open on wide screens and folded on phones, where they would fill the screen.
  const filterPanel = h('details', { class: 'filter-panel', open: window.matchMedia('(min-width: 40rem)').matches || filtersActive() },
    h('summary', {}, STR.titles.filters),
    filterBar,
  );

  clear(view).append(
    pageHeader(STR.titles.log, STR.text.logIntro,
      h('button', { type: 'button', class: 'btn btn--primary', on: { click: () => openBookForm(null, refresh) } }, STR.actions.newBook)),
    filterPanel,
    results,
  );
  draw();
}
