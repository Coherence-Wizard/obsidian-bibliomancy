# Bibliomancy (Atmospheric Noise)

Discover a random passage from your notes, or open a random note, using atmospheric randomness from [RANDOM.ORG](https://www.random.org/). Choose which folders or tags to include, then follow a passage back to its source.

## Get started

1. Install and enable the plugin in Obsidian.
2. Open **Settings → Bibliomancy (Atmospheric Noise)**.
3. Follow the setup steps there to create a RANDOM.ORG account, get your own API key, and paste it into the settings.
4. Leave **Use RANDOM.ORG** enabled to use atmospheric randomness.
5. Click the dice button in Obsidian’s sidebar to draw a passage.

A RANDOM.ORG account and your own API key are required for atmospheric randomness. Check the service’s current usage limits and any charges when creating your key. If a draw fails, check your internet connection and whether your key is active and has usage remaining.

For offline use, turn off **Use RANDOM.ORG**. This uses your device’s own randomness instead of atmospheric noise. **Allow local fallback** is off by default; if you turn it on, the plugin can use local randomness when RANDOM.ORG is unavailable and will tell you when that happens.

## Using the plugin

- Click the dice button or run **Draw random passage** from the command palette.
- Use **Open random note** to open a note instead of showing a passage.
- Use **Draw passage from current folder**, or right-click a folder, to draw from that folder and its subfolders.
- Right-click a note to draw a passage from that note alone.
- From a passage, choose **Go to passage**, **Open note**, or **Draw another**.

In settings, you can limit draws to particular folders or tags and adjust passage length. Separate multiple folders or tags with commas. Leave these filters blank to include all notes. Folder names must match their capitalization in your vault.

Headings, note properties, code blocks, and hidden comments are skipped. Long passages are shortened for display. Your notes are never changed.

## How passages are chosen

The plugin picks a note first, then a paragraph within that note. Every note matching your filters has an equal chance of being picked. Within the chosen note, every eligible paragraph has an equal chance.

For example, if your filters match just two notes:

- **Note A has 2 eligible paragraphs.** It has a 50% chance of being picked, so each paragraph has a **25% chance** of appearing in a draw.
- **Note B has 20 eligible paragraphs.** It also has a 50% chance of being picked, so each paragraph has a **2.5% chance** of appearing in a draw.

This gives each note equal odds, regardless of length. Individual paragraphs in notes with fewer eligible paragraphs are therefore more likely to appear. The plugin does not choose from one combined pool of every paragraph in your vault.

If the chosen note has no eligible passages, it opens the note with an explanation instead.

## Privacy

- Your note text, titles, folder names, and tags stay on your device. There is no tracking or advertising.
- When atmospheric randomness is enabled, the plugin contacts RANDOM.ORG when you draw. The service receives your API key, the number range needed for the selection, and your IP address. That range can reveal how many notes or paragraphs are being considered.
- Your API key is stored **unencrypted** in the plugin’s settings file, `data.json`, which may be included in vault sync or backups. Keep that file private.
- Offline draws do not contact RANDOM.ORG.

## Installation

See the [Obsidian Community listing](https://community.obsidian.md/plugins/bibliomancy-atmospheric-noise). If **Add to Obsidian** is available, use it to install the plugin, then enable it under Community plugins.

To install manually:

1. Download the ZIP from the [latest release](https://github.com/Coherence-Wizard/obsidian-bibliomancy/releases/latest).
2. Extract it and copy the `bibliomancy-atmospheric-noise` folder into your vault’s `.obsidian/plugins/` folder.
3. Restart Obsidian and enable the plugin under **Settings → Community plugins**.

Requires Obsidian 1.0.0 or later.

## Support

[Buy Me A Coffee](https://www.buymeacoffee.com/rastovich)

## License

[MIT](LICENSE)
