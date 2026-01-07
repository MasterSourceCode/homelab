#!/usr/bin/env node

/**
 * Dashboard Build Script
 *
 * Compiles modular components into a single production-ready mobile.html
 *
 * Features:
 * - CSS aggregation and minification
 * - JavaScript bundling
 * - HTML template compilation
 * - Cache-busting version injection
 * - Source maps (optional)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const SRC_DIR = path.resolve(__dirname, '../');
const OUTPUT_DIR = ROOT_DIR;

// Configuration
const CONFIG = {
    outputFile: 'mobile.html',
    minify: process.env.NODE_ENV === 'production',
    sourceMaps: process.env.NODE_ENV !== 'production',
    version: generateVersion()
};

/**
 * Generate version string: YYYY.MM.DD.N
 */
function generateVersion() {
    const now = new Date();
    const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

    // Check for existing version to increment build number
    const versionFile = path.join(ROOT_DIR, 'version.json');
    let buildNum = 1;

    if (fs.existsSync(versionFile)) {
        try {
            const existing = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
            if (existing.version && existing.version.startsWith(date)) {
                const parts = existing.version.split('.');
                buildNum = parseInt(parts[3] || '0') + 1;
            }
        } catch (e) {
            console.warn('Could not read version file:', e.message);
        }
    }

    return `${date}.${buildNum}`;
}

/**
 * Read all CSS files and combine them
 */
function aggregateCSS() {
    const cssFiles = [
        'styles/base/variables.css',
        'styles/base/reset.css',
        'styles/base/animations.css'
    ];

    let css = '';

    // Read base CSS files
    cssFiles.forEach(file => {
        const filePath = path.join(SRC_DIR, file);
        if (fs.existsSync(filePath)) {
            css += `/* ${file} */\n`;
            css += fs.readFileSync(filePath, 'utf8');
            css += '\n\n';
        }
    });

    // Read component CSS from atoms, molecules, organisms
    const componentDirs = ['atoms', 'molecules', 'organisms'];
    componentDirs.forEach(dir => {
        const dirPath = path.join(SRC_DIR, dir);
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                if (file.endsWith('.css')) {
                    css += `/* ${dir}/${file} */\n`;
                    css += fs.readFileSync(path.join(dirPath, file), 'utf8');
                    css += '\n\n';
                }
            });
        }
    });

    return css;
}

/**
 * Simple CSS minification
 */
function minifyCSS(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove comments
        .replace(/\s+/g, ' ')               // Collapse whitespace
        .replace(/\s*([{}:;,])\s*/g, '$1')  // Remove space around syntax
        .replace(/;}/g, '}')                // Remove last semicolon
        .trim();
}

/**
 * Read all component JS and generate import map
 */
function generateJSImports() {
    const imports = [];

    const componentDirs = ['atoms', 'molecules', 'organisms'];
    componentDirs.forEach(dir => {
        const dirPath = path.join(SRC_DIR, dir);
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(file => {
                if (file.endsWith('.js')) {
                    imports.push(`./src/${dir}/${file}`);
                }
            });
        }
    });

    return imports;
}

/**
 * Generate the HTML head section
 */
function generateHead(version) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#0a0a0f">
    <meta name="apple-mobile-web-app-title" content="Home">
    <title>Home</title>

    <!-- Cache Control -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">

    <!-- Preconnect for fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- Apple Touch Icons -->
    <link rel="apple-touch-icon" href="/local/dashboard/images/icon-180.png">
    <link rel="apple-touch-icon" sizes="152x152" href="/local/dashboard/images/icon-152.png">
    <link rel="apple-touch-icon" sizes="167x167" href="/local/dashboard/images/icon-167.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/local/dashboard/images/icon-180.png">

    <!-- Android/PWA -->
    <link rel="manifest" href="/local/dashboard/manifest.json">
    <link rel="icon" type="image/png" sizes="192x192" href="/local/dashboard/images/icon-192.png">
`;
}

/**
 * Generate version check script
 */
function generateVersionScript(version) {
    return `
    <!-- Version Check & Auto-Refresh -->
    <script>
    (function() {
        const CURRENT_VERSION = '${version}';
        const VERSION_CHECK_INTERVAL = 60000;
        const VERSION_URL = '/local/dashboard/version.json';

        async function checkVersion() {
            try {
                const response = await fetch(VERSION_URL + '?t=' + Date.now(), {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (!response.ok) return;

                const data = await response.json();
                if (data.version && data.version !== CURRENT_VERSION) {
                    console.log('[Version] Update detected:', CURRENT_VERSION, '->', data.version);
                    if ('caches' in window) {
                        const keys = await caches.keys();
                        await Promise.all(keys.map(key => caches.delete(key)));
                    }
                    window.location.reload(true);
                }
            } catch (e) {
                console.warn('[Version] Check failed:', e.message);
            }
        }

        setTimeout(checkVersion, 3000);
        setInterval(checkVersion, VERSION_CHECK_INTERVAL);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkVersion();
        });

        localStorage.setItem('dashboard_version', CURRENT_VERSION);
    })();
    </script>
`;
}

/**
 * Build the complete HTML file
 */
function build() {
    console.log('🔨 Building dashboard...');
    console.log(`   Version: ${CONFIG.version}`);
    console.log(`   Output: ${CONFIG.outputFile}`);
    console.log(`   Minify: ${CONFIG.minify}`);

    // Aggregate CSS
    console.log('\n📦 Aggregating CSS...');
    let css = aggregateCSS();
    if (CONFIG.minify) {
        css = minifyCSS(css);
    }
    console.log(`   CSS size: ${(css.length / 1024).toFixed(1)}KB`);

    // Read existing mobile.html for HTML structure
    const existingPath = path.join(ROOT_DIR, 'mobile.html');
    let existingHtml = '';
    if (fs.existsSync(existingPath)) {
        existingHtml = fs.readFileSync(existingPath, 'utf8');
    }

    // Extract body content from existing file (preserve HTML structure)
    const bodyMatch = existingHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '<div id="app"></div>';

    // Remove old style tag and script from body content
    let cleanBody = bodyContent
        .replace(/<script>[\s\S]*?CURRENT_VERSION[\s\S]*?<\/script>/g, '')
        .replace(/<script type="module"[^>]*><\/script>/g, '');

    // Build final HTML
    let html = generateHead(CONFIG.version);
    html += `    <style>\n${css}\n    </style>\n`;
    html += `</head>\n<body class="bg-dark-900 text-white font-sans">\n`;
    html += cleanBody;
    html += generateVersionScript(CONFIG.version);
    html += `\n    <!-- Main Application Script -->\n`;
    html += `    <script type="module" src="js/main-mobile.js?v=${CONFIG.version}"></script>\n`;
    html += `</body>\n</html>\n`;

    // Write output
    const outputPath = path.join(OUTPUT_DIR, CONFIG.outputFile);
    fs.writeFileSync(outputPath, html);
    console.log(`\n✅ Built ${outputPath}`);
    console.log(`   Size: ${(html.length / 1024).toFixed(1)}KB`);

    // Update version.json
    const versionData = {
        version: CONFIG.version,
        built: new Date().toISOString(),
        files: {
            html: CONFIG.outputFile,
            js: 'js/main-mobile.js'
        }
    };
    fs.writeFileSync(
        path.join(ROOT_DIR, 'version.json'),
        JSON.stringify(versionData, null, 2)
    );
    console.log(`   Updated version.json`);

    return CONFIG.version;
}

// Run build
try {
    build();
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}
