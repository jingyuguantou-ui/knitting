const IO = (() => {
  let importImage = null;
  let extracted = [];

  function drawCrosses(ctx, ch, ox, oy, cellW, cellH, cols, rows, reg) {
    const crosses = ch && ch.crosses;
    if (!crosses || !crosses.length) return;
    const rc0 = reg ? reg.c0 : 0, rr0 = reg ? reg.r0 : 0;
    for (let i = 0; i < crosses.length; i++) {
      const cr = crosses[i];
      if (!cr) continue;
      const c = cr.c0 - rc0, r = cr.row - rr0;
      if (c < 0 || r < 0) continue;
      const cellsN = cr.left + cr.right;
      if (c + cellsN > cols || r + 1 > rows) continue;
      let color = "#2c2a24";
      if (ch.palette) {
        const p = ch.palette[ch.cells[cr.c0 + cr.row * ch.cols]];
        if (p) {
          const rgb = Texture.hexToRgb(p.hex);
          const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
          if (lum < 0.55) color = "#f5f2ea";
        }
      }
      const pad = Math.max(1, Math.min(cellW, cellH) * 0.06);
      Stitch.crossSymbol(ctx, ox + c * cellW + pad, oy + r * cellH + pad,
        cellW * cellsN - pad * 2, cellH - pad * 2, cr.left, cr.right, cr.dir, color);
    }
  }

  function init() {
    const file = document.getElementById("fileInput");
    file.addEventListener("change", onFile);
    document.getElementById("btnExport").addEventListener("click", exportChartPNG);
    document.getElementById("btnExportSel").addEventListener("click", exportSelection);
    document.getElementById("btnPrint").addEventListener("click", printLayout);
    document.getElementById("btnPrintSheet").addEventListener("click", printSheet);
    document.getElementById("btnImport").addEventListener("click", () => file.click());
    const projFile = document.getElementById("projFile");
    document.getElementById("btnExportProj").addEventListener("click", exportProject);
    document.getElementById("btnImportProj").addEventListener("click", () => projFile.click());
    projFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) importProjectFile(f);
    });
    document.getElementById("btnImportOk").addEventListener("click", applyImport);
    document.getElementById("impCols").addEventListener("change", updateImportPreview);
    document.getElementById("impRows").addEventListener("change", updateImportPreview);
    document.getElementById("impDither").addEventListener("change", updateImportPreview);
    document.getElementById("impFit").addEventListener("change", updateImportPreview);
    document.getElementById("impBg").addEventListener("change", updateImportPreview);
    document.getElementById("btnExtract").addEventListener("click", runExtract);
    document.getElementById("btnAdopt").addEventListener("click", adoptExtract);
    document.getElementById("impBgTol").addEventListener("input", () => {
      document.getElementById("impBgTolVal").textContent = document.getElementById("impBgTol").value;
      updateImportPreview();
    });
  }

  function resetExtract() {
    extracted = [];
    document.getElementById("extractRow").innerHTML = "";
    document.getElementById("btnAdopt").disabled = true;
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      importImage = img;
      const ch = Chart.state;
      document.getElementById("impCols").value = ch.cols;
      document.getElementById("impRows").value = ch.rows;
      resetExtract();
      openModal("importModal");
      updateImportPreview();
    };
    img.src = URL.createObjectURL(f);
  }

  function detectBg() {
    const iw = importImage.naturalWidth, ih = importImage.naturalHeight;
    const tmp = document.createElement("canvas");
    tmp.width = iw;
    tmp.height = ih;
    const tc = tmp.getContext("2d");
    tc.drawImage(importImage, 0, 0);
    const pts = [[0, 0], [iw - 1, 0], [0, ih - 1], [iw - 1, ih - 1]];
    let r = 0, g = 0, b = 0, a = 0;
    for (const [x, y] of pts) {
      const d = tc.getImageData(Math.max(0, Math.min(iw - 1, x)), Math.max(0, Math.min(ih - 1, y)), 1, 1).data;
      r += d[0];
      g += d[1];
      b += d[2];
      a += d[3];
    }
    return { r: r / 4, g: g / 4, b: b / 4, transparent: a / 4 < 128 };
  }

  function samplePixels(cols, rows, fit, bgOn) {
    const tmp = document.createElement("canvas");
    tmp.width = cols;
    tmp.height = rows;
    const tc = tmp.getContext("2d");
    tc.imageSmoothingEnabled = true;
    tc.imageSmoothingQuality = "high";
    if (!bgOn) {
      tc.fillStyle = "#ffffff";
      tc.fillRect(0, 0, cols, rows);
    }
    const iw = importImage.naturalWidth, ih = importImage.naturalHeight;
    if (fit === "stretch") {
      tc.drawImage(importImage, 0, 0, cols, rows);
    } else {
      const s = fit === "contain" ? Math.min(cols / iw, rows / ih) : Math.max(cols / iw, rows / ih);
      const dw = iw * s, dh = ih * s;
      tc.drawImage(importImage, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
    }
    return tc.getImageData(0, 0, cols, rows);
  }

  function nearest(pal, r, g, b) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const rgb = Texture.hexToRgb(pal[i].hex);
      const dr = rgb[0] - r, dg = rgb[1] - g, db = rgb[2] - b;
      const d = dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.7;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }

  function extractColors(img, k) {
    const S = 64;
    const tmp = document.createElement("canvas");
    tmp.width = S;
    tmp.height = S;
    const tc = tmp.getContext("2d");
    tc.drawImage(img, 0, 0, S, S);
    const d = tc.getImageData(0, 0, S, S).data;
    const pts = [];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      pts.push([d[i], d[i + 1], d[i + 2]]);
    }
    if (!pts.length) return [];
    const rnd = mulberry32(0x9e3779b9 ^ k);
    const centers = [pts[Math.floor(rnd() * pts.length)].slice()];
    while (centers.length < k) {
      const dist = pts.map((p) => {
        let best = Infinity;
        for (const c of centers) {
          const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
          if (dd < best) best = dd;
        }
        return best;
      });
      const total = dist.reduce((a, b) => a + b, 0);
      if (total === 0) break;
      let r = rnd() * total, idx = 0;
      for (let i = 0; i < dist.length; i++) {
        r -= dist[i];
        if (r <= 0) { idx = i; break; }
      }
      centers.push(pts[idx].slice());
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let it = 0; it < 12; it++) {
      sums.forEach((s) => { s[0] = 0; s[1] = 0; s[2] = 0; s[3] = 0; });
      for (const p of pts) {
        let bi = 0, bd = Infinity;
        for (let c = 0; c < centers.length; c++) {
          const dd = (p[0] - centers[c][0]) ** 2 + (p[1] - centers[c][1]) ** 2 + (p[2] - centers[c][2]) ** 2;
          if (dd < bd) { bd = dd; bi = c; }
        }
        const s = sums[bi];
        s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      for (let c = 0; c < centers.length; c++) {
        if (sums[c][3]) centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
      }
    }
    const out = centers
      .map((c, i) => ({ hex: rgbToHex(c[0], c[1], c[2]), n: sums[i][3] }))
      .filter((x) => x.n > 0);
    out.sort((a, b) => b.n - a.n);
    const seen = new Set();
    return out.filter((x) => (seen.has(x.hex) ? false : (seen.add(x.hex), true))).map((x) => x.hex);
  }

  function runExtract() {
    if (!importImage) return;
    const k = +document.getElementById("impExtractK").value || 6;
    extracted = extractColors(importImage, k);
    const row = document.getElementById("extractRow");
    row.innerHTML = "";
    extracted.forEach((hex, i) => {
      const lab = document.createElement("label");
      lab.className = "extractSw";
      lab.title = hex;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = true;
      cb.dataset.hex = hex;
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.style.background = hex;
      lab.append(cb, chip, document.createTextNode(hex));
      row.appendChild(lab);
    });
    document.getElementById("btnAdopt").disabled = !extracted.length;
  }

  function adoptExtract() {
    const hexes = Array.from(document.querySelectorAll("#extractRow input:checked")).map((cb) => cb.dataset.hex);
    if (!hexes.length) return;
    document.dispatchEvent(new CustomEvent("palette:adopt", { detail: hexes }));
    updateImportPreview();
  }

  function quantize(cols, rows, dither, fit, bgInfo, tol) {    const ch = Chart.state;
    const pal = ch.palette;
    const img = samplePixels(cols, rows, fit, !!bgInfo);
    const d = img.data;
    const out = new Uint8Array(cols * rows);
    const err = new Float32Array(cols * rows * 3);
    const tol2 = tol * tol;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (x + y * cols);
        const p = i * 4;
        if (bgInfo) {
          const dr = d[p] - bgInfo.r, dg = d[p + 1] - bgInfo.g, db = d[p + 2] - bgInfo.b;
          if (d[p + 3] < 100 || (dr * dr + dg * dg + db * db) <= tol2) {
            out[i] = ch.bg;
            continue;
          }
        }
        let r = d[p] + err[i * 3], g = d[p + 1] + err[i * 3 + 1], b = d[p + 2] + err[i * 3 + 2];
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        const idx = nearest(pal, r, g, b);
        out[i] = idx;
        if (dither) {
          const rgb = Texture.hexToRgb(pal[idx].hex);
          const er = (r - rgb[0]) / 8, eg = (g - rgb[1]) / 8, eb = (b - rgb[2]) / 8;
          const push = (xx, yy, f) => {
            if (xx < 0 || yy < 0 || xx >= cols || yy >= rows) return;
            const j = xx + yy * cols;
            err[j * 3] += er * f;
            err[j * 3 + 1] += eg * f;
            err[j * 3 + 2] += eb * f;
          };
          push(x + 1, y, 7 / 16);
          push(x - 1, y + 1, 3 / 16);
          push(x, y + 1, 5 / 16);
          push(x + 1, y + 1, 1 / 16);
        }
      }
    }
    return out;
  }

  function updateImportPreview() {
    if (!importImage) return;
    const cols = Math.max(4, Math.min(300, +document.getElementById("impCols").value || 56));
    const rows = Math.max(4, Math.min(300, +document.getElementById("impRows").value || 44));
    const dither = document.getElementById("impDither").checked;
    const fit = document.getElementById("impFit").value;
    const bgOn = document.getElementById("impBg").checked;
    const tol = +document.getElementById("impBgTol").value;
    const bgInfo = bgOn ? detectBg() : null;
    const out = quantize(cols, rows, dither, fit, bgInfo, tol);
    const hint = document.getElementById("importHint");
    if (bgInfo) {
      hint.textContent = bgInfo.transparent
        ? "检测到透明背景 → 映射为当前底色"
        : "检测到背景 rgb(" + Math.round(bgInfo.r) + ", " + Math.round(bgInfo.g) + ", " + Math.round(bgInfo.b) + ") → 映射为当前底色";
    } else {
      hint.textContent = "";
    }
    const pal = Chart.state.palette;
    const cv = document.getElementById("importPreview");
    const scale = Math.max(1, Math.min(8, Math.floor(460 / cols)));
    cv.width = cols * scale;
    cv.height = rows * scale;
    const ctx = cv.getContext("2d");
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = pal[out[c + r * cols]].hex;
        ctx.fillRect(c * scale, r * scale, scale, scale);
      }
    }
    cv._last = { cols, rows, out };
  }

  function applyImport() {
    const cv = document.getElementById("importPreview");
    if (!cv._last) return;
    const { cols, rows, out } = cv._last;
    const ch = Chart.state;
    if (cols !== ch.cols || rows !== ch.rows) Chart.resize(cols, rows);
    Chart.beginStroke("import");
    for (let i = 0; i < out.length; i++) ch.cells[i] = out[i];
    Chart.endStroke();
    closeModal();
    Editor.reload();
    Preview.schedule();
  }

  function buildChartCanvas(cell, mode) {
    cell = cell || 14;
    mode = mode || "color";
    const ch = Chart.state;
    const w = cell, h = Math.max(4, Math.round(cell * (ch.gauge.rows / ch.gauge.sts)));
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(ch.cols * w);
    cv.height = Math.ceil(ch.rows * h);
    const ctx = cv.getContext("2d");
    if (mode === "fabric") {
      Stitch.paintFabricBase(ctx, ch, 0, 0, w, h, 1);
      return cv;
    }
    for (let r = 0; r < ch.rows; r++) {
      for (let c = 0; c < ch.cols; c++) {
        if (mode === "symbol") {
          ctx.fillStyle = "#ffffff";
        } else {
          const p = ch.palette[ch.cells[c + r * ch.cols]];
          ctx.fillStyle = p ? p.hex : "#fff";
        }
        ctx.fillRect(c * w, r * h, Math.ceil(w), Math.ceil(h));
      }
    }
    if (mode === "symbol" && typeof Editor !== "undefined" && Editor.getMode && Editor.getMode() !== "stitch") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fs = Math.max(8, Math.min(14, Math.floor(h * 0.6)));
      ctx.font = fs + 'px "Segoe UI", sans-serif';
      ctx.fillStyle = "#2c2a24";
      ctx.strokeStyle = "#2c2a24";
      ctx.lineWidth = Math.max(0.75, fs * 0.1);
      ctx.lineJoin = "round";
      for (let r = 0; r < ch.rows; r++) {
        for (let c = 0; c < ch.cols; c++) {
          const iS = c + r * ch.cols;
          if (ch.stitches[iS]) continue;
          const pS = ch.palette[ch.cells[iS]];
          if (pS && pS.symbol) {
            ctx.fillText(pS.symbol, c * w + w / 2, r * h + h / 2);
            ctx.strokeText(pS.symbol, c * w + w / 2, r * h + h / 2);
          }
        }
      }
    }
    if (mode !== "color") {
      const pad = Math.max(1, Math.min(w, h) * 0.07);
      for (let r = 0; r < ch.rows; r++) {
        for (let c = 0; c < ch.cols; c++) {
          const sc = ch.stitches[c + r * ch.cols];
          if (!sc) continue;
          let color = "#2c2a24";
          if (mode === "both") {
            const p = ch.palette[ch.cells[c + r * ch.cols]];
            if (p) {
              const rgb = Texture.hexToRgb(p.hex);
              const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
              if (lum < 0.55) color = "#f5f2ea";
            }
          }
          Stitch.drawGlyph(ctx, sc, c * w + pad, r * h + pad, w - pad * 2, h - pad * 2, color);
        }
      }
      drawCrosses(ctx, ch, 0, 0, w, h, ch.cols, ch.rows, null);
    }
    for (let x = 0; x <= ch.cols; x++) {
      ctx.strokeStyle = x % 10 === 0 ? "rgba(60,55,45,0.7)" : "rgba(60,55,45,0.28)";
      ctx.beginPath();
      ctx.moveTo(Math.round(x * w) + 0.5, 0);
      ctx.lineTo(Math.round(x * w) + 0.5, cv.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ch.rows; y++) {
      ctx.strokeStyle = y % 10 === 0 ? "rgba(60,55,45,0.7)" : "rgba(60,55,45,0.28)";
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y * h) + 0.5);
      ctx.lineTo(cv.width, Math.round(y * h) + 0.5);
      ctx.stroke();
    }
    return cv;
  }

  function download(canvas, name) {
    canvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  function safeName() {
    const t = Chart.state.title || "chart";
    return t.replace(/[\\/:*?"<>|]/g, "_");
  }

  function tf(key, vars) {
    let s = I18N.t(key);
    if (vars) {
      Object.keys(vars).forEach((k) => {
        s = s.split("{" + k + "}").join(String(vars[k]));
      });
    }
    return s;
  }

  function legendRowsH(ch) {
    return Math.ceil(ch.palette.length / 3);
  }

  function drawSheetLegends(ctx, x0, y0, width) {
    const ch = Chart.state;
    const F = '"Segoe UI", "Microsoft YaHei", sans-serif';
    const legendRows = legendRowsH(ch);
    const codes = Stitch.usedCodes();
    const stCounts = Stitch.usedCounts();
    let y = y0;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 13px " + F;
    ctx.fillStyle = "#333";
    ctx.fillText(I18N.t("export.legend"), x0, y + 13);
    y += 30;
    const cw = Math.floor(width / 3);
    ctx.font = "11px " + F;
    ch.palette.forEach((p, i) => {
      const col = Math.floor(i / legendRows), row = i % legendRows;
      const x = x0 + col * cw, yy = y + row * 18;
      ctx.fillStyle = p.hex;
      ctx.fillRect(x, yy - 10, 13, 13);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, yy - 9.5, 12, 12);
      ctx.fillStyle = "#444";
      ctx.fillText((p.symbol || (i + 1)) + " " + p.name + " " + p.hex +
        (p.spec ? " · " + p.spec : "") + (p.lot ? " · " + p.lot : ""), x + 18, yy);
    });
    y += legendRows * 18 + 6;
    if (codes.length) {
      ctx.font = "bold 13px " + F;
      ctx.fillStyle = "#333";
      ctx.fillText(I18N.t("stitch.legendTitle"), x0, y + 13);
      y += 30;
      ctx.font = "11px " + F;
      const stCols = Math.max(1, Math.floor(width / 190));
      codes.forEach((code, i) => {
        const col = i % stCols, row = Math.floor(i / stCols);
        const x = x0 + col * 190, yy = y + row * 17;
        Stitch.drawGlyph(ctx, code, x, yy - 10, 13, 13, "#2c2a24");
        ctx.fillStyle = "#444";
        ctx.fillText("= " + Stitch.nameOf(code) + "  ×" + stCounts[code], x + 18, yy);
      });
      y += Math.ceil(codes.length / stCols) * 17 + 4;
      ctx.fillStyle = "#777";
      ctx.fillText(I18N.t("stitch.blankNote"), x0, y + 11);
      y += 16;
    }
    return y - y0;
  }

  function sheetLegendH(width) {
    const ch = Chart.state;
    const codes = Stitch.usedCodes();
    let h = 30 + legendRowsH(ch) * 18 + 6;
    if (codes.length) {
      const stCols = Math.max(1, Math.floor(width / 170));
      h += 30 + Math.ceil(codes.length / stCols) * 17 + 4 + 16;
    }
    return h;
  }

  function buildSheetCanvas(opt) {
    opt = opt || {};
    const ch = Chart.state;
    const mode = (typeof Editor !== "undefined" && Editor.getViewMode) ? Editor.getViewMode() : "color";
    const F = '"Inter", "Segoe UI", "Microsoft YaHei", sans-serif';
    const F_SERIF = '"Fraunces", Georgia, "Times New Roman", serif';
    const F_MONO = '"JetBrains Mono", "SF Mono", Consolas, monospace';
    const rp = ch.repeat && ch.repeat.w >= 1 ? ch.repeat : null;

    // A4 300DPI — 自动方向（cols/rows > 0.9 横版，否则竖版），或手动覆盖
    const autoLandscape = (ch.cols / Math.max(1, ch.rows)) > 0.9;
    const landscape = opt.landscape !== undefined ? opt.landscape : autoLandscape;
    const A4_W = landscape ? 3508 : 2480;
    const A4_H = landscape ? 2480 : 3508;

    // ======== 直接在 A4 坐标系里布局（全百分比，边距更紧） ========
    const M = Math.round(A4_W * 0.04);       // 左右边距 4%（之前 6%）
    const GUT = Math.round(A4_W * 0.03);     // 双栏间距 3%（之前 4%）
    const LEFT_W = Math.round(A4_W * 0.22);  // 左栏 22%（之前 25%）
    const rightW = A4_W - 2 * M - LEFT_W - GUT;
    const TITLE_H = Math.round(A4_H * 0.06);  // 标题区 6%（之前 10%）
    const BOX_GAP = Math.round(A4_H * 0.025); // fabric/chart 间距 2.5%（之前 4%）
    const boxH = Math.floor((A4_H - 2 * M - TITLE_H - BOX_GAP) / 2);

    // chart cell — 尽可能大，让 chart 铺满 boxH
    const topNums = Math.max(18, Math.round(A4_H * 0.008));
    const botBand = rp ? Math.max(30, Math.round(A4_H * 0.015)) : 8;
    const chartAvailH = boxH - topNums - botBand;
    // cell 先按宽度算，再按高度反算，取大的那个优先宽度
    const cellByW = Math.floor(rightW / ch.cols);
    const cellByH = Math.floor(chartAvailH / (ch.rows * Math.max(0.4, ch.gauge.rows / ch.gauge.sts)));
    const cell = Math.max(4, Math.min(cellByW, cellByH));  // 同时满足宽高
    const actualRowH = Math.max(4, Math.round(cell * (ch.gauge.rows / ch.gauge.sts)));
    const chart = buildChartCanvas(cell, mode);

    // fabric 图
    let fab = null;
    try { fab = Preview.exportPNG(1); } catch (e) { fab = null; }

    // 坐标
    const contentY0 = M + TITLE_H;  // 紧贴标题底部，无额外间距
    const fabX = M + LEFT_W + GUT;
    const fabY = contentY0;
    const fabW = rightW;
    const fabH = boxH;

    const chartX = fabX;
    const chartTop = fabY + boxH + BOX_GAP;
    const chartH = boxH;

    // metadata
    const mm = Math.round(1000 / Math.max(1, ch.gauge.sts)) / 10;
    const yp = ch.palette.find((p) => p && p.spec) || ch.palette[0];
    const knitsLabel = ch.knitting === "round" ? "Circular" : "Flat";
    const infoBlocks = [
      { label: "GAUGE",   lines: [ ch.gauge.sts + " sts / " + ch.gauge.rows + " rows", "per 10 cm" ] },
      { label: "NEEDLE",  lines: [ "≈ " + mm + " mm" ] },
      { label: "YARN",    lines: yp ? [ yp.name, (yp.spec || "") + (yp.lot ? " · lot " + yp.lot : "") ].filter(Boolean) : [] },
      { label: "KNITTING",lines: [ knitsLabel ] }
    ];

    // ======== 开始画（直接用 A4 尺寸，不用 scale） ========
    const out = document.createElement("canvas");
    out.width = A4_W;
    out.height = A4_H;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, A4_W, A4_H);

    // ---------- 标题区（纯字，无框无分隔线） ----------
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#2D2418";
    ctx.font = "700 56px " + F_SERIF;
    ctx.textAlign = "left";
    ctx.fillText("罐头的针织屋", M, M + 50);

    ctx.textAlign = "right";
    ctx.font = "600 24px " + F;
    ctx.fillStyle = "#6B5D4D";
    ctx.fillText(tf("export.sizeLine", { a: ch.cols, b: ch.rows }), A4_W - M, M + 50);
    ctx.font = "500 34px " + F_SERIF;
    ctx.fillStyle = "#2D2418";
    const proj = ch.title || I18N.t("proj.untitled");
    const projW = ctx.measureText(proj).width;
    const sizeW = ctx.measureText(tf("export.sizeLine", { a: ch.cols, b: ch.rows })).width;
    ctx.fillText(proj, A4_W - M - sizeW - 18 - projW, M + 50);

    // ---------- fabric 大图（右栏上，与 chart 同宽左对齐） ----------
    if (fab && fab.width && fab.height) {
      const padTop = 20;
      const availW = chart.width;
      const availH = fabH - 30;
      const s = Math.min(availW / fab.width, availH / fab.height);
      const dw = fab.width * s, dh = fab.height * s;
      ctx.drawImage(fab, chartX + (availW - dw) / 2, fabY + padTop + (availH - dh) / 2, dw, dh);
    }

    // ---------- 说明信息（左栏上） ----------
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    let y = fabY;
    infoBlocks.forEach((block, bi) => {
      if (bi > 0) { y += 44; }
      ctx.fillStyle = "#A99F90";
      ctx.font = "600 24px " + F_MONO;
      ctx.fillText(block.label, M, y);
      y += 32;
      ctx.fillStyle = "#2D2418";
      ctx.font = "500 32px " + F;
      block.lines.forEach((line) => {
        ctx.fillText(line, M, y);
        y += 42;
      });
    });

    // ---------- chart 网格（右栏下） ----------
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#555";
    ctx.font = "22px " + F_MONO;
    for (let n = 10; n <= ch.cols; n += 10) {
      ctx.fillText(String(n), chartX + (n - 0.5) * cell, chartTop + topNums - 18);
    }
    const y0 = chartTop + topNums;
    ctx.drawImage(chart, chartX, y0);
    const u = ch.underlay;
    if (u && u.visible && u.export && u.img && u.img.complete && u.img.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = u.opacity;
      ctx.drawImage(u.img, chartX, y0, chart.width, chart.height);
      ctx.restore();
    }

    ctx.fillStyle = "#555";
    ctx.textBaseline = "middle";
    const rf = Math.max(14, Math.min(24, 2 * actualRowH - 2));
    ctx.font = rf + "px " + F_MONO;
    for (let n = 1; n <= ch.rows; n++) {
      const right = n % 2 === 1;
      ctx.textAlign = right ? "left" : "right";
      ctx.fillText(String(n), right ? chartX + chart.width + 14 : chartX - 14,
        y0 + (ch.rows - n + 0.5) * actualRowH);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(chartX - 1, y0 - 1, chart.width + 2, chart.height + 2);

    if (rp) {
      const bx = chartX + rp.c * cell, by = y0 + rp.r * actualRowH;
      const bw = rp.w * cell, bh = rp.h * actualRowH;
      ctx.save();
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.setLineDash([]);
      const ly = y0 + chart.height + 28;
      ctx.beginPath();
      ctx.moveTo(bx + 0.5, y0 + chart.height + 8);
      ctx.lineTo(bx + 0.5, ly);
      ctx.moveTo(bx + bw - 0.5, y0 + chart.height + 8);
      ctx.lineTo(bx + bw - 0.5, ly);
      ctx.moveTo(bx + 0.5, ly);
      ctx.lineTo(bx + bw - 0.5, ly);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "22px " + F;
      ctx.fillStyle = "#333";
      ctx.fillText(tf("knit.repeatNote", { w: rp.w, h: rp.h }), bx + bw / 2, ly + 10);
      ctx.restore();
    }

    // ---------- legend（左栏下，跟 chart 左对齐） ----------
    ctx.fillStyle = "#A99F90";
    ctx.font = "600 24px " + F_MONO;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("YARN", M, chartTop);

    const pal = ch.palette || [];
    let ly = chartTop + 44;
    pal.forEach((p) => {
      if (ly > chartTop + chartH - 40) return;
      ctx.fillStyle = p.hex || "#CCCCCC";
      ctx.fillRect(M, ly + 4, 40, 40);
      ctx.fillStyle = "#2D2418";
      ctx.font = "500 28px " + F;
      const label = [p.code, p.name].filter(Boolean).join("  ");
      ctx.fillText(label || ("Color " + (pal.indexOf(p) + 1)), M + 56, ly + 8);
      ly += 52;
    });

    const stCodes = Stitch.usedCodes();
    if (stCodes.length) {
      ly += 16;
      ctx.fillStyle = "#A99F90";
      ctx.font = "600 24px " + F_MONO;
      ctx.fillText("STITCH", M, ly);
      ly += 36;
      ctx.font = "24px " + F;
      ctx.fillStyle = "#444";
      const stCounts = Stitch.usedCounts();
      stCodes.forEach((code) => {
        ctx.fillText(Stitch.nameOf(code) + " ×" + stCounts[code], M, ly);
        ly += 30;
      });
    }

    return out;
  }

  function _orientOpt() {
    const sel = document.getElementById("orientSel");
    const v = sel ? sel.value : "auto";
    if (v === "landscape") return { landscape: true };
    if (v === "portrait") return { landscape: false };
    return {};   // auto — 让 buildSheetCanvas 自己判断
  }

  function exportChartPNG() {
    download(buildSheetCanvas(_orientOpt()), safeName() + "-图表.png");
  }

  function printSheet() {
    const cv = buildSheetCanvas(_orientOpt());
    const area = document.getElementById("printArea");
    area.innerHTML = "";
    const page = document.createElement("div");
    page.className = "printPage";
    cv.className = "sheetImg";
    page.appendChild(cv);
    area.appendChild(page);
    setTimeout(() => window.print(), 80);
  }

  function exportSelection() {
    const s = Editor.getSel();
    if (!s) return;
    const ch = Chart.state;
    const mode = Editor.getViewMode();
    const w = s.c1 - s.c0 + 1, h = s.r1 - s.r0 + 1;
    const cellW = 18;
    const cellH = Math.max(6, Math.round(cellW * ch.gauge.sts / ch.gauge.rows));
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(w * cellW);
    cv.height = Math.ceil(h * cellH);
    const ctx = cv.getContext("2d");
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const p = ch.palette[ch.cells[(s.c0 + c) + (s.r0 + r) * ch.cols]];
        if (mode === "symbol") {
          ctx.fillStyle = "#ffffff";
        } else {
          ctx.fillStyle = p ? p.hex : "#fff";
        }
        ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    if (mode === "symbol" && typeof Editor !== "undefined" && Editor.getMode && Editor.getMode() !== "stitch") {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fs = Math.max(8, Math.min(14, Math.floor(cellH * 0.6)));
      ctx.font = fs + 'px "Segoe UI", sans-serif';
      ctx.fillStyle = "#2c2a24";
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const iS = (s.c0 + c) + (s.r0 + r) * ch.cols;
          if (ch.stitches[iS]) continue;
          const pS = ch.palette[ch.cells[iS]];
          if (pS && pS.symbol) ctx.fillText(pS.symbol, c * cellW + cellW / 2, r * cellH + cellH / 2);
        }
      }
    }
    if (mode !== "color") {
      const pad = Math.max(1, Math.min(cellW, cellH) * 0.07);
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const sc = ch.stitches[(s.c0 + c) + (s.r0 + r) * ch.cols];
          if (!sc) continue;
          let color = "#2c2a24";
          if (mode === "both") {
            const p = ch.palette[ch.cells[(s.c0 + c) + (s.r0 + r) * ch.cols]];
            if (p) {
              const rgb = Texture.hexToRgb(p.hex);
              const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
              if (lum < 0.55) color = "#f5f2ea";
            }
          }
          Stitch.drawGlyph(ctx, sc, c * cellW + pad, r * cellH + pad, cellW - pad * 2, cellH - pad * 2, color);
        }
      }
      drawCrosses(ctx, ch, 0, 0, cellW, cellH, w, h, { c0: s.c0, r0: s.r0 });
    }
    ctx.strokeStyle = "rgba(60,55,45,0.3)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= w; c++) {
      const x = Math.round(c * cellW) + 0.5;
      ctx.beginPath();
      ctx.strokeStyle = (s.c0 + c) % 10 === 0 ? "rgba(60,55,45,0.7)" : "rgba(60,55,45,0.28)";
      ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke();
    }
    for (let r = 0; r <= h; r++) {
      const y = Math.round(r * cellH) + 0.5;
      ctx.beginPath();
      ctx.strokeStyle = (s.r0 + r) % 10 === 0 ? "rgba(60,55,45,0.7)" : "rgba(60,55,45,0.28)";
      ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
    }
    download(cv, safeName() + "-选区.png");
  }

  function makeThumb() {
    const cv = buildChartCanvas(4);
    const out = document.createElement("canvas");
    out.width = 92;
    out.height = 68;
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#f2efe7";
    ctx.fillRect(0, 0, 92, 68);
    const s = Math.min(88 / cv.width, 64 / cv.height);
    const w = cv.width * s, h = cv.height * s;
    ctx.drawImage(cv, (92 - w) / 2, (68 - h) / 2, w, h);
    return out.toDataURL("image/png");
  }

  function drawSlice(c0, r0, cw, rh, px, gutter) {
    const ch = Chart.state;
    const yarnSym = px >= 12 && typeof Editor !== "undefined" && Editor.getMode && Editor.getMode() !== "stitch";
    const cv = document.createElement("canvas");
    cv.className = "printChart";
    cv.width = gutter + cw * px;
    cv.height = gutter + rh * px;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < rh; r++) {
      for (let c = 0; c < cw; c++) {
        const p = ch.palette[ch.cells[(c0 + c) + (r0 + r) * ch.cols]];
        if (p) {
          ctx.fillStyle = p.hex;
          ctx.fillRect(gutter + c * px, gutter + r * px, px, px);
        }
        const sc = ch.stitches[(c0 + c) + (r0 + r) * ch.cols];
        if (sc) {
          let color = "#1f1d18";
          if (p) {
            const rgb = Texture.hexToRgb(p.hex);
            const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
            if (lum < 0.55) color = "#f5f2ea";
          }
          const pad = Math.max(1, px * 0.08);
          Stitch.drawGlyph(ctx, sc, gutter + c * px + pad, gutter + r * px + pad, px - pad * 2, px - pad * 2, color);
        } else if (yarnSym && p && p.symbol) {
          let color = "#1f1d18";
          const rgb = Texture.hexToRgb(p.hex);
          const lum = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) / 255;
          if (lum < 0.55) color = "#f5f2ea";
          const fs = Math.max(8, Math.min(14, Math.floor(px * 0.6)));
          ctx.font = fs + 'px "Segoe UI", sans-serif';
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(p.symbol, gutter + c * px + px / 2, gutter + r * px + px / 2);
        }
      }
    }
    drawCrosses(ctx, ch, gutter, gutter, px, px, cw, rh, { c0: c0, r0: r0 });
    ctx.strokeStyle = "rgba(0,0,0,0.16)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cw; c++) {
      const x = gutter + c * px + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, gutter);
      ctx.lineTo(x, gutter + rh * px);
      ctx.stroke();
    }
    for (let r = 0; r <= rh; r++) {
      const y = gutter + r * px + 0.5;
      ctx.beginPath();
      ctx.moveTo(gutter, y);
      ctx.lineTo(gutter + cw * px, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.lineWidth = 1.5;
    for (let c = 0; c <= cw; c++) {
      if ((c0 + c) % 10 !== 0) continue;
      const x = gutter + c * px + 0.75;
      ctx.beginPath();
      ctx.moveTo(x, gutter);
      ctx.lineTo(x, gutter + rh * px);
      ctx.stroke();
    }
    for (let r = 0; r <= rh; r++) {
      const n = ch.rows - (r0 + r);
      if (n <= 0 || n % 10 !== 0) continue;
      const y = gutter + r * px + 0.75;
      ctx.beginPath();
      ctx.moveTo(gutter, y);
      ctx.lineTo(gutter + cw * px, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gutter, gutter, cw * px, rh * px);

    ctx.fillStyle = "#555";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let c = 0; c <= cw; c++) {
      if ((c0 + c) % 10 !== 0) continue;
      ctx.fillText(String(c0 + c + 1), gutter + c * px, gutter / 2);
    }
    for (let r = 0; r < rh; r++) {
      const n = ch.rows - (r0 + r);
      if (n <= 0 || n % 10 !== 0) continue;
      ctx.fillText(String(n), gutter / 2, gutter + (r + 0.5) * px);
    }
    return cv;
  }

  function printLayout() {
    const ch = Chart.state;
    const area = document.getElementById("printArea");
    area.innerHTML = "";

    const counts = new Array(ch.palette.length).fill(0);
    for (let i = 0; i < ch.cells.length; i++) {
      const v = ch.cells[i];
      if (v < counts.length) counts[v]++;
    }
    const totalCells = ch.cols * ch.rows;
    const cm2PerCell = 100 / (ch.gauge.sts * ch.gauge.rows);
    const sizeW = (10 / ch.gauge.sts * ch.cols * ch.tiles.h).toFixed(1);
    const sizeH = (10 / ch.gauge.rows * ch.rows * ch.tiles.v).toFixed(1);
    let metaText = (ch.title || "") + " · " + ch.cols + "×" + ch.rows + " 针目行 · " +
      sizeW + "×" + sizeH + " cm · " + ch.gauge.sts + "针/" + ch.gauge.rows + "行 每10cm · " +
      I18N.t(ch.knitting === "round" ? "knit.round" : "knit.flat");
    if (ch.repeat) {
      const tH = Math.floor(ch.cols / ch.repeat.w);
      const tV = Math.floor(ch.rows / ch.repeat.h);
      metaText += " · " + I18N.t("knit.repeat") + " " + ch.repeat.w + "×" + ch.repeat.h + " ×" + tH + "×" + tV;
    }
    metaText += " · " + new Date().toLocaleDateString();

    const cover = document.createElement("div");
    cover.className = "printPage";
    const meta = document.createElement("div");
    meta.className = "printMeta";
    meta.textContent = metaText;
    cover.appendChild(meta);

    const fabric = Preview.exportPNG(1);
    fabric.className = "printFabric";
    cover.appendChild(fabric);

    const legend = document.createElement("div");
    legend.className = "printLegend";
    const legendTitle = document.createElement("div");
    legendTitle.className = "legendTitle";
    legendTitle.textContent = I18N.t("export.legend");
    legend.appendChild(legendTitle);
    ch.palette.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "legendRow";
      const sw = document.createElement("canvas");
      sw.width = 26;
      sw.height = 26;
      const sx = sw.getContext("2d");
      sx.fillStyle = p.hex;
      sx.fillRect(0, 0, 26, 26);
      sx.strokeStyle = "rgba(0,0,0,0.35)";
      sx.lineWidth = 1;
      sx.strokeRect(0.5, 0.5, 25, 25);
      const lab = document.createElement("span");
      lab.textContent = "色号 " + (p.symbol || (i + 1)) + " · " + p.name + " " + p.hex +
        (p.spec ? " · " + p.spec : "") + (p.lot ? " · " + p.lot : "") +
        " — " + counts[i] + " 格 (" + Math.round(counts[i] / totalCells * 100) + "%) · 约 " +
        (counts[i] * cm2PerCell).toFixed(1) + " cm²";
      row.append(sw, lab);
      legend.appendChild(row);
    });
    cover.appendChild(legend);
    if (Stitch.anyUsed()) {
      const stLegend = document.createElement("div");
      stLegend.className = "printLegend";
      const stTitle = document.createElement("div");
      stTitle.className = "legendTitle";
      stTitle.textContent = I18N.t("stitch.legendTitle");
      stLegend.appendChild(stTitle);
      const counts = Stitch.usedCounts();
      Stitch.usedCodes().forEach((code) => {
        const row = document.createElement("div");
        row.className = "legendRow";
        row.appendChild(Stitch.glyphCanvas(code, 26, "#2c2a24"));
        const lab = document.createElement("span");
        lab.textContent = Stitch.nameOf(code) + " — " + counts[code] + " 格";
        row.appendChild(lab);
        stLegend.appendChild(row);
      });
      const note = document.createElement("div");
      note.className = "hint";
      note.textContent = I18N.t("stitch.blankNote");
      stLegend.appendChild(note);
      cover.appendChild(stLegend);
    }
    area.appendChild(cover);

    const USABLE_W = 186, USABLE_H = 273, HEAD_H = 16, GUT_MM = 5;
    const sizes = [4, 6, 8, 12];
    let cellMM = 4, cp = 1, rp = 1, pages = Infinity;
    for (const s of sizes) {
      cellMM = s;
      cp = Math.floor((USABLE_W - GUT_MM) / s);
      rp = Math.floor((USABLE_H - HEAD_H - GUT_MM) / s);
      pages = Math.ceil(ch.cols / cp) * Math.ceil(ch.rows / rp);
      if (pages <= 30) break;
    }
    const px = Math.round(cellMM * 96 / 25.4);
    const gutter = Math.round(GUT_MM * 96 / 25.4);
    const nH = Math.ceil(ch.cols / cp);
    const nV = Math.ceil(ch.rows / rp);
    const totalPages = nH * nV;
    let p = 0;
    for (let vr = 0; vr < nV; vr++) {
      for (let hc = 0; hc < nH; hc++) {
        p++;
        const c0 = hc * cp, r0 = vr * rp;
        const cw = Math.min(cp, ch.cols - c0);
        const rh = Math.min(rp, ch.rows - r0);
        const page = document.createElement("div");
        page.className = "printPage";
        const head = document.createElement("div");
        head.className = "printHead";
        const hL = document.createElement("span");
        hL.textContent = ch.title || "";
        const hR = document.createElement("span");
        const rowLo = ch.rows - (r0 + rh) + 1;
        const rowHi = ch.rows - r0;
        hR.textContent = "针 " + (c0 + 1) + "-" + (c0 + cw) + " × 行 " + rowLo + "-" + rowHi +
          " · 页 " + p + "/" + totalPages;
        head.append(hL, hR);
        const el = drawSlice(c0, r0, cw, rh, px, gutter);
        el.style.width = Math.round((gutter + cw * px) * 25.4 / 96) + "mm";
        page.append(head, el);
        area.appendChild(page);
      }
    }
    setTimeout(() => window.print(), 80);
  }

  function openModal(id) {
    document.getElementById("modalBack").hidden = false;
    document.querySelectorAll(".modal").forEach((m) => { m.hidden = m.id !== id; });
  }
  function closeModal() {
    document.getElementById("modalBack").hidden = true;
    document.querySelectorAll(".modal").forEach((m) => { m.hidden = true; });
  }

  function exportProject() {
    const pack = {
      format: "knitcanvas-project",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: Chart.serialize()
    };
    const blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = safeName() + ".knitproj.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function projectData() {
    return {
      format: "knitcanvas-project",
      version: 1,
      exportedAt: new Date().toISOString(),
      project: Chart.serialize()
    };
  }

  async function importProjectFile(file) {
    try {
      const text = await file.text();
      const pack = JSON.parse(text);
      const data = pack && pack.format === "knitcanvas-project" ? pack.project
        : (pack && pack.cols && pack.rows && pack.cells ? pack : null);
      if (!data || !data.cols || !data.rows || !data.cells || data.cells.length !== data.cols * data.rows) {
        throw new Error("invalid");
      }
      const clean = Object.assign({}, data, { id: null, thumb: null });
      document.dispatchEvent(new CustomEvent("project:load", { detail: clean }));
      return true;
    } catch (e) {
      Chart.emit("warn", I18N.t("projects.importFail"));
      return false;
    }
  }

  return { init, makeThumb, openModal, closeModal, buildChartCanvas, buildSheetCanvas, printSheet, exportProject, projectData, importProjectFile };
})();
