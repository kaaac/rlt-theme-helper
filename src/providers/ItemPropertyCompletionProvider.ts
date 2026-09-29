import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getThemeContext } from '../core/themeContext';
import { parseJsonTree, enclosingObjects, stringNodeAt, readJsonFile, isPlainObject } from '../core/json';

/** Property of an API model class (api_models/<Class>.json) */
interface ModelProperty {
    name: string;
    type: string;
    isNullable?: boolean;
    isCollection?: boolean;
    isComplex?: boolean;
    description?: string;
}

interface ClassSchema {
    className: string;
    properties?: ModelProperty[];
    inheritedProperties?: ModelProperty[];
}

// Where a block declares the collection its Item.* bindings refer to
const ITEMS_SOURCE_PATHS = [
    ['TableOptions', 'ItemsSource'],
    ['ItemStackOptions', 'ItemSource']
];

const ROOT_OBJECTS = /["{]?((?:Session|Event|Season|Standings|Events|Lineups|Statistics|DriverInfo|Penalty|Penalties|LayoutInfo)\.[\w.]*)$/i;
const ITEM_PATH = /["{]?(Item\.[\w.]*)$/;

// Classes referenced by models but not generated
const FALLBACK_CLASSES: Record<string, string> = {
    DriverRenderObject: 'DriverRenderData',
    TeamRenderObject: 'TeamRenderData'
};

const MAX_LAYOUT_DEPTH = 5;
const MAX_JSON_DEPTH = 20;

/**
 * Provider for Item property autocomplete
 * Detects ItemsSource in hierarchy and suggests properties based on API models
 */
export class ItemPropertyCompletionProvider implements vscode.CompletionItemProvider, vscode.Disposable {
    private readonly outputChannel = vscode.window.createOutputChannel('RLT Item Provider');
    private readonly mapping: Record<string, string>;
    private readonly classSchemas = new Map<string, ClassSchema | null>();

    /**
     * @param apiModelsPath directory with generated API models (mapping.json and <Class>.json)
     */
    constructor(private readonly apiModelsPath: string) {
        const mapping = this.readModel('mapping.json');
        this.mapping = isPlainObject(mapping) ? mapping as Record<string, string> : {};
    }

    dispose(): void {
        this.outputChannel.dispose();
    }

    private log(message: string): void {
        this.outputChannel.appendLine(message);
    }

    private readModel(fileName: string): unknown {
        const file = readJsonFile(path.join(this.apiModelsPath, fileName));
        if (!file) {
            this.log(`⚠️ Failed to load API model ${fileName}`);
            return null;
        }
        return file.value;
    }

    loadClassSchema(className: string): ClassSchema | null {
        if (!this.classSchemas.has(className)) {
            let schema = this.readModel(`${className}.json`) as ClassSchema | null;
            if (!schema && FALLBACK_CLASSES[className]) {
                schema = this.loadClassSchema(FALLBACK_CLASSES[className]);
            }
            this.classSchemas.set(className, schema);
        }
        return this.classSchemas.get(className) ?? null;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
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
     * @param fullPath typed path, e.g. "Item.Driver." or "Session.Track."
     * @param source binding (ItemsSource or root object) the path starts from
     * @param sourceInfo markdown line describing the source
     */
    private completePath(fullPath: string, source: string, sourceInfo: string): vscode.CompletionItem[] | undefined {
        const [rootName, ...rest] = fullPath.split('.');
        const pathParts = rest.filter(Boolean);
        let className = this.resolveClassName(source);

        for (const part of pathParts) {
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

        const typedPath = [rootName, ...pathParts].join('.');
        const contextInfo = `📦 **${className}**\n\n${sourceInfo}\n\n🔍 Path: \`${typedPath}\``;
        return this.getPropertiesForClass(className, contextInfo);
    }

    /**
     * Find a property by name, including inherited ones.
     * RLT indexes collections by suffix: `Driver0` means `Drivers[0]`.
     */
    private findProperty(schema: ClassSchema | null, name: string): ModelProperty | null {
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

    private getPropertiesForClass(className: string, contextInfo: string): vscode.CompletionItem[] | undefined {
        const schema = this.loadClassSchema(className);
        if (!schema) {
            return undefined;
        }

        const createItem = (prop: ModelProperty, inherited: boolean) => {
            const item = new vscode.CompletionItem(prop.name, getCompletionKind(prop));
            item.detail = `${prop.type}${prop.isCollection ? '[]' : ''}${prop.isNullable ? '?' : ''}${inherited ? ' (inherited)' : ''}`;

            const description = inherited ? 'Inherited from base class' : (prop.description || '');
            const documentation = new vscode.MarkdownString(`${contextInfo}\n\n---\n\n${description}`);
            if (prop.isComplex) {
                documentation.appendMarkdown(`\n\n*Complex type: ${prop.type}*`);
            }
            item.documentation = documentation;
            return item;
        };

        return [
            ...(schema.inheritedProperties || []).map(prop => createItem(prop, true)),
            ...(schema.properties || []).map(prop => createItem(prop, false))
        ];
    }

    /**
     * ItemsSource of the nearest enclosing table / item stack.
     * Inside a component without one, look for the component's usage in layouts.
     */
    private findItemsSource(document: vscode.TextDocument, position: vscode.Position): string | null {
        const offset = document.offsetAt(position);
        const objects = enclosingObjects(parseJsonTree(document.getText()), offset);

        for (const objectNode of objects) {
            for (const sourcePath of ITEMS_SOURCE_PATHS) {
                const sourceNode = stringNodeAt(objectNode, sourcePath);
                // `Item` inside the ItemsSource expression itself refers to the outer item
                const cursorInSource = sourceNode && offset >= sourceNode.offset && offset <= sourceNode.offset + sourceNode.length;
                if (sourceNode && !cursorInSource) {
                    return cleanBindingExpression(sourceNode.value);
                }
            }
        }

        for (const objectNode of objects) {
            const componentNode = stringNodeAt(objectNode, ['ComponentName']);
            if (componentNode) {
                return this.searchLayouts(path.join(getThemeContext(document).root, 'layouts'), componentNode.value, 0);
            }
        }

        return null;
    }

    /**
     * Search layouts for usage of the component and return the ItemsSource around it
     */
    private searchLayouts(dir: string, componentName: string, depth: number): string | null {
        if (depth > MAX_LAYOUT_DEPTH) {
            return null;
        }

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return null;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            let result: string | null = null;
            if (entry.isDirectory()) {
                result = this.searchLayouts(fullPath, componentName, depth + 1);
            } else if (entry.name.endsWith('.json')) {
                const file = readJsonFile(fullPath);
                result = file ? findComponentItemsSource(file.value, componentName, null, 0) : null;
            }
            if (result) {
                return result;
            }
        }

        return null;
    }

    /**
     * Resolve class name from ItemsSource or root object
     */
    resolveClassName(itemsSource: string): string | null {
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

function getCompletionKind(property: ModelProperty): vscode.CompletionItemKind {
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
 * Find usage of the component and the ItemsSource of the block containing it
 */
function findComponentItemsSource(node: unknown, componentName: string, currentItemsSource: string | null, depth: number): string | null {
    if (depth > MAX_JSON_DEPTH || typeof node !== 'object' || node === null) {
        return null;
    }
    if (Array.isArray(node)) {
        // Arrays don't count as a nesting level, only objects do
        for (const child of node) {
            const result = findComponentItemsSource(child, componentName, currentItemsSource, depth);
            if (result) {
                return result;
            }
        }
        return null;
    }

    const obj = node as Record<string, unknown>;
    let itemsSource = currentItemsSource;
    for (const [options, property] of ITEMS_SOURCE_PATHS) {
        const value = isPlainObject(obj[options]) ? (obj[options] as Record<string, unknown>)[property] : undefined;
        if (typeof value === 'string' && value) {
            itemsSource = cleanBindingExpression(value);
        }
    }

    if (obj.Component === componentName && itemsSource) {
        return itemsSource;
    }

    for (const value of Object.values(obj)) {
        const result = findComponentItemsSource(value, componentName, itemsSource, depth + 1);
        if (result) {
            return result;
        }
    }

    return null;
}

/**
 * Binding path of an expression: "{Session.Drivers}", "<{DriverVar.Driver}>" or "{Item.Laps, Converter=...}"
 */
export function cleanBindingExpression(expr: string): string {
    const binding = expr.match(/\{([^{},]+)/);
    return (binding ? binding[1] : expr.replace(/[{}<>]/g, '')).trim();
}
