import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, join, sep} from 'node:path';

const arg = name => {
    const i = process.argv.indexOf(name);
    return i < 0 ? null : process.argv[i + 1];
};
const source = resolve(arg('--source') ?? '.');
const out = resolve(arg('--out') ?? 'dist');
const revision = arg('--revision') ?? `local-${Date.now()}`;
if (out === source || source.startsWith(out + sep)) throw new Error('Output must not contain the source tree.');

await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});
for (const name of ['index.html', 'launcher.js', 'styles.css']) await cp(join(source, name), join(out, name));
await cp(join(source, 'shared'), join(out, 'shared'), {recursive: true});
await mkdir(join(out, 'games'), {recursive: true});

const games = [];
const dirs = await readdir(join(source, 'games'), {withFileTypes: true});
for (const dir of dirs.filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dirPath = join(source, 'games', dir.name);
    if (!existsSync(join(dirPath, 'game.json'))) throw new Error(`Missing game.json in games/${dir.name}`);
    const game = JSON.parse(await readFile(join(dirPath, 'game.json'), 'utf8'));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dir.name) || game.id !== dir.name) throw new Error(`Invalid game ID: ${dir.name}`);
    if (typeof game.title !== 'string' || !game.title.trim() || typeof game.description !== 'string') throw new Error(`Invalid manifest: ${dir.name}`);
    if (!existsSync(join(dirPath, 'index.html'))) throw new Error(`Missing index.html in games/${dir.name}`);
    await cp(dirPath, join(out, 'games', dir.name), {recursive: true});
    games.push({id: dir.name, title: game.title, description: game.description, icon: typeof game.icon === 'string' ? game.icon : '◈'});
}
await writeFile(join(out, 'games.json'), JSON.stringify(games));
await writeFile(join(out, 'version.json'), JSON.stringify({revision}));
await writeFile(join(out, '.nojekyll'), '');
console.log(`Built ${games.length} game(s) at ${out} (revision ${revision}).`);
