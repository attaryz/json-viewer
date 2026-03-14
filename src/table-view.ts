// @ts-nocheck
import { createGrid, AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Table View Renderer using AG Grid
export class TableView {
    currentPath: string;
    tablePaths: any[];
    gridApi: any;

    constructor() {
        this.currentPath = '';
        this.tablePaths = [];
        this.gridApi = null;
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

    formatValue(params) {
        const val = params.value;
        if (val === null) return 'null';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    }

    render(data, container, options = {}) {
        if (!Array.isArray(data)) {
            container.innerHTML = '<div class="empty-state text-center text-text-muted py-10">Selected path is not an array</div>';
            return;
        }

        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state text-center text-text-muted py-10">Empty array</div>';
            return;
        }

        let objectItems = data.filter(item => typeof item === 'object' && item !== null && !Array.isArray(item));
        
        if (objectItems.length === 0) {
            container.innerHTML = '<div class="empty-state text-center text-text-muted py-10">Array does not contain objects</div>';
            return;
        }

        const allKeys = new Set();
        objectItems.forEach(item => Object.keys(item).forEach(key => allKeys.add(key)));
        const columns = Array.from(allKeys).sort();

        if (columns.length === 0) {
            container.innerHTML = '<div class="empty-state text-center text-text-muted py-10">Objects have no properties</div>';
            return;
        }

        // AG Grid setup
        const columnDefs = [
            {
                headerName: '#',
                valueGetter: 'node.rowIndex + 1',
                width: 60,
                pinned: 'left',
                sortable: false,
                filter: false,
                resizable: false
            },
            ...columns.map(col => ({
                field: col,
                headerName: col,
                sortable: true,
                filter: true,
                resizable: true,
                valueFormatter: this.formatValue,
            }))
        ];

        const gridOptions = {
            rowData: objectItems,
            columnDefs: columnDefs,
            defaultColDef: {
                flex: 1,
                minWidth: 100,
                autoHeight: true
            },
            theme: "legacy", 
            quickFilterText: options.filter || "",
            onRowClicked: (event) => {
                if (window.app && window.app.showRowDetails) {
                    window.app.showRowDetails(event.data);
                }
            }
        };

        if (this.gridApi) {
            this.gridApi.destroy();
        }

        this.gridApi = createGrid(container, gridOptions);
    }
}
