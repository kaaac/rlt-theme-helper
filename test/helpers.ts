import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import { createDocument, Uri } from './mocks/vscode';

/** Repository root (tests run from out/test) */
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const SAMPLE_THEME = path.join(REPO_ROOT, 'test', 'fixtures', 'sample-theme');
export const API_MODELS = path.join(REPO_ROOT, 'api_models');

/** Cursor marker in test documents */
export const CURSOR = '|';

/** Uri of a file inside the sample theme */
export function themeUri(...parts: string[]): vscode.Uri {
    return Uri.file(path.join(SAMPLE_THEME, ...parts)) as unknown as vscode.Uri;
}

/**
 * Document at `relativePath` inside the sample theme. Uses the file on disk when `text` is omitted.
 */
export function themeDocument(relativePath: string, text?: string): vscode.TextDocument {
    const fsPath = path.join(SAMPLE_THEME, relativePath);
    const content = text ?? fs.readFileSync(fsPath, 'utf8');
    return createDocument(fsPath, content) as unknown as vscode.TextDocument;
}

/**
 * Document with a `|` cursor marker; returns the document (without the marker) and the cursor position.
 */
export function documentWithCursor(relativePath: string, textWithCursor: string): { document: vscode.TextDocument, position: vscode.Position } {
    const offset = textWithCursor.indexOf(CURSOR);
    if (offset < 0) {
        throw new Error('Test document has no cursor marker');
    }
    const document = themeDocument(relativePath, textWithCursor.slice(0, offset) + textWithCursor.slice(offset + 1));
    return { document, position: document.positionAt(offset) };
}

export function labels(items: { label: string | { label: string } }[] | undefined | null): string[] {
    return (items || []).map(item => typeof item.label === 'string' ? item.label : item.label.label);
}
