/**
 * System Control Server
 * Runs directly on host to control LocalSend and Vault
 * Port: 8125
 */

const http = require('http');
const { exec } = require('child_process');

const PORT = 8125;

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

    // LocalSend Status - check systemd service status
    if (req.method === 'GET' && req.url === '/api/localsend/status') {
        exec('systemctl is-active localsend-vault.service', (error, stdout) => {
            const running = !error && stdout.trim() === 'active';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ running, status: stdout.trim() }));
        });
    }
    // LocalSend Start - start systemd service
    else if (req.method === 'POST' && req.url === '/api/localsend/start') {
        exec('sudo systemctl start localsend-vault.service', (error, stdout, stderr) => {
            console.log(`[${new Date().toISOString()}] LocalSend service start requested`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: !error, error: stderr || null }));
        });
    }
    // LocalSend Stop - stop systemd service (prevents respawn)
    else if (req.method === 'POST' && req.url === '/api/localsend/stop') {
        exec('sudo systemctl stop localsend-vault.service', (error, stdout, stderr) => {
            console.log(`[${new Date().toISOString()}] LocalSend service stopped`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: !error, error: stderr || null }));
        });
    }
    // Vault Status
    else if (req.method === 'GET' && req.url === '/api/vault/status') {
        exec('mount | grep private_vault', (error, stdout) => {
            const mounted = !error && stdout.trim().length > 0;
            let mountPath = null;
            if (mounted) {
                const match = stdout.match(/on\s+(\S+)/);
                if (match) mountPath = match[1];
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ mounted, path: mountPath }));
        });
    }
    // Vault Mount
    else if (req.method === 'POST' && req.url === '/api/vault/mount') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { password } = JSON.parse(body);
                if (!password) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Password required' }));
                    return;
                }

                // File-based LUKS container on Seagate drive
                // Escape special bash characters: $ ` " \
                const escaped = password
                    .replace(/\\/g, '\\\\')
                    .replace(/\$/g, '\\$')
                    .replace(/`/g, '\\`')
                    .replace(/"/g, '\\"');
                const cmd = `echo "${escaped}" | sudo cryptsetup open /mnt/seagate/.private_vault.img private_vault 2>&1 && sudo mount /dev/mapper/private_vault /mnt/private_vault 2>&1`;

                exec(cmd, { shell: '/bin/bash' }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[${new Date().toISOString()}] Vault mount failed:`, stderr || error.message);
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Mount failed - check password' }));
                    } else {
                        console.log(`[${new Date().toISOString()}] Vault mounted`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, path: '/mnt/private_vault' }));
                    }
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
    }
    // Vault Unmount
    else if (req.method === 'POST' && req.url === '/api/vault/unmount') {
        exec('sudo umount /mnt/private_vault && sudo cryptsetup close private_vault', { shell: '/bin/bash' }, (error) => {
            if (error) {
                console.error(`[${new Date().toISOString()}] Vault unmount failed`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Unmount failed' }));
            } else {
                console.log(`[${new Date().toISOString()}] Vault unmounted`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            }
        });
    }
    // Health check
    else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    }
    else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`System Control Server running on port ${PORT}`);
});
