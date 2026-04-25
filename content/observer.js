// MutationObserver for dynamically loaded ads

window.__artReplacer = window.__artReplacer || {};

window.__artReplacer.startObserver = function(onNewAds) {
  let debounceTimer = null;

  // UI elements that should never be considered ads
  const isUIControl = (el) => {
    // Skip semantic UI buttons and controls
    if (el.hasAttribute('role') && el.getAttribute('role') === 'button') {
      if (el.hasAttribute('aria-label')) return true;
    }
    // Skip elements with intentional ARIA haspopup (modals, dropdowns, etc.)
    if (el.hasAttribute('aria-haspopup')) return true;
    // Skip intentional UI with visible text labels or titles
    if (el.hasAttribute('title') || el.hasAttribute('aria-label')) {
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (label.length > 0) return true;
    }
    return false;
  };

  const observer = new MutationObserver((mutations) => {
    // Debounce: wait 200ms after last mutation batch
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      // Collect all added nodes
      const addedNodes = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            addedNodes.push(node);
          }
        }
      }

      if (addedNodes.length === 0) return;

      // Run ad detection on new nodes and their subtrees only
      const detectAds = window.__artReplacer.detectAds;
      if (!detectAds) return;

      const allAds = new Set();

      for (const node of addedNodes) {
        // Skip our own inserted containers
        if (node.classList?.contains('art-replacer-container')) continue;
        // Skip semantic UI controls
        if (isUIControl(node)) continue;
        detectAds(node).forEach(ad => allAds.add(ad));
      }

      if (allAds.size > 0) {
        onNewAds([...allAds]);
      }
    }, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
};
