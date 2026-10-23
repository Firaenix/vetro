'use strict';

/*
 * Generates the glass assets for the native launcher.
 *
 * EFL has no backdrop blur, so "glass" is faked with layered translucency:
 * a cool tint, a top specular highlight and a bright rim, plus a soft drop
 * shadow for depth, and a top-rounded sheet background.
 *
 *   node tools/make-glass.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SS = 3;

function inside(px, py, W, H, rtl, rtr, rbr, rbl) {
    if (px < 0 || px > W || py < 0 || py > H) return false;
    let cx, cy, r;
    if (px < rtl && py < rtl) { cx = rtl; cy = rtl; r = rtl; }
    else if (px > W - rtr && py < rtr) { cx = W - rtr; cy = rtr; r = rtr; }
    else if (px > W - rbr && py > H - rbr) { cx = W - rbr; cy = H - rbr; r = rbr; }
    else if (px < rbl && py > H - rbl) { cx = rbl; cy = H - rbl; r = rbl; }
    else return true;
    const dx = px - cx, dy = py - cy;
    return dx * dx + dy * dy <= r * r;
}

// approximate distance from the rounded-rect boundary (positive inside)
function edgeDist(px, py, W, H, rtl, rtr, rbr, rbl) {
    const dEdges = Math.min(px, W - px, py, H - py);
    let dCorner = Infinity;
    // sx/sy: which side of the corner centre belongs to that corner's quadrant (-1 left/top, +1 right/bottom)
    const corners = [[rtl, rtl, rtl, -1, -1], [W - rtr, rtr, rtr, 1, -1], [W - rbr, H - rbr, rbr, 1, 1], [rbl, H - rbl, rbl, -1, 1]];
    for (const [cx, cy, r, sx, sy] of corners) {
        // only the quadrant that holds the actual corner: otherwise the circle outline shows up inside the tile
        if (r > 0 && (px - cx) * sx >= 0 && (py - cy) * sy >= 0 && (px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r + 1) {
            // in/near this corner circle
            dCorner = Math.min(dCorner, r - Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)));
        }
    }
    return Math.min(dEdges, dCorner);
}

function over(dst, src) { // src over dst, colors 0..255, alpha 0..1
    const a = src[3] + dst[3] * (1 - src[3]);
    if (a <= 0) return [0, 0, 0, 0];
    const r = (src[0] * src[3] + dst[0] * dst[3] * (1 - src[3])) / a;
    const g = (src[1] * src[3] + dst[1] * dst[3] * (1 - src[3])) / a;
    const b = (src[2] * src[3] + dst[2] * dst[3] * (1 - src[3])) / a;
    return [r, g, b, a];
}

function renderPng(name, W, H, radii, shade) {
    const out = Buffer.alloc(W * H * 4);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            let pr = 0, pg = 0, pb = 0, pa = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const px = (x * SS + sx + 0.5) / SS;
                    const py = (y * SS + sy + 0.5) / SS;
                    const col = shade(px, py); // [r,g,b,a] or null
                    if (col) { pr += col[0] * col[3]; pg += col[1] * col[3]; pb += col[2] * col[3]; pa += col[3]; }
                }
            }
            const n = SS * SS;
            const a = pa / n;
            const o = (y * W + x) * 4;
            if (a > 0) {
                out[o] = Math.round(Math.min(255, pr / pa));
                out[o + 1] = Math.round(Math.min(255, pg / pa));
                out[o + 2] = Math.round(Math.min(255, pb / pa));
            }
            out[o + 3] = Math.round(Math.min(1, a) * 255);
        }
    }
    writePng(path.join(__dirname, '..', 'res', name + '.png'), W, H, out);
    console.log('wrote res/' + name + '.png');
}

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
}
function writePng(file, W, H, rgba) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
    const stride = W * 4;
    const raw = Buffer.alloc((stride + 1) * H);
    for (let y = 0; y < H; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
    fs.writeFileSync(file, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

const S = 256, R = 60;

function glass(focus, rad, size) {
    const R = rad || 60;
    const S = size || 256;   // shadows the file-level S so the same look renders at any square size
    return (px, py) => {
        if (!inside(px, py, S, S, R, R, R, R)) return null;
        const t = py / S;
        const d = edgeDist(px, py, S, S, R, R, R, R);
        let col = [0, 0, 0, 0];
        // tinted base
        const baseA = focus ? (0.30 - 0.12 * t) : (0.20 - 0.08 * t);
        col = over(col, [150, 170, 205, Math.max(0, baseA)]);
        // cool accent on focus
        if (focus) col = over(col, [175, 200, 255, 0.08]);
        // specular top-left
        const sx = px - S * 0.26, sy = py - S * 0.04;
        const sd = Math.sqrt(sx * sx + sy * sy) / (S * 0.55);
        if (sd < 1) col = over(col, [255, 255, 255, (focus ? 0.42 : 0.30) * (1 - sd) * (1 - sd)]);
        // rim
        if (d < 2.4) col = over(col, [255, 255, 255, (focus ? 0.55 : 0.28) * (1 - d / 2.4)]);
        return col;
    };
}

// Soft glow behind the focused icon, drawn at its final size (FocusIcon + 2 * HighlightPad) so it is never scaled.
// The rounded square is the icon's own outline; alpha falls off with the distance outside it.
function focusGlowBox(w, h, iw, ih, rad) {
    const hx = iw / 2, hy = ih / 2, reach = (w - iw) / 2, peak = 0.46;
    return (px, py) => {
        const qx = Math.abs(px - w / 2) - (hx - rad), qy = Math.abs(py - h / 2) - (hy - rad);
        const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
        if (sdf >= reach) return null;
        const a = peak * Math.pow(1 - Math.max(0, sdf) / reach, 2.3);
        return a > 0.002 ? [226, 237, 255, a] : null;
    };
}

function focusGlow(size, icon, rad) {
    const half = icon / 2, reach = (size - icon) / 2, peak = 0.46;
    return (px, py) => {
        const qx = Math.abs(px - size / 2) - (half - rad), qy = Math.abs(py - size / 2) - (half - rad);
        const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;   // >0 outside
        if (sdf >= reach) return null;
        const t = Math.max(0, sdf) / reach;
        const a = peak * Math.pow(1 - t, 2.3);
        return a > 0.002 ? [226, 237, 255, a] : null;
    };
}

// Soft drop shadow for the dock pill. The shape edge sits M px inside the asset and has the pill's
// corner radius, so a 9-slice border of M + RR (66) holds the whole corner curve and the shadow
// follows the pill instead of showing a squared box. Alpha is 1-minus-smoothstep of the outside distance.
function shadow() {
    const M = 20, RR = 46, blur = 18, peak = 0.22;
    const hw = S / 2 - M, hh = S / 2 - M;
    return (px, py) => {
        const qx = Math.abs(px - S / 2) - (hw - RR), qy = Math.abs(py - S / 2) - (hh - RR);
        const sdf = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - RR; // >0 outside
        if (sdf >= blur) return null;
        const t = Math.max(0, Math.min(1, sdf / blur));
        const a = peak * (1 - t * t * (3 - 2 * t));
        return a > 0.001 ? [0, 0, 0, a] : null;
    };
}

function sheet() {
    const R2 = 46;
    return (px, py) => {
        if (!inside(px, py, S, S, R2, R2, 0, 0)) return null;
        const t = py / S;
        let col = [0, 0, 0, 0];
        col = over(col, [22, 28, 40, 0.72 + 0.20 * t]);
        const d = edgeDist(px, py, S, S, R2, R2, 0, 0);
        if (d < 2.4) col = over(col, [255, 255, 255, 0.30 * (1 - d / 2.4)]);
        if (py < 8) col = over(col, [255, 255, 255, 0.22 * (1 - py / 8)]);
        return col;
    };
}

// fully rounded dock pill (the bottom bar background)
function dock() {
    const R3 = 46;
    return (px, py) => {
        if (!inside(px, py, S, S, R3, R3, R3, R3)) return null;
        const t = py / S;
        let col = [0, 0, 0, 0];
        // thin, cool tint instead of a near-opaque dark slab: the picture behind still reads through
        col = over(col, [30, 40, 62, 0.50 + 0.14 * t]);
        // sheen: the upper part of the pane is lit, like light catching glass
        if (t < 0.55) col = over(col, [255, 255, 255, 0.13 * Math.pow(1 - t / 0.55, 1.6)]);
        // soft glow gathered along the lower edge
        if (t > 0.78) col = over(col, [170, 200, 255, 0.07 * ((t - 0.78) / 0.22)]);
        const d = edgeDist(px, py, S, S, R3, R3, R3, R3);
        // bright rim, stronger on top where the light comes from
        if (d < 2.6) col = over(col, [255, 255, 255, (0.30 + 0.30 * (1 - t)) * (1 - d / 2.6)]);
        // faint inner rim just inside it
        else if (d < 6) col = over(col, [255, 255, 255, 0.05 * (1 - (d - 2.6) / 3.4)]);
        if (py < 10) col = over(col, [255, 255, 255, 0.16 * (1 - py / 10)]);
        return col;
    };
}

// Chevron stroke after the hint word: two segments with round caps, white, with a soft dark halo so it reads
// over bright video without a backing shape. 24x24 cell. dir -1 points up, +1 down.
function chevron(dir) {
    const half = 1.7;
    const a = [4.5, 15.5 - (dir > 0 ? 0 : 0)], b = [12, 8.5], c = [19.5, 15.5];
    const pts = dir < 0 ? [a, b, c] : [[4.5, 8.5], [12, 15.5], [19.5, 8.5]];
    const seg = (px, py, p, q) => {
        const vx = q[0] - p[0], vy = q[1] - p[1];
        let u = ((px - p[0]) * vx + (py - p[1]) * vy) / (vx * vx + vy * vy);
        u = Math.max(0, Math.min(1, u));
        return Math.hypot(px - (p[0] + u * vx), py - (p[1] + u * vy));
    };
    return (px, py) => {
        const d = Math.min(seg(px, py, pts[0], pts[1]), seg(px, py, pts[1], pts[2]));
        if (d <= half) return [255, 255, 255, 1];
        const h = d - half;                       // halo: 3 px of falling black
        return h < 3 ? [0, 0, 0, 0.5 * (1 - h / 3) * (1 - h / 3)] : null;
    };
}

renderPng('chev_up', 24, 24, [0, 0, 0, 0], chevron(-1));
renderPng('chev_down', 24, 24, [0, 0, 0, 0], chevron(1));

renderPng('glass_tile', S, S, [R, R, R, R], glass(false));
renderPng('glass_tile_focus', S, S, [R, R, R, R], glass(true));
renderPng('shadow', S, S, [0, 0, 0, 0], shadow());
renderPng('sheet_bg', S, S, [46, 46, 0, 0], sheet());
renderPng('dock_glow', 180, 180, [0, 0, 0, 0], focusGlow(180, 132, 30));   // 180 = FocusIcon + 2 * HighlightPad
renderPng('dock_glow_pill', 352, 120, [0, 0, 0, 0], focusGlowBox(352, 120, 304, 72, 36));   // pinned pills: FocusIcon-like final size, capsule outline
renderPng('dock_bg', S, S, [46, 46, 46, 46], dock());

// soft radial glow for the focused item
renderPng('glow', S, S, [0, 0, 0, 0],
    (px, py) => {
        const cx = px - S / 2, cy = py - S / 2;
        const r = Math.sqrt(cx * cx + cy * cy) / (S / 2);
        if (r >= 1) return null;
        const a = (1 - r) * (1 - r) * 0.82;
        return [178, 205, 255, a];
    });

// white squircle alpha mask for rounding the app icons
{
    const R2 = 58;
    renderPng('mask', S, S, [R2, R2, R2, R2],
        (px, py) => inside(px, py, S, S, R2, R2, R2, R2) ? [255, 255, 255, 1] : null);
}
