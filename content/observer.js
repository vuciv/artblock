// MutationObserver for dynamically loaded ads

window.__artReplacer = window.__artReplacer || {};

window.__artReplacer.startObserver = function(onNewAds) {
  let debounceTimer = null;

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
