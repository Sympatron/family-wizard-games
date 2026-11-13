function seededRandom(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function noise(x, y, scale, seed) {
    const sx = x / scale, sy = y / scale;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    const fx = sx - ix, fy = sy - iy;
    const smoothX = fx * fx * (3 - 2 * fx), smoothY = fy * fy * (3 - 2 * fy);
    const hash = (a, b) => {
        let value = Math.imul(a + seed * 1013, 374761393) + Math.imul(b - seed * 97, 668265263);
        value = Math.imul(value ^ value >>> 13, 1274126177);
        return ((value ^ value >>> 16) >>> 0) / 4294967295;
    };
    const top = hash(ix, iy) * (1 - smoothX) + hash(ix + 1, iy) * smoothX;
    const bottom = hash(ix, iy + 1) * (1 - smoothX) + hash(ix + 1, iy + 1) * smoothX;
    return top * (1 - smoothY) + bottom * smoothY;
}

export function drawBattlefield(ctx, width = 960, height = 620) {
    const image = ctx.createImageData(width, height);
    const pixels = image.data;
    for (let y = 0; y < height; y++) {
        const distance = y / height;
        const clearing = 0.18 * width + distance * 0.26 * width;
        for (let x = 0; x < width; x++) {
            const large = noise(x, y, 132, 4), patches = noise(x, y, 42, 19), grain = noise(x, y, 9, 37);
            const ground = (large - 0.5) * 46 + (patches - 0.5) * 37 + (grain - 0.5) * 22;
            const feather = Math.max(0, Math.min(1, (clearing + 28 - Math.abs(x - width * 0.5)) / 66));
            const bare = feather * (0.27 + 0.42 * Math.max(0, patches - 0.42));
            const shade = 0.84 + distance * 0.18;
            const i = (y * width + x) * 4;
            pixels[i] = Math.min(255, (48 + ground + bare * 85) * shade);
            pixels[i + 1] = Math.min(255, (89 + ground * 0.8 + bare * 55) * shade);
            pixels[i + 2] = Math.min(255, (58 + ground * 0.55 + bare * 16) * shade);
            pixels[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
    const random = seededRandom(4137);
    const scatter = (count, draw) => {
        for (let index = 0; index < count; index++) {
            const x = random() * width, y = random() * height;
            const perspective = (0.64 + 0.75 * y / height) * width / 960;
            draw(x, y, perspective);
        }
    };
    const color = (r, g, b, alpha = 1) => 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    scatter(320, (x, y, scale) => {
        const size = (3 + random() * 8) * scale;
        ctx.fillStyle = color(22, 52, 32, 0.2 + random() * 0.24);
        ctx.beginPath();
        ctx.ellipse(x + size * 0.36, y + size * 0.5, size * 1.4, size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color(137, 131, 94, 0.22 + random() * 0.2);
        ctx.beginPath();
        ctx.ellipse(x, y, size, size * 0.48, random(), 0, Math.PI * 2);
        ctx.fill();
    });
    const rock = (x, y, scale) => {
        const radius = (9 + random() * 24) * scale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(random() * 6.283);
        ctx.fillStyle = color(12, 30, 26, 0.48);
        ctx.beginPath();
        ctx.ellipse(radius * 0.35, radius * 0.65, radius * 1.3, radius * 0.68, -0.3, 0, Math.PI * 2);
        ctx.fill();
        for (const [shade, offset, factor] of [[color(41, 58, 49), 0.18, 1], [color(89, 99, 79), -0.16, 0.79], [color(139, 134, 101), -0.27, 0.48]]) {
            ctx.fillStyle = shade;
            ctx.beginPath();
            for (let index = 0; index < 8; index++) {
                const angle = index / 8 * Math.PI * 2;
                const r = radius * factor * (0.86 + noise(index * 14, y, 9, 15) * 0.3);
                const px = Math.cos(angle) * r, py = Math.sin(angle) * r * 0.57 + radius * offset;
                if (!index) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    };
    scatter(70, (x, y, scale) => {
        if (Math.abs(x - width / 2) > width * (0.27 + y / height * 0.2) || random() > 0.91) rock(x, y, scale);
    });
    const leaf = (x, y, angle, length, shade) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-length * 0.31, -length * 0.26, -length * 0.14, -length);
        ctx.quadraticCurveTo(length * 0.22, -length * 0.44, 0, 0);
        ctx.fillStyle = shade;
        ctx.fill();
        ctx.restore();
    };
    const fern = (x, y, scale) => {
        const size = (12 + random() * 24) * scale;
        ctx.fillStyle = color(13, 38, 29, 0.42);
        ctx.beginPath();
        ctx.ellipse(x + size * 0.3, y + size * 0.33, size * 0.85, size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let part = 0; part < 8; part++) {
            const angle = part * Math.PI / 4 + random() * 0.3;
            leaf(x, y, angle, size * (0.78 + random() * 0.56), ['#2d6840', '#55834c', '#376343', '#719457'][part % 4]);
        }
        ctx.fillStyle = '#87a069';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.5, 2.2 * scale), 0, Math.PI * 2);
        ctx.fill();
    };
    scatter(215, (x, y, scale) => {
        if (Math.abs(x - width / 2) > width * (0.24 + y / height * 0.21) || random() > 0.85) fern(x, y, scale);
    });
    scatter(760, (x, y, scale) => {
        const length = (2 + random() * 7) * scale;
        ctx.strokeStyle = random() > 0.45 ? color(29, 77, 39, 0.46) : color(150, 155, 89, 0.4);
        ctx.lineWidth = Math.max(0.6, 0.7 * scale);
        ctx.beginPath();
        ctx.moveTo(x - length * 0.45, y + length * 0.2);
        ctx.lineTo(x, y - length);
        ctx.lineTo(x + length * 0.3, y + length * 0.1);
        ctx.stroke();
    });
}
