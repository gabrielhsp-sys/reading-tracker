import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserShims, fetchCalls } from './helpers.js';

const storage = installBrowserShims();
const store = await import('../js/store.js');

beforeEach(() => { storage.clear(); fetchCalls.count = 0; });

async function rejectsWith(promise, status) {
  try { await promise; } catch (e) {
    assert.equal(e.status, status, e.message);
    assert.ok(Array.isArray(e.errors));
    return e;
  }
  assert.fail(`expected status ${status}`);
}

// FR-07
test('first use loads the seed; later calls never fetch it again', async () => {
  assert.equal((await store.getReadings()).length, 143);
  await store.getBooks();
  await store.getAuthors();
  assert.equal(fetchCalls.count, 1);
});

test('changes survive a "reload" (data kept in localStorage)', async () => {
  const saved = await store.saveAuthor({ name: 'Ursula K. Le Guin' });
  assert.equal(saved.id, 102); // highest existing id + 1
  assert.ok(storage.getItem('readingTracker.data').includes('Ursula K. Le Guin'));
  assert.equal((await store.getAuthor(102)).name, 'Ursula K. Le Guin');
  assert.equal(fetchCalls.count, 1);
});

test('reset deletes all changes and restores the seed with ids from 1', async () => {
  await store.saveAuthor({ name: 'Ursula K. Le Guin' });
  await store.deleteBook(1);
  await store.resetData();
  const authors = await store.getAuthors();
  assert.equal(authors.length, 101);
  assert.equal((await store.getBooks()).length, 143);
  assert.equal((await store.getReadings()).length, 143);
  assert.equal(authors[0].id, 1);
  assert.equal(fetchCalls.count, 2);
});

// FR-01
test('authors: create, read, update, delete', async () => {
  const a = await store.saveAuthor({ name: 'New Author', countryId: 3, birthDate: '1950-01-01' });
  const updated = await store.saveAuthor({ ...a, name: 'Renamed' });
  assert.equal((await store.getAuthor(a.id)).name, 'Renamed');
  assert.equal(updated.id, a.id);
  await store.deleteAuthor(a.id);
  await rejectsWith(store.getAuthor(a.id), 404);
});

test('an author linked to books cannot be deleted; the message names the books', async () => {
  const dostoevsky = (await store.getAuthors()).find((a) => a.name === 'Fyodor Dostoevsky');
  const e = await rejectsWith(store.deleteAuthor(dostoevsky.id), 409);
  assert.match(e.message, /^Author is linked to \d+ books: /);
  assert.match(e.message, /The Idiot/);
  assert.deepEqual(e.errors, []);
  assert.ok(await store.getAuthor(dostoevsky.id));
});

test('duplicate author name (any case) is a 409 conflict; invalid data is a 400', async () => {
  await rejectsWith(store.saveAuthor({ name: 'fyodor dostoevsky' }), 409);
  const e = await rejectsWith(store.saveAuthor({ name: '', birthDate: '2999-01-01' }), 400);
  assert.deepEqual(e.errors.map((x) => x.field).sort(), ['birthDate', 'name']);
  assert.equal((await store.getAuthors()).length, 101);
});

// FR-02
test('books: create with existing authors and themes, update, reject unknown ids', async () => {
  const book = await store.saveBook({ title: 'The Dispossessed', authorIds: [1], themeIds: [1], publicationYear: 1974, form: 'Novel' });
  assert.equal(book.id, 144);
  await store.saveBook({ ...book, title: 'The Dispossessed (2)' });
  assert.equal((await store.getBook(144)).title, 'The Dispossessed (2)');
  await rejectsWith(store.saveBook({ title: 'X', authorIds: [9999] }), 400);
  assert.equal((await store.getBooks()).length, 144);
});

test('themes can be created on the spot, never duplicated', async () => {
  const t = await store.saveTheme({ name: 'Solarpunk' });
  assert.equal(t.id, 136);
  await rejectsWith(store.saveTheme({ name: 'SOLARPUNK' }), 409);
  await rejectsWith(store.saveTheme({ name: '  ' }), 400);
});

test('editing publication year cannot leave a reading earlier than it', async () => {
  const book = await store.getBook(1); // read in 2021
  await rejectsWith(store.saveBook({ ...book, publicationYear: 2022 }), 400);
});

// FR-03
test('readings: add several to a book, edit and delete them', async () => {
  const book = await store.saveBook({ title: 'Wishlist book' });
  const first = await store.saveReading({ bookId: book.id, status: 'Want to read', priority: 'High', recommendedBy: 'Teco' });
  const second = await store.saveReading({ bookId: book.id, status: 'Reading' });
  assert.equal((await store.getBookReadings(book.id)).length, 2);
  await store.saveReading({ ...first, status: 'Read', priority: null, yearRead: 2026, grade: 9 });
  assert.equal((await store.getReading(first.id)).grade, 9);
  await store.deleteReading(second.id);
  assert.equal((await store.getBookReadings(book.id)).length, 1);
});

test('deleting a book deletes its readings', async () => {
  const before = (await store.getReadings()).length;
  const n = (await store.getBookReadings(1)).length;
  await store.deleteBook(1);
  assert.equal((await store.getReadings()).length, before - n);
  assert.ok((await store.getReadings()).every((r) => r.bookId !== 1));
});

// FR-04 / FR-06 at the store boundary
test('invalid readings are never saved', async () => {
  const before = (await store.getReadings()).length;
  const e = await rejectsWith(store.saveReading({ bookId: 1, status: 'Read', grade: 7.3 }), 400);
  assert.deepEqual(e.errors.map((x) => x.field).sort(), ['grade', 'yearRead']);
  await rejectsWith(store.saveReading({ bookId: 1, status: 'Paused', priority: 'High' }), 400);
  await rejectsWith(store.saveReading({ bookId: 9999, status: 'Reading' }), 400);
  assert.equal((await store.getReadings()).length, before);
});

test('returned records are copies: mutating them does not change stored data', async () => {
  const books = await store.getBooks();
  books[0].title = 'changed';
  assert.notEqual((await store.getBook(books[0].id)).title, 'changed');
});
