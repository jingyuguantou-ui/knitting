/* ============================================================
 * 罐头的针织屋 · 移动端入口 v0.3
 * 核心功能：尺寸 + 纱线 + 图案绘制
 * Fabric 调用电脑端同源 Stitch.paintFabricBase
 * ============================================================ */
(() => {
"use strict";

const state = {
  tab: "project",
  projectId: null,
  view: "both",        // both | fabric | chart
  tool: "pen",
  symmetry: false,
  knitRow: 1,
  knitFlipped: false,
  cw: 0, ch: 0, scale: 1, tx: 0, ty: 0, dpr: 1,
  allYarns: [],        // yarns.json 全部
  _saveTimer: null,
};

const $ = (id) => document.getElementById(id);
const tabProject = $("tab-project");
const tabDesign  = $("tab-design");
const tabKnit    = $("tab-knit");

/* ============================================================
 * 启动 & Tab 切换
 * ============================================================ */
document.querySelectorAll(".mTab").forEach((btn) => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});
function setTab(t) {
  state.tab = t;
  document.querySelectorAll(".mTab").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  [tabProject, tabDesign, tabKnit].forEach((el) => el.classList.remove("active"));
  ({ project: tabProject, design: tabDesign, knit: tabKnit })[t].classList.add("active");
  if (t === "project") renderProjectList();
  if (t === "design")  initDesignTab();
  if (t === "knit")    initKnitView();
}

/* ============================================================
 * 项目列表
 * ============================================================ */
async function renderProjectList() {
  const grid = $("projGrid");
  let list = [];
  try { list = await KnitDB.list(); } catch {}
  if (!list.length) {
    grid.innerHTML = '<div style="grid-column:span 2;color:#999;text-align:center;padding:40px;font-size:13px;">还没有项目，点右上角 ＋ 新建</div>';
    return;
  }
  grid.innerHTML = "";
  for (const p of list) {
    const card = document.createElement("div");
    card.className = "mProjCard";
    card.innerHTML = `
      <div class="mProjThumb"><canvas width="200" height="200"></canvas></div>
      <div class="mProjMeta">
        <h3></h3><p></p>
      </div>`;
    card.querySelector("h3").textContent = p.title || "未命名";
    card.querySelector("p").textContent = `${p.cols} × ${p.rows}`;
    renderThumb(p, card.querySelector("canvas"));
    card.addEventListener("click", () => openProject(p.id));
    grid.appendChild(card);
  }
}
async function renderThumb(p, cv) {
  try {
    const full = await KnitDB.get(p.id);
    if (!full || !full.cells) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const cell = Math.max(2, Math.min(Math.floor(W / full.cols), Math.floor(H / full.rows)));
    const ox = Math.floor((W - full.cols * cell) / 2);
    const oy = Math.floor((H - full.rows * cell) / 2);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < full.rows; r++) {
      for (let c = 0; c < full.cols; c++) {
        const v = full.cells[c + r * full.cols];
        const pal = full.palette[v] || full.palette[0] || { hex: "#ccc" };
        ctx.fillStyle = pal.hex;
        ctx.fillRect(ox + c * cell, oy + r * cell, cell - 1, cell - 1);
      }
    }
  } catch {}
}
async function openProject(id) {
  const p = await KnitDB.get(id);
  if (!p) return;
  Object.assign(Chart.state, {
    id: p.id, title: p.title || "",
    cols: p.cols, rows: p.rows,
    cells: new Uint8Array(p.cells),
    palette: p.palette,
    stitches: new Uint8Array(p.stitches || new Array(p.cols * p.rows).fill(0)),
    gauge: p.gauge || { sts: 29, rows: 21 },
    tiles: p.tiles || { h: 1, v: 1 },
    knitting: p.knitting || "flat",
    repeat: p.repeat || null,
    crosses: p.crosses || [],
    fg: p.fg != null ? p.fg : 0,
    bg: p.bg != null ? p.bg : 0,
  });
  state.projectId = id;
  state.knitRow = 1;
  updateHeader();
  refreshAllPanels();
  setTab("design");
}

