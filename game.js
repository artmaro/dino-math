// ============================================
// Анкилозавр и сундуки с задачками
// Phaser 3 версия
// ============================================

'use strict';

// ===== Константы =====
const VIEWPORT = { w: 1280, h: 720 };
const CAMERA_ZOOM = 0.95; // лёгкое отдаление для большего обзора

// Сдвиг исходных координат, чтобы вокруг ромба была "поляна" 300px шириной для леса-границы
const SHIFT_X = 300;
const SHIFT_Y = 300;

const WORLD = {
    w: 1800 + SHIFT_X * 2,    // 2400
    h: 1100 + SHIFT_Y * 2,    // 1700
    diamond: { cx: 900 + SHIFT_X, cy: 550 + SHIFT_Y, hw: 850, hh: 425 },
    cave:    { x: 900 + SHIFT_X, y: 165 + SHIFT_Y },
    start:   { x: 900 + SHIFT_X, y: 935 + SHIFT_Y }
};

const RIVER_POINTS = [
    { x:  60 + SHIFT_X, y: 380 + SHIFT_Y },
    { x: 280 + SHIFT_X, y: 340 + SHIFT_Y },
    { x: 500 + SHIFT_X, y: 510 + SHIFT_Y },
    { x: 800 + SHIFT_X, y: 580 + SHIFT_Y },
    { x: 1100 + SHIFT_X, y: 480 + SHIFT_Y },
    { x: 1380 + SHIFT_X, y: 600 + SHIFT_Y },
    { x: 1640 + SHIFT_X, y: 720 + SHIFT_Y },
    { x: 1760 + SHIFT_X, y: 760 + SHIFT_Y }
];
const RIVER_HALF_WIDTH = 36;

// Мосты — позиции на середине соответствующих сегментов реки.
// Угол вычисляется в момент отрисовки от тангенса реки (см. drawBridges).
const BRIDGES = [
    { x: (280 + 500) / 2 + SHIFT_X, y: (340 + 510) / 2 + SHIFT_Y, w: 110, h: 110 },
    { x: (1100 + 1380) / 2 + SHIFT_X, y: (480 + 600) / 2 + SHIFT_Y, w: 110, h: 110 }
];

const OBSTACLES = [
    { type: 'boulder', x: 290 + SHIFT_X, y: 700 + SHIFT_Y, r: 42 },
    { type: 'boulder', x: 1480 + SHIFT_X, y: 360 + SHIFT_Y, r: 38 },
    { type: 'log',     x: 700 + SHIFT_X, y: 280 + SHIFT_Y, r: 50, angle: -15 },
    { type: 'log',     x: 1180 + SHIFT_X, y: 820 + SHIFT_Y, r: 50, angle: 25 }
];

const TOTAL_CHESTS = 10;

const QUESTIONS = [
    { question: "2 + 3 = ?", correctAnswer: 5, options: [4, 5, 6] },
    { question: "5 + 2 = ?", correctAnswer: 7, options: [6, 7, 9] },
    { question: "7 - 4 = ?", correctAnswer: 3, options: [2, 3, 5] },
    { question: "9 - 3 = ?", correctAnswer: 6, options: [5, 6, 8] },
    { question: "4 + 4 = ?", correctAnswer: 8, options: [7, 8, 9] },
    { question: "6 + 1 = ?", correctAnswer: 7, options: [5, 7, 8] },
    { question: "8 - 5 = ?", correctAnswer: 3, options: [3, 4, 6] },
    { question: "3 + 5 = ?", correctAnswer: 8, options: [6, 8, 9] },
    { question: "10 - 6 = ?", correctAnswer: 4, options: [2, 4, 5] },
    { question: "1 + 6 = ?", correctAnswer: 7, options: [7, 8, 9] }
];

// ===== Утилиты =====
function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function isInsideDiamond(x, y, margin = 1.0) {
    const d = WORLD.diamond;
    return Math.abs(x - d.cx) / d.hw + Math.abs(y - d.cy) / d.hh <= margin;
}
function distToSegment(px, py, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = px - a.x, apy = py - a.y;
    const lenSq = abx * abx + aby * aby || 1;
    let t = (apx * abx + apy * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + abx * t, cy = a.y + aby * t;
    return Math.hypot(px - cx, py - cy);
}
function distToRiver(x, y) {
    let min = Infinity;
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
        const d = distToSegment(x, y, RIVER_POINTS[i], RIVER_POINTS[i + 1]);
        if (d < min) min = d;
    }
    return min;
}

function riverTangentAt(x, y) {
    // Возвращает угол реки в радианах в точке, ближайшей к (x, y)
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
        const d = distToSegment(x, y, RIVER_POINTS[i], RIVER_POINTS[i + 1]);
        if (d < bestD) { bestD = d; bestI = i; }
    }
    const a = RIVER_POINTS[bestI];
    const b = RIVER_POINTS[bestI + 1];
    return Math.atan2(b.y - a.y, b.x - a.x);
}
function isOnBridge(x, y) {
    for (const b of BRIDGES) {
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) return true;
    }
    return false;
}
function blockedByObstacle(x, y) {
    if (distToRiver(x, y) < RIVER_HALF_WIDTH && !isOnBridge(x, y)) return true;
    for (const o of OBSTACLES) {
        if (dist(x, y, o.x, o.y) < o.r) return true;
    }
    return false;
}

// ===== SVG-спрайты =====
const COMMON_DEFS = `
    <linearGradient id="bark-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5b3614"/>
        <stop offset="50%" stop-color="#7a4f1f"/>
        <stop offset="100%" stop-color="#5b3614"/>
    </linearGradient>
    <radialGradient id="leaves-grad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#6dc54a"/>
        <stop offset="60%" stop-color="#3f8a25"/>
        <stop offset="100%" stop-color="#2a5e18"/>
    </radialGradient>
    <radialGradient id="leaves-grad2" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#7ad06a"/>
        <stop offset="60%" stop-color="#46963a"/>
        <stop offset="100%" stop-color="#1f4f10"/>
    </radialGradient>
    <radialGradient id="rock-grad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#c4c8cc"/>
        <stop offset="60%" stop-color="#8b8e92"/>
        <stop offset="100%" stop-color="#4a4d50"/>
    </radialGradient>
    <radialGradient id="dino-body" cx="40%" cy="25%" r="75%">
        <stop offset="0%" stop-color="#a4ba6c"/>
        <stop offset="55%" stop-color="#637e36"/>
        <stop offset="100%" stop-color="#324817"/>
    </radialGradient>
    <radialGradient id="dino-armor" cx="40%" cy="25%" r="70%">
        <stop offset="0%" stop-color="#5d6d2c"/>
        <stop offset="50%" stop-color="#2a361a"/>
        <stop offset="100%" stop-color="#0e150a"/>
    </radialGradient>
    <radialGradient id="dino-belly" cx="50%" cy="40%" r="80%">
        <stop offset="0%" stop-color="#d4c490"/>
        <stop offset="60%" stop-color="#a89770"/>
        <stop offset="100%" stop-color="#7a6a48"/>
    </radialGradient>
    <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7fcfee"/>
        <stop offset="100%" stop-color="#3f8acf"/>
    </linearGradient>
`;

