# Changelog

## 1.2.1

- Add a six-step RANDOM.ORG account and API-key setup guide directly in settings, including key state, license and quota checks, and troubleshooting.

## 1.2.0

First public release.

- Use each user's own RANDOM.ORG API key for atmospheric randomness by default; keep local fallback disabled unless explicitly enabled.
- Remove the obsolete keyless endpoint, validate provider responses, honor advisory delays, and back off on errors.
- Fix loading notices, duplicate concurrent draws, unload cleanup, root-folder filtering, and malformed settings.
- Exclude frontmatter, code, headings, and comments from passage selection without falling back to excluded content.
- Move styles into theme-aware CSS with wrapping controls for narrow windows.
- Correct the manifest ID and public attribution; omit local configuration and private identifiers.
- Add privacy and installation documentation, MIT license, regression tests, CI, and the Buy Me A Coffee link.
