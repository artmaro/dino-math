// ============================================
// Анкилозавр и сундуки с задачками
// Большой изометрический мир, оптимизированный рендеринг
// ============================================

const SVG_NS = 'http://www.w3.org/2000/svg';

// ==== Параметры мира ====
const VIEWPORT = { w: 800, h: 480 };

const WORLD = {
    w: 1800,
    h: 1100,
    diamond: { cx: 900, cy: 550, hw: 850, hh: 425 },
    cave:    { x: 900, y: 165 },
    start:   { x: 900, y: 935 }
};

const RIVER_POINTS = [
    { x:  60, y: 380 },
    { x: 280, y: 340 },
    { x: 500, y: 510 },
    { x: 800, y: 580 },
    { x: 1100, y: 480 },
    { x: 1380, y: 600 },
    { x: 1640, y: 720 },
    { x: 1760, y: 760 }
];
const RIVER_HALF_WIDTH = 36;

const BRIDGES = [
    { x: 380, y: 415, w: 110, h: 110, angle: -28 },
    { x: 1245, y: 540, w: 110, h: 110, angle: 18 }
];

const OBSTACLES = [
    { type: 'boulder', x: 290, y: 700, r: 42 },
    { type: 'boulder', x: 1480, y: 360, r: 38 },
    { type: 'log',     x: 700, y: 280, r: 50, angle: -15 },
    { type: 'log',     x: 1180, y: 820, r: 50, angle: 25 }
];

const TOTAL_CHESTS = 10;

const LEVEL_QUESTIONS = [
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

// ==== Состояние ====
const state = {
    phase: 'start',
    fruits: 0,
    correctAnswers: 0,
    chests: [],
    decorations: [],
    groundPatches: [],
    dinoPos: { x: WORLD.start.x, y: WORLD.start.y },
    cam:     { x: 0, y: 0 },
    facing: 1,
    walking: false,
    currentChestIdx: -1,
    particles: []
};

const input = { up: false, down: false, left: false, right: false };

// ==== DOM ====
const screens = {
    start: document.getElementById('screen-start'),
    play: document.getElementById('screen-play'),
    end: document.getElementById('screen-end')
};
const modalQuestion = document.getElementById('modal-question');
const modalFeedback = document.getElementById('modal-feedback');
const worldSvg = document.getElementById('world');
const layerGround = document.getElementById('layer-ground');
const layerRiver = document.getElementById('layer-river');
const layerCave = document.getElementById('layer-cave');
const layerObjects = document.getElementById('layer-objects');
const layerDino = document.getElementById('layer-dino');
const layerParticles = document.getElementById('layer-particles');
const layerHint = document.getElementById('layer-hint');
const fruitCountEl = document.getElementById('fruit-count');
const chestProgressEl = document.getElementById('chest-progress');
const questionTextEl = document.getElementById('question-text');
const answerOptionsEl = document.getElementById('answer-options');
const feedbackEmojiEl = document.getElementById('feedback-emoji');
const feedbackTextEl = document.getElementById('feedback-text');

let dinoEl = null;
let caveEl = null;
let chestEls = [];

// ==== Утилиты ====
function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
}
function showModal(el) { el.classList.add('active'); }
function hideModal(el) { el.classList.remove('active'); }
function setSVG(parent, html) { parent.innerHTML = html; }

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

function isOnBridge(x, y) {
    for (let i = 0; i < BRIDGES.length; i++) {
        const b = BRIDGES[i];
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) return true;
    }
    return false;
}

function blockedByObstacle(x, y) {
    if (distToRiver(x, y) < RIVER_HALF_WIDTH && !isOnBridge(x, y)) return true;
    for (let i = 0; i < OBSTACLES.length; i++) {
        const o = OBSTACLES[i];
        if (dist(x, y, o.x, o.y) < o.r) return true;
    }
    return false;
}

function tryMove(x, y, nx, ny) {
    if (isInsideDiamond(nx, ny, 0.97) && !blockedByObstacle(nx, ny)) return { x: nx, y: ny };
    if (isInsideDiamond(nx, y, 0.97) && !blockedByObstacle(nx, y)) return { x: nx, y };
    if (isInsideDiamond(x, ny, 0.97) && !blockedByObstacle(x, ny)) return { x, y: ny };
    return { x, y };
}

// ==== Аудио ====
let audioCtx = null;
function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
    } catch (e) { /* без звука */ }
}
function playTone(freq, duration, when = 0, type = 'triangle', volume = 0.18) {
    if (!audioCtx) return;
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
    playTone(523.25, 0.18, 0.00, 'triangle', 0.2);
    playTone(659.25, 0.18, 0.07, 'triangle', 0.2);
    playTone(783.99, 0.18, 0.14, 'triangle', 0.22);
    playTone(1046.50, 0.45, 0.21, 'triangle', 0.25);
}
function playWrong() {
    playTone(330, 0.18, 0.00, 'sine', 0.14);
    playTone(220, 0.30, 0.10, 'sine', 0.14);
}
function playWin() {
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
        playTone(f, 0.5, i * 0.12, 'triangle', 0.22);
    });
}

