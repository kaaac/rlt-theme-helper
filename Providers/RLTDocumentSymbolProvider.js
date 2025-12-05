const vscode = require('vscode');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

/**
 * Document Symbol Provider for RLT Theme files
 * Enhances VS Code's Outline view with RLT-specific semantics
 */
class RLTDocumentSymbolProvider {
    
    provideDocumentSymbols(document) {
        try {
            const text = document.getText();
            const cleanedText = removeCommentsFromJSON(text);
            const data = JSON.parse(cleanedText);
            
            return this.parseValue(data, document, 0, 'root');
            
        } catch (error) {
            console.error('[RLT Symbol Provider] Error:', error);
            return [];
        }
    }

    parseValue(value, document, searchFrom, key = '') {
        if (typeof value !== 'object' || value === null) {
            return [];
        }

        if (Array.isArray(value)) {
            return this.parseArray(value, document, searchFrom, key);
        }

        return this.parseObject(value, document, searchFrom);
    }

    parseObject(obj, document, searchFrom) {
        const symbols = [];
        const text = document.getText();
        
        // Check for wrapper objects (BlockRoot, Component, etc.)
        const keys = Object.keys(obj);
        if (keys.length === 1 && ['BlockRoot', 'Component', 'Root', 'Block'].includes(keys[0])) {
            const wrapperKey = keys[0];
            const wrapperValue = obj[wrapperKey];
            
            if (typeof wrapperValue === 'object' && !Array.isArray(wrapperValue)) {
                const range = this.findProperty(wrapperKey, text, searchFrom);
                if (range) {
                    const wrapperSymbol = new vscode.DocumentSymbol(
                        wrapperKey,
                        'Root Container',
                        vscode.SymbolKind.Namespace,
                        range.full,
                        range.name
                    );
                    
                    const children = this.parseObject(wrapperValue, document, range.valueStart);
                    wrapperSymbol.children.push(...children);
                    
                    return [wrapperSymbol];
                }
            }
        }

        // Parse each property
        for (const [key, value] of Object.entries(obj)) {
            const range = this.findProperty(key, text, searchFrom);
            if (!range) continue;

            const symbol = this.createSymbol(key, value, range);
            if (symbol) {
                // Add children recursively
                if (typeof value === 'object' && value !== null) {
                    const children = this.parseValue(value, document, range.valueStart, key);
                    symbol.children.push(...children);
                }
                symbols.push(symbol);
            }
        }

        return symbols;
    }

    parseArray(array, document, searchFrom, parentKey) {
        const symbols = [];
        const text = document.getText();
        
        let arrayStart = text.indexOf('[', searchFrom);
        if (arrayStart === -1) return symbols;

        array.forEach((item, index) => {
            const range = this.findArrayElement(text, arrayStart, index);
            
            if (typeof item === 'object' && item !== null) {
                const name = item.Name || item.ComponentName || item.BlockType || 
                             item.Block || item.Condition || item.PropertyName || '';
                const label = name ? `[${index}] ${name}` : `[${index}]`;
                const detail = item.BlockType || item.Block || item.PropertyName || 'Object';
                
                const symbol = new vscode.DocumentSymbol(
                    label,
                    detail,
                    vscode.SymbolKind.Object,
                    range.full,
                    range.name
                );

                const children = this.parseValue(item, document, range.valueStart, `[${index}]`);
                symbol.children.push(...children);

                symbols.push(symbol);
            } else {
                symbols.push(new vscode.DocumentSymbol(
                    `[${index}]`,
                    String(item),
                    vscode.SymbolKind.Constant,
                    range.full,
                    range.name
                ));
            }
        });

        return symbols;
    }

    createSymbol(key, value, range) {
        let kind, detail;

        if (Array.isArray(value)) {
            kind = vscode.SymbolKind.Array;
            detail = `Array (${value.length})`;
        } else if (typeof value === 'object' && value !== null) {
            // RLT-specific symbol kinds
            if (key === 'BlockType' || key === 'Block') {
                kind = vscode.SymbolKind.Module;
                detail = 'Block Type';
            } else if (key === 'Items' || key === 'Children') {
                kind = vscode.SymbolKind.Array;
                detail = 'Container';
            } else if (key === 'Styles') {
                kind = vscode.SymbolKind.Object;
                detail = 'Styles';
            } else if (key === 'Triggers') {
                kind = vscode.SymbolKind.Array;
                detail = 'Triggers';
            } else if (key === 'ComponentName' || key === 'Name') {
                kind = vscode.SymbolKind.Class;
                detail = 'Component Name';
            } else {
                kind = vscode.SymbolKind.Object;
                detail = `Object (${Object.keys(value).length})`;
            }
        } else {
            kind = vscode.SymbolKind.Property;
            detail = String(value);
        }

        // For ComponentName/Name, use the value as label
        const label = (key === 'ComponentName' || key === 'Name') && typeof value === 'string' ? value : key;

        return new vscode.DocumentSymbol(
            label,
            detail,
            kind,
            range.full,
            range.name
        );
    }

