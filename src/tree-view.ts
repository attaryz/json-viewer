// @ts-nocheck
// Tree View Renderer
export class TreeView {
    searchQuery: string;

    constructor() {
        this.searchQuery = '';
    }

    render(data, key = '', isLast = true, path = '', depth = 0) {
        const currentPath = path || (key || 'root');
        
        if (data === null) {
            return this.renderLeaf(key, 'null', 'text-amber-500', isLast, currentPath, depth);
        }
        if (typeof data === 'boolean') {
            return this.renderLeaf(key, data, 'text-purple-400 font-bold', isLast, currentPath, depth);
        }
        if (typeof data === 'number') {
            return this.renderLeaf(key, data, 'text-rose-400 font-bold', isLast, currentPath, depth);
        }
        if (typeof data === 'string') {
            const hasLink = data.startsWith('http://') || data.startsWith('https://');
            const val = hasLink ? `<a href="${this.escapeHtml(data)}" target="_blank" class="text-blue-400 hover:underline">"${this.escapeHtml(data)}"</a>` : `"${this.escapeHtml(data)}"`;
            return this.renderLeaf(key, val, 'text-emerald-400', isLast, currentPath, depth);
        }
        if (Array.isArray(data)) {
            return this.renderArrayNode(key, data, isLast, currentPath, depth);
        }
        if (typeof data === 'object') {
            return this.renderObjectNode(key, data, isLast, currentPath, depth);
        }
        return this.renderLeaf(key, String(data), '', isLast, currentPath, depth);
    }

    renderLeaf(key, value, valueClass, isLast, path, depth) {
        const indentSpan = `<span class="inline-block" style="width: ${depth * 20 + 20}px"></span>`;
        const keyHtml = key !== null && key !== '' ? `<span class="text-sky-300 font-medium whitespace-pre break-all">"${key}"</span><span class="text-gray-400 mr-2">:</span>` : '';
        const comma = isLast ? '' : '<span class="text-gray-400">,</span>';
        
        return `
            <div class="hover:bg-[#2a2d36] py-[2px] cursor-pointer text-[13px] leading-snug flex items-start tree-line" data-path="${this.escapeHtml(path)}" data-depth="${depth}">
                <div class="flex select-none">${indentSpan}</div>
                <div class="flex-1 break-all">
                    ${keyHtml}<span class="${valueClass} whitespace-pre-wrap">${value}</span>${comma}
                </div>
            </div>
        `;
    }

