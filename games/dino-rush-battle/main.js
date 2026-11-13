import {createGameBackend} from '../../shared/backend.js';
import {mountDevtools} from '../../shared/devtools.js';
import {watchDeployment} from '../../shared/deploy-watch.js';
import {INITIAL_GAME, SPECIES, getEnemies, maxHp, migrateGame, reduceGame, unitPower} from './core/game.js';
import {resolveFormationDrop} from './core/drops.js';
import {isHitSoundEnabled, setHitSoundEnabled} from './core/hit-sound.js';
import {simulateBattle} from './core/battle.js';
import {BattleView} from './battle/view.js';
import {createEvolutionChoiceButton} from './battle/evolution-choice.js';

const backend = createGameBackend({gameId: 'dino-rush-battle', initialGame: INITIAL_GAME, reducer: reduceGame});
const stage = document.querySelector('.dino-stage');
const host = document.querySelector('#game-view');
const heading = document.querySelector('#heading');
const hud = document.querySelector('#hud');
const actions = document.querySelector('#actions');
const stats = document.querySelector('#stats');
const message = document.querySelector('#message');
const help = document.querySelector('#help');
const soundToggle = document.querySelector('#sound-toggle');
const pauseToggle = document.querySelector('#pause-toggle');
function renderSoundToggle() {
    const enabled = isHitSoundEnabled();
    if (!soundToggle) return;
    soundToggle.textContent = enabled ? 'Ton: An' : 'Ton: Aus';
    soundToggle.setAttribute('aria-pressed', String(enabled));
    soundToggle.setAttribute('aria-label', enabled ? 'Ton ausschalten' : 'Ton einschalten');
}
soundToggle?.addEventListener('click', () => {
    setHitSoundEnabled(!isHitSoundEnabled());
    renderSoundToggle();
});
renderSoundToggle();
let activePhase = null;
let activeView = null;
pauseToggle?.addEventListener('click', () => activeView?.togglePause?.());
let state = null;
let selected = null;
let appliedRevision = -1;
let appliedUser = null;
let activeUser = null;
let applying = false;
let runnerStartToken = 0;
const mergeDialog = document.createElement('dialog');
mergeDialog.className = 'dino-merge-dialog';
document.body.append(mergeDialog);

