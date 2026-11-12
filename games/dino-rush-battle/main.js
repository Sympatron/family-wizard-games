import {createGameBackend} from '../../shared/backend.js';
import {mountDevtools} from '../../shared/devtools.js';
import {watchDeployment} from '../../shared/deploy-watch.js';
import {INITIAL_GAME, SPECIES, getEnemies, mergeOptions, maxHp, reduceGame} from './core/game.js';
import {resolveFormationDrop} from './core/drops.js';
import {isHitSoundEnabled, setHitSoundEnabled} from './core/hit-sound.js';
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
const soundToggle = document.querySelector('#sound-toggle');
function renderSoundToggle() {
    const enabled = isHitSoundEnabled();
    soundToggle.textContent = enabled ? 'Ton: An' : 'Ton: Aus';
    soundToggle.setAttribute('aria-pressed', String(enabled));
    soundToggle.setAttribute('aria-label', enabled ? 'Ton ausschalten' : 'Ton einschalten');
}
soundToggle.addEventListener('click', () => {
    setHitSoundEnabled(!isHitSoundEnabled());
    renderSoundToggle();
});
renderSoundToggle();
let activePhase = null;
let activeView = null;
let state = null;
let selected = null;
let appliedRevision = -1;
let appliedUser = null;
let activeUser = null;
let applying = false;
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
    description.textContent = 'Wähle die Entwicklung für deine beiden gleichen Dinos:';
    const buttons = document.createElement('div');
    buttons.className = 'dino-merge-options';
    for (const species of choices) {
        addButton(buttons, SPECIES[species].name, () => {
            mergeDialog.close();
            void execute('merge', {ids, into: species});
        });
    }
    addButton(buttons, 'Abbrechen', () => mergeDialog.close());
    mergeDialog.append(title, description, buttons);
    mergeDialog.showModal();
}
function dropDinosaur(id, target) {
    if (activePhase !== 'formation') return;
    const result = resolveFormationDrop(state?.game.run, id, target);
    if (!result) return;
    if (result.type === 'merge-choice') chooseEvolution(result.ids, result.choices);
    else void execute(result.type, result.payload);
}
function enableUnitDragging(button, id) {
    button.draggable = true;
    button.addEventListener('dragstart', event => {
        if (activePhase !== 'formation') return event.preventDefault();
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
        selected = id;
    });
    button.addEventListener('pointerdown', event => {
        if (!['touch', 'pen'].includes(event.pointerType) || activePhase !== 'formation') return;
        const {pointerId, clientX: startX, clientY: startY} = event;
        let dragging = false;
        let ghost = null;
        function move(next) {
            if (next.pointerId !== pointerId) return;
            if (!dragging && Math.hypot(next.clientX - startX, next.clientY - startY) < 12) return;
            if (!dragging) {
                dragging = true;
                selected = id;
                ghost = document.createElement('div');
                ghost.className = 'dino-drag-ghost';
                ghost.textContent = button.textContent;
                document.body.append(ghost);
            }
            next.preventDefault();
            ghost.style.left = next.clientX + 'px';
            ghost.style.top = next.clientY + 'px';
            activeView?.highlightClient(next.clientX, next.clientY, id);
        }
        function cleanup(next, cancelled) {
            if (next.pointerId !== pointerId) return;
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', cancel);
            ghost?.remove();
            const target = !cancelled && dragging ? activeView?.targetAtClient(next.clientX, next.clientY, id) : null;
            activeView?.showDropTarget(null);
            if (target && activePhase === 'formation') dropDinosaur(id, target);
        }
        function up(next) { cleanup(next, false); }
        function cancel(next) { cleanup(next, true); }
        window.addEventListener('pointermove', move, {passive: false});
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
    });
}
host.addEventListener('dragover', event => {
    if (activePhase !== 'formation') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    activeView?.highlightClient(event.clientX, event.clientY);
});
host.addEventListener('dragleave', event => {
    if (!host.contains(event.relatedTarget)) activeView?.showDropTarget(null);
});
host.addEventListener('drop', event => {
    if (activePhase !== 'formation') return;
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    const target = activeView?.targetAtClient(event.clientX, event.clientY, id);
    activeView?.showDropTarget(null);
    if (id && target) dropDinosaur(id, target);
});
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
    if (mergeDialog.open) mergeDialog.close();
    activeView?.destroy();
    activeView = null;
    host.replaceChildren();
}
function renderFormationStats(unit, run) {
    hud.replaceChildren();
    if (!unit) {
        hud.textContent = '3×5 Felder · ' + run.army.length + ' aufgestellt · ' + run.inventory.length + ' im Vorrat';
        return;
    }
    const type = SPECIES[unit.species];
    const maximum = maxHp(unit, state.game.meta.upgrades);
    const damage = Math.round(type.damage * (1 + (unit.level - 1) * 0.2) * (1 + run.battleUpgrades.damage * 0.15));
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
    identity.append(make('strong', '', type.name), make('small', '', 'Level ' + unit.level + ' · ' + type.role));
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
    help.textContent = 'Ziehe gleiche Dinos desselben Levels aufeinander, um sie zu fusionieren. Andere Dinos tauschen ihre Plätze.';
    actions.replaceChildren();
    const picker = document.createElement('div');
    picker.className = 'unit-picker';
    for (const unit of all) {
        const species = SPECIES[unit.species];
        const text = species.name + ' L' + unit.level + ' (' + unit.hp + '/' + maxHp(unit, state.game.meta.upgrades) + ')';
        const button = addButton(picker, text, () => {
            selected = unit.id;
            formation();
        }, {selected: unit.id === selected});
        enableUnitDragging(button, unit.id);
    }
    actions.append(picker);
    const row = document.createElement('div');
    row.className = 'action-row';
    addButton(row, 'Kampf starten', () => void execute('start-battle'), {disabled: !run.army.some(unit => unit.hp > 0)});
    addButton(row, 'Team automatisch aufstellen', () => void execute('auto-place'), {disabled: !all.length});
    if (run.army.some(unit => unit.id === selected)) {
        addButton(row, 'Ausgewählten Dino in Vorrat', () => void execute('reserve', {id: selected}));
    }
    const merge = mergeOptions(all);
    for (const option of merge) {
        addButton(row, SPECIES[option.species].name + ' fusionieren', () => chooseEvolution(option.ids, option.choices));
    }
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
function beginRunner() {
    const game = state.game;
    heading.textContent = 'Stufe ' + game.run.stage + ' — Dino Rush';
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
        hud.classList.toggle('dino-stats-panel', phase === 'formation');
        if (phase !== activePhase || snapshot.user.id !== previousUser) {
            cleanup();
            activePhase = phase;
            activeUser = snapshot.user.id;
            message.textContent = '';
            if (phase === 'runner') beginRunner();
            else if (phase === 'formation' || phase === 'battle') {
                activeView = new BattleView(host, {
                    onCell: cell => { if (selected) dropDinosaur(selected, cell); },
                    onSelect: id => { selected = id; formation(); },
                    onDrop: (id, cell) => { selected = id; dropDinosaur(id, cell); }
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
