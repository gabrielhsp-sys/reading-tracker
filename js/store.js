// store.js — the ONLY module that touches application data.
//
// Delivery 1 keeps the data in localStorage. Every function is async and is called with
// await, so in Delivery 2 only this file changes (each function becomes a fetch to the
// REST API) and the rest of the code stays the same.
//
// Records use the shapes of data/seed.json. On failure the functions throw a StoreError
// with the same structure the API will send: { status, message, errors: [{ field, message }] }
//   400 validation failed · 404 not found · 409 conflict (linked author, duplicate name).

import { validateAuthor, validateBook, validateReading, validateThemeName } from './validation.js';
import { STR } from './strings.js';

const PREFIX = 'readingTracker.';
const DATA_KEY = `${PREFIX}data`;
const SEED_URL = new URL('../data/seed.json', import.meta.url);
const COLLECTIONS = ['countries', 'authors', 'themes', 'books', 'readings'];
const E = STR.errors;

export class StoreError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.name = 'StoreError';
    this.status = status;
    this.errors = errors;
  }

  toJSON() {
    return { status: this.status, message: this.message, errors: this.errors };
  }
}

const validationError = (errors) => new StoreError(400, E.validationFailed, errors);
const notFound = (what) => new StoreError(404, E.notFound(what));

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let seeding = null;

async function fetchSeed() {
  const response = await fetch(SEED_URL);
  if (!response.ok) throw new StoreError(response.status, STR.text.loadFailed);
  const seed = await response.json();
  const db = {};
  for (const name of COLLECTIONS) db[name] = Array.isArray(seed[name]) ? seed[name] : [];
  return db;
}

function readDb() {
  const raw = localStorage.getItem(DATA_KEY);
  return raw ? JSON.parse(raw) : null;
}

function writeDb(db) {
  localStorage.setItem(DATA_KEY, JSON.stringify(db));
}

/** Loads the seed on first use only; later calls read localStorage. */
async function loadDb() {
  const db = readDb();
  if (db) return db;
  if (!seeding) {
    seeding = fetchSeed()
      .then((seed) => {
        writeDb(seed);
        return seed;
      })
      .finally(() => {
        seeding = null;
      });
  }
  await seeding;
  return readDb();
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const nextId = (list) => list.reduce((max, r) => Math.max(max, r.id), 0) + 1;
const byId = (list, id) => list.find((r) => r.id === Number(id));

function text(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function upsert(list, record) {
  if (record.id == null) {
    const created = { ...record, id: nextId(list) };
    list.push(created);
    return created;
  }
  const index = list.findIndex((r) => r.id === record.id);
  list[index] = record;
  return record;
}

/** Initializes storage (loads the seed on first use). */
export async function initStore() {
  await loadDb();
}

/** FR-07: deletes this app's localStorage keys and loads the seed again (IDs restart at 1). */
export async function resetData() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(PREFIX))
    .forEach((key) => localStorage.removeItem(key));
  await loadDb();
}

// ---------------------------------------------------------------------------
// Countries (fixed list) and themes
// ---------------------------------------------------------------------------

export async function getCountries() {
  return clone((await loadDb()).countries);
}

export async function getThemes() {
  return clone((await loadDb()).themes);
}