function ankyloBody() {
    // Реалистичный анкилозавр: вытянутое низкое тело, чешуя, костяные пластины и шипы.
    return `
        <g>
            <ellipse cx="0" cy="18" rx="62" ry="10" fill="rgba(0,0,0,0.42)"/>
            <path d="M -32 -2 Q -52 5 -68 14" stroke="#1f2c10" stroke-width="20" fill="none" stroke-linecap="round"/>
            <path d="M -32 -2 Q -52 5 -68 14" stroke="#637e36" stroke-width="15" fill="none" stroke-linecap="round"/>
            <path d="M -34 -7 Q -48 -1 -62 6" stroke="#84a04a" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
            <ellipse cx="-72" cy="14" rx="13" ry="12" fill="url(#dino-armor)"/>
            <ellipse cx="-73" cy="9" rx="7" ry="3" fill="#84a04a" opacity="0.5"/>
            <path d="M -85 11 L -92 4 L -82 7 Z" fill="#0e150a"/>
            <path d="M -72 -2 L -72 -12 L -64 -3 Z" fill="#0e150a"/>
            <path d="M -60 4 L -56 -5 L -52 4 Z" fill="#0e150a"/>
            <circle cx="-78" cy="17" r="0.8" fill="#0e150a" opacity="0.6"/>
            <circle cx="-68" cy="20" r="0.8" fill="#0e150a" opacity="0.6"/>
            <circle cx="-75" cy="13" r="0.6" fill="#0e150a" opacity="0.6"/>
            <ellipse cx="-22" cy="17" rx="11" ry="4" fill="#0e150a"/>
            <path d="M -30 0 Q -32 3 -32 10 L -30 16 L -16 16 L -14 10 Q -14 3 -16 0 Z" fill="#324817"/>
            <path d="M -29 1 Q -28 5 -28 12" stroke="#84a04a" stroke-width="2" fill="none" opacity="0.55"/>
            <path d="M -28 17 L -26 19 M -22 17 L -22 19 M -16 17 L -18 19" stroke="#0e150a" stroke-width="1" fill="none"/>
            <ellipse cx="22" cy="17" rx="11" ry="4" fill="#0e150a"/>
            <path d="M 16 0 Q 14 3 14 10 L 16 16 L 30 16 L 32 10 Q 32 3 30 0 Z" fill="#324817"/>
            <path d="M 17 1 Q 16 5 16 12" stroke="#84a04a" stroke-width="2" fill="none" opacity="0.55"/>
            <path d="M 16 17 L 18 19 M 22 17 L 22 19 M 28 17 L 26 19" stroke="#0e150a" stroke-width="1" fill="none"/>
            <ellipse cx="0" cy="3" rx="44" ry="11" fill="#1f2c10"/>
            <ellipse cx="0" cy="0" rx="34" ry="9" fill="url(#dino-belly)"/>
            <path d="M -22 -2 L -18 -1" stroke="#7a6a48" stroke-width="0.6" opacity="0.5"/>
            <path d="M -10 -1 L -6 0" stroke="#7a6a48" stroke-width="0.6" opacity="0.5"/>
            <path d="M 4 -1 L 8 0" stroke="#7a6a48" stroke-width="0.6" opacity="0.5"/>
            <path d="M 16 -2 L 20 -1" stroke="#7a6a48" stroke-width="0.6" opacity="0.5"/>
            <path d="M -44 -2 Q -46 -28 -20 -32 Q 0 -34 20 -32 Q 46 -28 44 -2 Q 40 6 0 6 Q -40 6 -44 -2 Z" fill="url(#dino-body)"/>
            <circle cx="-30" cy="-15" r="0.9" fill="#1f2c10" opacity="0.6"/>
            <circle cx="-25" cy="-9" r="0.7" fill="#1f2c10" opacity="0.55"/>
            <circle cx="-18" cy="-18" r="0.8" fill="#1f2c10" opacity="0.6"/>
            <circle cx="-12" cy="-12" r="0.6" fill="#1f2c10" opacity="0.55"/>
            <circle cx="-5" cy="-15" r="0.7" fill="#1f2c10" opacity="0.6"/>
            <circle cx="3" cy="-10" r="0.9" fill="#1f2c10" opacity="0.55"/>
            <circle cx="10" cy="-16" r="0.7" fill="#1f2c10" opacity="0.6"/>
            <circle cx="18" cy="-12" r="0.7" fill="#1f2c10" opacity="0.55"/>
            <circle cx="25" cy="-15" r="0.8" fill="#1f2c10" opacity="0.55"/>
            <circle cx="32" cy="-10" r="0.6" fill="#1f2c10" opacity="0.55"/>
            <path d="M -32 -22 Q -26 -30 -8 -32" stroke="#bcd884" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.4"/>
            <ellipse cx="-28" cy="-22" rx="7" ry="5" fill="url(#dino-armor)"/>
            <ellipse cx="-14" cy="-29" rx="9" ry="7" fill="url(#dino-armor)"/>
            <ellipse cx="0" cy="-32" rx="10" ry="8" fill="url(#dino-armor)"/>
            <ellipse cx="14" cy="-29" rx="9" ry="7" fill="url(#dino-armor)"/>
            <ellipse cx="28" cy="-22" rx="7" ry="5" fill="url(#dino-armor)"/>
            <ellipse cx="-28" cy="-19" rx="6" ry="2" fill="#0e150a" opacity="0.5"/>
            <ellipse cx="-14" cy="-25" rx="8" ry="2" fill="#0e150a" opacity="0.5"/>
            <ellipse cx="0" cy="-27" rx="9" ry="2.5" fill="#0e150a" opacity="0.5"/>
            <ellipse cx="14" cy="-25" rx="8" ry="2" fill="#0e150a" opacity="0.5"/>
            <ellipse cx="28" cy="-19" rx="6" ry="2" fill="#0e150a" opacity="0.5"/>
            <ellipse cx="-29" cy="-25" rx="3" ry="1.5" fill="#84a04a" opacity="0.7"/>
            <ellipse cx="-15" cy="-32" rx="4" ry="2" fill="#84a04a" opacity="0.75"/>
            <ellipse cx="-1" cy="-35" rx="5" ry="2.5" fill="#9cb86a" opacity="0.85"/>
            <ellipse cx="13" cy="-32" rx="4" ry="2" fill="#84a04a" opacity="0.75"/>
            <ellipse cx="27" cy="-25" rx="3" ry="1.5" fill="#84a04a" opacity="0.7"/>
            <path d="M -44 -16 L -56 -23 L -44 -9 Z" fill="#0e150a"/>
            <path d="M -44 -2 L -54 0 L -44 7 Z" fill="#0e150a"/>
            <path d="M 44 -16 L 56 -23 L 44 -9 Z" fill="#0e150a"/>
            <path d="M 44 -2 L 54 0 L 44 7 Z" fill="#0e150a"/>
            <ellipse cx="-9" cy="17" rx="11" ry="4" fill="#0e150a"/>
            <path d="M -16 0 Q -18 4 -18 10 L -16 16 L -2 16 L 0 10 Q 0 4 -2 0 Z" fill="url(#dino-body)"/>
            <path d="M -15 1 Q -14 5 -14 12" stroke="#bcd884" stroke-width="2" fill="none" opacity="0.6"/>
            <path d="M -16 17 L -14 19 M -10 17 L -10 19 M -2 17 L -4 19" stroke="#0e150a" stroke-width="1" fill="none"/>
            <ellipse cx="9" cy="17" rx="11" ry="4" fill="#0e150a"/>
            <path d="M 2 0 Q 0 4 0 10 L 2 16 L 16 16 L 18 10 Q 18 4 16 0 Z" fill="url(#dino-body)"/>
            <path d="M 3 1 Q 2 5 2 12" stroke="#bcd884" stroke-width="2" fill="none" opacity="0.6"/>
            <path d="M 2 17 L 4 19 M 10 17 L 10 19 M 16 17 L 14 19" stroke="#0e150a" stroke-width="1" fill="none"/>
            <path d="M 30 -7 Q 28 -22 42 -25 Q 60 -25 62 -10 Q 62 6 50 6 Q 32 6 30 -7 Z" fill="url(#dino-body)"/>
            <ellipse cx="48" cy="3" rx="14" ry="4" fill="#1f2c10" opacity="0.5"/>
            <path d="M 30 -18 Q 38 -25 50 -25" stroke="#bcd884" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.5"/>
            <circle cx="38" cy="-14" r="0.6" fill="#0e150a" opacity="0.55"/>
            <circle cx="44" cy="-18" r="0.6" fill="#0e150a" opacity="0.55"/>
            <circle cx="50" cy="-14" r="0.6" fill="#0e150a" opacity="0.55"/>
            <circle cx="55" cy="-9" r="0.5" fill="#0e150a" opacity="0.55"/>
            <path d="M 30 -20 Q 44 -25 58 -20" stroke="#0e150a" stroke-width="3" fill="none" stroke-linecap="round"/>
            <path d="M 33 -22 L 29 -29 L 37 -20 Z" fill="#0e150a"/>
            <path d="M 51 -22 L 55 -29 L 47 -20 Z" fill="#0e150a"/>
            <path d="M 28 -2 L 24 -6 L 30 -3 Z" fill="#0e150a"/>
            <path d="M 60 -3 L 64 -7 L 60 -1 Z" fill="#0e150a"/>
            <ellipse cx="46" cy="-12" rx="3.5" ry="3" fill="#fff"/>
            <ellipse cx="47" cy="-11.5" rx="2.5" ry="2.5" fill="#3a3a1a"/>
            <ellipse cx="47.5" cy="-11.5" rx="0.7" ry="2.2" fill="#000"/>
            <circle cx="48" cy="-13" r="0.6" fill="#fff"/>
            <path d="M 40 -17 Q 46 -19 52 -17" stroke="#1f2c10" stroke-width="1.6" fill="none" stroke-linecap="round"/>
            <path d="M 56 -2 Q 64 -3 64 -6 Q 60 -1 56 -2 Z" fill="#1f2c10"/>
            <line x1="56" y1="-1" x2="64" y2="-3" stroke="#0e150a" stroke-width="0.6"/>
            <ellipse cx="60" cy="-8" rx="0.7" ry="1" fill="#0e150a"/>
        </g>`;
}

