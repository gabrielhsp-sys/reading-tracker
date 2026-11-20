// Create / edit an author (FR-01).
import { getAuthors, getCountries, saveAuthor } from '../store.js';
import { validateAuthor, todayIso } from '../validation.js';
import { STR } from '../strings.js';
import { h, field, selectControl, openFormDialog, closeFormDialog, clearFieldErrors, showFieldErrors, toast } from '../ui.js';
import { formActions, handleSaveError } from './form-helpers.js';

const F = STR.fields;

export async function openAuthorForm(author, onSaved) {
  const [authors, countries] = await Promise.all([getAuthors(), getCountries()]);
  const editing = Boolean(author && author.id != null);
  const a = author || {};
  const today = todayIso();

  const name = h('input', { type: 'text', value: a.name ?? '', autocomplete: 'off', required: true });
  const countryOptions = countries
    .slice()
    .sort((x, y) => x.name.localeCompare(y.name, 'en'))
    .map((c) => ({ value: c.id, label: c.name }));
  const country = selectControl(countryOptions, a.countryId);
  const birth = h('input', { type: 'date', value: a.birthDate ?? '', max: today });
  const death = h('input', { type: 'date', value: a.deathDate ?? '', max: today });

  const form = h('form', { class: 'form', novalidate: true },
    field({ name: 'name', label: F.name, control: name, required: true }),
    field({ name: 'countryId', label: F.nationality, control: country }),
    h('div', { class: 'field-grid' },
      field({ name: 'birthDate', label: F.birthDate, control: birth }),
      field({ name: 'deathDate', label: F.deathDate, control: death }),
    ),
    formActions(),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFieldErrors(form);
    // A date input holding an impossible date reports badInput and an empty value.
    const bad = [birth, death].filter((c) => c.validity.badInput)
      .map((c) => ({ field: c.name, message: STR.errors.dateInvalid }));
    const candidate = {
      id: a.id ?? null,
      name: name.value.trim(),
      countryId: country.value === '' ? null : Number(country.value),
      birthDate: birth.value || null,
      deathDate: death.value || null,
    };
    const errors = [...bad, ...validateAuthor(candidate, { authors, countries, today: todayIso() })];
    if (errors.length) { showFieldErrors(form, errors); return; }
    try {
      const saved = await saveAuthor(candidate);
      closeFormDialog();
      toast(STR.text.saved);
      onSaved(saved);
    } catch (error) {
      handleSaveError(form, error, { conflictField: 'name' });
    }
  });

  openFormDialog(editing ? STR.titles.editAuthor : STR.titles.newAuthor, form);
}
