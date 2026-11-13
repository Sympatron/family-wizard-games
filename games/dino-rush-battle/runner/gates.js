export const GATE_PROPERTIES = ['damage', 'fireRate', 'bullets'];
const bound = (value, low, high) => Math.max(low, Math.min(high, value));
export function createGatePair(stage, pairIndex) {
    const first = (stage + pairIndex) % GATE_PROPERTIES.length;
    const second = (first + 1 + (pairIndex % 2)) % GATE_PROPERTIES.length;
    return [
        {modifier: GATE_PROPERTIES[first], operation: pairIndex % 2 ? 'multiply' : 'add', level: -2},
        {modifier: GATE_PROPERTIES[second], operation: pairIndex % 2 ? 'add' : 'multiply', level: 1}
    ];
}
export function gateValue(gate) {
    return gate.operation === 'multiply' ? 1 + gate.level * 0.25 : gate.level;
}
export function gateLabel(gate) {
    const property = {damage: 'SCHADEN', fireRate: 'TEMPO', bullets: 'KUGELN'}[gate.modifier];
    if (!property || !['add', 'multiply'].includes(gate.operation)) throw new Error('Ungültiges Tor');
    const value = gateValue(gate);
    return property + ' ' + (gate.operation === 'multiply' ? '×' + value.toFixed(2).replace(/0$/, '').replace(/\.$/, '') : (value >= 0 ? '+' : '') + value);
}
export function improveGate(gate) {
    return {...gate, level: bound(gate.level + 1, -2, 4)};
}
export function applyGate(temporary, gate) {
    if (!GATE_PROPERTIES.includes(gate.modifier) || !['add', 'multiply'].includes(gate.operation)) throw new Error('Ungültiges Tor');
    const next = {...temporary};
    const current = next[gate.modifier];
    if (!Number.isFinite(current)) throw new Error('Ungültiger Bonus');
    if (gate.operation === 'multiply') next[gate.modifier] = current * gateValue(gate);
    else next[gate.modifier] = current + gate.level * (gate.modifier === 'bullets' ? 1 : gate.modifier === 'damage' ? 0.3 : 0.12);
    if (gate.modifier === 'bullets') next.bullets = bound(Math.round(next.bullets), 1, 5);
    else next[gate.modifier] = bound(Math.round(next[gate.modifier] * 100) / 100, 0.3, gate.modifier === 'fireRate' ? 2.5 : 3);
    return next;
}

export function selectCrossedGate(gates, playerX, previousZ, currentZ, playerZ) {
    if (!gates.length || previousZ > playerZ || currentZ < playerZ) return null;
    return gates.reduce((best, gate) => !best || Math.abs(playerX - gate.x) < Math.abs(playerX - best.x) ? gate : best, null);
}
