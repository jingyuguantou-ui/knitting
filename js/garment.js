const Garment = (() => {
  let svg = null, cmEl = null, hintEl = null, sideBtn = null;
  let shape = "sweater";
  let side = "front";
  let imgVer = 0, imgVerAt = -1;
  let gTimer = 0, cTimer = 0;

  const SHAPES = {
    sweater: {
      vb: "0 0 64 66",
      d: "M12,3 L26,3 C29,11 35,11 38,3 L52,3 L63,13 L56,29 L52,24 L52,63 L12,63 L12,24 L8,29 L1,13 Z",
      detail: "M12,58 L52,58"
    },
    sleeve: {
      vb: "0 0 64 40",
      d: "M4,4 C28,5 44,10 58,13 L58,27 C44,30 28,35 4,36 Z",
      detail: "M52,12.5 L52,27.5"
    },
    hat: {
      vb: "0 0 48 44",
      d: "M3,42 L3,30 C3,7 45,7 45,30 L45,42 Z",
      detail: "M3,30 L45,30"
    }
  };

  function init() {
    svg = document.getElementById("garmentSvg");
    cmEl = document.getElementById("garmentCm");
    hintEl = document.getElementById("cwHint");
    sideBtn = document.getElementById("btnSide");
    if (!svg) return;
    document.querySelectorAll("#garmentBar .seg button").forEach((b) => {
      b.addEventListener("click", () => setShape(b.dataset.shape));
    });
    if (sideBtn) sideBtn.addEventListener("click", () => setSide(side === "front" ? "back" : "front"));
    Chart.on("change", onChange);
    Chart.on("load", onChange);
    Chart.on("palette", onChange);
    document.addEventListener("langchange", () => { syncSideLabel(); render(); refreshColorway(); });
    render();
    refreshColorway();
  }

  function onChange(arg) {
    if (arg) {
      let busy = false;
      try { busy = Chart.isStroking() || (typeof Editor !== "undefined" && Editor.isDrawing && Editor.isDrawing()); } catch (e) { busy = false; }
      if (busy) return;
    }
    imgVer++;
    scheduleRender();
    scheduleColorway();
  }

  function refresh() {
    imgVer++;
    if (gTimer) clearTimeout(gTimer);
    gTimer = 0;
    render();
    refreshColorway();
  }

  function scheduleRender() {
    if (gTimer) clearTimeout(gTimer);
    gTimer = setTimeout(() => { gTimer = 0; render(); }, 180);
  }

  function scheduleColorway() {
    if (cTimer) clearTimeout(cTimer);
    cTimer = setTimeout(() => { cTimer = 0; refreshColorway(); }, 400);
  }

  function setShape(s) {
    if (!SHAPES[s]) return;
    shape = s;
    document.querySelectorAll("#garmentBar .seg button").forEach((b) => {
      b.classList.toggle("on", b.dataset.shape === s);
    });
    render();
  }

  function setSide(s) {
    side = s;
    syncSideLabel();
    render();
  }

  function syncSideLabel() {
    if (!sideBtn) return;
    const key = side === "front" ? "garment.front" : "garment.back";
    sideBtn.setAttribute("data-i18n", key);
    sideBtn.textContent = I18N.t(key);
    sideBtn.classList.toggle("on", side === "back");
  }

  function buildTiles() {
    const ch = Chart.state;
    const cmW = (10 / ch.gauge.sts) * ch.cols;
    const cmH = (10 / ch.gauge.rows) * ch.rows;
    const cw = cmW / ch.cols;
    const chh = cmH / ch.rows;
    let rects = "";
    for (let r = 0; r < ch.rows; r++) {
      let runIdx = ch.cells[r * ch.cols];
      let runStart = 0;
      for (let c = 1; c <= ch.cols; c++) {
        const cur = c < ch.cols ? ch.cells[r * ch.cols + c] : -1;
        if (cur !== runIdx) {
          const p = ch.palette[runIdx];
          rects += '<rect x="' + (runStart * cw) + '" y="' + (r * chh) +
            '" width="' + ((c - runStart) * cw) + '" height="' + chh +
            '" fill="' + (p && p.hex ? p.hex : "#ccc") + '"/>';
          runIdx = cur;
          runStart = c;
        }
      }
    }
    return { cmW, cmH, rects };
  }

  function render() {
    if (!svg) return;
    const vb = SHAPES[shape];
    const t = buildTiles();
    svg.setAttribute("viewBox", vb.vb);
    const inner = side === "back"
      ? '<g transform="translate(' + t.cmW + ',0) scale(-1,1)">' + t.rects + "</g>"
      : t.rects;
    svg.innerHTML =
      '<defs><pattern id="gpat" patternUnits="userSpaceOnUse" width="' + t.cmW + '" height="' + t.cmH + '">' +
      inner + "</pattern></defs>" +
      '<path d="' + vb.d + '" fill="url(#gpat)" stroke="#2b2f34" stroke-width="0.35"/>' +
      (vb.detail ? '<path d="' + vb.detail + '" fill="none" stroke="#2b2f34" stroke-width="0.25" opacity="0.75"/>' : "");
    imgVerAt = imgVer;
    if (cmEl) {
      const n = vb.vb.split(" ").map(Number);
      cmEl.textContent = n[2] + " × " + n[3] + " cm";
    }
  }

  function drawSwatch(cv, cells, palette, cols, rows, gauge, tiles) {
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = cv.clientWidth || 150;
    const cssH = cv.clientHeight || 78;
    cv.width = Math.max(1, Math.round(cssW * dpr));
    cv.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!cells || !palette || !palette.length || !cols || !rows) return;
    const hT = (tiles && tiles.h) || 1;
    const vT = (tiles && tiles.v) || 1;
    const g = gauge && gauge.sts && gauge.rows ? gauge : { sts: 29, rows: 40 };
    const aspect = g.rows / g.sts;
    const tC = cols * hT, tR = rows * vT;
    let cellH = Math.min((cssH - 8) / tR, (cssW - 8) / (tC * aspect));
    if (!(cellH > 0)) return;
    const cellW = cellH * aspect;
    const x0 = (cssW - cellW * tC) / 2;
    const y0 = (cssH - cellH * tR) / 2;
    const S = rows * vT;
    function cellAt(e, n) {
      const gr = (S - 1 - e) % rows;
      const gc = n % cols;
      const pi = cells[gc + gr * cols];
      return { pi, x: x0 + n * cellW, y: y0 + e * cellH };
    }
    for (let e = 0; e < S; e++) {
      for (let n = 0; n < tC; n++) {
        const c1 = cellAt(e, n);
        if (c1.pi < 0 || !palette[c1.pi]) continue;
        ctx.fillStyle = Texture.shadeColor(palette[c1.pi].hex, -0.32);
        ctx.fillRect(c1.x, c1.y, cellW + 0.5, cellH + 0.5);
      }
    }
    for (let e2 = S - 1; e2 >= 0; e2--) {
      for (let n2 = 0; n2 < tC; n2++) {
        const c2 = cellAt(e2, n2);
        if (c2.pi < 0 || !palette[c2.pi]) continue;
        const tile = Texture.getTile(palette[c2.pi].hex, Texture.af(n2, e2), cellW * dpr, cellH * dpr);
        ctx.drawImage(tile.img, tile.sx, tile.sy, tile.sw, tile.sh,
          c2.x + tile.dx / dpr, c2.y + tile.dy / dpr, tile.dw / dpr, tile.dh / dpr);
      }
    }
  }

  function clearSwatch(cv) {
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = cv.clientWidth || 150;
    const cssH = cv.clientHeight || 78;
    cv.width = Math.max(1, Math.round(cssW * dpr));
    cv.height = Math.max(1, Math.round(cssH * dpr));
    cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
  }

  async function refreshColorway() {
    const ch = Chart.state;
    drawSwatch(document.getElementById("cwCv0"), ch.cells, ch.palette, ch.cols, ch.rows, ch.gauge, ch.tiles);
    let items = [];
    try { items = await KnitDB.list(); } catch (e) { items = []; }
    let curId = null;
    try { curId = localStorage.getItem("knit-last-id"); } catch (e) { /* ignore */ }
    const variants = items.filter((p) => p.id !== curId && /变体|Variant/i.test(p.title || "")).slice(0, 3);
    for (let i = 1; i <= 3; i++) {
      const cv = document.getElementById("cwCv" + i);
      const tag = cv && cv.parentElement ? cv.parentElement.querySelector(".cwTag") : null;
      const v = variants[i - 1];
      let done = false;
      if (v) {
        let rec = null;
        try { rec = await KnitDB.get(v.id); } catch (e) { /* ignore */ }
        if (rec && rec.cells) {
          drawSwatch(cv, rec.cells, rec.palette, rec.cols, rec.rows, rec.gauge, rec.tiles);
          if (tag) {
            tag.removeAttribute("data-i18n");
            tag.textContent = rec.title || v.title || "";
          }
          done = true;
        }
      }
      if (!done) {
        clearSwatch(cv);
        if (tag) {
          tag.setAttribute("data-i18n", "colorway.none");
          tag.textContent = I18N.t("colorway.none");
        }
      }
    }
    if (hintEl) {
      hintEl.textContent = variants.length
        ? I18N.t("colorway.count").replace("{n}", variants.length)
        : I18N.t("colorway.noVar");
    }
  }

  function debug() {
    return { shape, side, imgVer, imgVerAt, cm: cmEl ? cmEl.textContent : "" };
  }

  return { init, refresh, render, refreshColorway, debug };
})();
