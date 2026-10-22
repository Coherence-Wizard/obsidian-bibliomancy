# Bibliomancy (Atmospheric Noise)

Draw a random passage from your Markdown notes, or open a random note, using atmospheric randomness from [RANDOM.ORG](https://www.random.org/).

Choose a folder, filter by tags, and follow a passage back to its source.

## How passages are chosen

The plugin first picks a note at random from the notes matching your filters. Every matching note has the same chance of being picked. It then picks a paragraph at random from the eligible paragraphs in that note, giving each of those paragraphs the same chance.

For example, suppose your filters match just two notes:

- **Note A has 2 eligible paragraphs.** The note has a 50% chance of being picked, so each paragraph has a **25% chance** of appearing in a draw.
- **Note B has 20 eligible paragraphs.** This note also has a 50% chance of being picked, so each paragraph has a **2.5% chance** of appearing in a draw.

This gives each note an equal chance, regardless of its length. As a result, an individual paragraph in a note with fewer eligible paragraphs is more likely to appear than one in a note with many eligible paragraphs. The plugin does not combine all paragraphs across your vault into one pool with equal odds.

Only paragraphs that pass the passage filters are eligible. If the chosen note has none, the plugin opens the note with an explanation instead of drawing a passage.

## Setup

1. Install the plugin and enable it in Obsidian.
2. [Create your own RANDOM.ORG API key](https://api.random.org/api-keys).
3. Open **Settings → Bibliomancy (Atmospheric Noise)** and enter the key.
4. Leave **Use RANDOM.ORG** enabled. This is the default. **Allow local fallback** is disabled by default, so failed requests do not silently switch to local randomness.
5. Use the dice ribbon button or a command to draw a passage.

Each user supplies their own API key; no shared developer key is included. API allowances and any costs belong to the user's RANDOM.ORG account. See the service's current terms when obtaining a key. The plugin uses the [JSON-RPC v4 Basic API](https://api.random.org/json-rpc/4/basic), validates responses, spaces requests according to the service's advisory delay, and backs off after errors. It does not use the obsolete keyless HTTP interface.

A passage draw normally needs up to two requests: one for the note and one for the paragraph. A selection with only one candidate needs no random number. Requests run only when you trigger a draw; there is no background polling.

For optional offline use, turn off **Use RANDOM.ORG**. Offline mode uses `Math.random()`, not atmospheric noise. If you explicitly enable **Allow local fallback**, a notice identifies each selection that falls back to local randomness.

## Commands and controls

- **Draw random passage** searches the configured folders and tags.
- **Open random note** opens a matching Markdown note.
- **Draw passage from current folder** searches the active note's folder and its descendants.
- Right-click a folder to draw a passage or open a random note there.
- Right-click a Markdown note to draw from that note alone.
- In the passage dialog, choose **Go to passage**, **Open note**, or **Draw another**.

Folder filters are comma-separated and case-sensitive. A blank filter searches the whole vault; `/` selects the vault root. **Include subfolders** applies to the settings filter. Folder context actions always include descendants and keep the tag filter. Tags are comma-separated, case-insensitive, and match any exact tag. Single-note context actions ignore folder and tag filters.

Passages are plain-text paragraphs. YAML frontmatter, fenced and indented code, heading lines, horizontal rules, and comment-bearing lines are excluded. Paragraphs shorter than the minimum are excluded; long passages are shortened for display while navigation uses their full original text. The maximum controls visible text, independently of the minimum eligibility length. If the selected note has no eligible passages, it opens with an explanation; single-note draws show a notice. The plugin does not rewrite your notes.

## Privacy

- No analytics, telemetry, ads, shared credentials, or remote images.
- RANDOM.ORG receives your API key and numeric selection bounds, plus ordinary connection information such as your IP address. Selection bounds can reveal counts of matching notes or paragraphs; titles, paths, tags, questions, and note text are never sent.
- API keys are masked in settings but stored **unencrypted** in the plugin's `data.json`. That file can be included in vault sync or backups. Do not share it. The repository and release exclude it.
- Turning off RANDOM.ORG makes drawing fully local. Donation and API-registration links open only when clicked.
- No personal local paths, private email addresses, or existing vault settings are distributed. Public attribution uses the GitHub handle Coherence-Wizard. The requested donation URL is public and identifies its recipient.

## Installation from this repository

Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Coherence-Wizard/obsidian-bibliomancy/releases/latest). Create `.obsidian/plugins/bibliomancy-atmospheric-noise/` in your vault, put those three files inside it, reload Obsidian, and enable the plugin under Community plugins. Alternatively, extract the release ZIP and copy its `bibliomancy-atmospheric-noise` folder into `.obsidian/plugins/`.

Requires Obsidian 1.0.0 or later. The code uses browser-compatible and public Obsidian APIs; desktop and mobile are supported by design. See [VALIDATION.md](VALIDATION.md) for the actual test coverage and limitations.

**Upgrading from the unpublished prototype:** disable the old `obsidian-bibliomancy-atmospheric-noise` plugin first, install this version under its new ID, then re-enter your key and preferences. The ID changed to comply with Obsidian's manifest rules. Old custom hotkeys must be reassigned. Keep a backup of your old settings; do not publish them.

Publishing a GitHub release does not automatically list the plugin in Obsidian's Community directory. Directory submission is a separate step.

## Development

Use Node.js 22 or later:

```sh
npm ci
npm run lint
npm run build
npm test
```

Editable source is in `src/`. `main.js` is an unminified, reproducible bundle with no runtime dependencies other than Obsidian. Tests use synthetic notes and mocked provider responses; they never consume a real API quota. Development dependencies are not included in the plugin bundle.

To release, update `manifest.json`, `package.json`, and `versions.json` together, build and test, then create a GitHub release tagged with the exact manifest version (no `v` prefix), attaching `main.js`, `manifest.json`, and `styles.css`.

## Support

[Buy Me A Coffee](https://www.buymeacoffee.com/rastovich)

## License

[MIT](LICENSE)
