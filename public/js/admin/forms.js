// Shared helpers for admin forms (used by the users, recipes and workouts admin pages):
// a form dialog, repeating rows (ingredients, steps, exercises) and photo pickers.

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
// each input needs data-field="name". removeLabel is the text of each row's remove button.
// Returns { add(values), clear(), read() }.
function setUpRowList(list, rowHtml, addButton, removeLabel = 'Remove') {
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
        <button type="button" class="link-button link-button--danger" data-remove-row>${removeLabel}</button>`;
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

// ---------- Photos (recipe and exercise images) ----------

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Upload an image file chosen by the admin and return its path. Throws an Error with a clear message.
async function uploadImage(file) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('The image is too big. Choose one under 2 MB.');
  let response;
  try {
    response = await fetch('/api/admin/uploads', { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) window.location.href = '/admin/login.html';
  if (!response.ok) throw new Error(data.error || 'The photo could not be uploaded. Please try again.');
  return data.path;
}

// Photo picker: preview, "Choose photo" and "Remove photo". The chosen path is kept in a hidden
// input with data-field="imagePath", so setUpRowList().read() picks it up in repeating rows.
function photoPickerHtml(imagePath, label = 'photo') {
  return `
    <div class="photo-picker">
      <span class="photo-picker__preview">${imagePath ? `<img src="${attr(imagePath)}" alt="">` : icon('plus', 20)}</span>
      <input type="hidden" data-field="imagePath" value="${attr(imagePath)}">
      <label class="btn btn--secondary btn--small photo-picker__choose">
        <span>${imagePath ? 'Change' : 'Choose'} ${label}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" class="visually-hidden">
      </label>
      <button type="button" class="link-button link-button--danger" data-remove-photo${imagePath ? '' : ' hidden'}>Remove ${label}</button>
    </div>`;
}

// Make every photo picker inside container work; upload errors are shown in messageElement
function setUpPhotoPickers(container, messageElement) {
  const show = (picker, imagePath) => {
    picker.querySelector('[data-field="imagePath"]').value = imagePath;
    picker.querySelector('.photo-picker__preview').innerHTML = imagePath ? `<img src="${attr(imagePath)}" alt="">` : icon('plus', 20);
    picker.querySelector('.photo-picker__choose span').textContent = picker.querySelector('.photo-picker__choose span').textContent
      .replace(/^(Choose|Change)/, imagePath ? 'Change' : 'Choose');
    picker.querySelector('[data-remove-photo]').hidden = !imagePath;
  };

  container.addEventListener('change', async (event) => {
    if (!event.target.matches('.photo-picker input[type="file"]')) return;
    const picker = event.target.closest('.photo-picker');
    const file = event.target.files[0];
    event.target.value = ''; // lets the same file be chosen again after an error
    if (!file) return;
    clearMessage(messageElement);
    picker.classList.add('photo-picker--busy');
    try {
      show(picker, await uploadImage(file));
    } catch (error) {
      showMessage(messageElement, error.message);
    } finally {
      picker.classList.remove('photo-picker--busy');
    }
  });

  container.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-photo]');
    if (removeButton) show(removeButton.closest('.photo-picker'), '');
  });
}
