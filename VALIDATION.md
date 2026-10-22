# Validation

Validated on 2026-10-22.

- Official `eslint-plugin-obsidianmd` recommended rules: no errors or warnings on plugin source. The optional declarative-settings recommendation is disabled to preserve compatibility with Obsidian versions before 1.13.
- Build: unminified CommonJS bundle, externalizing Obsidian, no bundled Node.js dependencies or source-map paths.
- Twelve automated regression tests pass: atmospheric defaults, missing-key handling, folder and tag filters, local mode, outbound payload scope, provider response validation, HTTP/JSON-RPC errors, explicit fallback, notice cleanup, concurrent actions, unload cleanup, passage extraction, truncation, and corrupted settings.
- Dependency audit: zero known vulnerabilities at validation time. All installed dependencies are build/test tooling; the plugin has no bundled third-party runtime libraries.
- Obsidian 1.14.4 on macOS: temporarily loaded the actual bundle through the application's plugin loader with synthetic passage data and offline test settings. Verified the passage modal, four action buttons, loading-notice cleanup, masked API-key input, own-key instructions, and donation link. Verified stylesheet application through computed styles. Removed temporary registrations and UI afterward. Existing notes were not edited.
- Publication scan: no private local paths, private email addresses, developer API keys, or local `data.json` included. Git commits use the public GitHub handle and noreply email. Public GitHub and requested donation identifiers remain intentionally visible.

## Limits

RANDOM.ORG success/error responses were mocked in tests. No live API key was provided, so a real authenticated provider request has not been verified. Mobile devices and the oldest declared Obsidian version were not tested directly. Source-navigation buttons were not exercised against a real note during the synthetic UI test.

A GitHub release is not an Obsidian Community directory listing. Submit it separately using the current [Obsidian submission process](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin). Automated checks do not guarantee directory acceptance.
