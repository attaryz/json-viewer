// Tree View Renderer
class TreeView {
    constructor() {
        this.searchQuery = '';
    }

    render(data, key = '', isLast = true, path = '') {
        const currentPath = path || (key || 'root');
        
        if (data === null) {
            return this.renderLeaf(key, 'null', 'json-null', isLast);
        }
        
        if (typeof data === 'boolean') {
            return this.renderLeaf(key, data, 'json-boolean', isLast);
        }
        
        if (typeof data === 'number') {
            return this.renderLeaf(key, data, 'json-number', isLast);
        }
        
        if (typeof data === 'string') {
            return this.renderLeaf(key, `"${this.escapeHtml(data)}"`, 'json-string', isLast);
        }
        
        if (Array.isArray(data)) {
            return this.renderArrayNode(key, data, isLast, currentPath);
        }
        
        if (typeof data === 'object') {
            return this.renderObjectNode(key, data, isLast, currentPath);
        }
        
        return this.renderLeaf(key, String(data), '', isLast);
    }

    renderLeaf(key, value, className, isLast) {
        const keyHtml = key !== null ? `<span class="tree-key">"${key}"</span><span class="tree-colon">:</span>` : '';
        const comma = isLast ? '' : '<span class="tree-comma">,</span>';
        return `<div class="tree-line"><span class="tree-toggle leaf"></span>${keyHtml}<span class="${className}">${value}</span>${comma}</div>`;
    }

    renderArrayNode(key, data, isLast, path) {
        const keyHtml = key !== null ? `<span class="tree-key">"${key}"</span><span class="tree-colon">:</span>` : '';
        const comma = isLast ? '' : '<span class="tree-comma">,</span>';
        const preview = data.length === 0 ? '[]' : `[${data.length}]`;
        const canTableView = data.length > 0 && data.some(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        const tableBtn = canTableView ? `<button class="btn btn-small btn-secondary view-as-table-btn" onclick="viewAsTable('${path}')">View as Table</button>` : '';
        
        if (data.length === 0) {
            return `<div class="tree-line"><span class="tree-toggle leaf"></span>${keyHtml}<span class="json-bracket">[]</span>${comma}${tableBtn}</div>`;
        }
        
        let html = `<div class="tree-line">`;
        html += `<span class="tree-toggle"></span>${keyHtml}<span class="json-bracket">[</span><span class="tree-preview">${preview}</span>${comma}${tableBtn}</div>`;
        html += `<div class="tree-content tree-node">`;
        
        data.forEach((item, index) => {
            const itemPath = `${path}[${index}]`;
            html += this.render(item, null, index === data.length - 1, itemPath);
        });
        
        html += `</div>`;
        return html;
    }

    renderObjectNode(key, data, isLast, path) {
        const keys = Object.keys(data);
        const keyHtml = key !== null ? `<span class="tree-key">"${key}"</span><span class="tree-colon">:</span>` : '';
        const comma = isLast ? '' : '<span class="tree-comma">,</span>';
        const preview = keys.length === 0 ? '{}' : `{${keys.length}}`;
        
        if (keys.length === 0) {
            return `<div class="tree-line"><span class="tree-toggle leaf"></span>${keyHtml}<span class="json-bracket">{}</span>${comma}</div>`;
        }
        
        let html = `<div class="tree-line">`;
        html += `<span class="tree-toggle"></span>${keyHtml}<span class="json-bracket">{</span><span class="tree-preview">${preview}</span>${comma}</div>`;
        html += `<div class="tree-content tree-node">`;
        
        keys.forEach((k, index) => {
            const childPath = path ? `${path}.${k}` : k;
            html += this.render(data[k], k, index === keys.length - 1, childPath);
        });
        
        html += `</div>`;
        return html;
    }

    addEventListeners() {
        document.querySelectorAll('.tree-toggle:not(.leaf)').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggle.classList.toggle('collapsed');
                const content = toggle.closest('.tree-line').nextElementSibling;
                if (content && content.classList.contains('tree-content')) {
                    content.classList.toggle('collapsed');
                }
            });
        });
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
