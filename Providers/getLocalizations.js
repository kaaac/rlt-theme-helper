const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const removeCommentsFromJSON = require('./removeCommentsFromJSON');

/**
 * Get localization strings from the appropriate language file
 * @returns {Object} Localization strings or empty object
 */
function getLocalizations() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return {};
    }

    const folderPath = workspaceFolders[0].uri.fsPath;
    const localizationsPath = path.join(folderPath, 'localizations');

    // Check if localizations folder exists
    if (!fs.existsSync(localizationsPath)) {
        return {};
    }

    // Get all JSON files in localizations folder
    const files = fs.readdirSync(localizationsPath)
        .filter(file => file.endsWith('.json'));

    if (files.length === 0) {
        return {};
    }

    // If only one file, use it
    if (files.length === 1) {
        return parseLocalizationFile(path.join(localizationsPath, files[0]));
    }

    // Multiple files - need to determine which one to use
    const defaultLocalizationId = getDefaultLocalizationId(folderPath);
    
    if (defaultLocalizationId) {
        // Try to find file with matching ID
        for (const file of files) {
            const filePath = path.join(localizationsPath, file);
            const content = parseLocalizationFile(filePath);
            
            if (content && content.ID === defaultLocalizationId) {
                return content;
            }
        }
    }

    // Fallback: try to find english.json
    const englishFile = files.find(f => f.toLowerCase() === 'english.json');
    if (englishFile) {
        return parseLocalizationFile(path.join(localizationsPath, englishFile));
    }

    // Last resort: use first file
    return parseLocalizationFile(path.join(localizationsPath, files[0]));
}

/**
 * Get DefaultLocalizationId from theme_description.json
 * @param {string} folderPath 
 * @returns {string|null}
 */
function getDefaultLocalizationId(folderPath) {
    const themeDescPath = path.join(folderPath, 'theme_description.json');
    
    if (!fs.existsSync(themeDescPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(themeDescPath, 'utf-8');
        let parsedContent;
        
        try {
            parsedContent = JSON.parse(content);
        } catch (error) {
            // Try removing comments
            const contentWithoutComments = removeCommentsFromJSON(content);
            parsedContent = JSON.parse(contentWithoutComments);
        }

        return parsedContent.DefaultLocalizationId || null;
    } catch (error) {
        console.error('Error reading theme_description.json:', error);
        return null;
    }
}

/**
 * Parse a localization file and return its content
 * @param {string} filePath 
 * @returns {Object|null}
 */
function parseLocalizationFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        try {
            return JSON.parse(content);
        } catch (error) {
            // Try removing comments
            const contentWithoutComments = removeCommentsFromJSON(content);
            return JSON.parse(contentWithoutComments);
        }
    } catch (error) {
        console.error(`Error parsing localization file ${filePath}:`, error);
        return null;
    }
}

/**
 * Get a localized string by key
 * @param {string} key 
 * @returns {string|null}
 */
function getLocalizedString(key) {
    const localizations = getLocalizations();
    
    if (!localizations || !localizations.Strings) {
        return null;
    }

    // Check if key exists in Strings
    if (localizations.Strings.hasOwnProperty(key)) {
        return String(localizations.Strings[key]);
    }

    // Try dot notation (e.g., "Category.SubKey")
    const parts = key.split('.');
    let current = localizations.Strings;
    
    for (const part of parts) {
        if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
            current = current[part];
        } else {
            return null;
        }
    }
    
    return current !== null && current !== undefined ? String(current) : null;
}

module.exports = {
    getLocalizations,
    getLocalizedString
};
