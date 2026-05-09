// Чистые геометрические/утилитарные функции игрового мира.
// Модуль — чтобы можно было импортировать и из браузера (через type=module),
// и из Vitest (Node).

export function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function dist(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
}

export function isInsideDiamond(x, y, diamond, margin = 1.0) {
    return Math.abs(x - diamond.cx) / diamond.hw + Math.abs(y - diamond.cy) / diamond.hh <= margin;
}

export function distToSegment(px, py, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = px - a.x, apy = py - a.y;
    const lenSq = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + abx * t, cy = a.y + aby * t;
    return Math.hypot(px - cx, py - cy);
}

export function distToPolyline(x, y, points) {
    let min = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
        const d = distToSegment(x, y, points[i], points[i + 1]);
        if (d < min) min = d;
    }
    return min;
}

export function isOnRect(x, y, rect) {
    return Math.abs(x - rect.x) < rect.w / 2 && Math.abs(y - rect.y) < rect.h / 2;
}

export function isOnAnyBridge(x, y, bridges) {
    for (const b of bridges) {
        if (isOnRect(x, y, b)) return true;
    }
    return false;
}

export function isBlockedBy(x, y, opts) {
    const { riverPoints, riverHalfWidth, bridges, obstacles } = opts;
    if (distToPolyline(x, y, riverPoints) < riverHalfWidth && !isOnAnyBridge(x, y, bridges)) {
        return true;
    }
    for (const o of obstacles) {
        if (dist(x, y, o.x, o.y) < o.r) return true;
    }
    return false;
}
