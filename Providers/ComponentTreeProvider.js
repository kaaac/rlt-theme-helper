const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

/**
 * Tree Data Provider for RLT Theme Components
 */
class ComponentTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    /**
     * Refresh the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item for display
     */
    getTreeItem(element) {
        return element;
    }

    /**
     * Get children of tree item
     */
    getChildren(element) {
        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'json') {
            return Promise.resolve([
                new ComponentTreeItem(
                    'No JSON file open',
                    '',
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                )
            ]);
        }

        try {
            const text = editor.document.getText();
            const cleanedText = removeCommentsFromJSON(text);
            const data = JSON.parse(cleanedText);
            
            // Store document and text for position finding
            this.currentDocument = editor.document;
            this.currentText = text;

            if (!element) {
                // Root level - show file structure
                return Promise.resolve(this.getRootItems(data, editor.document));
            } else {
                // Show children of element
                return Promise.resolve(this.getChildItems(element));
            }
        } catch (error) {
            return Promise.resolve([
                new ComponentTreeItem(
                    '⚠️ Invalid JSON',
                    error.message,
                    vscode.TreeItemCollapsibleState.None,
                    'error'
                )
            ]);
        }
    }

    /**
     * Find position of a property in JSON text within the current object scope
     * @param {string} propertyName - Name of the property to find
     * @param {any} propertyValue - Value of the property (for verification)
     * @param {number} startSearchFrom - Character offset to start searching from (should point to object start)
     * @returns {number} - Character offset of the property name, or -1 if not found
     */
    findPropertyPosition(propertyName, propertyValue, startSearchFrom = 0) {
        if (!this.currentText) {
            console.log(`[RLT Tree] findPropertyPosition: no currentText`);
            return -1;
        }
        
        // Find the opening brace of the object we're searching in
        let objectStart = startSearchFrom;
        if (startSearchFrom > 0) {
            const nextBrace = this.currentText.indexOf('{', startSearchFrom);
            if (nextBrace !== -1 && nextBrace - startSearchFrom < 200) {
                objectStart = nextBrace;
            } else {
                // If we can't find { nearby, maybe we're already past it - try searching backwards
                for (let i = startSearchFrom; i >= Math.max(0, startSearchFrom - 50); i--) {
                    if (this.currentText[i] === '{') {
                        objectStart = i;
                        break;
                    }
                }
            }
        }
        
        // Parse through the object to find the property at depth 1 (direct child)
        const searchPattern = `"${propertyName}"`;
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let foundObjectStart = false;
        
        for (let i = objectStart; i < this.currentText.length; i++) {
            const char = this.currentText[i];
            
            // Handle string escaping
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            // Handle strings
            if (char === '"') {
                if (!inString) {
                    // Starting a string - check if it's our property
                    if (depth === 1 && this.currentText.substring(i, i + searchPattern.length) === searchPattern) {
                        // Verify it's followed by : (it's a key, not a value)
                        let colonIndex = i + searchPattern.length;
                        while (colonIndex < this.currentText.length && /\s/.test(this.currentText[colonIndex])) {
                            colonIndex++;
                        }
                        if (this.currentText[colonIndex] === ':') {
                            return i;
                        }
                    }
                }
                inString = !inString;
                continue;
            }
            if (inString) continue;
            
            // Handle nesting
            if (char === '{') {
                depth++;
                if (depth === 1) foundObjectStart = true;
            } else if (char === '}') {
                depth--;
                if (depth === 0 && foundObjectStart) {
                    // Reached end of object without finding property
                    console.log(`[RLT Tree] Property "${propertyName}" not found in object scope (reached end at ${i})`);
                    return -1;
                }
            } else if (char === '[') {
                depth++;
            } else if (char === ']') {
                depth--;
            }
        }
        
        console.log(`[RLT Tree] Property "${propertyName}" not found (unexpected end of text)`);
        return -1;
    }

    /**
     * Find position of the n-th element in an array
     * @param {number} startOffset - Start position of the array in text
     * @param {number} elementIndex - Index of the element to find (0-based)
     * @returns {number} - Character offset of the element, or startOffset if not found
     */
    findArrayElementPosition(startOffset, elementIndex) {
        if (!this.currentText) {
            console.log(`[RLT Tree] findArrayElementPosition: no currentText`);
            return startOffset;
        }
        
        if (elementIndex === 0) {
            // For first element, find the opening bracket and skip to first element
            const pos = this.currentText.indexOf('[', startOffset);
            if (pos === -1) return startOffset;
            
            // Skip whitespace after [
            for (let i = pos + 1; i < this.currentText.length; i++) {
                if (this.currentText[i] === '{' || this.currentText[i] === '[' || /\S/.test(this.currentText[i])) {
                    console.log(`[RLT Tree] Array element [0] position: ${i}`);
                    return i;
                }
            }
            return startOffset;
        }
        
        // Start from the array opening bracket
        let pos = this.currentText.indexOf('[', startOffset);
        if (pos === -1) {
            console.log(`[RLT Tree] findArrayElementPosition: bracket not found after offset ${startOffset}`);
            return startOffset;
        }
        
        let depth = 0;
        let elementCount = 0;
        let inString = false;
        let escapeNext = false;
        
        console.log(`[RLT Tree] Searching for array element [${elementIndex}] starting from offset ${pos}`);
        
        // Parse through the array to find the n-th element
        for (let i = pos; i < this.currentText.length; i++) {
            const char = this.currentText[i];
            
            // Handle string escaping
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            
            // Handle strings
            if (char === '"') {
                inString = !inString;
                continue;
            }
            if (inString) continue;
            
            // Handle nesting
            if (char === '[' || char === '{') {
                depth++;
                // First opening bracket of an element at depth 1
                if (depth === 1 && char === '{' && elementCount === elementIndex) {
                    console.log(`[RLT Tree] Found array element [${elementIndex}] at position ${i}`);
                    return i;
                }
            } else if (char === ']' || char === '}') {
                depth--;
            } else if (char === ',' && depth === 1) {
                // Found a comma at array level, next element
                elementCount++;
                if (elementCount === elementIndex) {
                    // Skip whitespace after comma to find element start
                    for (let j = i + 1; j < this.currentText.length; j++) {
                        const nextChar = this.currentText[j];
                        if (nextChar === '{' || nextChar === '[' || nextChar === '"' || /\S/.test(nextChar)) {
                            console.log(`[RLT Tree] Found array element [${elementIndex}] at position ${j}`);
                            return j;
                        }
                    }
                }
            }
        }
        
        console.log(`[RLT Tree] Array element [${elementIndex}] not found, returning startOffset ${startOffset}`);
        return startOffset;
    }

    /**
     * Get root level items based on file type
     */
    getRootItems(data, document) {
        const items = [];
        const fileName = path.basename(document.uri.fsPath);

        // Detect file type and show relevant sections
        if (fileName === 'theme_description.json') {
            items.push(...this.getThemeDescriptionItems(data));
        } else if (fileName.endsWith('component.json')) {
            items.push(...this.getComponentItems(data));
        } else if (fileName.endsWith('layer.json')) {
            items.push(...this.getLayerItems(data));
        } else if (fileName === 'layout_description.json') {
            items.push(...this.getLayoutItems(data));
        } else if (fileName === 'global_vars.json') {
            items.push(...this.getGlobalVarsItems(data));
        } else {
            // Try to detect structure - generic detection
            
            // Check if it's a component file (has ComponentName or Name + BlockType/Block)
            if ((data.ComponentName || data.Name) && (data.BlockType || data.Block || data.Items)) {
                items.push(...this.getComponentItems(data));
            }
            // Check for wrapper objects like BlockRoot, Component, etc.
            else if (Object.keys(data).length === 1) {
                const key = Object.keys(data)[0];
                const value = data[key];
                
                // Common wrapper names
                if (typeof value === 'object' && !Array.isArray(value) && 
                    (key === 'BlockRoot' || key === 'Component' || key === 'Root' || key === 'Block')) {
                    // It's a wrapper - check if inside is a component structure
                    if ((value.ComponentName || value.Name) && (value.BlockType || value.Block || value.Items)) {
                        // Find position of the wrapper property
                        const wrapperPosition = this.findPropertyPosition(key, value, 0);
                        items.push(...this.getComponentItems(value, wrapperPosition));
                    } else {
                        // Show wrapper as expandable item
                        const position = this.findPropertyPosition(key, value, 0);
                        const item = new ComponentTreeItem(
                            `📦 ${key}`,
                            'Wrapper Object',
                            vscode.TreeItemCollapsibleState.Collapsed,
                            'block',
                            position
                        );
                        item.data = value;
                        item.textOffset = position > 0 ? position : 0;
                        items.push(item);
                    }
                } else {
                    // Single property file - show it
                    const position = this.findPropertyPosition(key, value, 0);
                    const valueStr = typeof value === 'object' ? 
                        (Array.isArray(value) ? `Array (${value.length})` : `Object (${Object.keys(value).length})`) :
                        String(value);
                    const item = new ComponentTreeItem(
                        `${this.getIconForKey(key)} ${key}`,
                        valueStr,
                        typeof value === 'object' && value !== null ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        'property',
                        position
                    );
                    if (typeof value === 'object' && value !== null) {
                        item.data = value;
                        item.textOffset = position > 0 ? position : 0;
                    }
                    items.push(item);
                }
            }
            // Check for Components collection
            else if (data.Components) {
                items.push(...this.getComponentsSection(data.Components));
            }
            // Check for Layers collection
            else if (data.Layers) {
                items.push(...this.getLayersSection(data.Layers));
            }
            // Check for Styles collection
            else if (data.Styles) {
                items.push(...this.getStylesSection(data.Styles));
            }
            // Generic object display
            else {
                // Show all top-level properties
                Object.entries(data).forEach(([key, value]) => {
                    const icon = this.getIconForKey(key);
                    const valueStr = typeof value === 'object' ? 
                        (Array.isArray(value) ? `Array (${value.length})` : `Object (${Object.keys(value).length})`) :
                        String(value);
                    
                    const position = this.findPropertyPosition(key, value, 0);
                    const item = new ComponentTreeItem(
                        `${icon} ${key}`,
                        valueStr,
                        typeof value === 'object' && value !== null ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        'property'
                    );
                    
                    if (typeof value === 'object' && value !== null) {
                        item.data = value;
                    }
                    
                    items.push(item);
                });
            }
        }

        return items.length > 0 ? items : [
            new ComponentTreeItem(
                'No structure detected',
                'This JSON file is not recognized as an RLT theme file',
                vscode.TreeItemCollapsibleState.None,
                'info'
            )
        ];
    }

    /**
     * Get items for theme_description.json
     */
    getThemeDescriptionItems(data) {
        const items = [];

        if (data.Name) {
            items.push(new ComponentTreeItem(
                `📝 ${data.Name}`,
                'Theme Name',
                vscode.TreeItemCollapsibleState.None,
                'theme'
            ));
        }

        if (data.Version) {
            items.push(new ComponentTreeItem(
                `🏷️ v${data.Version}`,
                'Theme Version',
                vscode.TreeItemCollapsibleState.None,
                'version'
            ));
        }

        if (data.Layouts) {
            const layoutItem = new ComponentTreeItem(
                `📐 Layouts (${Object.keys(data.Layouts).length})`,
                'Layout definitions',
                vscode.TreeItemCollapsibleState.Collapsed,
                'layouts'
            );
            layoutItem.data = data.Layouts;
            items.push(layoutItem);
        }

        if (data.DefaultLocalizationId) {
            items.push(new ComponentTreeItem(
                `🌍 ${data.DefaultLocalizationId}`,
                'Default Localization',
                vscode.TreeItemCollapsibleState.None,
                'localization'
            ));
        }

        return items;
    }

    /**
     * Get items for component files
     */
    getComponentItems(data, startOffset = 0) {
        const items = [];

        // Support both ComponentName and Name
        const componentName = data.ComponentName || data.Name;
        if (componentName) {
            const propertyName = data.ComponentName ? 'ComponentName' : 'Name';
            const position = this.findPropertyPosition(propertyName, componentName, startOffset);
            const item = new ComponentTreeItem(
                `🧩 ${componentName}`,
                'Component Name',
                vscode.TreeItemCollapsibleState.None,
                'component',
                position
            );
            items.push(item);
        }

        // Support both BlockType and Block
        const blockType = data.BlockType || data.Block;
        if (blockType) {
            const propertyName = data.BlockType ? 'BlockType' : 'Block';
            const position = this.findPropertyPosition(propertyName, blockType, startOffset);
            const item = new ComponentTreeItem(
                `📦 ${blockType}`,
                'Root Block Type',
                vscode.TreeItemCollapsibleState.Collapsed,
                'block',
                position
            );
            item.data = data;
            item.textOffset = position > 0 ? position : startOffset;
            items.push(item);
        }

        // Show Items array if exists
        if (data.Items && Array.isArray(data.Items)) {
            const position = this.findPropertyPosition('Items', data.Items, startOffset);
            const itemsItem = new ComponentTreeItem(
                `📋 Items (${data.Items.length})`,
                'Block Items',
                vscode.TreeItemCollapsibleState.Collapsed,
                'items',
                position
            );
            itemsItem.data = data.Items;
            itemsItem.textOffset = position > 0 ? position : startOffset;
            items.push(itemsItem);
        }

        // Show Children array if exists
        if (data.Children && Array.isArray(data.Children)) {
            const position = this.findPropertyPosition('Children', data.Children, startOffset);
            const childrenItem = new ComponentTreeItem(
                `👶 Children (${data.Children.length})`,
                'Block Children',
                vscode.TreeItemCollapsibleState.Collapsed,
                'children',
                position
            );
            childrenItem.data = data.Children;
            childrenItem.textOffset = position > 0 ? position : startOffset;
            items.push(childrenItem);
        }

        if (data.Styles) {
            const position = this.findPropertyPosition('Styles', data.Styles, startOffset);
            const styleItem = new ComponentTreeItem(
                `💅 Styles (${Object.keys(data.Styles).length})`,
                'Component Styles',
                vscode.TreeItemCollapsibleState.Collapsed,
                'styles',
                position
            );
            styleItem.data = data.Styles;
            styleItem.textOffset = position > 0 ? position : startOffset;
            items.push(styleItem);
        }

        if (data.Triggers) {
            const position = this.findPropertyPosition('Triggers', data.Triggers, startOffset);
            const triggerItem = new ComponentTreeItem(
                `⚡ Triggers (${data.Triggers.length})`,
                'Component Triggers',
                vscode.TreeItemCollapsibleState.Collapsed,
                'triggers',
                position
            );
            triggerItem.data = data.Triggers;
            triggerItem.textOffset = position > 0 ? position : startOffset;
            items.push(triggerItem);
        }

        return items;
    }

    /**
     * Get items for layer files
     */
    getLayerItems(data) {
        const items = [];

        // Support both BlockType and Block
        const blockType = data.BlockType || data.Block;
        if (blockType) {
            const blockItem = new ComponentTreeItem(
                `📦 ${blockType}`,
                'Layer Block Type',
                vscode.TreeItemCollapsibleState.Collapsed,
                'block'
            );
            blockItem.data = data;
            items.push(blockItem);
        }

        return items;
    }

    /**
     * Get items for layout_description.json
     */
    getLayoutItems(data) {
        const items = [];

        if (data.Layouts) {
            Object.entries(data.Layouts).forEach(([name, layout]) => {
                const layoutItem = new ComponentTreeItem(
                    `📐 ${name}`,
                    `${layout.Width || '?'}x${layout.Height || '?'}`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'layout'
                );
                layoutItem.data = layout;
                items.push(layoutItem);
            });
        }

        return items;
    }

    /**
     * Get items for global_vars.json
     */
    getGlobalVarsItems(data) {
        const items = [];

        Object.entries(data).forEach(([key, value]) => {
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            const icon = this.getIconForValue(valueStr);
            
            const item = new ComponentTreeItem(
                `${icon} ${key}`,
                valueStr.length > 50 ? valueStr.substring(0, 47) + '...' : valueStr,
                typeof value === 'object' ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                'variable'
            );
            
            if (typeof value === 'object') {
                item.data = value;
            }
            
            items.push(item);
        });

        return items;
    }

    /**
     * Get Components section
     */
    getComponentsSection(components) {
        const items = [];

        Object.entries(components).forEach(([name, component]) => {
            const blockType = component.BlockType || component.Block || 'Component';
            const item = new ComponentTreeItem(
                `🧩 ${name}`,
                blockType,
                vscode.TreeItemCollapsibleState.Collapsed,
                'component'
            );
            item.data = component;
            items.push(item);
        });

        return items;
    }

    /**
     * Get Layers section
     */
    getLayersSection(layers) {
        const items = [];

        Object.entries(layers).forEach(([name, layer]) => {
            const blockType = layer.BlockType || layer.Block || 'Layer';
            const item = new ComponentTreeItem(
                `📄 ${name}`,
                blockType,
                vscode.TreeItemCollapsibleState.Collapsed,
                'layer'
            );
            item.data = layer;
            items.push(item);
        });

        return items;
    }

    /**
     * Get Styles section
     */
    getStylesSection(styles) {
        const items = [];

        Object.entries(styles).forEach(([name, style]) => {
            const properties = Object.keys(style).length;
            const item = new ComponentTreeItem(
                `💅 ${name}`,
                `${properties} properties`,
                vscode.TreeItemCollapsibleState.Collapsed,
                'style'
            );
            item.data = style;
            items.push(item);
        });

        return items;
    }

    /**
     * Get child items for expanded element
     */
    getChildItems(element) {
        if (!element.data) {
            return [];
        }

        const items = [];
        const data = element.data;
        const parentOffset = element.textOffset || 0;

        console.log('[RLT Tree] getChildItems parentOffset:', parentOffset);

        if (typeof data === 'object' && !Array.isArray(data)) {
            Object.entries(data).forEach(([key, value]) => {
                const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
                const icon = this.getIconForKey(key);
                
                // Find position of this property in text
                const position = this.findPropertyPosition(key, value, parentOffset);
                console.log(`[RLT Tree] Property "${key}" position:`, position);
                
                const item = new ComponentTreeItem(
                    `${icon} ${key}`,
                    valueStr.length > 50 ? valueStr.substring(0, 47) + '...' : valueStr,
                    typeof value === 'object' && value !== null ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    this.getTypeForKey(key),
                    position  // Direct position
                );
                
                if (typeof value === 'object' && value !== null) {
                    item.data = value;
                    item.textOffset = position > 0 ? position : parentOffset;
                }
                
                items.push(item);
            });
        } else if (Array.isArray(data)) {
            data.forEach((item, index) => {
                let label, description, collapsibleState;
                
                // Calculate position of this array element
                const elementPosition = this.findArrayElementPosition(parentOffset, index);
                
                if (typeof item === 'object' && item !== null) {
                    // For objects, show some key info in label
                    const name = item.Name || item.ComponentName || item.BlockType || item.Block;
                    label = name ? `[${index}] ${name}` : `[${index}]`;
                    description = item.BlockType || item.Block || 'Object';
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                } else {
                    // For primitive values, show the value in label
                    const valueStr = String(item);
                    label = `[${index}]`;
                    description = valueStr.length > 50 ? valueStr.substring(0, 47) + '...' : valueStr;
                    collapsibleState = vscode.TreeItemCollapsibleState.None;
                }
                
                const treeItem = new ComponentTreeItem(
                    label,
                    description,
                    collapsibleState,
                    'item',
                    elementPosition
                );
                
                if (typeof item === 'object' && item !== null) {
                    treeItem.data = item;
                    treeItem.textOffset = elementPosition;
                }
                
                items.push(treeItem);
            });
        }

        return items;
    }

    /**
     * Get icon for property key
     */
    getIconForKey(key) {
        const iconMap = {
            'Block': '📦',
            'BlockType': '📦',
            'ComponentName': '🧩',
            'Name': '📝',
            'Text': '📝',
            'Color': '🎨',
            'Foreground': '🎨',
            'Background': '🎨',
            'Width': '↔️',
            'Height': '↕️',
            'Margin': '📏',
            'Padding': '📏',
            'Style': '💅',
            'Styles': '💅',
            'Children': '👶',
            'Items': '📋',
            'Source': '🔗',
            'Image': '🖼️',
            'Triggers': '⚡',
            'RenderIf': '👁️',
            'Opacity': '👻'
        };

        return iconMap[key] || '•';
    }

    /**
     * Get icon for value type
     */
    getIconForValue(value) {
        if (value.startsWith('#') || /^\d+,\d+,\d+/.test(value)) {
            return '🎨';
        }
        if (value.startsWith('{') && value.endsWith('}')) {
            return '🔗';
        }
        return '•';
    }

    /**
     * Get type for key (for styling)
     */
    getTypeForKey(key) {
        if (['Color', 'Foreground', 'Background'].includes(key)) return 'color';
        if (['Width', 'Height', 'Margin', 'Padding'].includes(key)) return 'dimension';
        if (['Style', 'Styles'].includes(key)) return 'style';
        if (['Block'].includes(key)) return 'block';
        return 'property';
    }
}