function pineBody() {
    return `<g>
        <ellipse cx="2" cy="4" rx="22" ry="6" fill="rgba(0,0,0,0.32)"/>
        <rect x="-5" y="-18" width="10" height="22" rx="2" fill="url(#bark-grad)"/>
        <polygon points="-26,-14 0,-50 26,-14" fill="url(#leaves-grad)"/>
        <polygon points="-22,-30 0,-62 22,-30" fill="url(#leaves-grad)"/>
        <polygon points="-18,-46 0,-72 18,-46" fill="url(#leaves-grad2)"/>
        <polygon points="-22,-14 -8,-46 0,-50" fill="#a8e07a" opacity="0.35"/>
        <polygon points="-19,-30 -6,-58 0,-62" fill="#a8e07a" opacity="0.4"/>
        <circle cx="-10" cy="-22" r="2" fill="#e85d3a"/>
        <circle cx="9" cy="-38" r="2" fill="#e85d3a"/>
        <circle cx="4" cy="-58" r="1.6" fill="#ffd166"/>
    </g>`;
}

function oakBody() {
    return `<g>
        <ellipse cx="3" cy="5" rx="26" ry="7" fill="rgba(0,0,0,0.32)"/>
        <path d="M -7 4 Q -11 -10 -5 -22 L 5 -22 Q 11 -10 7 4 Z" fill="url(#bark-grad)"/>
        <ellipse cx="-12" cy="-30" rx="16" ry="14" fill="url(#leaves-grad)"/>
        <ellipse cx="14" cy="-32" rx="17" ry="15" fill="url(#leaves-grad)"/>
        <ellipse cx="0" cy="-44" rx="22" ry="18" fill="url(#leaves-grad2)"/>
        <ellipse cx="-8" cy="-52" rx="12" ry="9" fill="url(#leaves-grad2)"/>
        <ellipse cx="-15" cy="-36" rx="6" ry="4" fill="#a8e07a" opacity="0.45"/>
        <ellipse cx="-3" cy="-50" rx="6" ry="4" fill="#bff09c" opacity="0.5"/>
        <circle cx="-16" cy="-26" r="2.4" fill="#e85d3a"/>
        <circle cx="18" cy="-30" r="2.4" fill="#e85d3a"/>
        <circle cx="6" cy="-46" r="2.4" fill="#e85d3a"/>
    </g>`;
}

function bushBody() {
    return `<g>
        <ellipse cx="0" cy="3" rx="18" ry="5" fill="rgba(0,0,0,0.3)"/>
        <ellipse cx="-10" cy="-6" rx="11" ry="9" fill="url(#leaves-grad)"/>
        <ellipse cx="10" cy="-6" rx="11" ry="9" fill="url(#leaves-grad)"/>
        <ellipse cx="0" cy="-13" rx="12" ry="10" fill="url(#leaves-grad2)"/>
        <ellipse cx="-12" cy="-10" rx="4" ry="2.5" fill="#a8e07a" opacity="0.55"/>
        <circle cx="-5" cy="-9" r="1.8" fill="#ffd166"/>
        <circle cx="6" cy="-11" r="1.8" fill="#ff8888"/>
    </g>`;
}

function rockSmallBody() {
    return `<g>
        <ellipse cx="0" cy="3" rx="14" ry="4" fill="rgba(0,0,0,0.3)"/>
        <ellipse cx="0" cy="-5" rx="13" ry="9" fill="url(#rock-grad)"/>
        <ellipse cx="-3" cy="-9" rx="6" ry="3" fill="#dde1e5" opacity="0.7"/>
        <ellipse cx="-6" cy="-2" rx="3" ry="1.5" fill="#5aa05a" opacity="0.6"/>
    </g>`;
}

function flowerBody() {
    return `<g>
        <line x1="0" y1="2" x2="0" y2="-10" stroke="#3a7a3e" stroke-width="1.5"/>
        <circle cx="0" cy="-12" r="3.5" fill="#ff8888"/>
        <circle cx="-3" cy="-11" r="3" fill="#ff8888"/>
        <circle cx="3" cy="-11" r="3" fill="#ff8888"/>
        <circle cx="0" cy="-15" r="3" fill="#ff8888"/>
        <circle cx="0" cy="-12" r="1.4" fill="#ffd166"/>
    </g>`;
}

function boulderBody() {
    return `<g>
        <ellipse cx="2" cy="10" rx="48" ry="10" fill="rgba(0,0,0,0.4)"/>
        <ellipse cx="0" cy="-8" rx="44" ry="32" fill="url(#rock-grad)"/>
        <ellipse cx="-12" cy="-26" rx="22" ry="12" fill="#cfd3d8" opacity="0.85"/>
        <path d="M -10 0 Q 0 -6 8 -2" stroke="#4a4d50" stroke-width="1.2" fill="none" opacity="0.6"/>
        <path d="M 12 -16 Q 18 -10 16 -2" stroke="#4a4d50" stroke-width="1.2" fill="none" opacity="0.6"/>
        <ellipse cx="-22" cy="-38" rx="10" ry="3" fill="#5aa05a"/>
        <ellipse cx="14" cy="-36" rx="8" ry="2.5" fill="#5aa05a"/>
    </g>`;
}

