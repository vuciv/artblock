const enabledToggle = document.getElementById('enabled');
const categorySelect = document.getElementById('category');
const countDisplay = document.getElementById('count');

// Load saved settings
chrome.storage.sync.get({ enabled: true, category: 'all' }, (settings) => {
  enabledToggle.checked = settings.enabled;
  categorySelect.value = settings.category;
});

// Load session count
chrome.runtime.sendMessage({ type: 'GET_COUNT' }, (response) => {
  if (response?.totalReplaced) {
    countDisplay.textContent = response.totalReplaced;
  }
});

// Save settings on change
enabledToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledToggle.checked });
});

categorySelect.addEventListener('change', () => {
  chrome.storage.sync.set({ category: categorySelect.value });
});
