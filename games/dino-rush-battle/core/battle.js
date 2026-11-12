import {SPECIES, maxHp} from './game.js';

const TICK = 0.1;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const snapshot = (units, shots = []) => {
    const frame = units.map(u => ({id: u.id, team: u.team, species: u.species, x: u.x, y: u.y, hp: Math.max(0, u.hp), maxHp: u.maxHp, stunned: u.stunned > 0}));
    frame.shots = shots;
    return frame;
};

export function simulateBattle(army, enemies, upgrades = {}, battleUpgrades = {}) {
    const units = [...army.map(unit => makeUnit(unit, 'player', upgrades, battleUpgrades)), ...enemies.map(unit => makeUnit(unit, 'enemy'))];
    const frames = [snapshot(units)];
    let shots = [];
    let winner = null;
    for (let step = 0; step < 600; step++) {
        for (const unit of units) {
            if (unit.hp <= 0) continue;
            unit.cooldown = Math.max(0, unit.cooldown - TICK);
            unit.stunned = Math.max(0, unit.stunned - TICK);
            if (unit.stunned > 0) continue;
            const targets = units.filter(other => other.team !== unit.team && other.hp > 0);
            if (!targets.length) break;
            targets.sort((a, b) => distance(unit, a) - distance(unit, b));
            const target = targets[0];
            const d = distance(unit, target);
            if (d > unit.range) {
                const stepDistance = Math.min(d - unit.range + 1, unit.speed * TICK);
                unit.x += (target.x - unit.x) / d * stepDistance;
                unit.y += (target.y - unit.y) / d * stepDistance;
            } else if (unit.cooldown <= 0) {
                unit.cooldown = unit.attackTime;
                unit.attacks++;
                if (SPECIES[unit.species].role === 'Fernkampf') {
                    shots.push({team: unit.team, species: unit.species, x: unit.x, y: unit.y, tx: target.x, ty: target.y});
                }
                target.hp = Math.max(0, target.hp - unit.damage);
                if (unit.species === 'triceratops' && unit.attacks % 3 === 0) target.stunned = Math.max(target.stunned, 0.65);
                if (['troodon', 'stegosaurus'].includes(unit.species) && unit.attacks % 3 === 0) {
                    for (const other of targets.slice(1)) {
                        if (other.hp > 0 && distance(other, target) < 85) other.hp = Math.max(0, other.hp - Math.ceil(unit.damage * 0.55));
                    }
                }
            }
        }
        if (step % 2 === 0) {
            frames.push(snapshot(units, shots));
            shots = [];
        }
        const alivePlayer = units.some(u => u.team === 'player' && u.hp > 0);
        const aliveEnemy = units.some(u => u.team === 'enemy' && u.hp > 0);
        if (!alivePlayer || !aliveEnemy) {
            winner = alivePlayer ? 'player' : 'enemy';
            frames.push(snapshot(units, shots));
            shots = [];
            break;
        }
    }
    if (!winner) winner = units.reduce((sum, unit) => sum + (unit.team === 'player' ? unit.hp : -unit.hp), 0) > 0 ? 'player' : 'enemy';
    return {winner, frames, survivors: units.filter(u => u.team === 'player').map(u => ({id: u.id, hp: Math.round(u.hp)}))};
}
function makeUnit(unit, team, upgrades = {}, battleUpgrades = {}) {
    const species = SPECIES[unit.species];
    const depth = Math.floor(unit.cell / 5);
    const lane = unit.cell % 5;
    const unitMax = team === 'player' ? maxHp(unit, upgrades) : Math.max(1, unit.hp);
    return {
        id: unit.id, team, species: unit.species,
        x: team === 'player' ? 315 - depth * 50 : 645 + depth * 50,
        y: 82 + lane * 58,
        hp: Math.min(unitMax, unit.hp), maxHp: unitMax,
        speed: species.speed, range: species.range, damage: Math.round(species.damage * (1 + (unit.level - 1) * 0.2) * (team === 'player' ? (1 + battleUpgrades.damage * 0.15) : 1)),
        attackTime: species.cooldown, cooldown: 0.2, stunned: 0, attacks: 0
    };
}