// ==== Анкилозавр (новый) ====
function ankyloSVG() {
    return `
        <g class="iso-ankylo">
            <ellipse cx="0" cy="18" rx="60" ry="10" fill="rgba(0,0,0,0.4)"/>

            <!-- хвост -->
            <path d="M -36 -2 Q -56 4 -72 14" stroke="#3d5224" stroke-width="18" fill="none" stroke-linecap="round"/>
            <path d="M -36 -2 Q -56 4 -72 14" stroke="#7a9c4a" stroke-width="13" fill="none" stroke-linecap="round"/>
            <path d="M -38 -6 Q -50 0 -64 8" stroke="#9bbe66" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>

            <!-- дубина хвоста -->
            <ellipse cx="-74" cy="14" rx="14" ry="13" fill="url(#dino-armor)"/>
            <ellipse cx="-77" cy="11" rx="6" ry="4" fill="#9bbe66" opacity="0.7"/>
            <path d="M -88 11 L -94 4 L -84 8 Z" fill="#3d5224"/>
            <path d="M -74 -2 L -74 -10 L -68 -2 Z" fill="#3d5224"/>
            <path d="M -64 6 L -60 -2 L -56 6 Z" fill="#3d5224"/>

            <!-- задние ноги -->
            <ellipse cx="-22" cy="16" rx="10" ry="4" fill="#1f2c10"/>
            <rect x="-30" y="2" width="16" height="14" rx="4" fill="#5d7a36"/>
            <rect x="-29" y="3" width="3" height="11" rx="1.5" fill="#7a9c4a" opacity="0.7"/>
            <ellipse cx="22" cy="16" rx="10" ry="4" fill="#1f2c10"/>
            <rect x="14" y="2" width="16" height="14" rx="4" fill="#5d7a36"/>
            <rect x="15" y="3" width="3" height="11" rx="1.5" fill="#7a9c4a" opacity="0.7"/>

            <!-- низ туловища -->
            <ellipse cx="0" cy="2" rx="42" ry="11" fill="#3d5224"/>

            <!-- основное тело (округлая куполообразная форма) -->
            <path d="M -42 -4 Q -46 -34 0 -36 Q 46 -34 42 -4 Q 38 8 0 8 Q -38 8 -42 -4 Z"
                  fill="url(#dino-body)"/>

            <!-- блик солнца сверху-слева -->
            <path d="M -34 -22 Q -28 -32 -10 -34" stroke="#c8e388" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.5"/>
            <path d="M -22 -28 Q -16 -34 -2 -34" stroke="#dfeea0" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6"/>

            <!-- брюхо -->
            <ellipse cx="0" cy="4" rx="32" ry="6" fill="#bfd874" opacity="0.55"/>

            <!-- 5 крупных бронепластин на спине -->
            <ellipse cx="-26" cy="-23" rx="7" ry="6" fill="url(#dino-armor)"/>
            <ellipse cx="-13" cy="-30" rx="9" ry="8" fill="url(#dino-armor)"/>
            <ellipse cx="0"   cy="-33" rx="10" ry="9" fill="url(#dino-armor)"/>
            <ellipse cx="13"  cy="-30" rx="9" ry="8" fill="url(#dino-armor)"/>
            <ellipse cx="26"  cy="-23" rx="7" ry="6" fill="url(#dino-armor)"/>
            <!-- блики на пластинах -->
            <ellipse cx="-27" cy="-26" rx="3" ry="2" fill="#9bbe66" opacity="0.7"/>
            <ellipse cx="-14" cy="-33" rx="4" ry="2.5" fill="#9bbe66" opacity="0.75"/>
            <ellipse cx="-1"  cy="-36" rx="5" ry="3" fill="#a8e07a" opacity="0.85"/>
            <ellipse cx="12"  cy="-33" rx="4" ry="2.5" fill="#9bbe66" opacity="0.75"/>
            <ellipse cx="25"  cy="-26" rx="3" ry="2" fill="#9bbe66" opacity="0.7"/>

            <!-- боковые шипы -->
            <path d="M -42 -16 L -54 -22 L -42 -8 Z" fill="#3d5224"/>
            <path d="M -42 -2 L -54 0 L -42 6 Z" fill="#3d5224"/>
            <path d="M 42 -16 L 54 -22 L 42 -8 Z" fill="#3d5224"/>
            <path d="M 42 -2 L 54 0 L 42 6 Z" fill="#3d5224"/>

            <!-- передние ноги -->
            <ellipse cx="-10" cy="16" rx="10" ry="4" fill="#1f2c10"/>
            <rect x="-18" y="0" width="16" height="16" rx="4" fill="url(#dino-body)"/>
            <rect x="-17" y="1" width="4" height="13" rx="2" fill="#c8e388" opacity="0.7"/>
            <ellipse cx="10" cy="16" rx="10" ry="4" fill="#1f2c10"/>
            <rect x="2" y="0" width="16" height="16" rx="4" fill="url(#dino-body)"/>
            <rect x="3" y="1" width="4" height="13" rx="2" fill="#c8e388" opacity="0.7"/>

            <!-- голова (округлая, наклон вперёд) -->
            <path d="M 30 -10 Q 28 -26 44 -28 Q 60 -28 60 -12 Q 60 4 48 4 Q 32 4 30 -10 Z"
                  fill="url(#dino-body)"/>
            <path d="M 32 -22 Q 38 -28 50 -28" stroke="#c8e388" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.55"/>

            <!-- тень челюсти -->
            <path d="M 32 0 Q 44 6 56 0" stroke="#3d5224" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.5"/>

            <!-- роговой гребень + 2 рога -->
            <path d="M 30 -22 Q 44 -26 58 -22" stroke="#3d5224" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M 32 -22 L 28 -30 L 36 -22 Z" fill="#3d5224"/>
            <path d="M 50 -22 L 54 -30 L 46 -22 Z" fill="#3d5224"/>
            <ellipse cx="32" cy="-29" rx="1.5" ry="1" fill="#5d7a36"/>
            <ellipse cx="52" cy="-29" rx="1.5" ry="1" fill="#5d7a36"/>

            <!-- большой добрый глаз -->
            <ellipse cx="46" cy="-12" rx="5" ry="5.5" fill="#fff"/>
            <ellipse cx="47" cy="-11" rx="3.5" ry="4" fill="#222"/>
            <circle cx="48" cy="-12" r="1.5" fill="#fff"/>
            <circle cx="48.5" cy="-13.5" r="0.6" fill="#fff"/>

            <!-- бровь -->
            <path d="M 40 -19 Q 46 -22 52 -19" stroke="#3d5224" stroke-width="2" fill="none" stroke-linecap="round"/>

            <!-- клювик -->
            <path d="M 56 -4 L 62 -4 L 60 0 Z" fill="#3d5224"/>
            <line x1="56" y1="-2" x2="62" y2="-2" stroke="#1f2c10" stroke-width="0.7"/>

            <!-- ноздря -->
            <ellipse cx="58" cy="-7" rx="0.8" ry="1" fill="#3d5224"/>

            <!-- щёчка -->
            <ellipse cx="42" cy="-2" rx="3.5" ry="2.5" fill="#ff8888" opacity="0.55"/>

            <!-- улыбка -->
            <path d="M 50 0 Q 52 3 55 0" stroke="#3d5224" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </g>`;
}

