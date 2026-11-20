// FR-05 reading log ordering. Rows: { id, title, authors, status, yearRead, grade }.
// Missing values sort after all filled values in BOTH directions; ties go by id ascending
// (the order in which the readings were entered).

export const DEFAULT_SORT = Object.freeze({ key: 'yearRead', dir: 'desc' });
export const SORT_KEYS = ['title', 'authors', 'status', 'yearRead', 'grade'];
const NUMERIC = new Set(['yearRead', 'grade']);

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
const isMissing = (v) => v === null || v === undefined || v === '';

export function sortLogRows(rows, { key, dir } = DEFAULT_SORT) {
  const sign = dir === 'desc' ? -1 : 1;
  const compareValues = NUMERIC.has(key) ? (a, b) => a - b : (a, b) => collator.compare(a, b);
  return rows.slice().sort((ra, rb) => {
    const a = ra[key];
    const b = rb[key];
    const ma = isMissing(a);
    const mb = isMissing(b);
    if (ma !== mb) return ma ? 1 : -1;
    if (!ma) {
      const c = compareValues(a, b);
      if (c !== 0) return sign * c;
    }
    return ra.id - rb.id;
  });
}