$("btnNewProj")?.addEventListener("click", async () => {
  const title = prompt("项目名", "北欧雪花");
  if (!title) return;
  const cols = +(prompt("针数 cols（建议 24~60）", "24") || 24);
  const rows = +(prompt("行数 rows（建议 24~60）", "28") || 28);
  const ch = Chart.state;
  const pal = [
    { hex: "#F8F6FB", name: "Natural", code: "1010", brand: "Cascade", line: "220", symbol: "A" },
    { hex: "#251813", name: "Van Dyke Brown", code: "7822", brand: "Cascade", line: "220", symbol: "B" },
    { hex: "#D4743A", name: "Custom", code: "", brand: "Custom", line: "", symbol: "C" },
  ];
  const p = {
    id: "p-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(), cols, rows,
    cells: new Uint8Array(cols * rows),
    palette: pal, fg: 1, bg: 0,
    stitches: new Uint8Array(cols * rows),
    gauge: { sts: 29, rows: 21 },
    tiles: { h: 1, v: 1 }, knitting: "flat",
    repeat: null, crosses: [],
  };
  p.cells.fill(1);
  await KnitDB.put(p);
  await openProject(p.id);
});

function updateHeader() {
  const ch = Chart.state;
  $("mProjName").textContent = ch.title || "未命名";
  $("mProjSize").textContent = `${ch.cols} × ${ch.rows}`;
  $("mKnitProjName").textContent = ch.title || "未命名";
}

/* ============================================================
 * 自动保存 debounce（改了就存）
 * ============================================================ */
function saveDebounced() {
  clearTimeout(state._saveTimer);
  state._saveTimer = setTimeout(() => {
    if (!state.projectId) return;
    const ch = Chart.state;
    KnitDB.put({
      id: ch.id, title: ch.title, cols: ch.cols, rows: ch.rows,
      cells: Array.from(ch.cells), palette: ch.palette,
      fg: ch.fg, bg: ch.bg,
      stitches: Array.from(ch.stitches),
      gauge: ch.gauge, tiles: ch.tiles, knitting: ch.knitting,
      repeat: ch.repeat, crosses: ch.crosses,
    }).catch(() => {});
  }, 800);
}

/* ============================================================
 * 下方面板 Tab 切换
 * ============================================================ */
document.querySelectorAll(".mPanelTab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const p = btn.dataset.panel;
    document.querySelectorAll(".mPanelTab").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".mPanel").forEach((el) => el.classList.toggle("active", el.id === "panel-" + p));
    if (p === "grid") refreshGridPanel();
    if (p === "yarns") refreshYarnPanel();
    if (p === "palette") refreshPalettePanel();
  });
});

/* ============================================================
 * 纱线面板（当前 palette 列出 + ＋按钮打开 yarns.json 选择器）
 * ============================================================ */
function refreshYarnPanel() {
  const ch = Chart.state;
  $("yarnCount").textContent = ch.palette.length;
  const list = $("mYarnList");
  list.innerHTML = "";
  ch.palette.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "mYarnItem" + (i === ch.fg ? " active" : "");
    item.innerHTML = `
      <div class="mYarnSwatch"></div>
      <div class="mYarnInfo">
        <div class="mYarnName"></div>
        <div class="mYarnMeta"></div>
      </div>
      <button class="mYarnDel" title="删除">×</button>`;
    item.querySelector(".mYarnSwatch").style.background = p.hex;
    item.querySelector(".mYarnName").textContent = p.name || "未命名";
    const brand = p.brand ? `${p.brand}${p.code ? " · " + p.code : ""}` : p.code || "";
    item.querySelector(".mYarnMeta").textContent = brand || p.hex || "";
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("mYarnDel")) {
        if (ch.palette.length <= 1) return;
        ch.palette.splice(i, 1);
        if (ch.fg >= ch.palette.length) ch.fg = 0;
        // 把 cells 里的 i 替换成 0
        for (let k = 0; k < ch.cells.length; k++) {
          if (ch.cells[k] === i) ch.cells[k] = 0;
          else if (ch.cells[k] > i) ch.cells[k]--;
        }
        renderAll(); refreshAllPanels(); saveDebounced();
        return;
      }
      ch.fg = i;
      renderAll(); refreshAllPanels();
    });
    list.appendChild(item);
  });
}

