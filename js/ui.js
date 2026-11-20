// Rendering helpers shared by the views and forms: element creation, dialogs,
// toasts, field errors and display formatting. No data access here.

import { STR, MISSING } from './strings.js';

/**
 * Creates an element. attrs: class, text, dataset, on ({ event: handler }),
 * any other key becomes an attribute (true → present, false/null → absent).
 */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'on') for (const [ev, fn] of Object.entries(value)) node.addEventListener(ev, fn);
    else if (key === 'value') node.value = value;
    else if (key === 'checked' || key === 'selected' || key === 'disabled') node[key] = Boolean(value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  append(node, children);
  return node;
}

function append(node, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

// ---------------------------------------------------------------------------
// Display formatting: missing values are always "-" (never null/undefined/NaN)
// ---------------------------------------------------------------------------

export function isMissing(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
}

export function show(v) {
  return isMissing(v) ? MISSING : String(v);
}

export function formatYear(y) {
  if (isMissing(y)) return MISSING;
  return y < 0 ? STR.text.bc(y) : String(y);
}

export function formatGrade(g) {
  return isMissing(g) ? MISSING : Number(g).toFixed(1);
}

export function formatDate(iso) {
  if (isMissing(iso)) return MISSING;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

export function statusChip(status) {
  const slug = String(status).toLowerCase().replace(/[^a-z]+/g, '-');
  return h('span', { class: `status status--${slug}` }, status);
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

const formDialog = () => document.getElementById('form-dialog');

export function openFormDialog(title, content) {
  const dialog = formDialog();
  dialog.querySelector('#form-dialog-title').textContent = title;
  clear(dialog.querySelector('#form-dialog-body')).append(content);
  if (!dialog.open) dialog.showModal();
  const first = content.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
  if (first) first.focus();
}

export function closeFormDialog() {
  const dialog = formDialog();
  if (dialog.open) dialog.close();
}

export function initDialogs() {
  const dialog = formDialog();
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => clear(dialog.querySelector('#form-dialog-body')));
}

/**
 * Promise-based confirmation using a <dialog>. Resolves true only on Confirm.
 * With { alertOnly: true } it shows a message with a single OK button.
 */
export function confirmDialog(message, { confirmLabel = STR.actions.confirm, danger = false, alertOnly = false, title = STR.titles.confirm } = {}) {
  const dialog = document.getElementById('confirm-dialog');
  const yes = dialog.querySelector('[data-answer=yes]');
  const no = dialog.querySelector('[data-answer=no]');
  dialog.querySelector('#confirm-dialog-title').textContent = title;
  dialog.querySelector('#confirm-dialog-message').textContent = message;
  yes.textContent = alertOnly ? 'OK' : confirmLabel;
  yes.classList.toggle('btn--danger', danger);
  yes.classList.toggle('btn--primary', !danger);
  no.hidden = alertOnly;
  return new Promise((resolve) => {
    const finish = (answer) => {
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      dialog.removeEventListener('cancel', onCancel);
      if (dialog.open) dialog.close();
      resolve(answer);
    };
    const onYes = () => finish(true);
    const onNo = () => finish(false);
    const onCancel = (e) => { e.preventDefault(); finish(false); };
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    dialog.addEventListener('cancel', onCancel);
    dialog.showModal();
    (alertOnly ? yes : no).focus();
  });
}

export function alertDialog(message, title = STR.titles.notFound) {
  return confirmDialog(message, { alertOnly: true, title });
}

let toastTimer = null;
export function toast(message, kind = 'info') {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.dataset.kind = kind;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
}

// ---------------------------------------------------------------------------
// Form fields and inline errors
// ---------------------------------------------------------------------------

/**
 * A labelled field with a hint and an error slot. The error slot is found by
 * data-error-for="<name>", which matches the `field` of { field, message } errors.
 */
export function field({ name, label, control, hint, required = false, prefix = '' }) {
  const id = `f-${prefix}${name}`;
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : null;
  control.id = control.id || id;
  if (!control.name) control.name = name;
  control.setAttribute('aria-describedby', [hintId, errorId].filter(Boolean).join(' '));
  const labelNode = control.matches('fieldset, [role=group]')
    ? null
    : h('label', { for: control.id, class: 'field__label' }, label, required ? h('span', { class: 'field__req', 'aria-hidden': 'true' }, ' *') : null);
  return h('div', { class: 'field', dataset: { field: `${prefix}${name}` } },
    labelNode,
    control,
    hint ? h('p', { class: 'field__hint', id: hintId }, hint) : null,
    h('p', { class: 'field__error', id: errorId, dataset: { errorFor: `${prefix}${name}` } }),
  );
}

export function selectControl(options, value, { emptyLabel = STR.placeholders.none, includeEmpty = true } = {}) {
  const select = h('select');
  if (includeEmpty) select.append(h('option', { value: '' }, emptyLabel));
  for (const opt of options) {
    const { value: v, label } = typeof opt === 'object' ? opt : { value: opt, label: opt };
    select.append(h('option', { value: String(v), selected: String(v) === String(value ?? '') }, label));
  }
  return select;
}

export function clearFieldErrors(root) {
  root.querySelectorAll('[data-error-for]').forEach((p) => { p.textContent = ''; });
  root.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
  root.querySelectorAll('.field--invalid').forEach((f) => f.classList.remove('field--invalid'));
}

/** Shows each { field, message } next to its field. Returns errors that had no slot. */
export function showFieldErrors(root, errors, prefix = '') {
  const orphans = [];
  let firstInvalid = null;
  for (const { field: name, message } of errors) {
    const slot = root.querySelector(`[data-error-for="${prefix}${name}"]`);
    if (!slot) { orphans.push({ field: name, message }); continue; }
    slot.textContent = message;
    const wrapper = slot.closest('.field');
    wrapper.classList.add('field--invalid');
    const control = wrapper.querySelector('input, select, textarea');
    if (control) {
      control.setAttribute('aria-invalid', 'true');
      firstInvalid = firstInvalid || control;
    }
  }
  if (firstInvalid) firstInvalid.focus();
  return orphans;
}

/** Parses a whole-number year typed by the user. Empty → null; garbage → NaN (rejected by validation). */
export function parseYear(text) {
  const s = String(text ?? '').trim().replace(/\s+/g, '');
  if (s === '') return null;
  return /^[-−]?\d+$/.test(s) ? Number(s.replace('−', '-')) : Number.NaN;
}

/** Parses a grade, accepting "7,5" as well as "7.5". */
export function parseGrade(text) {
  const s = String(text ?? '').trim();
  if (s === '') return null;
  return /^\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : Number.NaN;
}
