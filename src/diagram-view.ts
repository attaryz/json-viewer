// @ts-nocheck
// Diagram View with Zoom and Pan
declare const mermaid: any;

export class DiagramView {
    zoom: number;
    panX: number;
    panY: number;
    isDragging: boolean;
    startX: number;
    startY: number;
    diagramType: string;
    options: any;
    nodeCount: number;
    nodeMap: Map<string, string>;

    constructor() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.diagramType = 'tree';
        this.options = { maxDepth: 6, maxNodes: 400, includeKeys: [], excludeKeys: [] };
        this.nodeCount = 0;
        this.nodeMap = new Map();
    }

    async render(data, type = 'tree', options = {}) {
        this.diagramType = type;
        this.nodeCount = 0;
        this.nodeMap = new Map();
        this.options = this.normalizeOptions(options);
        
        if (!data) {
            return '<div class="empty-state">No data to visualize</div>';
        }

        let mermaidCode = '';
        
        try {
            switch (type) {
                case 'tree':
                    mermaidCode = this.generateTreeDiagram(data);
                    break;
                case 'entity':
                    mermaidCode = this.generateEntityDiagram(data);
                    break;
                case 'mindmap':
                    mermaidCode = this.generateMindMap(data);
                    break;
            }

            const id = 'mermaid-' + Date.now();
            const html = `
                <div class="diagram-container">
                    <div class="diagram-viewport" id="diagram-viewport">
                        <div class="diagram-content" id="diagram-content">
                            <div id="${id}" class="mermaid">${mermaidCode}</div>
                        </div>
                    </div>
                    <div class="diagram-minimap" id="diagram-minimap">
                        <div class="minimap-viewport" id="minimap-viewport"></div>
                    </div>
                    <div class="diagram-zoom-controls">
                        <button class="zoom-btn" onclick="diagramView.zoomIn()" title="Zoom In">+</button>
                        <div class="zoom-level" id="zoom-level">100%</div>
                        <button class="zoom-btn" onclick="diagramView.zoomOut()" title="Zoom Out">−</button>
                        <button class="zoom-btn" onclick="diagramView.resetZoom()" title="Reset">⟲</button>
                    </div>
                </div>
            `;
            
            return html;
        } catch (e) {
            return `<div class="error">Failed to render diagram: ${e.message}</div>`;
        }
    }

    async renderMermaid(containerId) {
        try {
            await mermaid.run({ nodes: [document.getElementById(containerId)] });
            this.initializeZoomPan();
            this.attachNodeClicks();
            this.updateMinimap();
            this.fitToViewport();
        } catch (e) {
            console.error('Mermaid render error:', e);
        }
    }

    initializeZoomPan() {
        const viewport = document.getElementById('diagram-viewport');
        const content = document.getElementById('diagram-content');
        
        if (!viewport || !content) return;

        // Mouse wheel zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoom = Math.max(0.1, Math.min(3, this.zoom + delta));
            this.updateTransform();
        });

        // Pan with mouse drag
        viewport.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            viewport.style.cursor = 'grabbing';
        });

        viewport.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.updateTransform();
        });

        viewport.addEventListener('mouseup', () => {
            this.isDragging = false;
            viewport.style.cursor = 'grab';
        });

        viewport.addEventListener('mouseleave', () => {
            this.isDragging = false;
            viewport.style.cursor = 'grab';
        });
    }

    updateTransform() {
        const content = document.getElementById('diagram-content');
        if (content) {
            content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        }
        
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
        }
        this.updateMinimap();
    }

    zoomIn() {
        this.zoom = Math.min(3, this.zoom + 0.2);
        this.updateTransform();
    }

    zoomOut() {
        this.zoom = Math.max(0.1, this.zoom - 0.2);
        this.updateTransform();
    }

    resetZoom() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
    }

    generateTreeDiagram(data) {
        const layout = this.options.layout || 'LR';
        let result = `graph ${layout}\n`;
        const rootId = this.makeNodeId('root');
        this.addNode(rootId, 'root');
        result += `    ${rootId}["JSON Data"]\n`;
        result += this.generateTreeNodes(data, rootId, 1, 'root');
        return result;
    }

    generateTreeNodes(data, parentId, level, path) {
        let result = '';
        if (level > this.options.maxDepth) {
            const id = this.makeNodeId(`${path}.__maxdepth`);
            this.addNode(id, path);
            return `    ${parentId} --> ${id}\n    ${id}["Max depth"]\n`;
        }

        if (Array.isArray(data)) {
            if (data.length === 0) return '';
            
            const maxItems = Math.min(data.length, this.remainingNodes());
            for (let index = 0; index < maxItems; index++) {
                const item = data[index];
                const itemPath = `${path}[${index}]`;
                const nodeId = this.makeNodeId(itemPath);
                this.addNode(nodeId, itemPath);
                const label = typeof item === 'object' ? `Item ${index}` : String(item).substring(0, 30);
                result += `    ${nodeId}["${this.escapeForMermaid(label)}"]\n`;
                result += `    ${parentId} --> ${nodeId}\n`;
                
                if (typeof item === 'object' && item !== null) {
                    result += this.generateTreeNodes(item, nodeId, level + 1, itemPath);
                }
            }
            
            if (data.length > maxItems) {
                const moreId = this.makeNodeId(`${path}.__more`);
                this.addNode(moreId, path);
                result += `    ${moreId}["... ${data.length - maxItems} more"]\n`;
                result += `    ${parentId} --> ${moreId}\n`;
            }
        } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data).filter(key => this.shouldIncludeKey(key));
            const maxItems = Math.min(keys.length, this.remainingNodes());
            keys.slice(0, maxItems).forEach(key => {
                const childPath = path === 'root' ? key : `${path}.${key}`;
                const nodeId = this.makeNodeId(childPath);
                this.addNode(nodeId, childPath);
                const value = data[key];
                
                if (typeof value === 'object' && value !== null) {
                    const preview = Array.isArray(value) ? `${key} [${value.length}]` : `${key}`;
                    result += `    ${nodeId}["${this.escapeForMermaid(preview)}"]\n`;
                    result += `    ${parentId} --> ${nodeId}\n`;
                    result += this.generateTreeNodes(value, nodeId, level + 1, childPath);
                } else {
                    const valueStr = value === null ? 'null' : String(value).substring(0, 30);
                    result += `    ${nodeId}["${this.escapeForMermaid(key)}: ${this.escapeForMermaid(valueStr)}"]\n`;
                    result += `    ${parentId} --> ${nodeId}\n`;
                }
            });
            
            if (keys.length > maxItems) {
                const moreId = this.makeNodeId(`${path}.__more`);
                this.addNode(moreId, path);
                result += `    ${moreId}["... ${keys.length - maxItems} more"]\n`;
                result += `    ${parentId} --> ${moreId}\n`;
            }
        }

        return result;
    }

    generateEntityDiagram(data) {
        let result = 'erDiagram\n';
        
        if (Array.isArray(data) && data.length > 0) {
            const sample = data[0];
            if (typeof sample === 'object' && sample !== null) {
                result += '    ENTITY {\n';
                Object.keys(sample).filter(key => this.shouldIncludeKey(key)).forEach(key => {
                    const value = sample[key];
                    const type = this.getType(value);
                    result += `        ${type} ${key}\n`;
                });
                result += '    }\n';
            }
        } else if (typeof data === 'object' && data !== null) {
            const entities = new Map();
            
            Object.keys(data).filter(key => this.shouldIncludeKey(key)).forEach(key => {
                const value = data[key];
                if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                    entities.set(key, value[0]);
                } else if (typeof value === 'object' && value !== null) {
                    entities.set(key, value);
                }
            });

            if (entities.size === 0) {
                result += '    ENTITY {\n';
                Object.keys(data).filter(key => this.shouldIncludeKey(key)).slice(0, 10).forEach(key => {
                    const type = this.getType(data[key]);
                    result += `        ${type} ${key}\n`;
                });
                result += '    }\n';
            } else {
                entities.forEach((sample, entityName) => {
                    result += `    ${entityName.toUpperCase()} {\n`;
                    Object.keys(sample).filter(key => this.shouldIncludeKey(key)).slice(0, 10).forEach(key => {
                        const type = this.getType(sample[key]);
                        result += `        ${type} ${key}\n`;
                    });
                    result += '    }\n';
                });
            }
        }

        return result;
    }

    generateMindMap(data) {
        let result = 'mindmap\n  root((JSON Data))\n';
        this.nodeCount += 1;
        result += this.generateMindMapNodes(data, 2, 'root', 1);
        return result;
    }

    generateMindMapNodes(data, indent, path, level, maxItems = 10) {
        let result = '';
        const indentStr = '  '.repeat(indent);
        if (level > this.options.maxDepth) {
            return `${indentStr}Max depth\n`;
        }

        if (Array.isArray(data)) {
            const items = data.slice(0, Math.min(maxItems, this.remainingNodes()));
            items.forEach((item, index) => {
                if (this.remainingNodes() <= 0) return;
                if (typeof item === 'object' && item !== null) {
                    this.nodeCount += 1;
                    result += `${indentStr}Item ${index}\n`;
                    result += this.generateMindMapNodes(item, indent + 1, `${path}[${index}]`, level + 1, 5);
                } else {
                    const valueStr = String(item).substring(0, 30);
                    this.nodeCount += 1;
                    result += `${indentStr}${this.escapeForMermaid(valueStr)}\n`;
                }
            });
            if (data.length > maxItems) {
                result += `${indentStr}... ${data.length - maxItems} more\n`;
            }
        } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data).filter(key => this.shouldIncludeKey(key)).slice(0, maxItems);
            keys.forEach(key => {
                if (this.remainingNodes() <= 0) return;
                const value = data[key];
                if (typeof value === 'object' && value !== null) {
                    const preview = Array.isArray(value) ? `${key} [${value.length}]` : key;
                    this.nodeCount += 1;
                    result += `${indentStr}${this.escapeForMermaid(preview)}\n`;
                    result += this.generateMindMapNodes(value, indent + 1, `${path}.${key}`, level + 1, 5);
                } else {
                    const valueStr = value === null ? 'null' : String(value).substring(0, 30);
                    this.nodeCount += 1;
                    result += `${indentStr}${this.escapeForMermaid(key)}: ${this.escapeForMermaid(valueStr)}\n`;
                }
            });
            if (Object.keys(data).length > maxItems) {
                result += `${indentStr}... ${Object.keys(data).length - maxItems} more\n`;
            }
        }

        return result;
    }

    normalizeOptions(options) {
        const includeKeys = String(options.includeKeys || '').split(',').map(s => s.trim()).filter(Boolean);
        const excludeKeys = String(options.excludeKeys || '').split(',').map(s => s.trim()).filter(Boolean);
        return {
            maxDepth: Number(options.maxDepth || 6),
            maxNodes: Number(options.maxNodes || 400),
            includeKeys,
            excludeKeys,
            layout: options.layout || 'LR'
        };
    }

    shouldIncludeKey(key) {
        if (this.options.includeKeys.length > 0 && !this.options.includeKeys.includes(key)) return false;
        if (this.options.excludeKeys.includes(key)) return false;
        return true;
    }

    remainingNodes() {
        return Math.max(0, this.options.maxNodes - this.nodeCount);
    }

    makeNodeId(path) {
        return `n_${this.hash(path)}`;
    }

    addNode(id, path) {
        this.nodeCount += 1;
        this.nodeMap.set(id, path);
        this.nodeMap.set(`flowchart-${id}`, path);
    }

    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    attachNodeClicks() {
        const svg = document.querySelector('.diagram-content svg');
        if (!svg) return;
        svg.querySelectorAll('g.node').forEach(node => {
            const id = node.getAttribute('id');
            const path = this.nodeMap.get(id);
            if (!path) return;
            node.style.cursor = 'pointer';
            node.addEventListener('click', () => {
                if (window.app && typeof window.app.setCurrentPath === 'function') {
                    window.app.setCurrentPath(path);
                }
            });
        });
    }

    highlight(query) {
        const svg = document.querySelector('.diagram-content svg');
        if (!svg) return;
        const q = String(query || '').toLowerCase();
        svg.querySelectorAll('text').forEach(text => {
            const match = q && text.textContent.toLowerCase().includes(q);
            text.classList.toggle('diagram-highlight', match);
        });
    }

    updateMinimap() {
        const minimap = document.getElementById('diagram-minimap');
        const viewportEl = document.getElementById('diagram-viewport');
        const svg = document.querySelector('.diagram-content svg');
        const viewportBox = document.getElementById('minimap-viewport');
        if (!minimap || !viewportEl || !svg || !viewportBox) return;

        if (!minimap.querySelector('svg')) {
            const clone = svg.cloneNode(true);
            clone.removeAttribute('width');
            clone.removeAttribute('height');
            minimap.insertBefore(clone, viewportBox);
        }

        const bbox = svg.getBBox();
        if (!bbox.width || !bbox.height) return;
        const miniW = minimap.clientWidth;
        const miniH = minimap.clientHeight;
        const scaleX = miniW / bbox.width;
        const scaleY = miniH / bbox.height;
        const scale = Math.min(scaleX, scaleY);
        const viewW = viewportEl.clientWidth / this.zoom;
        const viewH = viewportEl.clientHeight / this.zoom;
        const viewX = (-this.panX) / this.zoom;
        const viewY = (-this.panY) / this.zoom;
        viewportBox.style.width = `${viewW * scale}px`;
        viewportBox.style.height = `${viewH * scale}px`;
        viewportBox.style.left = `${(viewX - bbox.x) * scale}px`;
        viewportBox.style.top = `${(viewY - bbox.y) * scale}px`;
    }

    fitToViewport() {
        const viewport = document.getElementById('diagram-viewport');
        const content = document.querySelector('.diagram-content svg');
        if (!viewport || !content) return;
        const bbox = content.getBBox();
        if (!bbox.width || !bbox.height) return;
        const viewW = viewport.clientWidth;
        const viewH = viewport.clientHeight;
        const scale = Math.min(viewW / (bbox.width + 40), viewH / (bbox.height + 40));
        this.zoom = Math.max(0.1, Math.min(2, scale));
        this.panX = (viewW - bbox.width * this.zoom) / 2 - bbox.x * this.zoom;
        this.panY = (viewH - bbox.height * this.zoom) / 2 - bbox.y * this.zoom;
        this.updateTransform();
    }

    getType(value) {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        return 'string';
    }

    escapeForMermaid(str) {
        return String(str)
            .replace(/"/g, '')
            .replace(/\[/g, '')
            .replace(/\]/g, '')
            .replace(/\(/g, '')
            .replace(/\)/g, '')
            .substring(0, 50);
    }
}
