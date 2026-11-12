import {createGameBackend} from '../../shared/backend.js';
import {mountDevtools} from '../../shared/devtools.js';
import {watchDeployment} from '../../shared/deploy-watch.js';
import {INITIAL_GAME, SPECIES, getEnemies, mergeOptions, maxHp, reduceGame} from './core/game.js';
import {simulateBattle} from './core/battle.js';
import {startRunner} from './runner/runner.js';
import {BattleView} from './battle/view.js';

const backend = createGameBackend({gameId: 'dino-rush-battle', initialGame: INITIAL_GAME, reducer: reduceGame});
const stage = document.querySelector('.dino-stage');
const host = document.querySelector('#game-view');
const heading = document.querySelector('#heading');
const hud = document.querySelector('#hud');
const actions = document.querySelector('#actions');
const stats = document.querySelector('#stats');
const message = document.querySelector('#message');
const help = document.querySelector('#help');
let activePhase = null;
let activeView = null;
let state = null;
let selected = null;
let appliedRevision = -1;
let appliedUser = null;
let activeUser = null;
let applying = false;

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
    activeView?.destroy();
    activeView = null;
    host.replaceChildren();
}
function formation() {
    const run = state.game.run;
    const enemies = getEnemies(run.stage);
    const all = [...run.army, ...run.inventory];
    if (!all.some(unit => unit.id === selected)) selected = all[0]?.id ?? null;
    activeView.showFormation(run.army, enemies, selected);
    heading.textContent = 'Dino-Team aufstellen';
    hud.textContent = '3×5 Felder · ' + run.army.length + ' aufgestellt · ' + run.inventory.length + ' im Vorrat';
    help.textContent = 'Wähle einen Dinosaurier und tippe auf ein Feld. Zwei gleiche Dinosaurier können sich weiterentwickeln.';
    actions.replaceChildren();
    const picker = document.createElement('div');
    picker.className = 'unit-picker';
    for (const unit of all) {
        const species = SPECIES[unit.species];
        const text = species.name + ' L' + unit.level + ' (' + unit.hp + '/' + maxHp(unit, state.game.meta.upgrades) + ')';
        addButton(picker, text, () => {
            selected = unit.id;
            formation();
        }, {selected: unit.id === selected});
    }
    actions.append(picker);
    const row = document.createElement('div');
    row.className = 'action-row';
    const merge = mergeOptions(all);
    for (const option of merge) {
        for (const into of option.choices) {
            addButton(row, SPECIES[option.species].name + ' → ' + SPECIES[into].name, () => void execute('merge', {ids: option.ids, into}));
        }
    }
    addButton(row, 'Kampf starten', () => void execute('start-battle'), {disabled: !run.army.some(unit => unit.hp > 0)});
    actions.append(row);
}
function beginBattle() {
    heading.textContent = 'Dino-Kampf';
    help.textContent = 'Der Kampf läuft automatisch. Die Aufstellung entscheidet über den Ausgang.';
    actions.replaceChildren();
    const game = state.game;
    const result = simulateBattle(game.run.army, getEnemies(game.run.stage), game.meta.upgrades);
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
function beginRunner() {
    const game = state.game;
    heading.textContent = 'Stufe ' + game.run.stage + ' — Dino-Rush';
    actions.replaceChildren();
    help.textContent = '← → oder auf der Strecke wischen. Triff Käfige zum Befreien und schieße auf Tore, um ihre Boni zu verbessern.';
    activeView = startRunner(host, {
        stage: game.run.stage, upgrades: game.meta.upgrades,
        onProgress: progress => {
            hud.textContent = 'Zeit ' + progress.seconds + 's · Leben ' + progress.hp + ' · Dinos ' + progress.collected +
                ' · Schaden ×' + progress.temporary.damage.toFixed(1) + ' · Tempo ×' + progress.temporary.fireRate.toFixed(1) +
                ' · Kugeln ' + progress.temporary.bullets;
        },
        onFinish: result => void execute('complete-runner', result)
    });
}
function apply(snapshot) {
    if (applying || (snapshot.revision === appliedRevision && snapshot.user.id === appliedUser)) return;
    applying = true;
    try {
        state = snapshot;
        appliedRevision = snapshot.revision;
        appliedUser = snapshot.user.id;
        const phase = snapshot.game.run.phase;
        const previousUser = activeUser;
        stats.textContent = moneyLabel(snapshot.game);
        stage.className = 'dino-stage ' + phase;
        if (phase !== activePhase || snapshot.user.id !== previousUser) {
            cleanup();
            activePhase = phase;
            activeUser = snapshot.user.id;
            message.textContent = '';
            if (phase === 'runner') beginRunner();
            else if (phase === 'formation' || phase === 'battle') {
                activeView = new BattleView(host, cell => {
                    if (selected) void execute('place', {id: selected, cell});
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