function logBody() {
    // Без вращения — поворот делается в Phaser
    return `<g>
        <ellipse cx="2" cy="14" rx="58" ry="8" fill="rgba(0,0,0,0.35)"/>
        <rect x="-58" y="-14" width="116" height="26" rx="13" fill="url(#bark-grad)"/>
        <rect x="-58" y="-14" width="116" height="6" rx="3" fill="#3a200a" opacity="0.45"/>
        <rect x="-58" y="-14" width="116" height="3" rx="1.5" fill="#a37041" opacity="0.5"/>
        <ellipse cx="-58" cy="-1" rx="9" ry="13" fill="#7a4f1f"/>
        <ellipse cx="-58" cy="-1" rx="6" ry="9" fill="#5b3614"/>
        <ellipse cx="58" cy="-1" rx="9" ry="13" fill="#7a4f1f"/>
        <ellipse cx="58" cy="-1" rx="6" ry="9" fill="#5b3614"/>
        <line x1="-30" y1="-12" x2="-30" y2="10" stroke="#3a200a" stroke-width="0.8" opacity="0.6"/>
        <line x1="0" y1="-12" x2="0" y2="10" stroke="#3a200a" stroke-width="0.8" opacity="0.6"/>
        <line x1="30" y1="-12" x2="30" y2="10" stroke="#3a200a" stroke-width="0.8" opacity="0.6"/>
        <ellipse cx="-20" cy="-14" rx="14" ry="3" fill="#5aa05a"/>
        <ellipse cx="22" cy="-14" rx="11" ry="2.5" fill="#5aa05a"/>
        <g transform="translate(-5, -16)">
            <rect x="-1.5" y="0" width="3" height="5" fill="#f5e6d6"/>
            <ellipse cx="0" cy="0" rx="5" ry="3" fill="#e85d3a"/>
            <circle cx="-2" cy="-1" r="0.7" fill="#fff"/>
            <circle cx="2" cy="-0.5" r="0.6" fill="#fff"/>
        </g>
    </g>`;
}

function bridgeBody() {
    let planks = '';
    for (let i = -45; i <= 45; i += 12) {
        planks += `<line x1="${i}" y1="-30" x2="${i}" y2="30" stroke="#5b3614" stroke-width="1.5"/>`;
    }
    return `<g>
        <ellipse cx="2" cy="36" rx="60" ry="6" fill="rgba(0,0,0,0.35)"/>
        <rect x="-55" y="-32" width="110" height="64" rx="6" fill="url(#bark-grad)"/>
        <rect x="-55" y="-32" width="110" height="8" fill="#3a200a" opacity="0.4"/>
        <rect x="-55" y="-32" width="110" height="3" fill="#a37041" opacity="0.5"/>
        ${planks}
        <circle cx="-50" cy="-30" r="3" fill="#5b3614"/>
        <circle cx="50" cy="-30" r="3" fill="#5b3614"/>
        <circle cx="-50" cy="30" r="3" fill="#5b3614"/>
        <circle cx="50" cy="30" r="3" fill="#5b3614"/>
    </g>`;
}

function chestClosedBody() {
    return `<g>
        <ellipse cx="0" cy="3" rx="22" ry="5" fill="rgba(0,0,0,0.35)"/>
        <rect x="-20" y="-15" width="40" height="18" rx="3" fill="#a87332" stroke="#5b3614" stroke-width="1.5"/>
        <rect x="-20" y="-7" width="40" height="3" fill="#5b3614"/>
        <path d="M-20 -15 Q-20 -28 0 -28 Q20 -28 20 -15 Z" fill="#c98842" stroke="#5b3614" stroke-width="1.5"/>
        <path d="M-18 -15 Q-18 -25 0 -25" stroke="#deaa68" stroke-width="1.5" fill="none" opacity="0.7"/>
        <rect x="-4" y="-12" width="8" height="9" fill="#ffd166" stroke="#a07020" stroke-width="0.7"/>
        <circle cx="0" cy="-9" r="1.4" fill="#5b3614"/>
        <rect x="-21" y="-15" width="2" height="18" fill="#5b3614"/>
        <rect x="19" y="-15" width="2" height="18" fill="#5b3614"/>
    </g>`;
}

function chestOpenBody() {
    return `<g>
        <ellipse cx="0" cy="3" rx="22" ry="5" fill="rgba(0,0,0,0.35)"/>
        <rect x="-20" y="-15" width="40" height="18" rx="3" fill="#a87332" stroke="#5b3614" stroke-width="1.5" opacity="0.7"/>
        <rect x="-18" y="-15" width="36" height="4" fill="#3d2410"/>
        <path d="M-20 -15 Q-20 -34 0 -38 Q20 -34 20 -20 L20 -15 Z" fill="#c98842" stroke="#5b3614" stroke-width="1.5" opacity="0.7"/>
        <text x="-9" y="-19" font-size="10" text-anchor="middle">✨</text>
        <text x="7" y="-26" font-size="10" text-anchor="middle">✨</text>
    </g>`;
}

function caveBody() {
    // Большая гора, полностью покрывающая вход в пещеру.
    return `<g>
        <!-- Силуэт горы (тёмный контур) -->
        <path d="M -118 75 L -100 0 L -75 25 L -50 -28 L -22 -50 L 0 -62 L 24 -50 L 50 -32 L 78 10 L 102 -8 L 120 75 Z"
              fill="#5a5e62" stroke="#3a3d40" stroke-width="2" stroke-linejoin="round"/>
        <!-- Светлая порода поверх -->
        <path d="M -113 73 L -97 5 L -73 28 L -48 -23 L -22 -45 L 0 -56 L 22 -45 L 48 -28 L 75 12 L 99 -3 L 115 73 Z"
              fill="url(#rock-grad)" stroke-linejoin="round"/>
        <!-- Снежные шапки -->
        <polygon points="-100,0 -90,18 -82,8 -76,22" fill="#dde4eb"/>
        <polygon points="-50,-28 -42,-10 -52,-10" fill="#dde4eb"/>
        <polygon points="0,-62 8,-42 -8,-42" fill="#dde4eb"/>
        <polygon points="50,-32 56,-15 44,-15" fill="#dde4eb"/>
        <polygon points="102,-8 110,8 95,8" fill="#dde4eb"/>
        <!-- Тень склона справа -->
        <path d="M 0 -56 L 22 -45 L 48 -28 L 75 12 L 99 -3 L 115 73 L 0 73 Z"
              fill="rgba(0,0,0,0.18)"/>
        <!-- Тень у подножия -->
        <ellipse cx="0" cy="76" rx="118" ry="6" fill="rgba(0,0,0,0.32)"/>

        <!-- Вход в пещеру: арка полностью внутри породы -->
        <path d="M -32 73 L -32 28 Q -32 -2 0 -2 Q 32 -2 32 28 L 32 73 Z" fill="#1a1a1a"/>
        <!-- Глубже — темнее -->
        <ellipse cx="0" cy="48" rx="26" ry="22" fill="#000"/>
        <ellipse cx="0" cy="42" rx="18" ry="14" fill="rgba(0,0,0,0.6)"/>

        <!-- Сталактиты внутри -->
        <path d="M-22 0 L-18 12 L-14 -2 Z" fill="#2a2a2a"/>
        <path d="M-6 -2 L-2 12 L2 -4 Z" fill="#2a2a2a"/>
        <path d="M14 0 L18 12 L22 -2 Z" fill="#2a2a2a"/>

        <!-- Камни у входа -->
        <ellipse cx="-44" cy="73" rx="14" ry="5" fill="#9a9a9a"/>
        <ellipse cx="44"  cy="73" rx="15" ry="5" fill="#9a9a9a"/>
        <ellipse cx="-30" cy="74" rx="8" ry="3.5" fill="#aeb1b5"/>
        <ellipse cx="30"  cy="74" rx="8" ry="3.5" fill="#aeb1b5"/>

        <!-- Столбы и табличка ВЫХОД (приподняты над пиком горы) -->
        <line x1="-16" y1="-65" x2="-16" y2="-92" stroke="#5b3614" stroke-width="2.5"/>
        <line x1="16"  y1="-65" x2="16"  y2="-92" stroke="#5b3614" stroke-width="2.5"/>
        <rect x="-44" y="-122" width="88" height="32" rx="5" fill="#c98842" stroke="#5b3614" stroke-width="2.5"/>
        <rect x="-42" y="-120" width="84" height="6" fill="#deaa68" opacity="0.7"/>
        <text x="0" y="-101" font-family="Comic Sans MS, sans-serif" font-size="18" font-weight="bold"
              text-anchor="middle" fill="#3d2410">ВЫХОД</text>
    </g>`;
}

