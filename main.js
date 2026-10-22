/* Bibliomancy (Atmospheric Noise) | MIT License | Source: src/ */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.mjs
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/core.mjs
function normalizeSettings(value, defaults) {
  const input = value && typeof value === "object" ? value : {};
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (typeof input[key] === typeof defaults[key]) result[key] = input[key];
  }
  for (const key of ["minPassageLength", "maxPassageLength"]) {
    if (!Number.isFinite(result[key])) result[key] = defaults[key];
    result[key] = Math.max(1, Math.min(1e5, Math.floor(result[key])));
  }
  result.apiKey = result.apiKey.trim();
  return result;
}
function matchesFolder(path, folder, recursive) {
  const normalized = folder.replace(/^\/+|\/+$/g, "");
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return recursive ? normalized === "" || path.startsWith(normalized + "/") : parent === normalized;
}
function extractPassages(content, minimum, maximum) {
  const lines = content.match(/[^\n]*\n|[^\n]+$/g) || [];
  const passages = [];
  let buffer = "";
  let frontmatter = /^\uFEFF?---\s*$/.test((lines[0] || "").trim());
  let fence = null;
  let comment = null;
  const flush = () => {
    const rawText = buffer.trim();
    buffer = "";
    if (rawText.length < minimum) return;
    let text = rawText;
    if (text.length > maximum) {
      text = text.slice(0, maximum);
      const space = text.lastIndexOf(" ");
      if (space > maximum * 0.8) text = text.slice(0, space);
      text += "\u2026";
    }
    passages.push({ text, rawText });
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (frontmatter) {
      if (i > 0 && /^(---|\.\.\.)$/.test(trimmed)) frontmatter = false;
      continue;
    }
    if (comment) {
      if (line.includes(comment)) comment = null;
      flush();
      continue;
    }
    if (fence) {
      if (new RegExp("^ {0,3}" + fence.char + "{" + fence.length + ",}\\s*$").test(line)) fence = null;
      continue;
    }
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      flush();
      fence = { char: marker[1][0], length: marker[1].length };
      continue;
    }
    const htmlStart = line.indexOf("<!--");
    const obsidianStart = line.indexOf("%%");
    if (htmlStart !== -1 || obsidianStart !== -1) {
      if (htmlStart !== -1 && line.indexOf("-->", htmlStart + 4) === -1) comment = "-->";
      else if (obsidianStart !== -1 && line.indexOf("%%", obsidianStart + 2) === -1) comment = "%%";
      flush();
      continue;
    }
    if (!trimmed || /^ {0,3}#{1,6}(\s|$)/.test(line) || /^(?:[-*_]\s*){3,}$/.test(trimmed) || /^(?:=+|-+)\s*$/.test(trimmed) || /^(?:#[\w/-]+\s*)+$/.test(trimmed) || /^(?: {4}|\t)/.test(line)) {
      if (/^(?:=+|-+)\s*$/.test(trimmed) && buffer.trim().split(/\r?\n/).length === 1) buffer = "";
      flush();
      continue;
    }
    buffer += line;
  }
  flush();
  return passages;
}

