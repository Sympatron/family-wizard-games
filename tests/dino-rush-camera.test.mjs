import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerCameraSettings} from '../games/dino-rush-battle/runner/camera.js';

function projected(width, height, point) {
    const settings = runnerCameraSettings(width, height);
    const aspect = width / height;
    const tilt = Math.atan2(settings.y - settings.lookY, settings.z - settings.lookZ);
    const differenceY = point.y - settings.y;
    const differenceZ = point.z - settings.z;
    const depth = -differenceY * Math.sin(tilt) - differenceZ * Math.cos(tilt);
    const scale = Math.tan(settings.fov * Math.PI / 360) * depth;
    return {x: point.x / (scale * aspect), y: (differenceY * Math.cos(tilt) - differenceZ * Math.sin(tilt)) / scale};
}
test('camera keeps ranger low and trail dinosaurs visible on phone and desktop screens', () => {
    for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [960, 560], [1920, 1080], [2560, 1080]]) {
        const player = projected(width, height, {x: 0, y: 1.5, z: 8});
        const follower = projected(width, height, {x: 0, y: 1.2, z: 9.4});
        const roadEdge = projected(width, height, {x: 6.5, y: 0, z: 8});
        assert.ok(player.y < -0.5 && player.y > -0.85, 'Player should be in lower portion on ' + width + 'x' + height);
        assert.ok(follower.y > -1 && follower.y < player.y, 'Follower should remain visible behind the ranger');
        assert.ok(roadEdge.x > 0.55 && roadEdge.x < 1.1, 'Road should fill most of the viewport');
    }
});
test('camera supports extreme aspect ratios and rejects invalid dimensions', () => {
    assert.ok(runnerCameraSettings(100, 900).fov >= runnerCameraSettings(1920, 1080).fov);
    assert.throws(() => runnerCameraSettings(0, 900));
});

test('camera stands closer to ranger than previous presets for all tested ratios', () => {
    for (const [width, height] of [[320, 700], [390, 844], [768, 1024], [960, 560], [1920, 1080], [2560, 1080]]) {
        const settings = runnerCameraSettings(width, height);
        assert.ok(settings.z >= 15 && settings.z <= 17, width + 'x' + height);
        assert.ok(settings.z > 10, 'camera should remain behind the followers');
    }
});