function particleBody() {
    return `<g><circle cx="0" cy="0" r="6" fill="#ffffff"/></g>`;
}

// Описание спрайтов: viewBox + якорь (точка в SVG-координатах, которая попадёт в позицию x,y объекта)
const SPRITES = {
    ankylo:        { viewBox: '-100 -42 175 70',  anchor: { x: 0,  y: 18 }, body: ankyloBody },
    pine:          { viewBox: '-30 -76 60 86',    anchor: { x: 2,  y: 4  }, body: pineBody },
    oak:           { viewBox: '-32 -64 70 76',    anchor: { x: 3,  y: 5  }, body: oakBody },
    bush:          { viewBox: '-22 -26 44 34',    anchor: { x: 0,  y: 3  }, body: bushBody },
    rockSmall:     { viewBox: '-16 -18 32 24',    anchor: { x: 0,  y: 3  }, body: rockSmallBody },
    flower:        { viewBox: '-6 -19 12 23',     anchor: { x: 0,  y: 2  }, body: flowerBody },
    boulder:       { viewBox: '-50 -44 100 60',   anchor: { x: 2,  y: 10 }, body: boulderBody },
    log:           { viewBox: '-70 -28 140 56',   anchor: { x: 2,  y: 14 }, body: logBody },
    bridge:        { viewBox: '-65 -42 130 84',   anchor: { x: 2,  y: 36 }, body: bridgeBody },
    'chest-closed':{ viewBox: '-24 -32 48 40',    anchor: { x: 0,  y: 3  }, body: chestClosedBody },
    'chest-open':  { viewBox: '-24 -42 48 50',    anchor: { x: 0,  y: 3  }, body: chestOpenBody },
    cave:          { viewBox: '-125 -130 250 210', anchor: { x: 0,  y: 73 }, body: caveBody },
    particle:      { viewBox: '-8 -8 16 16',      anchor: { x: 0,  y: 0  }, body: particleBody }
};

function makeSpriteSVG(key) {
    const s = SPRITES[key];
    const [vx, vy, vw, vh] = s.viewBox.split(' ').map(Number);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${s.viewBox}" width="${vw}" height="${vh}"><defs>${COMMON_DEFS}</defs>${s.body()}</svg>`;
}

function spriteOrigin(key) {
    const s = SPRITES[key];
    const [vx, vy, vw, vh] = s.viewBox.split(' ').map(Number);
    return { x: (s.anchor.x - vx) / vw, y: (s.anchor.y - vy) / vh };
}

function spriteSize(key) {
    const s = SPRITES[key];
    const [, , vw, vh] = s.viewBox.split(' ').map(Number);
    return { w: vw, h: vh };
}

// ===== Web Audio =====
let audioCtx = null;
function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
            audioCtx = new Ctx();
            window.__audioCtx = audioCtx;
        }
    } catch (e) { /* no audio */ }
}
function playTone(freq, duration, when = 0, type = 'triangle', volume = 0.4) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const t = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, t);
    osc.type = type;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
}
function playSuccess() {
    playTone(523.25, 0.18, 0.00, 'triangle', 0.4);
    playTone(659.25, 0.18, 0.07, 'triangle', 0.4);
    playTone(783.99, 0.18, 0.14, 'triangle', 0.45);
    playTone(1046.50, 0.45, 0.21, 'triangle', 0.5);
}
function playWrong() {
    playTone(330, 0.20, 0.00, 'sine', 0.3);
    playTone(220, 0.32, 0.10, 'sine', 0.3);
}
function playWin() {
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
        playTone(f, 0.5, i * 0.12, 'triangle', 0.45);
    });
}

// ===== HTML UI =====
const screens = {
    start: document.getElementById('screen-start'),
    play: document.getElementById('screen-play'),
    end: document.getElementById('screen-end')
};
const modalQuestion = document.getElementById('modal-question');
const modalFeedback = document.getElementById('modal-feedback');
const fruitCountEl = document.getElementById('fruit-count');
const chestProgressEl = document.getElementById('chest-progress');
const questionTextEl = document.getElementById('question-text');
const answerOptionsEl = document.getElementById('answer-options');
const feedbackEmojiEl = document.getElementById('feedback-emoji');
const feedbackTextEl = document.getElementById('feedback-text');

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
}
function showModal(el) { el.classList.add('active'); }
function hideModal(el) { el.classList.remove('active'); }
function updateHUD(fruits, chestsOpened) {
    fruitCountEl.textContent = fruits;
    chestProgressEl.textContent = chestsOpened;
}
function renderTitleAnkylo() {
    const titleSvg = document.querySelector('.title-ankylo');
    if (titleSvg) titleSvg.innerHTML = ankyloBody();
}

// Колбэки от модалок (передаются GameScene-ом)
let questionCallback = null;
let feedbackCallback = null;
function showQuestionModal(question, options, onAnswer) {
    questionCallback = onAnswer;
    questionTextEl.textContent = question;
    answerOptionsEl.innerHTML = '';
    options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt;
        btn.setAttribute('data-key', i + 1);
        btn.addEventListener('click', () => answerSelected(opt, btn, options));
        answerOptionsEl.appendChild(btn);
    });
    showModal(modalQuestion);
}
function answerSelected(selected, btnEl, options) {
    if (!questionCallback) return;
    const cb = questionCallback;
    questionCallback = null;
    cb(selected, btnEl);
}
function showFeedbackModal(correctAnswer, onContinue) {
    feedbackCallback = onContinue;
    feedbackEmojiEl.textContent = '🌟';
    feedbackTextEl.textContent = `Почти получилось! Правильный ответ: ${correctAnswer}`;
    showModal(modalFeedback);
}
function continueFeedback() {
    if (!feedbackCallback) return;
    const cb = feedbackCallback;
    feedbackCallback = null;
    hideModal(modalFeedback);
    cb();
}
function showEndScreen(stars, title, message, correct, fruits) {
    const starsEl = document.getElementById('end-stars');
    starsEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const star = document.createElement('span');
        if (i < stars) { star.className = 'star-on'; star.textContent = '⭐'; }
        else           { star.className = 'star-off'; star.textContent = '☆'; }
        starsEl.appendChild(star);
    }
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-message').textContent = message;
    document.getElementById('end-correct').textContent = correct;
    document.getElementById('end-fruits').textContent = fruits;
    showScreen('end');
}

// D-pad состояние (общее, читается GameScene-ом)
const dpadInput = { up: false, down: false, left: false, right: false };
function bindDpad() {
    const dirs = ['up', 'down', 'left', 'right'];
    dirs.forEach(dir => {
        const btn = document.querySelector(`.dpad-${dir}`);
        if (!btn) return;
        const press = (e) => { e.preventDefault(); dpadInput[dir] = true; btn.classList.add('pressed'); };
        const release = () => { dpadInput[dir] = false; btn.classList.remove('pressed'); };
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerleave', release);
        btn.addEventListener('pointercancel', release);
    });
    window.addEventListener('pointerup', () => {
        dirs.forEach(d => {
            dpadInput[d] = false;
            const btn = document.querySelector(`.dpad-${d}`);
            if (btn) btn.classList.remove('pressed');
        });
    });
    window.addEventListener('blur', () => { dirs.forEach(d => dpadInput[d] = false); });
}

// Глобальные клавиатурные хоткеи (1/2/3 для ответов, Enter/Space для продолжения)
document.addEventListener('keydown', (e) => {
    if (modalQuestion.classList.contains('active')) {
        let idx = -1;
        if (e.key === '1') idx = 0;
        else if (e.key === '2') idx = 1;
        else if (e.key === '3') idx = 2;
        if (idx >= 0) {
            const btns = answerOptionsEl.querySelectorAll('.answer-btn');
            if (btns[idx] && !btns[idx].disabled) {
                e.preventDefault();
                btns[idx].click();
            }
        }
        return;
    }
    if (modalFeedback.classList.contains('active') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        continueFeedback();
    }
});

