# Artblock

**Every ad on the internet, replaced with fine art.**

Artblock is a Chrome extension that detects advertisements, sponsored content, affiliate widgets, and promotional clutter on the pages you visit and swaps them for artwork from three public, open-access collections:

- 🏛 **Art Institute of Chicago** — paintings, Japanese woodblock prints, photography (Monet, Hokusai, O'Keeffe, and thousands more)
- 🏛 **The Metropolitan Museum of Art** — centuries of painting, sculpture, and design
- 🌌 **NASA Image Library** — nebulae, galaxies, Earthrise, the Pillars of Creation

## Features

- Detects Google Ads, DoubleClick, Amazon, Taboola/Outbrain, MGID, RevContent, sponsored content, affiliate widgets, newsletter/paywall prompts
- Categories: Impressionism, Japanese Woodblock, Renaissance, Photography, Modern/Contemporary, NASA Space, or Chaos Mode
- Never shows you the same image twice in a session
- Hover any replaced slot to see the title, artist, date, and source museum
- Per-tab toolbar badge counts how many ads have been replaced on the current page

## Install

### From the Chrome Web Store

_(Coming soon.)_

### Unpacked (development)

1. Clone this repo: `git clone https://github.com/vuciv/artblock.git`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked**, select the repo root
4. Visit any ad-supported site — the replacements happen automatically

## How it works

- `content/detector.js` scans the DOM for ad containers via curated CSS selectors and IAB ad-size heuristics, skipping nested matches so only the outermost ad slot is replaced.
- `content/observer.js` watches for dynamically-injected ads via `MutationObserver`.
- `content/replacer.js` swaps each detected slot for an `<img>` sized to fit, with a hover tooltip showing the artwork metadata.
- `background/service-worker.js` fetches art metadata from the three public APIs and caches it per aspect-ratio bucket in `chrome.storage.local`, so replacements are instant and never repeat within a session.

## Privacy

Artblock collects **nothing**. No analytics, no accounts, no telemetry, no browsing history. The only outbound requests it makes are to the three public museum/NASA APIs, and those requests carry nothing but a generic search term. See [PRIVACY.md](./PRIVACY.md).

## Credits

Artwork and imagery are sourced from the open-access programs of the [Art Institute of Chicago](https://www.artic.edu/open-access), [The Metropolitan Museum of Art](https://www.metmuseum.org/art/collection/search-open-access), and [NASA](https://images.nasa.gov). All collection metadata and images remain the property of their respective institutions.

## License

[MIT](./LICENSE)
