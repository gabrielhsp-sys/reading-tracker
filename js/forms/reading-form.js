// Add / edit one reading of a book (FR-03, FR-04).
import { saveReading } from '../store.js';
import { validateReading } from '../validation.js';
import { STR } from '../strings.js';
import { h, openFormDialog, closeFormDialog, clearFieldErrors, showFieldErrors, toast, formatYear } from '../ui.js';
import { readingFields } from './reading-fields.js';
import { formActions, handleSaveError } from './form-helpers.js';

export function openReadingForm(book, reading, onSaved) {
  const editing = Boolean(reading && reading.id != null);
  const fields = readingFields(reading || {});
  const form = h('form', { class: 'form', novalidate: true },
    h('p', { class: 'form__context' },
      h('span', { class: 'book-title' }, book.title),
      book.publicationYear != null ? ` (${formatYear(book.publicationYear)})` : ''),
    fields.element,
    h('p', { class: 'form__error', dataset: { errorFor: 'bookId' } }),
    formActions(),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const candidate = { ...(reading || {}), ...fields.read(), bookId: book.id };
    const errors = validateReading(candidate, { book });
    if (errors.length) { showFieldErrors(form, errors); return; }
    try {
      await saveReading(candidate);
      closeFormDialog();
      toast(STR.text.saved);
      onSaved();
    } catch (error) {
      handleSaveError(form, error);
    }
  });

  openFormDialog(editing ? STR.titles.editReading : STR.titles.newReading, form);
}