    findProperty(propertyName, text, startFrom) {
        const pattern = `"${propertyName}"`;
        
        let searchStart = startFrom;
        if (startFrom > 0) {
            const openBrace = text.indexOf('{', startFrom);
            if (openBrace !== -1 && openBrace - startFrom < 100) {
                searchStart = openBrace;
            }
        }

        let depth = 0;
        let inString = false;
        
        for (let i = searchStart; i < text.length; i++) {
            const char = text[i];
            
            if (char === '\\') {
                i++;
                continue;
            }
            
            if (char === '"') {
                if (!inString && depth === 1 && text.substr(i, pattern.length) === pattern) {
                    let colonPos = i + pattern.length;
                    while (colonPos < text.length && text[colonPos] !== ':') colonPos++;
                    
                    if (text[colonPos] === ':') {
                        let valueStart = colonPos + 1;
                        while (valueStart < text.length && /\s/.test(text[valueStart])) valueStart++;
                        
                        const valueEnd = this.findValueEnd(text, valueStart);
                        
                        const document = vscode.window.activeTextEditor?.document;
                        if (!document) return null;
                        
                        return {
                            name: new vscode.Range(document.positionAt(i), document.positionAt(i + pattern.length)),
                            full: new vscode.Range(document.positionAt(i), document.positionAt(valueEnd)),
                            valueStart
                        };
                    }
                }
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '{' || char === '[') depth++;
                else if (char === '}' || char === ']') {
                    depth--;
                    if (depth === 0) return null;
                }
            }
        }
        
        return null;
    }

    findValueEnd(text, startPos) {
        let depth = 0;
        let inString = false;
        
        for (let i = startPos; i < text.length; i++) {
            const char = text[i];
            
            if (char === '\\') {
                i++;
                continue;
            }
            
            if (char === '"') {
                inString = !inString;
                if (!inString && depth === 0 && text[startPos] === '"') {
                    return i + 1;
                }
            }
            
            if (!inString) {
                if (char === '{' || char === '[') depth++;
                else if (char === '}' || char === ']') {
                    if (depth === 0) return i;
                    depth--;
                    if (depth === 0) return i + 1;
                }
                else if ((char === ',' || char === '\n') && depth === 0) return i;
            }
        }
        
        return text.length;
    }

    findArrayElement(text, arrayStart, elementIndex) {
        let depth = 0;
        let elementCount = 0;
        let inString = false;
        let elementStartPos = arrayStart;
        
        for (let i = arrayStart; i < text.length; i++) {
            const char = text[i];
            
            if (char === '\\') {
                i++;
                continue;
            }
            
            if (char === '"') inString = !inString;
            
            if (!inString) {
                if (char === '[') {
                    depth++;
                    if (depth === 1 && elementCount === 0) {
                        elementStartPos = i + 1;
                        while (elementStartPos < text.length && /\s/.test(text[elementStartPos])) {
                            elementStartPos++;
                        }
                        if (elementIndex === 0) {
                            return this.createRange(elementStartPos, this.findValueEnd(text, elementStartPos));
                        }
                    }
                } else if (char === ']') {
                    depth--;
                } else if (char === '{') {
                    depth++;
                } else if (char === '}') {
                    depth--;
                } else if (char === ',' && depth === 1) {
                    elementCount++;
                    if (elementCount === elementIndex) {
                        elementStartPos = i + 1;
                        while (elementStartPos < text.length && /\s/.test(text[elementStartPos])) {
                            elementStartPos++;
                        }
                        return this.createRange(elementStartPos, this.findValueEnd(text, elementStartPos));
                    }
                }
            }
        }
        
        return this.createRange(0, 1);
    }

    createRange(start, end) {
        const document = vscode.window.activeTextEditor?.document;
        if (!document) {
            const pos = new vscode.Position(0, 0);
            return { name: new vscode.Range(pos, pos), full: new vscode.Range(pos, pos), valueStart: 0 };
        }
        
        return {
            name: new vscode.Range(document.positionAt(start), document.positionAt(Math.min(start + 10, end))),
            full: new vscode.Range(document.positionAt(start), document.positionAt(end)),
            valueStart: start
        };
    }
}

module.exports = RLTDocumentSymbolProvider;
