// Main Application Controller
class JSONViewerApp {
    constructor() {
        this.parsedData = null;
        this.currentView = 'tree';
        this.currentTablePath = '';
        
        this.treeView = new TreeView();
        this.tableView = new TableView();
        this.diagramView = new DiagramView();
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeMermaid();
    }

    initializeElements() {
        this.jsonInput = document.getElementById('json-input');
        this.jsonOutput = document.getElementById('json-output');
        this.fileInput = document.getElementById('file-input');
        this.stats = document.getElementById('stats');
        this.outputHeader = document.getElementById('output-header');
        this.tableSelector = document.getElementById('table-selector');
        this.tablePathSelect = document.getElementById('table-path');
        this.diagramControls = document.getElementById('diagram-controls');
        this.diagramTypeSelect = document.getElementById('diagram-type');
    }

    initializeEventListeners() {
        this.jsonInput.addEventListener('input', () => this.renderJSON());
        
        this.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                this.jsonInput.value = event.target.result;
                this.renderJSON();
            };
            reader.readAsText(file);
        });
    }

    initializeMermaid() {
        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                darkMode: true,
                background: '#1e1e1e',
                primaryColor: '#0e639c',
                primaryTextColor: '#d4d4d4',
                primaryBorderColor: '#3e3e3e',
                lineColor: '#5c5c5c',
                secondaryColor: '#2d2d2d',
                tertiaryColor: '#3c3c3c'
            }
        });
    }

    switchView(view) {
        this.currentView = view;
        document.getElementById('btn-tree').className = view === 'tree' ? 'btn active' : 'btn btn-secondary';
        document.getElementById('btn-table').className = view === 'table' ? 'btn active' : 'btn btn-secondary';
        document.getElementById('btn-diagram').className = view === 'diagram' ? 'btn active' : 'btn btn-secondary';
        
        if (view === 'tree') {
            this.tableSelector.style.display = 'none';
            this.diagramControls.style.display = 'none';
            this.outputHeader.innerHTML = '<span>Tree View</span>';
        } else if (view === 'table') {
            this.tableSelector.style.display = 'flex';
            this.diagramControls.style.display = 'none';
            this.updateTableSelector();
        } else if (view === 'diagram') {
            this.tableSelector.style.display = 'none';
            this.diagramControls.style.display = 'flex';
            this.outputHeader.innerHTML = '<span>Diagram View</span>';
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
            return;
        }

        try {
            this.parsedData = JSON.parse(text);
            
            if (this.currentView === 'tree') {
                this.jsonOutput.innerHTML = this.treeView.render(this.parsedData, '', true);
                this.treeView.addEventListeners();
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
        }
    }

    renderTableForPath(path) {
        this.currentTablePath = path;
        
        if (!path && !Array.isArray(this.parsedData)) {
            this.jsonOutput.innerHTML = '<div class="empty-state">Select an array from the dropdown above to view as table</div>';
            return;
        }
        
        const data = path ? this.tableView.getValueAtPath(this.parsedData, path) : this.parsedData;
        this.jsonOutput.innerHTML = this.tableView.render(data);
    }

    async renderDiagram() {
        if (!this.parsedData) {
            this.jsonOutput.innerHTML = '<div class="empty-state">No data to visualize</div>';
            return;
        }

        const diagramType = this.diagramTypeSelect.value;
        const html = await this.diagramView.render(this.parsedData, diagramType);
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
        this.stats.textContent = `Size: ${this.formatBytes(size)} | Keys: ${keys} | Type: ${type}`;
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
            this.renderJSON();
        } catch (e) {
            alert('Invalid JSON: ' + e.message);
        }
    }

    minifyJSON() {
        try {
            const parsed = JSON.parse(this.jsonInput.value);
            this.jsonInput.value = JSON.stringify(parsed);
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
    }

    searchJSON() {
        const query = document.getElementById('search-input').value.toLowerCase();
        if (!query || !this.parsedData) {
            this.renderJSON();
            return;
        }

        this.renderJSON();
        
        if (this.currentView === 'tree') {
            const walker = document.createTreeWalker(this.jsonOutput, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue.toLowerCase().includes(query)) {
                    textNodes.push(node);
                }
            }

            textNodes.forEach(node => {
                const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
                const parts = node.nodeValue.split(regex);
                const fragment = document.createDocumentFragment();
                
                parts.forEach(part => {
                    if (part.toLowerCase() === query) {
                        const mark = document.createElement('span');
                        mark.className = 'highlight';
                        mark.textContent = part;
                        fragment.appendChild(mark);
                    } else {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                
                node.parentNode.replaceChild(fragment, node);
            });
        }
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app = new JSONViewerApp();
    window.diagramView = app.diagramView; // Make diagram view accessible for zoom controls
});
