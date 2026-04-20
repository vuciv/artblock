// Main content script entry point
// Wires together detection, art fetching, and DOM replacement

(async function() {
  const AR = window.__artReplacer;
  if (!AR) return;

  // Check if extension is enabled
  const settings = await chrome.storage.sync.get({ enabled: true, category: 'all' });
  if (!settings.enabled) return;

  let replaceCount = 0;

  function getImageUrl(artwork, targetWidth, targetHeight) {
    // AIC artworks have imageId — use IIIF to request proper aspect ratio crop
    if (artwork.imageId) {
      const w = Math.min(Math.round(targetWidth * 2), 843);
      const h = Math.min(Math.round(targetHeight * 2), 843);

      // If we know the artwork dimensions, request a center crop matching target aspect ratio
      if (artwork.width && artwork.height) {
        const targetRatio = targetWidth / targetHeight;
        const artRatio = artwork.width / artwork.height;
        const ratioDiff = Math.abs(artRatio - targetRatio) / targetRatio;

        // Only crop if aspect ratios differ significantly (>20%)
        if (ratioDiff > 0.2) {
          // Calculate crop region in artwork pixel space
          let cropW, cropH, cropX, cropY;
          if (targetRatio > artRatio) {
            // Target is wider — crop top/bottom of artwork
            cropW = artwork.width;
            cropH = Math.round(artwork.width / targetRatio);
            cropX = 0;
            cropY = Math.round((artwork.height - cropH) / 2);
          } else {
            // Target is taller — crop left/right of artwork
            cropH = artwork.height;
            cropW = Math.round(artwork.height * targetRatio);
            cropX = Math.round((artwork.width - cropW) / 2);
            cropY = 0;
          }
          return `https://www.artic.edu/iiif/2/${artwork.imageId}/${cropX},${cropY},${cropW},${cropH}/${w},/0/default.jpg`;
        }
      }

      return `https://www.artic.edu/iiif/2/${artwork.imageId}/full/${w},/0/default.jpg`;
    }
    return artwork.smallImageUrl || artwork.imageUrl || '';
  }

  async function replaceAdWithArt(adElement) {
    // Skip if already replaced or too small
    if (adElement.dataset.artReplacer === 'replaced') return;
    const w = adElement.offsetWidth;
    const h = adElement.offsetHeight;
    if (w < 50 || h < 50) return;

    // Mark as in-progress to prevent double-processing
    adElement.dataset.artReplacer = 'replacing';

    try {
      // Request artwork from service worker
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ART',
        width: w,
        height: h,
        category: settings.category,
      });

      if (!response || !response.artwork) {
        adElement.dataset.artReplacer = 'failed';
        return;
      }

      const art = response.artwork;
      const imageUrl = getImageUrl(art, w, h);
      if (!imageUrl) {
        adElement.dataset.artReplacer = 'failed';
        return;
      }

      // Build replacement HTML
      const container = document.createElement('div');
      container.className = 'art-replacer-container';
      container.style.cssText = `width:${w}px;height:${h}px;position:relative;overflow:hidden;`;

      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = `${art.title} by ${art.artist}`;
      img.className = 'art-replacer-image';
      // Use cover for extreme aspect ratios (leaderboards, thin banners)
      // where contain would leave huge empty bars
      const slotRatio = w / h;
      const fit = (slotRatio > 3 || slotRatio < 0.33) ? 'cover' : 'contain';
      img.style.cssText = `width:100%;height:100%;object-fit:${fit};`;

      // Tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'art-replacer-tooltip';
      tooltip.innerHTML = `
        <strong>${escapeHtml(art.title)}</strong><br>
        ${escapeHtml(art.artist)}${art.date ? ` (${escapeHtml(art.date)})` : ''}<br>
        <span class="art-replacer-source">${escapeHtml(art.source)}</span>
      `;

      container.appendChild(img);
      container.appendChild(tooltip);

      // Replace the ad content
      // For iframes: insert art next to the iframe, then remove the iframe so
      // its ad SDK stops running (hiding alone leaves scripts alive and noisy)
      if (adElement.tagName === 'IFRAME') {
        const parent = adElement.parentElement;
        if (parent) {
          parent.insertBefore(container, adElement);
          container.dataset.artReplacer = 'replaced';
          adElement.remove();
          replaceCount++;
          chrome.runtime.sendMessage({ type: 'INCREMENT_COUNT' }).catch(() => {});
          return;
        }
        adElement.dataset.artReplacer = 'failed';
        return;
      }

      adElement.innerHTML = '';
      adElement.appendChild(container);
      adElement.dataset.artReplacer = 'replaced';
      replaceCount++;

      // Update badge count
      chrome.runtime.sendMessage({
        type: 'INCREMENT_COUNT',
      }).catch(() => {});

    } catch (e) {
      console.warn('[Art Replacer] Failed to replace ad:', e);
      adElement.dataset.artReplacer = 'failed';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function processAds(adElements) {
    // Process ads sequentially to avoid hammering the API
    for (const ad of adElements) {
      await replaceAdWithArt(ad);
    }
  }

  // Initial scan
  const initialAds = AR.detectAds(document);
  if (initialAds.length > 0) {
    console.log(`[Art Replacer] Found ${initialAds.length} ads, replacing with art...`);
    await processAds(initialAds);
  }

  // Start observer for dynamically loaded ads
  if (AR.startObserver) {
    AR.startObserver(async (newAds) => {
      if (newAds.length > 0) {
        console.log(`[Art Replacer] Found ${newAds.length} new ads, replacing...`);
        await processAds(newAds);
      }
    });
  }

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled?.newValue === false) {
        // Extension was disabled — reload to restore original page
        location.reload();
      }
      if (changes.category) {
        settings.category = changes.category.newValue;
      }
    }
  });
})();