document.getElementById('btn-next').addEventListener('click', continueFeedback);

// ===== Phaser сцены =====
class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    create() {
        // Загружаем SVG → Blob → Image → Canvas → Phaser-текстура
        const promises = Object.keys(SPRITES).map(key => this.loadSVGAsCanvas(key));
        Promise.all(promises)
            .then(() => this.scene.start('Game'))
            .catch(err => {
                console.error('[BootScene] Sprite load failed:', err);
                this.showError(err.message || 'Ошибка загрузки спрайтов');
            });
    }

    loadSVGAsCanvas(key) {
        return new Promise((resolve, reject) => {
            const svg = makeSpriteSVG(key);
            const size = spriteSize(key);
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = size.w;
                    canvas.height = size.h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    this.textures.addCanvas(key, canvas);
                    URL.revokeObjectURL(url);
                    resolve();
                } catch (e) {
                    URL.revokeObjectURL(url);
                    reject(e);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Не удалось загрузить SVG для "${key}"`));
            };
            img.src = url;
        });
    }

    showError(msg) {
        const t = this.add.text(VIEWPORT.w / 2, VIEWPORT.h / 2, msg, {
            fontFamily: 'sans-serif', fontSize: '20px', color: '#ff3333',
            backgroundColor: '#fff', padding: { x: 12, y: 8 }
        });
        t.setOrigin(0.5, 0.5);
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        // Состояние уровня
        this.fruits = 0;
        this.correctAnswers = 0;
        this.facing = 1;
        this.walking = false;
        this.bobTime = 0;
        this.paused = false;

        // Генерация мира
        this.groundPatches = this.generateGroundPatches();
        this.chests = this.generateChests();
        this.decorations = this.generateDecorations(this.chests);
        this.borderForest = this.generateBorderForest();

        // Камера и границы
        this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
        this.cameras.main.setBackgroundColor('#5a8e36'); // тёмно-зелёный фон под лесом
        this.cameras.main.setZoom(CAMERA_ZOOM);

        // Земля и река через Graphics
        this.drawGround();
        this.drawRiver();

        // Мосты — угол вычисляется как тангенс реки + 90° (поперёк потока)
        BRIDGES.forEach(b => {
            const sprite = this.add.image(b.x, b.y, 'bridge');
            const o = spriteOrigin('bridge');
            sprite.setOrigin(o.x, o.y);
            const tangent = riverTangentAt(b.x, b.y);
            sprite.setRotation(tangent + Math.PI / 2);
            sprite.setDepth(b.y);
        });

        // Лес-граница (плотный ряд деревьев в кольце вокруг ромба)
        this.borderForest.forEach(t => {
            const sprite = this.add.image(t.x, t.y, t.type);
            const o = spriteOrigin(t.type);
            sprite.setOrigin(o.x, o.y);
            sprite.setDepth(t.y);
        });

        // Декорации внутри ромба
        this.decorations.forEach(d => {
            const key = d.type === 'rockSmall' ? 'rockSmall' : d.type;
            const sprite = this.add.image(d.x, d.y, key);
            const o = spriteOrigin(key);
            sprite.setOrigin(o.x, o.y);
            sprite.setDepth(d.y);
        });

        // Препятствия
        OBSTACLES.forEach(obs => {
            const key = obs.type;
            const sprite = this.add.image(obs.x, obs.y, key);
            const o = spriteOrigin(key);
            sprite.setOrigin(o.x, o.y);
            if (obs.angle != null) sprite.setRotation(Phaser.Math.DegToRad(obs.angle));
            sprite.setDepth(obs.y);
        });

        // Сундуки
        this.chestSprites = this.chests.map((c, i) => {
            const sprite = this.add.image(c.x, c.y, 'chest-closed');
            const o = spriteOrigin('chest-closed');
            sprite.setOrigin(o.x, o.y);
            sprite.setDepth(c.y);
            sprite.setData('idx', i);
            return sprite;
        });

        // Пещера + свечение
        this.caveGlow = this.add.image(WORLD.cave.x, WORLD.cave.y + 25, 'particle');
        this.caveGlow.setTint(0xffd166);
        this.caveGlow.setScale(8);
        this.caveGlow.setAlpha(0);
        this.caveGlow.setDepth(WORLD.cave.y - 1);

        const caveSprite = this.add.image(WORLD.cave.x, WORLD.cave.y, 'cave');
        const caveO = spriteOrigin('cave');
        caveSprite.setOrigin(caveO.x, caveO.y);
        caveSprite.setDepth(WORLD.cave.y);

        // Анкилозавр + логическая позиция (отдельно от спрайта для bob-анимации)
        this.dinoLogicalX = WORLD.start.x;
        this.dinoLogicalY = WORLD.start.y;
        this.dino = this.add.image(WORLD.start.x, WORLD.start.y, 'ankylo');
        const dO = spriteOrigin('ankylo');
        this.dino.setOrigin(dO.x, dO.y);
        this.dino.setDepth(WORLD.start.y);

        // Невидимая цель для камеры — следит за логической позицией без bob-болтанки
        this.followTarget = this.add.rectangle(WORLD.start.x, WORLD.start.y, 1, 1).setAlpha(0);
        this.cameras.main.startFollow(this.followTarget, true, 0.18, 0.18);
        this.cameras.main.centerOn(WORLD.start.x, WORLD.start.y);

        // Эмиттер салюта
        this.fireworks = this.add.particles(0, 0, 'particle', {
            speed: { min: 80, max: 260 },
            angle: { min: 0, max: 360 },
            lifespan: { min: 800, max: 1400 },
            scale: { start: 1.2, end: 0 },
            gravityY: 280,
            tint: [0xff6b6b, 0xffd166, 0x06d6a0, 0x118ab2, 0xef476f, 0xff8c42, 0xffffff],
            emitting: false
        });
        this.fireworks.setDepth(100000); // всегда сверху

        // Ввод (Phaser использует keyCode — раскладка не важна)
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            up: 'W', down: 'S', left: 'A', right: 'D'
        });

        updateHUD(this.fruits, 0);
    }

    drawGround() {
        const g = this.add.graphics();
        g.setDepth(-2000);
        const d = WORLD.diamond;
        const top = { x: d.cx, y: d.cy - d.hh };
        const right = { x: d.cx + d.hw, y: d.cy };
        const bottom = { x: d.cx, y: d.cy + d.hh };
        const left = { x: d.cx - d.hw, y: d.cy };

        // Главный ромб
        g.fillStyle(0x6db344, 1);
        g.fillPoints([top, right, bottom, left], true);

        // Светлый верхний треугольник (для иллюзии освещения)
        g.fillStyle(0x9ce263, 0.35);
        g.fillPoints([top, right, left], true);

        // Тёмный нижний треугольник (тень)
        g.fillStyle(0x3f8a25, 0.35);
        g.fillPoints([right, bottom, left], true);

        // Граница ромба
        g.lineStyle(3, 0x2a5e18, 1);
        g.beginPath();
        g.moveTo(top.x, top.y);
        g.lineTo(right.x, right.y);
        g.lineTo(bottom.x, bottom.y);
        g.lineTo(left.x, left.y);
        g.closePath();
        g.strokePath();

        // Случайные пятна (свет/тень)
        this.groundPatches.forEach(p => {
            const colour = p.kind === 'light' ? 0xa8e07a : 0x3f8a25;
            const alpha = p.kind === 'light' ? 0.18 : 0.22;
            g.fillStyle(colour, alpha);
            g.fillPoints([
                { x: p.x, y: p.y - p.h },
                { x: p.x + p.w, y: p.y },
                { x: p.x, y: p.y + p.h },
                { x: p.x - p.w, y: p.y }
            ], true);
        });
    }

    drawRiver() {
        const g = this.add.graphics();
        g.setDepth(-1500);

        // Гладкая кривая через опорные точки
        const path = new Phaser.Curves.Path(RIVER_POINTS[0].x, RIVER_POINTS[0].y);
        for (let i = 1; i < RIVER_POINTS.length - 1; i++) {
            const p = RIVER_POINTS[i];
            const next = RIVER_POINTS[i + 1];
            const mx = (p.x + next.x) / 2;
            const my = (p.y + next.y) / 2;
            path.quadraticBezierTo(mx, my, p.x, p.y);
        }
        const last = RIVER_POINTS[RIVER_POINTS.length - 1];
        path.lineTo(last.x, last.y);

        // Берег с грязью (тёмная зелень + коричневый ободок)
        g.lineStyle(RIVER_HALF_WIDTH * 2 + 26, 0x4a6a26, 0.55);
        path.draw(g, 96);
        g.lineStyle(RIVER_HALF_WIDTH * 2 + 14, 0x8b6f3d, 0.7);
        path.draw(g, 96);

        // Тёмная глубокая вода (внешний край)
        g.lineStyle(RIVER_HALF_WIDTH * 2 + 2, 0x1f5680, 1);
        path.draw(g, 96);
        // Средний слой воды
        g.lineStyle(RIVER_HALF_WIDTH * 2 - 6, 0x4895c4, 1);
        path.draw(g, 96);
        // Светлый верх воды
        g.lineStyle(RIVER_HALF_WIDTH * 2 - 18, 0x7fc3e3, 1);
        path.draw(g, 96);
        // Самый светлый блик в центре
        g.lineStyle(RIVER_HALF_WIDTH * 2 - 32, 0xc4e7f4, 0.7);
        path.draw(g, 96);

        // Рябь — раскидываем мелкие овалы вдоль русла со смещением от центра
        const sampleN = 80;
        for (let i = 0; i < sampleN; i++) {
            const t = i / sampleN;
            const p = path.getPoint(t);
            if (!p) continue;
            const t2 = Math.min(1, t + 0.005);
            const p2 = path.getPoint(t2);
            if (!p2) continue;
            const tx = p2.x - p.x, ty = p2.y - p.y;
            const tlen = Math.hypot(tx, ty) || 1;
            // Нормаль (перпендикуляр) к течению
            const nx = -ty / tlen, ny = tx / tlen;
            const offset = (Math.random() - 0.5) * (RIVER_HALF_WIDTH * 1.5);
            const rx = p.x + nx * offset;
            const ry = p.y + ny * offset;
            // Овал-блик ориентирован вдоль течения
            const angle = Math.atan2(ty, tx);
            g.fillStyle(0xffffff, 0.35 + Math.random() * 0.25);
            // Phaser fillEllipse не поворачивает, делаем линию-блик
            const len = 4 + Math.random() * 8;
            const x1 = rx - Math.cos(angle) * len / 2;
            const y1 = ry - Math.sin(angle) * len / 2;
            const x2 = rx + Math.cos(angle) * len / 2;
            const y2 = ry + Math.sin(angle) * len / 2;
            g.lineStyle(1.5 + Math.random(), 0xffffff, 0.5 + Math.random() * 0.4);
            g.lineBetween(x1, y1, x2, y2);
        }
    }

    generateGroundPatches() {
        const patches = [];
        let attempts = 0;
        while (patches.length < 45 && attempts < 500) {
            attempts++;
            const x = WORLD.diamond.cx + (Math.random() - 0.5) * 2 * WORLD.diamond.hw * 0.92;
            const y = WORLD.diamond.cy + (Math.random() - 0.5) * 2 * WORLD.diamond.hh * 0.92;
            if (!isInsideDiamond(x, y, 0.94)) continue;
            patches.push({ x, y, w: 50 + Math.random() * 60, h: 25 + Math.random() * 25,
                           kind: Math.random() < 0.5 ? 'light' : 'dark' });
        }
        return patches;
    }

    generateChests() {
        const chests = [];
        const questions = shuffle(QUESTIONS);
        let attempts = 0;
        while (chests.length < TOTAL_CHESTS && attempts < 4000) {
            attempts++;
            const x = WORLD.diamond.cx + (Math.random() - 0.5) * 2 * WORLD.diamond.hw * 0.85;
            const y = WORLD.diamond.cy + (Math.random() - 0.5) * 2 * WORLD.diamond.hh * 0.85;
            if (!isInsideDiamond(x, y, 0.85)) continue;
            if (dist(x, y, WORLD.cave.x, WORLD.cave.y) < 180) continue;
            if (dist(x, y, WORLD.start.x, WORLD.start.y) < 160) continue;
            if (chests.some(c => dist(x, y, c.x, c.y) < 140)) continue;
            if (blockedByObstacle(x, y)) continue;
            if (distToRiver(x, y) < RIVER_HALF_WIDTH + 30) continue;
            if (OBSTACLES.some(o => dist(x, y, o.x, o.y) < o.r + 30)) continue;
            const q = questions[chests.length];
            chests.push({
                x, y,
                question: q.question,
                options: shuffle(q.options),
                correctAnswer: q.correctAnswer,
                opened: false
            });
        }
        return chests;
    }

    generateDecorations(chests) {
        const decor = [];
        const types = ['pine', 'pine', 'oak', 'oak', 'oak', 'bush', 'bush', 'rockSmall', 'flower', 'flower'];
        let attempts = 0;
        while (decor.length < 42 && attempts < 2000) {
            attempts++;
            const x = WORLD.diamond.cx + (Math.random() - 0.5) * 2 * WORLD.diamond.hw * 0.92;
            const y = WORLD.diamond.cy + (Math.random() - 0.5) * 2 * WORLD.diamond.hh * 0.92;
            if (!isInsideDiamond(x, y, 0.9)) continue;
            if (dist(x, y, WORLD.cave.x, WORLD.cave.y) < 130) continue;
            if (dist(x, y, WORLD.start.x, WORLD.start.y) < 90) continue;
            if (chests.some(c => dist(x, y, c.x, c.y) < 70)) continue;
            if (decor.some(d => dist(x, y, d.x, d.y) < 80)) continue;
            if (distToRiver(x, y) < RIVER_HALF_WIDTH + 8) continue;
            if (OBSTACLES.some(o => dist(x, y, o.x, o.y) < o.r + 25)) continue;
            decor.push({ x, y, type: types[Math.floor(Math.random() * types.length)] });
        }
        return decor;
    }

    generateBorderForest() {
        // Деревья в кольце ВОКРУГ ромба — формируют естественный край мира.
        const trees = [];
        const d = WORLD.diamond;
        const types = ['pine', 'pine', 'pine', 'oak', 'oak', 'bush'];
        let attempts = 0;
        const target = 110;
        while (trees.length < target && attempts < 8000) {
            attempts++;
            const x = d.cx + (Math.random() - 0.5) * 2 * d.hw * 1.45;
            const y = d.cy + (Math.random() - 0.5) * 2 * d.hh * 1.45;
            if (x < 60 || x > WORLD.w - 60) continue;
            if (y < 80 || y > WORLD.h - 60) continue;
            const ratio = Math.abs(x - d.cx) / d.hw + Math.abs(y - d.cy) / d.hh;
            if (ratio < 1.02) continue;   // внутри игровой зоны — пропускаем
            if (ratio > 1.45) continue;   // слишком далеко — за пределами мира
            if (trees.some(t => dist(x, y, t.x, t.y) < 55)) continue;
            // Не лезть в район пещеры (она и так за ромбом сверху)
            if (dist(x, y, WORLD.cave.x, WORLD.cave.y) < 130) continue;
            trees.push({ x, y, type: types[Math.floor(Math.random() * types.length)] });
        }
        return trees;
    }

    update(time, delta) {
        if (this.paused) return;
        this.handleMovement(delta);
        this.applyDinoBob(time);
        this.checkChestProximity();
        this.checkCaveProximity();
    }

    handleMovement(delta) {
        let dx = 0, dy = 0;
        if (this.cursors.up.isDown    || this.keys.up.isDown    || dpadInput.up)    dy -= 1;
        if (this.cursors.down.isDown  || this.keys.down.isDown  || dpadInput.down)  dy += 1;
        if (this.cursors.left.isDown  || this.keys.left.isDown  || dpadInput.left)  dx -= 1;
        if (this.cursors.right.isDown || this.keys.right.isDown || dpadInput.right) dx += 1;

        if (dx === 0 && dy === 0) {
            this.walking = false;
            this.applyDinoBob(0, 0);
            return;
        }
        this.walking = true;
        const len = Math.hypot(dx, dy);
        dx /= len; dy /= len;
        const speed = 0.26;
        const nx = this.dinoLogicalX + dx * speed * delta;
        const ny = this.dinoLogicalY + dy * speed * delta;

        // Скольжение по препятствиям и границе
        let finalX = this.dinoLogicalX, finalY = this.dinoLogicalY;
        if (isInsideDiamond(nx, ny, 0.97) && !blockedByObstacle(nx, ny)) {
            finalX = nx; finalY = ny;
        } else if (isInsideDiamond(nx, this.dinoLogicalY, 0.97) && !blockedByObstacle(nx, this.dinoLogicalY)) {
            finalX = nx;
        } else if (isInsideDiamond(this.dinoLogicalX, ny, 0.97) && !blockedByObstacle(this.dinoLogicalX, ny)) {
            finalY = ny;
        }
        this.dinoLogicalX = finalX;
        this.dinoLogicalY = finalY;
        this.followTarget.x = finalX;
        this.followTarget.y = finalY;

        if (dx > 0) this.dino.setFlipX(false);
        else if (dx < 0) this.dino.setFlipX(true);
    }

    applyDinoBob(time) {
        // Анимация ходьбы: вертикальный bob + лёгкий наклон
        if (this.walking) {
            const bob = Math.sin(time / 90) * 3;
            const tilt = Math.sin(time / 90) * 0.04;
            this.dino.x = this.dinoLogicalX;
            this.dino.y = this.dinoLogicalY + bob;
            this.dino.setRotation(tilt);
        } else {
            this.dino.x = this.dinoLogicalX;
            this.dino.y = this.dinoLogicalY;
            this.dino.setRotation(0);
        }
        this.dino.setDepth(this.dinoLogicalY);
    }

    checkChestProximity() {
        for (let i = 0; i < this.chests.length; i++) {
            const c = this.chests[i];
            if (c.opened) continue;
            if (dist(this.dinoLogicalX, this.dinoLogicalY, c.x, c.y) < 50) {
                this.openChest(i);
                return;
            }
        }
    }

    checkCaveProximity() {
        if (dist(this.dinoLogicalX, this.dinoLogicalY, WORLD.cave.x, WORLD.cave.y) < 80) {
            this.finishLevel();
        }
    }

    openChest(idx) {
        this.paused = true;
        const c = this.chests[idx];
        showQuestionModal(c.question, c.options, (selected, btnEl) => {
            const isCorrect = selected === c.correctAnswer;

            answerOptionsEl.querySelectorAll('.answer-btn').forEach(b => {
                b.disabled = true;
                if (Number(b.textContent) === c.correctAnswer) b.classList.add('correct');
                else if (b === btnEl && !isCorrect) b.classList.add('wrong');
            });

            c.opened = true;
            this.chestSprites[idx].setTexture('chest-open');
            const o = spriteOrigin('chest-open');
            this.chestSprites[idx].setOrigin(o.x, o.y);
            this.chestSprites[idx].setAlpha(0.85);

            // Подсветить пещеру если все собраны
            this.updateCaveGlow();

            if (isCorrect) {
                this.fruits += 1;
                this.correctAnswers += 1;
                playSuccess();
                this.time.delayedCall(350, () => {
                    hideModal(modalQuestion);
                    this.spawnFireworks(this.dino.x, this.dino.y);
                    updateHUD(this.fruits, this.chests.filter(ch => ch.opened).length);
                    this.nudgeDinoAwayFromChest(c);
                    this.paused = false;
                });
            } else {
                playWrong();
                this.time.delayedCall(700, () => {
                    hideModal(modalQuestion);
                    showFeedbackModal(c.correctAnswer, () => {
                        updateHUD(this.fruits, this.chests.filter(ch => ch.opened).length);
                        this.nudgeDinoAwayFromChest(c);
                        this.paused = false;
                    });
                });
            }
        });
    }

    spawnFireworks(x, y) {
        this.fireworks.emitParticleAt(x, y - 14, 30);
    }

    updateCaveGlow() {
        const allOpened = this.chests.every(c => c.opened);
        if (allOpened && !this.caveGlowTween) {
            this.caveGlowTween = this.tweens.add({
                targets: this.caveGlow,
                alpha: { from: 0.3, to: 0.7 },
                scale: { from: 7, to: 9 },
                duration: 900,
                yoyo: true,
                repeat: -1
            });
        }
    }

    nudgeDinoAwayFromChest(chest) {
        const dx = this.dinoLogicalX - chest.x;
        const dy = this.dinoLogicalY - chest.y;
        const d = Math.hypot(dx, dy) || 1;
        const push = 65;
        let nx = chest.x + (dx / d) * push;
        let ny = chest.y + (dy / d) * push;
        if (blockedByObstacle(nx, ny) || !isInsideDiamond(nx, ny, 0.95)) {
            nx = chest.x - (dx / d) * push;
            ny = chest.y - (dy / d) * push;
        }
        this.dinoLogicalX = nx;
        this.dinoLogicalY = ny;
        this.followTarget.x = nx;
        this.followTarget.y = ny;
    }

    finishLevel() {
        if (this.paused) return;
        this.paused = true;
        const correct = this.correctAnswers;
        let stars, title, message;
        if (correct >= 8)      { stars = 3; title = 'Отлично!'; message = 'Анкилозавр прошёл уровень и собрал много фруктов!'; }
        else if (correct >= 6) { stars = 2; title = 'Хорошая работа!'; message = 'Анкилозавр стал ещё умнее!'; }
        else                   { stars = 1; title = 'Молодец!'; message = 'Молодец, что попробовал! В следующий раз собери больше фруктов.'; }

        playWin();
        this.spawnFireworks(this.dino.x, this.dino.y);
        this.time.delayedCall(200, () => this.spawnFireworks(WORLD.cave.x - 80, WORLD.cave.y + 30));
        this.time.delayedCall(400, () => this.spawnFireworks(WORLD.cave.x + 80, WORLD.cave.y + 30));
        this.time.delayedCall(1400, () => {
            showEndScreen(stars, title, message, correct, this.fruits);
        });
    }
}

// ===== Phaser game =====
let game = null;
function startPhaserAndGame() {
    if (!game) {
        game = new Phaser.Game({
            type: Phaser.AUTO,
            parent: 'world',
            width: VIEWPORT.w,
            height: VIEWPORT.h,
            backgroundColor: '#aee9ff',
            scene: [BootScene, GameScene],
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH
            },
            render: { antialias: true, pixelArt: false }
        });
        // Доступ из тестов
        window.__game = game;
    } else {
        game.scene.stop('Game');
        game.scene.start('Game');
    }
}

// ===== UI bindings =====
bindDpad();
renderTitleAnkylo();
showScreen('start');

document.getElementById('btn-start').addEventListener('click', () => {
    initAudio();
    showScreen('play');
    startPhaserAndGame();
});
document.getElementById('btn-play-again').addEventListener('click', () => {
    showScreen('play');
    startPhaserAndGame();
});
document.getElementById('btn-restart').addEventListener('click', () => {
    showScreen('play');
    startPhaserAndGame();
});
