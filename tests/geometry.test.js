import { describe, it, expect } from 'vitest';
import {
    dist,
    isInsideDiamond,
    distToSegment,
    distToPolyline,
    isOnRect,
    isOnAnyBridge,
    isBlockedBy,
    shuffle
} from '../src/geometry.js';

describe('dist', () => {
    it('returns euclidean distance between points', () => {
        expect(dist(0, 0, 3, 4)).toBe(5);
        expect(dist(1, 1, 1, 1)).toBe(0);
        expect(dist(-2, -3, 1, 1)).toBe(5);
    });
});

describe('isInsideDiamond', () => {
    const d = { cx: 100, cy: 100, hw: 50, hh: 25 };
    it('returns true for center', () => {
        expect(isInsideDiamond(100, 100, d)).toBe(true);
    });
    it('returns true at corners (within tolerance)', () => {
        expect(isInsideDiamond(150, 100, d)).toBe(true);
        expect(isInsideDiamond(50, 100, d)).toBe(true);
        expect(isInsideDiamond(100, 125, d)).toBe(true);
        expect(isInsideDiamond(100, 75, d)).toBe(true);
    });
    it('returns false outside the diamond', () => {
        expect(isInsideDiamond(160, 100, d)).toBe(false);
        expect(isInsideDiamond(100, 130, d)).toBe(false);
    });
    it('respects margin', () => {
        // Точка ровно на границе при margin=1.0, должна быть снаружи при margin=0.5
        expect(isInsideDiamond(150, 100, d, 1.0)).toBe(true);
        expect(isInsideDiamond(150, 100, d, 0.5)).toBe(false);
    });
});

describe('distToSegment', () => {
    it('distance from point to closest segment point', () => {
        const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
        expect(distToSegment(5, 3, a, b)).toBe(3); // выше середины
        expect(distToSegment(-5, 0, a, b)).toBe(5); // слева от a
        expect(distToSegment(15, 0, a, b)).toBe(5); // справа от b
        expect(distToSegment(5, 0, a, b)).toBe(0);  // на отрезке
    });
});

describe('distToPolyline', () => {
    it('returns min distance to polyline', () => {
        const points = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
        ];
        expect(distToPolyline(5, 0, points)).toBe(0);
        expect(distToPolyline(5, 5, points)).toBe(5);
        expect(distToPolyline(20, 5, points)).toBe(10);
    });
});

describe('isOnRect / isOnAnyBridge', () => {
    it('detects point inside a rect', () => {
        const r = { x: 100, y: 100, w: 40, h: 40 };
        expect(isOnRect(100, 100, r)).toBe(true);
        expect(isOnRect(115, 115, r)).toBe(true);
        expect(isOnRect(125, 100, r)).toBe(false);
    });
    it('isOnAnyBridge checks all bridges', () => {
        const bridges = [
            { x: 0, y: 0, w: 20, h: 20 },
            { x: 100, y: 100, w: 20, h: 20 }
        ];
        expect(isOnAnyBridge(0, 0, bridges)).toBe(true);
        expect(isOnAnyBridge(100, 100, bridges)).toBe(true);
        expect(isOnAnyBridge(50, 50, bridges)).toBe(false);
    });
});

describe('isBlockedBy', () => {
    const opts = {
        riverPoints: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
        riverHalfWidth: 10,
        bridges: [{ x: 50, y: 50, w: 30, h: 30 }],
        obstacles: [{ x: 200, y: 200, r: 20 }]
    };

    it('blocks crossing the river outside bridge', () => {
        expect(isBlockedBy(20, 50, opts)).toBe(true);
    });
    it('lets through on a bridge', () => {
        expect(isBlockedBy(50, 50, opts)).toBe(false);
    });
    it('blocks at obstacle', () => {
        expect(isBlockedBy(200, 200, opts)).toBe(true);
        expect(isBlockedBy(215, 200, opts)).toBe(true);
        expect(isBlockedBy(225, 200, opts)).toBe(false);
    });
    it('lets through on open ground', () => {
        expect(isBlockedBy(300, 300, opts)).toBe(false);
    });
});

describe('shuffle', () => {
    it('keeps the same elements', () => {
        const original = [1, 2, 3, 4, 5];
        const shuffled = shuffle(original);
        expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    });
    it('does not mutate input', () => {
        const original = [1, 2, 3];
        shuffle(original);
        expect(original).toEqual([1, 2, 3]);
    });
});
