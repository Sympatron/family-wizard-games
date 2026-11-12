export function cageBarLayout() {
    const frame = [], iron = [], latch = [];
    const add = (group, width, height, depth, x, y, z) => group.push({size: [width, height, depth], position: [x, y, z]});
    add(frame, 2.85, 0.3, 2.85, 0, 0.1, 0);
    add(frame, 2.85, 0.26, 2.85, 0, 3.05, 0);
    for (const x of [-1.36, 1.36]) {
        for (const z of [-1.36, 1.36]) add(frame, 0.18, 3.05, 0.18, x, 1.6, z);
    }
    for (const z of [-1.36, 1.36]) {
        for (const x of [-1.01, -0.67, -0.33, 0, 0.33, 0.67, 1.01]) add(iron, 0.065, 2.8, 0.08, x, 1.59, z);
        add(iron, 2.8, 0.09, 0.09, 0, 1.58, z);
    }
    for (const x of [-1.36, 1.36]) {
        for (const z of [-0.82, -0.27, 0.27, 0.82]) add(iron, 0.08, 2.8, 0.065, x, 1.59, z);
    }
    for (const x of [-0.72, 0, 0.72]) add(iron, 0.08, 0.075, 2.85, x, 3.2, 0);
    add(latch, 0.32, 0.4, 0.19, 0.36, 1.53, 1.51);
    return {frame, iron, latch};
}
