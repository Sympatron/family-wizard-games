let THREE;
try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js');
} catch {
    THREE = await import('https://unpkg.com/three@0.187.0/build/three.module.js');
}
import {SPECIES as DINOSAURS} from '../core/game.js';
import {createGatePair, gateLabel, improveGate, applyGate, selectCrossedGate} from './gates.js';
import {createRanger} from './ranger.js';
import {runnerCameraSettings} from './camera.js';
import {createRunnerWave} from './spawns.js';
import {bulletHitsCage} from './collision.js';
import {finishLinePosition, canSpawnBeforeGoal} from './goal.js';
import {createHitSound} from '../core/hit-sound.js';
import {createRunnerNotice} from './notices.js';
import {makeCoinWave, crossedCoin} from './coins.js';
import {createRunnerClock} from './clock.js';
import {cageBarLayout} from './cage-layout.js';
import {volleyPattern, initialRunnerWeaponStats} from './shots.js';

const DURATION = 35;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function startRunner(host, {stage, upgrades = {}, roster = [], onProgress, onFinish, onPauseChange = () => {}}) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x142734);
    scene.fog = new THREE.Fog(0x142734, 85, 260);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 340);
    const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(pointer:coarse)').matches ? 1.5 : 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    host.replaceChildren(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd6f7ff, 0x354b39, 2.2));
    const sunlight = new THREE.DirectionalLight(0xffe6bd, 2.2);
    sunlight.position.set(-8, 18, 5);
    scene.add(sunlight);
    const material = color => new THREE.MeshStandardMaterial({color, roughness: 0.75});
    function box(width, height, depth, color, x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
        mesh.position.set(x, y, z);
        scene.add(mesh);
        return mesh;
    }
    function dinosaur(species, color, caged = false) {
        const result = new THREE.Group();
        const def = DINOSAURS[species];
        const skin = material(color);
        const dark = material(new THREE.Color(color).multiplyScalar(0.62));
        const belly = material(0xdcc7a6);
        const eyes = material(0xf5ae50);
        const pupil = material(0x13212c);
        const teeth = material(0xfff0d7);
        const wings = ['pteranodon', 'quetzalcoatlus', 'tapejara', 'hatzegopteryx', 'arambourgiania', 'tupandactylus',
            'caiuajara', 'thanatosdrakon', 'thalassodromeus'].includes(species);
        const armored = def.role === 'Tank';
        function piece(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
            const mesh = new THREE.Mesh(geometry, mat);
            mesh.position.set(x, y, z);
            mesh.scale.set(sx, sy, sz);
            result.add(mesh);
            return mesh;
        }
        const sphere = (radius, mat, x, y, z, sx = 1, sy = 1, sz = 1) =>
            piece(new THREE.SphereGeometry(radius, 12, 8), mat, x, y, z, sx, sy, sz);
        sphere(0.78, skin, 0, 1.28, 0.12, armored ? 1.2 : 1, 0.84, 1.32);
        sphere(0.52, skin, 0, 1.97, -0.76, 1.12, 0.94, 1);
        sphere(0.36, belly, 0, 1.73, -1.18, 1.05, 0.36, 1.05);
        const jaw = sphere(0.39, dark, 0, 1.68, -1.23, 1.13, 0.27, 0.9);
        for (const side of [-1, 1]) {
            sphere(0.15, dark, side * 0.42, 2.1, -1.1);
            sphere(0.095, eyes, side * 0.45, 2.14, -1.2);
            sphere(0.048, pupil, side * 0.47, 2.14, -1.28);
            const brow = sphere(0.2, dark, side * 0.45, 2.28, -1.12, 1.3, 0.35, 0.85);
            brow.rotation.z = side * -0.24;
            const leg = piece(new THREE.CylinderGeometry(0.19, 0.29, 0.98, 7), skin, side * 0.48, 0.55, 0.34);
            (result.userData.legs ??= []).push(leg);
            sphere(0.27, dark, side * 0.5, 0.14, -0.16, 0.8, 0.4, 1.5);
            for (let claw = 0; claw < 3; claw++) {
                const nail = piece(new THREE.ConeGeometry(0.055, 0.3, 5), teeth, side * (0.33 + claw * 0.16), 0.07, -0.5);
                nail.rotation.x = -Math.PI / 2;
            }
            sphere(0.19, skin, side * 0.66, 1.42, -0.58, 0.8, 1.2, 0.68);
            for (let tooth = 0; tooth < 4; tooth++) {
                const fang = piece(new THREE.ConeGeometry(0.048, 0.19, 5), teeth, side * (0.17 + tooth * 0.1), 1.6, -1.48 + tooth * 0.025);
                fang.rotation.z = Math.PI;
            }
        }
        const tail = piece(new THREE.ConeGeometry(0.44, 2.4, 9), skin, 0, 1.32, 1.55);
        tail.rotation.x = Math.PI / 2;
        if (armored) {
            for (let i = 0; i < 5; i++) {
                for (const side of [-1, 1]) {
                    const plate = piece(new THREE.ConeGeometry(0.22, 0.62, 5), dark, side * 0.43, 2.02, -0.2 + i * 0.43);
                    plate.rotation.z = side * 0.18;
                }
            }
            if (species.includes('triceratops') || species.includes('kentrosaurus')) {
                for (const side of [-1, 1]) {
                    const horn = piece(new THREE.ConeGeometry(0.15, 0.93, 7), teeth, side * 0.38, 2.44, -1.0);
                    horn.rotation.x = -0.4;
                }
                sphere(0.65, dark, 0, 2.12, -0.42, 1.34, 0.75, 0.35);
            }
            if (def.trait === 'armor' || def.trait === 'reflect') sphere(0.42, dark, 0, 1.12, 2.38);
        } else if (wings) {
            for (const side of [-1, 1]) {
                const wing = piece(new THREE.ConeGeometry(caged ? 0.46 : 0.9, caged ? 1.4 : 2.7, 4),
                    dark, side * (caged ? 0.62 : 1.08), 1.78, 0.13);
                wing.rotation.z = side * Math.PI / 2;
                const claw = piece(new THREE.ConeGeometry(0.13, 0.6, 6), teeth, side * (caged ? 0.95 : 1.48), 1.88, -0.5);
                claw.rotation.x = -0.55;
            }
            const beak = piece(new THREE.ConeGeometry(0.25, 1.12, 5), belly, 0, 1.81, -1.46);
            beak.rotation.x = -Math.PI / 2;
            piece(new THREE.ConeGeometry(0.25, 0.9, 6), dark, 0, 2.36, -0.48).rotation.x = -0.5;
        } else {
            for (let i = 0; i < 5; i++) {
                const spike = piece(new THREE.ConeGeometry(0.16 + i * 0.012, 0.5 + i * 0.06, 6), dark, 0, 2.05, 0.04 + i * 0.43);
                spike.rotation.x = -0.18;
            }
            for (const side of [-1, 1]) {
                piece(new THREE.ConeGeometry(0.12, 0.52, 6), dark, side * 0.5, 2.47, -0.6).rotation.z = side * 0.4;
            }
        }
        result.userData.skin = skin;
        result.scale.setScalar(def.rank >= 3 ? 1.12 : 1);
        return result;
    }
    box(13, 0.2, 540, 0x395a46, 0, -0.18, -240);
    box(0.3, 0.8, 540, 0x86b177, -6.65, 0.3, -240);
    box(0.3, 0.8, 540, 0x86b177, 6.65, 0.3, -240);
    const markings = Array.from({length: 40}, (_, i) => box(0.18, 0.02, 3.8, 0xb5d4a1, 0, 0.01, 12 - i * 8));
    const scenery = [];
    for (let i = 0; i < 84; i++) {
        const decoration = new THREE.Group();
        const side = i % 2 ? 1 : -1;
        const x = side * (8.4 + (i % 4) * 2.2);
        const z = 16 - Math.floor(i / 2) * 7;
        if (i % 5 === 0) {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + i % 3 * 0.3), material(0x7f9991));
            rock.scale.y = 0.6;
            rock.position.y = 0.6;
            decoration.add(rock);
        } else {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.6, 6), material(0x806044));
            trunk.position.y = 1.3;
            const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.3 + i % 3 * 0.18, 3.8, 7), material(i % 3 ? 0x3e865d : 0x569a68));
            leaves.position.y = 4.2;
            decoration.add(trunk, leaves);
        }
        decoration.position.set(x, 0, z);
        scene.add(decoration);
        scenery.push(decoration);
    }
    const player = createRanger(THREE);
    scene.add(player);
    player.position.set(0, 0, 8);

    const objects = [];
    const bullets = [];
    const particles = [];
    const damageLabels = [];
    const hitSound = createHitSound();
    const notices = createRunnerNotice();
    const collected = [];
    const followers = [];
    const followerOffsets = [-1.5, 1.5, -3.1, 0, 3.1];
    function collectDinosaur(species, level = 1) {
        collected.push({species, level});
        notices.show(DINOSAURS[species].name + ' befreit!');
        if (followers.length >= 15) return;
        const follower = dinosaur(species, DINOSAURS[species].color);
        follower.scale.setScalar(DINOSAURS[species].rank > 1 ? 0.62 : 0.56);
        follower.position.set(player.position.x, 0, 9.4);
        scene.add(follower);
        followers.push(follower);
    }
    const temporary = initialRunnerWeaponStats(upgrades);
    let remaining = DURATION;
    let elapsed = 0;
    let playerHp = 3;
    let shots = 0;
    let kills = 0;
    let runnerCoins = 0;
    let spawnCount = 0;
    let nextSpawn = 0.5;
    let nextCoinWave = 1.1;
    let nextGate = 4.2;
    let gateCount = 0;
    let shotTimer = 0;
    let reportTimer = 0;
    let targetX = 0;
    let active = true;
    let dragging = false;
    let frame = 0;
    const clock = createRunnerClock();
    const keys = new Set();
    let hurtFlash = 0;

    function gateText(text, y, width, height, fontSize, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.font = '900 ' + fontSize + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 13;
        ctx.strokeStyle = '#17252b';
        ctx.strokeText(text, 512, 136, 970);
        ctx.fillStyle = color;
        ctx.fillText(text, 512, 136, 970);
        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: texture, transparent: true}));
        sprite.scale.set(width, height, 1);
        sprite.position.set(0, y, 0.35);
        return sprite;
    }
    function updateGate(obj) {
        const positive = obj.level > 0;
        const color = positive ? 0x5bc8c0 : obj.level < 0 ? 0xe57366 : 0xd5c774;
        obj.mesh.material.color.setHex(color);
        obj.header.material.color.setHex(positive ? 0x256d68 : obj.level < 0 ? 0x873c35 : 0x777044);
        if (obj.label) {
            obj.group.remove(obj.label);
            obj.label.traverse(node => {
                node.material?.map?.dispose();
                node.material?.dispose();
            });
        }
        const [type, value] = gateLabel(obj).split(' ');
        const label = new THREE.Group();
        label.add(gateText(type, 4.55, 5.8, 0.8, 126, '#ffffff'));
        label.add(gateText(value, 2.15, 5.75, 2.55, 210, '#fff3a0'));
        obj.label = label;
        obj.group.add(label);
    }
    function spawnGatePair(goalZ) {
        if (!canSpawnBeforeGoal(-80, goalZ, 6)) return;
        const pairId = gateCount++;
        for (const [index, definition] of createGatePair(stage, pairId).entries()) {
            const x = index === 0 ? -3.2 : 3.2;
            const group = new THREE.Group();
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 4.1), new THREE.MeshBasicMaterial({
                color: 0xffffff, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide
            }));
            mesh.position.y = 2.05;
            group.add(mesh);
            const header = new THREE.Mesh(new THREE.BoxGeometry(6.12, 0.95, 0.42), material(0x647d79));
            header.position.y = 4.55;
            group.add(header);
            for (const side of [-1, 1]) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 4.1, 0.2), material(0xaac7bf));
                post.position.set(side * 3.03, 2.05, 0.04);
                group.add(post);
            }
            group.position.set(x, 0, -80);
            scene.add(group);
            const obj = {...definition, kind: 'gate', pairId, x, z: -80, charge: 0, mesh, header, group, label: null};
            updateGate(obj);
            objects.push(obj);
        }
    }
    function cage(species, rarity = 'common') {
        const group = new THREE.Group();
        const creature = dinosaur(species, DINOSAURS[species].color, true);
        creature.scale.setScalar(DINOSAURS[species].rank > 1 ? 0.82 : 0.84);
        creature.rotation.y = Math.PI;
        group.add(creature);
        const barLayout = cageBarLayout();
        const batches = [
            [barLayout.frame, material(rarity === 'rare' ? 0xae7938 : rarity === 'reinforced' ? 0x4f6974 : 0x6a5843)],
            [barLayout.iron, new THREE.MeshStandardMaterial({color: rarity === 'rare' ? 0xecc56a : 0xc3d2cd, metalness: 0.65, roughness: 0.35})],
            [barLayout.latch, new THREE.MeshStandardMaterial({color: 0xf1d277, metalness: 0.55, roughness: 0.3})]
        ];
        const dummy = new THREE.Object3D();
        for (const [bars, mat] of batches) {
            const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, bars.length);
            for (const [index, bar] of bars.entries()) {
                dummy.position.set(...bar.position);
                dummy.scale.set(...bar.size);
                dummy.updateMatrix();
                mesh.setMatrixAt(index, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
            group.add(mesh);
        }
        const background = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.37, 0.1),
            new THREE.MeshBasicMaterial({color: 0x14252c, depthTest: false}));
        background.position.set(0, 3.72, 1.38);
        background.renderOrder = 4;
        const healthFill = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.22, 0.13),
            new THREE.MeshBasicMaterial({color: 0x65e59b, depthTest: false}));
        healthFill.position.set(0, 3.72, 1.47);
        healthFill.renderOrder = 5;
        group.add(background, healthFill);
        group.userData.healthFill = healthFill;
        return group;
    }
    function spawnWave(goalZ) {
        for (const item of createRunnerWave(spawnCount++, stage, Math.random, roster)) {
            if (!canSpawnBeforeGoal(item.z, goalZ, 5)) continue;
            const group = cage(item.species, item.rarity);
            group.position.set(item.x, 0, item.z);
            scene.add(group);
            objects.push({kind: 'cage', x: item.x, z: item.z, species: item.species, level: item.level,
                rarity: item.rarity, hp: item.hp, maxHp: item.hp, hitFlash: 0, group});
        }
    }
    function spawnCoinWave(goalZ) {
        for (const item of makeCoinWave()) {
            if (!canSpawnBeforeGoal(item.z, goalZ, 3)) continue;
            const group = new THREE.Group();
            const metal = new THREE.MeshStandardMaterial({
                color: item.value === 10 ? 0xffcd46 : item.value === 5 ? 0xc4e0ee : 0xc98b50,
                metalness: 0.75, roughness: 0.25
            });
            const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.14, 18), metal);
            coin.rotation.x = Math.PI / 2;
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.075, 6, 20), metal);
            group.add(coin, rim);
            const text = gateText(String(item.value), 0, 0.8, 0.6, 188, '#25323a');
            text.position.z = 0.18;
            group.add(text);
            group.position.set(item.x, 1.55, item.z);
            scene.add(group);
            objects.push({...item, group});
        }
    }
    function floatDamage(x, y, z, amount) {
        const sprite = gateText('−' + Math.max(1, Math.round(amount)), 0, 1.8, 0.85, 210, '#ffad93');
        sprite.position.set(x, y, z);
        scene.add(sprite);
        damageLabels.push({sprite, remaining: 0.8});
    }
    function createFinishGoal() {
        const group = new THREE.Group();
        const gold = material(0xf1cb76);
        const dark = material(0x263a40);
        const post = (width, height, depth, x, y, z, mat = gold) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
            mesh.position.set(x, y, z);
            group.add(mesh);
            return mesh;
        };
        for (const x of [-6.3, 6.3]) {
            post(0.5, 5.9, 0.6, x, 2.95, 0);
            post(0.72, 0.72, 0.72, x, 5.7, 0, dark);
        }
        post(13, 0.6, 0.65, 0, 5.85, 0);
        const sign = gateText('ZIEL', 5.85, 6, 1.4, 190, '#ffffff');
        sign.position.z = 0.5;
        group.add(sign);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.045, 0.9), material(0xffffff));
        stripe.position.set(0, 0.015, 0);
        group.add(stripe);
        const mark = material(0x182c35);
        for (let i = 0; i < 10; i++) {
            post(1.25, 0.05, 0.9, -5.625 + i * 1.25, 0.045, 0, i % 2 ? gold : mark);
        }
        scene.add(group);
        return group;
    }
    const finishGoal = createFinishGoal();
    function disposeGroup(group) {
        scene.remove(group);
        group.traverse(node => {
            node.geometry?.dispose();
            const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
            for (const m of materials) {
                m.map?.dispose();
                m.dispose();
            }
        });
    }
    function removeObject(obj) {
        const i = objects.indexOf(obj);
        if (i < 0) return;
        objects.splice(i, 1);
        disposeGroup(obj.group);
    }
    function shoot() {
        const volley = volleyPattern(Math.min(5, temporary.bullets), temporary.damage);
        for (const shot of volley) {
            const x = player.position.x + shot.offset;
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), material(0xffef9c));
            mesh.position.set(x, 1.5, 6);
            scene.add(mesh);
            bullets.push({mesh, x, z: 6, spread: shot.spread, damage: shot.damage});
        }
        shots++;
        hitSound.hit('shot');
    }
    function burst(x, y, z, kind = 'impact') {
        const color = kind === 'break' ? 0x7ee6ac : kind === 'upgrade' ? 0x70cfff : 0xffd389;
        for (let i = 0; i < (kind === 'break' ? 12 : 7); i++) {
            const mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.07 + Math.random() * 0.09),
                new THREE.MeshBasicMaterial({color, transparent: true, opacity: 1, depthWrite: false}));
            mesh.position.set(x + (Math.random() - 0.5) * 0.7, y + Math.random() * 0.5, z);
            scene.add(mesh);
            particles.push({mesh, life: 0.35, vx: (Math.random() - 0.5) * 8, vy: 2 + Math.random() * 4, vz: (Math.random() - 0.5) * 6});
        }
    }
    function collectGate(obj) {
        const previous = temporary[obj.modifier];
        Object.assign(temporary, applyGate(temporary, obj));
        const current = temporary[obj.modifier];
        notices.show(gateLabel(obj) + ': ' + previous.toFixed(2) + ' → ' + current.toFixed(2));
        burst(obj.x, 2.3, player.position.z, 'upgrade');
        hitSound.hit('upgrade');
    }
    function collideBullet(bullet, previousZ) {
        for (const obj of objects) {
            if (obj.kind === 'coin') continue;
            const hit = obj.kind === 'gate'
                ? Math.abs(bullet.x - obj.x) <= 3.05 && bullet.z <= obj.z + 0.35 && previousZ >= obj.z - 0.35
                : bulletHitsCage(bullet.x, previousZ, bullet.z, obj.x, obj.z);
            if (!hit) continue;
            burst(bullet.x, obj.kind === 'gate' ? 2 : 2.5, obj.z, 'impact');
            hitSound.hit('impact');
            if (obj.kind === 'gate') {
                obj.charge++;
                if (obj.charge >= 2) {
                    obj.charge = 0;
                    Object.assign(obj, improveGate(obj));
                    updateGate(obj);
                }
            } else {
                const dealt = Math.min(Math.max(0, obj.hp), bullet.damage);
                obj.hp -= bullet.damage;
                obj.hitFlash = 0.18;
                floatDamage(obj.x, 3.7, obj.z, dealt);
                const fraction = Math.max(0, obj.hp / obj.maxHp);
                const fill = obj.group.userData.healthFill;
                fill.scale.x = Math.max(0.001, fraction);
                fill.position.x = -2.45 * (1 - fraction) / 2;
                fill.material.color.setHex(fraction > 0.5 ? 0x65e59b : 0xffc16b);
                if (obj.hp <= 0) {
                    burst(obj.x, 2.1, obj.z, 'break');
                    hitSound.hit('break');
                    collectDinosaur(obj.species, obj.level);
                    removeObject(obj);
                }
            }
            return true;
        }
        return false;
    }
    function finish() {
        if (!active) return;
        active = false;
        destroy();
        onFinish({collected, temporary, kills, shots, coins: runnerCoins});
    }
    function animate(time) {
        if (!active) return;
        const dt = clock.tick(time);
        if (clock.paused) {
            frame = requestAnimationFrame(animate);
            return;
        }
        elapsed += dt;
        remaining = Math.max(0, DURATION - elapsed);
        notices.tick(dt);
        if (keys.has('ArrowLeft') || keys.has('KeyA')) targetX -= dt * 8;
        if (keys.has('ArrowRight') || keys.has('KeyD')) targetX += dt * 8;
        targetX = clamp(targetX, -5.15, 5.15);
        player.position.x = THREE.MathUtils.damp(player.position.x, targetX, 14, dt);
        player.rotation.z = (player.position.x - targetX) * 0.07;
        player.position.y = Math.sin(elapsed * 13) * 0.05;
        for (const [index, leg] of player.userData.legs.entries()) leg.rotation.x = Math.sin(elapsed * 13 + index * Math.PI) * 0.25;
        for (const [index, follower] of followers.entries()) {
            const row = Math.floor(index / followerOffsets.length);
            const x = clamp(player.position.x + followerOffsets[index % followerOffsets.length], -5.5, 5.5);
            follower.position.x = THREE.MathUtils.damp(follower.position.x, x, 4 / (1 + row * 0.3), dt);
            follower.position.z = player.position.z + 1.4 + row * 1.15;
            follower.position.y = Math.sin(elapsed * 7 + index) * 0.04;
            for (const [legIndex, leg] of follower.userData.legs.entries()) leg.rotation.x = Math.sin(elapsed * 7 + legIndex * Math.PI + index) * 0.18;
        }
        hurtFlash = Math.max(0, hurtFlash - dt);
        player.userData.skin.color.setHex(hurtFlash > 0 ? 0xffffff : 0x47644b);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, player.position.x * 0.25, 2.5, dt);
        camera.lookAt(camera.position.x * 0.4, 1.5, -20);
        shotTimer -= dt;
        if (shotTimer <= 0) {
            shoot();
            shotTimer += 0.28 / temporary.fireRate;
        }
        const speed = 17 + Math.min(stage, 12) * 0.6;
        finishGoal.position.z = finishLinePosition(player.position.z, speed, remaining);
        if (remaining > 0 && elapsed >= nextSpawn) {
            spawnWave(finishGoal.position.z);
            nextSpawn += 3.7;
        }
        if (remaining > 0 && elapsed >= nextGate) {
            spawnGatePair(finishGoal.position.z);
            nextGate += 9.8;
        }
        if (remaining > 0 && elapsed >= nextCoinWave) {
            spawnCoinWave(finishGoal.position.z);
            nextCoinWave += 2.2;
        }
        for (const marking of markings) {
            marking.position.z += speed * dt;
            if (marking.position.z > 20) marking.position.z -= 320;
            marking.visible = marking.position.z >= finishGoal.position.z + 1;
        }
        for (const decoration of scenery) {
            decoration.position.z += speed * dt;
            if (decoration.position.z > 22) decoration.position.z -= 294;
            decoration.visible = decoration.position.z >= finishGoal.position.z + 1;
        }
        for (const obj of [...objects]) {
            if (!objects.includes(obj)) continue;
            const previousZ = obj.z;
            obj.z += speed * dt;
            obj.group.position.z = obj.z;
            if (obj.kind === 'coin') {
                obj.group.rotation.y += dt * 2.5;
                if (crossedCoin(player.position.x, player.position.z, previousZ, obj.z, obj.x)) {
                    runnerCoins += obj.value;
                    hitSound.hit('coin');
                    notices.show('+' + obj.value + ' Münzen');
                    burst(obj.x, 1.7, obj.z, 'upgrade');
                    removeObject(obj);
                } else if (obj.z > player.position.z + 2) removeObject(obj);
                continue;
            }
            if (obj.kind === 'gate') {
                if (previousZ <= player.position.z && obj.z >= player.position.z) {
                    const pair = objects.filter(gate => gate.kind === 'gate' && gate.pairId === obj.pairId);
                    const selected = selectCrossedGate(pair, player.position.x, previousZ, obj.z, player.position.z);
                    if (selected) collectGate(selected);
                    for (const gate of pair) removeObject(gate);
                }
                continue;
            }
            obj.hitFlash = Math.max(0, obj.hitFlash - dt);
            obj.group.scale.setScalar(obj.hitFlash > 0 ? 1.06 : 1);
            if (obj.z > player.position.z + 2) removeObject(obj);
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const oldZ = bullet.z;
            bullet.z -= 48 * dt;
            bullet.x += bullet.spread * 48 * dt;
            bullet.mesh.position.set(bullet.x, 1.5, bullet.z);
            if (bullet.z < -125 || collideBullet(bullet, oldZ)) {
                bullets.splice(i, 1);
                scene.remove(bullet.mesh);
                bullet.mesh.geometry.dispose();
                bullet.mesh.material.dispose();
            }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            particle.life -= dt;
            if (particle.life <= 0) {
                scene.remove(particle.mesh);
                particle.mesh.geometry.dispose();
                particle.mesh.material.dispose();
                particles.splice(i, 1);
            } else {
                particle.mesh.position.x += particle.vx * dt;
                particle.mesh.position.y += particle.vy * dt;
                particle.mesh.position.z += particle.vz * dt;
                particle.vy -= 15 * dt;
                particle.mesh.material.opacity = Math.min(1, particle.life / 0.25);
            }
        }
        for (let i = damageLabels.length - 1; i >= 0; i--) {
            const label = damageLabels[i];
            label.remaining -= dt;
            label.sprite.position.y += 1.7 * dt;
            label.sprite.material.opacity = Math.max(0, label.remaining / 0.8);
            if (label.remaining <= 0) {
                scene.remove(label.sprite);
                label.sprite.material.map?.dispose();
                label.sprite.material.dispose();
                damageLabels.splice(i, 1);
            }
        }
        reportTimer -= dt;
        if (reportTimer <= 0) {
            onProgress({seconds: Math.ceil(remaining), collected: collected.length, coins: runnerCoins, hp: Math.max(0, playerHp), temporary, notice: notices.text});
            reportTimer = 0.25;
        }
        renderer.render(scene, camera);
        if (playerHp <= 0 || remaining <= 0) finish();
        else frame = requestAnimationFrame(animate);
    }
    function setPointer(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        targetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 12, -5.15, 5.15);
    }
    function pointerDown(event) {
        if (clock.paused) return;
        hitSound.unlock();
        dragging = true;
        renderer.domElement.setPointerCapture(event.pointerId);
        setPointer(event);
    }
    function pointerMove(event) {
        if (dragging && !clock.paused) setPointer(event);
    }
    function pointerUp() { dragging = false; }
    function setPaused(paused) {
        if (!active || clock.paused === paused) return;
        if (paused) clock.pause();
        else clock.resume();
        onPauseChange(paused);
    }
    function togglePause() { setPaused(!clock.paused); }
    function visibilityChange() {
        if (document.hidden) setPaused(true);
    }
    function keyDown(event) {
        hitSound.unlock();
        if (event.code === 'KeyP' && !event.repeat) {
            event.preventDefault();
            togglePause();
            return;
        }
        if (clock.paused) return;
        if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
            event.preventDefault();
            keys.add(event.code);
        }
    }
    function keyUp(event) { keys.delete(event.code); }
    function resize() {
        const width = host.clientWidth, height = host.clientHeight;
        if (!width || !height) return;
        const settings = runnerCameraSettings(width, height);
        camera.aspect = width / height;
        camera.fov = settings.fov;
        camera.far = settings.far;
        camera.position.y = settings.y;
        camera.position.z = settings.z;
        camera.lookAt(camera.position.x * 0.4, settings.lookY, settings.lookZ);
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointercancel', pointerUp);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    document.addEventListener('visibilitychange', visibilityChange);
    if (document.hidden) setPaused(true);
    frame = requestAnimationFrame(animate);
    function destroy() {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        hitSound.dispose();
        renderer.domElement.removeEventListener('pointerdown', pointerDown);
        renderer.domElement.removeEventListener('pointermove', pointerMove);
        renderer.domElement.removeEventListener('pointerup', pointerUp);
        renderer.domElement.removeEventListener('pointercancel', pointerUp);
        window.removeEventListener('keydown', keyDown);
        window.removeEventListener('keyup', keyUp);
        document.removeEventListener('visibilitychange', visibilityChange);
        for (const obj of [...objects]) removeObject(obj);
        for (const bullet of bullets) {
            scene.remove(bullet.mesh);
            bullet.mesh.geometry.dispose();
            bullet.mesh.material.dispose();
        }
        scene.traverse(node => {
            node.geometry?.dispose();
            const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
            for (const m of materials) {
                m.map?.dispose();
                m.dispose();
            }
        });
        renderer.forceContextLoss();
        renderer.dispose();
        renderer.domElement.remove();
    }
    return {
        destroy: () => { if (active) { active = false; destroy(); } },
        pause: () => setPaused(true),
        resume: () => setPaused(false),
        togglePause,
        get paused() { return clock.paused; }
    };
}
