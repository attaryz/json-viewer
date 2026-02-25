// Diagram View with Zoom and Pan
class DiagramView {
    constructor() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
        this.diagramType = 'tree';
    }

    async render(data, type = 'tree') {
        this.diagramType = type;
        
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
        let result = 'graph TD\n';
        result += `    root["📄 JSON Data"]\n`;
        result += this.generateTreeNodes(data, 'root', 1);
        return result;
    }

    generateTreeNodes(data, parentId, level) {
        let result = '';

        if (Array.isArray(data)) {
            if (data.length === 0) return '';
            
            data.slice(0, 10).forEach((item, index) => {
                const nodeId = `${parentId}_arr${index}`;
                const label = typeof item === 'object' ? `Item ${index}` : String(item).substring(0, 30);
                result += `    ${nodeId}["${this.escapeForMermaid(label)}"]\n`;
                result += `    ${parentId} --> ${nodeId}\n`;
                
                if (typeof item === 'object' && item !== null) {
                    result += this.generateTreeNodes(item, nodeId, level + 1);
                }
            });
            
            if (data.length > 10) {
                const moreId = `${parentId}_more`;
                result += `    ${moreId}["... ${data.length - 10} more"]\n`;
                result += `    ${parentId} --> ${moreId}\n`;
            }
        } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data).slice(0, 15);
            keys.forEach(key => {
                const nodeId = `${parentId}_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const value = data[key];
                
                if (typeof value === 'object' && value !== null) {
                    const preview = Array.isArray(value) ? `📋 ${key} [${value.length}]` : `📦 ${key}`;
                    result += `    ${nodeId}["${this.escapeForMermaid(preview)}"]\n`;
                    result += `    ${parentId} --> ${nodeId}\n`;
                    result += this.generateTreeNodes(value, nodeId, level + 1);
                } else {
                    const valueStr = value === null ? 'null' : String(value).substring(0, 30);
                    result += `    ${nodeId}["🔑 ${this.escapeForMermaid(key)}: ${this.escapeForMermaid(valueStr)}"]\n`;
                    result += `    ${parentId} --> ${nodeId}\n`;
                }
            });
            
            if (Object.keys(data).length > 15) {
                const moreId = `${parentId}_more`;
                result += `    ${moreId}["... ${Object.keys(data).length - 15} more"]\n`;
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
                Object.keys(sample).forEach(key => {
                    const value = sample[key];
                    const type = this.getType(value);
                    result += `        ${type} ${key}\n`;
                });
                result += '    }\n';
            }
        } else if (typeof data === 'object' && data !== null) {
            const entities = new Map();
            
            Object.keys(data).forEach(key => {
                const value = data[key];
                if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                    entities.set(key, value[0]);
                } else if (typeof value === 'object' && value !== null) {
                    entities.set(key, value);
                }
            });

            if (entities.size === 0) {
                result += '    ENTITY {\n';
                Object.keys(data).slice(0, 10).forEach(key => {
                    const type = this.getType(data[key]);
                    result += `        ${type} ${key}\n`;
                });
                result += '    }\n';
            } else {
                entities.forEach((sample, entityName) => {
                    result += `    ${entityName.toUpperCase()} {\n`;
                    Object.keys(sample).slice(0, 10).forEach(key => {
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
        result += this.generateMindMapNodes(data, 2);
        return result;
    }

    generateMindMapNodes(data, indent, maxItems = 10) {
        let result = '';
        const indentStr = '  '.repeat(indent);

        if (Array.isArray(data)) {
            const items = data.slice(0, maxItems);
            items.forEach((item, index) => {
                if (typeof item === 'object' && item !== null) {
                    result += `${indentStr}Item ${index}\n`;
                    result += this.generateMindMapNodes(item, indent + 1, 5);
                } else {
                    const valueStr = String(item).substring(0, 30);
                    result += `${indentStr}${this.escapeForMermaid(valueStr)}\n`;
                }
            });
            if (data.length > maxItems) {
                result += `${indentStr}... ${data.length - maxItems} more\n`;
            }
        } else if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data).slice(0, maxItems);
            keys.forEach(key => {
                const value = data[key];
                if (typeof value === 'object' && value !== null) {
                    const preview = Array.isArray(value) ? `${key} [${value.length}]` : key;
                    result += `${indentStr}${this.escapeForMermaid(preview)}\n`;
                    result += this.generateMindMapNodes(value, indent + 1, 5);
                } else {
                    const valueStr = value === null ? 'null' : String(value).substring(0, 30);
                    result += `${indentStr}${this.escapeForMermaid(key)}: ${this.escapeForMermaid(valueStr)}\n`;
                }
            });
            if (Object.keys(data).length > maxItems) {
                result += `${indentStr}... ${Object.keys(data).length - maxItems} more\n`;
            }
        }

        return result;
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
