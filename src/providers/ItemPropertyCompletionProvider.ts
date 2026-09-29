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

// `Item.` / `ParentItem.` path being typed (not part of a longer name)
const ITEM_PATH = /(?<![\w.])((?:Parent)?Item\.[\w.]*)$/;

// Root objects whose class depends on the layout's RenderType (data-objects.md)
const CONTEXT_ROOTS: Record<string, Record<string, string>> = {
    DriverInfo: { DriverSession: 'DriverSessionRenderHost' },
    Penalties: { PenaltySeasonStatistics: 'SeasonPenaltiesRenderHost' }
};

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
    private readonly rootObjectPath: RegExp;
    private readonly classSchemas = new Map<string, ClassSchema | null>();

    /**
     * @param apiModelsPath directory with generated API models (mapping.json and <Class>.json)
     */
    constructor(private readonly apiModelsPath: string) {
        const mapping = this.readModel('mapping.json');
        this.mapping = isPlainObject(mapping) ? mapping as Record<string, string> : {};

        // Root objects are the mapping entries without a dot (Session, Standings, DriverStatistics, ...)
        const roots = Object.keys(this.mapping).filter(key => !key.includes('.'));
        this.rootObjectPath = new RegExp(`(?<![\\w.])((?:${roots.join('|')})\\.[\\w.]*)$`);
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
        const renderType = findRenderType(document);

        const itemMatch = linePrefix.match(ITEM_PATH);
        if (itemMatch) {
            // Item -> nearest items source, ParentItem -> the one around it
            const sources = this.findItemsSources(document, position);
            const index = itemMatch[1].startsWith('ParentItem') ? 1 : 0;
            if (!sources[index]) {
                return undefined;
            }
            const className = this.resolveSource(sources, index, renderType);
            return this.completePath(itemMatch[1], className, `🔗 Source: \`${sources[index]}\``);
        }

        const rootMatch = linePrefix.match(this.rootObjectPath);
        if (rootMatch) {
            const rootObject = rootMatch[1].split('.')[0];
            return this.completePath(rootMatch[1], this.rootClass(rootObject, renderType), `🌐 Root Object: \`${rootObject}\``);
        }

        return undefined;
    }

    /**
     * Complete `Root.Prop.Sub.` — navigate from the root class to the last segment and list its properties.
     * @param fullPath typed path, e.g. "Item.Driver." or "Session.Track."
     * @param rootClass class of the path's first segment
     * @param sourceInfo markdown line describing the source
     */
    private completePath(fullPath: string, rootClass: string | null, sourceInfo: string): vscode.CompletionItem[] | undefined {
        const [rootName, ...rest] = fullPath.split('.');
        const pathParts = rest.filter(Boolean);
        const className = rootClass && this.navigate(rootClass, pathParts);
        if (!className) {
            return undefined;
        }

        const typedPath = [rootName, ...pathParts].join('.');
        const contextInfo = `📦 **${className}**\n\n${sourceInfo}\n\n🔍 Path: \`${typedPath}\``;
        return this.getPropertiesForClass(className, contextInfo);
    }

    /**
     * Class reached by following complex properties from `className`, or null
     */
    private navigate(className: string, pathParts: string[]): string | null {
        let current: string | null = className;
        for (const part of pathParts) {
            const property: ModelProperty | null = current ? this.findProperty(this.loadClassSchema(current), part) : null;
            if (!property || !property.isComplex) {
                return null;
            }
            current = property.type;
        }
        return current;
    }

    /**
     * Class of the items of `sources[index]` (nearest source first).
     * Relative sources like `Item.Stints` are resolved through the class of the enclosing source.
     */
    private resolveSource(sources: string[], index: number, renderType: string | null): string | null {
        const source = sources[index];
        if (!source) {
            return null;
        }
        const [head, ...pathParts] = source.split('.');
        const base = head === 'Item' ? this.resolveSource(sources, index + 1, renderType)
            : head === 'ParentItem' ? this.resolveSource(sources, index + 2, renderType)
            : this.rootClass(head, renderType);

        return (base && this.navigate(base, pathParts)) || this.resolveClassName(source);
    }

    /**
     * Class of a root object, taking the layout's RenderType into account
     */
    private rootClass(rootObject: string, renderType: string | null): string | null {
        return (renderType && CONTEXT_ROOTS[rootObject]?.[renderType]) || this.mapping[rootObject] || null;
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
        const exact = all.find(p => p.name === name);
        if (exact) {
            return exact;
        }
        const indexed = name.match(/^(.+?)\d+$/);
        return (indexed && all.find(p => p.name === `${indexed[1]}s` && p.isCollection)) || null;
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
     * Items sources around the cursor, nearest first (tables and item stacks).
     * Inside a component, continues with the sources around the component's usage in layouts.
     */
    private findItemsSources(document: vscode.TextDocument, position: vscode.Position): string[] {
        const offset = document.offsetAt(position);
        const objects = enclosingObjects(parseJsonTree(document.getText()), offset);
        const sources: string[] = [];

        for (const objectNode of objects) {
            for (const sourcePath of ITEMS_SOURCE_PATHS) {
                const sourceNode = stringNodeAt(objectNode, sourcePath);
                // `Item` inside the ItemsSource expression itself refers to the outer item
                const cursorInSource = sourceNode && offset >= sourceNode.offset && offset <= sourceNode.offset + sourceNode.length;
                if (sourceNode && !cursorInSource) {
                    sources.push(cleanBindingExpression(sourceNode.value));
                }
            }
        }

        const outermost = sources[sources.length - 1];
        if (!outermost || /^(Parent)?Item\./.test(outermost)) {
            for (const objectNode of objects) {
                const componentNode = stringNodeAt(objectNode, ['ComponentName']);
                if (componentNode) {
                    const layoutsDir = path.join(getThemeContext(document).root, 'layouts');
                    sources.push(...(this.searchLayouts(layoutsDir, componentNode.value, 0) || []));
                    break;
                }
            }
        }

        return sources;
    }

    /**
     * Search layouts for usage of the component and return the items sources around it, nearest first
     */
    private searchLayouts(dir: string, componentName: string, depth: number): string[] | null {
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
            let result: string[] | null = null;
            if (entry.isDirectory()) {
                result = this.searchLayouts(fullPath, componentName, depth + 1);
            } else if (entry.name.endsWith('.json')) {
                const file = readJsonFile(fullPath);
                result = file ? findComponentItemsSources(file.value, componentName, [], 0) : null;
            }
            if (result) {
                return result;
            }
        }

        return null;
    }

    /**
     * Legacy lookup of an items source in mapping.json by name, used when the path can't be navigated
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
 * RenderType of the layout the document belongs to (from the nearest layout_description.json), or null
 */