    renderArrayNode(key, data, isLast, path, depth) {
        const indentSpan = `<span class="inline-block" style="width: ${depth * 20}px"></span>`;
        const toggleIcon = `<i data-lucide="chevron-down" class="tree-toggle w-3.5 h-3.5 text-gray-400 hover:text-white cursor-pointer inline-block align-text-bottom mr-1 transition-transform"></i>`;
        
        const keyHtml = key !== null && key !== '' ? `<span class="text-sky-300 font-medium whitespace-pre break-all">"${key}"</span><span class="text-gray-400 mr-2">:</span>` : '';
        const comma = isLast ? '' : '<span class="text-gray-400">,</span>';
        
        if (data.length === 0) {
            const emptyIndent = `<span class="inline-block" style="width: ${depth * 20 + 20}px"></span>`;
            return `
                <div class="hover:bg-[#2a2d36] py-[2px] text-[13px] leading-snug flex items-start tree-line" data-path="${this.escapeHtml(path)}" data-depth="${depth}">
                    <div class="flex select-none">${emptyIndent}</div>
                    <div class="flex-1">${keyHtml}<span class="text-gray-400">[]</span>${comma}</div>
                </div>
            `;
        }

        const canTableView = data.some(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        const tableBtn = canTableView ? `<button class="ml-4 text-[10px] px-1.5 py-0.5 rounded border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-gray-200 transition-colors bg-[#1e222a]" onclick="window.app.switchView('table'); window.app.renderTableForPath('${path}')">Table</button>` : '';

        let html = `
            <div class="hover:bg-[#2a2d36] py-[2px] text-[13px] leading-snug flex items-start tree-line" data-path="${this.escapeHtml(path)}" data-depth="${depth}">
                <div class="flex select-none">${indentSpan}${toggleIcon}</div>
                <div class="flex-1">
                    ${keyHtml}<span class="text-gray-400">[</span>
                    <span class="tree-preview text-gray-500 italic text-xs ml-1 hidden">Array(${data.length})</span>
                    ${tableBtn}
                </div>
            </div>
            <div class="tree-content border-l border-gray-700/50" style="margin-left: ${depth * 20}px">
        `;

        data.forEach((item, index) => {
            const itemPath = `${path}[${index}]`;
            html += this.render(item, '', index === data.length - 1, itemPath, depth + 1);
        });

        const closeIndent = `<span class="inline-block" style="width: ${depth * 20 + 20}px"></span>`;
        html += `
            </div>
            <div class="hover:bg-[#2a2d36] py-[2px] text-[13px] leading-snug flex items-start tree-close" data-depth="${depth}">
                <div class="flex select-none">${closeIndent}</div>
                <div class="flex-1"><span class="text-gray-400">]</span>${comma}</div>
            </div>
        `;
        return html;
    }

    renderObjectNode(key, data, isLast, path, depth) {
        const keys = Object.keys(data);
        const indentSpan = `<span class="inline-block" style="width: ${depth * 20}px"></span>`;
        const toggleIcon = `<i data-lucide="chevron-down" class="tree-toggle w-3.5 h-3.5 text-gray-400 hover:text-white cursor-pointer inline-block align-text-bottom mr-1 transition-transform"></i>`;
        
        const keyHtml = key !== null && key !== '' ? `<span class="text-sky-300 font-medium whitespace-pre break-all">"${key}"</span><span class="text-gray-400 mr-2">:</span>` : '';
        const comma = isLast ? '' : '<span class="text-gray-400">,</span>';
        
        if (keys.length === 0) {
            const emptyIndent = `<span class="inline-block" style="width: ${depth * 20 + 20}px"></span>`;
            return `
                <div class="hover:bg-[#2a2d36] py-[2px] text-[13px] leading-snug flex items-start tree-line" data-path="${this.escapeHtml(path)}" data-depth="${depth}">
                    <div class="flex select-none">${emptyIndent}</div>
                    <div class="flex-1">${keyHtml}<span class="text-gray-400">{}</span>${comma}</div>
                </div>
            `;
        }

        let html = `
            <div class="hover:bg-[#2a2d36] py-[2px] text-[13px] leading-snug flex items-start tree-line" data-path="${this.escapeHtml(path)}" data-depth="${depth}">
                <div class="flex select-none">${indentSpan}${toggleIcon}</div>
                <div class="flex-1">
                    ${keyHtml}<span class="text-gray-400">{</span>
                    <span class="tree-preview text-gray-500 italic text-xs ml-1 hidden">Object(${keys.length})</span>
                </div>
            </div>
            <div class="tree-content border-l border-gray-700/50" style="margin-left: ${depth * 20}px">
        `;

        keys.forEach((k, index) => {
            const childPath = path ? `${path}.${k}` : k;
            html += this.render(data[k], k, index === keys.length - 1, childPath, depth + 1);
        });

        const closeIndent = `<span class="inline-block" style="width: ${depth * 20 + 20}px"></span>`;
        html += `
            </div>
            <div class="hover:bg-[#2a2d36] py-[2px] text-[13px] leading-snug flex items-start tree-close" data-depth="${depth}">
                <div class="flex select-none">${closeIndent}</div>
                <div class="flex-1"><span class="text-gray-400">}</span>${comma}</div>
            </div>
        `;
        return html;
    }

    addEventListeners() {
        if (window.lucide) {
             window.lucide.createIcons();
        }
        document.querySelectorAll('.tree-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const line = toggle.closest('.tree-line');
                const content = line.nextElementSibling;
                const closeBrace = content.nextElementSibling;
                const preview = line.querySelector('.tree-preview');

                if (content && content.classList.contains('tree-content')) {
                    const isCollapsed = content.classList.contains('hidden');
                    
                    if (isCollapsed) {
                        content.classList.remove('hidden');
                        if (closeBrace && closeBrace.classList.contains('tree-close')) closeBrace.classList.remove('hidden');
                        toggle.classList.remove('-rotate-90');
                        if (preview) preview.classList.add('hidden');
                    } else {
                        content.classList.add('hidden');
                        if (closeBrace && closeBrace.classList.contains('tree-close')) closeBrace.classList.add('hidden');
                        toggle.classList.add('-rotate-90');
                        if (preview) preview.classList.remove('hidden');
                    }
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
