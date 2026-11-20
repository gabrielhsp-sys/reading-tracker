// Multi-select picker: choose existing records from a <select> and show them as
// removable chips. Records are never retyped (FR-02).
import { STR } from '../strings.js';
import { h, clear } from '../ui.js';

/**
 * @param {object} o
 * @param {string} o.name      field name, used for the error slot (e.g. "authorIds")
 * @param {string} o.legend    visible group label
 * @param {Array<{id:number,name:string}>} o.items  choosable records
 * @param {number[]} o.selected initially selected ids
 * @param {string} o.placeholder first option of the select
 * @param {string} o.emptyText  shown when nothing is chosen
 * @param {string} o.hint
 */
export function multiPicker({ name, legend, items, selected = [], placeholder, emptyText, hint, addLabel = STR.actions.add }) {
  let all = items.slice();
  const chosen = new Set(selected);
  const id = `f-${name}`;
  const select = h('select', { id, 'aria-describedby': `${id}-hint ${id}-error` });
  const chips = h('ul', { class: 'chips', 'aria-live': 'polite' });
  const extra = h('div', { class: 'picker__extra' });

  function renderSelect() {
    const options = all
      .filter((item) => !chosen.has(item.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
      .map((item) => h('option', { value: String(item.id) }, item.name));
    clear(select).append(h('option', { value: '' }, placeholder), ...options);
  }

  function renderChips() {
    clear(chips);
    if (chosen.size === 0) {
      chips.append(h('li', { class: 'chips__empty' }, emptyText));
      return;
    }
    for (const itemId of chosen) {
      const item = all.find((x) => x.id === itemId);
      const label = item ? item.name : `#${itemId}`;
      chips.append(h('li', { class: 'chip' },
        h('span', {}, label),
        h('button', {
          type: 'button',
          class: 'chip__remove',
          'aria-label': `${STR.actions.remove} ${label}`,
          on: { click: () => { chosen.delete(itemId); render(); select.focus(); } },
        }, '×'),
      ));
    }
  }

  function render() {
    renderSelect();
    renderChips();
  }

  function addSelected() {
    const value = Number(select.value);
    if (!value) return;
    chosen.add(value);
    render();
    select.focus();
  }

  const element = h('fieldset', { class: 'field picker', dataset: { field: name } },
    h('legend', { class: 'field__label' }, legend),
    chips,
    h('div', { class: 'picker__row' },
      h('label', { class: 'visually-hidden', for: id }, placeholder),
      select,
      h('button', { type: 'button', class: 'btn', on: { click: addSelected } }, addLabel),
    ),
    hint ? h('p', { class: 'field__hint', id: `${id}-hint` }, hint) : null,
    h('p', { class: 'field__error', id: `${id}-error`, dataset: { errorFor: name } }),
    extra,
  );
  render();

  return {
    element,
    extra,
    getIds: () => [...chosen],
    getItems: () => all.slice(),
    /** Adds a record created on the spot and selects it. */
    addAndSelect(item) {
      all = [...all, item];
      chosen.add(item.id);
      render();
    },
  };
}
