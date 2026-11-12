export const SPECIES = Object.freeze({
    raptor: {name: 'Raptor', role: 'Nahkampf', hp: 70, damage: 12, range: 44, speed: 62, cooldown: 0.85, color: 0x66cf88, evolutions: ['allosaurus', 'troodon']},
    triceratops: {name: 'Triceratops', role: 'Tank', hp: 125, damage: 9, range: 42, speed: 40, cooldown: 1.1, color: 0xdaa969, evolutions: ['ankylosaurus', 'stegosaurus']},
    pteranodon: {name: 'Pteranodon', role: 'Fernkampf', hp: 53, damage: 10, range: 225, speed: 52, cooldown: 1.15, color: 0x70b9ee, evolutions: ['troodon', 'stegosaurus']},
    allosaurus: {name: 'Allosaurus', role: 'Nahkampf', hp: 135, damage: 23, range: 52, speed: 61, cooldown: 0.85, color: 0xee8064, evolutions: []},
    troodon: {name: 'Troodon', role: 'Fernkampf', hp: 85, damage: 17, range: 245, speed: 67, cooldown: 0.7, color: 0xb38af1, evolutions: []},
    ankylosaurus: {name: 'Ankylosaurus', role: 'Tank', hp: 210, damage: 17, range: 48, speed: 35, cooldown: 1.25, color: 0xebba59, evolutions: []},
    stegosaurus: {name: 'Stegosaurus', role: 'Fernkampf', hp: 110, damage: 19, range: 210, speed: 48, cooldown: 1.35, color: 0x9fa9ee, evolutions: []}
});
export const INITIAL_GAME = {
    version: 1,
    meta: {currency: 0, upgrades: {starterHp: 0, runnerDamage: 0}},
    run: createRun()
};
export function maxHp(unit, upgrades = {}) {
    return Math.round(SPECIES[unit.species].hp * (1 + (unit.level - 1) * 0.2) * (1 + (upgrades.starterHp ?? 0) * 0.08));
}
export function createRun() {
    return {
        phase: 'runner', stage: 1, money: 0, potions: 0, nextId: 2,
        army: [{id: 'd1', species: 'raptor', level: 1, hp: 70, cell: 0}],
        inventory: [], temporary: {damage: 1, fireRate: 1, bullets: 1}, battleUpgrades: {damage: 0}, lastResult: null
    };
}
export function getEnemies(stage) {
    const types = ['raptor', 'triceratops', 'pteranodon'];
    return Array.from({length: Math.min(3 + stage, 12)}, (_, i) => {
        const species = types[(i + stage) % types.length];
        return {id: 'e' + i, species, level: 1, hp: Math.round(SPECIES[species].hp * (0.75 + stage * 0.11)), cell: i};
    });
}
export function nextFreeCell(army, species) {
    const filled = new Set(army.map(unit => unit.cell));
    const cells = Array.from({length: 15}, (_, cell) => cell);
    if (SPECIES[species].role === 'Fernkampf') cells.reverse();
    return cells.find(cell => !filled.has(cell)) ?? null;
}
export function getMergeChoices(first, second) {
    if (!first || !second || first.id === second.id || first.species !== second.species || first.level !== second.level) return [];
    return SPECIES[first.species]?.evolutions ?? [];
}
export function mergeOptions(army) {
    const result = [];
    for (let i = 0; i < army.length; i++) {
        for (let j = i + 1; j < army.length; j++) {
            const a = army[i], b = army[j];
            const choices = getMergeChoices(a, b);
            if (choices.length) result.push({ids: [a.id, b.id], species: a.species, choices});
        }
    }
    const seen = new Set();
    return result.filter(option => {
        const key = option.species + ':' + army.find(unit => unit.id === option.ids[0])?.level;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
export function reduceGame(game, action) {
    const next = structuredClone(game);
    const run = next.run;
    const fail = message => { throw new Error(message); };
    switch (action.type) {
        case 'complete-runner': {
            if (run.phase !== 'runner') fail('Der Lauf ist nicht aktiv.');
            const collected = action.payload?.collected;
            if (!Array.isArray(collected) || collected.length > 50 || collected.some(id => !SPECIES[id])) fail('Ungültige Dinosaurier.');
            for (const species of collected) {
                const unit = {id: 'd' + run.nextId++, species, level: 1, hp: 0, cell: null};
                unit.hp = maxHp(unit, next.meta.upgrades);
                const cell = nextFreeCell(run.army, unit.species);
                if (cell === null) run.inventory.push(unit);
                else {
                    unit.cell = cell;
                    run.army.push(unit);
                }
            }
            const temporary = action.payload?.temporary ?? {};
            run.temporary = {
                damage: Math.max(0.25, Math.min(6, Number(temporary.damage) || 1)),
                fireRate: Math.max(0.25, Math.min(6, Number(temporary.fireRate) || 1)),
                bullets: Math.max(1, Math.min(7, Math.floor(Number(temporary.bullets) || 1)))
            };
            const coins = action.payload?.coins ?? 0;
            if (!Number.isSafeInteger(coins) || coins < 0 || coins > 3000) fail('Ungültige Münzen.');
            run.money += coins;
            run.phase = 'formation';
            return {game: next, message: collected.length
                ? collected.length + (collected.length === 1 ? ' Dino gerettet und automatisch aufgestellt.' : ' Dinos gerettet und automatisch aufgestellt.') + ' Du kannst die Formation ändern.'
                : 'Keine neuen Dinos gerettet. Du kannst die Formation trotzdem ändern.'};
        }
        case 'auto-place': {
            if (run.phase !== 'formation') fail('Du kannst dein Team gerade nicht ändern.');
            const priority = {Tank: 0, Nahkampf: 1, Fernkampf: 2};
            const pool = [...run.army, ...run.inventory];
            pool.sort((a, b) => Number(b.hp > 0) - Number(a.hp > 0) ||
                priority[SPECIES[a.species].role] - priority[SPECIES[b.species].role] || b.level - a.level);
            run.army = pool.slice(0, 15).map((unit, i) => ({...unit, cell: i}));
            run.inventory = pool.slice(15).map(unit => ({...unit, cell: null}));
            return {game: next, message: 'Dein Team wurde automatisch aufgestellt.'};
        }
        case 'reserve': {
            if (run.phase !== 'formation') fail('Du kannst dein Team gerade nicht ändern.');
            const index = run.army.findIndex(unit => unit.id === action.payload?.id);
            if (index < 0) fail('Dieser Dinosaurier steht nicht auf dem Feld.');
            const [unit] = run.army.splice(index, 1);
            unit.cell = null;
            run.inventory.push(unit);
            return {game: next, message: 'Dinosaurier in den Vorrat gelegt.'};
        }
        case 'place': {
            if (run.phase !== 'formation') fail('Du kannst dein Team gerade nicht ändern.');
            const {id, cell} = action.payload ?? {};
            if (!Number.isInteger(cell) || cell < 0 || cell >= 15) fail('Ungültiges Feld.');
            const pool = [...run.army, ...run.inventory];
            const unit = pool.find(item => item.id === id);
            if (!unit) fail('Dinosaurier nicht gefunden.');
            const occupant = run.army.find(item => item.cell === cell);
            if (occupant && occupant.id !== id) {
                if (unit.cell === null) {
                    occupant.cell = null;
                    run.army = run.army.filter(item => item.id !== occupant.id);
                    run.inventory.push(occupant);
                } else occupant.cell = unit.cell;
            }
            run.inventory = run.inventory.filter(item => item.id !== id);
            run.army = run.army.filter(item => item.id !== id);
            unit.cell = cell;
            run.army.push(unit);
            return {game: next};
        }
        case 'merge': {
            if (run.phase !== 'formation') fail('Nur vor dem Kampf möglich.');
            const {ids, into} = action.payload ?? {};
            if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) fail('Ungültige Fusion.');
            const pool = [...run.army, ...run.inventory];
            const a = pool.find(unit => unit.id === ids[0]);
            const b = pool.find(unit => unit.id === ids[1]);
            if (!getMergeChoices(a, b).includes(into)) fail('Diese Dinosaurier können nicht fusionieren.');
            run.army = run.army.filter(unit => !ids.includes(unit.id));
            run.inventory = run.inventory.filter(unit => !ids.includes(unit.id));
            const upgraded = {id: 'd' + run.nextId++, species: into, level: a.level + 1, cell: a.cell ?? b.cell ?? null, hp: 0};
            upgraded.hp = maxHp(upgraded, next.meta.upgrades);
            if (upgraded.cell === null) run.inventory.push(upgraded);
            else run.army.push(upgraded);
            return {game: next, message: upgraded.species + ' entwickelt!'};
        }
        case 'start-battle':
            if (run.phase !== 'formation' || !run.army.some(unit => unit.hp > 0)) fail('Stelle mindestens einen gesunden Dino auf.');
            run.phase = 'battle';
            return {game: next};
        case 'resolve-battle': {
            if (run.phase !== 'battle') fail('Kein Kampf aktiv.');
            const {winner, survivors} = action.payload ?? {};
            if (!['player', 'enemy'].includes(winner) || !Array.isArray(survivors)) fail('Ungültiges Kampfergebnis.');
            for (const unit of run.army) {
                const hp = survivors.find(item => item.id === unit.id)?.hp ?? 0;
                unit.hp = Math.max(0, Math.min(maxHp(unit, next.meta.upgrades), Math.round(Number(hp) || 0)));
            }
            if (winner === 'enemy' || !run.army.some(unit => unit.hp > 0)) {
                const earned = Math.max(1, run.stage * 5);
                next.meta.currency += earned;
                next.run = {...createRun(), phase: 'gameover', army: [], inventory: [], lastResult: {stage: run.stage, meta: earned}};
                return {game: next, message: 'Niederlage! Du erhältst ' + earned + ' Urzeitkristalle.'};
            }
            for (const unit of run.army) {
                if (unit.hp > 0) unit.hp = Math.min(maxHp(unit, next.meta.upgrades), unit.hp + Math.round(maxHp(unit, next.meta.upgrades) * 0.25));
            }
            run.money += 25 + run.stage * 10;
            run.phase = 'rewards';
            run.lastResult = {stage: run.stage, money: 25 + run.stage * 10};
            return {game: next, message: 'Sieg! Deine Dinosaurier erholen sich etwas.'};
        }
        case 'buy-battle-damage': {
            if (run.phase !== 'rewards') fail('Verbesserungen sind nur zwischen den Kämpfen möglich.');
            const cost = 30 + 20 * run.battleUpgrades.damage;
            if (run.money < cost) fail('Nicht genug Geld.');
            run.money -= cost;
            run.battleUpgrades.damage++;
            return {game: next, message: 'Dein Team verursacht jetzt mehr Schaden.'};
        }
        case 'buy-potion':
            if (run.phase !== 'rewards' || run.money < 20) fail('Nicht genug Geld.');
            run.money -= 20;
            run.potions++;
            return {game: next, message: 'Heiltrank gekauft.'};
        case 'heal': {
            if (run.phase !== 'rewards' || run.potions < 1) fail('Kein Heiltrank verfügbar.');
            const unit = [...run.army, ...run.inventory].find(item => item.id === action.payload?.id);
            if (!unit || unit.hp >= maxHp(unit, next.meta.upgrades)) fail('Dieser Dinosaurier braucht keine Heilung.');
            unit.hp = Math.min(maxHp(unit, next.meta.upgrades), unit.hp + Math.max(1, Math.ceil(maxHp(unit, next.meta.upgrades) * 0.6)));
            run.potions--;
            return {game: next, message: 'Dinosaurier geheilt.'};
        }
        case 'next-stage':
            if (run.phase !== 'rewards') fail('Schließe zuerst den Kampf ab.');
            run.stage++;
            run.phase = 'runner';
            run.temporary = {damage: 1, fireRate: 1, bullets: 1};
            return {game: next};
        case 'upgrade': {
            if (run.phase !== 'gameover') fail('Dauerhafte Upgrades sind zwischen den Läufen verfügbar.');
            const kind = action.payload?.kind;
            if (!['starterHp', 'runnerDamage'].includes(kind)) fail('Unbekanntes Upgrade.');
            const level = next.meta.upgrades[kind];
            const cost = 5 * (level + 1);
            if (next.meta.currency < cost) fail('Nicht genug Urzeitkristalle.');
            next.meta.currency -= cost;
            next.meta.upgrades[kind]++;
            return {game: next, message: 'Verbesserung gekauft.'};
        }
        case 'new-run':
            if (run.phase !== 'gameover') fail('Der aktuelle Durchlauf ist noch aktiv.');
            next.run = createRun();
            next.run.army[0].hp = maxHp(next.run.army[0], next.meta.upgrades);
            return {game: next};
        default:
            fail('Unbekannte Spielaktion.');
    }
}
