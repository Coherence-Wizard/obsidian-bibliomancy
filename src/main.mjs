import { Plugin, PluginSettingTab, Setting, TFolder, TFile, Notice, Modal, requestUrl, getAllTags, MarkdownView } from 'obsidian';

import { extractPassages, normalizeSettings, matchesFolder } from './core.mjs';

const DEFAULT_SETTINGS = {
    apiKey: '',
    useRandomOrg: true,
    foldersFilter: '',
    tagsFilter: '',
    recursiveFolderSearch: true,
    fallbackToPseudo: false,
    minPassageLength: 20,
    maxPassageLength: 500
};

class BibliomancyModal extends Modal {
    constructor(app, passage, rawPassage, file, onDrawAgain) {
        super(app);
        this.passage = passage;
        this.rawPassage = rawPassage;
        this.file = file;
        this.onDrawAgain = onDrawAgain;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('bibliomancy-content');
        
        
        // Title/Header
        const titleEl = contentEl.createEl('h2', { text: 'Bibliomancy passage' });
        titleEl.addClass('bibliomancy-titleel');

        // Source Note Link
        const sourceEl = contentEl.createEl('div');
        sourceEl.addClass('bibliomancy-sourceel');

        sourceEl.createEl('span', { text: 'From note: ' });
        const linkEl = sourceEl.createEl('a', { text: this.file.basename, href: '#' });
        linkEl.addClass('bibliomancy-linkel');

        linkEl.addEventListener('click', (e) => {
            e.preventDefault();
            void this.app.workspace.getLeaf(false).openFile(this.file).catch(() => new Notice('Unable to open the source note.'));
            this.close();
        });

        // The passage itself (styled nicely like a quotation block)
        const quoteContainer = contentEl.createEl('div');
        quoteContainer.addClass('bibliomancy-quotecontainer');

        const quoteText = quoteContainer.createEl('p', { text: `“${this.passage}”` });
        quoteText.addClass('bibliomancy-quotetext');

        // Button container
        const buttonContainer = contentEl.createEl('div');
        buttonContainer.addClass('bibliomancy-buttoncontainer');

        // Go to passage Button (CTA)
        const goToBtn = buttonContainer.createEl('button', { text: 'Go to passage' });
        goToBtn.addClass('bibliomancy-gotobtn');
        goToBtn.classList.add('mod-cta');

        goToBtn.addEventListener('click', async () => {
            const leaf = this.app.workspace.getLeaf(false);
            try { await leaf.openFile(this.file); }
            catch { new Notice("Unable to open the source note."); return; }
            const activeView = leaf.view instanceof MarkdownView ? leaf.view : null;
            if (activeView) {
                const editor = activeView.editor;
                const docText = editor.getValue();
                const offset = docText.indexOf(this.rawPassage);
                if (offset !== -1) {
                    const startPos = editor.offsetToPos(offset);
                    const endPos = editor.offsetToPos(offset + this.rawPassage.length);
                    editor.setSelection(startPos, endPos);
                    editor.scrollIntoView({ from: startPos, to: endPos }, true);
                }
            }
            this.close();
        });

        // Open note Button
        const openBtn = buttonContainer.createEl('button', { text: 'Open note' });
        openBtn.addClass('bibliomancy-openbtn');

        openBtn.addEventListener('click', () => {
            void this.app.workspace.getLeaf(false).openFile(this.file).catch(() => new Notice('Unable to open the source note.'));
            this.close();
        });

        // Draw Again Button (performs bibliomancy again)
        if (this.onDrawAgain) {
            const drawAgainBtn = buttonContainer.createEl('button', { text: 'Draw another' });
            drawAgainBtn.addClass('bibliomancy-drawagainbtn');

            drawAgainBtn.addEventListener('click', () => {
                this.close();
                this.onDrawAgain();
            });
        }

        // Close Button
        const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
        closeBtn.addClass('bibliomancy-closebtn');

        closeBtn.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class BibliomancyPlugin extends Plugin {
    async onload() {
        await this.loadSettings();
        this.active = true;
        this.busy = false;
        this.nextRequestAt = 0;
        this.requestId = 0;
        this.modals = new Set();
        this.notices = new Set();
        this.waiters = new Map();

        // 1. Add Ribbon Icon (dice) to perform Bibliomancy
        this.addRibbonIcon('dice', 'Draw a Bibliomancy passage', () => {
            this.runAction(() => this.performBibliomancy());
        });

        // 2. Add Commands
        this.addCommand({
            id: 'draw-passage',
            name: 'Draw random passage',
            callback: () => this.runAction(() => this.performBibliomancy())
        });

        this.addCommand({
            id: 'open-random-note',
            name: 'Open random note',
            callback: () => this.runAction(() => this.openRandomNote())
        });

        this.addCommand({
            id: 'draw-passage-current-folder',
            name: 'Draw passage from current folder',
            callback: () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile && activeFile.parent) {
                    this.runAction(() => this.performBibliomancy(activeFile.parent.path));
                } else {
                    new Notice('No active file folder found. Searching all folders.');
                    this.runAction(() => this.performBibliomancy());
                }
            }
        });

        // 3. Register Context Menu for folders
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, fileOrFolder) => {
                if (fileOrFolder instanceof TFolder) {
                    menu.addItem((item) => {
                        item
                            .setTitle('Draw passage from folder')
                            .setIcon('dice')
                            .onClick(() => {
                                this.runAction(() => this.performBibliomancy(fileOrFolder.path));
                            });
                    });
                    
                    menu.addItem((item) => {
                        item
                            .setTitle('Open random note from folder')
                            .setIcon('document')
                            .onClick(() => {
                                this.runAction(() => this.openRandomNote(fileOrFolder.path));
                            });
                    });
                } else if (fileOrFolder instanceof TFile && fileOrFolder.extension === 'md') {
                    menu.addItem((item) => {
                        item
                            .setTitle('Draw passage from this note')
                            .setIcon('dice')
                            .onClick(() => {
                                this.runAction(() => this.performBibliomancyOnSingleFile(fileOrFolder));
                            });
                    });
                }
            })
        );

        // 4. Add Settings Tab
        this.addSettingTab(new BibliomancySettingTab(this.app, this));
    }

    async loadSettings() {
        this.settings = normalizeSettings(await this.loadData(), DEFAULT_SETTINGS);
    }

    async runAction(action) {
        if (!this.active || this.busy) return;
        if (this.settings.useRandomOrg && !this.settings.apiKey && !this.settings.fallbackToPseudo) {
            new Notice('Add your own RANDOM.ORG API key in Bibliomancy settings before drawing.');
            return;
        }
        this.busy = true;
        try { await action(); }
        catch { if (this.active) new Notice('Unable to complete the draw. Please try again.'); }
        finally { this.busy = false; }
    }

    onunload() {
        this.active = false;
        for (const modal of this.modals) modal.close();
        for (const notice of this.notices) notice.hide();
        for (const [timer, resolve] of this.waiters) { window.clearTimeout(timer); resolve(); }
        this.waiters.clear();
    }

    showPassage(...args) {
        if (!this.active) return;
        const modal = new BibliomancyModal(this.app, ...args);
        const close = modal.onClose.bind(modal);
        modal.onClose = () => { close(); this.modals.delete(modal); };
        this.modals.add(modal);
        modal.open();
    }

    async waitForProvider() {
        const delay = Math.max(0, this.nextRequestAt - Date.now());
        if (delay) await new Promise(resolve => {
            const timer = window.setTimeout(() => { this.waiters.delete(timer); resolve(); }, delay);
            this.waiters.set(timer, resolve);
        });
        if (!this.active) throw new Error('Plugin unloaded.');
    }

    async saveSettings() {
        this.settings = normalizeSettings(this.settings, DEFAULT_SETTINGS);
        await this.saveData(this.settings);
    }

    /**
     * Filters notes based on folders and/or tags.
     * If overrideFolder is provided, folder filtering is restricted to that folder recursively.
     */
    getEligibleFiles(overrideFolder) {
        const files = this.app.vault.getMarkdownFiles();

        // Parse tags filter
        const parsedTags = this.settings.tagsFilter
            .split(',')
            .map(t => t.trim().replace(/^#/, '').toLowerCase())
            .filter(t => t.length > 0);

        // Determine target folders
        let folders = [];
        let isRecursive = this.settings.recursiveFolderSearch;

        if (overrideFolder !== undefined) {
            folders = [overrideFolder];
            isRecursive = true; // Context menu action is always recursive for the targeted folder
        } else {
            folders = this.settings.foldersFilter
                .split(',')
                .map(f => f.trim().replace(/^\/+|\/+$/g, ''))
                .filter(f => f.length > 0 || this.settings.foldersFilter.trim() === "/");
        }

        return files.filter(file => {
            // 1. Folder filtering
            if (folders.length > 0) {
                const matchesAnyFolder = folders.some(folder => {
                    return matchesFolder(file.path, folder, isRecursive);
                });
                if (!matchesAnyFolder) return false;
            }

            // 2. Tag filtering
            if (parsedTags.length > 0) {
                const cache = this.app.metadataCache.getFileCache(file);
                if (!cache) return false;
                
                const tags = getAllTags(cache) || [];
                const fileTags = tags.map(t => t.replace(/^#/, '').toLowerCase());
                
                const matchesTag = parsedTags.some(tag => fileTags.includes(tag));
                if (!matchesTag) return false;
            }

            return true;
        });
    }

    /**
     * Extracts non-empty paragraphs from a note, filtering headers and horizontal rules.
     */
    async getPassageFromNote(file) {
        const content = await this.app.vault.cachedRead(file);
        return extractPassages(content, this.settings.minPassageLength, this.settings.maxPassageLength);
    }

    /** No note contents, paths, tags, or questions are sent to the provider. */
    async getRandomIndex(maxVal, apiKey, fallbackToPseudo) {
        if (!Number.isSafeInteger(maxVal) || maxVal < 0 || maxVal > 1000000000) {
            throw new Error('Invalid random selection range.');
        }
        if (maxVal === 0) return 0;
        if (!this.settings.useRandomOrg) return Math.floor(Math.random() * (maxVal + 1));
        try {
            if (!apiKey.trim()) throw new Error('Add your own RANDOM.ORG API key in settings.');
            await this.waitForProvider();
            const id = ++this.requestId;
            const response = await requestUrl({
                url: 'https://api.random.org/json-rpc/4/invoke',
                method: 'POST',
                contentType: 'application/json',
                throw: false,
                body: JSON.stringify({
                    jsonrpc: '2.0', method: 'generateIntegers',
                    params: { apiKey: apiKey.trim(), n: 1, min: 0, max: maxVal, replacement: true }, id
                })
            });
            if (!this.active) throw new Error('Plugin unloaded.');
            const data = response.json;
            if (response.status !== 200 || data?.error || data?.id !== id || data?.jsonrpc !== '2.0') {
                throw new Error('RANDOM.ORG request failed. Check your key and quota.');
            }
            const result = data.result;
            const value = result?.random?.data?.[0];
            if (!Number.isInteger(value) || value < 0 || value > maxVal || result.random.data.length !== 1) {
                throw new Error('RANDOM.ORG returned an invalid selection.');
            }
            const delay = result.advisoryDelay;
            if (!Number.isSafeInteger(delay) || delay < 0 || delay > 2147483647) {
                throw new Error('RANDOM.ORG returned an invalid retry delay.');
            }
            this.nextRequestAt = Date.now() + Math.max(delay, 1000);
            return value;
        } catch {
            // Never log request objects: they may contain the user's API key.
            this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + 10000);
            if (!this.active) throw new Error('Plugin unloaded.');
            if (fallbackToPseudo) {
                new Notice('RANDOM.ORG unavailable. This selection uses local pseudo-randomness.');
                return Math.floor(Math.random() * (maxVal + 1));
            }
            throw new Error('RANDOM.ORG unavailable. Check your API key, connection, and quota.');
        }
    }

    /**
     * Picks a random note, extracts a passage, and displays it in a beautiful modal dialog.
     */
    async performBibliomancy(overrideFolder) {
        const eligibleFiles = this.getEligibleFiles(overrideFolder);
        if (eligibleFiles.length === 0) {
            let message = 'No markdown notes found matching the current settings filter.';
            if (overrideFolder !== undefined) {
                message = `No markdown notes found in folder: "${overrideFolder}".`;
            }
            new Notice(message);
            return;
        }

        const loadingNotice = new Notice(this.settings.useRandomOrg ? 'Requesting RANDOM.ORG randomness…' : 'Drawing locally…', 0);
        this.notices.add(loadingNotice);
        try {
            // 1. Pick a random note
            const randomNoteIndex = await this.getRandomIndex(
                eligibleFiles.length - 1,
                this.settings.apiKey,
                this.settings.fallbackToPseudo
            );
            if (!this.active) return;
            const file = eligibleFiles[randomNoteIndex];
            
            // 2. Extract paragraphs
            const paragraphs = await this.getPassageFromNote(file);
            if (!this.active) return;
            if (paragraphs.length === 0) {
                loadingNotice.hide();
                new Notice(`The note "${file.basename}" has no eligible passages. Opening it directly.`);
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
                return;
            }

            // 3. Pick a random paragraph
            const randomParagraphIndex = await this.getRandomIndex(
                paragraphs.length - 1,
                this.settings.apiKey,
                this.settings.fallbackToPseudo
            );
            const passageObj = paragraphs[randomParagraphIndex];

            // 4. Open the Bibliomancy Modal
            this.showPassage(
                passageObj.text, 
                passageObj.rawText,
                file, 
                () => this.runAction(() => this.performBibliomancy(overrideFolder))
            );
        } catch (err) {
            loadingNotice.hide();
            if (this.active) new Notice(`Bibliomancy failed: ${err.message}`);
        } finally {
            loadingNotice.hide();
            this.notices.delete(loadingNotice);
        }
    }

    /**
     * Performs bibliomancy passage drawing on a single targeted file.
     */
    async performBibliomancyOnSingleFile(file) {
        const loadingNotice = new Notice('Reading passage from note…', 0);
        this.notices.add(loadingNotice);
        try {
            const paragraphs = await this.getPassageFromNote(file);
            if (!this.active) return;
            if (paragraphs.length === 0) {
                loadingNotice.hide();
                new Notice(`The note "${file.basename}" has no eligible passages.`);
                return;
            }

            const randomParagraphIndex = await this.getRandomIndex(
                paragraphs.length - 1,
                this.settings.apiKey,
                this.settings.fallbackToPseudo
            );
            const passageObj = paragraphs[randomParagraphIndex];

            this.showPassage(
                passageObj.text, 
                passageObj.rawText,
                file, 
                () => this.runAction(() => this.performBibliomancyOnSingleFile(file))
            );
        } catch (err) {
            loadingNotice.hide();
            if (this.active) new Notice(`Bibliomancy failed: ${err.message}`);
        } finally {
            loadingNotice.hide();
            this.notices.delete(loadingNotice);
        }
    }

    /**
     * Entry point to filter matching notes, fetch random index, and open the note.
     */
    async openRandomNote(overrideFolder) {
        const eligibleFiles = this.getEligibleFiles(overrideFolder);
        if (eligibleFiles.length === 0) {
            let message = 'No markdown notes found matching the current settings filter.';
            if (overrideFolder !== undefined) {
                message = `No markdown notes found in folder: "${overrideFolder}".`;
            }
            new Notice(message);
            return;
        }

        if (eligibleFiles.length === 1) {
            const file = eligibleFiles[0];
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            new Notice(`Only one eligible note found. Opened: "${file.basename}"`);
            return;
        }

        const loadingNotice = new Notice(this.settings.useRandomOrg ? 'Requesting RANDOM.ORG randomness…' : 'Drawing locally…', 0);
        this.notices.add(loadingNotice);
        try {
            const randomIndex = await this.getRandomIndex(
                eligibleFiles.length - 1,
                this.settings.apiKey,
                this.settings.fallbackToPseudo
            );
            loadingNotice.hide();

            if (!this.active) return;
            const file = eligibleFiles[randomIndex];
            if (file) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
                new Notice(`Opened random note: "${file.basename}"`);
            }
        } catch (err) {
            loadingNotice.hide();
            if (this.active) new Notice(`Failed to open random note: ${err.message}`);
        } finally {
            loadingNotice.hide();
            this.notices.delete(loadingNotice);
        }
    }
}

class BibliomancySettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Use RANDOM.ORG')
            .setDesc('Use atmospheric randomness with your own API key (recommended). Sends only the key and numeric selection range to RANDOM.ORG; your IP is visible to the service. Notes stay on your device.')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.useRandomOrg).onChange(async value => {
                this.plugin.settings.useRandomOrg = value;
                await this.plugin.saveSettings();
            }));
        containerEl.createEl('p', { text: 'Offline mode needs no account. API keys are stored unencrypted in this plugin’s data.json and may be included in vault backups or sync. Do not share that file.' });
        containerEl.createEl('a', { text: 'Get your own RANDOM.ORG API key', href: 'https://api.random.org/api-keys', attr: { target: '_blank', rel: 'noopener noreferrer' } });

        new Setting(containerEl)
            .setName('RANDOM.ORG API key')
            .setDesc('Required only when RANDOM.ORG is enabled. No shared developer key is included.')
            .addText(text => {
                text.inputEl.type = 'password';
                text.inputEl.autocomplete = 'off';
                return text.setPlaceholder('Enter your API key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value.trim();
                    await this.plugin.saveSettings();
                }); });

        new Setting(containerEl)
            .setName('Filter folders')
            .setDesc('Optional: Comma-separated list of folders to search for random notes (e.g. "work, archive/journals"). If blank, all folders are searched.')
            .addText(text => text
                .setPlaceholder('Work, archive')
                .setValue(this.plugin.settings.foldersFilter)
                .onChange(async (value) => {
                    this.plugin.settings.foldersFilter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Filter tags')
            .setDesc('Optional: Comma-separated list of tags notes must contain (e.g. "#idea, #todo"). If blank, no tag restriction is applied.')
            .addText(text => text
                .setPlaceholder('Idea, todo')
                .setValue(this.plugin.settings.tagsFilter)
                .onChange(async (value) => {
                    this.plugin.settings.tagsFilter = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include subfolders')
            .setDesc('If enabled, searching in a folder will include notes in its subfolders.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.recursiveFolderSearch)
                .onChange(async (value) => {
                    this.plugin.settings.recursiveFolderSearch = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Allow local fallback')
            .setDesc('If enabled, falls back to Math.random() if random.org is unreachable or rate-limited. If disabled, an error notification is shown.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.fallbackToPseudo)
                .onChange(async (value) => {
                    this.plugin.settings.fallbackToPseudo = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Minimum passage length')
            .setDesc('The minimum character length of a passage to draw. Shorter paragraphs will be filtered out.')
            .addText(text => text
                .setPlaceholder('20')
                .setValue(String(this.plugin.settings.minPassageLength))
                .onChange(async (value) => {
                    if (!/^\d+$/.test(value)) return;
                    const num = Number(value);
                    this.plugin.settings.minPassageLength = Number.isFinite(num) ? Math.max(1, Math.min(100000, num)) : 20;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Maximum passage length')
            .setDesc('The maximum character length of a passage to show. Longer passages are truncated at word boundaries.')
            .addText(text => text
                .setPlaceholder('500')
                .setValue(String(this.plugin.settings.maxPassageLength))
                .onChange(async (value) => {
                    if (!/^\d+$/.test(value)) return;
                    const num = Number(value);
                    this.plugin.settings.maxPassageLength = Number.isFinite(num) ? Math.max(1, Math.min(100000, num)) : 500;
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
            .setName('Support development')
            .setDesc('If Bibliomancy is useful to you, you can support its development.');
        containerEl.createEl('a', {
            text: 'Buy me a coffee', href: 'https://www.buymeacoffee.com/rastovich',
            attr: { target: '_blank', rel: 'noopener noreferrer' }
        });
    }
}

export default BibliomancyPlugin;
