import {watch, createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, join, sep, extname} from 'node:path';
import {spawn} from 'node:child_process';

const root = resolve('.');
const site = join(root, 'dist');
const port = Number(process.env.PORT ?? 4173);
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp'};
let building = false;
let dirty = false;
async function build() {
    if (building) { dirty = true; return; }
    building = true;
    do {
        dirty = false;
        await new Promise((done, reject) => {
            const proc = spawn(process.execPath, ['scripts/build.mjs', '--revision', `dev-${Date.now()}`], {cwd: root, stdio: 'inherit'});
            proc.on('error', reject);
            proc.on('exit', code => code === 0 ? done() : reject(new Error(`Build exited ${code}`)));
        });
    } while (dirty);
    building = false;
}
await build();
const server = createServer(async (request, response) => {
    try {
        const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        const file = resolve(site, '.' + path, path.endsWith('/') ? 'index.html' : '');
        if (file !== site && !file.startsWith(site + sep)) { response.writeHead(403).end(); return; }
        const info = await stat(file);
        if (!info.isFile()) { response.writeHead(404).end(); return; }
        response.writeHead(200, {'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store'});
        createReadStream(file).pipe(response);
    } catch { response.writeHead(404).end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Development server: http://localhost:${port}/`));
let debounce;
for (const name of ['shared', 'games']) watch(join(root, name), {recursive: true}, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void build().catch(console.error), 150);
});
for (const name of ['index.html', 'launcher.js', 'styles.css']) watch(join(root, name), () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void build().catch(console.error), 150);
});
