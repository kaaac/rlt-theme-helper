const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Provider for Item property autocomplete
 * Detects ItemsSource in hierarchy and suggests properties based on API models
 */
class ItemPropertyCompletionProvider {
    constructor() {
        this.apiModelsPath = path.join(__dirname, '..', 'api_models');
        
        // Create output channel for logging
        this.outputChannel = vscode.window.createOutputChannel('RLT Item Provider');
        
        this.log('ItemPropertyProvider initialized');
        this.log('API models path: ' + this.apiModelsPath);
        
        this.autocompleteData = this.loadAutocompleteData();
        this.mapping = this.loadMapping();
        this.classSchemas = new Map();
        
        this.log('Loaded mappings: ' + Object.keys(this.mapping).length);
        this.log('Mappings: ' + JSON.stringify(this.mapping, null, 2));
    }

    /**
     * Log to both console and output channel
     */
    log(message) {
        console.log(message);
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
    }

    /**
     * Load autocomplete.json
     */
    loadAutocompleteData() {
        try {
            const filePath = path.join(this.apiModelsPath, 'autocomplete.json');
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Failed to load autocomplete.json:', error);
            return {};
        }
    }

    /**
     * Load mapping.json
     */
    loadMapping() {
        try {
            const filePath = path.join(this.apiModelsPath, 'mapping.json');
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Failed to load mapping.json:', error);
            return {};
        }
    }

    /**
     * Load specific class schema
     */
    loadClassSchema(className) {
        if (this.classSchemas.has(className)) {
            return this.classSchemas.get(className);
        }

        try {
            const filePath = path.join(this.apiModelsPath, `${className}.json`);
            const content = fs.readFileSync(filePath, 'utf8');
            const schema = JSON.parse(content);
            this.classSchemas.set(className, schema);
            return schema;
        } catch (error) {
            this.log(`⚠️ Failed to load schema for ${className}: ${error.message}`);
            
            // Try fallback mappings for missing classes
            const fallback = this.getFallbackClass(className);
            if (fallback) {
                this.log(`🔄 Trying fallback class: ${fallback}`);
                return this.loadClassSchema(fallback);
            }
            
            return null;
        }
    }

    /**
     * Get fallback class for missing schemas
     */
    getFallbackClass(className) {
        const fallbacks = {
            'DriverRenderObject': 'DriverRenderData',
            'TeamRenderObject': 'TeamRenderData'
        };
        
        return fallbacks[className] || null;
    }

