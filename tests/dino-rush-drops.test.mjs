import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFormationDrop} from '../games/dino-rush-battle/core/drops.js';

const unit = (id, species, cell) => ({id, species, level: 1, cell, hp: 70});
const run = () => ({
    army: [unit('d1', 'raptor', 0), unit('d2', 'triceratops', 1)],
    inventory: [unit('d3', 'raptor', null), unit('d4', 'raptor', null), unit('d5', 'triceratops', null)]
});

test('dropping reserves onto matching reserves offers both evolutions', () => {
    assert.deepEqual(resolveFormationDrop(run(), 'd3', {reserve: true, unitId: 'd4'}),
        {type: 'merge-choice', ids: ['d4', 'd3'], choices: ['allosaurus', 'troodon']});
});
test('merging reserves and deployed dinosaurs works in both directions', () => {
    assert.deepEqual(resolveFormationDrop(run(), 'd3', {cell: 0, unitId: 'd1'}).ids, ['d1', 'd3']);
    assert.deepEqual(resolveFormationDrop(run(), 'd1', {reserve: true, unitId: 'd3'}).ids, ['d3', 'd1']);
});
test('dropping an active dinosaur into the empty reserve area returns it to reserve', () => {
    assert.deepEqual(resolveFormationDrop(run(), 'd1', {reserve: true}), {type: 'reserve', payload: {id: 'd1'}});
    assert.equal(resolveFormationDrop(run(), 'd3', {reserve: true}), null);
});
test('different dinosaurs retain normal swapping and placement', () => {
    assert.deepEqual(resolveFormationDrop(run(), 'd1', {cell: 1, unitId: 'd2'}),
        {type: 'place', payload: {id: 'd1', cell: 1}});
    assert.deepEqual(resolveFormationDrop(run(), 'd3', {cell: 8}), {type: 'place', payload: {id: 'd3', cell: 8}});
    assert.deepEqual(resolveFormationDrop(run(), 'd1', {reserve: true, unitId: 'd5'}),
        {type: 'reserve', payload: {id: 'd1'}});
    assert.equal(resolveFormationDrop(run(), 'd1', {cell: 0, unitId: 'd1'}), null);
});
