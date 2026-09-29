const path = require('path');
const fs = require('fs');
const { GitHubFetcher } = require('./fetchApiModels');
const { CSharpParser } = require('./parseCSharpClasses');
const { SchemaGenerator } = require('./generateModelSchemas');

/**
 * Configuration
 */
const CONFIG = {
    github: {
        owner: 'vlad-men',
        repo: 'RacingLeagueTools_RendererAPI',
        branch: '8a24c30df370295b7a8e3ff2a63c011db6aefe03', // specific commit
        directories: [
            'Base',
            'Championship',
            'DeepRatingsSeason',
            'DriverStatisticsMultiseason',
            'Enums',
            'League',
            'PenaltySystem',
            'Season',
            'Session',
            'Standings',
            'Statistics',
            'TeamStandingsMultiseason',
            'Teammates',
            'TrackStatisticsMultiseason'
        ]
    },
    output: {
        tempDir: path.join(__dirname, '..', '.temp', 'downloaded_cs'),
        modelsDir: path.join(__dirname, '..', 'api_models')
    }
};

/**
 * Main generator function
 */
async function generateModels() {
    console.log('🚀 RLT API Models Generator');
    console.log('================================\n');

    try {
        // Step 1: Fetch C# files from GitHub
        console.log('Step 1: Fetching C# files from GitHub...');
        const fetcher = new GitHubFetcher(
            CONFIG.github.owner,
            CONFIG.github.repo,
            CONFIG.github.branch
        );

        const downloadedFiles = await fetcher.downloadCSharpFiles(
            CONFIG.github.directories,
            CONFIG.output.tempDir
        );

        if (downloadedFiles.length === 0) {
            console.error('❌ No files downloaded. Exiting.');
            process.exit(1);
        }

        // Step 2: Parse C# files
        console.log('\nStep 2: Parsing C# classes...');
        const parser = new CSharpParser();
        const filePaths = downloadedFiles.map(f => f.outputPath);
        let classes = parser.parseFiles(filePaths);
        
        console.log(`✅ Parsed ${classes.length} classes`);

        // Step 3: Build inheritance tree
        console.log('\nStep 3: Building inheritance tree...');
        classes = parser.buildInheritanceTree(classes);
        console.log('✅ Inheritance resolved');

        // Step 4: Generate schemas
        console.log('\nStep 4: Generating schemas...');
        const generator = new SchemaGenerator(CONFIG.output.modelsDir);
        generator.generate(classes);
        generator.generateAutocompleteSuggestions(classes);

        // Step 5: Cleanup temp directory (optional)
        console.log('\nStep 5: Cleaning up...');
        if (fs.existsSync(CONFIG.output.tempDir)) {
            fs.rmSync(CONFIG.output.tempDir, { recursive: true, force: true });
            console.log('✅ Temporary files removed');
        }

        console.log('\n✨ Generation complete!');
        console.log(`📁 Output directory: ${CONFIG.output.modelsDir}`);
        console.log('\nGenerated files:');
        console.log('  - mapping.json       (ItemsSource mappings)');
        console.log('  - index.json         (Class index)');
        console.log('  - autocomplete.json  (Autocomplete data)');
        console.log(`  - ${classes.length} class schema files`);

    } catch (error) {
        console.error('\n❌ Error during generation:');
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

/**
 * Show usage information
 */
function showUsage() {
    console.log('Usage: node generate.js');
    console.log('\nThis script will:');
    console.log('  1. Download C# model files from GitHub');
    console.log('  2. Parse class definitions and properties');
    console.log('  3. Generate JSON schemas for autocomplete');
    console.log('  4. Create mapping files for ItemsSource resolution');
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showUsage();
        process.exit(0);
    }

    generateModels();
}

module.exports = { generateModels, CONFIG };