/**
 * Tree Item representing a component or property
 */
class ComponentTreeItem extends vscode.TreeItem {
    constructor(label, description, collapsibleState, contextValue, textPosition = null) {
        super(label, collapsibleState);
        this.description = description;
        this.contextValue = contextValue;
        this.data = null;
        this.textPosition = textPosition; // Character position in document
        this.textOffset = 0; // For nested elements

        // Set icons based on context
        this.iconPath = this.getIconPath(contextValue);
        
        // Add command to navigate to definition when clicked
        if (textPosition !== null && textPosition >= 0) {
            this.command = {
                command: 'rlt-theme-helper.goToDefinition',
                title: 'Go to Definition',
                arguments: [textPosition]
            };
        }
    }

    getIconPath(contextValue) {
        const iconMap = {
            'component': new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('symbolIcon.classForeground')),
            'block': new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('symbolIcon.methodForeground')),
            'style': new vscode.ThemeIcon('symbol-color', new vscode.ThemeColor('symbolIcon.colorForeground')),
            'color': new vscode.ThemeIcon('symbol-color', new vscode.ThemeColor('symbolIcon.colorForeground')),
            'variable': new vscode.ThemeIcon('symbol-variable', new vscode.ThemeColor('symbolIcon.variableForeground')),
            'layout': new vscode.ThemeIcon('layout', new vscode.ThemeColor('symbolIcon.namespaceForeground')),
            'theme': new vscode.ThemeIcon('symbol-namespace', new vscode.ThemeColor('symbolIcon.namespaceForeground')),
            'error': new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground')),
            'info': new vscode.ThemeIcon('info', new vscode.ThemeColor('foreground'))
        };

        return iconMap[contextValue] || new vscode.ThemeIcon('circle-outline');
    }
}

module.exports = ComponentTreeProvider;
