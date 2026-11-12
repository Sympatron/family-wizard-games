import {getMergeChoices} from './game.js';

export function resolveFormationDrop(run, id, target) {
    if (!run || target === null || target === undefined) return null;
    const drop = Number.isInteger(target) ? {cell: target} : target;
    const pool = [...run.army, ...run.inventory];
    const source = pool.find(unit => unit.id === id);
    if (!source) return null;
    const other = drop.unitId ? pool.find(unit => unit.id === drop.unitId)
        : Number.isInteger(drop.cell) ? run.army.find(unit => unit.cell === drop.cell) : null;
    if (other?.id === id) return null;
    const choices = getMergeChoices(source, other);
    if (choices.length) return {type: 'merge-choice', ids: [other.id, id], choices};
    if (drop.reserve) return source.cell === null ? null : {type: 'reserve', payload: {id}};
    if (Number.isInteger(drop.cell) && drop.cell >= 0 && drop.cell < 15) return {type: 'place', payload: {id, cell: drop.cell}};
    return null;
}
