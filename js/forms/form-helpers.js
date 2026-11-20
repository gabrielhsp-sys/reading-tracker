import { STR } from '../strings.js';
import { h, closeFormDialog, showFieldErrors, toast } from '../ui.js';

export function formActions(saveLabel = STR.actions.save) {
  return h('div', { class: 'form__actions' },
    h('button', { type: 'button', class: 'btn', on: { click: closeFormDialog } }, STR.actions.cancel),
    h('button', { type: 'submit', class: 'btn btn--primary' }, saveLabel),
  );
}

/**
 * Shows a store error ({ status, message, errors }) in the form: field errors next to
 * their fields; a 409 next to `conflictField` when given; anything else as a toast.
 */
export function handleSaveError(form, error, { conflictField = null, prefix = '' } = {}) {
  if (error && error.status === 400 && Array.isArray(error.errors) && error.errors.length) {
    const orphans = showFieldErrors(form, error.errors, prefix);
    if (orphans.length) toast(orphans.map((e) => e.message).join(' '), 'error');
    return;
  }
  if (error && error.status === 409 && conflictField) {
    showFieldErrors(form, [{ field: conflictField, message: error.message }], prefix);
    return;
  }
  toast(error && error.message ? error.message : STR.text.unexpected, 'error');
  if (!error || error.status == null) console.error(error);
}
