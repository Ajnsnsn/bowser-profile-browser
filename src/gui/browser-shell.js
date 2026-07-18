const elements = {
  back: document.querySelector('#back'),
  forward: document.querySelector('#forward'),
  reload: document.querySelector('#reload'),
  home: document.querySelector('#home'),
  form: document.querySelector('#address-form'),
  address: document.querySelector('#address'),
  security: document.querySelector('#security-indicator'),
  loadingLine: document.querySelector('#loading-line'),
  profileName: document.querySelector('#profile-name'),
};

let currentUrl = '';
let editingAddress = false;

function applyState(state) {
  currentUrl = state.url || '';
  elements.back.disabled = !state.canGoBack;
  elements.forward.disabled = !state.canGoForward;
  elements.reload.classList.toggle('loading', Boolean(state.loading));
  elements.reload.title = state.loading ? 'Hentikan pemuatan (Esc)' : 'Muat ulang (Ctrl+R)';
  elements.profileName.textContent = state.profileName || 'Profil';
  elements.loadingLine.classList.toggle('active', Boolean(state.loading));
  elements.security.classList.toggle('secure', currentUrl.startsWith('https://'));
  elements.security.classList.toggle('local', currentUrl.startsWith('http://127.0.0.1') || currentUrl.startsWith('http://localhost'));
  if (!editingAddress) elements.address.value = currentUrl === 'about:blank' ? '' : currentUrl;
}

elements.back.addEventListener('click', () => window.browserControls.back());
elements.forward.addEventListener('click', () => window.browserControls.forward());
elements.reload.addEventListener('click', () => window.browserControls.reloadOrStop());
elements.home.addEventListener('click', () => window.browserControls.home());

elements.address.addEventListener('focus', () => {
  editingAddress = true;
  elements.address.select();
});
elements.address.addEventListener('blur', () => {
  editingAddress = false;
  elements.address.value = currentUrl === 'about:blank' ? '' : currentUrl;
});
elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = elements.address.value.trim();
  if (!value) return;
  editingAddress = false;
  elements.address.blur();
  try {
    elements.address.classList.remove('error');
    await window.browserControls.navigate(value);
  } catch (error) {
    elements.address.classList.add('error');
    elements.address.title = error.message || 'Alamat tidak dapat dibuka';
    elements.address.focus();
  }
});

window.browserControls.onStateChanged(applyState);
window.browserControls.onFocusLocation(() => {
  elements.address.focus();
  elements.address.select();
});
