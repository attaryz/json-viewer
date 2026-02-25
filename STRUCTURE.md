# JSON Viewer

A lightweight web application for visualizing JSON data with multiple render views and interactive controls.

---

## Directory Layout

The project root contains the following key files and folders:

```
/
├── index.html              # Main entry point (loads app.js and styles)
├── css/
│   ├── styles.css          # Base styles and layout
│   ├── tree-view.css       # Styles for the tree view
│   ├── table-view.css      # Styles for the table view
│   └── diagram-view.css    # Zoom/pan controls for diagram view
└── js/
    ├── app.js              # Main application controller
    ├── tree-view.js        # Tree view renderer
    ├── table-view.js       # Table view renderer
    └── diagram-view.js     # Diagram view with zoom/pan
```


---

## Features

### Tree View
Implemented in `js/tree-view.js`.
- Displays JSON hierarchies with expandable/collapsible nodes
- Syntax highlighting for values
- Quick "View as Table" option for arrays

### Table View
Implemented in `js/table-view.js`.
- Renders arrays of objects in a spreadsheet-like format
- Supports selecting nested array paths
- Cells can expand to show nested objects/arrays
- Syntax highlighting within cells

### Diagram View
Implemented in `js/diagram-view.js`.
- Renders JSON as diagrams powered by Mermaid.js
- Three diagram types: **Tree Hierarchy**, **Entity Relationship**, **Mind Map**
- Integrated zoom & pan controls (see below)

---

## Diagram Zoom & Pan

Users can interact with diagrams using:

1. **Zoom**
   - Mouse wheel or `+` / `−` buttons to adjust scale (10 – 300%)
2. **Pan**
   - Click‑and‑drag to move the viewport
3. **Reset**
   - `⟲` button restores original position and zoom
4. **Indicator**
   - Current zoom level displayed in the control overlay

Transitions are smooth to maintain context when navigating large graphs.

---

## Usage

Open `index.html` in any modern browser. The app is self‑contained except for the Mermaid.js CDN dependency used by the diagram view.

---

## Maintenance Notes

- **Tree rendering**: `js/tree-view.js`
- **Table rendering**: `js/table-view.js`
- **Diagram rendering**: `js/diagram-view.js`
- **Application logic**: `js/app.js`
- **Styling**: files under `css/`

Keeping each view in a separate file simplifies updates and testing.
