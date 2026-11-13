export const BOARD_SIZE = Object.freeze({
    portrait: {width: 540, height: 620},
    landscape: {width: 960, height: 620}
});

const FIRST_LANE_Y = 82;
const FRONT_X = {player: 380, enemy: 580};
const CELL_SPACING_X = 66;
const CELL_SPACING_Y = 58;
export const RESERVE_LAYOUT = Object.freeze({portrait: {left: 416, width: 124, center: 478}, landscape: {left: 768, width: 192, center: 864}});
export function reserveSidebar(portrait) { return RESERVE_LAYOUT[portrait ? 'portrait' : 'landscape']; }
export function reserveUnitPosition(index, portrait) { return {x: reserveSidebar(portrait).center, y: 86 + index * 55}; }

export function toBattleScreen(x, y, portrait) {
    return portrait
        ? {x: 46 + (y - FIRST_LANE_Y) * 1.33, y: 270 + (480 - x) * 0.85}
        : {x: 104 + (y - FIRST_LANE_Y) * 2.55, y: 270 + (480 - x) * 0.85};
}

export function toCombatScreen(x, y, portrait) {
    return {x: portrait ? 66 + (y - FIRST_LANE_Y) * 1.75 : 200 + (y - FIRST_LANE_Y) * 2.45, y: 310 + (480 - x) * 0.42};
}

export function battleCellCenter(team, cell, portrait) {
    const depth = Math.floor(cell / 5);
    const lane = cell % 5;
    const direction = team === 'player' ? -1 : 1;
    return toBattleScreen(FRONT_X[team] + depth * CELL_SPACING_X * direction, FIRST_LANE_Y + lane * CELL_SPACING_Y, portrait);
}

export function battleCellAt(x, y, portrait) {
    const halfWidth = portrait ? 42 : 40;
    const halfHeight = 24;
    for (let cell = 0; cell < 15; cell++) {
        const center = battleCellCenter('player', cell, portrait);
        if (Math.abs(center.x - x) <= halfWidth && Math.abs(center.y - y) <= halfHeight) return cell;
    }
    return null;
}

export function clientPointToCell(clientX, clientY, rect, portrait) {
    if (rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const size = portrait ? BOARD_SIZE.portrait : BOARD_SIZE.landscape;
    const x = (clientX - rect.left) / rect.width * size.width;
    const y = (clientY - rect.top) / rect.height * size.height;
    return battleCellAt(x, y, portrait);
}
