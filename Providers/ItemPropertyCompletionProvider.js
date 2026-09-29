const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { getThemeContext } = require('../core/themeContext');
const { parseJsonTree, enclosingObjects, stringNodeAt, readJsonFile } = require('../core/json');

// Where a block declares the collection its Item.* bindings refer to
const ITEMS_SOURCE_PATHS = [
    ['TableOptions', 'ItemsSource'],
    ['ItemStackOptions', 'ItemSource']
];

const ROOT_OBJECTS = /["{]?((?:Session|Event|Season|Standings|Events|Lineups|Statistics|DriverInfo|Penalty|Penalties|LayoutInfo)\.[\w.]*)$/i;
const ITEM_PATH = /["{]?(Item\.[\w.]*)$/;

// Classes referenced by models but not generated
const FALLBACK_CLASSES = {
    DriverRenderObject: 'DriverRenderData',
    TeamRenderObject: 'TeamRenderData'
};

const MAX_LAYOUT_DEPTH = 5;
const MAX_JSON_DEPTH = 20;

/**
 * Provider for Item property autocomplete
 * Detects ItemsSource in hierarchy and suggests properties based on API models
 */
class ItemPropertyCompletionProvider {
    constructor() {
        this.apiModelsPath = path.join(__dirname, '..', 'api_models');
        this.outputChannel = vscode.window.createOutputChannel('RLT Item Provider');
        this.mapping = this.readModel('mapping.json') || {};
        /** @type {Map<string, Object|null>} */
        this.classSchemas = new Map();
    }

    log(message) {
        this.outputChannel.appendLine(message);
    }

    dispose() {
        this.outputChannel.dispose();
    }

    readModel(fileName) {
        const file = readJsonFile(path.join(this.apiModelsPath, fileName));
        if (!file) {
            this.log(`⚠️ Failed to load API model ${fileName}`);
            return null;
        }
        return file.value;
    }

    /**
     * @param {string} className
     * @returns {Object|null} class schema from api_models
     */
    loadClassSchema(className) {
        if (!this.classSchemas.has(className)) {
            let schema = this.readModel(`${className}.json`);
            if (!schema && FALLBACK_CLASSES[className]) {
                schema = this.loadClassSchema(FALLBACK_CLASSES[className]);
            }
            this.classSchemas.set(className, schema);
        }
        return this.classSchemas.get(className);
    }

    provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position).text.substring(0, position.character);

        const itemMatch = linePrefix.match(ITEM_PATH);
        if (itemMatch) {
            const itemsSource = this.findItemsSource(document, position);
            if (!itemsSource) {
                return undefined;
            }
            return this.completePath(itemMatch[1], itemsSource, `🔗 Source: \`${itemsSource}\``);
        }

        const rootMatch = linePrefix.match(ROOT_OBJECTS);
        if (rootMatch) {
            const rootObject = rootMatch[1].split('.')[0];
            return this.completePath(rootMatch[1], rootObject, `🌐 Root Object: \`${rootObject}\``);
        }

        return undefined;
    }

    /**
     * Complete `Root.Prop.Sub.` — resolve the class of the last segment and list its properties.
     * @param {string} fullPath typed path, e.g. "Item.Driver." or "Session.Track."
     * @param {string} source binding (ItemsSource or root object) the path starts from
     * @param {string} sourceInfo markdown line describing the source
     */
    completePath(fullPath, source, sourceInfo) {
        const [rootName, ...pathParts] = fullPath.split('.');
        let className = this.resolveClassName(source);

        for (const part of pathParts.filter(Boolean)) {
            if (!className) {
                return undefined;
            }
            const property = this.findProperty(this.loadClassSchema(className), part);
            if (!property || !property.isComplex) {
                return undefined;
            }
            className = property.type;
        }

        if (!className) {
            return undefined;
        }

        const typedPath = [rootName, ...pathParts.filter(Boolean)].join('.');
        const contextInfo = `📦 **${className}**\n\n${sourceInfo}\n\n🔍 Path: \`${typedPath}\``;
        return this.getPropertiesForClass(className, contextInfo);
    }

    /**
     * Find a property by name, including inherited ones.
     * RLT indexes collections by suffix: `Driver0` means `Drivers[0]`.
     */
    findProperty(schema, name) {
        if (!schema) {
            return null;
        }
        const all = [...(schema.inheritedProperties || []), ...(schema.properties || [])];
        const indexed = name.match(/^(.+?)\d+$/);
        if (indexed) {
            const collection = all.find(p => p.name === `${indexed[1]}s` && p.isCollection);
            if (collection) {
                return collection;
            }
        }
        return all.find(p => p.name === name) || null;
    }

    /**
     * Get completion items for a class
     */
    getPropertiesForClass(className, contextInfo) {
        const schema = this.loadClassSchema(className);
        if (!schema) {
            return undefined;
        }

        const createItem = (prop, inherited) => {
            const item = new vscode.CompletionItem(prop.name, this.getCompletionKind(prop));
            item.detail = `${prop.type}${prop.isCollection ? '[]' : ''}${prop.isNullable ? '?' : ''}${inherited ? ' (inherited)' : ''}`;

            const description = inherited ? 'Inherited from base class' : (prop.description || '');
            item.documentation = new vscode.MarkdownString(`${contextInfo}\n\n---\n\n${description}`);
            if (prop.isComplex) {
                item.documentation.appendMarkdown(`\n\n*Complex type: ${prop.type}*`);
            }
            return item;
        };

        return [
            ...(schema.inheritedProperties || []).map(prop => createItem(prop, true)),
            ...(schema.properties || []).map(prop => createItem(prop, false))
        ];
    }

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
     * ItemsSource of the nearest enclosing table / item stack.
     * Inside a component without one, look for the component's usage in layouts.
     */
    findItemsSource(document, position) {
        const offset = document.offsetAt(position);
        const objects = enclosingObjects(parseJsonTree(document.getText()), offset);

        for (const objectNode of objects) {
            for (const sourcePath of ITEMS_SOURCE_PATHS) {
                const sourceNode = stringNodeAt(objectNode, sourcePath);
                // `Item` inside the ItemsSource expression itself refers to the outer item
                const cursorInSource = sourceNode && offset >= sourceNode.offset && offset <= sourceNode.offset + sourceNode.length;
                if (sourceNode && !cursorInSource) {
                    return this.cleanBindingExpression(sourceNode.value);
                }
            }
        }

        for (const objectNode of objects) {
            const componentNode = stringNodeAt(objectNode, ['ComponentName']);
            if (componentNode) {
                return this.searchComponentInLayouts(componentNode.value, document);
            }
        }

        return null;
    }

    searchComponentInLayouts(componentName, document) {
        const layoutsPath = path.join(getThemeContext(document).root, 'layouts');
        return this.searchLayoutsRecursively(layoutsPath, componentName, 0);
    }

    searchLayoutsRecursively(dir, componentName, depth) {
        if (depth > MAX_LAYOUT_DEPTH) {
            return null;
        }

        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return null;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            let result = null;
            if (entry.isDirectory()) {
                result = this.searchLayoutsRecursively(fullPath, componentName, depth + 1);
            } else if (entry.name.endsWith('.json')) {
                const file = readJsonFile(fullPath);
                result = file ? this.findComponentAndItemsSource(file.value, componentName, null, 0) : null;
            }
            if (result) {
                return result;
            }
        }

        return null;
    }

    /**
     * Find usage of the component and the ItemsSource of the block containing it
     */
    findComponentAndItemsSource(obj, componentName, currentItemsSource, depth) {
        if (depth > MAX_JSON_DEPTH || !obj || typeof obj !== 'object') {
            return null;
        }

        let itemsSource = currentItemsSource;
        if (obj.TableOptions && obj.TableOptions.ItemsSource) {
            itemsSource = this.cleanBindingExpression(obj.TableOptions.ItemsSource);
        }
        if (obj.ItemStackOptions && obj.ItemStackOptions.ItemSource) {
            itemsSource = this.cleanBindingExpression(obj.ItemStackOptions.ItemSource);
        }

        if (obj.Component === componentName && itemsSource) {
            return itemsSource;
        }

        for (const value of Object.values(obj)) {
            const children = Array.isArray(value) ? value : [value];
            for (const child of children) {
                const result = this.findComponentAndItemsSource(child, componentName, itemsSource, depth + 1);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    /**
     * Binding path of an expression: "{Session.Drivers}", "<{DriverVar.Driver}>" or "{Item.Laps, Converter=...}"
     */
    cleanBindingExpression(expr) {
        if (typeof expr !== 'string') return expr;
        const binding = expr.match(/\{([^{},]+)/);
        return (binding ? binding[1] : expr.replace(/[{}<>]/g, '')).trim();
    }

    /**
     * Resolve class name from ItemsSource or root object
     */
    resolveClassName(itemsSource) {
        if (this.mapping[itemsSource]) {
            return this.mapping[itemsSource];
        }

        // Partial match (e.g. "Drivers" -> "Session.Drivers")
        const keys = Object.keys(this.mapping);
        const partial = keys.find(key => key.endsWith(`.${itemsSource}`));
        if (partial) {
            return this.mapping[partial];
        }

        // Nested paths like "DriverInfo.Driver.LeagueRoles": try the last two parts, then the last one
        const parts = itemsSource.split('.');
        if (parts.length >= 2) {
            const lastTwo = parts.slice(-2).join('.');
            if (this.mapping[lastTwo]) {
                return this.mapping[lastTwo];
            }
            const lastPart = keys.find(key => key.endsWith(`.${parts[parts.length - 1]}`));
            if (lastPart) {
                return this.mapping[lastPart];
            }
        }

        this.log(`No class mapping for "${itemsSource}"`);
        return null;
    }
}

module.exports = ItemPropertyCompletionProvider;