    /**
     * Main completion provider
     */
    provideCompletionItems(document, position, token, context) {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        this.log('=== ItemPropertyProvider DEBUG ===');
        this.log('Line prefix: ' + linePrefix);
        
        // Pattern 1: Check if we're typing after "Item."
        const itemDotMatch = linePrefix.match(/["{]?(Item\.[\w.]*)$/);
        if (itemDotMatch) {
            this.log('Item pattern matched: ' + itemDotMatch[1]);
            return this.handleItemCompletion(document, position, itemDotMatch[1]);
        }
        
        // Pattern 2: Check if we're typing after a root object (Session., Event., DriverInfo., etc.)
        const rootObjectMatch = linePrefix.match(/["{]?((?:Session|Event|Season|Standings|Events|Lineups|Statistics|DriverInfo|Penalty|Penalties|LayoutInfo)\.[\w.]*)$/i);
        if (rootObjectMatch) {
            this.log('Root object pattern matched: ' + rootObjectMatch[1]);
            return this.handleRootObjectCompletion(rootObjectMatch[1]);
        }

        this.log('No Item. or root object pattern found');
        return undefined;
    }

    /**
     * Handle completion for Item.*
     */
    handleItemCompletion(document, position, fullPath) {
        const pathParts = fullPath.split('.');
        pathParts.shift(); // Remove "Item"
        
        this.log('Path parts: ' + JSON.stringify(pathParts));

        // Find ItemsSource in current file or layout hierarchy
        const itemsSource = this.findItemsSource(document, position);
        
        this.log('ItemsSource found: ' + itemsSource);
        
        if (!itemsSource) {
            this.log('❌ No ItemsSource found for Item.');
            return undefined;
        }

        // Resolve the class for this ItemsSource
        let className = this.resolveClassName(itemsSource);
        
        this.log('Resolved className: ' + className);
        
        if (!className) {
            this.log('❌ No class mapping found for ItemsSource: ' + itemsSource);
            return undefined;
        }

        // Navigate through nested properties (e.g., Item.Driver.Name)
        for (const part of pathParts) {
            if (!part) continue; // Skip empty parts
            
            this.log('Navigating to property: ' + part);
            
            const schema = this.loadClassSchema(className);
            if (!schema) {
                this.log('❌ No schema found for class: ' + className);
                return undefined;
            }

            // Check if this is an indexed collection pattern (e.g., "Driver0", "Driver1")
            // RLT uses this convention: Item.Drivers[0] becomes Item.Driver0
            const indexedMatch = part.match(/^(.+?)(\d+)$/);
            let propertyName = part;
            
            if (indexedMatch) {
                // Try plural form first (e.g., "Driver0" -> check for "Drivers")
                const baseName = indexedMatch[1];
                const index = indexedMatch[2];
                const pluralName = baseName + 's';
                
                this.log('🔢 Detected indexed pattern: ' + part + ' (checking for ' + pluralName + ')');
                
                const pluralProperty = schema.properties.find(p => p.name === pluralName);
                if (pluralProperty && pluralProperty.isCollection) {
                    this.log('✅ Found collection property: ' + pluralName + ' (type: ' + pluralProperty.type + '[], index: ' + index + ')');
                    propertyName = pluralName;
                }
            }

            // Find the property with this name
            let property = schema.properties.find(p => p.name === propertyName);
            if (!property && schema.inheritedProperties) {
                property = schema.inheritedProperties.find(p => p.name === propertyName);
            }
            
            if (!property) {
                this.log('❌ Property ' + propertyName + ' not found in ' + className);
                return undefined;
            }

            this.log('Found property ' + propertyName + ': ' + property.type + (property.isCollection ? '[]' : ''));

            // If it's a complex type, navigate deeper
            if (property.isComplex) {
                className = property.type;
            } else {
                // Can't go deeper on primitive types
                this.log('Cannot navigate deeper - ' + propertyName + ' is primitive type');
                return undefined;
            }
        }

        // Load the final class schema and return its properties
        this.log('✅ Returning properties for class: ' + className);
        
        // Build context information for the user
        const contextInfo = this.buildContextInfo(itemsSource, className, pathParts);
        
        return this.getPropertiesForClass(className, contextInfo);
    }

    /**
     * Handle completion for root objects (Session., Event., etc.)
     */
    handleRootObjectCompletion(fullPath) {
        const pathParts = fullPath.split('.');
        const rootObject = pathParts.shift(); // e.g., "Session", "DriverInfo"
        
        this.log('Root object: ' + rootObject);
        this.log('Path parts: ' + JSON.stringify(pathParts));

        // Resolve the class for this root object
        let className = this.resolveClassName(rootObject);
        
        this.log('Resolved className: ' + className);
        
        if (!className) {
            this.log('❌ No class mapping found for root object: ' + rootObject);
            return undefined;
        }

        // Navigate through nested properties (e.g., Session.Track.Name)
        for (const part of pathParts) {
            if (!part) continue; // Skip empty parts
            
            this.log('Navigating to property: ' + part);
            
            const schema = this.loadClassSchema(className);
            if (!schema) {
                this.log('❌ No schema found for class: ' + className);
                return undefined;
            }

            // Check if this is an indexed collection pattern (e.g., "Driver0", "Driver1")
            const indexedMatch = part.match(/^(.+?)(\d+)$/);
            let propertyName = part;
            
            if (indexedMatch) {
                // Try plural form first (e.g., "Driver0" -> check for "Drivers")
                const baseName = indexedMatch[1];
                const index = indexedMatch[2];
                const pluralName = baseName + 's';
                
                this.log('🔢 Detected indexed pattern: ' + part + ' (checking for ' + pluralName + ')');
                
                let pluralProperty = schema.properties.find(p => p.name === pluralName);
                if (!pluralProperty && schema.inheritedProperties) {
                    pluralProperty = schema.inheritedProperties.find(p => p.name === pluralName);
                }
                
                if (pluralProperty && pluralProperty.isCollection) {
                    this.log('✅ Found collection property: ' + pluralName + ' (type: ' + pluralProperty.type + '[], index: ' + index + ')');
                    propertyName = pluralName;
                }
            }

            // Find the property with this name (check both properties and inheritedProperties)
            let property = schema.properties.find(p => p.name === propertyName);
            if (!property && schema.inheritedProperties) {
                property = schema.inheritedProperties.find(p => p.name === propertyName);
            }
            
            if (!property) {
                this.log('❌ Property ' + propertyName + ' not found in ' + className);
                return undefined;
            }

            this.log('Found property ' + propertyName + ': ' + property.type + (property.isCollection ? '[]' : ''));

            // If it's a complex type, navigate deeper
            if (property.isComplex) {
                className = property.type;
            } else {
                // Can't go deeper on primitive types
                this.log('Cannot navigate deeper - ' + part + ' is primitive type');
                return undefined;
            }
        }

        // Load the final class schema and return its properties
        this.log('✅ Returning properties for root object class: ' + className);
        
        // Build context information for the user
        const contextInfo = this.buildRootObjectContextInfo(rootObject, className, pathParts);
        
        return this.getPropertiesForClass(className, contextInfo);
    }

    /**
     * Build context information for root objects
     */
    buildRootObjectContextInfo(rootObject, className, pathParts) {
        let context = `📦 **${className}**`;
        
        context += `\n\n🌐 Root Object: \`${rootObject}\``;
        
        if (pathParts && pathParts.length > 0 && pathParts[0]) {
            const path = pathParts.filter(p => p).join('.');
            context += `\n\n🔍 Path: \`${rootObject}.${path}\``;
        } else {
            context += `\n\n🔍 Path: \`${rootObject}\``;
        }
        
        return context;
    }

    /**
     * Build context information for display
     */
    buildContextInfo(itemsSource, className, pathParts) {
        let context = `📦 **${className}**`;
        
        if (itemsSource) {
            context += `\n\n🔗 Source: \`${itemsSource}\``;
        }
        
        if (pathParts && pathParts.length > 0 && pathParts[0]) {
            const path = pathParts.filter(p => p).join('.');
            context += `\n\n🔍 Path: \`Item.${path}\``;
        } else {
            context += `\n\n🔍 Path: \`Item\``;
        }
        
        return context;
    }

    /**
     * Get completion items for a class
     */
    getPropertiesForClass(className, contextInfo = null) {
        const schema = this.loadClassSchema(className);
        if (!schema) {
            return undefined;
        }

        const completionItems = [];

        // Add inherited properties first (from base classes)
        if (schema.inheritedProperties && schema.inheritedProperties.length > 0) {
            for (const prop of schema.inheritedProperties) {
                const item = new vscode.CompletionItem(prop.name, this.getCompletionKind(prop));
                
                // Build detail string
                let detail = prop.type;
                if (prop.isCollection) {
                    detail = `${detail}[]`;
                }
                if (prop.isNullable) {
                    detail += '?';
                }
                
                item.detail = detail + ' (inherited)';
                
                // Add context info at the top if provided
                let docString = '';
                if (contextInfo) {
                    docString = contextInfo + '\n\n---\n\n';
                }
                docString += 'Inherited from base class';
                
                item.documentation = new vscode.MarkdownString(docString);
                
                // Add type information
                if (prop.isComplex) {
                    item.documentation.appendMarkdown(`\n\n*Complex type: ${prop.type}*`);
                }

                completionItems.push(item);
            }
        }

        // Add class's own properties
        for (const prop of schema.properties) {
            const item = new vscode.CompletionItem(prop.name, this.getCompletionKind(prop));
            
            // Build detail string
            let detail = prop.type;
            if (prop.isCollection) {
                detail = `${detail}[]`;
            }
            if (prop.isNullable) {
                detail += '?';
            }
            
            item.detail = detail;
            
            // Add context info at the top if provided
            let docString = '';
            if (contextInfo) {
                docString = contextInfo + '\n\n---\n\n';
            }
            docString += prop.description || '';
            
            item.documentation = new vscode.MarkdownString(docString);
            
            // Add type information
            if (prop.isComplex) {
                item.documentation.appendMarkdown(`\n\n*Complex type: ${prop.type}*`);
            }

            completionItems.push(item);
        }

        return completionItems;
    }

    /**
     * Get appropriate completion item kind
     */
    getCompletionKind(property) {
        if (property.isCollection) {
            return vscode.CompletionItemKind.Enum;
        }
        if (property.isComplex) {
            return vscode.CompletionItemKind.Class;
        }
        switch (property.type) {
            case 'string':
                return vscode.CompletionItemKind.Text;
            case 'number':
                return vscode.CompletionItemKind.Value;
            case 'boolean':
                return vscode.CompletionItemKind.Constant;
            default:
                return vscode.CompletionItemKind.Property;
        }
    }

    /**
     * Find ItemsSource in current document or layout hierarchy
     */
    findItemsSource(document, position) {
        const text = document.getText();
        
        this.log('Searching for ItemsSource in document: ' + document.fileName);
        
        try {
            const json = JSON.parse(text);
            
            this.log('Document parsed as JSON successfully');
            
            // Strategy 1: Search in parent blocks of cursor position
            const itemsSource = this.searchItemsSourceInParents(document, position, json);
            if (itemsSource) {
                this.log('✅ Found ItemsSource in parent blocks: ' + itemsSource);
                return itemsSource;
            }

            this.log('⚠️ No ItemsSource found in parent blocks');

            // Strategy 2: If this is a component, search in layouts where it's used
            const componentName = this.getComponentName(json);
            if (componentName) {
                this.log('📦 This is a component: ' + componentName);
                this.log('🔍 Searching for component usage in layouts...');
                
                const itemsSourceFromLayouts = this.searchComponentInLayouts(componentName, document);
                if (itemsSourceFromLayouts) {
                    this.log('✅ Found ItemsSource in layout: ' + itemsSourceFromLayouts);
                    return itemsSourceFromLayouts;
                }
            }
            
        } catch (error) {
            this.log('❌ Failed to parse document as JSON: ' + error.message);
        }

        return null;
    }

    /**
     * Search for ItemsSource only in parent blocks of cursor position
     */
    searchItemsSourceInParents(document, position, json) {
        // Get the JSON path from root to cursor position
        const jsonPath = this.getJsonPathAtPosition(document, position);
        
        this.log('JSON path to cursor: ' + JSON.stringify(jsonPath));
        
        // Navigate to each parent level and check for ItemsSource
        let currentObj = json;
        
        for (let i = 0; i < jsonPath.length; i++) {
            const key = jsonPath[i];
            
            // Check if current level has ItemsSource
            if (currentObj && typeof currentObj === 'object') {
                // Check TableOptions.ItemsSource
                if (currentObj.TableOptions && currentObj.TableOptions.ItemsSource) {
                    this.log('Found TableOptions.ItemsSource at level ' + i + ': ' + currentObj.TableOptions.ItemsSource);
                    return this.cleanBindingExpression(currentObj.TableOptions.ItemsSource);
                }
                
                // Check ItemStackOptions.ItemSource
                if (currentObj.ItemStackOptions && currentObj.ItemStackOptions.ItemSource) {
                    this.log('Found ItemStackOptions.ItemSource at level ' + i + ': ' + currentObj.ItemStackOptions.ItemSource);
                    return this.cleanBindingExpression(currentObj.ItemStackOptions.ItemSource);
                }
                
                // Navigate deeper
                if (key !== undefined && currentObj[key] !== undefined) {
                    currentObj = currentObj[key];
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        
        return null;
    }

    /**
     * Get JSON path from root to cursor position
     * Returns array of keys, e.g., ["Blocks", 0, "Items", 1, "Text"]
     */
    getJsonPathAtPosition(document, position) {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        try {
            // Parse JSON and find the path by analyzing the structure
            const json = JSON.parse(text);
            return this.findPathInObject(json, text, offset, []);
        } catch (error) {
            this.log('❌ Failed to parse JSON for path detection: ' + error.message);
            return [];
        }
    }

    /**
     * Recursively find path to offset in JSON structure
     */
    findPathInObject(obj, text, targetOffset, currentPath) {
        if (typeof obj !== 'object' || obj === null) {
            return null;
        }

        // For arrays
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const result = this.findPathInObject(obj[i], text, targetOffset, [...currentPath, i]);
                if (result) return result;
            }
            return null;
        }

        // For objects - check each property
        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) continue;

            // Find the position of this key in the text
            const keyPattern = new RegExp(`"${this.escapeRegExp(key)}"\\s*:`, 'g');
            let match;
            
            while ((match = keyPattern.exec(text)) !== null) {
                const keyStart = match.index;
                const keyEnd = match.index + match[0].length;
                
                // Check if cursor is within this key's value range
                // We need to find where this value ends
                const valueStart = keyEnd;
                const valueEnd = this.findValueEnd(text, valueStart);
                
                if (targetOffset >= keyStart && targetOffset <= valueEnd) {
                    // Cursor is in this property
                    const newPath = [...currentPath, key];
                    
                    // If the value is an object/array, recurse
                    const value = obj[key];
                    if (typeof value === 'object' && value !== null) {
                        const deeperPath = this.findPathInObject(value, text.substring(valueStart, valueEnd), targetOffset - valueStart, newPath);
                        if (deeperPath) return deeperPath;
                    }
                    
                    return newPath;
                }
            }

            // Also try recursive search without position check (fallback)
            const result = this.findPathInObject(obj[key], text, targetOffset, [...currentPath, key]);
            if (result) return result;
        }

        return null;
    }

    /**
     * Find where a JSON value ends (handles objects, arrays, strings, primitives)
     */
    findValueEnd(text, start) {
        let i = start;
        
        // Skip whitespace
        while (i < text.length && /\s/.test(text[i])) i++;
        
        if (i >= text.length) return start;
        
        const char = text[i];
        
        // Object
        if (char === '{') {
            let depth = 1;
            i++;
            while (i < text.length && depth > 0) {
                if (text[i] === '{') depth++;
                else if (text[i] === '}') depth--;
                i++;
            }
            return i;
        }
        
        // Array
        if (char === '[') {
            let depth = 1;
            i++;
            while (i < text.length && depth > 0) {
                if (text[i] === '[') depth++;
                else if (text[i] === ']') depth--;
                i++;
            }
            return i;
        }
        
        // String
        if (char === '"') {
            i++;
            while (i < text.length) {
                if (text[i] === '"' && text[i - 1] !== '\\') {
                    i++;
                    break;
                }
                i++;
            }
            return i;
        }
        
        // Primitive (number, boolean, null)
        while (i < text.length && !/[,\}\]]/.test(text[i])) {
            i++;
        }
        
        return i;
    }

    /**
     * Escape special regex characters
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get component name from JSON
     */
    getComponentName(json) {
        if (json && json.ComponentName) {
            return json.ComponentName;
        }
        return null;
    }

    /**
     * Search for component usage in layouts and find ItemsSource
     */
    searchComponentInLayouts(componentName, currentDocument) {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(currentDocument.uri);
        if (!workspaceFolder) {
            console.log('❌ No workspace folder found');
            return null;
        }

        const workspacePath = workspaceFolder.uri.fsPath;
        
        // Look for layouts folder relative to workspace
        const layoutsPath = path.join(workspacePath, 'layouts');
        
        console.log('Searching layouts in:', layoutsPath);
        
        if (!fs.existsSync(layoutsPath)) {
            console.log('❌ Layouts folder not found:', layoutsPath);
            
            // Try dev-area/dev/layouts
            const devLayoutsPath = path.join(workspacePath, 'dev-area', 'dev', 'layouts');
            if (fs.existsSync(devLayoutsPath)) {
                console.log('✅ Found dev layouts:', devLayoutsPath);
                return this.searchLayoutsRecursively(devLayoutsPath, componentName);
            }
            
            return null;
        }

        return this.searchLayoutsRecursively(layoutsPath, componentName);
    }

    /**
     * Recursively search layouts for component usage
     */
    searchLayoutsRecursively(layoutsPath, componentName, depth = 0) {
        if (depth > 5) {
            console.log('⚠️ Max layout search depth reached');
            return null;
        }

        try {
            const files = fs.readdirSync(layoutsPath);
            
            for (const file of files) {
                const filePath = path.join(layoutsPath, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    // Recurse into subdirectories
                    const result = this.searchLayoutsRecursively(filePath, componentName, depth + 1);
                    if (result) return result;
                } else if (file.endsWith('.json')) {
                    // Search in JSON file
                    const result = this.searchComponentInLayoutFile(filePath, componentName);
                    if (result) {
                        console.log(`✅ Found component ${componentName} in layout: ${file}`);
                        return result;
                    }
                }
            }
        } catch (error) {
            console.error('Error searching layouts:', error.message);
        }

        return null;
    }

    /**
     * Search for component in a specific layout file
     */
    searchComponentInLayoutFile(filePath, componentName) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(content);

            // Search for component usage and ItemsSource in the same context
            return this.findComponentAndItemsSource(json, componentName);
        } catch (error) {
            // Skip files that can't be parsed
            return null;
        }
    }

    /**
     * Find component usage and its parent ItemsSource
     */
    findComponentAndItemsSource(obj, componentName, currentItemsSource = null, depth = 0) {
        if (depth > 20) return null;
        
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        // Check if we found a new ItemsSource at this level
        let itemsSource = currentItemsSource;
        
        if (obj.TableOptions && obj.TableOptions.ItemsSource) {
            itemsSource = this.cleanBindingExpression(obj.TableOptions.ItemsSource);
            console.log('Found ItemsSource in context:', itemsSource);
        }
        
        if (obj.ItemStackOptions && obj.ItemStackOptions.ItemSource) {
            itemsSource = this.cleanBindingExpression(obj.ItemStackOptions.ItemSource);
            console.log('Found ItemsSource in context:', itemsSource);
        }

        // Check if this object uses our component
        if (obj.Component === componentName && itemsSource) {
            console.log(`✅ Component ${componentName} found with ItemsSource: ${itemsSource}`);
            return itemsSource;
        }

        // Recursively search in nested objects and arrays
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                
                if (Array.isArray(value)) {
                    for (const item of value) {
                        const result = this.findComponentAndItemsSource(item, componentName, itemsSource, depth + 1);
                        if (result) return result;
                    }
                } else if (typeof value === 'object') {
                    const result = this.findComponentAndItemsSource(value, componentName, itemsSource, depth + 1);
                    if (result) return result;
                }
            }
        }

        return null;
    }

    /**
     * Recursively search for ItemsSource in object
     */
    searchForItemsSourceInObject(obj, depth = 0) {
        if (depth > 20) {
            console.log('⚠️ Max depth reached');
            return null; // Prevent infinite recursion
        }
        
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        // Check if this object has TableOptions.ItemsSource
        if (obj.TableOptions && obj.TableOptions.ItemsSource) {
            console.log('Found TableOptions.ItemsSource:', obj.TableOptions.ItemsSource);
            return this.cleanBindingExpression(obj.TableOptions.ItemsSource);
        }

        // Check if this object has ItemStackOptions.ItemSource
        if (obj.ItemStackOptions && obj.ItemStackOptions.ItemSource) {
            console.log('Found ItemStackOptions.ItemSource:', obj.ItemStackOptions.ItemSource);
            return this.cleanBindingExpression(obj.ItemStackOptions.ItemSource);
        }

        // Recursively search in nested objects and arrays
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                
                if (Array.isArray(value)) {
                    for (const item of value) {
                        const result = this.searchForItemsSourceInObject(item, depth + 1);
                        if (result) return result;
                    }
                } else if (typeof value === 'object') {
                    const result = this.searchForItemsSourceInObject(value, depth + 1);
                    if (result) return result;
                }
            }
        }

        return null;
    }

    /**
     * Clean binding expression (remove { and })
     */
    cleanBindingExpression(expr) {
        if (typeof expr !== 'string') return expr;
        return expr.replace(/[{}]/g, '').trim();
    }

    /**
     * Resolve class name from ItemsSource
     */
    resolveClassName(itemsSource) {
        this.log('Resolving class name for: ' + itemsSource);
        this.log('Available mappings: ' + Object.keys(this.mapping).join(', '));
        
        // Direct mapping
        if (this.mapping[itemsSource]) {
            this.log('✅ Direct mapping found: ' + this.mapping[itemsSource]);
            return this.mapping[itemsSource];
        }

        // Try to find partial match (e.g., "Drivers" -> "Session.Drivers")
        for (const key in this.mapping) {
            if (key.endsWith(`.${itemsSource}`) || key === itemsSource) {
                this.log('✅ Partial mapping found: ' + key + ' -> ' + this.mapping[key]);
                return this.mapping[key];
            }
        }

        // Handle nested paths like "DriverInfo.Driver.LeagueRoles"
        // Extract the last two parts (e.g., "Driver.LeagueRoles")
        const parts = itemsSource.split('.');
        if (parts.length >= 2) {
            const lastTwo = parts.slice(-2).join('.');
            this.log('Trying last two parts: ' + lastTwo);
            
            if (this.mapping[lastTwo]) {
                this.log('✅ Found mapping for last two parts: ' + this.mapping[lastTwo]);
                return this.mapping[lastTwo];
            }

            // Try just the last part
            const lastPart = parts[parts.length - 1];
            this.log('Trying last part: ' + lastPart);
            
            for (const key in this.mapping) {
                if (key.endsWith(`.${lastPart}`)) {
                    this.log('✅ Found mapping for last part: ' + key + ' -> ' + this.mapping[key]);
                    return this.mapping[key];
                }
            }
        }

        this.log('❌ No mapping found for: ' + itemsSource);
        return null;
    }
}

module.exports = ItemPropertyCompletionProvider;