$("btnAddYarn")?.addEventListener("click", openYarnPicker);

/* ---------- 加载 yarns.json + 选择器 Modal ---------- */
async function ensureYarnsLoaded() {
  if (state.allYarns.length) return state.allYarns;
  try {
    const r = await fetch("data/yarns.json?v=" + Date.now());
    const j = await r.json();
    state.allYarns = j.yarns || [];
  } catch (e) {
    state.allYarns = [];
  }
  return state.allYarns;
}

function openYarnPicker() {
  ensureYarnsLoaded().then(() => showYarnPicker());
}
function showYarnPicker(q = "") {
  const all = state.allYarns;
  const modal = document.createElement("div");
  modal.className = "mModal";
  const sheet = document.createElement("div");
  sheet.className = "mModalSheet";
  modal.appendChild(sheet);
  document.body.appendChild(modal);

  sheet.innerHTML = `
    <div class="mModalHead">
      <h3>选择纱线品牌</h3>
      <button class="mIconBtn sm" id="ypClose">×</button>
    </div>
    <div class="mModalBody">
      <input class="mYarnPickerSearch" id="ypSearch" placeholder="搜索品牌 / 色号 / 名称…"/>
      <div class="mYarnPickerList" id="ypList"></div>
    </div>`;

  const list = sheet.querySelector("#ypList");
  const search = sheet.querySelector("#ypSearch");
  const close = () => modal.remove();
  sheet.querySelector("#ypClose").onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

  const renderList = (query) => {
    const q = query.toLowerCase().trim();
    const filtered = q ? all.filter(y =>
      (y.brand || "").toLowerCase().includes(q) ||
      (y.line  || "").toLowerCase().includes(q) ||
      (y.code  || "").toLowerCase().includes(q) ||
      (y.name  || "").toLowerCase().includes(q)
    ) : all;
    list.innerHTML = "";
    if (!filtered.length) { list.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">无匹配纱线</div>'; return; }
    filtered.slice(0, 80).forEach(y => {
      const row = document.createElement("div");
      row.className = "mYarnPickerItem";
      row.innerHTML = `
        <div class="swatch" style="background:${y.hex}"></div>
        <div class="info">
          <div><b>${y.brand}</b> · ${y.line} · <span style="font-family:'JetBrains Mono',monospace;">${y.code}</span></div>
          <div class="brand">${y.name} · ${y.weight || ""}</div>
        </div>`;
      row.addEventListener("click", () => {
        const ch = Chart.state;
        ch.palette.push({
          hex: y.hex, name: y.name || "", code: y.code || "",
          brand: y.brand || "", line: y.line || "",
          symbol: String.fromCharCode(65 + ch.palette.length),
        });
        ch.fg = ch.palette.length - 1;
        renderAll(); refreshAllPanels(); saveDebounced();
        close();
      });
      list.appendChild(row);
    });
  };

  search.addEventListener("input", () => renderList(search.value));
  renderList(q);
  setTimeout(() => search.focus(), 50);
}

/* ============================================================
 * 尺寸面板（Grid + Gauge + Repeat）
 * ============================================================ */
function refreshGridPanel() {
  const ch = Chart.state;
  $("setCols").textContent = ch.cols;
  $("setRows").textContent = ch.rows;
  const rp = ch.repeat || { w: 1, h: 1 };
  $("setRpw").textContent = rp.w;
  $("setRph").textContent = rp.h;
  $("setKnit").value = ch.knitting || "flat";
  $("setGsts").textContent = ch.gauge.sts;
  $("setGrows").textContent = ch.gauge.rows;
}

document.querySelectorAll(".mStepper button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const k = btn.dataset.setting;
    const d = parseInt(btn.dataset.delta, 10);
    const ch = Chart.state;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let changed = false;
    if (k === "cols") {
      const nv = clamp(ch.cols + d, 2, 200);
      if (nv !== ch.cols) { resizeChart(nv, ch.rows); changed = true; }
    } else if (k === "rows") {
      const nv = clamp(ch.rows + d, 2, 200);
      if (nv !== ch.rows) { resizeChart(ch.cols, nv); changed = true; }
    } else if (k === "rpw") {
      const rp = ch.repeat || { w: 1, h: 1 };
      rp.w = clamp(rp.w + d, 1, ch.cols);
      ch.repeat = rp; changed = true;
    } else if (k === "rph") {
      const rp = ch.repeat || { w: 1, h: 1 };
      rp.h = clamp(rp.h + d, 1, ch.rows);
      ch.repeat = rp; changed = true;
    } else if (k === "gsts") {
      ch.gauge.sts = clamp(ch.gauge.sts + d, 5, 80); changed = true;
    } else if (k === "grows") {
      ch.gauge.rows = clamp(ch.gauge.rows + d, 5, 80); changed = true;
    }
    if (changed) {
      refreshGridPanel(); layoutAll(); renderAll(); saveDebounced();
    }
  });
});