export async function saveTheme(theme) {
  const db = await loadDb();
  const name = text(theme.name);
  const errors = validateThemeName(name, { themes: db.themes });
  if (errors.length) {
    if (errors[0].message === E.themeNameDuplicate) throw new StoreError(409, E.themeNameDuplicate);
    throw validationError(errors);
  }
  const saved = upsert(db.themes, { id: null, name });
  writeDb(db);
  return clone(saved);
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

export async function getAuthors() {
  return clone((await loadDb()).authors);
}

export async function getAuthor(id) {
  const author = byId((await loadDb()).authors, id);
  if (!author) throw notFound('Author');
  return clone(author);
}

export async function saveAuthor(input) {
  const db = await loadDb();
  const author = {
    id: input.id == null ? null : Number(input.id),
    name: text(input.name),
    countryId: input.countryId == null || input.countryId === '' ? null : Number(input.countryId),
    birthDate: text(input.birthDate),
    deathDate: text(input.deathDate),
  };
  if (author.id != null && !byId(db.authors, author.id)) throw notFound('Author');

  const errors = validateAuthor(author, { authors: db.authors, countries: db.countries });
  const conflict = errors.find((e) => e.message === E.nameDuplicate);
  const others = errors.filter((e) => e !== conflict);
  if (others.length) throw validationError(errors);
  if (conflict) throw new StoreError(409, E.nameDuplicate);

  const saved = upsert(db.authors, author);
  writeDb(db);
  return clone(saved);
}

export async function deleteAuthor(id) {
  const db = await loadDb();
  const author = byId(db.authors, id);
  if (!author) throw notFound('Author');
  const linked = db.books.filter((b) => (b.authorIds || []).includes(author.id));
  if (linked.length) {
    throw new StoreError(409, E.authorLinked(linked.length, linked.map((b) => b.title)));
  }
  db.authors = db.authors.filter((a) => a.id !== author.id);
  writeDb(db);
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

export async function getBooks() {
  return clone((await loadDb()).books);
}

export async function getBook(id) {
  const book = byId((await loadDb()).books, id);
  if (!book) throw notFound('Book');
  return clone(book);
}

function normalizeBook(input) {
  const year = input.publicationYear;
  return {
    id: input.id == null ? null : Number(input.id),
    title: text(input.title),
    authorIds: (input.authorIds || []).map(Number),
    publicationYear: year === null || year === undefined || year === '' ? null : Number(year),
    form: text(input.form),
    mode: text(input.mode),
    content: text(input.content),
    themeIds: (input.themeIds || []).map(Number),
  };
}

export async function saveBook(input) {
  const db = await loadDb();
  const book = normalizeBook(input);
  if (book.id != null && !byId(db.books, book.id)) throw notFound('Book');
  const errors = validateBook(book, {
    authors: db.authors,
    themes: db.themes,
    readings: db.readings,
  });
  if (errors.length) throw validationError(errors);
  const saved = upsert(db.books, book);
  writeDb(db);
  return clone(saved);
}

/** Deletes a book and all its readings. */
export async function deleteBook(id) {
  const db = await loadDb();
  const book = byId(db.books, id);
  if (!book) throw notFound('Book');
  db.readings = db.readings.filter((r) => r.bookId !== book.id);
  db.books = db.books.filter((b) => b.id !== book.id);
  writeDb(db);
}

// ---------------------------------------------------------------------------
// Readings
// ---------------------------------------------------------------------------

export async function getReadings() {
  return clone((await loadDb()).readings);
}

export async function getBookReadings(bookId) {
  const db = await loadDb();
  if (!byId(db.books, bookId)) throw notFound('Book');
  return clone(db.readings.filter((r) => r.bookId === Number(bookId)));
}

export async function getReading(id) {
  const reading = byId((await loadDb()).readings, id);
  if (!reading) throw notFound('Reading');
  return clone(reading);
}

function normalizeReading(input) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  return {
    id: input.id == null ? null : Number(input.id),
    bookId: num(input.bookId),
    status: text(input.status),
    yearRead: num(input.yearRead),
    grade: num(input.grade),
    recommendedBy: text(input.recommendedBy),
    priority: text(input.priority),
    notes: text(input.notes),
  };
}

export async function saveReading(input) {
  const db = await loadDb();
  const reading = normalizeReading(input);
  if (reading.id != null && !byId(db.readings, reading.id)) throw notFound('Reading');
  const book = reading.bookId == null ? null : byId(db.books, reading.bookId);
  const errors = validateReading(reading, { book });
  if (errors.length) throw validationError(errors);
  const saved = upsert(db.readings, reading);
  writeDb(db);
  return clone(saved);
}

export async function deleteReading(id) {
  const db = await loadDb();
  if (!byId(db.readings, id)) throw notFound('Reading');
  db.readings = db.readings.filter((r) => r.id !== Number(id));
  writeDb(db);
}
