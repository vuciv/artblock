# Artblock — Privacy Policy

*Last updated: 2026-04-19*

## Summary

**Artblock does not collect, store, or transmit any personal information, browsing history, or user data.** Everything it does happens locally in your browser.

## What Artblock does

Artblock is a Chrome extension that replaces advertisements and sponsored content on the web pages you visit with artwork from three public collections:

- Art Institute of Chicago — [api.artic.edu](https://api.artic.edu)
- The Metropolitan Museum of Art — [collectionapi.metmuseum.org](https://collectionapi.metmuseum.org)
- NASA Image Library — [images-api.nasa.gov](https://images-api.nasa.gov)

## Data we collect

**None.**

Specifically:

- No personally identifiable information (name, email, address, ID).
- No health, financial, authentication, or location data.
- No browsing history. We never record, store, or send the URLs of pages you visit.
- No user activity. We do not track clicks, keystrokes, scroll, or mouse movement.
- No page content. The extension reads the DOM of the page you are viewing only in order to identify ad-shaped elements (by class name, element ID, or tag type) and replace them. That reading is done locally in your browser and is never transmitted anywhere.
- No analytics, telemetry, accounts, or tracking pixels.

## Data we store locally on your device

Artblock uses the Chrome extension storage APIs to save:

- Your own settings — whether the extension is enabled and which art category you picked (`chrome.storage.sync`, so it follows you across Chrome installs signed in with the same Google account).
- A local cache of artwork metadata (title, artist, image URL) fetched from the three public APIs above (`chrome.storage.local`), so the extension does not hit those APIs on every page load.
- A session counter of how many ads have been replaced in the current browser session, for the toolbar badge (`chrome.storage.session`).

None of this is transmitted off your device.

## Network requests Artblock makes

The only outbound network requests Artblock initiates are to the three public museum and NASA APIs listed above, and requests for artwork image files from those institutions' CDNs. Those requests contain only a generic search term (e.g. `"painting"`, `"nebula"`) and a result-page number. They do not include any identifier, cookie, or information about you or the website you are currently viewing.

## Third parties

Artblock does not share, sell, or transfer any data to any third party, because Artblock does not collect any data to share in the first place.

## Changes to this policy

If this policy ever changes, the revised version will be published at the URL where you are reading this, with an updated "Last updated" date at the top.

## Contact

Questions: open an issue at the Artblock GitHub repository, or email the address listed on the Chrome Web Store listing for the extension.
