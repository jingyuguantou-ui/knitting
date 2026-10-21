const Editor = (() => {
  let cv, ctx, pane;
  let dpr = 1, cssW = 0, cssH = 0;
  const view = { cellH: 26, panX: 0, panY: 0 };
  let tool = "brush";
  let sym = "none";
  let symScope = "chart";
  let brushSize = 1;
  let shapeMode = "stroke";
  let shape = null;
  let sel = null;
  let marquee = null;
  let moving = null;
  let clipboard = null;
  let antsPhase = 0;
  let antsRunning = false;
  let hover = null;
  let drawing = false;
  let paintErase = false;
  let lastCell = null;
  let spaceDown = false;
  let panning = null;
  let curStitch = 1;
  let viewMode = "both";
  let mode = "jacquard";
  let showCellNums = false;
  let ghostRepeat = true;   // t7：重复单元的接缝幽灵平铺预览开关
  let stitchDrawing = false;
  let stitchBefore = null;
  const pointers = new Map();
  let pinchStart = null;
  let stampRec = null;
  let stampHover = null;
  let rafPending = false;
  let lightMode = false;
  let crossDrag = null;
  let crossType = "c3f2";
  const CROSS_PRESET = { c3f2: { left: 3, right: 2, dir: 1 }, c2f3: { left: 2, right: 3, dir: -1 } };

  function aspect() {
    return Chart.state.gauge.rows / Chart.state.gauge.sts;
  }

  function isLocked() {
    const u = Chart.state.underlay;
    return !!(u && u.lock);
  }

  function warnLock() {
    Chart.emit("warn", I18N.t("under.locked"));
  }

  function init() {
    pane = document.getElementById("editorPane");
    cv = document.getElementById("editorCv");
    ctx = cv.getContext("2d");

    window.addEventListener("resize", () => { resize(); schedule(); });
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", onUp);
    cv.addEventListener("pointerleave", () => { hover = null; stampHover = null; updateStatus(); schedule(); });
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("dblclick", fit);
    cv.addEventListener("contextmenu", (e) => e.preventDefault());

    Chart.on("change", onChartChange);
    Chart.on("load", () => { fit(); });

    resize();
    fit();
  }

  function inStroke() {
    return (Chart.isStroking() || drawing || stitchDrawing) && lightMode;
  }

  function onChartChange() {
    if (inStroke()) return;
    schedule();
  }

  function lightEligible() {
    const ch = Chart.state;
    if (sel || shape || stampRec) return false;
    if (ch.tiles.h > 1 || ch.tiles.v > 1) return false;
    if (ch.repeat) return false;
    const u = ch.underlay;
    if (u && u.visible && u.img && u.img.complete && u.img.naturalWidth) return false;
    return true;
  }

  // 织物模式没有格线可补：改一格会牵动左右（提花压线的浮线判定要看右邻）与上下
  // （后织的一行压在前一行之上）的边界，线圈贴图本身还会向外溢出小半格。
  // 所以按「脏格 2 圈 + 溢出余量」裁一块出来，用同一条管线重画，结果与整幅重绘一致。
  const FABRIC_BLEED = 0.6;
  function lightRepaintFabric(c, r) {
    const ch = Chart.state;
    const w = cellW(), h = view.cellH;
    const m = 2;
    const c0 = Math.max(0, c - m), c1 = Math.min(ch.cols - 1, c + m);
    const r0 = Math.max(0, r - m), r1 = Math.min(ch.rows - 1, r + m);
    const gx = view.panX + c0 * w, gy = view.panY + r0 * h;
    const gw = (c1 - c0 + 1) * w, gh = (r1 - r0 + 1) * h;
    let x = gx - w * FABRIC_BLEED, y = gy - h * FABRIC_BLEED;
    let ww = gw + w * FABRIC_BLEED * 2, hh = gh + h * FABRIC_BLEED * 2;
    // 裁切矩形必须落在整数设备像素上；否则边界像素被抗锯齿"只涂一半"，四周会留一圈接缝
    const dx = Math.floor(x * dpr) / dpr, dy = Math.floor(y * dpr) / dpr;
    ww = Math.ceil((x + ww) * dpr) / dpr - dx;
    hh = Math.ceil((y + hh) * dpr) / dpr - dy;
    x = dx; y = dy;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, ww, hh);
    ctx.clip();
    ctx.clearRect(x, y, ww, hh);
    ctx.fillStyle = "#EDE8F3";
    ctx.fillRect(view.panX, view.panY, w * ch.cols, h * ch.rows);
    Stitch.paintFabric(ctx, ch, {
      x0: view.panX, y0: view.panY, cw: w, chh: h, dpr: dpr,
      // 外扩 3 圈：线圈贴图纵向会跨 ±1.46 格溢出，少于 3 圈会漏掉邻行压过来的那一条
      region: { c0: c0 - 3, r0: r0 - 3, c1: c1 + 3, r1: r1 + 3 }
    });
    // 画布外框是最后描的，被上面重绘盖掉的内半边要补回来；只补脏区那一段，避免重复描边加深
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, ww, hh);
    ctx.clip();
    ctx.strokeStyle = "rgba(70,64,52,0.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(view.panX, view.panY, w * ch.cols, h * ch.rows);
    ctx.restore();
    ctx.restore();
  }

  function lightRepaintCell(c, r) {
    const ch = Chart.state;
    if (!Chart.inBounds(c, r)) return;
    if (viewMode === "fabric") { lightRepaintFabric(c, r); return; }
    const w = cellW(), h = view.cellH;
    const x0 = view.panX, y0 = view.panY;
    const x = x0 + c * w, y = y0 + r * h;
    const small = Math.min(w, h) < 7;
    const symMode = viewMode === "symbol";
    const tm = tileModeOn(w, h);
    const i = c + r * ch.cols;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#EDE8F3";
    ctx.fillRect(x, y, w + 0.5, h + 0.5);
    if (symMode) {
      if (tm) fillTile(x, y, w, h, "#ffffff");
      else {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, w + 0.5, h + 0.5);
      }
      const pS = mode !== "stitch" ? ch.palette[ch.cells[i]] : null;
      if (pS && pS.symbol && !ch.stitches[i] && w >= 7 && h >= 7) {
        const fsS = Math.max(8, Math.min(14, Math.floor(h * 0.6)));
        ctx.font = fsS + 'px "Segoe UI", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2c2a24";
        ctx.fillText(pS.symbol, x + w / 2, y + h / 2 + 0.5);
      }
    } else {
      const p = ch.palette[ch.cells[i]];
      if (p) {
        if (tm) fillTile(x, y, w, h, p.hex);
        else {
          ctx.fillStyle = p.hex;
          ctx.fillRect(x, y, w + 0.5, h + 0.5);
        }
      }
    }

    if (viewMode !== "color" && viewMode !== "fabric" && !small) {
      const sc = ch.stitches[i];
      if (sc) {
        const pad = Math.max(1, Math.min(w, h) * 0.06);
        let color = "#2c2a24";
        if (viewMode === "both") {
          const p = ch.palette[ch.cells[i]];
          if (p) {
            const rgb = Texture.hexToRgb(p.hex);
            const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
            if (lum < 0.55) color = "#f5f2ea";
          }
        }
        Stitch.drawGlyph(ctx, sc, x + pad, y + pad, w - pad * 2, h - pad * 2, color);
      }
    }

    if (showCellNums && (viewMode === "color" || viewMode === "both") && w >= 14 && h >= 10 &&
        !(viewMode === "both" && ch.stitches[i])) {
      const v = ch.cells[i];
      const p = ch.palette[v];
      if (p) {
        const fs = Math.max(8, Math.min(12, Math.floor(h * 0.52)));
        ctx.font = fs + 'px "Segoe UI", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const rgb = Texture.hexToRgb(p.hex);
        const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
        ctx.fillStyle = lum < 0.55 ? "rgba(247,244,236,0.92)" : "rgba(30,26,20,0.82)";
        ctx.fillText(p.symbol || String(v + 1), x + w / 2, y + h / 2 + 0.5);
      }
    }

    if (!small && !tm) {
      const minor = "rgba(70,64,52,0.22)", major = "rgba(70,64,52,0.5)", outer = "rgba(70,64,52,0.45)";
      const edge = (i2, n) => {
        if (i2 === 0 || i2 === n) return [outer, 1];
        if (i2 % 10 === 0) return [major, 1];
        return [minor, 1];
      };
      const lx = Math.round(x0 + c * w) + 0.5, rx = Math.round(x0 + (c + 1) * w) + 0.5;
      const ty = Math.round(y0 + r * h) + 0.5, by = Math.round(y0 + (r + 1) * h) + 0.5;
      const seg = (style, lw, ax, ay, bx, byy) => {
        ctx.beginPath();
        ctx.strokeStyle = style;
        ctx.lineWidth = lw;
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, byy);
        ctx.stroke();
      };
      const vl = edge(c, ch.cols), vr = edge(c + 1, ch.cols);
      const ht = edge(r, ch.rows), hb = edge(r + 1, ch.rows);
      seg(vl[0], vl[1], lx, y, lx, y + h);
      seg(vr[0], vr[1], rx, y, rx, y + h);
      seg(ht[0], ht[1], x, ty, x + w, ty);
      seg(hb[0], hb[1], x, by, x + w, by);
    }
  }

  function resize() {
    cssW = pane.clientWidth;
    cssH = pane.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width = Math.max(1, Math.round(cssW * dpr));
    cv.height = Math.max(1, Math.round(cssH * dpr));
  }

  function fit() {
    const ch = Chart.state;
    const a = aspect();
    let topPad = 0;
    const bar = document.getElementById("viewBar");
    if (bar) {
      const cvR = cv.getBoundingClientRect();
      const bR = bar.getBoundingClientRect();
      topPad = Math.max(0, Math.round(bR.bottom - cvR.top)) + 12;
    }
    const cw = (cssW - 70) / (ch.cols * a);
    const chh = (cssH - topPad - 70) / ch.rows;
    view.cellH = Math.max(4, Math.min(cw, chh));
    view.panX = (cssW - view.cellH * a * ch.cols) / 2;
    view.panY = topPad + Math.max(0, (cssH - topPad - view.cellH * ch.rows) / 2);
    schedule();
    emitZoom();
  }

  function cellW() { return view.cellH * aspect(); }

  // t7 幽灵平铺预览：在主图右缘/下缘补铺一个重复单元的半透明副本，让用户直接看到
  // 「下一单元接过来」时接缝处的图文是否连续。副本不叠在主图上，不污染主图案。
  function drawRepeatGhost(ctx, ch, w, h, x0, y0) {
    const rp = ch.repeat;
    if (!rp || rp.w < 1 || rp.h < 1) return;
    const rw = rp.w * w, rh = rp.h * h;
    const sy = y0 + rp.r * h;                       // 单元顶边
    const gx = x0 + w * ch.cols;                    // 主轴区右缘
    const gy = y0 + h * ch.rows;                    // 主轴区下缘
    const ghostH = Math.min(rh, cssH - sy);         // 右缘副本纵向可用高度（到画布底）
    const ghostW = Math.min(rw, cssW - gx);         // 下缘副本横向可用宽度（到画布右）
    const srcCol = (c) => ch.cells[(rp.c + c % rp.w) + (rp.r + Math.floor(c / rp.w) % rp.h) * ch.cols];

    ctx.save();
    // 右缘：主图末列与「下一单元首列」左右相接
    if (gx < cssW && ghostH > 0) {
      ctx.globalAlpha = 0.45;
      for (let rr = 0; rr < rp.h; rr++) {
        const yc = sy + rr * h;
        if (yc >= cssH) break;
        for (let cc = 0; cc < rp.w; cc++) {
          const p = ch.palette[srcCol(cc + rr * rp.w)];
          if (!p) continue;
          ctx.fillStyle = p.hex;
          ctx.fillRect(gx + cc * w, yc, w + 0.4, h + 0.4);
        }
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#b8892b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, sy); ctx.lineTo(gx + 0.5, sy + ghostH);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 下缘：主图底行与「下一单元首行」上下相接
    if (gy < cssH && ghostW > 0) {
      ctx.globalAlpha = 0.45;
      for (let cc = 0; cc < rp.w; cc++) {
        const xc = gx + cc * w;
        if (xc >= cssW) break;
        for (let rr = 0; rr < rp.h; rr++) {
          const yc = gy + rr * h;
          if (yc >= cssH) break;
          const p = ch.palette[srcCol(cc + rr * rp.w)];
          if (!p) continue;
          ctx.fillStyle = p.hex;
          ctx.fillRect(xc, yc, w + 0.4, h + 0.4);
        }
      }
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#b8892b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(gx, gy + 0.5); ctx.lineTo(gx + ghostW, gy + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function tileModeOn(w, h) {
    return viewMode !== "fabric" && w >= 14 && h >= 11;
  }

  function fillTile(x, y, w, h, color) {
    const g = w >= 26 ? 1.5 : 1;
    const r = Math.max(2, Math.min(5, (w - 2 * g) * 0.2));
    ctx.fillStyle = color;
    if (typeof ctx.roundRect === "function") {
      ctx.beginPath();
      ctx.roundRect(x + g, y + g, w - 2 * g, h - 2 * g, r);
      ctx.fill();
    } else {
      ctx.fillRect(x + g, y + g, w - 2 * g, h - 2 * g);
    }
  }

  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; draw(); });
  }

  function draw() {
    const ch = Chart.state;
    const w = cellW(), h = view.cellH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const gw = w * ch.cols, gh = h * ch.rows;
    const x0 = view.panX, y0 = view.panY;

    ctx.fillStyle = "#EDE8F3";
    ctx.fillRect(x0, y0, gw, gh);

    const u = ch.underlay;
    const small = Math.min(w, h) < 7;
    const symMode = viewMode === "symbol";
    const fabricMode = viewMode === "fabric";
    const tm = tileModeOn(w, h);
    if (fabricMode) {
      Stitch.paintFabricBase(ctx, ch, x0, y0, w, h, dpr);
    } else {
      for (let r = 0; r < ch.rows; r++) {
        for (let c = 0; c < ch.cols; c++) {
          if (symMode) {
            if (tm) fillTile(x0 + c * w, y0 + r * h, w, h, "#ffffff");
            else {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(x0 + c * w, y0 + r * h, w + 0.5, h + 0.5);
            }
            const iS = c + r * ch.cols;
            const pS = mode !== "stitch" ? ch.palette[ch.cells[iS]] : null;
            if (pS && pS.symbol && !ch.stitches[iS] && w >= 7 && h >= 7) {
              const fsS = Math.max(8, Math.min(14, Math.floor(h * 0.6)));
              ctx.font = fsS + 'px "Segoe UI", sans-serif';
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = "#2c2a24";
              ctx.fillText(pS.symbol, x0 + c * w + w / 2, y0 + r * h + h / 2 + 0.5);
            }
            continue;
          }
          const v = ch.cells[c + r * ch.cols];
          const p = ch.palette[v];
          if (!p) continue;
          if (tm) fillTile(x0 + c * w, y0 + r * h, w, h, p.hex);
          else {
            ctx.fillStyle = p.hex;
            ctx.fillRect(x0 + c * w, y0 + r * h, w + 0.5, h + 0.5);
          }
        }
      }
    }

    if (!fabricMode && u && u.visible && u.img && u.img.complete && u.img.naturalWidth && !symMode) {
      ctx.save();
      ctx.globalAlpha = u.opacity;
      ctx.drawImage(u.img, x0, y0, gw, gh);
      ctx.restore();
    }

    if (viewMode !== "color" && viewMode !== "fabric" && !small) {
      const pad = Math.max(1, Math.min(w, h) * 0.06);
      for (let r = 0; r < ch.rows; r++) {
        for (let c = 0; c < ch.cols; c++) {
          const sc = ch.stitches[c + r * ch.cols];
          if (!sc) continue;
          let color = "#2c2a24";
          if (viewMode === "both") {
            const p = ch.palette[ch.cells[c + r * ch.cols]];
            if (p) {
              const rgb = Texture.hexToRgb(p.hex);
              const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
              if (lum < 0.55) color = "#f5f2ea";
            }
          }
          Stitch.drawGlyph(ctx, sc, x0 + c * w + pad, y0 + r * h + pad, w - pad * 2, h - pad * 2, color);
        }
      }
      const crosses = ch.crosses;
      if (crosses && crosses.length) {
        for (let i = 0; i < crosses.length; i++) {
          const cr = crosses[i];
          if (!cr) continue;
          const cellsN = cr.left + cr.right;
          const cwX = w * cellsN, chX = h;
          let color = "#2c2a24";
          if (viewMode === "both") {
            const p = ch.palette[ch.cells[cr.c0 + cr.row * ch.cols]];
            if (p) {
              const rgb = Texture.hexToRgb(p.hex);
              const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
              if (lum < 0.55) color = "#f5f2ea";
            }
          }
          Stitch.crossSymbol(ctx, x0 + cr.c0 * w + pad, y0 + cr.row * h + pad,
            cwX - pad * 2, chX - pad * 2, cr.left, cr.right, cr.dir, color);
        }
      }
    }

    if (showCellNums && (viewMode === "color" || viewMode === "both") && w >= 14 && h >= 10) {
      const fs = Math.max(8, Math.min(12, Math.floor(h * 0.52)));
      ctx.font = fs + 'px "Segoe UI", sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let r = 0; r < ch.rows; r++) {
        for (let c = 0; c < ch.cols; c++) {
          const i = c + r * ch.cols;
          if (viewMode === "both" && ch.stitches[i]) continue;
          const v = ch.cells[i];
          const p = ch.palette[v];
          if (!p) continue;
          const rgb = Texture.hexToRgb(p.hex);
          const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
          ctx.fillStyle = lum < 0.55 ? "rgba(247,244,236,0.92)" : "rgba(30,26,20,0.82)";
          ctx.fillText(p.symbol || String(v + 1), x0 + c * w + w / 2, y0 + r * h + h / 2 + 0.5);
        }
      }
    }

    if (!small && !fabricMode) {
      if (tm) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(70,64,52,0.25)";
        ctx.beginPath();
        for (let c = 0; c <= ch.cols; c += 10) {
          const x = Math.round(x0 + c * w) + 0.5;
          ctx.moveTo(x, y0); ctx.lineTo(x, y0 + gh);
        }
        for (let r = 0; r <= ch.rows; r += 10) {
          const y = Math.round(y0 + r * h) + 0.5;
          ctx.moveTo(x0, y); ctx.lineTo(x0 + gw, y);
        }
        ctx.stroke();
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(70,64,52,0.22)";
        ctx.beginPath();
        for (let c = 0; c <= ch.cols; c++) {
          const x = Math.round(x0 + c * w) + 0.5;
          ctx.moveTo(x, y0); ctx.lineTo(x, y0 + gh);
        }
        for (let r = 0; r <= ch.rows; r++) {
          const y = Math.round(y0 + r * h) + 0.5;
          ctx.moveTo(x0, y); ctx.lineTo(x0 + gw, y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(70,64,52,0.5)";
        ctx.beginPath();
        for (let c = 0; c <= ch.cols; c += 10) {
          const x = Math.round(x0 + c * w) + 0.5;
          ctx.moveTo(x, y0); ctx.lineTo(x, y0 + gh);
        }
        for (let r = 0; r <= ch.rows; r += 10) {
          const y = Math.round(y0 + r * h) + 0.5;
          ctx.moveTo(x0, y); ctx.lineTo(x0 + gw, y);
        }
        ctx.stroke();
      }
    }

    if (!tm) {
      ctx.strokeStyle = "rgba(70,64,52,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, gw, gh);
    }

    if (ch.repeat) {
      const rp = ch.repeat;
      ctx.save();
      ctx.setLineDash([7, 4]);
      ctx.strokeStyle = "#b8892b";
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + rp.c * w, y0 + rp.r * h, rp.w * w, rp.h * h);
      ctx.restore();
      const timesH = Math.floor(ch.cols / rp.w);
      const timesV = Math.floor(ch.rows / rp.h);
      if (h >= 11) {
        ctx.fillStyle = "#b8892b";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(I18N.t("knit.repeatNote", { w: rp.w, h: rp.h }), x0 + rp.c * w + 3, y0 + rp.r * h - 3);
      }
    }

    // t7 幽灵平铺预览：主图右缘/下缘补铺下一单元的半透明副本（小格时看不清，跳过）
    if (ch.repeat && ghostRepeat && w >= 5 && h >= 5) {
      drawRepeatGhost(ctx, ch, w, h, x0, y0);
    }

    if (!fabricMode && w >= 14 && h >= 11) {
      const every = w >= 22 ? 1 : (w >= 15 ? 5 : 10);
      ctx.fillStyle = "#8a8474";
      ctx.font = (every === 1 && w < 26 ? "8px" : "9px") + " sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (let n = every; n <= ch.cols; n += every) {
        ctx.fillText(String(n), x0 + (n - 0.5) * w, y0 - 3);
      }
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let n = every; n <= ch.rows; n += every) {
        const rPhys = ch.rows - n;
        ctx.fillText(String(n), x0 - 4, y0 + (rPhys + 0.5) * h);
      }
    }

    if (!fabricMode && h >= 11 && w >= 8) {
      const flat = ch.knitting !== "round";
      const step = h >= 16 ? 1 : 5;
      ctx.fillStyle = "#b0a893";
      ctx.font = "8px sans-serif";
      ctx.textBaseline = "middle";
      for (let n = 1; n <= ch.rows; n++) {
        if (n % step !== 0) continue;
        const rPhys = ch.rows - n;
        const cyv = y0 + (rPhys + 0.5) * h;
        const readLeft = !flat || n % 2 === 1;
        if (readLeft) {
          const ax = x0 + gw + 6;
          ctx.beginPath();
          ctx.moveTo(ax + 5, cyv - 3.5);
          ctx.lineTo(ax, cyv);
          ctx.lineTo(ax + 5, cyv + 3.5);
          ctx.fill();
        } else {
          const ax = x0 - 20;
          ctx.beginPath();
          ctx.moveTo(ax, cyv - 3.5);
          ctx.lineTo(ax + 5, cyv);
          ctx.lineTo(ax, cyv + 3.5);
          ctx.fill();
        }
      }
    }

    if (shape) {
      const pts = shapeCells(shape);
      const v = shape.erase ? ch.bg : ch.fg;
      const p = ch.palette[v];
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = p ? p.hex : "#000";
      const off = brushSize >> 1;
      for (const [x, y] of pts) {
        ctx.fillRect(x0 + (x - off) * w, y0 + (y - off) * h, w * brushSize, h * brushSize);
      }
      ctx.restore();
    }

    if (crossDrag) {
      let c0 = Math.min(crossDrag.c0, crossDrag.c1), c1 = Math.max(crossDrag.c0, crossDrag.c1);
      let span = c1 - c0 + 1;
      if (span < 2) span = 5;
      const preset = CROSS_PRESET[crossType] || CROSS_PRESET.c3f2;
      const left = Math.max(1, Math.min(span - 1, preset.left));
      const right = span - left;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#2c2a24";
      ctx.fillRect(x0 + c0 * w, y0 + crossDrag.r * h, span * w, h);
      ctx.restore();
      if (w >= 9 && h >= 9 && c0 + left + right <= ch.cols) {
        Stitch.crossSymbol(ctx, x0 + c0 * w + 1, y0 + crossDrag.r * h + 1,
          w * span - 2, h - 2, left, right, preset.dir, "#2c2a24");
      }
    }

    if (stampRec && stampHover) {
      ctx.save();
      ctx.globalAlpha = 0.65;
      for (let r = 0; r < stampRec.h; r++) {
        for (let c = 0; c < stampRec.w; c++) {
          const p = stampRec.palette[stampRec.cells[c + r * stampRec.w]];
          if (!p) continue;
          ctx.fillStyle = p.hex;
          const x = stampHover.c + c, y = stampHover.r + r;
          if (x < 0 || y < 0 || x >= ch.cols || y >= ch.rows) continue;
          ctx.fillRect(x0 + x * w, y0 + y * h, w + 0.5, h + 0.5);
        }
      }
      ctx.restore();
    }

    if (hover) {
      const { c, r } = hover;
      ctx.strokeStyle = "#b8892b";
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + c * w - 1, y0 + r * h - 1, w + 2, h + 2);
    }

    if (sel) {
      const x = x0 + sel.c0 * w;
      const y = y0 + sel.r0 * h;
      const ww = (sel.c1 - sel.c0 + 1) * w;
      const hh = (sel.r1 - sel.r0 + 1) * h;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeRect(x, y, ww, hh);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -antsPhase;
      ctx.strokeStyle = "#3b382f";
      ctx.strokeRect(x, y, ww, hh);
      ctx.restore();
    }
  }

  function ensureAnts() {
    if (antsRunning || !sel) return;
    antsRunning = true;
    (function loop() {
      if (!sel) { antsRunning = false; return; }
      antsPhase = (antsPhase + 0.6) % 10;
      schedule();
      requestAnimationFrame(loop);
    })();
  }

  function normRect(c0, r0, c1, r1) {
    return {
      c0: Math.min(c0, c1), r0: Math.min(r0, r1),
      c1: Math.max(c0, c1), r1: Math.max(r0, r1)
    };
  }

  function setSel(s) {
    sel = s;
    syncSelUI();
    if (sel) ensureAnts();
    schedule();
  }

  function getSel() { return sel; }

  function clearSel() { setSel(null); }

  function syncSelUI() {
    const b = document.getElementById("btnExportSel");
    if (b) b.disabled = !sel;
    const bar = document.getElementById("selBar");
    if (bar) bar.hidden = !sel;
    const st = document.getElementById("statSel");
    if (st) st.textContent = sel
      ? "选区 " + (sel.c1 - sel.c0 + 1) + " × " + (sel.r1 - sel.r0 + 1)
      : "";
  }

  function selInBounds(s, ch) {
    return s.c0 >= 0 && s.r0 >= 0 && s.c1 < ch.cols && s.r1 < ch.rows;
  }

  function deleteSel() {
    if (!sel) return;
    if (isLocked()) { warnLock(); return; }
    const ch = Chart.state;
    const before = Chart.snapshot();
    let changed = false;
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        if (Chart.setCell(c, r, ch.bg)) changed = true;
        if (Chart.setStitch(c, r, 0)) changed = true;
      }
    }
    if (!changed) return;
    Chart.pushUndo("delSel", before);
    Chart.emit("change", { type: "cells" });
  }

  function copySel() {
    if (!sel) return false;
    const ch = Chart.state;
    const w = sel.c1 - sel.c0 + 1, h = sel.r1 - sel.r0 + 1;
    const data = new Uint8Array(w * h);
    const st = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const si = (sel.c0 + c) + (sel.r0 + r) * ch.cols;
        data[c + r * w] = ch.cells[si];
        st[c + r * w] = ch.stitches[si];
      }
    }
    clipboard = { w, h, data, st };
    return true;
  }

  function cutSel() {
    if (!copySel()) return;
    deleteSel();
  }

  function pasteSel() {
    if (!clipboard) return;
    if (isLocked()) { warnLock(); return; }
    const ch = Chart.state;
    let pc = sel ? sel.c0 : 0;
    let pr = sel ? sel.r0 : 0;
    const before = Chart.snapshot();
    let changed = false;
    for (let r = 0; r < clipboard.h; r++) {
      for (let c = 0; c < clipboard.w; c++) {
        if (Chart.setCell(pc + c, pr + r, clipboard.data[c + r * clipboard.w])) changed = true;
        if (Chart.setStitch(pc + c, pr + r, clipboard.st[c + r * clipboard.w])) changed = true;
      }
    }
    if (changed) {
      Chart.pushUndo("paste", before);
      Chart.emit("change", { type: "cells" });
    }
    setSel({
      c0: pc, r0: pr,
      c1: Math.min(ch.cols - 1, pc + clipboard.w - 1),
      r1: Math.min(ch.rows - 1, pr + clipboard.h - 1)
    });
  }

  function moveBegin(cell) {
    const ch = Chart.state;
    moving = {
      grabC: cell.c - sel.c0,
      grabR: cell.r - sel.r0,
      snapBefore: Chart.snapshot(),
      beforeCells: ch.cells.slice(),
      beforeSt: ch.stitches.slice(),
      rect: { c0: sel.c0, r0: sel.r0, c1: sel.c1, r1: sel.r1 },
      moved: false
    };
    const w = moving.rect.c1 - moving.rect.c0 + 1;
    const h = moving.rect.r1 - moving.rect.r0 + 1;
    moving.w = w;
    moving.h = h;
    moving.data = new Uint8Array(w * h);
    moving.st = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const si = (moving.rect.c0 + c) + (moving.rect.r0 + r) * ch.cols;
        moving.data[c + r * w] = ch.cells[si];
        moving.st[c + r * w] = ch.stitches[si];
      }
    }
    for (let r = moving.rect.r0; r <= moving.rect.r1; r++) {
      for (let c = moving.rect.c0; c <= moving.rect.c1; c++) {
        Chart.setCell(c, r, ch.bg);
        Chart.setStitch(c, r, 0);
      }
    }
    Chart.emit("change", { type: "cells" });
  }

  function moveUpdate(cell) {
    const ch = Chart.state;
    const wantC = cell.c - moving.grabC;
    const wantR = cell.r - moving.grabR;
    const dc = Math.max(-moving.rect.c0, Math.min(ch.cols - 1 - moving.rect.c1, wantC - moving.rect.c0));
    const dr = Math.max(-moving.rect.r0, Math.min(ch.rows - 1 - moving.rect.r1, wantR - moving.rect.r0));
    ch.cells.set(moving.beforeCells);
    ch.stitches.set(moving.beforeSt);
    const nc = moving.rect.c0 + dc, nr = moving.rect.r0 + dr;
    for (let r = 0; r < moving.h; r++) {
      for (let c = 0; c < moving.w; c++) {
        const x = nc + c, y = nr + r;
        if (x >= 0 && y >= 0 && x < ch.cols && y < ch.rows) {
          ch.cells[x + y * ch.cols] = moving.data[c + r * moving.w];
          ch.stitches[x + y * ch.cols] = moving.st[c + r * moving.w];
        }
      }
    }
    moving.moved = true;
    sel = { c0: nc, r0: nr, c1: nc + moving.w - 1, r1: nr + moving.h - 1 };
    Chart.emit("change", { type: "cells" });
  }

  function moveEnd() {
    if (!moving) return;
    if (!moving.moved) {
      const ch = Chart.state;
      ch.cells.set(moving.beforeCells);
      ch.stitches.set(moving.beforeSt);
      Chart.emit("change", { type: "cells" });
    } else {
      Chart.pushUndo("move", moving.snapBefore);
    }
    moving = null;
    syncSelUI();
  }

  function cellAt(clientX, clientY) {
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const c = Math.floor((x - view.panX) / cellW());
    const r = Math.floor((y - view.panY) / view.cellH);
    if (!Chart.inBounds(c, r)) return null;
    return { c, r };
  }

  function rawCellAt(clientX, clientY) {
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return {
      c: Math.floor((x - view.panX) / cellW()),
      r: Math.floor((y - view.panY) / view.cellH)
    };
  }

  function clampCell(p) {
    const ch = Chart.state;
    return {
      c: Math.max(0, Math.min(ch.cols - 1, p.c)),
      r: Math.max(0, Math.min(ch.rows - 1, p.r))
    };
  }

  function symPositions(c, r) {
    const ch = Chart.state;
    if (sym === "none") return [[c, r]];
    if (symScope === "sel" && sel) {
      const mc = sel.c0 + sel.c1 - c, mr = sel.r0 + sel.r1 - r;
      if (sym === "h") return [[c, r], [mc, r]];
      if (sym === "v") return [[c, r], [c, mr]];
      return [[c, r], [mc, r], [c, mr], [mc, mr]];
    }
    const mc = ch.cols - 1 - c, mr = ch.rows - 1 - r;
    if (sym === "h") return [[c, r], [mc, r]];
    if (sym === "v") return [[c, r], [c, mr]];
    if (sym === "q") return [[c, r], [mc, r], [c, mr], [mc, mr]];
    if (sym === "brick") return [[c, r], [(mc + Math.floor(ch.cols / 2)) % ch.cols, r]];
    return [[c, r]];
  }

  function nearestPal(r, g, b) {
    const pal = Chart.state.palette;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const rgb = Texture.hexToRgb(pal[i].hex);
      const dr = rgb[0] - r, dg = rgb[1] - g, db = rgb[2] - b;
      const d = dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.7;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function placeStamp(cell) {
    const ch = Chart.state;
    const before = Chart.snapshot();
    const map = [];
    let changedPal = false;
    for (const p of stampRec.palette) {
      let i = -1;
      for (let k = 0; k < ch.palette.length; k++) {
        if (ch.palette[k].hex.toLowerCase() === p.hex.toLowerCase()) { i = k; break; }
      }
      if (i < 0) {
        if (ch.palette.length >= 256) { Chart.emit("warn", I18N.t("palette.limit")); return; }
        i = ch.palette.length;
        ch.palette.push({ hex: p.hex, name: p.name });
        changedPal = true;
      }
      map.push(i);
    }
    let changed = false;
    for (let r = 0; r < stampRec.h; r++) {
      for (let c = 0; c < stampRec.w; c++) {
        const v = map[stampRec.cells[c + r * stampRec.w]];
        const pos = symPositions(cell.c + c, cell.r + r);
        for (const [sc, sr] of pos) {
          if (Chart.setCell(sc, sr, v)) changed = true;
        }
      }
    }
    if (!changed && !changedPal) return;
    Chart.pushUndo("stamp", before);
    Chart.emit("change", { type: "cells" });
  }

  function setStamp(rec) {
    stampRec = rec || null;
    stampHover = null;
    const cursors = { picker: "copy", fill: "cell", select: "default", wand: "cell" };
    cv.style.cursor = stampRec ? "copy" : (cursors[tool] || "crosshair");
    Chart.emit("stampmode", !!stampRec);
    schedule();
  }

  function getStamp() { return stampRec; }

  function paintCell(c, r) {
    const ch = Chart.state;
    const v = paintErase ? ch.bg : ch.fg;
    const pos = symPositions(c, r);
    const off = brushSize >> 1;
    const hits = [];
    for (let i = 0; i < pos.length; i++) {
      for (let dr = 0; dr < brushSize; dr++) {
        for (let dc = 0; dc < brushSize; dc++) {
          const x = pos[i][0] - off + dc, y = pos[i][1] - off + dr;
          if (Chart.setCell(x, y, v)) hits.push(x, y);
        }
      }
    }
    if (!hits.length) return;
    Chart.emit("change", { type: "cells" });
    if (drawing && lightMode) {
      for (let i = 0; i < hits.length; i += 2) lightRepaintCell(hits[i], hits[i + 1]);
    }
  }

  function paintLine(a, b) {
    let x0 = a.c, y0 = a.r, x1 = b.c, y1 = b.r;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paintCell(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function paintStitchCell(c, r) {
    const v = paintErase ? 0 : curStitch;
    const pos = symPositions(c, r);
    const off = brushSize >> 1;
    const hits = [];
    for (let i = 0; i < pos.length; i++) {
      for (let dr = 0; dr < brushSize; dr++) {
        for (let dc = 0; dc < brushSize; dc++) {
          const x = pos[i][0] - off + dc, y = pos[i][1] - off + dr;
          if (Chart.setStitch(x, y, v)) hits.push(x, y);
        }
      }
    }
    if (!hits.length) return;
    Chart.emit("change", { type: "stitches" });
    if (drawing && lightMode) {
      for (let i = 0; i < hits.length; i += 2) lightRepaintCell(hits[i], hits[i + 1]);
    }
  }

  function fillStitchRegion(c, r, v) {
    const ch = Chart.state;
    if (!Chart.inBounds(c, r)) return false;
    const target = ch.stitches[Chart.idx(c, r)];
    if (target === v) return false;
    const stack = [[c, r]];
    const w = ch.cols, h = ch.rows;
    let changed = false;
    while (stack.length) {
      const pt = stack.pop();
      const x = pt[0], y = pt[1];
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = x + y * w;
      if (ch.stitches[i] !== target) continue;
      ch.stitches[i] = v;
      changed = true;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return changed;
  }

  function sPaintLine(a, b) {
    let x0 = a.c, y0 = a.r, x1 = b.c, y1 = b.r;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paintStitchCell(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function bresLine(a, b, out) {
    let x0 = a.c, y0 = a.r, x1 = b.c, y1 = b.r;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      out.push([x0, y0]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function shapeCells(s) {
    const ch = Chart.state;
    const r = normRect(s.start.c, s.start.r, s.end.c, s.end.r);
    const pts = [];
    const isFill = shapeMode === "fill" && s.type !== "line";
    if (s.type === "line") {
      bresLine(s.start, s.end, pts);
    } else if (s.type === "rect") {
      if (isFill) {
        for (let y = r.r0; y <= r.r1; y++) {
          for (let x = r.c0; x <= r.c1; x++) pts.push([x, y]);
        }
      } else {
        bresLine({ c: r.c0, r: r.r0 }, { c: r.c1, r: r.r0 }, pts);
        bresLine({ c: r.c1, r: r.r0 }, { c: r.c1, r: r.r1 }, pts);
        bresLine({ c: r.c1, r: r.r1 }, { c: r.c0, r: r.r1 }, pts);
        bresLine({ c: r.c0, r: r.r1 }, { c: r.c0, r: r.r0 }, pts);
      }
    } else if (s.type === "ellipse") {
      const w = r.c1 - r.c0 + 1, h = r.r1 - r.r0 + 1;
      const cx = (r.c0 + r.c1 + 1) / 2, cy = (r.r0 + r.r1 + 1) / 2;
      const rx = w / 2, ry = h / 2;
      const seen = new Set();
      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= ch.cols || y >= ch.rows) return;
        const k = x + y * ch.cols;
        if (seen.has(k)) return;
        seen.add(k);
        pts.push([x, y]);
      };
      if (isFill) {
        for (let y = r.r0; y <= r.r1; y++) {
          const dy = (y + 0.5 - cy) / ry;
          if (Math.abs(dy) > 1) continue;
          const dx = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
          const xs = Math.max(r.c0, Math.ceil(cx - dx - 0.5));
          const xe = Math.min(r.c1, Math.floor(cx + dx - 0.5));
          for (let x = xs; x <= xe; x++) push(x, y);
        }
      } else {
        for (let y = r.r0; y <= r.r1; y++) {
          const dy = (y + 0.5 - cy) / ry;
          if (Math.abs(dy) > 1) continue;
          const dx = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
          const xs = Math.max(r.c0, Math.ceil(cx - dx - 0.5));
          const xe = Math.min(r.c1, Math.floor(cx + dx - 0.5));
          push(xs, y);
          push(xe, y);
        }
        for (let x = r.c0; x <= r.c1; x++) {
          const dx = (x + 0.5 - cx) / rx;
          if (Math.abs(dx) > 1) continue;
          const dy = ry * Math.sqrt(Math.max(0, 1 - dx * dx));
          const ys = Math.max(r.r0, Math.ceil(cy - dy - 0.5));
          const ye = Math.min(r.r1, Math.floor(cy + dy - 0.5));
          push(x, ys);
          push(x, ye);
        }
      }
    }
    return pts;
  }

  function commitShape(s) {
    const ch = Chart.state;
    const v = s.erase ? ch.bg : ch.fg;
    const pts = shapeCells(s);
    const off = brushSize >> 1;
    let changed = false;
    for (const [x, y] of pts) {
      const pos = symPositions(x, y);
      for (const [sc, sr] of pos) {
        for (let dr = 0; dr < brushSize; dr++) {
          for (let dc = 0; dc < brushSize; dc++) {
            if (Chart.setCell(sc - off + dc, sr - off + dr, v)) changed = true;
          }
        }
      }
    }
    if (changed) Chart.emit("change", { type: "cells" });
  }

  function wandSelect(cell) {
    const ch = Chart.state;
    const w = ch.cols, h = ch.rows;
    const target = ch.cells[cell.c + cell.r * w];
    const seen = new Uint8Array(w * h);
    const stack = [cell.c, cell.r];
    let c0 = cell.c, r0 = cell.r, c1 = cell.c, r1 = cell.r;
    seen[cell.c + cell.r * w] = 1;
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < c0) c0 = x;
      if (x > c1) c1 = x;
      if (y < r0) r0 = y;
      if (y > r1) r1 = y;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const i = nx + ny * w;
        if (seen[i] || ch.cells[i] !== target) continue;
        seen[i] = 1;
        stack.push(nx, ny);
      }
    }
    setSel({ c0, r0, c1, r1 });
  }

  function readSelData() {
    const ch = Chart.state;
    const w = sel.c1 - sel.c0 + 1, h = sel.r1 - sel.r0 + 1;
    const data = new Uint8Array(w * h);
    const st = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const si = (sel.c0 + c) + (sel.r0 + r) * ch.cols;
        data[c + r * w] = ch.cells[si];
        st[c + r * w] = ch.stitches[si];
      }
    }
    return { w, h, data, st };
  }

  function writeSelData(buf, anchor) {
    const before = Chart.snapshot();
    let changed = false;
    for (let r = 0; r < buf.h; r++) {
      for (let c = 0; c < buf.w; c++) {
        const i = c + r * buf.w;
        if (Chart.setCell(anchor.c + c, anchor.r + r, buf.data[i])) changed = true;
        if (Chart.setStitch(anchor.c + c, anchor.r + r, buf.st[i])) changed = true;
      }
    }
    if (changed) {
      Chart.pushUndo("selXform", before);
      Chart.emit("change", { type: "cells" });
    }
  }

  function transformSel(fn) {
    if (!sel) return;
    if (isLocked()) { warnLock(); return; }
    const src = readSelData();
    const out = fn(src);
    writeSelData(out, { c: sel.c0, r: sel.r0 });
    setSel({ c0: sel.c0, r0: sel.r0, c1: sel.c0 + out.w - 1, r1: sel.r0 + out.h - 1 });
  }

  function flipSelH() {
    transformSel((s) => {
      const d = new Uint8Array(s.data.length);
      const ds = new Uint8Array(s.st.length);
      for (let r = 0; r < s.h; r++) {
        for (let c = 0; c < s.w; c++) {
          d[c + r * s.w] = s.data[(s.w - 1 - c) + r * s.w];
          ds[c + r * s.w] = s.st[(s.w - 1 - c) + r * s.w];
        }
      }
      return { w: s.w, h: s.h, data: d, st: ds };
    });
  }

  function flipSelV() {
    transformSel((s) => {
      const d = new Uint8Array(s.data.length);
      const ds = new Uint8Array(s.st.length);
      for (let r = 0; r < s.h; r++) {
        for (let c = 0; c < s.w; c++) {
          d[c + r * s.w] = s.data[c + (s.h - 1 - r) * s.w];
          ds[c + r * s.w] = s.st[c + (s.h - 1 - r) * s.w];
        }
      }
      return { w: s.w, h: s.h, data: d, st: ds };
    });
  }

  function rotateSel() {
    if (!sel) return;
    if (isLocked()) { warnLock(); return; }
    const ch = Chart.state;
    const src = readSelData();
    const w = src.w, h = src.h;
    const d = new Uint8Array(src.data.length);
    const ds = new Uint8Array(src.st.length);
    let nw = h, nh = w;
    let nc0 = sel.c0, nr0 = sel.r0;
    if (nc0 + nw - 1 > ch.cols - 1) nc0 = Math.max(0, ch.cols - nw);
    if (nr0 + nh - 1 > ch.rows - 1) nr0 = Math.max(0, ch.rows - nh);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const x = h - 1 - r, y = c;
        d[x + y * nw] = src.data[c + r * w];
        ds[x + y * nw] = src.st[c + r * w];
      }
    }
    writeSelData({ w: nw, h: nh, data: d, st: ds }, { c: nc0, r: nr0 });
    setSel({ c0: nc0, r0: nr0, c1: nc0 + nw - 1, r1: nr0 + nh - 1 });
  }

  function fillSel() {
    if (!sel) return;
    if (isLocked()) { warnLock(); return; }
    const ch = Chart.state;
    Chart.beginStroke("fillSel");
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) Chart.setCell(c, r, ch.fg);
    }
    Chart.endStroke();
  }

  function onDown(e) {
    if (e.button === 1 || spaceDown || e.pointerType === "touch") {
      panning = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY, id: e.pointerId };
      cv.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) startPinch();
      e.preventDefault();
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    const cell = cellAt(e.clientX, e.clientY);
    if (!cell) return;
    cv.setPointerCapture(e.pointerId);

    const effective0 = e.altKey ? "picker" : (e.button === 2 ? (tool === "stitch" ? "stitch" : "eraser") : tool);
    let effective = effective0;
    if (mode === "stitch") {
      if (effective0 === "picker") effective = "pickStitch";
      else if (tool === "cross") effective = e.button === 2 ? "crossDel" : "cross";
      else if (e.button === 2) effective = "stitchErase";
      else if (effective0 === "fill") effective = "fillStitch";
      else if (effective0 === "eraser") effective = "stitchErase";
      else if (effective0 !== "select") effective = "stitch";
    }

    if (stampRec && !e.altKey) {
      if (e.button === 2) { setStamp(null); return; }
      if (isLocked()) { warnLock(); return; }
      placeStamp(cell);
      return;
    }

    if (effective === "crossDel") {
      const xs = Chart.getCrosses() || [];
      let hit = null;
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        if (x.row === cell.r && cell.c >= x.c0 && cell.c <= x.c0 + x.left + x.right - 1) { hit = x; break; }
      }
      if (hit && !isLocked()) {
        Chart.removeCross(hit.row, hit.c0);
        schedule();
      }
      return;
    }
    if (effective === "cross") {
      if (isLocked()) { warnLock(); return; }
      crossDrag = { r: cell.r, c0: cell.c, c1: cell.c };
      updateStatus(cell);
      schedule();
      return;
    }

    const mutating = effective === "brush" || effective === "eraser" || effective === "fill" ||
      effective === "line" || effective === "rect" || effective === "ellipse" || effective === "stitch" ||
      effective === "stitchErase" || effective === "fillStitch";
    if (mutating && isLocked()) { warnLock(); return; }

    if (effective === "select") {
      if (sel && cell.c >= sel.c0 && cell.c <= sel.c1 && cell.r >= sel.r0 && cell.r <= sel.r1) {
        if (isLocked()) { warnLock(); return; }
        moveBegin(cell);
      } else {
        marquee = { c: cell.c, r: cell.r };
        setSel({ c0: cell.c, r0: cell.r, c1: cell.c, r1: cell.r });
      }
      updateStatus(cell);
      return;
    }

    if (effective === "picker") {
      const u = Chart.state.underlay;
      if (u && u.eyedrop && u.img && u.img.complete && u.img.naturalWidth) {
        const ch = Chart.state;
        const iw = u.img.naturalWidth, ih = u.img.naturalHeight;
        const tmp = document.createElement("canvas");
        tmp.width = iw;
        tmp.height = ih;
        const tc = tmp.getContext("2d", { willReadFrequently: true });
        tc.drawImage(u.img, 0, 0);
        const ix = Math.max(0, Math.min(iw - 1, Math.floor((cell.c + 0.5) / ch.cols * iw)));
        const iy = Math.max(0, Math.min(ih - 1, Math.floor((cell.r + 0.5) / ch.rows * ih)));
        const d = tc.getImageData(ix, iy, 1, 1).data;
        ch.fg = nearestPal(d[0], d[1], d[2]);
        Chart.emit("palette", null);
        setTool("brush");
        return;
      }
      const v = Chart.state.cells[Chart.idx(cell.c, cell.r)];
      Chart.state.fg = v;
      Chart.emit("palette", null);
      setTool("brush");
      return;
    }
    if (effective === "wand") {
      wandSelect(cell);
      return;
    }
    if (effective === "line" || effective === "rect" || effective === "ellipse") {
      Chart.beginStroke("shape");
      shape = { type: effective, start: { c: cell.c, r: cell.r }, end: { c: cell.c, r: cell.r }, erase: e.button === 2 };
      updateStatus(cell);
      schedule();
      return;
    }
    if (effective === "fill") {
      Chart.beginStroke("fill");
      const pos = symPositions(cell.c, cell.r);
      for (let i = 0; i < pos.length; i++) Chart.floodFill(pos[i][0], pos[i][1], Chart.state.fg);
      Chart.endStroke();
      return;
    }
    if (effective === "pickStitch") {
      const v = Chart.getStitch(cell.c, cell.r);
      setCurStitch(v);
      setTool("stitch");
      const sp = document.getElementById("stitchPicker");
      if (sp && window.Stitch) Stitch.renderPicker(sp);
      updateStatus(cell);
      return;
    }
    if (effective === "fillStitch") {
      const before = Chart.snapshot();
      let changed = false;
      const spos = symPositions(cell.c, cell.r);
      for (let i = 0; i < spos.length; i++) {
        if (fillStitchRegion(spos[i][0], spos[i][1], curStitch)) changed = true;
      }
      if (changed) {
        Chart.pushUndo("stitch", before);
        Chart.emit("change", { type: "stitches" });
      }
      updateStatus(cell);
      return;
    }
    if (effective === "stitch" || effective === "stitchErase") {
      stitchBefore = Chart.snapshot();
      stitchDrawing = true;
      drawing = true;
      paintErase = effective === "stitchErase";
      lightMode = lightEligible();
      hover = null;
      lastCell = cell;
      paintStitchCell(cell.c, cell.r);
      schedule();
      updateStatus(cell);
      return;
    }
    Chart.beginStroke("paint");
    drawing = true;
    paintErase = effective === "eraser";
    lightMode = lightEligible();
    hover = null;
    lastCell = cell;
    paintCell(cell.c, cell.r);
    schedule();
    updateStatus(cell);
  }

  function onMove(e) {
    if (pointers.has(e.pointerId) && pointers.size >= 1) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStart) { doPinch(); return; }
      if (panning) {
        view.panX = panning.panX + (e.clientX - panning.x);
        view.panY = panning.panY + (e.clientY - panning.y);
        schedule();
        return;
      }
    }
    if (moving) {
      moveUpdate(rawCellAt(e.clientX, e.clientY));
      updateStatus(clampCell(rawCellAt(e.clientX, e.clientY)));
      schedule();
      return;
    }
    if (marquee) {
      const end = rawCellAt(e.clientX, e.clientY);
      setSel(normRect(marquee.c, marquee.r, end.c, end.r));
      return;
    }
    if (crossDrag) {
      const end = rawCellAt(e.clientX, e.clientY);
      if (end && end.r === crossDrag.r) crossDrag.c1 = end.c;
      schedule();
      return;
    }
    if (shape) {
      shape.end = clampCell(rawCellAt(e.clientX, e.clientY));
      updateStatus(shape.end);
      schedule();
      return;
    }
    const cell = cellAt(e.clientX, e.clientY);
    hover = drawing ? null : cell;
    stampHover = stampRec ? cell : stampHover;
    updateStatus(cell);
    if (drawing && cell) {
      if (stitchDrawing) {
        if (lastCell && (lastCell.c !== cell.c || lastCell.r !== cell.r)) sPaintLine(lastCell, cell);
        else paintStitchCell(cell.c, cell.r);
      } else if (lastCell && (lastCell.c !== cell.c || lastCell.r !== cell.r)) paintLine(lastCell, cell);
      else paintCell(cell.c, cell.r);
      lastCell = cell;
    }
    if (!drawing) schedule();
  }

  function cancelShape() {
    if (!shape) return;
    shape = null;
    Chart.abortStroke();
    schedule();
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (panning && panning.id === e.pointerId) panning = null;
    if (moving) {
      moveEnd();
      return;
    }
    if (marquee) {
      marquee = null;
      return;
    }
    if (crossDrag) {
      const d = crossDrag;
      crossDrag = null;
      const ch = Chart.state;
      let c0 = Math.min(d.c0, d.c1), c1 = Math.max(d.c0, d.c1);
      let span = c1 - c0 + 1;
      if (span < 2) { span = 5; c0 = Math.max(0, Math.min(ch.cols - span, d.c0 - 1)); c1 = c0 + span - 1; }
      const preset = CROSS_PRESET[crossType] || CROSS_PRESET.c3f2;
      let left = preset.left, right = preset.right;
      if (left + right !== span) {
        if (span >= left + right) { right = span - left; }
        else { left = Math.max(1, Math.round(span * left / (left + right))); right = span - left; }
      }
      if (left < 1 || right < 1 || c0 + left + right > ch.cols) { schedule(); return; }
      Chart.addCross(d.r, c0, left, right, preset.dir);
      schedule();
      return;
    }
    if (shape) {
      const s = shape;
      shape = null;
      commitShape(s);
      Chart.endStroke();
      schedule();
      return;
    }
    if (drawing) {
      drawing = false;
      lastCell = null;
      if (stitchDrawing) {
        stitchDrawing = false;
        lightMode = false;
        if (stitchBefore) {
          Chart.pushUndo("stitch", stitchBefore);
          stitchBefore = null;
        }
        Chart.emit("change", { type: "stitches" });
      } else {
        Chart.endStroke();
        lightMode = false;
      }
    }
  }

  function startPinch() {
    const pts = [...pointers.values()];
    pinchStart = {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
      cellH: view.cellH,
      panX: view.panX,
      panY: view.panY,
      mx: (pts[0].x + pts[1].x) / 2,
      my: (pts[0].y + pts[1].y) / 2
    };
    panning = null;
    drawing = false;
    Chart.endStroke();
    if (stitchDrawing) {
      stitchDrawing = false;
      if (stitchBefore) {
        Chart.pushUndo("stitch", stitchBefore);
        stitchBefore = null;
      }
    }
    cancelShape();
  }

  function doPinch() {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mx = (pts[0].x + pts[1].x) / 2;
    const my = (pts[0].y + pts[1].y) / 2;
    const k = dist / (pinchStart.dist || 1);
    const newCellH = Math.max(3, Math.min(64, pinchStart.cellH * k));
    const scale = newCellH / pinchStart.cellH;
    const rect = cv.getBoundingClientRect();
    const bx = pinchStart.mx - rect.left;
    const by = pinchStart.my - rect.top;
    view.cellH = newCellH;
    view.panX = (mx - rect.left) - ((bx - pinchStart.panX) / pinchStart.cellH) * newCellH;
    view.panY = (my - rect.top) - ((by - pinchStart.panY) / pinchStart.cellH) * newCellH;
    emitZoom();
    schedule();
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const h1 = view.cellH;
    const h2 = Math.max(3, Math.min(64, h1 * Math.exp(-e.deltaY * 0.0016)));
    if (h2 === h1) return;
    const bx = (mx - view.panX) / h1;
    const by = (my - view.panY) / h1;
    view.cellH = h2;
    view.panX = mx - bx * h2;
    view.panY = my - by * h2;
    emitZoom();
    schedule();
  }

  function setZoomFactor(f) {
    const h2 = Math.max(3, Math.min(64, view.cellH * f));
    const cx = cssW / 2, cy = cssH / 2;
    const bx = (cx - view.panX) / view.cellH;
    const by = (cy - view.panY) / view.cellH;
    view.cellH = h2;
    view.panX = cx - bx * h2;
    view.panY = cy - by * h2;
    emitZoom();
    schedule();
  }

  function emitZoom() {
    document.getElementById("zoomLabel").textContent = Math.round(view.cellH / 26 * 100) + "%";
  }

  function updateStatus(cell) {
    const el = document.getElementById("statCursor");
    if (!el) return;
    if (cell) {
      const ch = Chart.state;
      const i = Chart.idx(cell.c, cell.r);
      const v = ch.cells[i];
      const p = ch.palette[v];
      let s = "格 " + (cell.c + 1) + " × " + (cell.r + 1) + " · " + (p ? p.name : "—");
      const sv = ch.stitches[i];
      if (sv) s += " · " + Stitch.nameOf(sv);
      el.textContent = s;
    } else {
      el.textContent = "—";
    }
  }

  function setTool(t) {
    tool = t;
    document.querySelectorAll("#toolList .tool").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-tool") === t);
    });
    const cursors = { picker: "copy", fill: "cell", select: "default", wand: "cell", cross: "cell" };
    cv.style.cursor = cursors[t] || "crosshair";
    const row = document.getElementById("shapeModeRow");
    if (row) row.hidden = !(t === "line" || t === "rect" || t === "ellipse");
    const crow = document.getElementById("crossModeRow");
    if (crow) crow.hidden = t !== "cross";
    const chint = document.getElementById("crossHint");
    if (chint) chint.hidden = t !== "cross";
  }

  function setCrossType(t) {
    if (t !== "c3f2" && t !== "c2f3") return;
    crossType = t;
    document.querySelectorAll("#crossSeg button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-cross") === t);
    });
    schedule();
  }

  function getCrossType() { return crossType; }

  function getTool() { return tool; }

  function setSym(s) {
    sym = s;
    document.querySelectorAll("#symSeg button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-sym") === s);
    });
  }

  function getSym() { return sym; }

  function setSymScope(v) {
    symScope = v;
    const b = document.getElementById("btnSymScope");
    if (b) b.classList.toggle("on", v === "sel");
  }

  function getSymScope() { return symScope; }

  function setBrushSize(n) {
    brushSize = Math.max(1, Math.min(3, n | 0));
    document.querySelectorAll("#brushSeg button").forEach((b) => {
      b.classList.toggle("on", +b.getAttribute("data-brush") === brushSize);
    });
    schedule();
  }

  function getBrushSize() { return brushSize; }

  function setShapeMode(m) {
    shapeMode = m;
    document.querySelectorAll("#shapeSeg button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-shapemode") === m);
    });
  }

  function getShapeMode() { return shapeMode; }

  function setViewMode(m) {
    if (m !== "color" && m !== "symbol" && m !== "both" && m !== "fabric") return;
    viewMode = m;
    document.querySelectorAll("#viewSeg button").forEach((b) => {
      b.classList.toggle("on", b.getAttribute("data-viewmode") === m);
    });
    schedule();
  }

  function getViewMode() { return viewMode; }

  function setCellNums(on) { showCellNums = !!on; }
  function getCellNums() { return showCellNums; }

  function setRepeatGhost(on) { ghostRepeat = !!on; schedule(); }
  function getRepeatGhost() { return ghostRepeat; }

  function fillSelColor(v) {
    if (!sel) return false;
    const ch = Chart.state;
    if (v < 0 || v >= ch.palette.length) return false;
    const before = Chart.snapshot();
    let changed = false;
    for (let r = sel.r0; r <= sel.r1; r++) {
      for (let c = sel.c0; c <= sel.c1; c++) {
        if (Chart.setCell(c, r, v)) changed = true;
      }
    }
    if (changed) {
      Chart.pushUndo("sel-color", before);
      Chart.emit("change", { type: "cells" });
    }
    return changed;
  }

  function setMode(m) {
    if (m !== "jacquard" && m !== "stitch" && m !== "knit") return;
    mode = m;
    if (stampRec) setStamp(null);
    if (shape) { shape = null; Chart.abortStroke(); }
    drawing = false;
    stitchDrawing = false;
    schedule();
  }

  function getMode() { return mode; }

  function setCurStitch(n) {
    curStitch = Math.max(0, Math.min(Stitch.SYMS.length - 1, n | 0));
  }

  function getCurStitch() { return curStitch; }

  function setSpace(v) { spaceDown = v; if (v) cv.style.cursor = "grab"; else setTool(tool); }

  function goto(c, r) {
    view.panX = cssW / 2 - (c + 0.5) * cellW();
    view.panY = cssH / 2 - (r + 0.5) * view.cellH;
    hover = { c, r };
    schedule();
  }

  function reload() { shape = null; drawing = false; marquee = null; stampHover = null; clearSel(); resize(); fit(); }

  return {
    init, schedule, fit, reload, setTool, getTool, setSym, getSym, setSpace, goto,
    setSymScope, getSymScope, setBrushSize, getBrushSize, setShapeMode, getShapeMode,
    setCrossType, getCrossType,
    setViewMode, getViewMode, setCellNums, getCellNums, fillSelColor, setMode, getMode, setCurStitch, getCurStitch,
    setRepeatGhost, getRepeatGhost,
    cancelShape,
    getSel, setSel, clearSel, deleteSel, copySel, cutSel, pasteSel,
    flipSelH, flipSelV, rotateSel, fillSel,
    setStamp, getStamp, isLocked,
    isDrawing: () => drawing || stitchDrawing,
    get view() { return view; }
  };
})();