$("setKnit")?.addEventListener("change", (e) => {
  Chart.state.knitting = e.target.value;
  saveDebounced();
});

function resizeChart(newCols, newRows) {
  const ch = Chart.state;
  const oldCols = ch.cols, oldRows = ch.rows;
  const oldCells = ch.cells;
  const oldStitches = ch.stitches;
  const nc = newCols, nr = newRows;
  const newCells = new Uint8Array(nc * nr);
  const newStitches = new Uint8Array(nc * nr);
  for (let r = 0; r < Math.min(oldRows, nr); r++) {
    for (let c = 0; c < Math.min(oldCols, nc); c++) {
      newCells[c + r * nc] = oldCells[c + r * oldCols];
      newStitches[c + r * nc] = oldStitches[c + r * oldCols];
    }
  }
  ch.cols = nc; ch.rows = nr;
  ch.cells = newCells; ch.stitches = newStitches;
}

/* ============================================================
 * 调色面板
 * ============================================================ */
function refreshPalettePanel() {
  const ch = Chart.state;
  const grid = $("mPalGrid");
  grid.innerHTML = "";
  ch.palette.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "mPalSwatch" + (i === ch.fg ? " active" : "");
    el.style.background = p.hex;
    el.title = `${p.name || ""} ${p.code || ""} ${p.hex}`;
    el.innerHTML = `<span class="idx">${i}</span>`;
    el.addEventListener("click", () => { ch.fg = i; renderAll(); refreshAllPanels(); });
    grid.appendChild(el);
  });
}
$("btnAddColor")?.addEventListener("click", () => {
  const hex = (prompt("颜色 hex（如 #D4743A）", "#D4743A") || "").trim();
  if (!hex) return;
  const name = (prompt("颜色名（可选）", "新色") || "Custom").trim();
  const ch = Chart.state;
  ch.palette.push({ hex, name, brand: "Custom", line: "", code: "", symbol: String.fromCharCode(65 + ch.palette.length) });
  ch.fg = ch.palette.length - 1;
  renderAll(); refreshAllPanels(); saveDebounced();
});

/* ============================================================
 * 更多面板 · 全部复用电脑端同源导出
 * ============================================================ */
