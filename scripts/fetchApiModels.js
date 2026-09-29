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
            // Optional token raises the API rate limit
            const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
            if (token) {
                options.headers.Authorization = `Bearer ${token}`;
            }

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
     * List all C# files of the repository at the ref, with a single API request
     */
    async listCSharpFiles() {
        const tree = await this.fetchJson(`${this.baseUrl}/git/trees/${this.branch}?recursive=1`);
        if (tree.truncated) {
            throw new Error('Repository tree listing was truncated by GitHub');
        }
        return tree.tree
            .filter(item => item.type === 'blob' && item.path.endsWith('.cs'))
            .map(item => ({ path: item.path, name: path.posix.basename(item.path), size: item.size }));
    }

    /**
     * Download all C# files from specified directories.
     * Throws when a directory is missing or a file can't be downloaded, so a partial download never produces models.
     */
    async downloadCSharpFiles(directories, outputDir) {
        console.log(`📥 Fetching C# files from ${this.owner}/${this.repo}@${this.branch}...`);

        const repositoryFiles = await this.listCSharpFiles();
        const allFiles = [];

        for (const dir of directories) {
            const files = repositoryFiles.filter(file => file.path.startsWith(`${dir}/`));
            if (files.length === 0) {
                throw new Error(`Directory ${dir} not found or has no C# files`);
            }
            console.log(`  📂 ${dir}: ${files.length} C# files`);
            allFiles.push(...files);
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

                // Rate limiting - be nice to GitHub
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                throw new Error(`Failed to download ${file.path}: ${error.message}`);
            }
        }

        console.log(`\n✅ Downloaded ${downloadedFiles.length} files to ${outputDir}`);
        return downloadedFiles;
    }
}

module.exports = { GitHubFetcher };
