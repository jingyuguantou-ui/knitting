const Stitch = (() => {
  const SYMS = [
    { code: 0, zh: "下针", en: "Knit", glyph: "" },
    { code: 1, zh: "上针", en: "Purl", glyph: "-" },
    { code: 2, zh: "加针", en: "Yarn over", glyph: "o" },
    { code: 3, zh: "右上2并1", en: "K2tog", char: "人" },
    { code: 4, zh: "左上2并1", en: "SSK", char: "入" },
    { code: 5, zh: "中上3并1", en: "Sl2-k1-p2sso", custom: "y3" },
    { code: 6, zh: "扭针", en: "Twisted st", custom: "twist" },
    { code: 7, zh: "玉编", en: "Bobble", custom: "dot" },
    { code: 8, zh: "滑针", en: "Slip st", custom: "slip" },
    { code: 9, zh: "麻花右拧", en: "Cable R", custom: "cableR" },
    { code: 10, zh: "麻花左拧", en: "Cable L", custom: "cableL" },
    { code: 11, zh: "交叉绳", en: "Cable X", custom: "cableX" },
    { code: 12, zh: "2卷绕线编", en: "Wrap 2", custom: "wrap2" },
    { code: 13, zh: "3卷绕线编", en: "Wrap 3", custom: "wrap3" },
    { code: 14, zh: "挂针", en: "Hold", custom: "hold" },
    { code: 15, zh: "右上3针与2针的交叉", en: "C3F2", custom: "c3f2" },
    { code: 16, zh: "左上3针与2针的交叉", en: "C2F3", custom: "c2f3" },
    { code: 17, zh: "上针3并1", en: "P3tog", custom: "p3" },
    { code: 18, zh: "没有针目", en: "No stitch", custom: "none" }
  ];

  function nameOf(code) {
    const s = SYMS[code];
    if (!s) return "";
    return I18N.lang === "en" ? s.en : s.zh;
  }

  function drawGlyph(ctx, code, x, y, w, h, color) {
    if (!code || w <= 0 || h <= 0) return;
    const s = SYMS[code] || SYMS[0];
    if (!s) return;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const m = Math.min(w, h);
    ctx.save();
    ctx.strokeStyle = color || "#2c2a24";
    ctx.fillStyle = color || "#2c2a24";
    ctx.lineWidth = Math.max(1, m * 0.09);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (code === 1) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, cy);
      ctx.lineTo(x + w * 0.82, cy);
      ctx.stroke();
    } else if (code === 2) {
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.char) {
      ctx.font = `${Math.round(m * 0.8)}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.char, cx, cy + m * 0.03);
    } else if (s.custom === "y3") {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y + h * 0.16);
      ctx.lineTo(cx, y + h * 0.82);
      ctx.moveTo(x + w * 0.8, y + h * 0.16);
      ctx.lineTo(cx, y + h * 0.82);
      ctx.moveTo(cx, y + h * 0.12);
      ctx.lineTo(cx, y + h * 0.82);
      ctx.stroke();
    } else if (s.custom === "twist") {
      ctx.beginPath();
      ctx.moveTo(cx, y + h * 0.14);
      ctx.lineTo(cx, y + h * 0.86);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.15, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.custom === "dot") {
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.custom === "slip") {
      ctx.setLineDash([Math.max(1, m * 0.14), Math.max(1, m * 0.1)]);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.16, cy);
      ctx.lineTo(x + w * 0.84, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (s.custom === "cableR") {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y + h * 0.88);
      ctx.lineTo(x + w * 0.9, y + h * 0.12);
      ctx.moveTo(x + w * 0.38, y + h * 0.96);
      ctx.lineTo(x + w * 0.96, y + h * 0.38);
      ctx.stroke();
    } else if (s.custom === "cableL") {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.9, y + h * 0.88);
      ctx.lineTo(x + w * 0.1, y + h * 0.12);
      ctx.moveTo(x + w * 0.62, y + h * 0.96);
      ctx.lineTo(x + w * 0.04, y + h * 0.38);
      ctx.stroke();
    } else if (s.custom === "cableX") {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y + h * 0.88);
      ctx.lineTo(x + w * 0.9, y + h * 0.12);
      ctx.moveTo(x + w * 0.1, y + h * 0.12);
      ctx.lineTo(x + w * 0.9, y + h * 0.88);
      ctx.stroke();
    } else if (s.custom === "wrap2" || s.custom === "wrap3") {
      const n = s.custom === "wrap2" ? 2 : 3;
      const bw = w * 0.72, bx = cx - bw / 2;
      const bh = h * 0.52, by = y + h * 0.12;
      ctx.lineWidth = Math.max(1, m * 0.07);
      ctx.strokeRect(bx, by, bw, bh);
      const lineY = by + bh * 0.76;
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.08, lineY);
      ctx.lineTo(bx + bw * 0.92, lineY);
      ctx.stroke();
      const cw = bw / n;
      for (let i = 0; i < n; i++) {
        const ox = bx + cw * (i + 0.5);
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.ellipse(ox, by + bh * (0.16 + k * 0.3), cw * 0.3, bh * 0.14, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.font = `${Math.round(m * 0.26)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (let i = 0; i < n; i++) {
        ctx.fillText(String(n), bx + cw * (i + 0.5), by + bh * 1.42);
      }
    } else if (s.custom === "hold") {
      const r = m * 0.24;
      ctx.beginPath();
      ctx.arc(cx, cy - h * 0.1, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + h * 0.18);
      ctx.lineTo(cx, y + h * 0.92);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * 0.92);
      ctx.lineTo(x + w * 0.82, y + h * 0.92);
      ctx.stroke();
    } else if (s.custom === "c3f2" || s.custom === "c2f3") {
      const dir = s.custom === "c3f2" ? -1 : 1;
      const bw = w * 0.94, bx = x + w * 0.03;
      const bh = h * 0.74, by = y + h * 0.04;
      ctx.lineWidth = Math.max(1, m * 0.06);
      ctx.strokeRect(bx, by, bw, bh);
      const cells = 5;
      const cw = bw / cells;
      for (let i = 1; i < cells; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + cw * i, by);
        ctx.lineTo(bx + cw * i, by + bh);
        ctx.stroke();
      }
      ctx.lineWidth = Math.max(1, m * 0.08);
      ctx.beginPath();
      ctx.moveTo(bx + cw * (dir > 0 ? 0.2 : 4.8), by + bh * 0.14);
      ctx.lineTo(bx + cw * (dir > 0 ? 4.8 : 0.2), by + bh * 0.88);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, m * 0.05);
      for (let i = 0; i < cells; i++) {
        const px = bx + cw * (i + 0.5);
        const py = by + bh * (i % 2 ? 0.34 : 0.62);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dir * cw * 0.22, py - bh * 0.1);
        ctx.lineTo(px + dir * cw * 0.34, py + bh * 0.06);
        ctx.stroke();
      }
      ctx.font = `${Math.round(m * 0.26)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (let i = 0; i < cells; i++) {
        ctx.fillText(String(cells - i), bx + cw * (i + 0.5), by + bh * 1.4);
      }
    } else if (s.custom === "p3") {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.16, y + h * 0.2);
      ctx.lineTo(cx, y + h * 0.74);
      ctx.moveTo(x + w * 0.5, y + h * 0.1);
      ctx.lineTo(cx, y + h * 0.74);
      ctx.moveTo(x + w * 0.84, y + h * 0.2);
      ctx.lineTo(cx, y + h * 0.74);
      ctx.moveTo(cx, y + h * 0.74);
      ctx.lineTo(cx, y + h * 0.95);
      ctx.stroke();
    } else if (s.custom === "none") {
      ctx.lineWidth = Math.max(1, m * 0.08);
      ctx.strokeRect(x + w * 0.14, y + h * 0.24, w * 0.72, h * 0.52);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillRect(x + w * 0.14, y + h * 0.24, w * 0.72, h * 0.52);
      ctx.strokeStyle = "#fdfaf2";
      ctx.lineWidth = Math.max(1, m * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.22, y + h * 0.32);
      ctx.lineTo(x + w * 0.78, y + h * 0.68);
      ctx.stroke();
    }
    ctx.restore();
  }

  function reliefStroke(ctx, pathFn, lw, hex) {
    ctx.save();
    ctx.translate(0, Math.max(1, lw * 0.5));
    ctx.strokeStyle = "rgba(20,16,10,0.42)";
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    pathFn();
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(0, -Math.max(1, lw * 0.45));
    ctx.strokeStyle = "rgba(255,252,244,0.5)";
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    pathFn();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = hex ? Texture.shadeColor(hex, -0.34) : "rgba(38,32,22,0.6)";
    ctx.lineWidth = lw;
    ctx.beginPath();
    pathFn();
    ctx.stroke();
  }

  function lumOf(hex) {
    if (!hex || hex[0] !== "#" || hex.length < 7) return 0.6;
    const n = parseInt(hex.slice(1), 16);
    if (isNaN(n)) return 0.6;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  }

  function mulHex(hex, k) {
    if (!hex || hex[0] !== "#" || hex.length < 7 || k >= 1) return hex;
    const n = parseInt(hex.slice(1), 16);
    if (isNaN(n)) return hex;
    const r = Math.round(((n >> 16) & 255) * k);
    const g = Math.round(((n >> 8) & 255) * k);
    const b = Math.round((n & 255) * k);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function yarnStroke(ctx, pathFn, lw, hex, under) {
    lw = Math.max(1.5, lw);
    const base = hex && hex[0] === "#" ? hex : "#cfc6b2";
    const dark = lumOf(base) < 0.32;
    const edgeF = dark ? -0.24 : -0.3;
    const bodyF = dark ? -0.08 : -0.12;
    const hiA = under ? (dark ? 0.16 : 0.14) : (dark ? 0.34 : 0.3);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (!under) {
      ctx.save();
      ctx.translate(lw * 0.06, lw * 0.3);
      ctx.strokeStyle = "rgba(14,11,7,0.3)";
      ctx.lineWidth = lw * 1.14;
      ctx.beginPath();
      pathFn(ctx);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = Texture.shadeColor(base, under ? (dark ? -0.18 : -0.24) : edgeF);
    ctx.lineWidth = lw;
    ctx.beginPath();
    pathFn(ctx);
    ctx.stroke();
    ctx.strokeStyle = Texture.shadeColor(base, under ? (dark ? -0.12 : -0.16) : bodyF);
    ctx.lineWidth = lw * 0.84;
    ctx.beginPath();
    pathFn(ctx);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, -lw * 0.18);
    ctx.strokeStyle = "rgba(255,252,244," + hiA + ")";
    ctx.lineWidth = Math.max(1, lw * 0.28);
    ctx.beginPath();
    pathFn(ctx);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function bezPt(P0, P1, P2, P3, t) {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return {
      x: a * P0.x + b * P1.x + c * P2.x + d * P3.x,
      y: a * P0.y + b * P1.y + c * P2.y + d * P3.y,
      dx: 3 * u * u * (P1.x - P0.x) + 6 * u * t * (P2.x - P1.x) + 3 * t * t * (P3.x - P2.x),
      dy: 3 * u * u * (P1.y - P0.y) + 6 * u * t * (P2.y - P1.y) + 3 * t * t * (P3.y - P2.y)
    };
  }

  function bandRecess(ctx, bx, bw, yA, yB) {
    const strip = (gx, gw) => {
      const g = ctx.createLinearGradient(gx - gw / 2, 0, gx + gw / 2, 0);
      g.addColorStop(0, "rgba(14,11,7,0)");
      g.addColorStop(0.5, "rgba(14,11,7,0.36)");
      g.addColorStop(1, "rgba(14,11,7,0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - gw / 2, yA, gw, yB - yA);
    };
    strip(bx + bw * 0.02, bw * 0.1);
    strip(bx + bw * 0.5, bw * 0.05);
    strip(bx + bw * 0.98, bw * 0.1);
  }

  function segLine(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    return {
      len: Math.hypot(dx, dy),
      pathFn: function (c) { c.moveTo(x0, y0); c.lineTo(x1, y1); },
      ptFn: function (t) { return { x: x0 + dx * t, y: y0 + dy * t, dx: dx, dy: dy }; }
    };
  }

  function segBezier(P0, P1, P2, P3) {
    let len = 0, prev = bezPt(P0, P1, P2, P3, 0);
    for (let i = 1; i <= 12; i++) {
      const p = bezPt(P0, P1, P2, P3, i / 12);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return {
      len: len,
      pathFn: function (c) {
        c.moveTo(P0.x, P0.y);
        c.bezierCurveTo(P1.x, P1.y, P2.x, P2.y, P3.x, P3.y);
      },
      ptFn: function (t) { return bezPt(P0, P1, P2, P3, t); }
    };
  }

  // 一针线圈：两腿自上而下汇于底部中点（针法 V 形）
  function drawLoop(ctx, hw, hh, lwDark, lwLight) {
    ctx.beginPath();
    ctx.moveTo(-hw, -hh);
    ctx.quadraticCurveTo(-hw * 0.56, hh * 0.34, 0, hh * 0.62);
    ctx.quadraticCurveTo(hw * 0.56, hh * 0.34, hw, -hh);
    ctx.stroke();
    if (lwLight > 0) {
      ctx.beginPath();
      ctx.moveTo(-hw * 0.82, -hh * 1.12);
      ctx.quadraticCurveTo(-hw * 0.44, hh * 0.06, 0, hh * 0.36);
      ctx.quadraticCurveTo(hw * 0.44, hh * 0.06, hw * 0.82, -hh * 1.12);
      ctx.stroke();
    }
  }

  function drawStrand(ctx, seg, lw, chh, cw, hex, under) {
    yarnStroke(ctx, seg.pathFn, lw, hex, under);
    if (chh < 3 || lw < 3.5 || seg.len < 1) return;
    const nAcross = Math.max(1, Math.min(6, Math.round(lw / Math.max(2, cw))));
    const sw = lw / nAcross;
    const hw = sw * 0.44, hh = chh * 0.5;
    const step = chh * 0.6;
    const n = Math.max(1, Math.min(700, Math.round(seg.len / step)));
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < n; i++) {
      const p = seg.ptFn((i + 0.5) / n);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(-p.dx, p.dy));
      for (let j = 0; j < nAcross; j++) {
        ctx.save();
        ctx.translate((j - (nAcross - 1) / 2) * sw, 0);
        ctx.strokeStyle = under ? "rgba(14,11,7,0.13)" : "rgba(14,11,7,0.17)";
        ctx.lineWidth = Math.max(0.6, chh * 0.085);
        drawLoop(ctx, hw, hh, 0);
        ctx.strokeStyle = under ? "rgba(255,252,244,0.1)" : "rgba(255,252,244,0.3)";
        ctx.lineWidth = Math.max(0.5, chh * 0.07);
        drawLoop(ctx, hw * 0.86, hh, 0);
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCord(ctx, cx, yA, yB, lw, chh, cw, hex) {
    if (yB - yA < 1) return;
    drawStrand(ctx, segLine(cx, yA, cx, yB), lw, chh, cw, hex, false);
  }

  // 两绳之间的凹沟（仅直段，交叉区被后画的交叉绳覆盖）
  function drawGroove(ctx, cx, yA, yB, w) {
    if (yB - yA < 1) return;
    ctx.save();
    ctx.strokeStyle = "rgba(14,11,7,0.34)";
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(cx, yA);
    ctx.lineTo(cx, yB);
    ctx.stroke();
    ctx.restore();
  }

  function drawZone(ctx, code, cx1, cx2, zt, zb, lw, chh, cw, hex) {
    const h = zb - zt;
    if (h < 1 || cx2 - cx1 < 1) return;
    const k = h * 0.42;
    const A0 = { x: cx1, y: zt }, A1 = { x: cx1, y: zt + k };
    const A2 = { x: cx2, y: zb - k }, A3 = { x: cx2, y: zb };
    const B0 = { x: cx2, y: zt }, B1 = { x: cx2, y: zt + k };
    const B2 = { x: cx1, y: zb - k }, B3 = { x: cx1, y: zb };
    const segA = segBezier(A0, A1, A2, A3);
    const segB = segBezier(B0, B1, B2, B3);
    const frontA = code === 10;
    const fSeg = frontA ? segA : segB;
    const bSeg = frontA ? segB : segA;
    const backHex = mulHex(hex, lumOf(hex) < 0.32 ? 0.94 : 0.8);
    drawStrand(ctx, bSeg, lw * 0.88, chh, cw, backHex, true);
    ctx.save();
    ctx.strokeStyle = "rgba(14,11,7,0.42)";
    ctx.lineWidth = Math.max(2, lw * 1.3);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    fSeg.pathFn(ctx);
    ctx.stroke();
    ctx.restore();
    drawStrand(ctx, fSeg, lw, chh, cw, hex, false);
  }

  function drawStrandCell(ctx, code, x, y, w, h, hex) {
    const m = Math.min(w, h);
    if (m < 3) return;
    const lw = m * 0.62;
    const o = m * 0.22;
    const dirs = [];
    if (code === 10 || code === 11) dirs.push([x - o, y - o, x + w + o, y + h + o]);
    if (code === 9 || code === 11) dirs.push([x - o, y + h + o, x + w + o, y - o]);
    const front = dirs.pop();
    const back = dirs.pop();
    if (back) {
      drawStrand(ctx, segLine(back[0], back[1], back[2], back[3]), lw * 0.9, h, w,
        mulHex(hex, 0.8), true);
      ctx.save();
      ctx.strokeStyle = "rgba(14,11,7,0.4)";
      ctx.lineWidth = Math.max(2, lw * 1.3);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(front[0], front[1]);
      ctx.lineTo(front[2], front[3]);
      ctx.stroke();
      ctx.restore();
    }
    drawStrand(ctx, segLine(front[0], front[1], front[2], front[3]), lw, h, w, hex, false);
  }

  function crossSymbol(ctx, x, y, w, h, left, right, dir, color) {
    if (w <= 0 || h <= 0) return;
    const m = Math.min(w, h);
    const cells = Math.max(2, (left | 0) + (right | 0));
    ctx.save();
    ctx.strokeStyle = color || "#2c2a24";
    ctx.lineWidth = Math.max(1, m * 0.07);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const pad = Math.max(1, m * 0.05);
    const bx = x + pad, by = y + pad, bw = w - pad * 2, bh = h - pad * 2;
    ctx.strokeRect(bx, by, bw, bh);
    const cwu = bw / cells;
    ctx.save();
    ctx.lineWidth = Math.max(1, m * 0.03);
    for (let i = 1; i < cells; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + cwu * i, by);
      ctx.lineTo(bx + cwu * i, by + bh);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    const inset = cwu * 0.22;
    const endsFor = (front) => {
      const toRight = front === (dir >= 0);
      if (toRight) return [bx + inset, by + bh * 0.86, bx + bw - inset, by + bh * 0.14];
      return [bx + bw - inset, by + bh * 0.86, bx + inset, by + bh * 0.14];
    };
    const drawBundle = (pts, lw, gapPx) => {
      const x1 = pts[0], y1 = pts[1], x2 = pts[2], y2 = pts[3];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * lw * 0.8, ny = dx / len * lw * 0.8;
      for (let s = -1; s <= 1; s += 2) {
        const ax = x1 + nx * s, ay = y1 + ny * s;
        const bx2 = x2 + nx * s, by2 = y2 + ny * s;
        ctx.beginPath();
        if (gapPx > 0) {
          const g = Math.min(0.45, gapPx / len);
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax + (bx2 - ax) * (0.5 - g), ay + (by2 - ay) * (0.5 - g));
          ctx.moveTo(ax + (bx2 - ax) * (0.5 + g), ay + (by2 - ay) * (0.5 + g));
          ctx.lineTo(bx2, by2);
        } else {
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx2, by2);
        }
        ctx.stroke();
      }
    };
    ctx.lineWidth = Math.max(1, m * 0.06);
    drawBundle(endsFor(false), Math.max(1, m * 0.055), m >= 9 ? m * 0.3 : 0);
    ctx.lineWidth = Math.max(1.2, m * 0.075);
    drawBundle(endsFor(true), Math.max(1.2, m * 0.07), 0);
    ctx.restore();
    if (m >= 14) {
      ctx.font = `${Math.round(m * 0.24)}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (let i = 0; i < cells; i++) {
        const grp = i < (left | 0) ? (left | 0) : (right | 0);
        const off = i < (left | 0) ? i : i - (left | 0);
        ctx.fillText(String(grp - off), bx + cwu * (i + 0.5), by + bh + m * 0.3);
      }
    }
    ctx.restore();
  }

  function paintCables(ctx, ch, x0, y0, cw, chh, opt) {
    if (!ch || !ch.stitches || !ch.cols || !ch.rows || cw < 2 || chh < 2) return;
    opt = opt || {};
    const ht = opt.ht || 1, vt = opt.vt || 1, flip = !!opt.flip;
    const cols = ch.cols, rows = ch.rows, st = ch.stitches;
    const totalRows = rows * vt;
    const hexAt = (i) => {
      const p = ch.palette && ch.palette[ch.cells[i]];
      return p && p.hex ? p.hex : "#d9d2c2";
    };
    const scrRow = (r, tv) => (flip ? (totalRows - 1 - (tv * rows + r)) : (tv * rows + r));
    const bandCells = new Set();
    const srcEvents = [];
    if (ch.crosses && ch.crosses.length) {
      ch.crosses.forEach((x) => {
        if (!x || !(x.left >= 1) || !(x.right >= 1)) return;
        const r = x.row, c1 = x.c0, c2 = x.c0 + x.left + x.right - 1;
        if (!(r >= 0 && r < rows) || c1 < 0 || c2 >= cols) return;
        srcEvents.push({ r, c1, c2, code: x.dir >= 0 ? 9 : 10, hex: hexAt(c1 + r * cols) });
      });
    } else {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols;) {
        const code = st[c + r * cols];
        if (code === 9 || code === 10) {
          let c2 = c;
          while (c2 + 1 < cols && st[(c2 + 1) + r * cols] === code) c2++;
          const len = c2 - c + 1;
          if (len >= 3) {
            const segs = [];
            if (len <= 8) {
              segs.push([c, c2]);
            } else {
              const n = Math.ceil(len / 4);
              const base = Math.floor(len / n), rem = len % n;
              let p = c;
              for (let s = 0; s < n; s++) {
                const size = base + (s < rem ? 1 : 0);
                segs.push([p, p + size - 1]);
                p += size;
              }
            }
            segs.forEach((sg) => {
              srcEvents.push({ r, c1: sg[0], c2: sg[1], code, hex: hexAt(sg[0] + r * cols) });
              for (let k = sg[0]; k <= sg[1]; k++) bandCells.add(k + r * cols);
            });
            c = c2 + 1;
            continue;
          }
        }
        c++;
      }
    }
    }
    const bands = new Map();
    srcEvents.forEach((ev) => {
      for (let tx = 0; tx < ht; tx++) {
        const key = (tx * cols + ev.c1) + ":" + (tx * cols + ev.c2);
        let b = bands.get(key);
        if (!b) {
          b = { x1: tx * cols + ev.c1, x2: tx * cols + ev.c2, hex: ev.hex, evs: [] };
          bands.set(key, b);
        }
        for (let tv = 0; tv < vt; tv++) b.evs.push({ y: scrRow(ev.r, tv), code: ev.code });
      }
    });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, cols * ht * cw, rows * vt * chh);
    ctx.clip();
    bands.forEach((b) => {
      b.evs.sort((p, q) => p.y - q.y);
      const bx = x0 + b.x1 * cw;
      const bw = (b.x2 - b.x1 + 1) * cw;
      const evs = b.evs;
      if (!evs.length) return;
      const cordLw = Math.max(2.5, bw * 0.44);
      const cx1 = bx + bw * 0.27, cx2 = bx + bw * 0.73;
      const travel = cx2 - cx1;
      const zoneRows = Math.max(3, Math.min(10, (travel / Math.max(1, chh)) * 1.05));
      const zones = [];
      let cur = evs[0].y - totalRows;
      evs.forEach((ev) => {
        const mid = ev.y + 0.5;
        let zt = Math.max(cur, mid - zoneRows / 2);
        if (zt > mid - 0.5) zt = Math.max(cur, mid - 0.5);
        const zb = Math.max(zt + 0.4, mid + zoneRows / 2);
        zones.push({ ev, zt, zb });
        cur = zb;
      });
      const yStart = y0 + (evs[0].y - totalRows) * chh;
      const yEnd = y0 + (evs[evs.length - 1].y + totalRows) * chh;
      bandRecess(ctx, bx, bw, yStart, Math.max(yEnd, y0 + zones[zones.length - 1].zb * chh));
      let yPrev = yStart;
      zones.forEach((z) => {
        const ztPx = y0 + z.zt * chh;
        const zbPx = y0 + z.zb * chh;
        if (ztPx - yPrev > 0.5) {
          drawCord(ctx, cx1, yPrev, ztPx, cordLw, chh, cw, b.hex);
          drawCord(ctx, cx2, yPrev, ztPx, cordLw, chh, cw, b.hex);
          drawGroove(ctx, (cx1 + cx2) / 2, yPrev, ztPx, cordLw * 0.13);
        }
        drawZone(ctx, z.ev.code, cx1, cx2, ztPx, zbPx, Math.max(2.5, cordLw * 0.9), chh, cw, b.hex);
        yPrev = zbPx;
      });
      if (yEnd - yPrev > 0.5) {
        drawCord(ctx, cx1, yPrev, yEnd, cordLw, chh, cw, b.hex);
        drawCord(ctx, cx2, yPrev, yEnd, cordLw, chh, cw, b.hex);
        drawGroove(ctx, (cx1 + cx2) / 2, yPrev, yEnd, cordLw * 0.13);
      }
    });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = c + r * cols;
        const code = st[idx];
        if (code !== 9 && code !== 10 && code !== 11) continue;
        if (bandCells.has(idx)) continue;
        const hex = hexAt(idx);
        for (let tx = 0; tx < ht; tx++) {
          for (let tv = 0; tv < vt; tv++) {
            const sx = x0 + (tx * cols + c) * cw;
            const sy = y0 + scrRow(r, tv) * chh;
            drawStrandCell(ctx, code, sx, sy, cw, chh, hex);
          }
        }
      }
    }
    ctx.restore();
  }

  function drawFabricCell(ctx, code, x, y, w, h, hex) {
    if (!code || w < 4 || h < 4) return;
    const m = Math.min(w, h);
    const cx = x + w / 2, cy = y + h / 2;
    const dark = "rgba(20,16,10,0.38)";
    const light = "rgba(255,252,244,0.42)";
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (code === 1) {
      if (hex) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, w + 0.5, h + 0.5);
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 2; i++) {
        const by = y + h * (0.32 + i * 0.38);
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(1, h * 0.2);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.06, by + h * 0.05);
        ctx.quadraticCurveTo(cx, by - h * 0.1, x + w * 0.94, by + h * 0.05);
        ctx.stroke();
        ctx.strokeStyle = light;
        ctx.lineWidth = Math.max(1, h * 0.09);
        ctx.beginPath();
        ctx.moveTo(x + w * 0.1, by - h * 0.05);
        ctx.quadraticCurveTo(cx, by - h * 0.17, x + w * 0.9, by - h * 0.05);
        ctx.stroke();
      }
    } else if (code === 2) {
      const rr = m * 0.3;
      ctx.fillStyle = "rgba(14,11,7,0.3)";
      ctx.beginPath();
      ctx.arc(cx, cy, rr * 1.4, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(cx, cy - rr * 0.2, rr * 0.1, cx, cy, rr);
      g.addColorStop(0, "rgba(6,5,3,0.97)");
      g.addColorStop(1, "rgba(26,21,14,0.88)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = light;
      ctx.lineWidth = Math.max(1, m * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy - rr * 0.1, rr * 0.9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, m * 0.07);
      ctx.beginPath();
      ctx.arc(cx, cy + rr * 0.08, rr * 0.94, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (code === 3 || code === 4) {
      const dir = code === 3 ? 1 : -1;
      const lw = Math.max(1, m * 0.17);
      reliefStroke(ctx, function () {
        ctx.moveTo(cx - dir * w * 0.28, y + h * 0.9);
        ctx.quadraticCurveTo(cx + dir * w * 0.02, cy, cx + dir * w * 0.3, y + h * 0.1);
        ctx.moveTo(cx + dir * w * 0.06, y + h * 0.92);
        ctx.quadraticCurveTo(cx + dir * w * 0.3, cy, cx + dir * w * 0.48, y + h * 0.12);
      }, lw, hex);
    } else if (code === 5) {
      const lw = Math.max(1, m * 0.15);
      reliefStroke(ctx, function () {
        ctx.moveTo(x + w * 0.18, y + h * 0.9);
        ctx.quadraticCurveTo(x + w * 0.38, cy, cx - w * 0.05, y + h * 0.12);
        ctx.moveTo(x + w * 0.82, y + h * 0.9);
        ctx.quadraticCurveTo(x + w * 0.62, cy, cx + w * 0.05, y + h * 0.12);
        ctx.moveTo(cx, y + h * 0.95);
        ctx.lineTo(cx, y + h * 0.1);
      }, lw, hex);
    } else if (code === 6) {
      const lw = Math.max(1, m * 0.11);
      reliefStroke(ctx, function () {
        ctx.moveTo(x + w * 0.26, y + h * 0.88);
        ctx.lineTo(x + w * 0.62, y + h * 0.36);
        ctx.moveTo(x + w * 0.74, y + h * 0.88);
        ctx.lineTo(x + w * 0.38, y + h * 0.36);
        ctx.moveTo(cx, y + h * 0.42);
        ctx.lineTo(cx, y + h * 0.12);
      }, lw, hex);
    } else if (code === 7) {
      ctx.fillStyle = "rgba(20,16,10,0.35)";
      ctx.beginPath();
      ctx.arc(cx, cy + h * 0.07, m * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = hex || "#e8e2d4";
      ctx.beginPath();
      ctx.arc(cx, cy, m * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.arc(cx - m * 0.07, cy - m * 0.09, m * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (code === 8) {
      const bh = Math.max(2, h * 0.26);
      ctx.fillStyle = dark;
      ctx.fillRect(x + w * 0.04, cy - bh / 2 + h * 0.05, w * 0.92, bh);
      ctx.fillStyle = hex || "#ddd8cc";
      ctx.fillRect(x + w * 0.04, cy - bh / 2, w * 0.92, bh);
      ctx.fillStyle = light;
      ctx.fillRect(x + w * 0.04, cy - bh / 2, w * 0.92, Math.max(1, bh * 0.35));
    } else if (code === 12 || code === 13) {
      const n = code === 12 ? 2 : 3;
      const r = m * 0.19;
      const lw = Math.max(1, m * 0.11);
      for (let k = 0; k < n; k++) {
        const yy = cy - m * 0.2 + k * m * 0.4;
        reliefStroke(ctx, function () {
          ctx.moveTo(x + w * 0.08, yy + m * 0.12);
          ctx.quadraticCurveTo(cx, yy - m * 0.26, x + w * 0.92, yy + m * 0.12);
        }, lw, hex);
      }
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, m * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.08, cy + m * 0.34);
      ctx.lineTo(x + w * 0.92, cy + m * 0.34);
      ctx.stroke();
    } else if (code === 14) {
      const lw = Math.max(1, m * 0.1);
      reliefStroke(ctx, function () {
        ctx.moveTo(cx, cy + m * 0.06);
        ctx.lineTo(cx, y + h * 0.94);
      }, lw, hex);
      ctx.fillStyle = hex || "#ddd8cc";
      ctx.beginPath();
      ctx.arc(cx, cy - m * 0.14, m * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = light;
      ctx.lineWidth = Math.max(1, m * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy - m * 0.14, m * 0.22, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    } else if (code === 15 || code === 16) {
      const dir = code === 15 ? 1 : -1;
      const lw = Math.max(1, m * 0.16);
      reliefStroke(ctx, function () {
        ctx.moveTo(cx - dir * w * 0.3, y + h * 0.88);
        ctx.quadraticCurveTo(cx, cy, cx + dir * w * 0.32, y + h * 0.12);
        ctx.moveTo(cx - dir * w * 0.04, y + h * 0.92);
        ctx.quadraticCurveTo(cx + dir * w * 0.2, cy, cx + dir * w * 0.46, y + h * 0.16);
      }, lw, hex);
    } else if (code === 17) {
      const lw = Math.max(1, m * 0.13);
      reliefStroke(ctx, function () {
        ctx.moveTo(x + w * 0.16, y + h * 0.12);
        ctx.quadraticCurveTo(cx, y + h * 0.72, cx - w * 0.02, y + h * 0.72);
        ctx.moveTo(x + w * 0.5, y + h * 0.08);
        ctx.quadraticCurveTo(cx + w * 0.1, y + h * 0.78, cx, y + h * 0.78);
        ctx.moveTo(x + w * 0.84, y + h * 0.12);
        ctx.quadraticCurveTo(cx + w * 0.16, y + h * 0.72, cx + w * 0.04, y + h * 0.72);
      }, lw, hex);
    } else if (code === 18) {
      ctx.fillStyle = hex || "#ddd8cc";
      ctx.fillRect(x + w * 0.06, y + h * 0.16, w * 0.88, h * 0.68);
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, m * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y + h * 0.2);
      ctx.lineTo(x + w * 0.9, y + h * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 提花（stranded）压线：色界处永远往「更暗」的方向压，带一点被压纱线的色相，
  // 得到的是织物上的遮挡阴影，而不是死黑描边
  function seamRgb(hexA, hexB, amt) {
    const a = Texture.hexToRgb(hexA), b = Texture.hexToRgb(hexB);
    const la = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114;
    const lb = b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114;
    const c = la <= lb ? a : b;
    const f = 1 - amt;
    return [c[0] * f, c[1] * f, c[2] * f];
  }
  function rgbaAt(c, alpha) {
    return "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," +
      Math.round(c[2]) + "," + (Math.round(alpha * 100) / 100) + ")";
  }

  // 唯一的织物渲染管线：画布 / 预览 / 导出 / 缩略图全部走这里，保证所见即所得
  // opt: { x0, y0, cw, chh, dpr, ht, vt, flip, strandEdges, region }
  // region: { c0, r0, c1, r1 } 只画这块织格（屏幕向，含调用方给的外扩圈），配合 ctx 裁剪做脏区重绘
  function paintFabric(ctx, ch, opt) {
    opt = opt || {};
    if (!ch || !ch.cols || !ch.rows || !ch.cells) return;
    const cw = opt.cw, chh = opt.chh;
    if (!(cw >= 2) || !(chh >= 2)) return;
    const cols = ch.cols, rows = ch.rows;
    const x0 = opt.x0 || 0, y0 = opt.y0 || 0;
    const b = opt.dpr || 1;
    const ht = Math.max(1, Math.round(opt.ht || 1));
    const vt = Math.max(1, Math.round(opt.vt || 1));
    const flip = opt.flip === true;
    const NC = cols * ht, NR = rows * vt;
    const tw = Math.max(4, Math.round(cw * b));
    const th = Math.max(4, Math.round(chh * b));
    const cells = ch.cells, stitches = ch.stitches, palette = ch.palette;

    // 脏区：只遍历这块范围（含调用方给的外扩圈），其余像素靠 ctx 裁剪挡掉
    let n0 = 0, n1 = NC - 1, e0 = 0, e1 = NR - 1;
    const reg = opt.region;
    if (reg) {
      n0 = Math.max(0, Math.floor(reg.c0));
      n1 = Math.min(NC - 1, Math.ceil(reg.c1));
      e0 = Math.max(0, Math.floor(reg.r0));
      e1 = Math.min(NR - 1, Math.ceil(reg.r1));
      if (n1 < n0 || e1 < e0) return;
    }

    // 屏幕坐标 → 花型单元索引（翻转让预览按"从下往上织"的方向显示）
    function cellIdx(n, e) {
      const rr = flip ? (NR - 1 - e) % rows : e % rows;
      return (n % cols) + rr * cols;
    }
    function hexOf(i) {
      const p = palette[cells[i]];
      return p && p.hex ? p.hex : null;
    }
    const px = (n) => x0 + n * cw;
    const py = (e) => y0 + e * chh;

    let e, n, i, hex;
    // 1) 压暗底色，防止相邻格之间露出缝
    for (e = e0; e <= e1; e++) {
      for (n = n0; n <= n1; n++) {
        hex = hexOf(cellIdx(n, e));
        if (!hex) continue;
        ctx.fillStyle = Texture.shadeColor(hex, -0.32);
        ctx.fillRect(px(n), py(e), cw + 0.5, chh + 0.5);
      }
    }

    // 1.5) 提花浮线（背面横拉的配色线）——只画被同色夹住的连续段
    //       放在线圈之前，让主色线圈压住浮线两端的 tack stitch
    for (e = e0; e <= e1; e++) {
      // 该行真实 cells（不重复平铺取一次即可，因为 float 按"逻辑单元格"定义）
      const rCells = [];
      const baseR = flip ? (NR - 1 - e) % rows : e % rows;
      for (let n = n0; n <= n1; n++) {
        const iLogic = (n % cols) + baseR * cols;
        rCells.push(cells[iLogic]);
      }
      // 扫描连续段
      let segStart = 0;
      for (let k = 1; k <= rCells.length; k++) {
        const atEnd = k === rCells.length || rCells[k] !== rCells[segStart];
        if (!atEnd) continue;
        const segLen = k - segStart;
        const leftColor = segStart > 0 ? rCells[segStart - 1] : -1;
        const rightColor = k < rCells.length ? rCells[k] : -1;
        const v = rCells[segStart];
        // 浮线条件：左右邻居同色 且 邻居 != 本段颜色
        if (leftColor >= 0 && rightColor >= 0 && leftColor === rightColor && leftColor !== v && segLen > 0) {
          const anchorHex = hexOf((segStart - 1) + baseR * cols);
          const floatHex = hexOf(v + baseR * cols);
          if (!anchorHex || !floatHex) { segStart = k; continue; }
          // 浮线是一条压扁的椭圆（在背面被主色压住，更细、更暗、带轻微下垂）
          const floatY = py(e) + chh * 0.58;  // 偏下一点，模拟拉线下垂
          const floatX1 = px(segStart - 1) + cw * 0.55;
          const floatX2 = px(k) + cw * 0.45;
          const floatW = Math.max(1.5, cw * 0.18);
          // 浮线主体：渐变两端向背景色过渡，模拟被主色压住消失
          const grd = ctx.createLinearGradient(floatX1, 0, floatX2, 0);
          const fc = Texture.hexToRgb(floatHex);
          const darken = (t) => {
            const a = fc[0] * (1 - t), b = fc[1] * (1 - t), c = fc[2] * (1 - t);
            return "rgba(" + Math.round(a) + "," + Math.round(b) + "," + Math.round(c) + "," + (0.55 * (1 - t * 0.6)) + ")";
          };
          grd.addColorStop(0, darken(0.85));
          grd.addColorStop(0.15, darken(0.35));
          grd.addColorStop(0.85, darken(0.35));
          grd.addColorStop(1, darken(0.85));
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.ellipse((floatX1 + floatX2) / 2, floatY, (floatX2 - floatX1) / 2, floatW / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          // 浮线高光：一条极细的浅色中线，让线有"圆柱感"
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(floatX1 + floatW, floatY - 0.4, floatX2 - floatX1 - floatW * 2, 0.7);
          // Tack stitch：浮线两端被主色线圈压住的小圆点（模拟编织时的压线固定）
          const tkR = Math.max(1.5, cw * 0.14);
          ctx.fillStyle = anchorHex;
          for (const tx of [floatX1, floatX2]) {
            ctx.beginPath();
            ctx.arc(tx, floatY, tkR, 0, Math.PI * 2);
            ctx.fill();
          }
          // Tack stitch 阴影：让主色压着浮线的感觉更真实
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          for (const tx of [floatX1, floatX2]) {
            ctx.beginPath();
            ctx.arc(tx, floatY + tkR * 0.35, tkR * 0.55, 0, Math.PI);
            ctx.fill();
          }
        }
        segStart = k;
      }
    }

    // 2) 线圈纹理，自下而上绘制，让上面一行压住下面一行
    for (e = e1; e >= e0; e--) {
      for (n = n0; n <= n1; n++) {
        i = cellIdx(n, e);
        hex = hexOf(i);
        if (!hex) continue;
        const tile = Texture.getTile(hex, Texture.af(n, e), tw, th);
        ctx.drawImage(tile.img, tile.sx, tile.sy, tile.sw, tile.sh,
          px(n) + tile.dx / b, py(e) + tile.dy / b, tile.dw / b, tile.dh / b);
      }
    }

    // 3) 提花边界语义：只在两针颜色不同处落笔，单色花型完全不受影响
    if (opt.strandEdges !== false) {
      const fall = [1, 0.52, 0.52];   // 三级柔化，模拟遮挡阴影的衰减
      const segW = Math.max(0.75, cw * 0.055);
      const segH = Math.max(0.75, chh * 0.055);
      const hiW = Math.max(0.75, cw * 0.04);
      const hiH = Math.max(0.75, chh * 0.04);
      for (e = e0; e <= e1; e++) {
        for (n = n0; n <= n1; n++) {
          i = cellIdx(n, e);
          hex = hexOf(i);
          if (!hex) continue;
          const x = px(n), y = py(e);
          const lh = n > 0 ? hexOf(cellIdx(n - 1, e)) : null;
          const uh = e > 0 ? hexOf(cellIdx(n, e - 1)) : null;
          const rowEdge = !!(uh && uh !== hex);
          const colEdge = !!(lh && lh !== hex);
          if (!rowEdge && !colEdge) continue;
          if (colEdge) {
            // 左右同色夹着本格 = 背后被一条浮线跨过，线圈被顶起，压线更紧
            const rh = n + 1 < NC ? hexOf(cellIdx(n + 1, e)) : null;
            const carried = !!(rh && rh === lh);
            const base = carried ? 0.40 : 0.28;
            const c = seamRgb(lh, hex, carried ? 0.58 : 0.48);
            for (let s = 0; s < 3; s++) {
              const sx = s === 0 ? x - segW * 0.5 : (s === 1 ? x - segW * 1.5 : x + segW * 0.5);
              ctx.fillStyle = rgbaAt(c, base * fall[s]);
              ctx.fillRect(sx, y, segW, chh + 0.5);
            }
            ctx.fillStyle = "rgba(255,255,255," + (carried ? 0.16 : 0.11) + ")";
            ctx.fillRect(x + segW * 0.5, y, hiW, chh + 0.5);
          }
          if (rowEdge) {
            // 上方一行后织，压在本行之上
            const c2 = seamRgb(uh, hex, 0.44);
            for (let s = 0; s < 3; s++) {
              const sy = s === 0 ? y - segH * 0.5 : (s === 1 ? y - segH * 1.5 : y + segH * 0.5);
              ctx.fillStyle = rgbaAt(c2, 0.24 * fall[s]);
              ctx.fillRect(x, sy, cw + 0.5, segH);
            }
            ctx.fillStyle = "rgba(255,255,255,0.09)";
            ctx.fillRect(x, y + segH * 0.5, cw + 0.5, hiH);
          }
        }
      }
    }

    // 4) 针法符号
    for (e = e0; e <= e1; e++) {
      for (n = n0; n <= n1; n++) {
        i = cellIdx(n, e);
        const st = stitches[i];
        if (!st) continue;
        hex = hexOf(i);
        if (!hex) continue;
        drawFabricCell(ctx, st, px(n), py(e), cw, chh, hex);
      }
    }

    // 5) 麻花绳
    paintCables(ctx, ch, x0, y0, cw, chh, { ht: ht, vt: vt, flip: flip });
  }

  function paintFabricBase(ctx, ch, x0, y0, w, h, dpr) {
    paintFabric(ctx, ch, { x0: x0, y0: y0, cw: w, chh: h, dpr: dpr });
  }

  function usedCounts() {
    const st = Chart.state.stitches;
    const counts = {};
    for (let i = 0; i < st.length; i++) {
      if (st[i]) counts[st[i]] = (counts[st[i]] || 0) + 1;
    }
    return counts;
  }

  function usedCodes() {
    return Object.keys(usedCounts()).map(Number).sort((a, b) => a - b);
  }

  function anyUsed() {
    const st = Chart.state.stitches;
    for (let i = 0; i < st.length; i++) if (st[i]) return true;
    return false;
  }

  function glyphCanvas(code, size, color) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    drawGlyph(ctx, code, 0, 0, size, size, color || "#2c2a24");
    return cv;
  }

  function renderPicker(container) {
    if (!container) return;
    container.textContent = "";
    SYMS.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stitchBtn";
      btn.dataset.code = String(s.code);
      btn.title = nameOf(s.code);
      btn.appendChild(glyphCanvas(s.code, 26, "#2c2a24"));
      const label = document.createElement("span");
      label.textContent = nameOf(s.code);
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        Editor.setCurStitch(s.code);
        Editor.setTool("stitch");
        container.querySelectorAll(".stitchBtn").forEach((b) => b.classList.remove("on"));
        btn.classList.add("on");
        document.querySelectorAll('.toolList [data-tool="stitch"]').forEach((b) => b.classList.add("on"));
      });
      container.appendChild(btn);
    });
    const cur = container.querySelector(`[data-code="${Editor.getCurStitch()}"]`);
    if (cur) cur.classList.add("on");
  }

  function renderLegend(container) {
    if (!container) return;
    container.textContent = "";
    const counts = usedCounts();
    const codes = Object.keys(counts).map(Number).sort((a, b) => a - b);
    if (!codes.length) {
      const p = document.createElement("div");
      p.className = "hint";
      p.textContent = I18N.t("stitch.none");
      container.appendChild(p);
      return;
    }
    const note = document.createElement("div");
    note.className = "hint";
    note.textContent = I18N.t("stitch.blankNote");
    container.appendChild(note);
    const grid = document.createElement("div");
    grid.className = "legendGrid";
    container.appendChild(grid);
    codes.forEach((code) => {
      const row = document.createElement("div");
      row.className = "legendRow";
      row.appendChild(glyphCanvas(code, 20, "#2c2a24"));
      const eq = document.createElement("span");
      eq.className = "eq";
      eq.textContent = "=";
      row.appendChild(eq);
      const name = document.createElement("span");
      name.className = "nm";
      name.textContent = nameOf(code);
      row.appendChild(name);
      const cnt = document.createElement("b");
      cnt.textContent = "×" + counts[code];
      row.appendChild(cnt);
      grid.appendChild(row);
    });
  }

  return { SYMS, nameOf, drawGlyph, drawFabricCell, paintFabricBase, paintFabric, paintCables, crossSymbol, usedCounts, usedCodes, anyUsed, glyphCanvas, renderPicker, renderLegend };
})();
