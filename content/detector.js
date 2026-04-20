// Ad detection via CSS selectors and heuristic size matching

const AD_SELECTORS = [
  // Google Ads
  'ins.adsbygoogle',
  '[id^="google_ads"]',
  '[id^="div-gpt-ad"]',
  '[data-ad-slot]',
  '[data-ad-client]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="googleadservices.com"]',
  '[id*="google_ads"]',

  // Generic ad patterns
  '[class*="ad-container"]',
  '[class*="ad-wrapper"]',
  '[class*="ad-banner"]',
  '[class*="ad-unit"]',
  '[class*="ad-slot"]',
  '[class*="advert-"]',
  '[class*="advertisement"]',
  '[id*="ad-container"]',
  '[id*="ad-wrapper"]',
  '[id*="ad-banner"]',

  // Content-recommendation widgets (all the "you may also like" junk)
  '[id*="taboola"]',
  '[class*="taboola"]',
  '[id*="outbrain"]',
  '[class*="outbrain"]',
  '[class*="mgid"]',
  '[id*="mgid"]',
  '[class*="revcontent"]',
  '[id*="revcontent"]',
  '[class*="zergnet"]',
  '[id*="zergnet"]',
  '[data-widget-id*="taboola"]',
  '[data-widget-id*="outbrain"]',

  // Additional sponsored-content networks (vendor-specific, low FP risk)
  '[class*="nativo"]',
  '[class*="zemanta"]',

  // Sponsored / native ads (explicit labels only)
  '[class*="sponsored-content"]',
  '[class*="sponsored_content"]',
  '[class*="sponsored-post"]',
  '[class*="sponsored-link"]',
  '[class*="partner-content"]',
  '[class*="native-ad"]',
  '[class*="nativead"]',
  '[data-testid*="ad"]',
  '[data-testid*="sponsored" i]',
  '[data-testid*="promoted" i]',
  '[aria-label*="advertisement" i]',
  '[aria-label*="sponsored" i]',
  '[data-sponsored="true"]',

  // IAB / programmatic ad attributes (GAM, Prebid)
  '[data-ad-format]',
  '[data-ad-unit-path]',
  '[data-slot]',
  '[pbadslot]',

  // Affiliate roundup / product placement widgets
  '[class*="affiliate-widget"]',
  '[class*="product-recommendations"]',
  '[class*="product-roundup"]',
  '[class*="shopping-widget"]',

  // Newsletter / subscribe / paywall prompts embedded inline
  '[class*="newsletter-signup"]',
  '[class*="newsletter-form"]',
  '[class*="newsletter-prompt"]',
  '[class*="subscribe-banner"]',
  '[class*="subscribe-prompt"]',
  '[class*="paywall-prompt"]',
  '[class*="mc4wp"]',
  '[class*="mailchimp-form"]',
  '[class*="meter-box"]',
  '[id*="gateway-content"]',

  // Amazon ads
  'iframe[src*="amazon-adsystem.com"]',

  // Common ad iframes
  'iframe[src*="adnxs.com"]',
  'iframe[src*="criteo.com"]',
  'iframe[src*="moatads.com"]',
  'iframe[src*="rubiconproject.com"]',
  'iframe[src*="pubmatic.com"]',
  'iframe[src*="openx.net"]',
  'iframe[src*="casalemedia.com"]',

  // DFP / GAM
  '[class*="dfp-ad"]',
  '[id*="dfp-ad"]',
  'div[data-google-query-id]',
];

// IAB standard ad sizes [width, height]
const IAB_AD_SIZES = [
  [728, 90],   // Leaderboard
  [300, 250],  // Medium Rectangle
  [160, 600],  // Wide Skyscraper
  [320, 50],   // Mobile Banner
  [300, 600],  // Half Page
  [970, 250],  // Billboard
  [970, 90],   // Large Leaderboard
  [336, 280],  // Large Rectangle
  [120, 600],  // Skyscraper
  [320, 100],  // Large Mobile Banner
  [250, 250],  // Square
  [468, 60],   // Full Banner
];

const SIZE_TOLERANCE = 0.15;

function matchesAdDimension(w, h) {
  if (w < 50 || h < 50) return false;
  return IAB_AD_SIZES.some(([aw, ah]) => {
    return Math.abs(w - aw) / aw <= SIZE_TOLERANCE &&
           Math.abs(h - ah) / ah <= SIZE_TOLERANCE;
  });
}

// Known ad-serving domains for iframe src checks
const AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'adnxs.com', 'amazon-adsystem.com', 'taboola.com', 'outbrain.com',
  'criteo.com', 'moatads.com', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'casalemedia.com', 'serving-sys.com', 'adform.net',
  'adsrvr.org', 'bidswitch.net', 'contextweb.com',
];

function looksLikeAd(el) {
  // Check iframe src
  if (el.tagName === 'IFRAME') {
    const src = el.src || '';
    return AD_DOMAINS.some(d => src.includes(d));
  }
  // Check inner iframes
  const innerIframes = el.querySelectorAll('iframe');
  for (const iframe of innerIframes) {
    const src = iframe.src || '';
    if (AD_DOMAINS.some(d => src.includes(d))) return true;
  }
  // Check if div has very little text content and contains images/iframes
  const text = el.textContent?.trim() || '';
  if (text.length < 20 && (el.querySelector('img, iframe'))) return true;
  return false;
}

function detectAds(root = document) {
  const found = new Set();
  const isElement = root.nodeType === Node.ELEMENT_NODE;

  // Phase 1: CSS selector-based (high confidence)
  for (const selector of AD_SELECTORS) {
    try {
      if (isElement && root.matches(selector) && !root.dataset.artReplacer) {
        found.add(root);
      }
      root.querySelectorAll(selector).forEach(el => {
        if (!el.dataset.artReplacer) found.add(el);
      });
    } catch (_) {
      // Invalid selector in this context, skip
    }
  }

  // Phase 2: Heuristic dimension check
  const checkDim = (el) => {
    if (found.has(el) || el.dataset.artReplacer) return;
    if (el.tagName !== 'IFRAME' && el.tagName !== 'DIV') return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (matchesAdDimension(w, h) && looksLikeAd(el)) {
      found.add(el);
    }
  };
  if (isElement) checkDim(root);
  root.querySelectorAll('iframe, div').forEach(checkDim);

  // Drop nested matches — process only the outermost ad container so we
  // don't double-replace or leave inner `failed` markers on orphaned nodes.
  // Also skip descendants of any ancestor already flagged (replacing/replaced/failed).
  return [...found].filter(el => {
    if (el.dataset.artReplacer) return false;
    let p = el.parentElement;
    while (p) {
      if (found.has(p) || p.dataset?.artReplacer) return false;
      p = p.parentElement;
    }
    return true;
  });
}

// Expose globally for content scripts
window.__artReplacer = window.__artReplacer || {};
window.__artReplacer.detectAds = detectAds;
