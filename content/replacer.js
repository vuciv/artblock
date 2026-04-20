// Main content script entry point
// Wires together detection, art fetching, and DOM replacement

(async function() {
  const AR = window.__artReplacer;
  if (!AR) return;

  const ALL_CATEGORIES = ['impressionism', 'japanese', 'photography', 'renaissance', 'modern', 'space'];
  const CATEGORY_DEFAULTS = Object.fromEntries(ALL_CATEGORIES.map(k => [k, true]));

  const [syncSettings, localData] = await Promise.all([
    chrome.storage.sync.get({ enabled: true, showHoverControls: true, categories: CATEGORY_DEFAULTS }),
    chrome.storage.local.get({ unblockedElements: [] }),
  ]);

  if (!syncSettings.enabled) return;

  const settings = syncSettings;
  const enabledCategories = () =>
    ALL_CATEGORIES.filter(k => settings.categories?.[k] !== false);
  const pageKey = location.hostname + location.pathname;
  const unblockedSelectors = new Set(
    localData.unblockedElements
      .filter(e => e.pageKey === pageKey)
      .map(e => e.selector)
  );

  // ── Image URL helpers ────────────────────────────────────────────────────

  function getImageUrl(artwork, targetWidth, targetHeight) {
    if (artwork.imageId) {
      const w = Math.min(Math.round(targetWidth * 2), 843);

      if (artwork.width && artwork.height) {
        const targetRatio = targetWidth / targetHeight;
        const artRatio = artwork.width / artwork.height;
        const ratioDiff = Math.abs(artRatio - targetRatio) / targetRatio;

        if (ratioDiff > 0.2) {
          let cropW, cropH, cropX, cropY;
          if (targetRatio > artRatio) {
            cropW = artwork.width;
            cropH = Math.round(artwork.width / targetRatio);
            cropX = 0;
            cropY = Math.round((artwork.height - cropH) / 2);
          } else {
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

  function getSourceUrl(art) {
    if (art.id?.startsWith('artic:')) {
      return `https://www.artic.edu/artworks/${art.id.slice(6)}`;
    }
    if (art.id?.startsWith('met:')) {
      return `https://www.metmuseum.org/art/collection/search/${art.id.slice(4)}`;
    }
    if (art.id?.startsWith('nasa:')) {
      return `https://images.nasa.gov/details/${encodeURIComponent(art.id.slice(5))}`;
    }
    return null;
  }

  // ── Selector generation for persistence ─────────────────────────────────

  function getStableSelector(el) {
    const tag = el.tagName.toLowerCase();
    if (el.id && !/^\d/.test(el.id) && !/[_-]\d{5,}/.test(el.id)) {
      return `#${CSS.escape(el.id)}`;
    }
    for (const attr of ['data-ad-slot', 'data-ez-name', 'data-ad-name', 'name']) {
      const val = el.getAttribute(attr);
      if (val) return `${tag}[${attr}="${CSS.escape(val)}"]`;
    }
    return buildPositionalPath(el);
  }

  function buildPositionalPath(el) {
    const parts = [];
    let node = el;
    while (node && node !== document.body) {
      const parent = node.parentElement;
      if (!parent) break;
      const tag = node.tagName.toLowerCase();
      if (node.id && !/^\d/.test(node.id)) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const same = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      const idx = same.indexOf(node) + 1;
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${idx})` : tag);
      node = parent;
    }
    return parts.join(' > ');
  }

  async function saveUnblockedSelector(selector) {
    unblockedSelectors.add(selector);
    const { unblockedElements = [] } = await chrome.storage.local.get('unblockedElements');
    const deduped = unblockedElements.filter(
      e => !(e.pageKey === pageKey && e.selector === selector)
    );
    deduped.push({ pageKey, selector });
    await chrome.storage.local.set({ unblockedElements: deduped });
  }

  // ── Unblock ──────────────────────────────────────────────────────────────

  function unblockElement(container) {
    if (container._adSelector) {
      saveUnblockedSelector(container._adSelector);
    }
    const saved = container._artOriginal;
    if (!saved) { container.remove(); return; }

    if (saved.type === 'iframe') {
      saved.iframe.dataset.artReplacer = 'unblocked';
      container.parentElement?.insertBefore(saved.iframe, container);
      container.remove();
    } else {
      const adElement = container.parentElement;
      if (adElement) {
        adElement.dataset.artReplacer = 'unblocked';
        adElement.innerHTML = saved.innerHTML;
      }
    }
  }

  // ── Hover controls ───────────────────────────────────────────────────────

  function makeButton(text, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'arc-btn';
    btn.textContent = text;
    btn.title = title;
    btn.style.cssText = [
      'all:unset',
      'box-sizing:border-box',
      'width:28px',
      'height:28px',
      'border-radius:6px',
      'background:rgba(0,0,0,0.65)',
      'color:#fff',
      'font-size:14px',
      'cursor:pointer',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'line-height:1',
      'transition:background 0.15s ease',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(107,76,154,0.85)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(0,0,0,0.65)';
    });
    btn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    });
    return btn;
  }

  function addHoverControls(container, art) {
    if (!settings.showHoverControls) return;

    const controls = document.createElement('div');
    controls.className = 'art-replacer-controls';
    controls.style.cssText = [
      'position:absolute',
      'top:8px',
      'right:8px',
      'display:flex',
      'gap:4px',
      'opacity:0',
      'transition:opacity 0.2s ease',
      'z-index:2147483647',
      'pointer-events:none',
    ].join(';');

    const sourceUrl = getSourceUrl(art);
    if (sourceUrl) {
      controls.appendChild(makeButton('↗', 'View in museum collection', () => {
        window.open(sourceUrl, '_blank', 'noopener');
      }));
    }

    controls.appendChild(makeButton('✕', 'Restore original element', () => {
      unblockElement(container);
    }));

    controls.appendChild(makeButton('⚙', 'Artblock settings', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' }).catch(() => {});
    }));

    container.appendChild(controls);

    container.addEventListener('mouseenter', () => {
      controls.style.opacity = '1';
      controls.style.pointerEvents = 'auto';
    });
    container.addEventListener('mouseleave', () => {
      controls.style.opacity = '0';
      controls.style.pointerEvents = 'none';
    });
  }

  // ── Replacement ───────────────────────────────────────────────────────────

  async function replaceAdWithArt(adElement) {
    if (adElement.dataset.artReplacer === 'replaced') return;
    const w = adElement.offsetWidth;
    const h = adElement.offsetHeight;
    if (w < 50 || h < 50) return;

    const selector = getStableSelector(adElement);
    if (unblockedSelectors.has(selector)) return;

    adElement.dataset.artReplacer = 'replacing';

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ART',
        width: w,
        height: h,
        categories: enabledCategories(),
      });

      if (!response?.artwork) {
        adElement.dataset.artReplacer = 'failed';
        return;
      }

      const art = response.artwork;
      const imageUrl = getImageUrl(art, w, h);
      if (!imageUrl) {
        adElement.dataset.artReplacer = 'failed';
        return;
      }

      const container = document.createElement('div');
      container.className = 'art-replacer-container';
      container.style.cssText = `width:${w}px;height:${h}px;position:relative;overflow:hidden;`;
      container._adSelector = selector;

      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = `${art.title} by ${art.artist}`;
      img.className = 'art-replacer-image';
      const slotRatio = w / h;
      const fit = (slotRatio > 3 || slotRatio < 0.33) ? 'cover' : 'contain';
      img.style.cssText = `width:100%;height:100%;object-fit:${fit};`;

      const tooltip = document.createElement('div');
      tooltip.className = 'art-replacer-tooltip';
      tooltip.innerHTML = `
        <strong>${escapeHtml(art.title)}</strong><br>
        ${escapeHtml(art.artist)}${art.date ? ` (${escapeHtml(art.date)})` : ''}<br>
        <span class="art-replacer-source">${escapeHtml(art.source)}</span>
      `;

      container.appendChild(img);
      container.appendChild(tooltip);
      addHoverControls(container, art);

      if (adElement.tagName === 'IFRAME') {
        const parent = adElement.parentElement;
        if (parent) {
          const iframeClone = adElement.cloneNode(true);
          iframeClone.dataset.artReplacer = '';
          container._artOriginal = { type: 'iframe', iframe: iframeClone };
          parent.insertBefore(container, adElement);
          container.dataset.artReplacer = 'replaced';
          adElement.remove();
          chrome.runtime.sendMessage({ type: 'INCREMENT_COUNT' }).catch(() => {});
          return;
        }
        adElement.dataset.artReplacer = 'failed';
        return;
      }

      container._artOriginal = { type: 'div', innerHTML: adElement.innerHTML };
      adElement.innerHTML = '';
      adElement.appendChild(container);
      adElement.dataset.artReplacer = 'replaced';
      chrome.runtime.sendMessage({ type: 'INCREMENT_COUNT' }).catch(() => {});

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

  if (AR.startObserver) {
    AR.startObserver(async (newAds) => {
      if (newAds.length > 0) {
        console.log(`[Art Replacer] Found ${newAds.length} new ads, replacing...`);
        await processAds(newAds);
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.enabled?.newValue === false) location.reload();
      if (changes.categories) settings.categories = changes.categories.newValue;
      if (changes.showHoverControls !== undefined) settings.showHoverControls = changes.showHoverControls.newValue;
    }
    if (area === 'local' && changes.unblockedElements) {
      unblockedSelectors.clear();
      (changes.unblockedElements.newValue || [])
        .filter(e => e.pageKey === pageKey)
        .forEach(e => unblockedSelectors.add(e.selector));
    }
  });
})();
