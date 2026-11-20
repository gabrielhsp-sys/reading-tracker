// Section 4 rules. Pure functions: they read no storage and touch no DOM, so the same
// rules run in the forms (messages next to fields) and in store.js (nothing invalid is saved).
// Each returns a list of { field, message }; an empty list means valid.

import { FORMS, MODES, CONTENTS, STATUSES, PRIORITIES, yearReadRule, allowsGrade, allowsPriority } from './domain.js';
import { STR } from './strings.js';

const E = STR.errors;

/** Today as YYYY-MM-DD in local time. */
export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
const sameName = (a, b) => String(a).trim().toLocaleLowerCase() === String(b).trim().toLocaleLowerCase();

/** True when another record (different id) already has this name, ignoring case. */
export function isDuplicateName(records, name, id = null) {
  return !isBlank(name) && records.some((r) => r.id !== id && sameName(r.name, name));
}

/** True when s is a real calendar date written as YYYY-MM-DD. */
export function isValidIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function currentYear(ctx) {
  return Number((ctx.today || todayIso()).slice(0, 4));
}

export function validateAuthor(author, ctx = {}) {
  const errors = [];
  const today = ctx.today || todayIso();
  const authors = ctx.authors || [];
  const countries = ctx.countries || [];

  if (isBlank(author.name)) {
    errors.push({ field: 'name', message: E.nameRequired });
  } else if (isDuplicateName(authors, author.name, author.id ?? null)) {
    errors.push({ field: 'name', message: E.nameDuplicate });
  }

  if (author.countryId != null && !countries.some((c) => c.id === author.countryId)) {
    errors.push({ field: 'countryId', message: E.countryInvalid });
  }

  let birthOk = false;
  if (!isBlank(author.birthDate)) {
    if (!isValidIsoDate(author.birthDate)) errors.push({ field: 'birthDate', message: E.dateInvalid });
    else if (author.birthDate > today) errors.push({ field: 'birthDate', message: E.birthFuture });
    else birthOk = true;
  }

  if (!isBlank(author.deathDate)) {
    if (!isValidIsoDate(author.deathDate)) errors.push({ field: 'deathDate', message: E.dateInvalid });
    else if (author.deathDate > today) errors.push({ field: 'deathDate', message: E.deathFuture });
    else if (birthOk && author.deathDate <= author.birthDate) errors.push({ field: 'deathDate', message: E.deathBeforeBirth });
  }
  return errors;
}

function hasRepeats(ids) {
  return new Set(ids).size !== ids.length;
}

/**
 * ctx.readings: the readings of this book (only those with bookId === book.id are used),
 * so that editing the publication year never leaves a reading earlier than it.
 */
export function validateBook(book, ctx = {}) {
  const errors = [];
  const authors = ctx.authors || [];
  const themes = ctx.themes || [];
  const authorIds = book.authorIds || [];
  const themeIds = book.themeIds || [];

  if (isBlank(book.title)) errors.push({ field: 'title', message: E.titleRequired });

  if (authorIds.some((id) => !authors.some((a) => a.id === id))) {
    errors.push({ field: 'authorIds', message: E.authorUnknown });
  } else if (hasRepeats(authorIds)) {
    errors.push({ field: 'authorIds', message: E.authorDuplicate });
  }

  const y = book.publicationYear;
  if (y !== null && y !== undefined) {
    if (!Number.isInteger(y)) errors.push({ field: 'publicationYear', message: E.yearInteger });
    else if (y === 0) errors.push({ field: 'publicationYear', message: E.pubYearZero });
    else if (y > currentYear(ctx)) errors.push({ field: 'publicationYear', message: E.pubYearFuture });
    else if (book.id != null) {
      const earliest = (ctx.readings || [])
        .filter((r) => r.bookId === book.id && r.yearRead != null)
        .reduce((min, r) => Math.min(min, r.yearRead), Infinity);
      if (earliest < y) errors.push({ field: 'publicationYear', message: E.pubYearAfterReading(earliest) });
    }
  }

  if (book.form != null && !FORMS.includes(book.form)) errors.push({ field: 'form', message: E.formInvalid });
  if (book.mode != null && !MODES.includes(book.mode)) errors.push({ field: 'mode', message: E.modeInvalid });
  if (book.content != null && !CONTENTS.includes(book.content)) errors.push({ field: 'content', message: E.contentInvalid });

  if (themeIds.some((id) => !themes.some((t) => t.id === id))) {
    errors.push({ field: 'themeIds', message: E.themeUnknown });
  } else if (hasRepeats(themeIds)) {
    errors.push({ field: 'themeIds', message: E.themeDuplicate });
  }
  return errors;
}

export function validateThemeName(name, ctx = {}) {
  if (isBlank(name)) return [{ field: 'name', message: E.themeNameRequired }];
  if (isDuplicateName(ctx.themes || [], name)) {
    return [{ field: 'name', message: E.themeNameDuplicate }];
  }
  return [];
}

/** ctx.book: the book this reading belongs to (may be a book not saved yet). */
export function validateReading(reading, ctx = {}) {
  const errors = [];
  const book = ctx.book;
  const status = reading.status;

  if (!book) errors.push({ field: 'bookId', message: E.bookRequired });

  const statusOk = STATUSES.includes(status);
  if (isBlank(status)) errors.push({ field: 'status', message: E.statusRequired });
  else if (!statusOk) errors.push({ field: 'status', message: E.statusInvalid });

  const y = reading.yearRead;
  const hasYear = y !== null && y !== undefined;
  if (statusOk) {
    const rule = yearReadRule(status);
    if (rule === 'required' && !hasYear) errors.push({ field: 'yearRead', message: E.yearReadRequired });
    if (rule === 'forbidden' && hasYear) errors.push({ field: 'yearRead', message: E.yearReadNotAllowed });
  }
  if (hasYear && !errors.some((e) => e.field === 'yearRead')) {
    const pub = book ? book.publicationYear : null;
    if (!Number.isInteger(y)) errors.push({ field: 'yearRead', message: E.yearInteger });
    else if (y > currentYear(ctx)) errors.push({ field: 'yearRead', message: E.yearReadFuture });
    else if (Number.isInteger(pub) && y < pub) errors.push({ field: 'yearRead', message: E.yearReadBeforePublication(pub) });
  }

  const g = reading.grade;
  if (g !== null && g !== undefined) {
    if (statusOk && !allowsGrade(status)) errors.push({ field: 'grade', message: E.gradeNotAllowed });
    else if (typeof g !== 'number' || !Number.isFinite(g) || g < 0 || g > 10 || !Number.isInteger(g * 2)) {
      errors.push({ field: 'grade', message: E.gradeInvalid });
    }
  }

  const p = reading.priority;
  if (p !== null && p !== undefined) {
    if (statusOk && !allowsPriority(status)) errors.push({ field: 'priority', message: E.priorityNotAllowed });
    else if (!PRIORITIES.includes(p)) errors.push({ field: 'priority', message: E.priorityInvalid });
  }
  return errors;
}
