import * as vscode from 'vscode';
import snippets, { Snippet } from './snippets';

interface SnippetPickItem extends vscode.QuickPickItem {
    snippet: Snippet;
}

export async function showSnippets(): Promise<void> {
    const items: SnippetPickItem[] = Object.entries(snippets).map(([label, snippet]) => ({
        label,
        description: snippet.description,
        snippet
    }));
    const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a snippet' });
    const editor = vscode.window.activeTextEditor;
    if (selected && editor) {
        await editor.insertSnippet(new vscode.SnippetString(selected.snippet.body.join('\n')));
    }
}