function pineSVG(x, y) {
    return `
        <g transform="translate(${x}, ${y})">
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

function oakSVG(x, y) {
    return `
        <g transform="translate(${x}, ${y})">
            <ellipse cx="3" cy="5" rx="26" ry="7" fill="rgba(0,0,0,0.32)"/>
            <path d="M -7 4 Q -11 -10 -5 -22 L 5 -22 Q 11 -10 7 4 Z" fill="url(#bark-grad)"/>
            <ellipse cx="-12" cy="-30" rx="16" ry="14" fill="url(#leaves-grad)"/>
            <ellipse cx="14"  cy="-32" rx="17" ry="15" fill="url(#leaves-grad)"/>
            <ellipse cx="0"   cy="-44" rx="22" ry="18" fill="url(#leaves-grad2)"/>
            <ellipse cx="-8"  cy="-52" rx="12" ry="9"  fill="url(#leaves-grad2)"/>
            <ellipse cx="-15" cy="-36" rx="6" ry="4" fill="#a8e07a" opacity="0.45"/>
            <ellipse cx="-3"  cy="-50" rx="6" ry="4" fill="#bff09c" opacity="0.5"/>
            <circle cx="-16" cy="-26" r="2.4" fill="#e85d3a"/>
            <circle cx="18" cy="-30" r="2.4" fill="#e85d3a"/>
            <circle cx="6" cy="-46" r="2.4" fill="#e85d3a"/>
        </g>`;
}

function bushSVG(x, y) {
    return `
        <g transform="translate(${x}, ${y})">
            <ellipse cx="0" cy="3" rx="18" ry="5" fill="rgba(0,0,0,0.3)"/>
            <ellipse cx="-10" cy="-6" rx="11" ry="9" fill="url(#leaves-grad)"/>
            <ellipse cx="10"  cy="-6" rx="11" ry="9" fill="url(#leaves-grad)"/>
            <ellipse cx="0"   cy="-13" rx="12" ry="10" fill="url(#leaves-grad2)"/>
            <ellipse cx="-12" cy="-10" rx="4" ry="2.5" fill="#a8e07a" opacity="0.55"/>
            <circle cx="-5" cy="-9" r="1.8" fill="#ffd166"/>
            <circle cx="6" cy="-11" r="1.8" fill="#ff8888"/>
        </g>`;
}

function rockSmallSVG(x, y) {
    return `
        <g transform="translate(${x}, ${y})">
            <ellipse cx="0" cy="3" rx="14" ry="4" fill="rgba(0,0,0,0.3)"/>
            <ellipse cx="0" cy="-5" rx="13" ry="9" fill="url(#rock-grad)"/>
            <ellipse cx="-3" cy="-9" rx="6" ry="3" fill="#dde1e5" opacity="0.7"/>
            <ellipse cx="-6" cy="-2" rx="3" ry="1.5" fill="#5aa05a" opacity="0.6"/>
        </g>`;
}

function flowerSVG(x, y) {
    return `
        <g transform="translate(${x}, ${y})">
            <line x1="0" y1="2" x2="0" y2="-10" stroke="#3a7a3e" stroke-width="1.5"/>
            <circle cx="0" cy="-12" r="3.5" fill="#ff8888"/>
            <circle cx="-3" cy="-11" r="3" fill="#ff8888"/>
            <circle cx="3" cy="-11" r="3" fill="#ff8888"/>
            <circle cx="0" cy="-15" r="3" fill="#ff8888"/>
            <circle cx="0" cy="-12" r="1.4" fill="#ffd166"/>
        </g>`;
}

function boulderSVG(x, y) {
    return `
        <g transform="translate(${x}, ${y})">
            <ellipse cx="2" cy="10" rx="48" ry="10" fill="rgba(0,0,0,0.4)"/>
            <ellipse cx="0" cy="-8" rx="44" ry="32" fill="url(#rock-grad)"/>
            <ellipse cx="-12" cy="-26" rx="22" ry="12" fill="#cfd3d8" opacity="0.85"/>
            <path d="M -10 0 Q 0 -6 8 -2" stroke="#4a4d50" stroke-width="1.2" fill="none" opacity="0.6"/>
            <path d="M 12 -16 Q 18 -10 16 -2" stroke="#4a4d50" stroke-width="1.2" fill="none" opacity="0.6"/>
            <ellipse cx="-22" cy="-38" rx="10" ry="3" fill="#5aa05a"/>
            <ellipse cx="14" cy="-36" rx="8" ry="2.5" fill="#5aa05a"/>
        </g>`;
}

function logSVG(x, y, angle) {
    return `
        <g transform="translate(${x}, ${y}) rotate(${angle})">
            <ellipse cx="2" cy="14" rx="58" ry="8" fill="rgba(0,0,0,0.35)"/>
            <rect x="-58" y="-14" width="116" height="26" rx="13" fill="url(#bark-grad)"/>
            <rect x="-58" y="-14" width="116" height="6" rx="3" fill="#3a200a" opacity="0.45"/>
            <rect x="-58" y="-14" width="116" height="3" rx="1.5" fill="#a37041" opacity="0.5"/>
            <ellipse cx="-58" cy="-1" rx="9" ry="13" fill="#7a4f1f"/>
            <ellipse cx="-58" cy="-1" rx="6" ry="9" fill="#5b3614"/>
            <ellipse cx="58"  cy="-1" rx="9" ry="13" fill="#7a4f1f"/>
            <ellipse cx="58"  cy="-1" rx="6" ry="9" fill="#5b3614"/>
            <line x1="-30" y1="-12" x2="-30" y2="10" stroke="#3a200a" stroke-width="0.8" opacity="0.6"/>
            <line x1="0" y1="-12" x2="0" y2="10" stroke="#3a200a" stroke-width="0.8" opacity="0.6"/>
            <line x1="30" y1="-12" x2="30" y2="10" stroke="#3a200a" stroke-width="0.8" opacity="0.6"/>
            <ellipse cx="-20" cy="-14" rx="14" ry="3" fill="#5aa05a"/>
            <ellipse cx="22"  cy="-14" rx="11" ry="2.5" fill="#5aa05a"/>
            <g transform="translate(-5, -16)">
                <rect x="-1.5" y="0" width="3" height="5" fill="#f5e6d6"/>
                <ellipse cx="0" cy="0" rx="5" ry="3" fill="#e85d3a"/>
                <circle cx="-2" cy="-1" r="0.7" fill="#fff"/>
                <circle cx="2" cy="-0.5" r="0.6" fill="#fff"/>
            </g>
        </g>`;
}

function bridgeSVG(b) {
    let planks = '';
    for (let i = -45; i <= 45; i += 12) {
        planks += `<line x1="${i}" y1="-30" x2="${i}" y2="30" stroke="#5b3614" stroke-width="1.5"/>`;
    }
    return `
        <g class="bridge" transform="translate(${b.x}, ${b.y}) rotate(${b.angle})">
            <ellipse cx="2" cy="36" rx="60" ry="6" fill="rgba(0,0,0,0.35)"/>
            <rect x="-55" y="-32" width="110" height="64" rx="6" fill="url(#bark-grad)"/>
            <rect x="-55" y="-32" width="110" height="8" fill="#3a200a" opacity="0.4"/>
            <rect x="-55" y="-32" width="110" height="3" fill="#a37041" opacity="0.5"/>
            ${planks}
            <circle cx="-50" cy="-30" r="3" fill="#5b3614"/>
            <circle cx="50"  cy="-30" r="3" fill="#5b3614"/>
            <circle cx="-50" cy="30"  r="3" fill="#5b3614"/>
            <circle cx="50"  cy="30"  r="3" fill="#5b3614"/>
        </g>`;
}

// Сундук содержит ОБА состояния, переключаются через CSS-класс
function chestSVG(index, x, y) {
    return `
        <g class="iso-chest" data-idx="${index}" transform="translate(${x}, ${y})">
            <ellipse cx="0" cy="3" rx="22" ry="5" fill="rgba(0,0,0,0.35)"/>
            <g class="chest-closed">
                <rect x="-20" y="-15" width="40" height="18" rx="3" fill="#a87332" stroke="#5b3614" stroke-width="1.5"/>
                <rect x="-20" y="-7" width="40" height="3" fill="#5b3614"/>
                <path d="M-20 -15 Q-20 -28 0 -28 Q20 -28 20 -15 Z" fill="#c98842" stroke="#5b3614" stroke-width="1.5"/>
                <path d="M-18 -15 Q-18 -25 0 -25" stroke="#deaa68" stroke-width="1.5" fill="none" opacity="0.7"/>
                <rect x="-4" y="-12" width="8" height="9" fill="#ffd166" stroke="#a07020" stroke-width="0.7"/>
                <circle cx="0" cy="-9" r="1.4" fill="#5b3614"/>
                <rect x="-21" y="-15" width="2" height="18" fill="#5b3614"/>
                <rect x="19" y="-15" width="2" height="18" fill="#5b3614"/>
            </g>
            <g class="chest-open">
                <rect x="-20" y="-15" width="40" height="18" rx="3" fill="#a87332" stroke="#5b3614" stroke-width="1.5"/>
                <rect x="-18" y="-15" width="36" height="4" fill="#3d2410"/>
                <path d="M-20 -15 Q-20 -34 0 -38 Q20 -34 20 -20 L20 -15 Z" fill="#c98842" stroke="#5b3614" stroke-width="1.5"/>
                <text x="-9" y="-19" font-size="10" text-anchor="middle">✨</text>
                <text x="7" y="-26" font-size="10" text-anchor="middle">✨</text>
            </g>
        </g>`;
}

function caveSVG() {
    return `
        <g class="cave" transform="translate(${WORLD.cave.x}, ${WORLD.cave.y})">
            <ellipse class="cave-glow" cx="0" cy="25" rx="56" ry="48" fill="#ffd166" opacity="0"/>
            <path d="M -100 70 L -80 -10 L -45 50 L -15 -28 L 5 25 L 35 -35 L 65 30 L 95 -8 L 105 70 Z"
                  fill="url(#rock-grad)" stroke="#5a5e62" stroke-width="2" stroke-linejoin="round"/>
            <polygon points="-80,-10 -75,8 -70,-2 -62,12" fill="#dde4eb"/>
            <polygon points="-15,-28 -10,-12 -20,-12" fill="#dde4eb"/>
            <polygon points="35,-35 40,-18 30,-18" fill="#dde4eb"/>
            <polygon points="95,-8 100,5 90,5" fill="#dde4eb"/>
            <path d="M -36 70 L -36 18 Q -36 -14 0 -14 Q 36 -14 36 18 L 36 70 Z" fill="#1a1a1a"/>
            <ellipse cx="0" cy="42" rx="29" ry="25" fill="#000"/>
            <path d="M-22 -10 L-19 4 L-16 -10 Z" fill="#3a3a3a"/>
            <path d="M-8 -12 L-4 6 L0 -12 Z" fill="#3a3a3a"/>
            <path d="M14 -10 L18 4 L22 -10 Z" fill="#3a3a3a"/>
            <ellipse cx="-44" cy="68" rx="14" ry="6" fill="#9a9a9a"/>
            <ellipse cx="44"  cy="68" rx="15" ry="6" fill="#9a9a9a"/>
            <ellipse cx="-30" cy="70" rx="8" ry="3.5" fill="#aeb1b5"/>
            <ellipse cx="30"  cy="70" rx="8" ry="3.5" fill="#aeb1b5"/>
            <line x1="-16" y1="-32" x2="-16" y2="-58" stroke="#5b3614" stroke-width="2.5"/>
            <line x1="16"  y1="-32" x2="16"  y2="-58" stroke="#5b3614" stroke-width="2.5"/>
            <rect x="-42" y="-86" width="84" height="32" rx="5" fill="#c98842" stroke="#5b3614" stroke-width="2.5"/>
            <rect x="-40" y="-84" width="80" height="6" fill="#deaa68" opacity="0.7"/>
            <text x="0" y="-65" font-family="Comic Sans MS, sans-serif" font-size="18" font-weight="bold"
                  text-anchor="middle" fill="#3d2410">ВЫХОД</text>
        </g>`;
}

// ==== Земля ====
function generateGroundPatches() {
    const patches = [];
    let attempts = 0;
    while (patches.length < 45 && attempts < 500) {
        attempts++;
        const x = WORLD.diamond.cx + (Math.random() - 0.5) * 2 * WORLD.diamond.hw * 0.92;
        const y = WORLD.diamond.cy + (Math.random() - 0.5) * 2 * WORLD.diamond.hh * 0.92;
        if (!isInsideDiamond(x, y, 0.94)) continue;
        patches.push({
            x, y,
            w: 50 + Math.random() * 60,
            h: 25 + Math.random() * 25,
            kind: Math.random() < 0.5 ? 'light' : 'dark'
        });
    }
    return patches;
}

function groundSVG() {
    const d = WORLD.diamond;
    const top    = `${d.cx},${d.cy - d.hh}`;
    const right  = `${d.cx + d.hw},${d.cy}`;
    const bottom = `${d.cx},${d.cy + d.hh}`;
    const left   = `${d.cx - d.hw},${d.cy}`;
    let patchesHtml = '';
    state.groundPatches.forEach(p => {
        const fill = p.kind === 'light' ? '#a8e07a' : '#3f8a25';
        const op = p.kind === 'light' ? 0.18 : 0.22;
        patchesHtml += `<polygon points="${p.x},${p.y - p.h} ${p.x + p.w},${p.y} ${p.x},${p.y + p.h} ${p.x - p.w},${p.y}"
                                 fill="${fill}" opacity="${op}"/>`;
    });
    return `
        <polygon points="${top} ${right} ${bottom} ${left}"
                 fill="url(#grass-grad)" stroke="#2a5e18" stroke-width="3"/>
        <polygon points="${top} ${right} ${bottom} ${left}" fill="url(#iso-grid)"/>
        ${patchesHtml}
        <polygon points="${top} ${right} ${bottom} ${left}" fill="url(#ground-shine)"/>
        <polygon points="${top} ${right} ${bottom} ${left}" fill="url(#ground-vignette)"/>`;
}

function riverSVG() {
    let d = `M ${RIVER_POINTS[0].x} ${RIVER_POINTS[0].y}`;
    for (let i = 1; i < RIVER_POINTS.length - 1; i++) {
        const p = RIVER_POINTS[i];
        const next = RIVER_POINTS[i + 1];
        const mx = (p.x + next.x) / 2;
        const my = (p.y + next.y) / 2;
        d += ` Q ${p.x} ${p.y} ${mx} ${my}`;
    }
    const last = RIVER_POINTS[RIVER_POINTS.length - 1];
    d += ` L ${last.x} ${last.y}`;
    let html = `<path d="${d}" stroke="#6a8a3d" stroke-width="${RIVER_HALF_WIDTH * 2 + 16}" fill="none" stroke-linecap="round" opacity="0.5"/>`;
    html += `<path d="${d}" stroke="url(#water-edge)" stroke-width="${RIVER_HALF_WIDTH * 2 + 4}" fill="none" stroke-linecap="round"/>`;
    html += `<path d="${d}" stroke="url(#water-grad)" stroke-width="${RIVER_HALF_WIDTH * 2 - 6}" fill="none" stroke-linecap="round"/>`;
    html += `<path d="${d}" stroke="#e6f4fb" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.6" stroke-dasharray="6 18"/>`;
    BRIDGES.forEach(b => { html += bridgeSVG(b); });
    return html;
}