function _safeName() {
  const t = Chart.state.title || "chart";
  return t.replace(/[\\/:*?"<>|]/g, "_");
}
function _download(canvas, name) {
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
}

$("btnSave")?.addEventListener("click", async () => {
  saveDebounced();
  alert("已自动保存到 IndexedDB ✓");
});

// 导出图表（电脑端同款 buildSheetCanvas：A4 布局 + 标题 + fabric + chart + 图例 + 尺寸）
$("btnExport")?.addEventListener("click", () => {
  try {
    const cv = IO.buildSheetCanvas({});
    _download(cv, _safeName() + "-图表.png");
  } catch (e) { alert("导出失败: " + e.message); }
});

// 导出 Fabric 大图（电脑端 Preview.exportPNG 同源）
$("btnExportFabric")?.addEventListener("click", () => {
  try {
    const cv = Preview.exportPNG(1);
    _download(cv, _safeName() + "-fabric.png");
  } catch (e) { alert("导出失败: " + e.message); }
});

// 导出工程 JSON（电脑端 IO.exportProject 同源）
$("btnExportProj")?.addEventListener("click", () => {
  try {
    IO.exportProject();
  } catch (e) { alert("导出失败: " + e.message); }
});

// 打印：临时 buildSheetCanvas + window.print
$("btnPrint")?.addEventListener("click", () => {
  try {
    const cv = IO.buildSheetCanvas({});
    cv.style.maxWidth = "100%";
    cv.style.height = "auto";
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;inset:0;background:#fff;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;";
    div.appendChild(cv);
    document.body.appendChild(div);
    setTimeout(() => { window.print(); document.body.removeChild(div); }, 100);
  } catch (e) { alert("打印失败: " + e.message); }
});

/* ============================================================
 * 设计 Tab 初始化
 * ============================================================ */
function refreshAllPanels() {
  refreshYarnPanel();
  refreshGridPanel();
  refreshPalettePanel();
}

function initDesignTab() {
  if (state._designInited) { layoutAll(); renderAll(); return; }
  state._designInited = true;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);

  // 视图切换
  document.querySelectorAll(".mViewToggle").forEach((b) => {
    b.addEventListener("click", () => {
      state.view = b.dataset.mode;
      document.querySelectorAll(".mViewToggle").forEach((x) => x.classList.toggle("active", x === b));
      applyViewLayout();
      layoutAll(); renderAll();
    });
  });
  document.querySelector('.mViewToggle[data-mode="both"]')?.classList.add("active");

  // 工具栏（SVG 图标按钮）
  document.querySelectorAll(".mTool").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tool;
      if (t === "undo") { if (Chart.undo) Chart.undo(); renderAll(); saveDebounced(); return; }
      if (t === "redo") { if (Chart.redo) Chart.redo(); renderAll(); saveDebounced(); return; }
      if (t === "mirror") {
        state.symmetry = !state.symmetry;
        btn.classList.toggle("active", state.symmetry);
        renderAll();
        return;
      }
      state.tool = t;
      document.querySelectorAll(".mTool").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  $("btnBackToProj")?.addEventListener("click", () => setTab("project"));

  attachChartGestures();
  window.addEventListener("resize", () => { layoutAll(); renderAll(); });

  applyViewLayout();
  layoutAll();
  refreshAllPanels();
  renderAll();
}

function applyViewLayout() {
  const wrap = tabDesign;
  wrap.classList.remove("mode-fabric", "mode-chart");
  if (state.view === "fabric") wrap.classList.add("mode-fabric");
  else if (state.view === "chart") wrap.classList.add("mode-chart");
}

function layoutAll() {
  const dpr = state.dpr;
  const ch = Chart.state;
  // fabric
  const fWrap = $("mFabricWrap");
  if (fWrap && fWrap.offsetParent !== null) {
    const fr = fWrap.getBoundingClientRect();
    const fc = $("mFabricCv");
    fc.width = Math.max(1, Math.floor(fr.width * dpr));
    fc.height = Math.max(1, Math.floor(fr.height * dpr));
    fc.style.width = fr.width + "px";
    fc.style.height = fr.height + "px";
  }
  // chart
  const cWrap = $("mChartWrap");
  if (cWrap && cWrap.offsetParent !== null) {
    const cr = cWrap.getBoundingClientRect();
    const cv = $("mCv");
    state.cw = Math.max(1, Math.floor(cr.width * dpr));
    state.ch = Math.max(1, Math.floor(cr.height * dpr));
    cv.width = state.cw;
    cv.height = state.ch;
    cv.style.width = cr.width + "px";
    cv.style.height = cr.height + "px";
    // 默认居中适配
    const availW = state.cw * 0.9;
    const availH = state.ch * 0.9;
    const cellW = availW / ch.cols, cellH = availH / ch.rows;
    state.scale = Math.max(2, Math.min(cellW, cellH));
    state.tx = (state.cw - ch.cols * state.scale) / 2;
    state.ty = (state.ch - ch.rows * state.scale) / 2;
  }
}

function renderAll() {
  renderFabric();
  renderChart();
}

/* ---------- Fabric（和电脑端完全同源） ---------- */
function renderFabric() {
  const fc = $("mFabricCv");
  if (!fc || fc.width < 4) return;
  const ch = Chart.state;
  const ctx = fc.getContext("2d");
  const dpr = state.dpr;

  ctx.fillStyle = "#EDE8F3";
  ctx.fillRect(0, 0, fc.width, fc.height);

  const availW = fc.width * 0.92;
  const availH = fc.height * 0.92;
  const ratio = Math.max(0.4, ch.gauge.rows / ch.gauge.sts);
  const cell = Math.max(2, Math.min(availW / ch.cols, availH / ch.rows / ratio));
  const rowH = Math.max(2, Math.round(cell * ratio));
  const gw = cell * ch.cols;
  const gh = rowH * ch.rows;
  const x0 = (fc.width - gw) / 2;
  const y0 = (fc.height - gh) / 2;

  Stitch.paintFabricBase(ctx, ch, x0, y0, cell, rowH, dpr);
}

/* ---------- Chart ---------- */
function renderChart() {
  const cv = $("mCv");
  if (!cv || cv.width < 4) return;
  const ch = Chart.state;
  const ctx = cv.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);

  ctx.fillStyle = "#EDE8F3";
  ctx.fillRect(0, 0, cv.width, cv.height);

  const cell = state.scale;
  const tx = state.tx, ty = state.ty;

  for (let r = 0; r < ch.rows; r++) {
    for (let c = 0; c < ch.cols; c++) {
      const v = ch.cells[c + r * ch.cols];
      const pal = ch.palette[v] || { hex: "#ccc" };
      ctx.fillStyle = pal.hex;
      ctx.fillRect(tx + c * cell, ty + r * cell, Math.max(1, cell - 1), Math.max(1, cell - 1));
    }
  }

  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let c = 0; c <= ch.cols; c++) {
    const x = tx + c * cell;
    ctx.moveTo(x, ty); ctx.lineTo(x, ty + ch.rows * cell);
  }
  for (let r = 0; r <= ch.rows; r++) {
    const y = ty + r * cell;
    ctx.moveTo(tx, y); ctx.lineTo(tx + ch.cols * cell, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= ch.cols; c += 10) {
    const x = tx + c * cell;
    ctx.moveTo(x, ty); ctx.lineTo(x, ty + ch.rows * cell);
  }
  for (let r = 0; r <= ch.rows; r += 10) {
    const y = ty + r * cell;
    ctx.moveTo(tx, y); ctx.lineTo(tx + ch.cols * cell, y);
  }
  ctx.stroke();

  if (state.symmetry) {
    const ax = tx + Math.floor(ch.cols / 2) * cell + cell / 2;
    ctx.strokeStyle = "rgba(212,116,58,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(ax, ty); ctx.lineTo(ax, ty + ch.rows * cell);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* ============================================================
 * 手势（只在 chart canvas）
 * 统一 Pointer Events · 修正坐标 · 单指画 / 双指平移+捏合
 * ============================================================ */
function attachChartGestures() {
  const cv = $("mCv");
  const wrap = $("mChartWrap");
  let pointers = new Map();
  let pinchStart = null;
  let panning = false, lastPanPos = null;
  let drawMode = false, lastCell = null;

  // 统一坐标函数：clientX/Y → canvas 像素坐标
  const clientToCanvas = (clientX, clientY) => {
    const rect = cv.getBoundingClientRect();
    const dpr = state.dpr;
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr,
    };
  };
  const cellFromPoint = (clientX, clientY) => {
    const ch = Chart.state;
    const p = clientToCanvas(clientX, clientY);
    const c = Math.floor((p.x - state.tx) / state.scale);
    const r = Math.floor((p.y - state.ty) / state.scale);
    if (c < 0 || c >= ch.cols || r < 0 || r >= ch.rows) return null;
    return { c, r };
  };

  const applyCell = (cell) => {
    const ch = Chart.state;
    if (state.tool === "pen") {
      Chart.setCell(cell.c, cell.r, ch.fg);
      if (state.symmetry) Chart.setCell(ch.cols - 1 - cell.c, cell.r, ch.fg);
    } else if (state.tool === "eraser") {
      Chart.setCell(cell.c, cell.r, ch.bg);
      if (state.symmetry) Chart.setCell(ch.cols - 1 - cell.c, cell.r, ch.bg);
    } else if (state.tool === "fill") {
      floodFill(cell.c, cell.r, ch.fg);
    }
    lastCell = cell;
  };

  const floodFill = (c0, r0, target) => {
    const ch = Chart.state;
    const src = ch.cells[c0 + r0 * ch.cols];
    if (src === target) return;
    const stack = [[c0, r0]];
    while (stack.length) {
      const [c, r] = stack.pop();
      if (c < 0 || c >= ch.cols || r < 0 || r >= ch.rows) continue;
      const i = c + r * ch.cols;
      if (ch.cells[i] !== src) continue;
      Chart.setCell(c, r, target);
      stack.push([c+1, r], [c-1, r], [c, r+1], [c, r-1]);
    }
    renderAll(); saveDebounced();
  };

  wrap.addEventListener("pointerdown", (e) => {
    wrap.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      // 第二根手指 → 立即进入 pan + pinch 模式
      drawMode = false; panning = false; lastCell = null;
      const pts = [...pointers.values()];
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      // 捏合锚点：canvas 像素中心
      const p = clientToCanvas(midX, midY);
      pinchStart = {
        dist: Math.hypot(dx, dy),
        scale: state.scale,
        ax: p.x, ay: p.y,   // canvas 像素坐标的锚点
        tx: state.tx, ty: state.ty,
      };
      lastPanPos = { x: midX, y: midY };
      return;
    }

    // 单指
    if (state.tool === "pen" || state.tool === "eraser") {
      // 画笔/橡皮：立即进入 drawMode，立即画第一格
      drawMode = true;
      lastCell = null;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) { applyCell(cell); renderChart(); }
      e.preventDefault();
    } else if (state.tool === "fill") {
      // 填充：等 pointerup 时触发
      drawMode = false;
    } else {
      drawMode = false;
    }
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchStart) {
      // 双指：平移 + 捏合
      const pts = [...pointers.values()];
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchStart.dist;
      const newScale = Math.max(2, Math.min(60, pinchStart.scale * ratio));
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const cur = clientToCanvas(midX, midY);
      // 捏合缩放（以锚点为中心）
      state.tx = pinchStart.ax - (pinchStart.ax - pinchStart.tx) * (newScale / pinchStart.scale);
      state.ty = pinchStart.ay - (pinchStart.ay - pinchStart.ty) * (newScale / pinchStart.scale);
      state.scale = newScale;
      // 额外平移（相对上一次中心移动）
      if (lastPanPos) {
        const p0 = clientToCanvas(lastPanPos.x, lastPanPos.y);
        state.tx += cur.x - p0.x;
        state.ty += cur.y - p0.y;
      }
      lastPanPos = { x: midX, y: midY };
      renderChart();
      e.preventDefault();
      return;
    }

    // 单指绘制
    if (pointers.size === 1 && drawMode) {
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell && (!lastCell || cell.c !== lastCell.c || cell.r !== lastCell.r)) {
        applyCell(cell); renderChart();
      }
    }
  });

  const finish = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      // 填充工具：抬起时触发一次 floodFill
      if (state.tool === "fill" && !drawMode) {
        const cell = cellFromPoint(e.clientX, e.clientY);
        if (cell) { applyCell(cell); renderAll(); saveDebounced(); }
      } else if (drawMode) {
        renderAll(); saveDebounced();
      }
      drawMode = false; lastCell = null; panning = false; lastPanPos = null;
    }
  };
  wrap.addEventListener("pointerup", finish);
  wrap.addEventListener("pointercancel", finish);
}

