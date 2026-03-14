# JSON Viewer - Project Structure

## Overview
A powerful JSON visualization tool with Tree, Table, and Diagram views, featuring zoom/pan capabilities for large datasets.

## File Structure

```
jsonr/
├── index.html              # Main entry point
├── json-viewer.html        # Legacy single-file version (can be removed)
├── css/
│   ├── styles.css          # Base styles and layout
│   ├── tree-view.css       # Tree view specific styles
│   ├── table-view.css      # Table view specific styles
│   └── diagram-view.css    # Diagram view with zoom controls
└── js/
    ├── app.js              # Main application controller
    ├── tree-view.js        # Tree view renderer
    ├── table-view.js       # Table view renderer
    └── diagram-view.js     # Diagram view with zoom/pan
```

## Features

### Tree View (`tree-view.js`)
- Hierarchical JSON visualization
- Collapsible nodes
- Syntax highlighting
- "View as Table" buttons for arrays

### Table View (`table-view.js`)
- Tabular display for arrays of objects
- Path selector for nested arrays
- Expandable nested objects/arrays in cells
- Syntax highlighted cell content

### Diagram View (`diagram-view.js`)
- **Zoom & Pan Controls**:
  - Mouse wheel to zoom in/out
  - Click and drag to pan around
  - Zoom controls (+ / - / reset) in bottom-right
  - Zoom level indicator
- Three diagram types:
  - Tree Hierarchy
  - Entity Relationship
  - Mind Map
- Powered by Mermaid.js

## Zoom & Pan Features

The diagram view includes:
- **Zoom In/Out**: Use `+` and `−` buttons or mouse wheel
- **Pan**: Click and drag to move around large diagrams
- **Reset**: `⟲` button to restore original position
- **Zoom Level**: Shows current zoom percentage (10%-300%)
- **Smooth Transitions**: Fluid zoom and pan animations

## Usage

Simply open `index.html` in a browser. All files are self-contained except for Mermaid.js which loads from CDN.

## Maintenance

Each view is now in its own file:
- Modify tree rendering: `js/tree-view.js`
- Modify table rendering: `js/table-view.js`
- Modify diagram rendering: `js/diagram-view.js`
- Modify app logic: `js/app.js`
- Modify styles: `css/*.css`
