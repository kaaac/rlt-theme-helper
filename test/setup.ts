/**
 * Mocha setup: resolve `require('vscode')` to the in-memory mock, so providers run in plain node.
 */
import Module = require('module');

interface ModuleInternals {
    _resolveFilename(request: string, ...rest: unknown[]): string;
}

const moduleInternals = Module as unknown as ModuleInternals;
const originalResolve = moduleInternals._resolveFilename;
const mockPath = require.resolve('./mocks/vscode');

moduleInternals._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'vscode') {
        return mockPath;
    }
    return originalResolve.call(this, request, ...rest);
};
