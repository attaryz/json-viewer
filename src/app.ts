// @ts-nocheck
import { TreeView } from './tree-view';
import { TableView } from './table-view';
import { DiagramView } from './diagram-view';
import { basicSetup, EditorView } from "codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { createIcons, icons } from "lucide";

class EditorWrapper {
    constructor(elementId, onChange) {
        this.element = document.getElementById(elementId);
        this.view = new EditorView({
            extensions: [
                basicSetup, 
                json(), 
                oneDark, 
                EditorView.updateListener.of((v) => {
                    if (v.docChanged && onChange) onChange();
                }),
                EditorView.theme({
                    "&": { height: "100%", backgroundColor: "var(--color-bg-main)" },
                    ".cm-scroller": { overflow: "auto" },
                    ".cm-gutters": { backgroundColor: "var(--color-bg-panel)", border: "none" }
                })
            ],
            parent: this.element
        });
    }

    get value() {
        return this.view.state.doc.toString();
    }

    set value(val) {
        if (this.value === val) return;
        this.view.dispatch({
            changes: {from: 0, to: this.view.state.doc.length, insert: val}
        });
    }

    select() {
        this.view.dispatch({selection: {anchor: 0, head: this.view.state.doc.length}});
    }

    get style() {
        return this.element.style;
    }
}

// Main Application Controller
export class JSONViewerApp {
    constructor() {
        this.parsedData = null;
        this.currentView = 'tree';
        this.currentTablePath = '';
        this.currentPath = 'root';
        this.largeMode = false;
        this.largeThreshold = 2 * 1024 * 1024;
        this.pendingRender = false;
        this.tableFilter = '';
        this.tableSort = { column: '', direction: 'asc' };
        this.pinnedColumns = [];
        this.bookmarks = this.loadBookmarks();
        this.history = { stack: [], index: -1, suppress: false };
        this.searchMatches = [];
        this.searchIndex = -1;
        this.lastSearchQuery = '';
        
        this.treeView = new TreeView();
        this.tableView = new TableView();
        this.diagramView = new DiagramView();
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeMermaid();
    }

    initializeElements() {
        this.jsonInput = new EditorWrapper('json-input', () => this.onJsonInput());
        this.jsonCompare = new EditorWrapper('json-compare', () => {
            if (this.currentView === 'diff') this.renderJSON();
        });
        this.jsonSchema = new EditorWrapper('json-schema', () => {
            this.validationBar.style.display = 'none';
        });
        this.jsonOutput = document.getElementById('json-output');
        this.fileInput = document.getElementById('file-input');
        this.stats = document.getElementById('stats');
        this.outputHeader = document.getElementById('output-header');
        this.tableSelector = document.getElementById('table-selector');
        this.tablePathSelect = document.getElementById('table-path');
        this.diagramControls = document.getElementById('diagram-controls');
        this.diagramTypeSelect = document.getElementById('diagram-type');
        this.diagramLayout = document.getElementById('diagram-layout');
        this.diagramDepth = document.getElementById('diagram-depth');
        this.diagramDepthValue = document.getElementById('diagram-depth-value');
        this.diagramMaxNodes = document.getElementById('diagram-max-nodes');
        this.diagramInclude = document.getElementById('diagram-include');
        this.diagramExclude = document.getElementById('diagram-exclude');
        this.diagramTheme = document.getElementById('diagram-theme');
        this.diagramSearch = document.getElementById('diagram-search');
        this.diagramScale = document.getElementById('diagram-scale');
        this.compareHeader = document.getElementById('compare-header');
        this.schemaHeader = document.getElementById('schema-header');
        this.pathBar = document.getElementById('path-bar');
        this.currentPathLabel = document.getElementById('current-path');
        this.treeControls = document.getElementById('tree-controls');
        this.treeDepthInput = document.getElementById('tree-depth');
        this.treeDepthValue = document.getElementById('tree-depth-value');
        this.queryBar = document.getElementById('query-bar');
        this.queryResults = document.getElementById('query-results');
        this.validationBar = document.getElementById('validation-bar');
        this.largeModeToggle = document.getElementById('large-mode-toggle');
        this.tableSearch = document.getElementById('table-search');
        this.bookmarkSelect = document.getElementById('bookmark-select');
        this.inputPanel = document.getElementById('input-panel');
        this.outputPanel = document.getElementById('output-panel');
        this.panelResizer = document.getElementById('panel-resizer');
    }