function addButton(parent, label, callback, {disabled = false, selected: isSelected = false} = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.classList.toggle('selected', isSelected);
    button.addEventListener('click', () => void callback());
    parent.append(button);
    return button;
}
function chooseEvolution(ids, choices) {
    if (activePhase !== 'formation' || !choices.length) return;
    if (mergeDialog.open) mergeDialog.close();
    mergeDialog.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'Dinosaurier fusionieren';
    const description = document.createElement('p');
    description.textContent = choices.length === 1 ? 'Zwei gleiche Dinos werden zum nächsten Tier fusioniert.' : 'Wähle die nächste Art für zwei gleiche Tier-III-Dinos:';
    const buttons = document.createElement('div');
    buttons.className = 'dino-merge-options';
    const source = state.game.run.army.concat(state.game.run.inventory).find(unit => unit.id === ids[0]);
    for (const species of choices) {
        const level = source?.species === species ? source.level + 1 : 1;
        const button = createEvolutionChoiceButton(document, species, level, state.game.meta.upgrades, state.game.run.battleUpgrades);
        button.addEventListener('click', () => {
            mergeDialog.close();
            void execute('merge', {ids, into: species});
        });
        buttons.append(button);
    }
    const cancel = addButton(buttons, 'Abbrechen', () => mergeDialog.close());
    cancel.className = 'dino-merge-cancel';
    mergeDialog.append(title, description, buttons);
    mergeDialog.showModal();
}
function dropDinosaur(id, target) {
    if (activePhase !== 'formation') return;
    const result = resolveFormationDrop(state?.game.run, id, target);
    if (!result) return;
    if (result.type === 'merge-choice') {
        if (result.choices.length === 1) void execute('merge', {ids: result.ids, into: result.choices[0]});
        else chooseEvolution(result.ids, result.choices);
    } else void execute(result.type, result.payload);
}
function paragraph(parent, text) {
    const element = document.createElement('div');
    element.textContent = text;
    parent.append(element);
    return element;
}
function moneyLabel(game) {
    return 'Stufe ' + game.run.stage + ' · ' + game.run.money + ' Münzen · ' + game.meta.currency + ' Kristalle';
}
async function execute(type, payload = undefined) {
    try {
        const next = await backend.execute({id: crypto.randomUUID(), type, payload});
        apply(next);
        if (next.message) message.textContent = next.message;
    } catch (error) {
        message.textContent = error.message;
    }
}
async function refresh() {
    try { apply(await backend.load()); }
    catch (error) { message.textContent = error.message; }
}
function cleanup() {
    runnerStartToken++;
    if (mergeDialog.open) mergeDialog.close();
    activeView?.destroy();
    activeView = null;
    host.replaceChildren();
}
function showEvolutionTree() {
    if (mergeDialog.open) mergeDialog.close();
    mergeDialog.replaceChildren();
    const title = document.createElement('h3');
    title.textContent = 'Dinosaurier-Entwicklungsbaum';
    const info = document.createElement('p');
    info.textContent = '2 gleiche Dinos → nächstes Tier (I → II → III). Zwei Tier-III-Dinos wählen eine neue Art auf Tier I.';
    const content = document.createElement('div');
    content.className = 'dino-tree';
    for (let rank = 1; rank <= 4; rank++) {
        const section = document.createElement('section');
        const heading = document.createElement('h4');
        heading.textContent = 'Rang ' + ['I', 'II', 'III', 'IV'][rank - 1];
        section.append(heading);
        const cards = document.createElement('div');
        cards.className = 'dino-tree-rank';
        for (const [species, def] of Object.entries(SPECIES)) {
            if (def.rank !== rank) continue;
            const card = document.createElement('article');
            card.className = 'dino-tree-species';
            const image = document.createElement('img');
            image.src = './assets/dinos/' + species + '.svg';
            image.alt = def.name;
            image.width = 72;
            image.height = 56;
            const label = document.createElement('strong');
            label.textContent = def.name;
            const role = document.createElement('small');
            role.textContent = def.role + (def.evolutions.length ? ' → ' + def.evolutions.map(id => SPECIES[id].name).join(' / ') : ' · Apex');
            card.append(image, label, role);
            cards.append(card);
        }
        section.append(cards);
        content.append(section);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Schließen';
    close.addEventListener('click', () => mergeDialog.close());
    mergeDialog.append(title, info, content, close);
    mergeDialog.showModal();
}
function renderFormationStats(unit, run) {
    hud.replaceChildren();
    if (!unit) {
        hud.textContent = '3×5 Felder · ' + run.army.length + ' aufgestellt · ' + run.inventory.length + ' im Vorrat';
        return;
    }
    const type = SPECIES[unit.species];
    const maximum = maxHp(unit, state.game.meta.upgrades);
    const damage = Math.round(type.damage * unitPower(unit) * (1 + run.battleUpgrades.damage * 0.15));
    const make = (tag, className, content) => {
        const element = document.createElement(tag);
        element.className = className;
        if (content !== undefined) element.textContent = content;
        return element;
    };
    const card = make('div', 'dino-stat-card');
    card.style.setProperty('--dino-color', '#' + type.color.toString(16).padStart(6, '0'));
    const header = make('div', 'dino-stat-header');
    const avatar = make('img', 'dino-stat-avatar');
    avatar.src = './assets/dinos/' + unit.species + '.svg';
    avatar.alt = type.name;
    avatar.width = 56;
    avatar.height = 46;
    const identity = make('div', 'dino-stat-identity');
    const traitNames = {bleed: 'Blutung', stun: 'Betäubung', evasion: 'Ausweichen', burst: 'Kritischer Treffer',
        rapid: 'Schnellangriff', armor: 'Panzerung', counter: 'Gegenangriff', pierce: 'Durchschlag',
        support: 'Unterstützung', cleave: 'Flächenschaden', poison: 'Gift', reflect: 'Reflexion', heal: 'Heilung'};
    identity.append(make('strong', '', type.name),
        make('small', '', 'Rang ' + type.rank + ' · Tier ' + unit.level + '/3 · ' + type.role),
        make('small', 'dino-stat-trait', traitNames[unit.trait ?? type.trait] ?? 'Standard'));
    header.append(avatar, identity, make('span', 'dino-stat-placement', unit.cell === null ? 'Vorrat' : 'Aufgestellt'));
    const health = make('div', 'dino-stat-health');
    health.append(make('span', '', 'Lebenspunkte'), make('strong', '', unit.hp + ' / ' + maximum));
    const meter = make('progress', 'dino-stat-meter');
    meter.max = maximum;
    meter.value = unit.hp;
    meter.setAttribute('aria-label', 'Lebenspunkte');
    const grid = make('div', 'dino-stat-grid');
    for (const [label, value] of [
        ['Schaden', damage], ['Reichweite', type.range], ['Tempo', type.speed], ['Angriff', type.cooldown + ' s']
    ]) {
        const stat = make('div', 'dino-stat-value');
        stat.append(make('small', '', label), make('strong', '', String(value)));
        grid.append(stat);
    }
    card.append(header, health, meter, grid);
    hud.append(card);
}
function formation() {
    const run = state.game.run;
    const enemies = getEnemies(run.stage);
    const all = [...run.army, ...run.inventory];
    if (!all.some(unit => unit.id === selected)) selected = all[0]?.id ?? null;
    activeView.showFormation(run.army, enemies, selected, state.game.meta.upgrades, run.inventory);
    heading.textContent = 'Dino-Team aufstellen';
    renderFormationStats(all.find(item => item.id === selected), run);
    help.textContent = 'Dinos per Drag & Drop auf Felder oder in den Vorrat ziehen. Zwei gleiche Dinos zum Fusionieren aufeinanderziehen.';
    actions.replaceChildren();
    const row = document.createElement('div');
    row.className = 'action-row';
    addButton(row, 'Kampf starten', () => void execute('start-battle'), {disabled: !run.army.some(unit => unit.hp > 0)});
    addButton(row, 'Entwicklungsbaum', showEvolutionTree);
    actions.append(row);
}
function beginBattle() {
    heading.textContent = 'Dino-Kampf';
    help.textContent = 'Der Kampf läuft automatisch. Die Aufstellung entscheidet über den Ausgang.';
    actions.replaceChildren();
    const game = state.game;
    const result = simulateBattle(game.run.army, getEnemies(game.run.stage), game.meta.upgrades, game.run.battleUpgrades);
    activeView.play(result.frames, () => void execute('resolve-battle', {winner: result.winner, survivors: result.survivors}));
    hud.textContent = 'Dein Team gegen die Dinos der Stufe ' + game.run.stage;
}
function rewards() {
    const run = state.game.run;
    heading.textContent = 'Sieg! Stufe ' + run.stage + ' geschafft';
    hud.textContent = '+' + run.lastResult.money + ' Münzen · ' + run.potions + ' Heiltränke';
    help.textContent = 'Verletzte Dinos behalten ihren Schaden. Überlebende haben sich bereits etwas erholt.';
    actions.replaceChildren();
    paragraph(actions, 'Heiltränke kosten 20 Münzen und heilen 60 % der maximalen Lebenspunkte. Auch bewusstlose Dinos können damit wiederbelebt werden.');
    const row = document.createElement('div');
    row.className = 'action-row';
    addButton(row, 'Heiltrank kaufen (20)', () => void execute('buy-potion'), {disabled: run.money < 20});
    const damageCost = 30 + 20 * run.battleUpgrades.damage;
    addButton(row, 'Team-Schaden +' + ((run.battleUpgrades.damage + 1) * 15) + '% (' + damageCost + ')', () => void execute('buy-battle-damage'), {disabled: run.money < damageCost});
    addButton(row, 'Nächste Stufe', () => void execute('next-stage'));
    actions.append(row);
    const injured = [...run.army, ...run.inventory].filter(unit => unit.hp < maxHp(unit, state.game.meta.upgrades));
    for (const unit of injured) {
        addButton(actions, SPECIES[unit.species].name + ' heilen (' + unit.hp + '/' + maxHp(unit, state.game.meta.upgrades) + ')', () => void execute('heal', {id: unit.id}), {disabled: run.potions < 1});
    }
}
function gameOver() {
    const game = state.game;
    const result = game.run.lastResult;
    heading.textContent = 'Deine Dino-Armee wurde besiegt';
    hud.textContent = 'Stufe ' + result.stage + ' erreicht · +' + result.meta + ' Urzeitkristalle';
    help.textContent = 'Alle Dinos, Münzen und temporären Boni sind verloren. Dauerhafte Verbesserungen bleiben erhalten.';
    actions.replaceChildren();
    paragraph(actions, 'Kristalle verfügbar: ' + game.meta.currency);
    const row = document.createElement('div');
    row.className = 'action-row';
    for (const [kind, label] of [['starterHp', 'Start-Lebenspunkte'], ['runnerDamage', 'Runner-Schaden']]) {
        const level = game.meta.upgrades[kind];
        const cost = 5 * (level + 1);
        addButton(row, label + ' L' + (level + 1) + ' (' + cost + ' Kristalle)', () => void execute('upgrade', {kind}), {disabled: game.meta.currency < cost});
    }
    addButton(row, 'Neuen Lauf starten', () => void execute('new-run'));
    actions.append(row);
}
async function beginRunner() {
    const token = ++runnerStartToken;
    const game = state.game;
    if (pauseToggle) {
        pauseToggle.disabled = true;
        pauseToggle.textContent = 'Pause';
        pauseToggle.setAttribute('aria-pressed', 'false');
    }
    heading.textContent = 'Stufe ' + game.run.stage + ' — Dino Rush';
    actions.replaceChildren();
    const runnerHudText = document.createTextNode('');
    const runnerCoinCounter = document.createElement('span');
    runnerCoinCounter.id = 'runner-coin-counter';
    runnerCoinCounter.className = 'dino-runner-coins';
    runnerCoinCounter.textContent = 'Münzen 0';
    hud.replaceChildren(runnerHudText, runnerCoinCounter);
    help.textContent = '← → oder wischen zum Steuern, P oder Pause zum Anhalten. Schieße auf Käfige und Tore; Magnet-Tore erhöhen die Münzreichweite.';
    try {
        const {startRunner} = await import('./runner/runner.js');
        if (activePhase !== 'runner' || token !== runnerStartToken) return;
        activeView = startRunner(host, {
        stage: game.run.stage, upgrades: game.meta.upgrades,
        roster: [...game.run.army, ...game.run.inventory].map(unit => unit.species),
        onPauseChange: paused => {
            if (pauseToggle) {
                pauseToggle.textContent = paused ? 'Weiter' : 'Pause';
                pauseToggle.setAttribute('aria-pressed', String(paused));
                pauseToggle.setAttribute('aria-label', paused ? 'Runner fortsetzen' : 'Runner pausieren');
            }
            message.textContent = paused ? 'Pausiert – mit Weiter oder P fortsetzen' : '';
        },
        onProgress: progress => {
            runnerHudText.textContent = 'Zeit ' + progress.seconds + 's · Leben ' + progress.hp + ' · Dinos ' + progress.collected +
                ' · Schaden ×' + progress.temporary.damage.toFixed(1) + ' · Tempo ×' + progress.temporary.fireRate.toFixed(1) +
                ' · Kugeln ' + progress.temporary.bullets + ' · Magnet ' + progress.temporary.pickupRange.toFixed(1) + ' · ';
            runnerCoinCounter.textContent = 'Münzen ' + (progress.coins ?? 0);
            message.textContent = progress.notice ?? '';
        },
        onFinish: result => void execute('complete-runner', result)
        });
        if (pauseToggle) pauseToggle.disabled = false;
    } catch (error) {
        if (activePhase !== 'runner' || token !== runnerStartToken) return;
        heading.textContent = 'Runner konnte nicht gestartet werden';
        message.textContent = '3D-Spiel konnte nicht geladen werden: ' + error.message;
        actions.replaceChildren();
        if (pauseToggle) pauseToggle.disabled = true;
        addButton(actions, 'Erneut versuchen', () => void beginRunner());
    }
}
function apply(snapshot) {
    if (applying || (snapshot.revision === appliedRevision && snapshot.user.id === appliedUser)) return;
    applying = true;
    try {
        state = {...snapshot, game: migrateGame(snapshot.game)};
        snapshot = state;
        appliedRevision = snapshot.revision;
        appliedUser = snapshot.user.id;
        const phase = snapshot.game.run.phase;
        const previousUser = activeUser;
        stats.textContent = moneyLabel(snapshot.game);
        stage.className = 'dino-stage ' + phase;
        if (pauseToggle) pauseToggle.hidden = phase !== 'runner';
        hud.classList.toggle('dino-stats-panel', phase === 'formation');
        if (phase !== activePhase || snapshot.user.id !== previousUser) {
            cleanup();
            activePhase = phase;
            activeUser = snapshot.user.id;
            message.textContent = '';
            if (phase === 'runner') void beginRunner();
            else if (phase === 'formation' || phase === 'battle') {
                activeView = new BattleView(host, {
                    onSelect: id => { selected = id; formation(); },
                    onDrop: (id, target) => { selected = id; dropDinosaur(id, target); }
                });
                if (phase === 'formation') formation();
                else beginBattle();
            } else if (phase === 'rewards') rewards();
            else if (phase === 'gameover') gameOver();
        } else if (phase === 'formation') formation();
        else if (phase === 'rewards') rewards();
        else if (phase === 'gameover') gameOver();
    } catch (error) {
        message.textContent = 'Spiel konnte nicht gestartet werden: ' + error.message;
    } finally {
        applying = false;
    }
}
backend.subscribe(() => void refresh());
if (backend.kind === 'mock') mountDevtools(backend);
watchDeployment();
void refresh();