export function findRenderType(document: vscode.TextDocument): string | null {
    const root = getThemeContext(document).root;
    for (let dir = path.dirname(document.uri.fsPath); dir.startsWith(root); dir = path.dirname(dir)) {
        const description = readJsonFile(path.join(dir, 'layout_description.json'));
        if (description) {
            const renderType = isPlainObject(description.value) ? description.value.RenderType : null;
            return typeof renderType === 'string' ? renderType : null;
        }
        if (dir === root) {
            break;
        }
    }
    return null;
}

/**
 * Find usage of the component and the items sources of the blocks around it (nearest first)
 */
function findComponentItemsSources(node: unknown, componentName: string, outerSources: string[], depth: number): string[] | null {
    if (depth > MAX_JSON_DEPTH || typeof node !== 'object' || node === null) {
        return null;
    }
    if (Array.isArray(node)) {
        // Arrays don't count as a nesting level, only objects do
        for (const child of node) {
            const result = findComponentItemsSources(child, componentName, outerSources, depth);
            if (result) {
                return result;
            }
        }
        return null;
    }

    const obj = node as Record<string, unknown>;
    let sources = outerSources;
    for (const [options, property] of ITEMS_SOURCE_PATHS) {
        const value = isPlainObject(obj[options]) ? (obj[options] as Record<string, unknown>)[property] : undefined;
        if (typeof value === 'string' && value) {
            sources = [cleanBindingExpression(value), ...sources];
        }
    }

    if (obj.Component === componentName && sources.length > 0) {
        return sources;
    }

    for (const value of Object.values(obj)) {
        const result = findComponentItemsSources(value, componentName, sources, depth + 1);
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
