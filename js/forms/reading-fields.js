// The fields of a reading, shared by the reading form and the "first reading"
// section of the book form. Applies the FR-04 status workflow while the user edits.

import { STATUSES, PRIORITIES, STATUS, yearReadRule, allowsGrade, allowsPriority } from '../domain.js';
import { applyStatusChange } from '../status.js';
import { STR } from '../strings.js';
import { h, field, selectControl, confirmDialog, parseYear, parseGrade } from '../ui.js';

const F = STR.fields;

/**
 * @param {object} reading initial values (may be empty for a new reading)
 * @param {string} prefix id/error prefix, so two readings never clash in one form
 */
export function readingFields(reading = {}, prefix = '') {
  const status = selectControl(STATUSES, reading.status ?? STATUS.WANT_TO_READ, { includeEmpty: false });
  const yearRead = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', value: reading.yearRead ?? '' });
  const grade = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', value: reading.grade ?? '', placeholder: STR.placeholders.grade });
  const recommendedBy = h('input', { type: 'text', value: reading.recommendedBy ?? '' });
  const priority = selectControl(PRIORITIES, reading.priority);
  const notes = h('textarea', { rows: '3' });
  notes.value = reading.notes ?? '';

  const yearField = field({ name: 'yearRead', label: F.yearRead, control: yearRead, hint: STR.hints.yearRead, prefix });
  const element = h('div', { class: 'field-grid' },
    field({ name: 'status', label: F.status, control: status, required: true, prefix }),
    yearField,
    field({ name: 'grade', label: F.grade, control: grade, hint: STR.hints.grade, prefix }),
    field({ name: 'priority', label: F.priority, control: priority, hint: STR.hints.priority, prefix }),
    h('div', { class: 'field-grid__wide' }, field({ name: 'recommendedBy', label: F.recommendedBy, control: recommendedBy, prefix })),
    h('div', { class: 'field-grid__wide' }, field({ name: 'notes', label: F.notes, control: notes, prefix })),
  );

  function read() {
    return {
      status: status.value || null,
      yearRead: parseYear(yearRead.value),
      grade: parseGrade(grade.value),
      recommendedBy: recommendedBy.value,
      priority: priority.value || null,
      notes: notes.value,
    };
  }

  /** Enables only the inputs the current status allows (FR-04 / Section 4). */
  function syncAllowed() {
    const s = status.value;
    const rule = yearReadRule(s);
    yearRead.disabled = rule === 'forbidden';
    yearRead.required = rule === 'required';
    yearField.querySelector('.field__req')?.remove();
    if (rule === 'required') {
      yearField.querySelector('label').append(h('span', { class: 'field__req', 'aria-hidden': 'true' }, ' *'));
    }
    grade.disabled = !allowsGrade(s);
    priority.disabled = !allowsPriority(s);
  }

  let previous = status.value;
  status.addEventListener('change', async () => {
    const current = read();
    const { reading: next, cleared } = applyStatusChange({ ...current, status: previous }, status.value);
    if (cleared.needsConfirm.length) {
      const labels = cleared.needsConfirm.map((f) => F[f].toLowerCase());
      const ok = await confirmDialog(STR.confirm.clearOnStatus(status.value, labels), { confirmLabel: STR.actions.confirm });
      if (!ok) {
        status.value = previous; // keep the old status and the values
        status.focus();
        return;
      }
    }
    yearRead.value = next.yearRead ?? '';
    grade.value = next.grade ?? '';
    priority.value = next.priority ?? '';
    previous = status.value;
    syncAllowed();
  });

  syncAllowed();
  return { element, read };
}
