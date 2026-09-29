const fs = require('fs');

/**
 * Parser for C# class files
 */
class CSharpParser {
    constructor() {
        this.typeMapping = {
            'string': 'string',
            'int': 'number',
            'float': 'number',
            'double': 'number',
            'decimal': 'number',
            'bool': 'boolean',
            'DateTime': 'string',
            'Guid': 'string',
            'object': 'any'
        };
    }

    /**
     * Parse a C# file and extract class information
     */
    parseFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        return this.parseContent(content, filePath);
    }

    /**
     * Parse C# content string
     */
    parseContent(content, sourcePath = '') {
        // Remove comments
        const cleanContent = this.removeComments(content);

        // Extract namespace
        const namespace = this.extractNamespace(cleanContent);

        // Extract class information
        const classes = this.extractClasses(cleanContent, namespace, sourcePath);

        return classes;
    }

    /**
     * Remove single-line and multi-line comments
     */
    removeComments(content) {
        // Remove multi-line comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove single-line comments (but keep URLs)
        content = content.replace(/(?<!:)\/\/.*/g, '');
        return content;
    }

    /**
     * Extract namespace from content
     */
    extractNamespace(content) {
        const namespaceMatch = content.match(/namespace\s+([\w.]+)/);
        return namespaceMatch ? namespaceMatch[1] : '';
    }

    /**
     * Extract all classes from content
     */
    extractClasses(content, namespace, sourcePath) {
        const classes = [];
        
        // Match class, struct and record declarations - handle multiline format
        // Matches: public class ClassName : BaseClass, public readonly struct Name, public record Name
        // Then finds the opening brace and extracts everything until matching closing brace
        const classHeaderRegex = /public\s+(?:(?:sealed|abstract|static|partial|readonly)\s+)*(?:class|struct|record(?:\s+(?:class|struct))?)\s+(\w+)(?:\s*:\s*([\w\s,<>]+))?/g;
        
        let match;
        while ((match = classHeaderRegex.exec(content)) !== null) {
            const className = match[1];
            const inheritance = match[2] ? match[2].trim() : '';
            const classStartPos = match.index + match[0].length;
            
            // Find the class body between matching braces
            const classBody = this.extractClassBody(content, classStartPos);
            
            if (classBody) {
                const properties = this.extractProperties(classBody);
                
                classes.push({
                    className,
                    namespace,
                    inheritance: this.parseInheritance(inheritance),
                    properties,
                    sourcePath
                });
            }
        }

        return classes;
    }

    /**
     * Extract class body between matching braces
     */
    extractClassBody(content, startPos) {
        // Find opening brace
        let bracePos = content.indexOf('{', startPos);
        if (bracePos === -1) return null;

        let braceCount = 1;
        let currentPos = bracePos + 1;
        
        // Find matching closing brace
        while (currentPos < content.length && braceCount > 0) {
            if (content[currentPos] === '{') {
                braceCount++;
            } else if (content[currentPos] === '}') {
                braceCount--;
            }
            currentPos++;
        }

        if (braceCount === 0) {
            return content.substring(bracePos + 1, currentPos - 1);
        }

        return null;
    }

    /**
     * Parse inheritance/interface information
     */
    parseInheritance(inheritance) {
        if (!inheritance) return { base: null, interfaces: [] };

        const parts = inheritance.split(',').map(p => p.trim());
        
        // First part is usually base class (if doesn't start with I)
        const base = parts[0] && !parts[0].startsWith('I') ? parts[0] : null;
        const interfaces = parts.filter(p => p.startsWith('I'));

        return { base, interfaces };
    }

    /**
     * Extract properties from class body
     */
    extractProperties(classBody) {
        const properties = [];
        
        // Match property declarations:
        // 1. Regular properties: public Type Name { get; set; }
        // 2. Expression-bodied properties: public Type Name => expression;
        
        // Pattern 1: Regular properties with { get; set; }
        const propertyRegex = /public\s+(\??[\w<>,\s[\]?]+?)\s+(\w+)\s*\{[^}]*\}/g;
        
        let match;
        while ((match = propertyRegex.exec(classBody)) !== null) {
            const rawType = match[1].trim();
            const propertyName = match[2];

            // Skip methods (they have parentheses)
            if (propertyName.includes('(')) continue;

            const parsedType = this.parseType(rawType);
            
            properties.push({
                name: propertyName,
                type: parsedType.type,
                isNullable: parsedType.isNullable,
                isCollection: parsedType.isCollection,
                isComplex: parsedType.isComplex,
                rawType: rawType
            });
        }

        // Pattern 2: Expression-bodied properties (public Type Name => expression;)
        const expressionPropertyRegex = /public\s+(\??[\w<>,\s[\]?]+?)\s+(\w+)\s*=>/g;
        
        while ((match = expressionPropertyRegex.exec(classBody)) !== null) {
            const rawType = match[1].trim();
            const propertyName = match[2];

            // Skip methods (they have parentheses)
            if (propertyName.includes('(')) continue;
            
            // Skip if already added (regex overlap protection)
            if (properties.some(p => p.name === propertyName)) continue;

            const parsedType = this.parseType(rawType);
            
            properties.push({
                name: propertyName,
                type: parsedType.type,
                isNullable: parsedType.isNullable,
                isCollection: parsedType.isCollection,
                isComplex: parsedType.isComplex,
                rawType: rawType
            });
        }

        return properties;
    }

    /**
     * Parse C# type to simplified type information
     */
    parseType(rawType) {
        let type = rawType.trim();
        let isNullable = false;
        let isCollection = false;
        let isComplex = false;

        // Check for nullable (Type?)
        if (type.endsWith('?') && !type.includes('<')) {
            isNullable = true;
            type = type.slice(0, -1);
        }

        // Check for collections (ICollection<T>, List<T>, IEnumerable<T>, etc.)
        const collectionMatch = type.match(/^(?:ICollection|IEnumerable|List|IList|HashSet|ISet)<(.+)>$/);
        if (collectionMatch) {
            isCollection = true;
            type = collectionMatch[1].trim();
        }

        // Check for arrays (Type[])
        if (type.endsWith('[]')) {
            isCollection = true;
            type = type.slice(0, -2);
        }

        // Map to simple type or mark as complex
        if (this.typeMapping[type]) {
            type = this.typeMapping[type];
        } else {
            isComplex = true;
            // Keep the original type name for complex types
        }

        return {
            type,
            isNullable,
            isCollection,
            isComplex
        };
    }

    /**
     * Parse multiple files
     */
    parseFiles(filePaths) {
        const allClasses = [];

        for (const filePath of filePaths) {
            try {
                const classes = this.parseFile(filePath);
                allClasses.push(...classes);
            } catch (error) {
                console.error(`❌ Failed to parse ${filePath}: ${error.message}`);
            }
        }

        return allClasses;
    }

    /**
     * Build inheritance tree
     */
    buildInheritanceTree(classes) {
        const classMap = new Map();
        
        // Index all classes
        for (const cls of classes) {
            classMap.set(cls.className, cls);
        }

        // Resolve inheritance
        for (const cls of classes) {
            if (cls.inheritance.base && classMap.has(cls.inheritance.base)) {
                const baseClass = classMap.get(cls.inheritance.base);
                cls.inheritedProperties = this.getAllInheritedProperties(baseClass, classMap);
            } else {
                cls.inheritedProperties = [];
            }
        }

        return classes;
    }

    /**
     * Get all inherited properties recursively
     */
    getAllInheritedProperties(cls, classMap) {
        let properties = [...cls.properties];

        if (cls.inheritance.base && classMap.has(cls.inheritance.base)) {
            const baseClass = classMap.get(cls.inheritance.base);
            properties = [...this.getAllInheritedProperties(baseClass, classMap), ...properties];
        }

        return properties;
    }
}

module.exports = { CSharpParser };
