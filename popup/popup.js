const enabledToggle = document.getElementById('enabled');
const hoverToggle = document.getElementById('showHoverControls');
const categorySelect = document.getElementById('category');
const countDisplay = document.getElementById('count');
const exportBtn = document.getElementById('exportSettings');
const importBtn = document.getElementById('importSettings');
const importFile = document.getElementById('importFile');
const profileFeedback = document.getElementById('profileFeedback');
const hoverFeedback = document.getElementById('hoverFeedback');

const SYNC_DEFAULTS = { enabled: true, category: 'all', showHoverControls: true };

// Show/hide the confirm UI for a reset row.
// The confirm button is on the RIGHT so the user must move their mouse away
// from the trigger button (left-aligned) to actually confirm.
function makeConfirmable(triggerId, warningText, confirmLabel, onConfirm) {
  const trigger = document.getElementById(triggerId);
  const row = trigger.closest('.reset-row');
  let confirmEl = null;

  function showConfirm(e) {
    e.stopPropagation();
    if (confirmEl) { dismiss(); return; }

    confirmEl = document.createElement('div');
    confirmEl.className = 'reset-confirm';
    confirmEl.innerHTML = `
      <p class="reset-warning">${warningText}</p>
      <div class="confirm-row">
        <button class="cancel-btn">Cancel</button>
        <button class="confirm-btn">${confirmLabel}</button>
      </div>
    `;

    confirmEl.querySelector('.cancel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });

    confirmEl.querySelector('.confirm-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onConfirm();
      dismiss();
    });

    row.appendChild(confirmEl);
  }

  function dismiss() {
    confirmEl?.remove();
    confirmEl = null;
  }

  trigger.addEventListener('click', showConfirm);

  document.addEventListener('click', (e) => {
    if (confirmEl && !row.contains(e.target)) dismiss();
  });
}

async function getPageKey() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) return new URL(tab.url).hostname + new URL(tab.url).pathname;
  } catch {}
  return null;
}

chrome.storage.sync.get(SYNC_DEFAULTS, (s) => {
  enabledToggle.checked = s.enabled;
  categorySelect.value = s.category;
  hoverToggle.checked = s.showHoverControls;
});

chrome.runtime.sendMessage({ type: 'GET_COUNT' }, (r) => {
  if (r?.totalReplaced) countDisplay.textContent = r.totalReplaced;
});

enabledToggle.addEventListener('change', () => chrome.storage.sync.set({ enabled: enabledToggle.checked }));
hoverToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ showHoverControls: hoverToggle.checked });
  showFeedback(hoverFeedback, 'Refresh page to see effect.');
});
categorySelect.addEventListener('change', () => chrome.storage.sync.set({ category: categorySelect.value }));

// Reset profile
makeConfirmable(
  'resetProfile',
  'Are you sure? This will permanently delete all your saved settings.',
  'Confirm Reset Profile',
  () => Promise.all([
    chrome.storage.sync.set(SYNC_DEFAULTS),
    chrome.storage.local.set({ unblockedElements: [] }),
  ]).then(() => {
    enabledToggle.checked = SYNC_DEFAULTS.enabled;
    categorySelect.value = SYNC_DEFAULTS.category;
    hoverToggle.checked = SYNC_DEFAULTS.showHoverControls;
    showFeedback(profileFeedback, 'Successfully reset. Refresh page to see effect.');
  })
);

// Reset site settings — only shown when we know which site we're on
getPageKey().then(pageKey => {
  if (!pageKey) return;

  const row = document.getElementById('resetSiteRow');
  const hostname = new URL('https://' + pageKey).hostname;

  row.style.display = '';

  makeConfirmable(
    'resetSite',
    `Are you sure? This will permanently delete all your settings on ${hostname}`,
    'Confirm Reset Site',
    () => chrome.storage.local.get({ unblockedElements: [] }, ({ unblockedElements }) => {
      chrome.storage.local.set({
        unblockedElements: unblockedElements.filter(e => e.pageKey !== pageKey),
      }, () => showFeedback(profileFeedback, 'Successfully reset. Refresh page to see effect.'));
    })
  );
});

// Export
exportBtn.addEventListener('click', () => {
  Promise.all([
    chrome.storage.sync.get(SYNC_DEFAULTS),
    chrome.storage.local.get({ unblockedElements: [] }),
  ]).then(([sync, local]) => {
    const blob = new Blob([JSON.stringify({ ...sync, ...local }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'artblock-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

// Import
importBtn.addEventListener('click', () => importFile.click());

function showFeedback(el, msg, isError = false) {
  el.textContent = msg;
  el.className = isError ? 'feedback feedback--error' : 'feedback feedback--success';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; el.className = 'feedback'; }, 4000);
}

const VALID_CATEGORIES = ['all', 'impressionism', 'japanese', 'photography', 'renaissance', 'modern', 'space'];

importFile.addEventListener('change', () => {
  const file = importFile.files[0];
  importFile.value = '';
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    showFeedback(profileFeedback, 'File must be a .json file.', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      showFeedback(profileFeedback, 'Invalid file — could not parse JSON.', true);
      return;
    }

    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      showFeedback(profileFeedback, 'Invalid settings file format.', true);
      return;
    }

    const hasKnownKey = ['enabled', 'category', 'showHoverControls', 'unblockedElements']
      .some(k => k in data);
    if (!hasKnownKey) {
      showFeedback(profileFeedback, "File doesn't look like an Artblock settings export.", true);
      return;
    }

    if ('category' in data && !VALID_CATEGORIES.includes(data.category)) {
      showFeedback(profileFeedback, `Unknown category "${data.category}" in settings file.`, true);
      return;
    }

    const syncData = {
      enabled: typeof data.enabled === 'boolean' ? data.enabled : SYNC_DEFAULTS.enabled,
      category: typeof data.category === 'string' ? data.category : SYNC_DEFAULTS.category,
      showHoverControls: typeof data.showHoverControls === 'boolean' ? data.showHoverControls : SYNC_DEFAULTS.showHoverControls,
    };
    const localData = {
      unblockedElements: Array.isArray(data.unblockedElements) ? data.unblockedElements : [],
    };

    Promise.all([
      chrome.storage.sync.set(syncData),
      chrome.storage.local.set(localData),
    ]).then(() => {
      enabledToggle.checked = syncData.enabled;
      categorySelect.value = syncData.category;
      hoverToggle.checked = syncData.showHoverControls;
      showFeedback(profileFeedback, 'Successfully imported settings. Refresh page to see effect.');
    });
  };
  reader.readAsText(file);
});