// ==== Размещение ====
function generateChests() {
    const chests = [];
    const questions = shuffle(LEVEL_QUESTIONS);
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

function generateDecorations(chests) {
    const decor = [];
    const types = ['pine', 'pine', 'oak', 'oak', 'oak', 'bush', 'bush', 'rockSmall', 'flower', 'flower'];
    let attempts = 0;
    const target = 42; // снизили с 65 ради производительности
    while (decor.length < target && attempts < 2000) {
        attempts++;
        const x = WORLD.diamond.cx + (Math.random() - 0.5) * 2 * WORLD.diamond.hw * 0.97;
        const y = WORLD.diamond.cy + (Math.random() - 0.5) * 2 * WORLD.diamond.hh * 0.97;
        if (!isInsideDiamond(x, y, 0.96)) continue;
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

// ==== Рендеринг (один раз за уровень) ====
function renderWorldOnce() {
    setSVG(layerGround, groundSVG());
    setSVG(layerRiver, riverSVG());
    setSVG(layerCave, caveSVG());
    caveEl = layerCave.querySelector('.cave');

    // Все объекты с сортировкой по y
    const items = [
        ...state.decorations.map(d => ({ kind: 'decor', y: d.y, data: d })),
        ...OBSTACLES.map(o => ({ kind: 'obstacle', y: o.y, data: o })),
        ...state.chests.map((c, i) => ({ kind: 'chest', y: c.y, data: c, index: i }))
    ].sort((a, b) => a.y - b.y);

    let html = '';
    items.forEach(item => {
        if (item.kind === 'decor') {
            const { x, y, type } = item.data;
            if (type === 'pine')      html += pineSVG(x, y);
            else if (type === 'oak')  html += oakSVG(x, y);
            else if (type === 'bush') html += bushSVG(x, y);
            else if (type === 'rockSmall') html += rockSmallSVG(x, y);
            else if (type === 'flower') html += flowerSVG(x, y);
        } else if (item.kind === 'obstacle') {
            const o = item.data;
            if (o.type === 'boulder') html += boulderSVG(o.x, o.y);
            else if (o.type === 'log') html += logSVG(o.x, o.y, o.angle);
        } else {
            const c = item.data;
            html += chestSVG(item.index, c.x, c.y);
        }
    });
    setSVG(layerObjects, html);

    // Кэшируем ссылки на сундуки
    chestEls = [];
    for (let i = 0; i < state.chests.length; i++) {
        chestEls[i] = layerObjects.querySelector(`.iso-chest[data-idx="${i}"]`);
    }

    setSVG(layerDino, `<g id="dino-anchor" transform="translate(${state.dinoPos.x}, ${state.dinoPos.y})">${ankyloSVG()}</g>`);
    dinoEl = document.getElementById('dino-anchor');
    setSVG(layerHint, '');
    setSVG(layerParticles, '');
}

function renderTitleAnkylo() {
    const titleSvg = document.querySelector('.title-ankylo');
    if (titleSvg) {
        titleSvg.setAttribute('viewBox', '-100 -42 175 70');
        titleSvg.innerHTML = ankyloSVG();
    }
}

function markChestOpened(index) {
    const el = chestEls[index];
    if (el) el.classList.add('opened');
    if (caveEl) caveEl.classList.toggle('ready', allChestsOpened());
}

function updateDinoTransform() {
    if (!dinoEl) return;
    const bob = state.walking ? Math.sin(performance.now() / 70) * 1.8 : 0;
    const sx = state.facing === -1 ? -1 : 1;
    dinoEl.setAttribute('transform',
        `translate(${state.dinoPos.x.toFixed(1)}, ${(state.dinoPos.y + bob).toFixed(1)}) scale(${sx}, 1)`);
}

let lastViewBox = '';
function updateCamera() {
    let camX = state.dinoPos.x - VIEWPORT.w / 2;
    let camY = state.dinoPos.y - VIEWPORT.h / 2;
    camX = Math.max(0, Math.min(WORLD.w - VIEWPORT.w, camX));
    camY = Math.max(0, Math.min(WORLD.h - VIEWPORT.h, camY));
    state.cam.x += (camX - state.cam.x) * 0.18;
    state.cam.y += (camY - state.cam.y) * 0.18;
    const vb = `${state.cam.x.toFixed(0)} ${state.cam.y.toFixed(0)} ${VIEWPORT.w} ${VIEWPORT.h}`;
    if (vb !== lastViewBox) {
        worldSvg.setAttribute('viewBox', vb);
        lastViewBox = vb;
    }
}

function updateHUD() {
    fruitCountEl.textContent = state.fruits;
    chestProgressEl.textContent = state.chests.filter(c => c.opened).length;
}

function allChestsOpened() {
    return state.chests.length === TOTAL_CHESTS && state.chests.every(c => c.opened);
}

// ==== Частицы ====
function spawnFireworks(x, y) {
    const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#ff8c42', '#ffffff'];
    const count = 24;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 1.8 + Math.random() * 3;
        const el = document.createElementNS(SVG_NS, 'circle');
        el.setAttribute('cx', x);
        el.setAttribute('cy', y - 14);
        el.setAttribute('r', 2.5 + Math.random() * 2.5);
        el.setAttribute('fill', colors[Math.floor(Math.random() * colors.length)]);
        layerParticles.appendChild(el);
        state.particles.push({
            el, x, y: y - 14,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
            life: 60 + Math.random() * 25, maxLife: 75
        });
    }
    for (let i = 0; i < 8; i++) {
        const sx = x + (Math.random() - 0.5) * 30;
        const sy = y - 20;
        const el = document.createElementNS(SVG_NS, 'text');
        el.setAttribute('x', sx); el.setAttribute('y', sy);
        el.setAttribute('font-size', '16'); el.setAttribute('text-anchor', 'middle');
        el.textContent = '⭐';
        layerParticles.appendChild(el);
        state.particles.push({
            el, x: sx, y: sy,
            vx: (Math.random() - 0.5) * 4, vy: -2.5 - Math.random() * 2,
            life: 55, maxLife: 55, isText: true
        });
    }
}
function updateParticles() {
    if (state.particles.length === 0) return;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.vy += 0.13;
        p.x += p.vx; p.y += p.vy; p.life -= 1;
        if (p.isText) { p.el.setAttribute('x', p.x.toFixed(1)); p.el.setAttribute('y', p.y.toFixed(1)); }
        else          { p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1)); }
        p.el.setAttribute('opacity', Math.max(0, p.life / p.maxLife).toFixed(2));
        if (p.life <= 0) { p.el.remove(); state.particles.splice(i, 1); }
    }
}

