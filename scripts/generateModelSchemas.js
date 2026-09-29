const fs = require('fs');
const path = require('path');

/**
 * Generator for model schemas and mappings
 */
class SchemaGenerator {
    constructor(outputDir) {
        this.outputDir = outputDir;
        this.mapping = {};
        this.classIndex = {};
    }

    /**
     * Generate all schemas from parsed classes
     */
    generate(classes) {
        console.log(`\n📝 Generating schemas for ${classes.length} classes...`);

        // Ensure output directory exists
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        // Remove models of classes that no longer exist in the API
        const generated = new Set(classes.map(cls => `${cls.className}.json`));
        for (const file of fs.readdirSync(this.outputDir)) {
            if (file.endsWith('.json') && !generated.has(file) && !['mapping.json', 'index.json', 'autocomplete.json'].includes(file)) {
                fs.unlinkSync(path.join(this.outputDir, file));
                console.log(`  🗑 removed ${file}`);
            }
        }

        // Generate schema for each class
        for (const cls of classes) {
            this.generateClassSchema(cls);
        }

        // Generate mapping.json
        this.generateMapping(classes);

        // Generate index.json
        this.generateIndex(classes);

        console.log(`✅ Generated ${Object.keys(this.classIndex).length} class schemas`);
    }

    /**
     * Generate schema for a single class
     */
    generateClassSchema(cls) {
        const schema = {
            className: cls.className,
            namespace: cls.namespace,
            // sourcePath removed - use GitHub repo as source of truth
            inheritance: cls.inheritance,
            properties: cls.properties.map(prop => ({
                name: prop.name,
                type: prop.type,
                isNullable: prop.isNullable,
                isCollection: prop.isCollection,
                isComplex: prop.isComplex,
                description: this.generatePropertyDescription(prop)
            }))
        };

        // Include inherited properties if available
        if (cls.inheritedProperties && cls.inheritedProperties.length > 0) {
            schema.inheritedProperties = cls.inheritedProperties.map(prop => ({
                name: prop.name,
                type: prop.type,
                isNullable: prop.isNullable,
                isCollection: prop.isCollection,
                isComplex: prop.isComplex
            }));
        }

        // Save to file
        const fileName = `${cls.className}.json`;
        const filePath = path.join(this.outputDir, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');
        
        // Add to index
        this.classIndex[cls.className] = {
            file: fileName,
            namespace: cls.namespace,
            propertyCount: cls.properties.length
        };

        console.log(`  ✓ ${cls.className}`);
    }

    /**
     * Generate property description based on type and name
     */
    generatePropertyDescription(prop) {
        const name = prop.name;
        
        // Common patterns
        if (name.includes('Time') && prop.type === 'string') {
            return 'Time value as formatted string';
        }
        if (name.includes('TimeMs') && prop.type === 'number') {
            return 'Time value in milliseconds';
        }
        if (name.startsWith('Is') && prop.type === 'boolean') {
            return `Indicates whether ${this.camelCaseToWords(name.substring(2))}`;
        }
        if (name.includes('Count') && prop.type === 'number') {
            return `Number of ${this.camelCaseToWords(name.replace('Count', ''))}`;
        }
        if (name.includes('Position') && prop.type === 'number') {
            return 'Position value';
        }
        if (name.includes('Position') && prop.type === 'string') {
            return 'Position as formatted string';
        }

        return `${prop.name} property`;
    }

    /**
     * Convert camelCase to words
     */
    camelCaseToWords(str) {
        return str.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    }

    /**
     * Generate mapping.json for ItemsSource -> Class mappings
     */
    generateMapping(classes) {
        // Predefined mappings based on common patterns
        const knownMappings = {
            // ItemsSource mappings
            'Session.Drivers': 'DriverSessionRenderData',
            'Session.Teams': 'TeamRenderData',
            'Standings.Drivers': 'DriverSeasonRenderData', // Standings = Season standings
            'Standings.Teams': 'TeamSeasonRenderData',     // Standings = Season standings
            'Season.Drivers': 'DriverSeasonRenderData',
            'Season.Teams': 'TeamSeasonRenderData',
            'Championship.Drivers': 'DriverRenderData',
            'Championship.Teams': 'TeamRenderData',
            'Driver.Features': 'DriverFeatureInfo',
            'Driver.LeagueRoles': 'LeagueRoleRenderData',
            'Team.Drivers': 'DriverRenderObject',
            'Driver.Stints': 'TyreStintInfo',
            'Item.Stints': 'TyreStintInfo',
            'Item.Laps': 'LapInfo',
            'Item.LapDetails': 'LapInfo',
            'Item.DriverFeatures': 'DriverFeatureInfo',
            'Item.LeagueRoles': 'LeagueRoleRenderData',
            'League.Categories': 'LeagueCategoryRenderData',
            'League.Roles': 'LeagueRoleRenderData',
            'Season.Events': 'EventRenderData',
            'Season.Lineups': 'LineupRenderData',
            
            // Root objects mappings (for direct access like {Session.Name})
            'Session': 'SessionRenderData',
            'Event': 'EventRenderData',
            'Season': 'SeasonRenderData',
            'Standings': 'StandingsSeasonRenderData',
            'Events': 'EventsSeasonRenderData',
            'Lineups': 'LineupsSeasonRenderData',
            'Statistics': 'StatisticsRenderHost',
            'DriverInfo': 'DriverRenderHost', // Universal driver info host (Championship)
            'Penalty': 'PenaltyItemRenderData',
            'Penalties': 'EventPenaltiesRenderHost', // can also be SeasonPenaltiesRenderHost
            'LayoutInfo': 'LayoutInfo',
            'DeepRatings': 'DeepRatingsSeasonRenderData',
            'Teammates': 'TeammatesSeasonRenderData',
            'TeamStandingsMultiseason': 'TeamStandingsMultiseasonRenderData',
            'TeamStatistics': 'TeamStatisticsMultiseasonRenderData',
            'TeamsStatistics': 'TeamsStatisticsMultiseasonRenderData',
            'DriverStatistics': 'DriverStatisticsMultiseasonRenderData',
            'DriversStatistics': 'DriversStatisticsMultiseasonRenderData',
            'TrackStatistics': 'TrackStatisticsMultiseasonRenderData',
            'TracksStatistics': 'TracksStatisticsMultiseasonRenderData'
        };

        // Try to auto-detect more mappings based on class names
        for (const cls of classes) {
            // Pattern: DriverSessionRenderData -> Session.Drivers
            if (cls.className.includes('SessionRenderData')) {
                const prefix = cls.className.replace('SessionRenderData', '');
                if (prefix) {
                    // Don't add 's' if prefix already ends with 's'
                    const plural = prefix.endsWith('s') ? prefix : `${prefix}s`;
                    knownMappings[`Session.${plural}`] = cls.className;
                }
            }
            // Pattern: DriverEventRenderData -> Event.Drivers (Standings)
            if (cls.className.includes('EventRenderData')) {
                const prefix = cls.className.replace('EventRenderData', '');
                if (prefix && prefix !== 'Event') {
                    // Don't add 's' if prefix already ends with 's'
                    const plural = prefix.endsWith('s') ? prefix : `${prefix}s`;
                    knownMappings[`Event.${plural}`] = cls.className;
                }
            }
            // Pattern: DriverSeasonRenderData -> Season.Drivers
            if (cls.className.includes('SeasonRenderData')) {
                const prefix = cls.className.replace('SeasonRenderData', '');
                if (prefix && prefix !== 'Season' && prefix !== 'Events' && prefix !== 'Lineups') {
                    // Don't add 's' if prefix already ends with 's'
                    const plural = prefix.endsWith('s') ? prefix : `${prefix}s`;
                    knownMappings[`Season.${plural}`] = cls.className;
                }
            }
        }

        this.mapping = knownMappings;

        const mappingPath = path.join(this.outputDir, 'mapping.json');
        fs.writeFileSync(mappingPath, JSON.stringify(this.mapping, null, 2), 'utf8');
        
        console.log(`  ✓ mapping.json (${Object.keys(this.mapping).length} mappings)`);
    }

    /**
     * Generate index.json with all classes
     */
    generateIndex(classes) {
        const index = {
            generated: new Date().toISOString(),
            totalClasses: classes.length,
            classes: this.classIndex,
            namespaces: this.groupByNamespace(classes)
        };

        const indexPath = path.join(this.outputDir, 'index.json');
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
        
        console.log(`  ✓ index.json`);
    }

    /**
     * Group classes by namespace
     */
    groupByNamespace(classes) {
        const grouped = {};

        for (const cls of classes) {
            if (!grouped[cls.namespace]) {
                grouped[cls.namespace] = [];
            }
            grouped[cls.namespace].push(cls.className);
        }

        return grouped;
    }

    /**
     * Generate autocomplete suggestions file
     */
    generateAutocompleteSuggestions(classes) {
        const suggestions = {};

        for (const [source, className] of Object.entries(this.mapping)) {
            const cls = classes.find(c => c.className === className);
            if (cls) {
                suggestions[source] = {
                    className: className,
                    properties: cls.properties.map(prop => ({
                        name: prop.name,
                        type: prop.type,
                        isCollection: prop.isCollection,
                        isComplex: prop.isComplex
                    }))
                };
            }
        }

        const suggestionsPath = path.join(this.outputDir, 'autocomplete.json');
        fs.writeFileSync(suggestionsPath, JSON.stringify(suggestions, null, 2), 'utf8');
        
        console.log(`  ✓ autocomplete.json`);
    }
}

module.exports = { SchemaGenerator };
