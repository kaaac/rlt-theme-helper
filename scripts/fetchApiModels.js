const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Fetches C# files from GitHub repository
 */
class GitHubFetcher {
    constructor(owner, repo, branch = 'main') {
        this.owner = owner;
        this.repo = repo;
        this.branch = branch;
        this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
    }

    /**
     * Fetch JSON data from GitHub API
     */
    async fetchJson(url) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: {
                    'User-Agent': 'RLT-Theme-Helper-Generator',
                    'Accept': 'application/vnd.github.v3+json'
                }
            };

            https.get(url, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Fetch raw file content from GitHub
     */
    async fetchRawFile(filePath) {
        const url = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${filePath}`;
        
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`Failed to fetch ${filePath}: status ${res.statusCode}`));
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * List all files in a directory recursively
     */
    async listFilesRecursive(dirPath = '') {
        const url = `${this.baseUrl}/contents/${dirPath}?ref=${this.branch}`;
        const contents = await this.fetchJson(url);
        
        let files = [];

        for (const item of contents) {
            if (item.type === 'file' && item.name.endsWith('.cs')) {
                files.push({
                    path: item.path,
                    name: item.name,
                    size: item.size
                });
            } else if (item.type === 'dir') {
                // Recursively fetch files from subdirectories
                const subFiles = await this.listFilesRecursive(item.path);
                files = files.concat(subFiles);
            }
        }

        return files;
    }

    /**
     * Download all C# files from specified directories
     */
    async downloadCSharpFiles(directories, outputDir) {
        console.log(`📥 Fetching C# files from ${this.owner}/${this.repo}...`);
        
        const allFiles = [];

        for (const dir of directories) {
            console.log(`  📂 Scanning directory: ${dir}`);
            try {
                const files = await this.listFilesRecursive(dir);
                console.log(`     Found ${files.length} C# files`);
                allFiles.push(...files);
            } catch (error) {
                console.warn(`     ⚠️  Could not access directory ${dir}: ${error.message}`);
            }
        }

        console.log(`\n📦 Total files to download: ${allFiles.length}`);
        
        // Create output directory structure
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const downloadedFiles = [];

        for (const file of allFiles) {
            try {
                console.log(`  ⬇️  Downloading: ${file.path}`);
                const content = await this.fetchRawFile(file.path);
                
                // Create subdirectory structure
                const outputPath = path.join(outputDir, file.path);
                const outputDirPath = path.dirname(outputPath);
                
                if (!fs.existsSync(outputDirPath)) {
                    fs.mkdirSync(outputDirPath, { recursive: true });
                }

                // Save file
                fs.writeFileSync(outputPath, content, 'utf8');
                
                downloadedFiles.push({
                    path: file.path,
                    name: file.name,
                    outputPath: outputPath
                });

                // Rate limiting - be nice to GitHub API
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`     ❌ Failed to download ${file.path}: ${error.message}`);
            }
        }

        console.log(`\n✅ Downloaded ${downloadedFiles.length} files to ${outputDir}`);
        return downloadedFiles;
    }
}

module.exports = { GitHubFetcher };
