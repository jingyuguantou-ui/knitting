const Texture = (() => {
  const SHEET_CELL_W = 108, SHEET_CELL_H = 92;
  const LOGIC_PAD = 22, LOGIC_W = 64, LOGIC_H = 48;
  const structureSheet = document.createElement("canvas");
  const lightSheet = document.createElement("canvas");
  const reliefSheet = document.createElement("canvas");
  structureSheet.width = SHEET_CELL_W * 8;
  structureSheet.height = SHEET_CELL_H;
  lightSheet.width = SHEET_CELL_W * 8;
  lightSheet.height = SHEET_CELL_H;
  reliefSheet.width = SHEET_CELL_W * 8;
  reliefSheet.height = SHEET_CELL_H;
  const tileCache = new Map();
  const TILE_CACHE_MAX = 1600;
  let built = false;

  function rf(e, t) {
    const n = Math.sin(e * 12.9898 + t * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
  function af(e, t) {
    return Math.floor(rf(e, t) * 32) % 32;
  }
  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRgb(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function srgbToLinear8(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function linearToSrgb8(v) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return clamp255(Math.round(s * 255));
  }
  function defaultRamp(hex) {
    const rgb = hexToRgb(hex);
    const L = [srgbToLinear8(rgb[0]), srgbToLinear8(rgb[1]), srgbToLinear8(rgb[2])];
    const absorb = (f) => L.map((v) => linearToSrgb8(v * f));
    return [
      absorb(0.16),
      absorb(0.42),
      absorb(0.70),
      absorb(0.88),
      rgb
    ];
  }
  function rampAt(ramp, t) {
    const r = Math.max(0, Math.min(0.999, t)) * (ramp.length - 1);
    const i = Math.floor(r);
    const j = Math.min(ramp.length - 1, i + 1);
    return mixRgb(ramp[i], ramp[j], r - i);
  }
  function shadeColor(hex, amt) {
    const rgb = hexToRgb(hex);
    if (amt >= 0) {
      const out = rgb.map((c) => {
        const l = srgbToLinear8(c);
        return linearToSrgb8(l + (1 - l) * amt);
      });
      return "rgb(" + out[0] + "," + out[1] + "," + out[2] + ")";
    }
    const k = -amt;
    return "rgb(" + Math.round(rgb[0] * (1 - k)) + "," +
      Math.round(rgb[1] * (1 - k)) + "," +
      Math.round(rgb[2] * (1 - k)) + ")";
  }

  function bezierPt(p0, p1, p2, t) {
    const u = 1 - t;
    return [
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
    ];
  }
  function bezierTangent(p0, p1, p2, t) {
    const u = 1 - t;
    return [
      2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]),
      2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1])
    ];
  }
  function ribbonPath(ctx, p0, p1, p2, widthFn, n) {
    const left = [], right = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const pt = bezierPt(p0, p1, p2, t);
      const tg = bezierTangent(p0, p1, p2, t);
      const len = Math.hypot(tg[0], tg[1]) || 1;
      const nx = -tg[1] / len, ny = tg[0] / len;
      const hw = widthFn(t) / 2;
      left.push([pt[0] + nx * hw, pt[1] + ny * hw]);
      right.push([pt[0] - nx * hw, pt[1] - ny * hw]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let a = 1; a < left.length; a++) ctx.lineTo(left[a][0], left[a][1]);
    for (let b = right.length - 1; b >= 0; b--) ctx.lineTo(right[b][0], right[b][1]);
    ctx.closePath();
  }

  function buildStructureVariant(v, salt) {
    const cv = document.createElement("canvas");
    cv.width = SHEET_CELL_W;
    cv.height = SHEET_CELL_H;
    const ctx = cv.getContext("2d");
    const OX = LOGIC_PAD, OY = LOGIC_PAD;
    const j = (k) => (rf(v * 7.31 + salt * 100, k + salt * 13) - 0.5) * 2;

    const topY = OY - LOGIC_H * (0.18 + j(4) * 0.03);
    const botY = OY + LOGIC_H * (1.16 + j(2) * 0.03);
    const W0 = LOGIC_W * (0.36 + j(7) * 0.02);
    function widthFn(t) {
      const u = Math.max(0, Math.min(1, t));
      const bell = Math.sin(Math.PI * (0.08 + u * 0.84));
      return W0 * (0.58 + 0.42 * bell);
    }
    function makeLeg(li) {
      const tx = li === 0 ? 0.24 : 0.76;
      const p0 = [OX + LOGIC_W * (tx + j(3 + li) * 0.018), topY];
      const bx = li === 0 ? 0.45 : 0.55;
      const p2 = [OX + LOGIC_W * (bx + j(8 + li) * 0.018), botY];
      const midX = (p0[0] + p2[0]) / 2, midY = (p0[1] + p2[1]) / 2;
      const bow = (li === 0 ? -1 : 1) * (1.1 + j(10 + li) * 0.7);
      return { p0: p0, p1: [midX + bow, midY], p2: p2, li: li };
    }
    const legs = [makeLeg(0), makeLeg(1)];
    const order = v % 2 === 0 ? [0, 1] : [1, 0];

    function drawLeg(leg) {
      const layers = [
        { w: 1.00, tone: 72 },
        { w: 0.84, tone: 142 },
        { w: 0.58, tone: 210 },
        { w: 0.28, tone: 248 }
      ];
      for (const layer of layers) {
        ribbonPath(ctx, leg.p0, leg.p1, leg.p2, (t) => widthFn(t) * layer.w, 48);
        ctx.fillStyle = "rgb(" + layer.tone + "," + layer.tone + "," + layer.tone + ")";
        ctx.fill();
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let s = 0; s < 9; s++) {
        const so = (rf(v * 3.7 + s * 1.13 + salt * 7, s + 4) - 0.5);
        const off = so * W0 * 0.26;
        const tStart = 0.04 + rf(s + v, 1 + salt) * 0.08;
        const tEnd = 0.96 - rf(s + v, 2 + salt) * 0.08;
        const pts = [];
        for (let q = 0; q <= 28; q++) {
          const tt = tStart + (tEnd - tStart) * (q / 28);
          const pt = bezierPt(leg.p0, leg.p1, leg.p2, tt);
          const tg = bezierTangent(leg.p0, leg.p1, leg.p2, tt);
          const len = Math.hypot(tg[0], tg[1]) || 1;
          pts.push([pt[0] - tg[1] / len * off, pt[1] + tg[0] / len * off]);
        }
        const bright = rf(v * 5.1 + s * 2.7 + salt * 3, s) > 0.42;
        const g = bright ? 255 : 28;
        ctx.strokeStyle = "rgba(" + g + "," + g + "," + g + "," + (bright ? 0.16 : 0.11) + ")";
        ctx.lineWidth = 0.7 + rf(s * 3.3 + v + salt * 11, s) * 0.8;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let pI = 1; pI < pts.length; pI++) ctx.lineTo(pts[pI][0], pts[pI][1]);
        ctx.stroke();
      }
    }

    for (let oi = 0; oi < order.length; oi++) drawLeg(legs[order[oi]]);

    const img = ctx.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const idx = (y * cv.width + x) * 4;
        if (d[idx + 3] === 0) continue;
        const grain = (rf(x * 1.31 + v * 47 + salt * 5, Math.floor(y / 3) + v) - 0.5) * 5;
        const g2 = clamp255(Math.round(d[idx] + grain));
        d[idx] = d[idx + 1] = d[idx + 2] = g2;
      }
    }
    ctx.putImageData(img, 0, 0);
    const out = document.createElement("canvas");
    out.width = cv.width;
    out.height = cv.height;
    const octx = out.getContext("2d");
    octx.filter = "blur(0.55px)";
    octx.drawImage(cv, 0, 0);
    return out;
  }

  function buildLightVariant(v, salt) {
    const cv = document.createElement("canvas");
    cv.width = SHEET_CELL_W;
    cv.height = SHEET_CELL_H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    const OX = LOGIC_PAD, OY = LOGIC_PAD;
    const j = (k) => (rf(v * 7.31 + salt * 100, k + salt * 13) - 0.5) * 2;
    const topY = OY - LOGIC_H * (0.34 + j(4) * 0.04);
    const botY = OY + LOGIC_H * (1.30 + j(2) * 0.04);
    for (let li = 0; li < 2; li++) {
      const tx = li === 0 ? 0.125 : 0.875;
      const p0 = [OX + LOGIC_W * (tx + j(3 + li) * 0.03), topY];
      const bx = li === 0 ? 0.52 : 0.48;
      const p2 = [OX + LOGIC_W * (bx + j(8 + li) * 0.03), botY];
      const midX = (p0[0] + p2[0]) / 2, midY = (p0[1] + p2[1]) / 2;
      const bow = (li === 0 ? -1 : 1) * (2.5 + j(10 + li) * 1.5);
      const ctrl = [midX + bow, midY];
      const dir = li === 0 ? 1 : -1;
      const pts = [];
      for (let q = 0; q <= 20; q++) {
        const t = 0.05 + (q / 20) * 0.9;
        const pt = bezierPt(p0, ctrl, p2, t);
        const tg = bezierTangent(p0, ctrl, p2, t);
        const len = Math.hypot(tg[0], tg[1]) || 1;
        const off = -dir * LOGIC_W * 0.075;
        pts.push([pt[0] - tg[1] / len * off, pt[1] + tg[0] / len * off]);
      }
      ctx.strokeStyle = "rgba(76,74,70,0.55)";
      ctx.lineWidth = 2.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let pI = 1; pI < pts.length; pI++) ctx.lineTo(pts[pI][0], pts[pI][1]);
      ctx.stroke();
      ctx.strokeStyle = "rgba(102,99,92,0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let pJ = 1; pJ < pts.length; pJ++) ctx.lineTo(pts[pJ][0], pts[pJ][1]);
      ctx.stroke();
    }
    return cv;
  }

  function buildReliefVariant(v, salt) {
    const cv = document.createElement("canvas");
    cv.width = SHEET_CELL_W;
    cv.height = SHEET_CELL_H;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "rgb(128,128,128)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    const x0 = LOGIC_PAD, y0 = LOGIC_PAD, gw = LOGIC_W, gh = LOGIC_H;
    const j = (k) => (rf(v * 5.17 + salt * 71, k + salt * 17) - 0.5) * 2;

    const chanW = gw * (0.16 + j(1) * 0.02);
    let g = ctx.createLinearGradient(x0, 0, x0 + chanW, 0);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, chanW, gh);

    g = ctx.createLinearGradient(x0 + gw, 0, x0 + gw - chanW, 0);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x0 + gw - chanW, y0, chanW, gh);

    const topH = gh * (0.15 + j(2) * 0.02);
    g = ctx.createLinearGradient(0, y0, 0, y0 + topH);
    g.addColorStop(0, "rgba(0,0,0,0.42)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, gw, topH);

    const botH = gh * 0.1;
    g = ctx.createLinearGradient(0, y0 + gh, 0, y0 + gh - botH);
    g.addColorStop(0, "rgba(255,255,255,0.2)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0 + gh - botH, gw, botH);

    return cv;
  }

  function buildSheets(seed) {
    tileCache.clear();
    const sc = structureSheet.getContext("2d");
    const lc = lightSheet.getContext("2d");
    const rc = reliefSheet.getContext("2d");
    sc.clearRect(0, 0, structureSheet.width, structureSheet.height);
    lc.clearRect(0, 0, lightSheet.width, lightSheet.height);
    rc.clearRect(0, 0, reliefSheet.width, reliefSheet.height);
    for (let v = 0; v < 8; v++) {
      sc.drawImage(buildStructureVariant(v, seed), v * SHEET_CELL_W, 0);
      lc.drawImage(buildLightVariant(v, seed), v * SHEET_CELL_W, 0);
      rc.drawImage(buildReliefVariant(v, seed), v * SHEET_CELL_W, 0);
    }
    built = true;
  }

  function ensureBuilt() {
    if (!built) buildSheets(1);
  }

  function getTile(color, variant, cwDev, chDev) {
    ensureBuilt();
    const key = color + "|" + variant + "|" + cwDev + "|" + chDev;
    const hit = tileCache.get(key);
    if (hit) return hit;
    const f = cwDev / LOGIC_W;
    const p = chDev / LOGIC_H;
    const m = Math.max(1, Math.round(SHEET_CELL_W * f));
    const h = Math.max(1, Math.round(SHEET_CELL_H * p));
    const tmp = document.createElement("canvas");
    tmp.width = m;
    tmp.height = h;
    const tc = tmp.getContext("2d");
    tc.drawImage(structureSheet, (variant % 8) * SHEET_CELL_W, 0, SHEET_CELL_W, SHEET_CELL_H, 0, 0, m, h);
    const sImg = tc.getImageData(0, 0, m, h);
    const lTmp = document.createElement("canvas");
    lTmp.width = m;
    lTmp.height = h;
    const lc = lTmp.getContext("2d");
    lc.drawImage(lightSheet, (variant % 8) * SHEET_CELL_W, 0, SHEET_CELL_W, SHEET_CELL_H, 0, 0, m, h);
    const lImg = lc.getImageData(0, 0, m, h);
    const rTmp = document.createElement("canvas");
    rTmp.width = m;
    rTmp.height = h;
    const rc = rTmp.getContext("2d");
    rc.drawImage(reliefSheet, (variant % 8) * SHEET_CELL_W, 0, SHEET_CELL_W, SHEET_CELL_H, 0, 0, m, h);
    const rImg = rc.getImageData(0, 0, m, h);
    const sd = sImg.data, ld = lImg.data, rd = rImg.data;
    const ramp = defaultRamp(color);
    const base = hexToRgb(color);
    for (let i = 0; i < sd.length; i += 4) {
      if (sd[i + 3] === 0) continue;
      const rgb = rampAt(ramp, sd[i] / 255);
      let r0 = rgb[0], g0 = rgb[1], b0 = rgb[2];
      const rl = rd[i] / 128;
      if (rl !== 1) {
        r0 = linearToSrgb8(Math.min(1, srgbToLinear8(r0) * rl));
        g0 = linearToSrgb8(Math.min(1, srgbToLinear8(g0) * rl));
        b0 = linearToSrgb8(Math.min(1, srgbToLinear8(b0) * rl));
      }
      const lY = (ld[i] * 0.299 + ld[i + 1] * 0.587 + ld[i + 2] * 0.114) / 255;
      const hi = Math.max(0, (sd[i] - 188) / 67) * 0.28 + lY * 0.42;
      if (hi > 0.01) {
        r0 = r0 + (255 - r0) * hi * 0.55;
        g0 = g0 + (255 - g0) * hi * 0.55;
        b0 = b0 + (255 - b0) * hi * 0.55;
      }
      sd[i] = clamp255(r0);
      sd[i + 1] = clamp255(g0);
      sd[i + 2] = clamp255(b0);
    }
    tc.putImageData(sImg, 0, 0);
    const tile = {
      img: tmp,
      sx: 0, sy: 0, sw: m, sh: h,
      dx: -LOGIC_PAD * f, dy: -LOGIC_PAD * p,
      dw: m, dh: h
    };
    if (tileCache.size >= TILE_CACHE_MAX) {
      const first = tileCache.keys().next().value;
      if (first !== undefined) tileCache.delete(first);
    }
    tileCache.set(key, tile);
    return tile;
  }

  return {
    SHEET_CELL_W, SHEET_CELL_H, LOGIC_PAD, LOGIC_W, LOGIC_H,
    rf, af, clamp255, hexToRgb, mixRgb, defaultRamp, rampAt, shadeColor,
    srgbToLinear8, linearToSrgb8,
    buildSheets, getTile,
    get cacheSize() { return tileCache.size; },
    clearCache() { tileCache.clear(); }
  };
})();
