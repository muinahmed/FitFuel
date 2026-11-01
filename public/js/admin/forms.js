// Shared helpers for admin forms (used by the users, recipes and workouts admin pages):
// a form dialog and repeating rows (ingredients, steps, exercises).

// Open a <dialog> containing a form. onSubmit(form) should save and may throw an Error,
// whose message is shown in the dialog. The dialog closes after a successful save.
function openFormDialog(dialog, onSubmit) {
  const form = dialog.querySelector('form');
  const message = dialog.querySelector('.message');
  clearMessage(message);

  form.onsubmit = (event) => {
    event.preventDefault();
    clearMessage(message);
    withBusyButton(form, async () => {
      try {
        await onSubmit(form);
        dialog.close();
      } catch (error) {
        showMessage(message, error.message);
        message.scrollIntoView({ block: 'nearest' });
      }
    });
  };
  dialog.querySelectorAll('[data-close-dialog]').forEach((button) => { button.onclick = () => dialog.close(); });
  dialog.showModal();
}

// Repeating rows inside a list element. rowHtml(values) returns the inputs for one row;
// each input needs data-field="name". Returns { add(values), clear(), read() }.
function setUpRowList(list, rowHtml, addButton) {
  list.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-row]');
    if (removeButton) {
      removeButton.closest('li').remove();
      list.dispatchEvent(new Event('input', { bubbles: true })); // let totals update
    }
  });

  const rows = {
    add(values = {}) {
      const item = document.createElement('li');
      item.className = 'row-item';
      item.innerHTML = `${rowHtml(values)}
        <button type="button" class="link-button link-button--danger" data-remove-row>Remove</button>`;
      list.appendChild(item);
      return item;
    },
    clear() {
      list.innerHTML = '';
    },
    // One object per row: { field: value }; checkboxes give true/false
    read() {
      return [...list.children].map((item) => Object.fromEntries([...item.querySelectorAll('[data-field]')]
        .map((input) => [input.dataset.field, input.type === 'checkbox' ? input.checked : input.value])));
    },
  };
  addButton.addEventListener('click', () => {
    const item = rows.add();
    item.querySelector('input, textarea, select').focus();
  });
  return rows;
}

// A value safe to put inside an HTML attribute
function attr(value) {
  return escapeHtml(value === undefined || value === null ? '' : value);
}