// ==== Игровой цикл ====
let lastTime = 0;
function gameLoop(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    if (state.phase === 'playing') {
        updateMovement(dt);
        checkChestProximity();
        checkCaveProximity();
    }
    updateParticles();
    if (state.phase === 'playing' || state.phase === 'feedback') updateCamera();
    requestAnimationFrame(gameLoop);
}

function updateMovement(dt) {
    let dx = 0, dy = 0;
    if (input.up)    dy -= 1;
    if (input.down)  dy += 1;
    if (input.left)  dx -= 1;
    if (input.right) dx += 1;

    if (dx === 0 && dy === 0) {
        if (state.walking) { state.walking = false; updateDinoTransform(); }
        return;
    }
    state.walking = true;
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    const speed = 0.26;
    const nx = state.dinoPos.x + dx * speed * dt;
    const ny = state.dinoPos.y + dy * speed * dt;
    const next = tryMove(state.dinoPos.x, state.dinoPos.y, nx, ny);
    state.dinoPos.x = next.x;
    state.dinoPos.y = next.y;

    if (dx > 0) state.facing = 1;
    else if (dx < 0) state.facing = -1;

    updateDinoTransform();
}

function checkChestProximity() {
    for (let i = 0; i < state.chests.length; i++) {
        const c = state.chests[i];
        if (c.opened) continue;
        if (dist(state.dinoPos.x, state.dinoPos.y, c.x, c.y) < 50) {
            state.currentChestIdx = i;
            openChest();
            return;
        }
    }
}

