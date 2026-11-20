// Entry point: loads the data (seed on first use), wires the header and routes
// #/log, #/books, #/books/:id, #/authors, #/authors/:id, #/wishlist.
import { initStore, resetData } from './store.js';
import { STR } from './strings.js';
import { h, clear, initDialogs, confirmDialog, toast } from './ui.js';
import { renderLog } from './views/log.js';
import { renderBooks, renderBookDetail } from './views/books.js';
import { renderAuthors, renderAuthorDetail } from './views/authors.js';
import { renderWishlist } from './views/wishlist.js';

const view = document.getElementById('view');

const routes = [
  { pattern: /^#\/log$/, nav: 'log', title: STR.titles.log, render: (refresh) => renderLog(view, refresh) },
  { pattern: /^#\/books$/, nav: 'books', title: STR.titles.books, render: (refresh) => renderBooks(view, refresh) },
  { pattern: /^#\/books\/(\d+)$/, nav: 'books', title: STR.titles.books, render: (refresh, id) => renderBookDetail(view, refresh, id) },
  { pattern: /^#\/authors$/, nav: 'authors', title: STR.titles.authors, render: (refresh) => renderAuthors(view, refresh) },
  { pattern: /^#\/authors\/(\d+)$/, nav: 'authors', title: STR.titles.authors, render: (refresh, id) => renderAuthorDetail(view, refresh, id) },
  { pattern: /^#\/wishlist$/, nav: 'wishlist', title: STR.titles.wishlist, render: (refresh) => renderWishlist(view, refresh) },
];

async function route({ focus = true } = {}) {
  const hash = location.hash || '#/log';
  const match = routes.map((r) => ({ r, m: hash.match(r.pattern) })).find((x) => x.m);
  if (!match) {
    location.replace('#/log');
    return;
  }
  const { r, m } = match;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === r.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${r.title} · ${STR.appName}`;
  const refresh = () => route({ focus: false });
  try {
    await r.render(refresh, m[1] ? Number(m[1]) : undefined);
  } catch (error) {
    console.error(error);
    clear(view).append(h('p', { class: 'notice notice--error' }, error && error.message ? error.message : STR.text.unexpected));
  }
  if (focus) view.focus({ preventScroll: true });
}

async function onReset() {
  const ok = await confirmDialog(STR.confirm.reset, { confirmLabel: STR.actions.resetData, danger: true });
  if (!ok) return;
  await resetData();
  toast(STR.text.dataReset);
  await route({ focus: false });
}

/** Fills the static page text from strings.js (data-text → text, data-label → aria-label). */
function applyStaticText() {
  const lookup = (path) => path.split('.').reduce((obj, key) => obj?.[key], STR);
  document.querySelectorAll('[data-text]').forEach((el) => { el.textContent = lookup(el.dataset.text); });
  document.querySelectorAll('[data-label]').forEach((el) => { el.setAttribute('aria-label', lookup(el.dataset.label)); });
}

async function start() {
  applyStaticText();
  initDialogs();
  document.getElementById('reset-data').addEventListener('click', onReset);
  try {
    await initStore();
  } catch (error) {
    console.error(error);
    clear(view).append(h('p', { class: 'notice notice--error' }, STR.text.loadFailed));
    return;
  }
  window.addEventListener('hashchange', () => route());
  await route({ focus: false });
}

start();
