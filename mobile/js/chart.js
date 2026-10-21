const Chart = (() => {
  const listeners = {};

  const state = {
    id: null,
    title: "",
    cols: 40,
    rows: 30,
    cells: new Uint8Array(40 * 30),
    palette: [
      { hex: "#f7f4ec", name: "本白", symbol: "A" },
      { hex: "#c8452e", name: "砖红", symbol: "B" },
      { hex: "#e0913c", name: "橘黄", symbol: "C" },
      { hex: "#efd9a8", name: "米杏", symbol: "D" },
      { hex: "#3f5d7c", name: "藏蓝", symbol: "E" },
      { hex: "#7fa3b8", name: "雾蓝", symbol: "F" },
      { hex: "#5c7a46", name: "苔绿", symbol: "G" },
      { hex: "#a8bb6a", name: "嫩绿", symbol: "H" },
      { hex: "#7b4a6e", name: "莓紫", symbol: "I" },
      { hex: "#d9c7b3", name: "燕麦", symbol: "J" },
      { hex: "#403a34", name: "深棕", symbol: "K" },
      { hex: "#b8892b", name: "芥金", symbol: "L" }
    ],
    fg: 1,
    bg: 0,
    gauge: { sts: 29, rows: 21 },
    tiles: { h: 1, v: 1 },
    underlay: null,
    stitches: new Uint8Array(40 * 30),
    crosses: [],
    knitting: "flat",
    repeat: null,
    dirty: false
  };

  let undoStack = [];
  let redoStack = [];
  const UNDO_MAX = 100;
  let pending = null;

  function on(evt, fn) {
    (listeners[evt] || (listeners[evt] = [])).push(fn);
  }
  function emit(evt, arg) {
    (listeners[evt] || []).forEach((fn) => fn(arg));
  }

  function idx(c, r) { return c + r * state.cols; }
  function inBounds(c, r) { return c >= 0 && c < state.cols && r >= 0 && r < state.rows; }
  function getCell(c, r) { return inBounds(c, r) ? state.cells[idx(c, r)] : -1; }
  function getStitch(c, r) { return inBounds(c, r) ? state.stitches[idx(c, r)] : 0; }
  function setStitch(c, r, v) {
    if (!inBounds(c, r)) return false;
    const i = idx(c, r);
    if (state.stitches[i] === v) return false;
    state.stitches[i] = v;
    return true;
  }

  function normRepeat(rp, cols, rows) {
    if (!rp || typeof rp !== "object") return null;
    const c = Math.max(0, Math.min(cols - 1, Math.round(+rp.c || 0)));
    const r = Math.max(0, Math.min(rows - 1, Math.round(+rp.r || 0)));
    const w = Math.max(1, Math.min(cols - c, Math.round(+rp.w || 1)));
    const h = Math.max(1, Math.min(rows - r, Math.round(+rp.h || 1)));
    return { c, r, w, h };
  }

  function mod(a, b) { return ((a % b) + b) % b; }

  // 接缝体检（t7）：给定重复单元，报告两件事——
  //   phase  整幅图案对齐「第一周期」的相位一致率（0..1）。无缝平铺要求它接近 1；
  //   wrap   主图内部单元边界处（横向 c=c0+k*w / 纵向 r=r0+k*h）跨越边界相邻两格的跳色格数。
  // 返回 { c, r, w, h, phase, wrap, diffs:[[c,r]...] }；rp 非法返回 null。
  function seamReport(rp) {
    rp = normRepeat(rp, state.cols, state.rows);
    if (!rp) return null;
    const cols = state.cols, rows = state.rows, cells = state.cells;
    const c0 = rp.c, r0 = rp.r, w = rp.w, h = rp.h;
    let same = 0;
    const diffs = [];
    for (let r = 0; r < rows; r++) {
      const rr = r0 + mod(r - r0, h);
      const b = r * cols, b0 = rr * cols;
      for (let c = 0; c < cols; c++) {
        const v = cells[b + c];
        if (v === cells[b0 + (c0 + mod(c - c0, w))]) same++;
        else if (diffs.length < 300) diffs.push([c, r]);
      }
    }
    const phase = same / (cols * rows);
    // 内部单元边界跳色：横向界 x = c0 + k*w，纵向界 y = r0 + k*h
    let wrap = 0;
    for (let c = c0 + w; c < cols; c += w) {
      for (let r = 0; r < rows; r++) {
        if (cells[(c - 1) + r * cols] !== cells[c + r * cols]) wrap++;
      }
    }
    for (let r = r0 + h; r < rows; r += h) {
      const b2 = r * cols, b1 = (r - 1) * cols;
      for (let c = 0; c < cols; c++) {
        if (cells[b2 + c] !== cells[b1 + c]) wrap++;
      }
    }
    return { c: c0, r: r0, w, h, phase, wrap, diffs };
  }

  // 近似周期识别（t7）：全幅扫描最小可平铺单元。
  // 1) 行向自相关找最小的横向周期 w：cells[c] 与 cells[c-w] 一致的比例过阈值；
  // 2) 列向自相关找最小纵向周期 h；
  // 3) 用对齐第一周期 (0,0) 的组合相位一致率把关，低匹配说明图案并不真能平铺。
  // 返回 { c:0, r:0, w, h, match, points }；识别不出返回 null。
  function detectRepeat() {
    const cols = state.cols, rows = state.rows, cells = state.cells;
    const n = cols * rows;
    if (n < 64) return null;
    const minW = 3, minH = 3;
    const maxW = Math.min(200, cols >> 1);
    const maxH = Math.min(200, rows >> 1);
    if (maxW < minW || maxH < minH) return null;
    // 大图抽样加速周期扫描（周期规律与采样密度无关）
    const rStep = n > 90000 ? 3 : n > 40000 ? 2 : 1;
    const cStep = n > 90000 ? 3 : n > 40000 ? 2 : 1;
    const MIN_AUTO = 0.6;

    let bestW = 0;
    for (let w = minW; w <= maxW && !bestW; w++) {
      let s = 0, t = 0;
      for (let r = 0; r < rows; r += rStep) {
        const b = r * cols;
        for (let c = w; c < cols; c += cStep) {
          t++;
          if (cells[b + c] === cells[b + c - w]) s++;
        }
      }
      if (t && s / t >= MIN_AUTO) bestW = w;
    }
    if (!bestW) return null;

    let bestH = 0;
    for (let h = minH; h <= maxH && !bestH; h++) {
      let s = 0, t = 0;
      for (let r = h; r < rows; r += rStep) {
        const b = r * cols, b0 = (r - h) * cols;
        for (let c = 0; c < cols; c += cStep) {
          t++;
          if (cells[b + c] === cells[b0 + c]) s++;
        }
      }
      if (t && s / t >= MIN_AUTO) bestH = h;
    }
    if (!bestH) return null;

    // 组合口径把关：对齐第一周期 (0,0)
    const rep = { c: 0, r: 0, w: bestW, h: bestH };
    const rep2 = seamReport(rep);
    if (!rep2 || rep2.phase < 0.6) return null;
    return { c: 0, r: 0, w: rep2.w, h: rep2.h, match: rep2.phase, points: rep2.diffs };
  }

  const CROSS_CODE = { 9: "R", 10: "L", 11: "X", 15: "R", 16: "L" };

  function normCrosses(list, cols, rows) {
    if (!list || !list.length) return [];
    const out = [];
    const seen = {};
    for (let i = 0; i < list.length; i++) {
      const x = list[i];
      if (!x || typeof x !== "object") continue;
      const row = Math.round(+x.row);
      const c0 = Math.round(+x.c0);
      const left = Math.round(+x.left);
      const right = Math.round(+x.right);
      if (!(row >= 0 && row < rows)) continue;
      if (!(left >= 1 && right >= 1)) continue;
      if (left + right > cols) continue;
      if (c0 < 0 || c0 + left + right > cols) continue;
      const dir = (+x.dir >= 0) ? 1 : -1;
      const key = row + ":" + c0;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ row, c0, left, right, dir });
    }
    out.sort((a, b) => (a.row - b.row) || (a.c0 - b.c0));
    return out;
  }

  function getCrosses() { return state.crosses; }

  function addCross(row, c0, left, right, dir, label) {
    if (!state.crosses) state.crosses = [];
    const before = mkSnapshot();
    state.crosses = normCrosses(state.crosses.concat([{ row, c0, left, right, dir }]), state.cols, state.rows);
    const added = state.crosses.filter((x) => x.row === row && x.c0 === c0)[0];
    if (!added) return null;
    pushUndo(label || "cross:add", before);
    emit("change", { type: "cross" });
    return added;
  }

  function removeCross(row, c0) {
    if (!state.crosses || !state.crosses.length) return false;
    const before = mkSnapshot();
    const next = state.crosses.filter((x) => !(x.row === row && x.c0 === c0));
    if (next.length === state.crosses.length) return false;
    state.crosses = next;
    pushUndo("cross:remove", before);
    emit("change", { type: "cross" });
    return true;
  }

  function markDirty() {
    state.dirty = true;
    emit("change", { type: "dirty" });
  }

  const SYM_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function nextSymbol(used) {
    for (let i = 0; i < SYM_POOL.length; i++) {
      const s = SYM_POOL[i];
      if (!used.has(s)) return s;
    }
    for (let i = 0; i < SYM_POOL.length; i++) {
      for (let d = 0; d < 10; d++) {
        const s = SYM_POOL[i] + d;
        if (!used.has(s)) return s;
      }
    }
    return String(used.size + 1);
  }
  function normYarn(p, used) {
    const hex = p && p.hex ? String(p.hex) : "#cccccc";
    const y = { hex: hex, name: p && p.name ? String(p.name) : hex };
    let s = p && p.symbol ? String(p.symbol).trim().slice(0, 2) : "";
    if (!s || used.has(s)) s = nextSymbol(used);
    used.add(s);
    y.symbol = s;
    if (p && p.spec) y.spec = String(p.spec).slice(0, 32);
    if (p && p.lot) y.lot = String(p.lot).slice(0, 16);
    if (p && p.photo) y.photo = String(p.photo).slice(0, 260);
    return y;
  }
  function normPalette(list) {
    const used = new Set();
    return (list || []).map((p) => normYarn(p, used));
  }
  function mkYarn(hex, name, extra) {
    const used = new Set();
    state.palette.forEach((y) => used.add(y.symbol));
    const p = { hex: hex, name: name };
    if (extra) Object.keys(extra).forEach((k) => { p[k] = extra[k]; });
    return normYarn(p, used);
  }

  function beginStroke(label) {
    if (pending) return;
    pending = { label: label || "edit", before: state.cells.slice() };
  }

  function endStroke() {
    if (!pending) return;
    const before = pending.before;
    const after = state.cells;
    const patches = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) patches.push(i, after[i], before[i]);
    }
    pending = null;
    if (!patches.length) return;
    undoStack.push({ patches: patches, size: before.length });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack.length = 0;
    markDirty();
    emit("change", { type: "cells" });
  }

  function abortStroke() {
    if (!pending) return;
    state.cells.set(pending.before);
    pending = null;
    emit("change", { type: "cells" });
  }

  function applyPatches(patches) {
    for (let i = 0; i < patches.length; i += 3) {
      state.cells[patches[i]] = patches[i + 1];
    }
    emit("change", { type: "cells" });
  }

  function undo() {
    const cmd = undoStack.pop();
    if (!cmd) return false;
    if (cmd.type === "snap") {
      const now = mkSnapshot();
      restoreSnapshot(cmd.before);
      redoStack.push({ type: "snap", label: cmd.label, before: now });
      emit("change", { type: "all" });
      emit("palette", null);
    } else {
      const inv = invert(cmd.patches);
      applyPatches(inv);
      redoStack.push(cmd);
    }
    markDirty();
    return true;
  }

  function redo() {
    const cmd = redoStack.pop();
    if (!cmd) return false;
    if (cmd.type === "snap") {
      const now = mkSnapshot();
      restoreSnapshot(cmd.before);
      undoStack.push({ type: "snap", label: cmd.label, before: now });
      emit("change", { type: "all" });
      emit("palette", null);
    } else {
      applyPatches(cmd.patches);
      undoStack.push(cmd);
    }
    markDirty();
    return true;
  }

  function mkUnderlay(u) {
    if (!u || !u.dataURL) return null;
    const out = {
      dataURL: u.dataURL,
      opacity: typeof u.opacity === "number" ? u.opacity : 0.5,
      visible: u.visible !== false,
      lock: !!u.lock,
      eyedrop: !!u.eyedrop,
      export: !!u.export
    };
    const img = new Image();
    img.onload = () => emit("change", { type: "underlay" });
    img.src = out.dataURL;
    out.img = img;
    return out;
  }

  function underlayData(u) {
    if (!u || !u.dataURL) return null;
    return {
      dataURL: u.dataURL,
      opacity: u.opacity,
      visible: u.visible,
      lock: u.lock,
      eyedrop: u.eyedrop,
      export: u.export
    };
  }

  function mkSnapshot() {
    return {
      cols: state.cols,
      rows: state.rows,
      cells: state.cells.slice(),
      stitches: state.stitches.slice(),
      crosses: normCrosses(state.crosses, state.cols, state.rows),
      knitting: state.knitting,
      repeat: state.repeat ? { c: state.repeat.c, r: state.repeat.r, w: state.repeat.w, h: state.repeat.h } : null,
      palette: normPalette(state.palette),
      fg: state.fg,
      bg: state.bg,
      gauge: { sts: state.gauge.sts, rows: state.gauge.rows },
      tiles: { h: state.tiles.h, v: state.tiles.v },
      underlay: underlayData(state.underlay)
    };
  }

  function restoreSnapshot(s) {
    pending = null;
    state.cols = s.cols;
    state.rows = s.rows;
    state.cells = s.cells.slice();
    state.stitches = s.stitches && s.stitches.length === s.cols * s.rows
      ? s.stitches.slice() : new Uint8Array(s.cols * s.rows);
    state.crosses = normCrosses(s.crosses, s.cols, s.rows);
    state.knitting = s.knitting === "round" ? "round" : "flat";
    state.repeat = normRepeat(s.repeat, s.cols, s.rows);
    state.palette = normPalette(s.palette);
    state.fg = Math.min(s.fg, state.palette.length - 1);
    state.bg = Math.min(s.bg, state.palette.length - 1);
    state.gauge = { sts: s.gauge.sts, rows: s.gauge.rows };
    state.tiles = { h: s.tiles.h, v: s.tiles.v };
    state.underlay = mkUnderlay(s.underlay);
  }

  function snapshot() {
    return mkSnapshot();
  }

  function pushUndo(label, before) {
    undoStack.push({ type: "snap", label: label || "edit", before: before });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack.length = 0;
    markDirty();
  }

  function invert(patches) {
    const inv = new Array(patches.length);
    for (let i = 0; i < patches.length; i += 3) {
      inv[i] = patches[i];
      inv[i + 1] = patches[i + 2];
      inv[i + 2] = patches[i + 1];
    }
    return inv;
  }

  function setCell(c, r, v) {
    if (!inBounds(c, r)) return false;
    const i = idx(c, r);
    if (state.cells[i] === v) return false;
    state.cells[i] = v;
    return true;
  }

  function floodFill(c, r, v) {
    if (!inBounds(c, r)) return false;
    const target = state.cells[idx(c, r)];
    if (target === v) return false;
    const stack = [[c, r]];
    const w = state.cols, h = state.rows;
    let changed = false;
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = x + y * w;
      if (state.cells[i] !== target) continue;
      state.cells[i] = v;
      changed = true;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return changed;
  }

  function load(data) {
    state.id = data.id;
    state.title = data.title;
    state.cols = data.cols;
    state.rows = data.rows;
    state.cells = data.cells instanceof Uint8Array ? data.cells.slice() : new Uint8Array(data.cells);
    if (state.cells.length !== state.cols * state.rows) {
      state.cells = new Uint8Array(state.cols * state.rows);
    }
    state.stitches = data.stitches && data.stitches.length === state.cols * state.rows
      ? (data.stitches instanceof Uint8Array ? data.stitches.slice() : new Uint8Array(data.stitches))
      : new Uint8Array(state.cols * state.rows);
    state.knitting = data.knitting === "round" ? "round" : "flat";
    state.repeat = normRepeat(data.repeat, state.cols, state.rows);
    state.palette = normPalette(data.palette && data.palette.length ? data.palette : state.palette);
    state.gauge = data.gauge ? { sts: data.gauge.sts, rows: data.gauge.rows } : { sts: 29, rows: 21 };
    state.tiles = data.tiles ? { h: data.tiles.h || 1, v: data.tiles.v || 1 } : { h: 1, v: 1 };
    state.fg = Math.min(state.palette.length - 1, Math.max(0, data.fg || 1));
    state.bg = Math.min(state.palette.length - 1, Math.max(0, data.bg || 0));
    state.underlay = mkUnderlay(data.underlay);
    state.crosses = normCrosses(data.crosses, state.cols, state.rows);
    state.dirty = false;
    undoStack = [];
    redoStack = [];
    pending = null;
    emit("load", null);
    emit("change", { type: "all" });
  }

  function blank(title, cols, rows) {
    load({
      id: null,
      title: title,
      cols: cols,
      rows: rows,
      cells: new Uint8Array(cols * rows),
      palette: state.palette,
      gauge: { sts: 29, rows: 21 },
      tiles: { h: 1, v: 1 }
    });
  }

  function resize(cols, rows, skipUndo) {
    if (cols === state.cols && rows === state.rows) return false;
    const before = mkSnapshot();
    if (pending) pending = null;
    const next = new Uint8Array(cols * rows);
    const nextSt = new Uint8Array(cols * rows);
    const cc = Math.min(cols, state.cols);
    const rr = Math.min(rows, state.rows);
    for (let r = 0; r < rr; r++) {
      for (let c = 0; c < cc; c++) {
        next[c + r * cols] = state.cells[c + r * state.cols];
        nextSt[c + r * cols] = state.stitches[c + r * state.cols];
      }
    }
    state.cols = cols;
    state.rows = rows;
    state.cells = next;
    state.stitches = nextSt;
    state.repeat = normRepeat(state.repeat, cols, rows);
    state.crosses = normCrosses(state.crosses, cols, rows);
    if (!skipUndo) {
      undoStack.push({ type: "snap", label: "resize", before: before });
      if (undoStack.length > UNDO_MAX) undoStack.shift();
      redoStack.length = 0;
    }
    markDirty();
    emit("change", { type: "all" });
    return true;
  }

  function serialize() {
    return {
      id: state.id,
      title: state.title,
      cols: state.cols,
      rows: state.rows,
      cells: state.cells.slice(),
      stitches: state.stitches.slice(),
      knitting: state.knitting,
      repeat: state.repeat ? { c: state.repeat.c, r: state.repeat.r, w: state.repeat.w, h: state.repeat.h } : null,
      palette: normPalette(state.palette),
      gauge: { sts: state.gauge.sts, rows: state.gauge.rows },
      tiles: { h: state.tiles.h, v: state.tiles.v },
      fg: state.fg,
      bg: state.bg,
      underlay: underlayData(state.underlay),
      crosses: normCrosses(state.crosses, state.cols, state.rows)
    };
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  return {
    state, on, emit,
    idx, inBounds, getCell, setCell, floodFill,
    getStitch, setStitch, normRepeat,
    seamReport, detectRepeat,
    getCrosses, addCross, removeCross, normCrosses,
    beginStroke, endStroke, abortStroke,
    undo, redo, canUndo, canRedo,
    snapshot, pushUndo,
    load, blank, resize, serialize,
    markDirty, mkUnderlay,
    nextSymbol, mkYarn, normPalette,
    isStroking: () => pending !== null,
    get pending() { return pending; }
  };
})();