function checkCaveProximity() {
    if (dist(state.dinoPos.x, state.dinoPos.y, WORLD.cave.x, WORLD.cave.y) < 80) {
        finishLevel();
    }
}

// ==== Сундук и ответ ====
function openChest() {
    state.phase = 'question';
    const c = state.chests[state.currentChestIdx];
    questionTextEl.textContent = c.question;
    answerOptionsEl.innerHTML = '';
    c.options.forEach((option, i) => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = option;
        btn.setAttribute('data-key', i + 1);
        btn.addEventListener('click', () => handleAnswer(option, btn));
        answerOptionsEl.appendChild(btn);
    });
    showModal(modalQuestion);
}

function handleAnswer(selected, btnEl) {
    if (state.phase !== 'question') return;
    const c = state.chests[state.currentChestIdx];
    const isCorrect = selected === c.correctAnswer;

    answerOptionsEl.querySelectorAll('.answer-btn').forEach(b => {
        b.disabled = true;
        const value = Number(b.textContent);
        if (value === c.correctAnswer) b.classList.add('correct');
        else if (b === btnEl && !isCorrect) b.classList.add('wrong');
    });

    c.opened = true;
    markChestOpened(state.currentChestIdx);

    if (isCorrect) {
        state.fruits += 1;
        state.correctAnswers += 1;
        state.phase = 'feedback';
        playSuccess();
        setTimeout(() => {
            hideModal(modalQuestion);
            spawnFireworks(state.dinoPos.x, state.dinoPos.y);
            updateHUD();
            nudgeDinoAwayFromChest(c);
            state.phase = 'playing';
        }, 350);
    } else {
        state.phase = 'feedback';
        playWrong();
        setTimeout(() => {
            hideModal(modalQuestion);
            showFeedback(c.correctAnswer);
        }, 700);
    }
}

