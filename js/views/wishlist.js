// FR-09 (optional): readings with status Want to read, sorted by priority.
import { STR, MISSING } from '../strings.js';
import { STATUS, PRIORITIES } from '../domain.js';
import { h, clear, show } from '../ui.js';
import { loadAll, authorNames, pageHeader, emptyState, tableWrap, td } from './common.js';

const rank = (p) => (p ? PRIORITIES.length - PRIORITIES.indexOf(p) : 0); // High first, none last

export async function renderWishlist(view) {
  const data = await loadAll();
  const items = data.readings
    .filter((r) => r.status === STATUS.WANT_TO_READ)
    .sort((a, b) => rank(b.priority) - rank(a.priority) || a.id - b.id);

  const body = items.length === 0
    ? emptyState(STR.text.emptyWishlist)
    : tableWrap(h('table', { class: 'table' },
      h('caption', { class: 'visually-hidden' }, STR.titles.wishlist),
      h('thead', {}, h('tr', {},
        [STR.fields.title, STR.fields.authors, STR.fields.priority, STR.fields.recommendedBy, STR.fields.notes]
          .map((label) => h('th', { scope: 'col' }, label)))),
      h('tbody', {}, items.map((r) => {
        const book = data.bookById.get(r.bookId) || { title: MISSING, authorIds: [] };
        return h('tr', {},
          td(STR.fields.title, h('a', { href: `#/books/${r.bookId}`, class: 'book-title' }, book.title), 'cell-title'),
          td(STR.fields.authors, authorNames(book, data).join(', ') || MISSING),
          td(STR.fields.priority, show(r.priority)),
          td(STR.fields.recommendedBy, show(r.recommendedBy)),
          td(STR.fields.notes, show(r.notes)),
        );
      })),
    ));

  clear(view).append(pageHeader(STR.titles.wishlist, STR.text.wishlistIntro), body);
}
