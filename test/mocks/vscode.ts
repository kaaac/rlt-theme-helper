/**
 * Minimal `vscode` API used by the unit tests. test/setup.ts makes `require('vscode')` resolve here.
 * Only what the extension's providers actually use is implemented.
 */
import * as path from 'path';

export class Uri {
    readonly scheme = 'file';
    private constructor(readonly fsPath: string) { }
    static file(fsPath: string): Uri { return new Uri(path.resolve(fsPath)); }
    static joinPath(uri: Uri, ...parts: string[]): Uri { return new Uri(path.join(uri.fsPath, ...parts)); }
    toString(): string { return 'file:///' + this.fsPath.replace(/\\/g, '/'); }
}

export class Position {
    constructor(readonly line: number, readonly character: number) { }
    isBefore(other: Position): boolean {
        return this.line < other.line || (this.line === other.line && this.character < other.character);
    }
    isAfter(other: Position): boolean { return other.isBefore(this); }
}

export class Range {
    constructor(readonly start: Position, readonly end: Position) { }
    contains(other: Range): boolean { return !other.start.isBefore(this.start) && !other.end.isAfter(this.end); }
}

export class Selection extends Range { }

export class Color {
    constructor(readonly red: number, readonly green: number, readonly blue: number, readonly alpha: number) { }
}

export class ColorInformation {
    constructor(readonly range: Range, readonly color: Color) { }
}

export class ColorPresentation {
    constructor(readonly label: string) { }
}

export class MarkdownString {
    isTrusted = false;
    constructor(public value = '') { }
    appendMarkdown(value: string): this { this.value += value; return this; }
    appendCodeblock(value: string, language: string): this { this.value += `\n\`\`\`${language}\n${value}\n\`\`\`\n`; return this; }
}

export class CompletionItem {
    detail?: string;
    documentation?: MarkdownString;
    constructor(readonly label: string, readonly kind?: number) { }
}

export class InlayHint {
    paddingLeft?: boolean;
    tooltip?: MarkdownString | string;
    constructor(readonly position: Position, readonly label: string, readonly kind?: number) { }
}

export class Hover {
    constructor(readonly contents: MarkdownString, readonly range?: Range) { }
}

export class Location {
    constructor(readonly uri: Uri, readonly range: Position | Range) { }
}

export class WorkspaceEdit {
    readonly replacements: { uri: Uri, range: Range, text: string }[] = [];
    replace(uri: Uri, range: Range, text: string): void { this.replacements.push({ uri, range, text }); }
}

export class CodeAction {
    edit?: WorkspaceEdit;
    diagnostics?: unknown[];
    isPreferred?: boolean;
    constructor(readonly title: string, readonly kind?: string) { }
}

export const CodeActionKind = { QuickFix: 'quickfix' };

export class SnippetString {
    constructor(readonly value: string) { }
}

type Listener<T> = (event: T) => unknown;

export class EventEmitter<T> {
    private listeners: Listener<T>[] = [];
    readonly event = (listener: Listener<T>) => {
        this.listeners.push(listener);
        return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
    };
    fire(event: T): void { this.listeners.forEach(listener => listener(event)); }
    dispose(): void { this.listeners = []; }
}

export enum CompletionItemKind { Text, Method, Function, Constructor, Field, Variable, Class, Interface, Module, Property, Unit, Value, Enum, Keyword, Snippet, Color, File, Reference, Folder, EnumMember, Constant, Struct, Event }
export enum InlayHintKind { Type = 1, Parameter = 2 }

/** Messages shown through window.show*Message, for assertions */
export const shownMessages: string[] = [];

export const window = {
    activeTextEditor: undefined,
    createOutputChannel: () => ({ appendLine: () => undefined, dispose: () => undefined }),
    showErrorMessage: (message: string) => { shownMessages.push(message); return Promise.resolve(undefined); },
    showWarningMessage: (message: string) => { shownMessages.push(message); return Promise.resolve(undefined); },
    showInformationMessage: (message: string) => { shownMessages.push(message); return Promise.resolve(undefined); }
};

export const workspace = {
    getWorkspaceFolder: () => undefined,
    createFileSystemWatcher: () => {
        const noop = () => ({ dispose: () => undefined });
        return { onDidChange: noop, onDidCreate: noop, onDidDelete: noop, dispose: () => undefined };
    }
};

/**
 * In-memory TextDocument.
 */
export function createDocument(fsPath: string, text: string) {
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') lineStarts.push(i + 1);
    }
    const positionAt = (offset: number) => {
        const clamped = Math.max(0, Math.min(offset, text.length));
        let line = 0;
        while (line + 1 < lineStarts.length && lineStarts[line + 1] <= clamped) line++;
        return new Position(line, clamped - lineStarts[line]);
    };
    const offsetAt = (position: Position) => lineStarts[position.line] + position.character;
    return {
        uri: Uri.file(fsPath),
        fileName: fsPath,
        languageId: 'json',
        lineCount: lineStarts.length,
        getText: (range?: Range) => range ? text.substring(offsetAt(range.start), offsetAt(range.end)) : text,
        lineAt: (lineOrPosition: number | Position) => {
            const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
            const end = line + 1 < lineStarts.length ? lineStarts[line + 1] : text.length;
            return { text: text.substring(lineStarts[line], end).replace(/\r?\n$/, '') };
        },
        positionAt,
        offsetAt
    };
}