/* ============================================================
 * 照着织
 * ============================================================ */
function initKnitView() {
  if (!state.projectId) { alert("请先打开项目"); setTab("project"); return; }
  renderKnitRow();
  renderKnitMini();
  $("btnPrevRow").onclick = () => {
    if (state.knitRow > 1) { state.knitRow--; renderKnitRow(); renderKnitMini(); }
  };
  $("btnNextRow").onclick = () => {
    const ch = Chart.state;
    if (state.knitRow < ch.rows) { state.knitRow++; renderKnitRow(); renderKnitMini(); }
    else if (confirm("已到最后一行")) state.knitRow = 1;
  };
  $("btnKnitFlip").onclick = () => { state.knitFlipped = !state.knitFlipped; renderKnitRow(); };
  renderProgress();
}

function renderKnitRow() {
  const ch = Chart.state;
  const row = Math.max(1, Math.min(ch.rows, state.knitRow));
  $("mKnitRow").textContent = `Row ${row} / ${ch.rows}`;
  const isRS = ch.knitting === "round" ? (row % 2 === 1) : true;
  $("mKnitRowHead").textContent = `Row ${row} · ${isRS ? "正行 RS" : "反行 WS"}`;

  const cv = $("mKnitRowCv");
  const wrap = cv.parentElement;
  const rect = wrap.getBoundingClientRect();
  const dpr = state.dpr;
  cv.width = Math.max(1, Math.floor(rect.width * dpr));
  cv.height = Math.max(1, Math.floor(rect.height * dpr));
  cv.style.width = rect.width + "px";
  cv.style.height = rect.height + "px";
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);

  const colors = ch.cols;
  const cell = Math.max(14, Math.floor(Math.min(cv.width / colors, cv.height * 0.7)));
  const padTop = (cv.height - cell) / 2;
  const reverse = (ch.knitting === "round" && row % 2 === 0) !== state.knitFlipped;
  for (let i = 0; i < colors; i++) {
    const c = reverse ? colors - 1 - i : i;
    const v = ch.cells[c + (row - 1) * ch.cols];
    const pal = ch.palette[v] || { hex: "#ccc" };
    ctx.fillStyle = pal.hex;
    ctx.fillRect(i * cell + 1, padTop + 1, cell - 2, cell - 2);
  }

  ctx.fillStyle = "rgba(120,120,120,0.6)";
  ctx.font = `${Math.max(9, Math.floor(cell * 0.45))}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  for (let i = 0; i < colors; i += 5) {
    ctx.fillText(String(i + 1), i * cell + cell / 2, cv.height - 4);
  }
  renderProgress();
}

function renderProgress() {
  const ch = Chart.state;
  const pct = Math.round((state.knitRow - 1) / ch.rows * 100);
  $("mProgFill").style.width = pct + "%";
  $("mProgTxt").textContent = `${state.knitRow - 1} / ${ch.rows} 行 · ${pct}%`;
}

function renderKnitMini() {
  const ch = Chart.state;
  const cv = $("mKnitMiniCv");
  const wrap = cv.parentElement;
  const rect = wrap.getBoundingClientRect();
  const cellW = Math.max(2, Math.min(Math.floor(rect.width / ch.cols), 14));
  const cellH = Math.max(2, Math.min(cellW * (ch.gauge.rows / ch.gauge.sts), 10));
  cv.width = ch.cols * cellW; cv.height = ch.rows * cellH;
  cv.style.width = cv.width + "px"; cv.style.height = cv.height + "px";
  const ctx = cv.getContext("2d");
  for (let r = 0; r < ch.rows; r++) {
    for (let c = 0; c < ch.cols; c++) {
      const v = ch.cells[c + r * ch.cols];
      ctx.fillStyle = (ch.palette[v] || { hex: "#ccc" }).hex;
      ctx.fillRect(c * cellW, r * cellH, Math.max(1, cellW - 1), Math.max(1, cellH - 1));
    }
  }
  ctx.strokeStyle = "#D4743A"; ctx.lineWidth = 2;
  ctx.strokeRect(0.5, (state.knitRow - 1) * cellH + 0.5, cv.width - 1, cellH - 1);
}

/* ============================================================
 * 启动
 * ============================================================ */
(async function boot() {
  try { await KnitDB.open(); } catch {}
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderProjectList();
  setTab("project");
})();

})();