// src/main.mjs
var DEFAULT_SETTINGS = {
  apiKey: "",
  useRandomOrg: true,
  foldersFilter: "",
  tagsFilter: "",
  recursiveFolderSearch: true,
  fallbackToPseudo: false,
  minPassageLength: 20,
  maxPassageLength: 500
};
var BibliomancyModal = class extends import_obsidian.Modal {
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
    contentEl.addClass("bibliomancy-content");
    const titleEl = contentEl.createEl("h2", { text: "Bibliomancy passage" });
    titleEl.addClass("bibliomancy-titleel");
    const sourceEl = contentEl.createEl("div");
    sourceEl.addClass("bibliomancy-sourceel");
    sourceEl.createEl("span", { text: "From note: " });
    const linkEl = sourceEl.createEl("a", { text: this.file.basename, href: "#" });
    linkEl.addClass("bibliomancy-linkel");
    linkEl.addEventListener("click", (e) => {
      e.preventDefault();
      void this.app.workspace.getLeaf(false).openFile(this.file).catch(() => new import_obsidian.Notice("Unable to open the source note."));
      this.close();
    });
    const quoteContainer = contentEl.createEl("div");
    quoteContainer.addClass("bibliomancy-quotecontainer");
    const quoteText = quoteContainer.createEl("p", { text: `\u201C${this.passage}\u201D` });
    quoteText.addClass("bibliomancy-quotetext");
    const buttonContainer = contentEl.createEl("div");
    buttonContainer.addClass("bibliomancy-buttoncontainer");
    const goToBtn = buttonContainer.createEl("button", { text: "Go to passage" });
    goToBtn.addClass("bibliomancy-gotobtn");
    goToBtn.classList.add("mod-cta");
    goToBtn.addEventListener("click", async () => {
      const leaf = this.app.workspace.getLeaf(false);
      try {
        await leaf.openFile(this.file);
      } catch (e) {
        new import_obsidian.Notice("Unable to open the source note.");
        return;
      }
      const activeView = leaf.view instanceof import_obsidian.MarkdownView ? leaf.view : null;
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
    const openBtn = buttonContainer.createEl("button", { text: "Open note" });
    openBtn.addClass("bibliomancy-openbtn");
    openBtn.addEventListener("click", () => {
      void this.app.workspace.getLeaf(false).openFile(this.file).catch(() => new import_obsidian.Notice("Unable to open the source note."));
      this.close();
    });
    if (this.onDrawAgain) {
      const drawAgainBtn = buttonContainer.createEl("button", { text: "Draw another" });
      drawAgainBtn.addClass("bibliomancy-drawagainbtn");
      drawAgainBtn.addEventListener("click", () => {
        this.close();
        this.onDrawAgain();
      });
    }
    const closeBtn = buttonContainer.createEl("button", { text: "Close" });
    closeBtn.addClass("bibliomancy-closebtn");
    closeBtn.addEventListener("click", () => {
      this.close();
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
var BibliomancyPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.active = true;
    this.busy = false;
    this.nextRequestAt = 0;
    this.requestId = 0;
    this.modals = /* @__PURE__ */ new Set();
    this.notices = /* @__PURE__ */ new Set();
    this.waiters = /* @__PURE__ */ new Map();
    this.addRibbonIcon("dice", "Draw a Bibliomancy passage", () => {
      this.runAction(() => this.performBibliomancy());
    });
    this.addCommand({
      id: "draw-passage",
      name: "Draw random passage",
      callback: () => this.runAction(() => this.performBibliomancy())
    });
    this.addCommand({
      id: "open-random-note",
      name: "Open random note",
      callback: () => this.runAction(() => this.openRandomNote())
    });
    this.addCommand({
      id: "draw-passage-current-folder",
      name: "Draw passage from current folder",
      callback: () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.parent) {
          this.runAction(() => this.performBibliomancy(activeFile.parent.path));
        } else {
          new import_obsidian.Notice("No active file folder found. Searching all folders.");
          this.runAction(() => this.performBibliomancy());
        }
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, fileOrFolder) => {
        if (fileOrFolder instanceof import_obsidian.TFolder) {
          menu.addItem((item) => {
            item.setTitle("Draw passage from folder").setIcon("dice").onClick(() => {
              this.runAction(() => this.performBibliomancy(fileOrFolder.path));
            });
          });
          menu.addItem((item) => {
            item.setTitle("Open random note from folder").setIcon("document").onClick(() => {
              this.runAction(() => this.openRandomNote(fileOrFolder.path));
            });
          });
        } else if (fileOrFolder instanceof import_obsidian.TFile && fileOrFolder.extension === "md") {
          menu.addItem((item) => {
            item.setTitle("Draw passage from this note").setIcon("dice").onClick(() => {
              this.runAction(() => this.performBibliomancyOnSingleFile(fileOrFolder));
            });
          });
        }
      })
    );
    this.addSettingTab(new BibliomancySettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = normalizeSettings(await this.loadData(), DEFAULT_SETTINGS);
  }
  async runAction(action) {
    if (!this.active || this.busy) return;
    if (this.settings.useRandomOrg && !this.settings.apiKey && !this.settings.fallbackToPseudo) {
      new import_obsidian.Notice("Add your own RANDOM.ORG API key in Bibliomancy settings before drawing.");
      return;
    }
    this.busy = true;
    try {
      await action();
    } catch (e) {
      if (this.active) new import_obsidian.Notice("Unable to complete the draw. Please try again.");
    } finally {
      this.busy = false;
    }
  }
  onunload() {
    this.active = false;
    for (const modal of this.modals) modal.close();
    for (const notice of this.notices) notice.hide();
    for (const [timer, resolve] of this.waiters) {
      window.clearTimeout(timer);
      resolve();
    }
    this.waiters.clear();
  }
  showPassage(...args) {
    if (!this.active) return;
    const modal = new BibliomancyModal(this.app, ...args);
    const close = modal.onClose.bind(modal);
    modal.onClose = () => {
      close();
      this.modals.delete(modal);
    };
    this.modals.add(modal);
    modal.open();
  }
  async waitForProvider() {
    const delay = Math.max(0, this.nextRequestAt - Date.now());
    if (delay) await new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.waiters.delete(timer);
        resolve();
      }, delay);
      this.waiters.set(timer, resolve);
    });
    if (!this.active) throw new Error("Plugin unloaded.");
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
    const parsedTags = this.settings.tagsFilter.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter((t) => t.length > 0);
    let folders = [];
    let isRecursive = this.settings.recursiveFolderSearch;
    if (overrideFolder !== void 0) {
      folders = [overrideFolder];
      isRecursive = true;
    } else {
      folders = this.settings.foldersFilter.split(",").map((f) => f.trim().replace(/^\/+|\/+$/g, "")).filter((f) => f.length > 0 || this.settings.foldersFilter.trim() === "/");
    }
    return files.filter((file) => {
      if (folders.length > 0) {
        const matchesAnyFolder = folders.some((folder) => {
          return matchesFolder(file.path, folder, isRecursive);
        });
        if (!matchesAnyFolder) return false;
      }
      if (parsedTags.length > 0) {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return false;
        const tags = (0, import_obsidian.getAllTags)(cache) || [];
        const fileTags = tags.map((t) => t.replace(/^#/, "").toLowerCase());
        const matchesTag = parsedTags.some((tag) => fileTags.includes(tag));
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
    var _a, _b;
    if (!Number.isSafeInteger(maxVal) || maxVal < 0 || maxVal > 1e9) {
      throw new Error("Invalid random selection range.");
    }
    if (maxVal === 0) return 0;
    if (!this.settings.useRandomOrg) return Math.floor(Math.random() * (maxVal + 1));
    try {
      if (!apiKey.trim()) throw new Error("Add your own RANDOM.ORG API key in settings.");
      await this.waitForProvider();
      const id = ++this.requestId;
      const response = await (0, import_obsidian.requestUrl)({
        url: "https://api.random.org/json-rpc/4/invoke",
        method: "POST",
        contentType: "application/json",
        throw: false,
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "generateIntegers",
          params: { apiKey: apiKey.trim(), n: 1, min: 0, max: maxVal, replacement: true },
          id
        })
      });
      if (!this.active) throw new Error("Plugin unloaded.");
      const data = response.json;
      if (response.status !== 200 || (data == null ? void 0 : data.error) || (data == null ? void 0 : data.id) !== id || (data == null ? void 0 : data.jsonrpc) !== "2.0") {
        throw new Error("RANDOM.ORG request failed. Check your key and quota.");
      }
      const result = data.result;
      const value = (_b = (_a = result == null ? void 0 : result.random) == null ? void 0 : _a.data) == null ? void 0 : _b[0];
      if (!Number.isInteger(value) || value < 0 || value > maxVal || result.random.data.length !== 1) {
        throw new Error("RANDOM.ORG returned an invalid selection.");
      }
      const delay = result.advisoryDelay;
      if (!Number.isSafeInteger(delay) || delay < 0 || delay > 2147483647) {
        throw new Error("RANDOM.ORG returned an invalid retry delay.");
      }
      this.nextRequestAt = Date.now() + Math.max(delay, 1e3);
      return value;
    } catch (e) {
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + 1e4);
      if (!this.active) throw new Error("Plugin unloaded.");
      if (fallbackToPseudo) {
        new import_obsidian.Notice("RANDOM.ORG unavailable. This selection uses local pseudo-randomness.");
        return Math.floor(Math.random() * (maxVal + 1));
      }
      throw new Error("RANDOM.ORG unavailable. Check your API key, connection, and quota.");
    }
  }
  /**
   * Picks a random note, extracts a passage, and displays it in a beautiful modal dialog.
   */
  async performBibliomancy(overrideFolder) {
    const eligibleFiles = this.getEligibleFiles(overrideFolder);
    if (eligibleFiles.length === 0) {
      let message = "No markdown notes found matching the current settings filter.";
      if (overrideFolder !== void 0) {
        message = `No markdown notes found in folder: "${overrideFolder}".`;
      }
      new import_obsidian.Notice(message);
      return;
    }
    const loadingNotice = new import_obsidian.Notice(this.settings.useRandomOrg ? "Requesting RANDOM.ORG randomness\u2026" : "Drawing locally\u2026", 0);
    this.notices.add(loadingNotice);
    try {
      const randomNoteIndex = await this.getRandomIndex(
        eligibleFiles.length - 1,
        this.settings.apiKey,
        this.settings.fallbackToPseudo
      );
      if (!this.active) return;
      const file = eligibleFiles[randomNoteIndex];
      const paragraphs = await this.getPassageFromNote(file);
      if (!this.active) return;
      if (paragraphs.length === 0) {
        loadingNotice.hide();
        new import_obsidian.Notice(`The note "${file.basename}" has no eligible passages. Opening it directly.`);
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
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
        () => this.runAction(() => this.performBibliomancy(overrideFolder))
      );
    } catch (err) {
      loadingNotice.hide();
      if (this.active) new import_obsidian.Notice(`Bibliomancy failed: ${err.message}`);
    } finally {
      loadingNotice.hide();
      this.notices.delete(loadingNotice);
    }
  }
  /**
   * Performs bibliomancy passage drawing on a single targeted file.
   */
  async performBibliomancyOnSingleFile(file) {
    const loadingNotice = new import_obsidian.Notice("Reading passage from note\u2026", 0);
    this.notices.add(loadingNotice);
    try {
      const paragraphs = await this.getPassageFromNote(file);
      if (!this.active) return;
      if (paragraphs.length === 0) {
        loadingNotice.hide();
        new import_obsidian.Notice(`The note "${file.basename}" has no eligible passages.`);
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
      if (this.active) new import_obsidian.Notice(`Bibliomancy failed: ${err.message}`);
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
      let message = "No markdown notes found matching the current settings filter.";
      if (overrideFolder !== void 0) {
        message = `No markdown notes found in folder: "${overrideFolder}".`;
      }
      new import_obsidian.Notice(message);
      return;
    }
    if (eligibleFiles.length === 1) {
      const file = eligibleFiles[0];
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
      new import_obsidian.Notice(`Only one eligible note found. Opened: "${file.basename}"`);
      return;
    }
    const loadingNotice = new import_obsidian.Notice(this.settings.useRandomOrg ? "Requesting RANDOM.ORG randomness\u2026" : "Drawing locally\u2026", 0);
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
        new import_obsidian.Notice(`Opened random note: "${file.basename}"`);
      }
    } catch (err) {
      loadingNotice.hide();
      if (this.active) new import_obsidian.Notice(`Failed to open random note: ${err.message}`);
    } finally {
      loadingNotice.hide();
      this.notices.delete(loadingNotice);
    }
  }
};
var BibliomancySettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Use RANDOM.ORG").setDesc("Use atmospheric randomness with your own API key (recommended). Sends only the key and numeric selection range to RANDOM.ORG; your IP is visible to the service. Notes stay on your device.").addToggle((toggle) => toggle.setValue(this.plugin.settings.useRandomOrg).onChange(async (value) => {
      this.plugin.settings.useRandomOrg = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("p", { text: "Offline mode needs no account. API keys are stored unencrypted in this plugin\u2019s data.json and may be included in vault backups or sync. Do not share that file." });
    containerEl.createEl("a", { text: "Get your own RANDOM.ORG API key", href: "https://api.random.org/api-keys", attr: { target: "_blank", rel: "noopener noreferrer" } });
    new import_obsidian.Setting(containerEl).setName("Set up atmospheric randomness").setDesc("Follow these steps once to connect your own account.");
    const steps = containerEl.createEl("ol");
    steps.createEl("li", { text: "Open the API key link above, then follow the API dashboard link on that page." });
    steps.createEl("li", { text: "Sign in to RANDOM.ORG, or create an account and complete any verification requested by the service." });
    steps.createEl("li", { text: "In the dashboard, create a new API key for this app. Choose the license that fits your use and review its current limits and any charges before confirming." });
    steps.createEl("li", { text: "Copy the API key itself (the UUID), not its hashed value. Make sure its state is running." });
    steps.createEl("li", { text: "Return here and paste the key into the field below. It saves automatically." });
    steps.createEl("li", { text: "Keep atmospheric randomness enabled and local fallback disabled. Use the dice button or the draw-passage command to try it." });
    containerEl.createEl("p", { text: "If a draw fails, check that the key is correct and running, your internet connection works, and your account has quota remaining. Manage or stop the key in the API dashboard." });
    new import_obsidian.Setting(containerEl).setName("RANDOM.ORG API key").setDesc("Required only when RANDOM.ORG is enabled. No shared developer key is included.").addText((text) => {
      text.inputEl.type = "password";
      text.inputEl.autocomplete = "off";
      return text.setPlaceholder("Enter your API key").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Filter folders").setDesc('Optional: Comma-separated list of folders to search for random notes (e.g. "work, archive/journals"). If blank, all folders are searched.').addText((text) => text.setPlaceholder("Work, archive").setValue(this.plugin.settings.foldersFilter).onChange(async (value) => {
      this.plugin.settings.foldersFilter = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Filter tags").setDesc('Optional: Comma-separated list of tags notes must contain (e.g. "#idea, #todo"). If blank, no tag restriction is applied.').addText((text) => text.setPlaceholder("Idea, todo").setValue(this.plugin.settings.tagsFilter).onChange(async (value) => {
      this.plugin.settings.tagsFilter = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Include subfolders").setDesc("If enabled, searching in a folder will include notes in its subfolders.").addToggle((toggle) => toggle.setValue(this.plugin.settings.recursiveFolderSearch).onChange(async (value) => {
      this.plugin.settings.recursiveFolderSearch = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Allow local fallback").setDesc("If enabled, falls back to Math.random() if random.org is unreachable or rate-limited. If disabled, an error notification is shown.").addToggle((toggle) => toggle.setValue(this.plugin.settings.fallbackToPseudo).onChange(async (value) => {
      this.plugin.settings.fallbackToPseudo = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Minimum passage length").setDesc("The minimum character length of a passage to draw. Shorter paragraphs will be filtered out.").addText((text) => text.setPlaceholder("20").setValue(String(this.plugin.settings.minPassageLength)).onChange(async (value) => {
      if (!/^\d+$/.test(value)) return;
      const num = Number(value);
      this.plugin.settings.minPassageLength = Number.isFinite(num) ? Math.max(1, Math.min(1e5, num)) : 20;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Maximum passage length").setDesc("The maximum character length of a passage to show. Longer passages are truncated at word boundaries.").addText((text) => text.setPlaceholder("500").setValue(String(this.plugin.settings.maxPassageLength)).onChange(async (value) => {
      if (!/^\d+$/.test(value)) return;
      const num = Number(value);
      this.plugin.settings.maxPassageLength = Number.isFinite(num) ? Math.max(1, Math.min(1e5, num)) : 500;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Support development").setDesc("If Bibliomancy is useful to you, you can support its development.");
    containerEl.createEl("a", {
      text: "Buy me a coffee",
      href: "https://www.buymeacoffee.com/rastovich",
      attr: { target: "_blank", rel: "noopener noreferrer" }
    });
  }
};
var main_default = BibliomancyPlugin;
