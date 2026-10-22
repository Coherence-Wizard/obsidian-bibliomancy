const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');

async function setup(options = {}) {
    const notices = [];
    const calls = [];
    const opened = [];
    const files = options.files || [{ path: 'first.md', basename: 'first' }, { path: 'folder/second.md', basename: 'second' }];
    class Notice { constructor(text, duration) { this.text = text; this.duration = duration; notices.push(this); } hide() { this.hidden = true; } }
    class Plugin {
        async loadData() { return options.settings || null; }
        async saveData(data) { this.saved = data; }
        addRibbonIcon() {} addCommand() {} registerEvent() {} addSettingTab() {}
    }
    const obsidian = { Plugin, PluginSettingTab: class {}, Setting: class {}, TFolder: class {}, TFile: class {}, Modal: class {}, MarkdownView: class {}, Notice, getAllTags: cache => cache.tags,
        requestUrl: async request => { calls.push(request); return options.response ? options.response(request) : { status: 200, json: { jsonrpc: '2.0', id: JSON.parse(request.body).id, result: { random: { data: [0] }, advisoryDelay: 0 } } }; } };
    const context = { module: { exports: {} }, require: name => { assert.equal(name, 'obsidian'); return obsidian; }, window: { setTimeout, clearTimeout }, Date, Math, Set, Map };
    vm.runInNewContext(source, context);
    const Ctor = context.module.exports.default || context.module.exports;
    const plugin = new Ctor();
    plugin.app = { vault: { getMarkdownFiles: () => files, cachedRead: async () => {
        if (options.readError) throw new Error('read failed');
        return options.content ?? 'A sample paragraph long enough to draw.\n\nAnother sample paragraph long enough to draw.';
    } }, metadataCache: { getFileCache: file => ({ tags: file.tags || [] }) }, workspace: { on() {}, getLeaf: () => ({ openFile: async file => opened.push(file) }) } };
    await plugin.onload();
    plugin.showPassage = (...args) => { plugin.passage = args; };
    return { plugin, notices, calls, opened };
}

