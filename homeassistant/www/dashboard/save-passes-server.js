/**
 * Simple HTTP server to save guest passes
 * Run with: node save-passes-server.js
 * Listens on port 8124
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8124;
const PASSES_FILE = path.join(__dirname, 'data', 'passes.json');

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/save') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                // Validate JSON
                JSON.parse(body);

                // Write to file
                fs.writeFileSync(PASSES_FILE, body);
                console.log(`[${new Date().toISOString()}] Saved passes to file`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                console.error('Error saving:', e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else if (req.method === 'GET' && req.url === '/load') {
        try {
            const data = fs.readFileSync(PASSES_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ version: 1, passes: [], activity: [], lastModified: null }));
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Guest Pass save server running on port ${PORT}`);
});