function nudgeDinoAwayFromChest(chest) {
    const dx = state.dinoPos.x - chest.x;
    const dy = state.dinoPos.y - chest.y;
    const d = Math.hypot(dx, dy) || 1;
    const push = 60;
    let nx = chest.x + (dx / d) * push;
    let ny = chest.y + (dy / d) * push;
    if (blockedByObstacle(nx, ny) || !isInsideDiamond(nx, ny, 0.95)) {
        nx = chest.x - (dx / d) * push;
        ny = chest.y - (dy / d) * push;
    }
    state.dinoPos.x = nx; state.dinoPos.y = ny;
    updateDinoTransform();
}

function showFeedback(correctAnswer) {
    feedbackEmojiEl.textContent = '🌟';
    feedbackTextEl.textContent = `Почти получилось! Правильный ответ: ${correctAnswer}`;
    showModal(modalFeedback);
}

function nextStep() {
    hideModal(modalFeedback);
    const c = state.chests[state.currentChestIdx];
    updateHUD();
    nudgeDinoAwayFromChest(c);
    state.phase = 'playing';
}

// ==== Завершение ====
function finishLevel() {
    state.phase = 'level_complete';
    const correct = state.correctAnswers;
    let stars, title, message;
    if (correct >= 8)      { stars = 3; title = 'Отлично!'; message = 'Анкилозавр прошёл уровень и собрал много фруктов!'; }
    else if (correct >= 6) { stars = 2; title = 'Хорошая работа!'; message = 'Анкилозавр стал ещё умнее!'; }
    else                   { stars = 1; title = 'Молодец!'; message = 'Молодец, что попробовал! В следующий раз собери больше фруктов.'; }

    playWin();
    spawnFireworks(state.dinoPos.x, state.dinoPos.y);
    setTimeout(() => spawnFireworks(WORLD.cave.x - 80, WORLD.cave.y + 30), 200);
    setTimeout(() => spawnFireworks(WORLD.cave.x + 80, WORLD.cave.y + 30), 400);

    setTimeout(() => {
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
        document.getElementById('end-fruits').textContent = state.fruits;
        showScreen('end');
    }, 1400);
}

