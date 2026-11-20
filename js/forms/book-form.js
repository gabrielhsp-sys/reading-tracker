// Create / edit a book (FR-02) with an optional first reading (FR-03).
import { getAuthors, getThemes, getReadings, saveBook, saveTheme, saveReading, deleteBook } from '../store.js';
import { validateBook, validateReading, validateThemeName } from '../validation.js';
import { FORMS, MODES, CONTENTS } from '../domain.js';
import { STR } from '../strings.js';
import { h, field, selectControl, openFormDialog, closeFormDialog, clearFieldErrors, showFieldErrors, toast, parseYear } from '../ui.js';
import { multiPicker } from './picker.js';
import { readingFields } from './reading-fields.js';
import { formActions, handleSaveError } from './form-helpers.js';

const F = STR.fields;
const READING_PREFIX = 'r-';

export async function openBookForm(book, onSaved) {
  const [authors, themes, readings] = await Promise.all([getAuthors(), getThemes(), getReadings()]);
  const editing = Boolean(book && book.id != null);
  const b = book || {};

  const title = h('input', { type: 'text', value: b.title ?? '', autocomplete: 'off', required: true });
  const year = h('input', { type: 'text', value: b.publicationYear ?? '', autocomplete: 'off', placeholder: 'e.g. 1866 or -429' });
  const form_ = selectControl(FORMS, b.form);
  const mode = selectControl(MODES, b.mode);
  const content = selectControl(CONTENTS, b.content);

  const authorPicker = multiPicker({
    name: 'authorIds', legend: F.authors, items: authors, selected: b.authorIds || [],
    placeholder: STR.placeholders.chooseAuthor, emptyText: STR.text.noAuthorsChosen,
    hint: STR.hints.authorsPicker, addLabel: STR.actions.addAuthor,
  });
  const themePicker = multiPicker({
    name: 'themeIds', legend: F.themes, items: themes, selected: b.themeIds || [],
    placeholder: STR.placeholders.chooseTheme, emptyText: STR.text.noThemesChosen,
    hint: STR.hints.themesPicker, addLabel: STR.actions.addTheme,
  });

  // Create a theme on the spot.
  const newTheme = h('input', { type: 'text', autocomplete: 'off' });
  const createTheme = async () => {
    const slot = themePicker.element.querySelector('[data-error-for="newTheme"]');
    slot.textContent = '';
    slot.closest('.field').classList.remove('field--invalid');
    newTheme.removeAttribute('aria-invalid');
    const name = newTheme.value.trim();
    const errors = validateThemeName(name, { themes: themePicker.getItems() });
    if (errors.length) { showFieldErrors(themePicker.element, errors.map((e) => ({ ...e, field: 'newTheme' }))); return; }
    try {
      const created = await saveTheme({ name });
      themePicker.addAndSelect(created);
      newTheme.value = '';
      toast(`Theme “${created.name}” created.`);
    } catch (error) {
      showFieldErrors(themePicker.element, [{ field: 'newTheme', message: error.message || STR.text.unexpected }]);
    }
  };
  newTheme.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); createTheme(); }
  });
  const newThemeField = field({ name: 'newTheme', label: F.newTheme, control: newTheme });
  newThemeField.classList.add('picker__new');
  newThemeField.insertBefore(
    h('div', { class: 'picker__row' }, newTheme, h('button', { type: 'button', class: 'btn', on: { click: createTheme } }, STR.actions.createTheme)),
    newThemeField.querySelector('.field__error'),
  );
  themePicker.extra.append(newThemeField);

  // Optional first reading (only when creating a book).
  let first = null;
  let firstToggle = null;
  let firstSection = null;
  if (!editing) {
    first = readingFields({}, READING_PREFIX);
    const body = h('div', { class: 'first-reading__body', hidden: true }, first.element);
    firstToggle = h('input', { type: 'checkbox', id: 'f-add-first-reading' });
    firstToggle.addEventListener('change', () => { body.hidden = !firstToggle.checked; });
    firstSection = h('fieldset', { class: 'first-reading' },
      h('legend', {}, STR.titles.firstReading),
      h('p', { class: 'field__hint' }, STR.hints.firstReading),
      h('label', { class: 'check', for: 'f-add-first-reading' }, firstToggle, ' Add a first reading'),
      body,
    );
  }

  const form = h('form', { class: 'form', novalidate: true },
    field({ name: 'title', label: F.title, control: title, required: true }),
    authorPicker.element,
    h('div', { class: 'field-grid' },
      field({ name: 'publicationYear', label: F.publicationYear, control: year, hint: STR.hints.publicationYear }),
      field({ name: 'form', label: F.form, control: form_ }),
      field({ name: 'mode', label: F.mode, control: mode }),
      field({ name: 'content', label: F.content, control: content }),
    ),
    themePicker.element,
    firstSection,
    formActions(),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    const candidate = {
      id: b.id ?? null,
      title: title.value.trim(),
      authorIds: authorPicker.getIds(),
      publicationYear: parseYear(year.value),
      form: form_.value || null,
      mode: mode.value || null,
      content: content.value || null,
      themeIds: themePicker.getIds(),
    };
    const withReading = Boolean(firstToggle && firstToggle.checked);
    const firstReading = withReading ? first.read() : null;

    // Validate the book AND its first reading before saving anything.
    const bookErrors = validateBook(candidate, { authors, themes: themePicker.getItems(), readings });
    const readingErrors = withReading ? validateReading(firstReading, { book: candidate }) : [];
    if (bookErrors.length || readingErrors.length) {
      showFieldErrors(form, bookErrors);
      showFieldErrors(form, readingErrors, READING_PREFIX);
      return;
    }

    let saved;
    try {
      saved = await saveBook(candidate);
    } catch (error) {
      handleSaveError(form, error);
      return;
    }
    if (withReading) {
      try {
        await saveReading({ ...firstReading, bookId: saved.id });
      } catch (error) {
        await deleteBook(saved.id); // keep nothing half-saved
        handleSaveError(form, error, { prefix: READING_PREFIX });
        return;
      }
    }
    closeFormDialog();
    toast(STR.text.saved);
    onSaved(saved);
  });

  openFormDialog(editing ? STR.titles.editBook : STR.titles.newBook, form);
}