    initializeEventListeners() {
        // CM event listeners are bound in EditorWrapper
        
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                this.jsonInput.value = event.target.result;
                this.onJsonInput(true);
            };
            reader.readAsText(file);
        });

        this.initResize();
        this.addModal();
    }

    addModal() {
        const modalHtml = `
            <div id="row-modal" class="fixed inset-0 bg-black/60 hidden z-50 flex items-center justify-center p-4">
                <div class="bg-bg-panel border border-border rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                    <div class="flex justify-between items-center p-4 border-b border-border">
                        <h2 class="text-white font-semibold flex items-center gap-2"><i data-lucide="info" class="w-5 h-5 text-brand-blue"></i> Row Details</h2>
                        <button onclick="window.closeModal()" class="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <div class="p-4 overflow-auto font-mono text-sm text-gray-300">
                        <pre id="row-modal-content" class="whitespace-pre-wrap"></pre>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        if (window.lucide) window.lucide.createIcons();
    }

    showRowDetails(data) {
        const modal = document.getElementById('row-modal');
        const content = document.getElementById('row-modal-content');
        if (modal && content) {
            content.textContent = JSON.stringify(data, null, 2);
            modal.classList.remove('hidden');
        }
    }

    closeModal() {
        const modal = document.getElementById('row-modal');
        if (modal) modal.classList.add('hidden');
    }

    initResize() {
        if (!this.panelResizer || !this.inputPanel || !this.outputPanel) return;
        let startX = 0;
        let startWidth = 0;
        const onMove = (e) => {
            const dx = e.clientX - startX;
            const newWidth = Math.max(200, startWidth + dx);
            const total = this.inputPanel.parentElement.clientWidth;
            const maxWidth = total - 200;
            const clamped = Math.min(newWidth, maxWidth);
            this.inputPanel.style.flex = '0 0 auto';
            this.inputPanel.style.width = `${clamped}px`;
            this.outputPanel.style.flex = '1 1 auto';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        this.panelResizer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startWidth = this.inputPanel.getBoundingClientRect().width;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    }

    initializeMermaid() {
        this.applyMermaidTheme('dark');
    }

    applyMermaidTheme(theme) {
        const isDark = theme === 'dark';
        mermaid.initialize({ 
            startOnLoad: false,
            maxEdges: 5000,
            theme: isDark ? 'dark' : 'neutral',
            flowchart: {
                curve: 'basis',
                nodeSpacing: 40,
                rankSpacing: 60
            },
            themeVariables: isDark ? {
                darkMode: true,
                background: '#1e1e1e',
                primaryColor: '#3b7ddd',
                primaryTextColor: '#f0f6ff',
                primaryBorderColor: '#2a3b55',
                lineColor: '#8fb3ff',
                secondaryColor: '#1a2433',
                tertiaryColor: '#223044',
                mindmapBorderColor: '#8fb3ff',
                mindmapLineColor: '#8fb3ff',
                mindmapNodeTextColor: '#f0f6ff',
                mindmapNodeBackground: '#1f2a3c',
                mindmapRootTextColor: '#ffffff',
                mindmapRootBackground: '#3b7ddd'
            } : {
                background: '#f7f7f7',
                primaryColor: '#0e639c',
                primaryTextColor: '#111111',
                primaryBorderColor: '#cfcfcf',
                lineColor: '#7a7a7a',
                secondaryColor: '#eaeaea',
                tertiaryColor: '#ffffff'
            }
        });
    }

    switchView(view) {
        this.currentView = view;
        const views = ['tree', 'table', 'diagram', 'diff'];
        const activeClass = 'group relative btn active bg-brand-blue shadow text-white py-1.5 px-3 rounded text-[13px] transition-colors flex items-center gap-1.5';
        const inactiveClass = 'group relative btn btn-secondary text-text-muted hover:text-white hover:bg-white/5 py-1.5 px-3 rounded text-[13px] transition-colors flex items-center gap-1.5';
        
        views.forEach(v => {
            const btn = document.getElementById('btn-' + v);
            if (btn) {
                // keep the inner html structure intact (including tooltip) when switching classes
                const existingHtml = btn.innerHTML;
                btn.className = v === view ? activeClass : inactiveClass;
                btn.innerHTML = existingHtml;
            }
        });
        
        this.outputPanel.classList.toggle('table-mode', view === 'table');

        if (view === 'tree') {
            this.tableSelector.style.display = 'none';
            this.diagramControls.style.display = 'none';
            this.compareHeader.style.display = 'none';
            this.jsonCompare.style.display = 'none';
            this.outputHeader.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="folder-tree" class="w-4 h-4 text-text-muted"></i> Tree View</span>';
            this.pathBar.style.display = 'flex';
            this.treeControls.style.display = 'flex';
            this.queryBar.style.display = 'flex';
            if (window.lucide) window.lucide.createIcons();
        } else if (view === 'table') {
            this.tableSelector.style.display = 'flex';
            this.diagramControls.style.display = 'none';
            this.compareHeader.style.display = 'none';
            this.jsonCompare.style.display = 'none';
            this.outputHeader.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="table" class="w-4 h-4 text-text-muted"></i> Table View</span>';
            this.pathBar.style.display = 'none';
            this.treeControls.style.display = 'none';
            this.queryBar.style.display = 'flex';
            this.updateTableSelector();
            if (window.lucide) window.lucide.createIcons();
        } else if (view === 'diagram') {
            this.tableSelector.style.display = 'none';
            this.diagramControls.style.display = 'flex';
            this.compareHeader.style.display = 'none';
            this.jsonCompare.style.display = 'none';
            this.outputHeader.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="network" class="w-4 h-4 text-text-muted"></i> Diagram View</span>';
            this.pathBar.style.display = 'none';
            this.treeControls.style.display = 'none';
            this.queryBar.style.display = 'flex';
            if (window.lucide) window.lucide.createIcons();
        } else if (view === 'diff') {
            this.tableSelector.style.display = 'none';
            this.diagramControls.style.display = 'none';
            this.compareHeader.style.display = 'flex';
            this.jsonCompare.style.display = 'block';
            this.outputHeader.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="split-square-horizontal" class="w-4 h-4 text-text-muted"></i> Diff Results</span>';
            this.pathBar.style.display = 'flex';
            this.treeControls.style.display = 'none';
            this.queryBar.style.display = 'none';
            if (window.lucide) window.lucide.createIcons();
            this.renderDiff();
        }
        
        this.renderJSON();
    }

    updateTableSelector() {
        const paths = this.tableView.collectPaths(this.parsedData, '');
        this.tablePathSelect.innerHTML = '<option value="">-- Select a path --</option>';
        
        paths.forEach(path => {
            const option = document.createElement('option');
            option.value = path.path;
            option.textContent = path.label;
            this.tablePathSelect.appendChild(option);
        });
        
        if (this.currentTablePath && paths.find(p => p.path === this.currentTablePath)) {
            this.tablePathSelect.value = this.currentTablePath;
        }
    }

    async renderJSON() {
        const text = this.jsonInput.value.trim();
        if (!text) {
            this.jsonOutput.innerHTML = '';
            this.stats.textContent = 'Ready';
            this.parsedData = null;
            this.queryResults.style.display = 'none';
            return;
        }

        try {
            if (this.currentView === 'diff') {
                this.renderDiff();
                return;
            }

            this.parsedData = JSON.parse(text);
            
            if (this.currentView === 'tree') {
                this.jsonOutput.innerHTML = this.treeView.render(this.parsedData, '', true);
                this.treeView.addEventListeners();
                this.applyTreeDepth();
                this.attachPathListeners();
                this.setCurrentPath(this.currentPath || 'root');
            } else if (this.currentView === 'table') {
                this.updateTableSelector();
                this.renderTableForPath(this.currentTablePath);
            } else if (this.currentView === 'diagram') {
                await this.renderDiagram();
            }
            
            this.updateStats(this.parsedData, text);
        } catch (e) {
            this.jsonOutput.innerHTML = `<div class="error">Invalid JSON: ${e.message}</div>`;
            this.stats.textContent = 'Error parsing JSON';
            this.parsedData = null;
            this.queryResults.style.display = 'none';
        }
    }

    renderTableForPath(path) {
        this.currentTablePath = path;
        
        if (!path && !Array.isArray(this.parsedData)) {
            this.jsonOutput.className = 'output-content flex-1 max-h-full overflow-auto p-[15px] font-mono text-[13px] leading-relaxed relative';
            this.jsonOutput.innerHTML = '<div class="empty-state text-center text-text-muted py-10">Select an array from the dropdown above to view as table</div>';
            return;
        }
        
        const data = path ? this.tableView.getValueAtPath(this.parsedData, path) : this.parsedData;
        this.jsonOutput.innerHTML = '';
        this.jsonOutput.className = 'output-content flex-1 overflow-hidden relative ag-theme-alpine-dark';
        this.tableView.render(data, this.jsonOutput, {
            filter: this.tableFilter
        });
    }

    async renderDiagram() {
        if (!this.parsedData) {
            this.jsonOutput.innerHTML = '<div class="empty-state">No data to visualize</div>';
            return;
        }

        const diagramType = this.diagramTypeSelect.value;
        this.diagramDepthValue.textContent = this.diagramDepth.value;
        const options = {
            maxDepth: Number(this.diagramDepth.value),
            maxNodes: Number(this.diagramMaxNodes.value),
            includeKeys: this.diagramInclude.value,
            excludeKeys: this.diagramExclude.value,
            theme: this.diagramTheme.value,
            layout: this.diagramLayout.value
        };
        this.applyMermaidTheme(options.theme);
        const html = await this.diagramView.render(this.parsedData, diagramType, options);
        this.jsonOutput.innerHTML = html;
        
        // Wait for DOM to update, then render mermaid
        setTimeout(async () => {
            const mermaidId = this.jsonOutput.querySelector('.mermaid')?.id;
            if (mermaidId) {
                await this.diagramView.renderMermaid(mermaidId);
            }
        }, 100);
    }

    updateStats(parsed, raw) {
        const size = new Blob([raw]).size;
        const keys = this.countKeys(parsed);
        const type = Array.isArray(parsed) ? `Array(${parsed.length})` : 'Object';
        const mode = this.largeMode ? ' | Large Mode' : '';
        this.stats.textContent = `Size: ${this.formatBytes(size)} | Keys: ${keys} | Type: ${type}${mode}`;
    }

    countKeys(obj) {
        if (typeof obj !== 'object' || obj === null) return 0;
        let count = 0;
        for (const key in obj) {
            count++;
            count += this.countKeys(obj[key]);
        }
        return count;
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatJSON() {
        try {
            const parsed = JSON.parse(this.jsonInput.value);
            this.jsonInput.value = JSON.stringify(parsed, null, 2);
            this.recordHistory(this.jsonInput.value);
            this.renderJSON();
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    }

    minifyJSON() {
        try {
            const parsed = JSON.parse(this.jsonInput.value);
            this.jsonInput.value = JSON.stringify(parsed);
            this.recordHistory(this.jsonInput.value);
            this.renderJSON();
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    }

    copyToClipboard() {
        this.jsonInput.select();
        document.execCommand('copy');
        const btn = event.target;
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 1000);
    }

    clearAll() {
        this.jsonInput.value = '';
        this.jsonOutput.innerHTML = '';
        this.stats.textContent = 'Ready';
        this.fileInput.value = '';
        this.parsedData = null;
        this.currentTablePath = '';
        this.jsonCompare.value = '';
        this.jsonSchema.value = '';
        this.validationBar.style.display = 'none';
        this.queryResults.style.display = 'none';
        this.history = { stack: [''], index: 0, suppress: false };
    }

    searchJSON() {
        const query = document.getElementById('search-input').value.trim();
        if (!query || !this.parsedData) {
            this.clearSearchHighlights();
            this.searchMatches = [];
            this.searchIndex = -1;
            this.lastSearchQuery = '';
            this.stats.textContent = this.stats.textContent.replace(/ \| Matches:.*/, '');
            this.renderJSON();
            return;
        }

        this.lastSearchQuery = query;
        this.renderJSON();
        this.searchMatches = [];
        this.searchIndex = -1;

        if (this.currentView === 'tree') {
            const walker = document.createTreeWalker(this.jsonOutput, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.toLowerCase().includes(query.toLowerCase())) {
                    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
                    const parts = node.nodeValue.split(regex);
                    const fragment = document.createDocumentFragment();
                    
                    parts.forEach(part => {
                        if (part.toLowerCase() === query.toLowerCase()) {
                            const mark = document.createElement('span');
                            mark.className = 'highlight';
                            mark.textContent = part;
                            fragment.appendChild(mark);
                            this.searchMatches.push(mark);
                        } else {
                            fragment.appendChild(document.createTextNode(part));
                        }
                    });
                    
                    node.parentNode.replaceChild(fragment, node);
                }
            }
        } else if (this.currentView === 'table') {
            const rows = Array.from(this.jsonOutput.querySelectorAll('.data-table tbody tr'));
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(query.toLowerCase()) ? '' : 'none';
            });
        }

        if (this.searchMatches.length > 0) {
            this.searchIndex = 0;
            this.focusSearchMatch();
        }
        this.stats.textContent = `${this.stats.textContent.replace(/ \| Matches:.*/, '')} | Matches: ${this.searchMatches.length}`;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    clearSearchHighlights() {
        this.jsonOutput.querySelectorAll('.highlight.current').forEach(el => el.classList.remove('current'));
    }

    focusSearchMatch() {
        this.clearSearchHighlights();
        const el = this.searchMatches[this.searchIndex];
        if (!el) return;
        el.classList.add('current');
        el.scrollIntoView({ block: 'center' });
    }

    nextSearchMatch() {
        const query = document.getElementById('search-input').value.trim();
        if (!this.searchMatches || this.searchMatches.length === 0 || query !== this.lastSearchQuery) {
            this.searchJSON();
            return;
        }
        this.searchIndex = (this.searchIndex + 1) % this.searchMatches.length;
        this.focusSearchMatch();
    }

    prevSearchMatch() {
        const query = document.getElementById('search-input').value.trim();
        if (!this.searchMatches || this.searchMatches.length === 0 || query !== this.lastSearchQuery) {
            this.searchJSON();
            return;
        }
        this.searchIndex = (this.searchIndex - 1 + this.searchMatches.length) % this.searchMatches.length;
        this.focusSearchMatch();
    }

    onJsonInput(force = false) {
        this.recordHistory(this.jsonInput.value);
        const size = new Blob([this.jsonInput.value]).size;
        if (!force && (this.largeMode || size > this.largeThreshold)) {
            this.largeMode = true;
            this.largeModeToggle.classList.add('large-mode-on');
            this.pendingRender = true;
            this.stats.textContent = `Size: ${this.formatBytes(size)} | Large Mode: click Render`;
            return;
        }
        this.pendingRender = false;
        this.renderJSON();
    }

    renderNow() {
        this.pendingRender = false;
        this.renderJSON();
    }

    downloadJSON() {
        if (!this.parsedData) {
            this.updateStats('Error: No valid JSON to download.', true);
            return;
        }
        
        try {
            const dataStr = JSON.stringify(this.parsedData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'data.json';
            document.body.appendChild(a);
            a.click();
            
            // cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.updateStats('Successfully downloaded JSON file');
        } catch (e) {
            this.updateStats('Error downloading file: ' + e.message, true);
        }
    }

    toggleLargeMode() {
        this.largeMode = !this.largeMode;
        this.largeModeToggle.classList.toggle('large-mode-on', this.largeMode);
        if (!this.largeMode) {
            this.renderJSON();
        }
    }

    validateSchema() {
        this.ensureSchemaVisible();
        if (!this.jsonSchema.value.trim()) {
            this.validationBar.className = 'validation-bar error';
            this.validationBar.textContent = 'Schema is empty';
            this.validationBar.style.display = 'block';
            return;
        }

        try {
            if (!this.parsedData) {
                this.parsedData = JSON.parse(this.jsonInput.value);
            }
            const ajv = new Ajv({ allErrors: true, strict: false });
            const schema = JSON.parse(this.jsonSchema.value);
            const validate = ajv.compile(schema);
            const isValid = validate(this.parsedData);
            if (isValid) {
                this.validationBar.className = 'validation-bar ok';
                this.validationBar.textContent = 'Schema validation passed';
            } else {
                const errors = validate.errors || [];
                this.validationBar.className = 'validation-bar error';
                this.validationBar.innerHTML = errors.map(err => {
                    const pointer = err.instancePath || '/';
                    const loc = this.lookupPointerLocation(pointer);
                    const locText = loc ? ` (line ${loc.line}, col ${loc.column})` : '';
                    return `<div>${this.escapeHtml(pointer)}${locText}: ${this.escapeHtml(err.message || 'Invalid')}</div>`;
                }).join('');
            }
            this.validationBar.style.display = 'block';
        } catch (e) {
            this.validationBar.className = 'validation-bar error';
            this.validationBar.textContent = `Schema error: ${e.message}`;
            this.validationBar.style.display = 'block';
        }
    }

    ensureSchemaVisible() {
        this.schemaHeader.style.display = 'block';
        this.jsonSchema.style.display = 'block';
    }

    runQuery() {
        if (!this.parsedData) return;
        const input = document.getElementById('query-input').value.trim();
        if (!input) return;
        const lang = document.getElementById('query-language').value;
        try {
            let result;
            if (lang === 'jsonpath') {
                if (!window.JSONPath) throw new Error('JSONPath library not loaded');
                result = window.JSONPath({ path: input, json: this.parsedData });
            } else if (lang === 'jmespath') {
                if (!window.jmespath) throw new Error('JMESPath library not loaded');
                result = window.jmespath.search(this.parsedData, input);
            } else if (lang === 'js') {
                // Safely(ish) execute javascript transformation returning a value
                // In production, consider a Web Worker or better sandbox
                const fn = new Function('data', `return (function() { ${input} })();`);
                result = fn(this.parsedData);
            }
            this.queryResults.style.display = 'block';
            this.queryResults.textContent = JSON.stringify(result, null, 2);
        } catch (e) {
            this.queryResults.style.display = 'block';
            this.queryResults.textContent = `Query error: ${e.message}`;
        }
    }

    clearQuery() {
        document.getElementById('query-input').value = '';
        this.queryResults.style.display = 'none';
        this.queryResults.textContent = '';
    }

    renderDiff() {
        const left = this.jsonInput.value.trim();
        const right = this.jsonCompare.value.trim();
        if (!left || !right) {
            this.jsonOutput.innerHTML = '<div class="empty-state">Paste JSON in both panes to compare</div>';
            this.stats.textContent = 'Diff ready';
            return;
        }

        try {
            const leftData = JSON.parse(left);
            const rightData = JSON.parse(right);
            const diffs = [];
            this.diffObjects(leftData, rightData, 'root', diffs);
            if (diffs.length === 0) {
                this.jsonOutput.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500 italic">No differences found between the two objects.</div>';
            } else {
                const html = diffs.map(d => {
                    const oldVal = d.oldValue !== undefined ? JSON.stringify(d.oldValue) : 'none';
                    const newVal = d.newValue !== undefined ? JSON.stringify(d.newValue) : 'none';
                    let actionIcon = '';
                    let colorClass = '';
                    
                    if (d.type === 'added') {
                        actionIcon = '<i data-lucide="plus-circle" class="w-4 h-4 text-emerald-500"></i>';
                        colorClass = 'border-emerald-500/30 bg-emerald-500/5';
                    } else if (d.type === 'removed') {
                        actionIcon = '<i data-lucide="minus-circle" class="w-4 h-4 text-rose-500"></i>';
                        colorClass = 'border-rose-500/30 bg-rose-500/5';
                    } else {
                        actionIcon = '<i data-lucide="arrow-right-left" class="w-4 h-4 text-amber-500"></i>';
                        colorClass = 'border-amber-500/30 bg-amber-500/5';
                    }
                    
                    return `
                        <div class="flex flex-col gap-2 p-3 mb-3 border rounded ${colorClass}">
                            <div class="flex items-center gap-2">
                                ${actionIcon}
                                <span class="font-bold text-sky-400 font-mono text-sm">${this.escapeHtml(d.path)}</span>
                            </div>
                            <div class="grid grid-cols-2 gap-4 text-xs font-mono mt-1">
                                <div class="p-2 bg-black/20 rounded border border-gray-700">
                                    <div class="text-gray-500 mb-1 border-b border-gray-700 pb-1 uppercase tracking-wider text-[10px]">Left Property</div>
                                    <div class="${d.type === 'added' ? 'text-gray-500 italic' : 'text-gray-300'} break-all whitespace-pre-wrap">${this.escapeHtml(oldVal)}</div>
                                </div>
                                <div class="p-2 bg-black/20 rounded border border-gray-700">
                                    <div class="text-gray-500 mb-1 border-b border-gray-700 pb-1 uppercase tracking-wider text-[10px]">Right Property</div>
                                    <div class="${d.type === 'removed' ? 'text-gray-500 italic' : 'text-gray-300'} break-all whitespace-pre-wrap">${this.escapeHtml(newVal)}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                this.jsonOutput.innerHTML = `<div class="p-4 grid gap-1">${html}</div>`;
                if (window.lucide) window.lucide.createIcons();
            }
            this.stats.textContent = `Differences: ${diffs.length}`;
        } catch (e) {
            this.jsonOutput.innerHTML = `<div class="p-4 m-4 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 flex items-center gap-2"><i data-lucide="alert-circle" class="w-5 h-5"></i> Error parsing JSON for comparison: ${e.message}</div>`;
            if (window.lucide) window.lucide.createIcons();
        }
    }

    diffObjects(a, b, path, diffs) {
        if (a === b) return;
        const typeA = this.getType(a);
        const typeB = this.getType(b);
        if (typeA !== typeB) {
            diffs.push({ type: 'changed', path, oldValue: a, newValue: b });
            return;
        }

        if (typeA === 'array') {
            const max = Math.max(a.length, b.length);
            for (let i = 0; i < max; i++) {
                const nextPath = `${path}[${i}]`;
                if (i >= a.length) diffs.push({ type: 'added', path: nextPath, newValue: b[i] });
                else if (i >= b.length) diffs.push({ type: 'removed', path: nextPath, oldValue: a[i] });
                else this.diffObjects(a[i], b[i], nextPath, diffs);
            }
            return;
        }

        if (typeA === 'object') {
            const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
            keys.forEach(key => {
                const nextPath = path === 'root' ? key : `${path}.${key}`;
                if (!(key in a)) diffs.push({ type: 'added', path: nextPath, newValue: b[key] });
                else if (!(key in b)) diffs.push({ type: 'removed', path: nextPath, oldValue: a[key] });
                else this.diffObjects(a[key], b[key], nextPath, diffs);
            });
            return;
        }

        diffs.push({ type: 'changed', path, oldValue: a, newValue: b });
    }

    getType(value) {
        if (Array.isArray(value)) return 'array';
        if (value === null) return 'null';
        return typeof value;
    }

    attachPathListeners() {
        document.querySelectorAll('.tree-line').forEach(line => {
            line.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const path = line.getAttribute('data-path') || 'root';
                this.setCurrentPath(path);
            });
        });
    }

    setCurrentPath(path) {
        this.currentPath = path || 'root';
        this.currentPathLabel.textContent = this.currentPath;
        this.refreshBookmarks();
    }

    copyPath() {
        navigator.clipboard.writeText(this.currentPath || 'root');
    }

    copyPointer() {
        const pointer = this.pathToPointer(this.currentPath || 'root');
        navigator.clipboard.writeText(pointer);
    }

    pathToPointer(path) {
        if (!path || path === 'root') return '';
        const segments = [];
        let current = '';
        for (let i = 0; i < path.length; i++) {
            const ch = path[i];
            if (ch === '.') {
                if (current) segments.push(current);
                current = '';
            } else if (ch === '[') {
                if (current) segments.push(current);
                current = '';
                let idx = '';
                i++;
                while (i < path.length && path[i] !== ']') {
                    idx += path[i];
                    i++;
                }
                if (idx) segments.push(idx);
            } else {
                current += ch;
            }
        }
        if (current) segments.push(current);
        return '/' + segments.map(s => s.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
    }

    addBookmark() {
        const name = document.getElementById('bookmark-name').value.trim();
        if (!name || !this.currentPath) return;
        const existing = this.bookmarks.find(b => b.name === name);
        if (existing) {
            existing.path = this.currentPath;
        } else {
            this.bookmarks.push({ name, path: this.currentPath });
        }
        document.getElementById('bookmark-name').value = '';
        this.saveBookmarks();
        this.refreshBookmarks();
    }

    removeBookmark() {
        const selected = this.bookmarkSelect.value;
        if (!selected) return;
        this.bookmarks = this.bookmarks.filter(b => b.name !== selected);
        this.saveBookmarks();
        this.refreshBookmarks();
    }

    jumpToBookmark(name) {
        const found = this.bookmarks.find(b => b.name === name);
        if (found) {
            this.setCurrentPath(found.path);
            this.scrollToPath(found.path);
        }
    }

    refreshBookmarks() {
        this.bookmarkSelect.innerHTML = '<option value="">Jump to bookmark...</option>';
        this.bookmarks.forEach(b => {
            const option = document.createElement('option');
            option.value = b.name;
            option.textContent = `${b.name} (${b.path})`;
            this.bookmarkSelect.appendChild(option);
        });
    }

    saveBookmarks() {
        localStorage.setItem('jsonr_bookmarks', JSON.stringify(this.bookmarks));
    }

    loadBookmarks() {
        try {
            return JSON.parse(localStorage.getItem('jsonr_bookmarks')) || [];
        } catch {
            return [];
        }
    }

    scrollToPath(path) {
        const line = document.querySelector(`.tree-line[data-path="${CSS.escape(path)}"]`);
        if (line) {
            line.scrollIntoView({ block: 'center' });
            line.classList.add('highlight');
            setTimeout(() => line.classList.remove('highlight'), 1000);
        }
    }

    expandAll() {
        document.querySelectorAll('.tree-toggle').forEach(toggle => {
            toggle.classList.remove('-rotate-90');
        });
        document.querySelectorAll('.tree-content').forEach(content => {
            content.classList.remove('hidden');
        });
        document.querySelectorAll('.tree-close').forEach(close => {
            close.classList.remove('hidden');
        });
        document.querySelectorAll('.tree-preview').forEach(preview => {
            preview.classList.add('hidden');
        });
    }

    collapseAll() {
        document.querySelectorAll('.tree-toggle').forEach(toggle => {
            toggle.classList.add('-rotate-90');
        });
        document.querySelectorAll('.tree-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.querySelectorAll('.tree-close').forEach(close => {
            close.classList.add('hidden');
        });
        document.querySelectorAll('.tree-preview').forEach(preview => {
            preview.classList.remove('hidden');
        });
    }

    setTreeDepth(depth) {
        this.treeDepthValue.textContent = depth;
        this.applyTreeDepth();
    }

    applyTreeDepth() {
        const maxDepth = Number(this.treeDepthInput.value);
        document.querySelectorAll('.tree-line').forEach(line => {
            const depth = Number(line.getAttribute('data-depth'));
            const toggle = line.querySelector('.tree-toggle');
            if (!toggle) return;
            const content = line.nextElementSibling;
            const closeBrace = content ? content.nextElementSibling : null;
            const preview = line.querySelector('.tree-preview');
            
            if (depth >= maxDepth - 1) {
                toggle.classList.add('-rotate-90');
                if (content && content.classList.contains('tree-content')) content.classList.add('hidden');
                if (closeBrace && closeBrace.classList.contains('tree-close')) closeBrace.classList.add('hidden');
                if (preview) preview.classList.remove('hidden');
            } else {
                toggle.classList.remove('-rotate-90');
                if (content && content.classList.contains('tree-content')) content.classList.remove('hidden');
                if (closeBrace && closeBrace.classList.contains('tree-close')) closeBrace.classList.remove('hidden');
                if (preview) preview.classList.add('hidden');
            }
        });
    }

    filterTableRows(query) {
        this.tableFilter = query || '';
        this.renderTableForPath(this.currentTablePath);
    }

    toggleSortColumn(encodedCol) {
        const col = decodeURIComponent(encodedCol);
        if (this.tableSort.column === col) {
            this.tableSort.direction = this.tableSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.tableSort.column = col;
            this.tableSort.direction = 'asc';
        }
        this.renderTableForPath(this.currentTablePath);
    }

    togglePinColumn(encodedCol) {
        const col = decodeURIComponent(encodedCol);
        const index = this.pinnedColumns.indexOf(col);
        if (index >= 0) {
            this.pinnedColumns.splice(index, 1);
        } else {
            this.pinnedColumns.push(col);
        }
        this.applyPinnedColumns();
        this.updatePinnedButtons();
    }

    applyPinnedColumns() {
        const table = document.querySelector('.data-table');
        if (!table) return;
        const headers = Array.from(table.querySelectorAll('th'));
        const pinned = this.pinnedColumns;
        let leftOffset = 0;
        const rowHeader = headers.find(th => th.getAttribute('data-col') === '__row');
        if (rowHeader) {
            leftOffset += rowHeader.offsetWidth;
        }

        headers.forEach((th, index) => {
            const col = decodeURIComponent(th.getAttribute('data-col'));
            const cells = table.querySelectorAll(`td:nth-child(${index + 1})`);
            if (pinned.includes(col)) {
                th.classList.add('pinned');
                th.style.left = `${leftOffset}px`;
                cells.forEach(td => {
                    td.classList.add('pinned');
                    td.style.left = `${leftOffset}px`;
                });
                leftOffset += th.offsetWidth;
            } else {
                th.classList.remove('pinned');
                th.style.left = '';
                cells.forEach(td => {
                    td.classList.remove('pinned');
                    td.style.left = '';
                });
            }
        });
        this.updatePinnedButtons();
    }

    updatePinnedButtons() {
        document.querySelectorAll('.data-table th').forEach(th => {
            const col = decodeURIComponent(th.getAttribute('data-col'));
            const btn = th.querySelector('button[title="Pin"]');
            if (!btn) return;
            btn.classList.toggle('active', this.pinnedColumns.includes(col));
            btn.innerHTML = this.pinnedColumns.includes(col) ? '<i data-lucide="pin"></i>' : '<i data-lucide="pin-off"></i>';
            lucide.createIcons();
        });
    }

    updateSortButtons() {
        document.querySelectorAll('.data-table th').forEach(th => {
            const col = decodeURIComponent(th.getAttribute('data-col'));
            const btn = th.querySelector('button[title="Sort"]');
            if (!btn) return;
            const active = this.tableSort.column === col;
            btn.classList.toggle('active', active);
            if (active) {
                btn.textContent = this.tableSort.direction === 'asc' ? 'Asc' : 'Desc';
            } else {
                btn.textContent = 'Sort';
            }
        });
    }

    exportTableCSV() {
        const cols = this.tableView.lastColumns || [];
        const rows = this.tableView.lastRows || [];
        if (!cols.length || !rows.length) return;
        const lines = [];
        lines.push(cols.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
        rows.forEach(row => {
            const line = cols.map(col => {
                const value = row[col];
                return `"${String(value === undefined ? '' : value).replace(/"/g, '""')}"`;
            }).join(',');
            lines.push(line);
        });
        this.downloadFile('table.csv', lines.join('\n'), 'text/csv');
    }

    exportDiagramSVG() {
        const svg = this.getDiagramSvg();
        if (!svg) return;
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svg);
        this.downloadFile('diagram.svg', source, 'image/svg+xml');
    }

    exportDiagramPNG() {
        const svg = this.getDiagramSvg();
        if (!svg) return;
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svg);
        const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Number(this.diagramScale.value || 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(blob => {
                if (blob) this.downloadFile('diagram.png', blob, 'image/png');
                URL.revokeObjectURL(url);
            });
        };
        img.src = url;
    }

    getDiagramSvg() {
        return document.querySelector('.diagram-content svg');
    }

    downloadFile(name, content, type) {
        const blob = content instanceof Blob ? content : new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    recordHistory(value) {
        if (this.history.suppress) return;
        const current = this.history.stack[this.history.index];
        if (current === value) return;
        this.history.stack = this.history.stack.slice(0, this.history.index + 1);
        this.history.stack.push(value);
        this.history.index = this.history.stack.length - 1;
    }

    undoInput() {
        if (this.history.index <= 0) return;
        this.history.suppress = true;
        this.history.index -= 1;
        this.jsonInput.value = this.history.stack[this.history.index];
        this.history.suppress = false;
        this.renderJSON();
    }

    redoInput() {
        if (this.history.index >= this.history.stack.length - 1) return;
        this.history.suppress = true;
        this.history.index += 1;
        this.jsonInput.value = this.history.stack[this.history.index];
        this.history.suppress = false;
        this.renderJSON();
    }

    lookupPointerLocation(pointer) {
        const sourceMap = window.jsonSourceMap || window.JSONSourceMap;
        if (!sourceMap || !sourceMap.parse) return null;
        try {
            const parsed = sourceMap.parse(this.jsonInput.value);
            const entry = parsed.pointers[pointer];
            if (!entry || !entry.value) return null;
            return { line: entry.value.line + 1, column: entry.value.column + 1 };
        } catch {
            return null;
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return String(text);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

// Global functions for HTML onclick handlers
let app;

function switchView(view) {
    app.switchView(view);
}

function formatJSON() {
    app.formatJSON();
}

function minifyJSON() {
    app.minifyJSON();
}

function copyToClipboard() {
    app.copyToClipboard();
}

function clearAll() {
    app.clearAll();
}

function searchJSON() {
    app.searchJSON();
}

function nextSearchMatch() {
    app.nextSearchMatch();
}

function prevSearchMatch() {
    app.prevSearchMatch();
}

function searchKeydown(event) {
    if (event.key === 'Enter' && event.shiftKey) {
        app.prevSearchMatch();
        event.preventDefault();
        return;
    }
    if (event.key === 'Enter') {
        app.nextSearchMatch();
        event.preventDefault();
    }
}

function renderTableForPath(path) {
    app.renderTableForPath(path);
}

function viewAsTable(path) {
    app.currentTablePath = path;
    app.switchView('table');
}

function toggleCellExpand(cellId) {
    const cell = document.getElementById(cellId);
    const content = document.getElementById(`${cellId}-content`);
    
    if (!cell || !content) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        cell.classList.add('cell-expanded');
        const btn = cell.querySelector('.expand-btn');
        if (btn) btn.textContent = '▲';
    } else {
        content.style.display = 'none';
        cell.classList.remove('cell-expanded');
        const btn = cell.querySelector('.expand-btn');
        if (btn) btn.textContent = '▼';
    }
}

function renderDiagram() {
    app.renderDiagram();
}

function highlightDiagram() {
    app.diagramView.highlight(app.diagramSearch.value);
}

function undoInput() {
    app.undoInput();
}

function redoInput() {
    app.redoInput();
}

function renderNow() {
    app.renderNow();
}

function toggleLargeMode() {
    app.toggleLargeMode();
}

function validateSchema() {
    app.validateSchema();
}

function runQuery() {
    app.runQuery();
}

function clearQuery() {
    app.clearQuery();
}

function copyPath() {
    app.copyPath();
}

function copyPointer() {
    app.copyPointer();
}

function addBookmark() {
    app.addBookmark();
}

function removeBookmark() {
    app.removeBookmark();
}

function jumpToBookmark(name) {
    app.jumpToBookmark(name);
}

function expandAll() {
    app.expandAll();
}

function collapseAll() {
    app.collapseAll();
}

function setTreeDepth(value) {
    app.setTreeDepth(value);
}

function filterTableRows(value) {
    app.filterTableRows(value);
}

function toggleSortColumn(encodedCol) {
    app.toggleSortColumn(encodedCol);
}

function togglePinColumn(encodedCol) {
    app.togglePinColumn(encodedCol);
}

function exportTableCSV() {
    app.exportTableCSV();
}

function exportDiagramSVG() {
    app.exportDiagramSVG();
}

function exportDiagramPNG() {
    app.exportDiagramPNG();
}

document.addEventListener('DOMContentLoaded', () => {
    window.lucide = { createIcons: () => createIcons({ icons }) };
    createIcons({ icons }); // Initialize Lucide icons
    app = new JSONViewerApp();
    window.app = app;
    window.diagramView = app.diagramView; // Make diagram view accessible for zoom controls
    
    // Attach global functions to window for HTML onclick handlers
    Object.assign(window, {
        switchView, formatJSON, minifyJSON, copyToClipboard, clearAll, searchJSON,
        nextSearchMatch, prevSearchMatch, searchKeydown, renderTableForPath, viewAsTable,
        toggleCellExpand, renderDiagram, highlightDiagram, undoInput, redoInput,
        renderNow, toggleLargeMode, validateSchema, runQuery, clearQuery, copyPath,
        copyPointer, addBookmark, removeBookmark, jumpToBookmark, expandAll, collapseAll,
        setTreeDepth, filterTableRows, toggleSortColumn, togglePinColumn, exportTableCSV,
        exportDiagramSVG, exportDiagramPNG, downloadJSON: () => window.app?.downloadJSON(),
        closeModal: () => window.app?.closeModal()
    });

    app.recordHistory(app.jsonInput.value);
    app.refreshBookmarks();
    app.treeDepthValue.textContent = app.treeDepthInput.value;
    if (app.diagramDepthValue && app.diagramDepth) {
        app.diagramDepthValue.textContent = app.diagramDepth.value;
    }
});
