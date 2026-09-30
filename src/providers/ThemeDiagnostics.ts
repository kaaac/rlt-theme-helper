import * as vscode from 'vscode';
import { findThemeProblems } from '../core/diagnostics';
import { onDidChangeTheme } from '../core/themeContext';

const SOURCE = 'RLT';
const DEBOUNCE_MS = 400;
const SUGGESTION = /Did you mean '([^']+)'\?$/;

function isEnabled(): boolean {
    return vscode.workspace.getConfiguration('rltThemeHelper').get<boolean>('diagnostics.enabled', true);
}

function isThemeJson(document: vscode.TextDocument): boolean {
    return document.languageId === 'json' && document.uri.scheme === 'file';
}

/**
 * Warnings for unknown style / component / trigger names and variables in open theme files
 */
export function registerThemeDiagnostics(context: vscode.ExtensionContext): void {
    const collection = vscode.languages.createDiagnosticCollection('rlt-theme');
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const refresh = (document: vscode.TextDocument) => {
        if (!isThemeJson(document)) {
            return;
        }
        if (!isEnabled()) {
            collection.delete(document.uri);
            return;
        }
        const diagnostics = findThemeProblems(document).map(problem => {
            const range = new vscode.Range(document.positionAt(problem.offset), document.positionAt(problem.offset + problem.length));
            const message = problem.suggestion ? `${problem.message}. Did you mean '${problem.suggestion}'?` : problem.message;
            const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
            diagnostic.source = SOURCE;
            diagnostic.code = problem.code;
            return diagnostic;
        });
        collection.set(document.uri, diagnostics);
    };

    const scheduleRefresh = (document: vscode.TextDocument) => {
        const key = document.uri.toString();
        clearTimeout(timers.get(key));
        timers.set(key, setTimeout(() => {
            timers.delete(key);
            refresh(document);
        }, DEBOUNCE_MS));
    };

    const refreshAll = () => vscode.workspace.textDocuments.forEach(scheduleRefresh);

    context.subscriptions.push(
        collection,
        vscode.workspace.onDidOpenTextDocument(scheduleRefresh),
        vscode.workspace.onDidChangeTextDocument(event => scheduleRefresh(event.document)),
        vscode.workspace.onDidCloseTextDocument(document => collection.delete(document.uri)),
        // Definitions in other files changed (styles, vars, components, ...)
        onDidChangeTheme(refreshAll),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('rltThemeHelper.diagnostics')) refreshAll();
        }),
        vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: 'json' }, new SuggestionQuickFix(), {
            providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
        }),
        { dispose: () => timers.forEach(clearTimeout) }
    );

    refreshAll();
}

/**
 * "Change to 'X'" for warnings with a similar existing name
 */
export class SuggestionQuickFix implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
        return context.diagnostics
            .filter(diagnostic => diagnostic.source === SOURCE)
            .flatMap(diagnostic => {
                const suggestion = diagnostic.message.match(SUGGESTION)?.[1];
                if (!suggestion) {
                    return [];
                }
                const action = new vscode.CodeAction(`Change to '${suggestion}'`, vscode.CodeActionKind.QuickFix);
                action.edit = new vscode.WorkspaceEdit();
                action.edit.replace(document.uri, diagnostic.range, suggestion);
                action.diagnostics = [diagnostic];
                action.isPreferred = true;
                return [action];
            });
    }
}
