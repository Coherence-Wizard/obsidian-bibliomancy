/** Keep stored settings bounded and ignore unknown fields from older installations. */
function normalizeSettings(value, defaults) {
    const input = value && typeof value === 'object' ? value : {};
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
        if (typeof input[key] === typeof defaults[key]) result[key] = input[key];
    }
    for (const key of ['minPassageLength', 'maxPassageLength']) {
        if (!Number.isFinite(result[key])) result[key] = defaults[key];
        result[key] = Math.max(1, Math.min(100000, Math.floor(result[key])));
    }
    result.apiKey = result.apiKey.trim();
    return result;
}

function matchesFolder(path, folder, recursive) {
    const normalized = folder.replace(/^\/+|\/+$/g, '');
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    return recursive ? normalized === '' || path.startsWith(normalized + '/') : parent === normalized;
}

/** Extract contiguous source paragraphs; never fall back to excluded metadata or code. */
function extractPassages(content, minimum, maximum) {
    const lines = content.match(/[^\n]*\n|[^\n]+$/g) || [];
    const passages = [];
    let buffer = '';
    let frontmatter = /^\uFEFF?---\s*$/.test((lines[0] || '').trim());
    let fence = null;
    let comment = null;
    const flush = () => {
        const rawText = buffer.trim();
        buffer = '';
        if (rawText.length < minimum) return;
        let text = rawText;
        if (text.length > maximum) {
            text = text.slice(0, maximum);
            const space = text.lastIndexOf(' ');
            if (space > maximum * 0.8) text = text.slice(0, space);
            text += '…';
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
            flush(); continue;
        }
        if (fence) {
            if (new RegExp('^ {0,3}' + fence.char + '{' + fence.length + ',}\\s*$').test(line)) fence = null;
            continue;
        }
        const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (marker) { flush(); fence = { char: marker[1][0], length: marker[1].length }; continue; }
        // Skip lines containing comments entirely so hidden text cannot become a draw.
        const htmlStart = line.indexOf('<!--');
        const obsidianStart = line.indexOf('%%');
        if (htmlStart !== -1 || obsidianStart !== -1) {
            if (htmlStart !== -1 && line.indexOf('-->', htmlStart + 4) === -1) comment = '-->';
            else if (obsidianStart !== -1 && line.indexOf('%%', obsidianStart + 2) === -1) comment = '%%';
            flush(); continue;
        }
        if (!trimmed || /^ {0,3}#{1,6}(\s|$)/.test(line) || /^(?:[-*_]\s*){3,}$/.test(trimmed)
            || /^(?:=+|-+)\s*$/.test(trimmed) || /^(?:#[\w/-]+\s*)+$/.test(trimmed)
            || /^(?: {4}|\t)/.test(line)) {
            // Setext heading: the preceding single line is a title, not a passage.
            if (/^(?:=+|-+)\s*$/.test(trimmed) && buffer.trim().split(/\r?\n/).length === 1) buffer = '';
            flush(); continue;
        }
        buffer += line;
    }
    flush();
    return passages;
}

export { normalizeSettings, matchesFolder, extractPassages };