// ==== Старт уровня ====
function startLevel() {
    initAudio();
    state.phase = 'playing';
    state.fruits = 0;
    state.correctAnswers = 0;
    state.dinoPos = { x: WORLD.start.x, y: WORLD.start.y };
    state.cam = { x: state.dinoPos.x - VIEWPORT.w / 2, y: state.dinoPos.y - VIEWPORT.h / 2 };
    state.cam.x = Math.max(0, Math.min(WORLD.w - VIEWPORT.w, state.cam.x));
    state.cam.y = Math.max(0, Math.min(WORLD.h - VIEWPORT.h, state.cam.y));
    state.facing = 1;
    state.walking = false;
    state.particles.forEach(p => p.el.remove());
    state.particles.length = 0;
    lastViewBox = '';

    state.groundPatches = generateGroundPatches();
    state.chests = generateChests();
    state.decorations = generateDecorations(state.chests);

    renderWorldOnce();
    updateCamera();
    updateDinoTransform();
    updateHUD();
    showScreen('play');
}

// ==== Управление ====
const dirs = ['up', 'down', 'left', 'right'];

document.addEventListener('keydown', (e) => {
    const k = e.key;

    // Шорткаты ответов 1/2/3 — приоритетнее всего, когда модалка задачи активна
    if (state.phase === 'question' && modalQuestion.classList.contains('active')) {
        let idx = -1;
        if (k === '1') idx = 0;
        else if (k === '2') idx = 1;
        else if (k === '3') idx = 2;
        if (idx >= 0) {
            const btns = answerOptionsEl.querySelectorAll('.answer-btn');
            const btn = btns[idx];
            if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
        }
        return;
    }

    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'ц' || k === 'Ц') { input.up = true; e.preventDefault(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'ы' || k === 'Ы') { input.down = true; e.preventDefault(); }
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') { input.left = true; e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') { input.right = true; e.preventDefault(); }
    else if ((k === 'Enter' || k === ' ') && state.phase === 'feedback' && modalFeedback.classList.contains('active')) {
        e.preventDefault(); nextStep();
    }
});
document.addEventListener('keyup', (e) => {
    const k = e.key;
    if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'ц' || k === 'Ц') input.up = false;
    else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'ы' || k === 'Ы') input.down = false;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') input.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В') input.right = false;
});

function bindDpad() {
    dirs.forEach(dir => {
        const btn = document.querySelector(`.dpad-${dir}`);
        if (!btn) return;
        const press = (e) => { e.preventDefault(); input[dir] = true; btn.classList.add('pressed'); };
        const release = () => { input[dir] = false; btn.classList.remove('pressed'); };
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointerleave', release);
        btn.addEventListener('pointercancel', release);
    });
    window.addEventListener('pointerup', () => {
        dirs.forEach(d => {
            input[d] = false;
            const btn = document.querySelector(`.dpad-${d}`);
            if (btn) btn.classList.remove('pressed');
        });
    });
    window.addEventListener('blur', () => { dirs.forEach(d => input[d] = false); });
}

// ==== Кнопки ====
document.getElementById('btn-start').addEventListener('click', () => { initAudio(); startLevel(); });
document.getElementById('btn-next').addEventListener('click', nextStep);
document.getElementById('btn-play-again').addEventListener('click', startLevel);
document.getElementById('btn-restart').addEventListener('click', startLevel);

// ==== Старт ====
bindDpad();
renderTitleAnkylo();
showScreen('start');
requestAnimationFrame(gameLoop);
