// Table View Renderer
class TableView {
    constructor() {
        this.currentPath = '';
        this.tablePaths = [];
    }

    collectPaths(data, currentPath = '') {
        const paths = [];
        
        if (Array.isArray(data) && data.length > 0) {
            const objectCount = data.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item)).length;
            if (objectCount > 0) {
                const label = currentPath || 'root';
                paths.push({ path: currentPath, label: `${label} [${data.length} items]` });
            }
            
            data.forEach((item, index) => {
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    Object.keys(item).forEach(key => {
                        const newPath = currentPath ? `${currentPath}[${index}].${key}` : `[${index}].${key}`;
                        const childPaths = this.collectPaths(item[key], newPath);
                        paths.push(...childPaths);
                    });
                }
            });
        } else if (typeof data === 'object' && data !== null) {
            Object.keys(data).forEach(key => {
                const newPath = currentPath ? `${currentPath}.${key}` : key;
                const childPaths = this.collectPaths(data[key], newPath);
                paths.push(...childPaths);
            });
        }
        
        return paths;
    }

    getValueAtPath(data, path) {
        if (!path) return data;
        
        let current = data;
        const regex = /\[([0-9]+)\]|\.([^.\[]+)|([^.\[]+)/g;
        let match;
        
        while ((match = regex.exec(path)) !== null) {
            const key = match[1] || match[2] || match[3];
            if (current === null || current === undefined) return undefined;
            current = current[key];
        }
        
        return current;
    }

    render(data) {
        if (!Array.isArray(data)) {
            return '<div class="empty-state">Selected path is not an array</div>';
        }

        if (data.length === 0) {
            return '<div class="empty-state">Empty array</div>';
        }

        const objectItems = data.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        
        if (objectItems.length === 0) {
            return '<div class="empty-state">Array does not contain objects</div>';
        }

        const allKeys = new Set();
        objectItems.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
        const columns = Array.from(allKeys).sort();

        if (columns.length === 0) {
            return '<div class="empty-state">Objects have no properties</div>';
        }

        let html = '<div class="table-container"><table class="data-table">';
        
        html += '<thead><tr>';
        columns.forEach(col => {
            html += `<th>${this.escapeHtml(col)}</th>`;
        });
        html += '</tr></thead>';
        
        html += '<tbody>';
        objectItems.forEach((row, rowIndex) => {
            html += '<tr>';
            columns.forEach((col, colIndex) => {
                const cellValue = row[col];
                html += `<td>${this.formatCell(cellValue, rowIndex, colIndex)}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        
        return html;
    }

    formatCell(value, rowIndex, colIndex) {
        if (value === null) return '<span class="cell-null">null</span>';
        if (typeof value === 'boolean') return `<span class="cell-boolean">${value}</span>`;
        if (typeof value === 'number') return `<span class="cell-number">${value}</span>`;
        if (typeof value === 'string') return `<span class="cell-string">${this.escapeHtml(value)}</span>`;
        
        if (Array.isArray(value)) {
            const cellId = `cell-${rowIndex}-${colIndex}`;
            return `<div><span class="cell-object" onclick="toggleCellExpand('${cellId}')" id="${cellId}">[Array(${value.length})] <span class="expand-btn">▼</span></span><div class="cell-content" id="${cellId}-content" style="display:none;">${this.formatNestedJson(value)}</div></div>`;
        }
        
        if (typeof value === 'object') {
            const cellId = `cell-${rowIndex}-${colIndex}`;
            return `<div><span class="cell-object" onclick="toggleCellExpand('${cellId}')" id="${cellId}">{Object} <span class="expand-btn">▼</span></span><div class="cell-content" id="${cellId}-content" style="display:none;">${this.formatNestedJson(value)}</div></div>`;
        }
        
        return this.escapeHtml(String(value));
    }

    formatNestedJson(data, indent = 0) {
        const indentStr = '  '.repeat(indent);
        
        if (data === null) return `<span class="json-null">null</span>`;
        if (typeof data === 'boolean') return `<span class="json-boolean">${data}</span>`;
        if (typeof data === 'number') return `<span class="json-number">${data}</span>`;
        if (typeof data === 'string') return `<span class="json-string">"${this.escapeHtml(data)}"</span>`;
        
        if (Array.isArray(data)) {
            if (data.length === 0) return `<span class="json-bracket">[]</span>`;
            
            let html = `<span class="json-bracket">[</span>\n`;
            data.forEach((item, index) => {
                html += `${indentStr}  ${this.formatNestedJson(item, indent + 1)}`;
                if (index < data.length - 1) html += '<span class="json-bracket">,</span>';
                html += '\n';
            });
            html += `${indentStr}<span class="json-bracket">]</span>`;
            return html;
        }
        
        if (typeof data === 'object') {
            const keys = Object.keys(data);
            if (keys.length === 0) return `<span class="json-bracket">{}</span>`;
            
            let html = `<span class="json-bracket">{</span>\n`;
            keys.forEach((key, index) => {
                html += `${indentStr}  <span class="json-key">"${this.escapeHtml(key)}"</span><span class="json-bracket">:</span> ${this.formatNestedJson(data[key], indent + 1)}`;
                if (index < keys.length - 1) html += '<span class="json-bracket">,</span>';
                html += '\n';
            });
            html += `${indentStr}<span class="json-bracket">}</span>`;
            return html;
        }
        
        return this.escapeHtml(String(data));
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
