import obsidian from 'eslint-plugin-obsidianmd';
import js from '@eslint/js';
import globals from 'globals';
export default [
    { ignores: ['main.js', 'node_modules/**'] },
    ...obsidian.configs.recommended,
    {
        files: ['src/**/*.mjs'],
        languageOptions: { sourceType: 'module', globals: globals.browser },
        rules: {
            ...js.configs.recommended.rules,
            'obsidianmd/ui/sentence-case': ['warn', { brands: ['RANDOM.ORG', 'Bibliomancy'] }],
            // Keep compatibility with Obsidian 1.0; the declarative settings API needs 1.13.
            'obsidianmd/settings-tab/prefer-setting-definitions': 'off'
        }
    }
];
