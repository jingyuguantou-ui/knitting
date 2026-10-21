const Preview = (() => {
  let cv, ctx, pane;
  let dpr = 1;
  let cssW = 0, cssH = 0;
  let rafPending = false;

  const view = { zoom: 1, panX: 0, panY: 0 };
  let base = null;
  let spaceDown = false;
  const pointers = new Map();
  let pinchStart = null;

  function init() {
    pane = document.getElementById("previewScroll");
    cv = document.getElementById("previewCv");
    ctx = cv.getContext("2d");

    window.addEventListener("resize", schedule);
    pane.addEventListener("wheel", onWheel, { passive: false });
    pane.addEventListener("dblclick", resetView);
    pane.addEventListener("pointerdown", onPointerDown);
    pane.addEventListener("pointermove", onPointerMove);
    pane.addEventListener("pointerup", onPointerUp);
    pane.addEventListener("pointercancel", onPointerUp);
    Chart.on("change", onChartChange);
    Chart.on("load", () => { resetView(); schedule(); });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !isTyping(e)) { spaceDown = true; e.preventDefault(); }
    });
    document.addEventListener("keyup", (e) => {
      if (e.code === "Space") spaceDown = false;
    });
  }

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  function inStroke() {
    try {
      return !!(Chart.isStroking() || (typeof Editor !== "undefined" && Editor.isDrawing && Editor.isDrawing()));
    } catch (e) {
      return false;
    }
  }

  function onChartChange() {
    if (inStroke()) return;
    schedule();
  }

  function resetView() {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
    schedule();
  }

  function fitBase() {
    const ch = Chart.state;
    const aspect = ch.gauge.rows / ch.gauge.sts;
    const totalCols = ch.cols * ch.tiles.h;
    const totalRows = ch.rows * ch.tiles.v;
    const w = Math.max(40, cssW - 28);
    const h = Math.max(40, cssH - 28);
    const cellH = Math.min(h / totalRows, w / (totalCols * aspect));
    const cellW = cellH * aspect;
    const gw = cellW * totalCols;
    const gh = cellH * totalRows;
    return {
      cellW, cellH,
      x0: (cssW - gw) / 2,
      y0: (cssH - gh) / 2,
      gw, gh,
      hTiles: ch.tiles.h, vTiles: ch.tiles.v
    };
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = pane.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const z1 = view.zoom;
    const z2 = Math.max(0.15, Math.min(8, z1 * Math.exp(-e.deltaY * 0.0016)));
    if (z2 === z1) return;
    view.panX = mx - ((mx - view.panX) / z1) * z2;
    view.panY = my - ((my - view.panY) / z1) * z2;
    view.zoom = z2;
    schedule();
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 1 && !(spaceDown)) return;
    if (e.pointerType !== "mouse" && e.button && e.button !== 0) return;
    pane.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const rect = pane.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchStart = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom: view.zoom,
        baseMidX: ((midX - rect.left) - view.panX) / view.zoom,
        baseMidY: ((midY - rect.top) - view.panY) / view.zoom
      };
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && pinchStart === null) {
      view.panX += e.clientX - prev.x;
      view.panY += e.clientY - prev.y;
      schedule();
    } else if (pointers.size === 2 && pinchStart) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const rect = pane.getBoundingClientRect();
      const z2 = Math.max(0.15, Math.min(8, pinchStart.zoom * (dist / (pinchStart.dist || 1))));
      view.zoom = z2;
      view.panX = (midX - rect.left) - pinchStart.baseMidX * z2;
      view.panY = (midY - rect.top) - pinchStart.baseMidY * z2;
      schedule();
    }
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
  }

  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      draw();
    });
  }

  function draw() {
    const ch = Chart.state;
    const viewW = pane.clientWidth;
    const viewH = pane.clientHeight;
    if (viewW < 4 || viewH < 4) return;
    cssW = viewW;
    cssH = viewH;
    base = fitBase();

    dpr = Math.min(2, Math.sqrt(4e6 / Math.max(1, cssW * cssH)) || 1);
    dpr = Math.min(window.devicePixelRatio || 1, 2, dpr);
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width = Math.max(1, Math.round(cssW * dpr));
    cv.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const z = view.zoom;
    const L = {
      cellW: base.cellW * z,
      cellH: base.cellH * z,
      x0: base.x0 * z + view.panX,
      y0: base.y0 * z + view.panY,
      hTiles: base.hTiles,
      vTiles: base.vTiles
    };
    L.gw = L.cellW * ch.cols * L.hTiles;
    L.gh = L.cellH * ch.rows * L.vTiles;

    if (L.gh > 0 && L.gw > 0) {
      ctx.save();
      ctx.shadowColor = "#1d212636";
      ctx.shadowBlur = Math.max(8, Math.min(28, L.gh * 0.09));
      ctx.shadowOffsetY = Math.max(2, Math.min(10, L.gh * 0.03));
      ctx.fillStyle = "#fcf8f0";
      if (typeof ctx.roundRect === "function") {
        ctx.beginPath();
        ctx.roundRect(L.x0, L.y0, L.gw, L.gh, Math.min(10, L.gw / 2, L.gh / 2));
        ctx.fill();
      } else {
        ctx.fillRect(L.x0, L.y0, L.gw, L.gh);
      }
      ctx.restore();
    }

    const cols = ch.cols, rows = ch.rows;
    Stitch.paintFabric(ctx, ch, {
      x0: L.x0, y0: L.y0, cw: L.cellW, chh: L.cellH,
      dpr: dpr, ht: L.hTiles, vt: L.vTiles, flip: false
    });
    if (L.hTiles > 1 || L.vTiles > 1) {
      ctx.strokeStyle = "#00000022";
      ctx.lineWidth = 1;
      for (let t = 1; t < L.hTiles; t++) {
        const xx = L.x0 + t * cols * L.cellW;
        ctx.beginPath(); ctx.moveTo(xx, L.y0); ctx.lineTo(xx, L.y0 + L.gh); ctx.stroke();
      }
      for (let t2 = 1; t2 < L.vTiles; t2++) {
        const yy = L.y0 + t2 * rows * L.cellH;
        ctx.beginPath(); ctx.moveTo(L.x0, yy); ctx.lineTo(L.x0 + L.gw, yy); ctx.stroke();
      }
    }

    const totalCols = cols * L.hTiles, totalRows = rows * L.vTiles;
    const cmEl = document.getElementById("previewCm");
    if (cmEl) {
      cmEl.textContent = (10 / ch.gauge.sts * totalCols).toFixed(1) + " × " +
        (10 / ch.gauge.rows * totalRows).toFixed(1) + " cm";
    }
    const st = document.getElementById("previewStatus");
    if (st) {
      st.textContent = "针目 " + totalCols + " × " + totalRows +
        " · 单元 " + cols + " × " + rows +
        " · 重复 " + ch.tiles.h + " × " + ch.tiles.v +
        " · 缩放 " + Math.round(z * 100) + "% · 纹理缓存 " + Texture.cacheSize;
    }
    const zl = document.getElementById("pvZoomLabel");
    if (zl) zl.textContent = Math.round(z * 100) + "%";
  }

  function zoomBy(f) {
    const z1 = view.zoom;
    const z2 = Math.max(0.15, Math.min(8, z1 * f));
    const mx = cssW / 2, my = cssH / 2;
    view.panX = mx - ((mx - view.panX) / z1) * z2;
    view.panY = my - ((my - view.panY) / z1) * z2;
    view.zoom = z2;
    schedule();
  }

  function getZoom() {
    return view.zoom;
  }

  function exportPNG(scale, tileH, tileV) {
    scale = scale || 2;
    const ch = Chart.state;
    const hT = tileH || ch.tiles.h;
    const vT = tileV || ch.tiles.v;
    const aspect = ch.gauge.rows / ch.gauge.sts;
    const totalCols = ch.cols * hT;
    const totalRows = ch.rows * vT;
    const maxPx = 4096;
    let cellH = 34 * scale;
    let cellW = cellH * aspect;
    if (cellW * totalCols > maxPx) cellW = maxPx / totalCols, cellH = cellW / aspect;
    if (cellH * totalRows > maxPx) cellH = maxPx / totalRows, cellW = cellH * aspect;
    const out = document.createElement("canvas");
    out.width = Math.ceil(cellW * totalCols);
    out.height = Math.ceil(cellH * totalRows);
    const oc = out.getContext("2d");
    Stitch.paintFabric(oc, ch, {
      x0: 0, y0: 0, cw: cellW, chh: cellH,
      dpr: 1, ht: hT, vt: vT, flip: false
    });
    return out;
  }

  return { init, schedule, draw, resetView, exportPNG, zoomBy, getZoom };
})();
