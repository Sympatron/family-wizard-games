import {BASE_PICKUP_RANGE} from './coins.js';
import {MAX_BULLETS, SHOT_INTERVAL_SECONDS} from './shots.js';
export const GATE_PROPERTIES = ['damage', 'fireRate', 'bullets', 'pickupRange'];
export const GATE_LANES = Object.freeze([-3.2, 0, 3.2]);
const bound = (value, low, high) => Math.max(low, Math.min(high, value));
export function createGatePair(stage, pairIndex) {
    const first = (stage + pairIndex) % GATE_PROPERTIES.length;
    const second = (first + 1 + (pairIndex % 2)) % GATE_PROPERTIES.length;
    return [
        {modifier: GATE_PROPERTIES[first], operation: pairIndex % 2 ? 'multiply' : 'add', level: -2},
        {modifier: GATE_PROPERTIES[second], operation: pairIndex % 2 ? 'add' : 'multiply', level: 1}
    ];
}
export function createSingleGate(stage, gateIndex) {
    return {modifier: GATE_PROPERTIES[(stage + gateIndex) % GATE_PROPERTIES.length], operation: 'add', level: 0,
        single: true, x: GATE_LANES[(stage + gateIndex * 2) % GATE_LANES.length], width: 3.1};
}
export function gateValue(gate) {
    return gate.operation === 'multiply' ? 1 + gate.level * 0.25 : gate.level;
}
export function gateLabel(gate) {
    const property = {damage: 'SCHADEN', fireRate: 'TEMPO', bullets: 'KUGELN', pickupRange: 'MAGNET'}[gate.modifier];
    if (!property || !['add', 'multiply'].includes(gate.operation)) throw new Error('Ungültiges Tor');
    if (gate.single && gate.level === 0) return property + ' SCHIESS!';
    const value = gateValue(gate);
    return property + ' ' + (gate.operation === 'multiply' ? '×' + Number(value.toFixed(2)) : (value >= 0 ? '+' : '') + value);
}
export function improveGate(gate) {
    return {...gate, level: bound(gate.level + 1, -2, 4)};
}
export function applyGate(temporary, gate) {
    if (!GATE_PROPERTIES.includes(gate.modifier) || !['add', 'multiply'].includes(gate.operation)) throw new Error('Ungültiges Tor');
    const next = {...temporary};
    const current = next[gate.modifier] ?? (gate.modifier === 'pickupRange' ? BASE_PICKUP_RANGE : undefined);
    if (!Number.isFinite(current)) throw new Error('Ungültiger Bonus');
    const amount = gate.operation === 'multiply' ? current * gateValue(gate) : current + gate.level * (gate.modifier === 'fireRate' ? SHOT_INTERVAL_SECONDS : 1);
    if (!Number.isFinite(amount)) throw new Error('Ungültiger Bonus');
    next[gate.modifier] = gate.modifier === 'bullets' ? bound(Math.round(amount), 1, MAX_BULLETS) : Math.max(gate.modifier === 'pickupRange' ? 1 : 0.25, amount);
    return next;
}

export function selectCrossedGate(gates, playerX, previousZ, currentZ, playerZ) {
    if (!gates.length || previousZ > playerZ || currentZ < playerZ) return null;
    if (gates.length === 1 && gates[0].single) {
        const gate = gates[0];
        return gate.level > 0 && Math.abs(playerX - gate.x) <= gate.width / 2 ? gate : null;
    }
    return gates.reduce((best, gate) => !best || Math.abs(playerX - gate.x) < Math.abs(playerX - best.x) ? gate : best, null);
}
