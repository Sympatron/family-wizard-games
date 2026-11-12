import {readFile, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';

const arg = name => {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1];
};
const site = resolve(arg('--site') ?? 'site/preview');
const prsPath = resolve(arg('--prs') ?? 'open-prs.jsonl');
const repository = arg('--repository') ?? process.env.GITHUB_REPOSITORY ?? '';
if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) throw new Error('Invalid repository');
const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const readOptionalJson = async path => readJson(path).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
});
const prs = (await readFile(prsPath, 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).sort((a, b) => b.number - a.number);
const devGames = await readJson(join(site, 'games.json'));
function gameCards(games, prefix) {
    if (!games.length) return '<p>Keine Spiele vorhanden.</p>';
    return '<div class="game-grid">' + games.map(game =>
        '<a class="game-card" href="' + prefix + 'games/' + encodeURIComponent(game.id) + '/">' +
        '<span class="game-icon">' + escapeHtml(game.icon) + '</span><strong>' + escapeHtml(game.title) + '</strong>' +
        '<small>' + escapeHtml(game.description) + '</small></a>'
    ).join('') + '</div>';
}
const cards = await Promise.all(prs.map(async pr => {
    if (!Number.isSafeInteger(pr.number) || pr.number <= 0 || typeof pr.title !== 'string') throw new Error('Invalid PR metadata');
    const number = pr.number;
    const games = pr.sameRepository ? await readOptionalJson(join(site, 'pr-' + number, 'games.json')) : null;
    const explanation = !pr.sameRepository ? 'Fork-PR: keine gehostete Vorschau.' : 'Vorschau nicht verfügbar (Build fehlgeschlagen).';
    return '<section class="preview-pr"><h3>PR #' + number + ': ' + escapeHtml(pr.title) + '</h3>' +
        '<p><a href="https://github.com/' + repository + '/pull/' + number + '">Pull Request auf GitHub ansehen</a></p>' +
        (games ? gameCards(games, './pr-' + number + '/') : '<p>' + explanation + '</p>') + '</section>';
}));
const html = [
    '<!doctype html>',
    '<html lang="de">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width,initial-scale=1">',
    '  <meta name="color-scheme" content="dark">',
    '  <title>Family Wizard – Vorschau</title>',
    '  <link rel="stylesheet" href="./styles.css">',
    '  <style>.preview-pr{padding:20px 0;border-top:1px solid #374151}.preview-pr h3{margin:0;font-size:1.25rem;overflow-wrap:anywhere}.preview-pr .game-card{min-height:140px}.preview-section{margin-top:32px}</style>',
    '  <script type="module">',
    '    import {watchDeployment} from "./shared/deploy-watch.js";',
    '    watchDeployment();',
    '  </script>',
    '</head>',
    '<body>',
    '  <main class="container">',
    '    <header class="hero">',
    '      <div class="eyebrow">Family Wizard · Entwicklung</div>',
    '      <h1>Vorschau</h1>',
    '      <p>Alle offenen Pull Requests und ihre Spiele-Vorschauen. Die Spielstände sind simuliert und je Vorschau getrennt.</p>',
    '    </header>',
    '    <section class="preview-section">',
    '      <h2>Offene Pull Requests (' + prs.length + ')</h2>',
    cards.join('') || '      <p>Momentan sind keine Pull Requests offen.</p>',
    '    </section>',
    '    <section class="preview-section">',
    '      <h2>Entwicklungsstand (dev)</h2>',
    gameCards(devGames, './'),
    '    </section>',
    '    <footer><a href="../">Zur stabilen Version</a> · Keine echten Family-Wizard-Konten oder Münzen</footer>',
    '  </main>',
    '</body>',
    '</html>'
].join('\n') + '\n';
await writeFile(join(site, 'index.html'), html);
console.log('Generated preview launcher for ' + prs.length + ' open PR(s).');