test('defaults require atmospheric randomness and do not silently fall back', async () => {
    const { plugin, notices, calls } = await setup();
    assert.equal(plugin.settings.useRandomOrg, true);
    assert.equal(plugin.settings.fallbackToPseudo, false);
    let ran = false;
    await plugin.runAction(async () => { ran = true; });
    assert.equal(ran, false); assert.equal(calls.length, 0);
    assert.match(notices[0].text, /API key/);
});
test('folder filters respect root, recursive scope, boundaries and case', async () => {
    const { plugin } = await setup({ files: ['root.md', 'a/one.md', 'a/sub/two.md', 'ab/no.md', 'A/no.md'].map(path => ({ path })) });
    plugin.settings.foldersFilter = 'a';
    assert.equal(plugin.getEligibleFiles().length, 2);
    plugin.settings.recursiveFolderSearch = false;
    assert.equal(plugin.getEligibleFiles().length, 1);
    assert.equal(plugin.getEligibleFiles('/').length, 5);
    plugin.settings.foldersFilter = '/';
    assert.equal(plugin.getEligibleFiles().length, 1);
});
test('tag filtering is applied alongside folders', async () => {
    const { plugin } = await setup({ files: [{ path: 'a/one.md', tags: ['#Idea'] }, { path: 'a/two.md', tags: ['#other'] }, { path: 'b/three.md', tags: ['#idea'] }] });
    plugin.settings.foldersFilter = 'a'; plugin.settings.tagsFilter = '#idea';
    assert.equal(plugin.getEligibleFiles().length, 1);
});
test('local mode makes no requests; single-choice draws need no request', async () => {
    const { plugin, calls } = await setup({ settings: { useRandomOrg: false } });
    for (let i = 0; i < 30; i++) assert.ok((await plugin.getRandomIndex(3, '', false)) <= 3);
    assert.equal(await plugin.getRandomIndex(0, '', false), 0);
    assert.equal(calls.length, 0);
});
test('network payload contains only API key and numeric selection parameters', async () => {
    const { plugin, calls } = await setup();
    assert.equal(await plugin.getRandomIndex(5, 'test-only-key', false), 0);
    const body = JSON.parse(calls[0].body);
    assert.deepEqual(body.params, { apiKey: 'test-only-key', n: 1, min: 0, max: 5, replacement: true });
    assert.ok(plugin.nextRequestAt > Date.now());
});
test('rejects malformed and out-of-range provider responses', async () => {
    for (const value of [-1, 10, 1.5, '1', null]) {
        const { plugin } = await setup({ response: request => ({ status: 200, json: { jsonrpc: '2.0', id: JSON.parse(request.body).id, result: { random: { data: [value] }, advisoryDelay: 0 } } }) });
        await assert.rejects(plugin.getRandomIndex(3, 'test-only-key', false), /RANDOM.ORG unavailable/);
    }
});
test('handles HTTP/JSON-RPC errors without leaking provider content or keys', async () => {
    for (const response of [{ status: 429, json: {} }, { status: 200, json: { error: { message: 'sensitive test text' } } }]) {
        const { plugin, notices } = await setup({ response: () => response });
        await assert.rejects(plugin.getRandomIndex(2, 'secret-test-value', false), error => !error.message.includes('secret-test-value') && !error.message.includes('sensitive'));
        assert.equal(notices.length, 0);
    }
});
test('explicit fallback is announced', async () => {
    const { plugin, notices } = await setup({ response: () => { throw new Error('offline'); } });
    const value = await plugin.getRandomIndex(3, 'test-only-key', true);
    assert.ok(value >= 0 && value <= 3); assert.match(notices[0].text, /local pseudo-randomness/);
});
test('loading notices are dismissed on success and read failure', async () => {
    for (const readError of [false, true]) {
        const { plugin, notices } = await setup({ readError, settings: { useRandomOrg: false } });
        await plugin.runAction(() => plugin.performBibliomancy());
        assert.ok(notices.filter(n => n.duration === 0).every(n => n.hidden));
        assert.equal(plugin.notices.size, 0); assert.equal(plugin.busy, false);
        if (!readError) assert.ok(plugin.passage);
    }
});
test('only one action runs at a time and unload cancels pending provider delay', async () => {
    const { plugin } = await setup({ settings: { useRandomOrg: false } });
    let release; let second = false;
    const first = plugin.runAction(() => new Promise(resolve => { release = resolve; }));
    await plugin.runAction(async () => { second = true; });
    assert.equal(second, false); release(); await first;
    plugin.nextRequestAt = Date.now() + 10000;
    const pending = plugin.waitForProvider();
    plugin.onunload();
    await assert.rejects(pending, /unloaded/); assert.equal(plugin.waiters.size, 0);
});
test('extracts prose without YAML, fences, headings, comments or indented code', async () => {
    const { extractPassages } = await import('../src/core.mjs');
    const content = '---\r\nprivate: hidden\r\n---\r\n# Heading\r\nA useful paragraph remains.\r\n\r\n```js\r\ncode text\r\n\r\nstill code\r\n```\r\n\r\n<!-- hidden\r\nmore hidden -->\r\n%% secret %%\r\n    indented code\r\n\r\nSecond useful paragraph remains.';
    assert.deepEqual(extractPassages(content, 10, 500).map(p => p.text), ['A useful paragraph remains.', 'Second useful paragraph remains.']);
    assert.deepEqual(extractPassages('---\nprivate: never closed', 1, 50), []);
    assert.deepEqual(extractPassages('Short\n\n# Heading', 20, 500), []);
});
test('truncation keeps raw source for navigation and sanitizes corrupt settings', async () => {
    const { extractPassages, normalizeSettings } = await import('../src/core.mjs');
    const text = 'A long enough paragraph to test truncation without losing the original text.';
    const [result] = extractPassages(text, 1, 20);
    assert.equal(result.rawText, text); assert.ok(result.text.length <= 21);
    const defaults = { apiKey: '', minPassageLength: 20, maxPassageLength: 500, useRandomOrg: true };
    const settings = normalizeSettings({ apiKey: 3, minPassageLength: -5, maxPassageLength: Infinity, privateField: 'drop' }, defaults);
    assert.deepEqual(settings, { apiKey: '', minPassageLength: 1, maxPassageLength: 500, useRandomOrg: true });
});
