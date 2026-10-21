const Rules = (() => {
  let timer = null;
  const issues = [];

  function init() {
    Chart.on("change", schedule);
    Chart.on("load", schedule);
    schedule();
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 400);
  }

  function run() {
    timer = null;
    const ch = Chart.state;
    issues.length = 0;
    const w = ch.cols, h = ch.rows;
    const cells = ch.cells;

    for (let v = 0; v < cells.length; v++) {
      if (cells[v] >= ch.palette.length) {
        issues.push({ type: "oob", c: v % w, r: Math.floor(v / w) });
      }
    }

    for (let r = 0; r < h; r++) {
      let nonBg = false;
      for (let c = 0; c < w; c++) {
        if (cells[c + r * w] !== ch.bg) { nonBg = true; break; }
      }
      if (!nonBg) issues.push({ type: "emptyRow", c: 0, r });
    }

    // 提花浮线：一行内被"同色"夹住的一段异色，背面要走一条挂线，
    // 超过 5 针就容易勾到手指/针尖，超过 10 针必须织入（weave in）
    for (let r = 0; r < h; r++) {
      let c = 0;
      while (c < w) {
        const v = cells[c + r * w];
        let e2 = c;
        while (e2 + 1 < w && cells[(e2 + 1) + r * w] === v) e2++;
        const len = e2 - c + 1;
        const lv = c > 0 ? cells[(c - 1) + r * w] : -1;
        const rv = e2 + 1 < w ? cells[(e2 + 1) + r * w] : -1;
        if (lv >= 0 && rv >= 0 && lv === rv && lv !== v && len > 5) {
          issues.push({ type: len > 10 ? "floatHuge" : "floatLong", c, r, len });
        }
        c = e2 + 1;
      }
    }

    // 单行色数：Fair Isle 传统是一行两色，色数越多，带的线头越多、越容易绞线
    for (let r = 0; r < h; r++) {
      const set = new Set();
      for (let c = 0; c < w; c++) set.add(cells[c + r * w]);
      if (set.size > 3) issues.push({ type: "manyColors", c: 0, r, len: set.size });
    }

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const v = cells[c + r * w];
        if (v === ch.bg) continue;
        let same = 0, neighbors = 0;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
          const x = c + dx, y = r + dy;
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          neighbors++;
          if (cells[x + y * w] === v) same++;
        }
        if (neighbors > 0 && same === 0) issues.push({ type: "stray", c, r });
      }
    }

    // 重复单元不整除：repeat.w/h 不能整除画布 cols/rows → tiles 铺不平
    if (ch.repeat) {
      const { w: rw, h: rh } = ch.repeat;
      if (w % rw !== 0) issues.push({ type: "repeatIncompatible", c: ch.repeat.c, r: 0, len: rw });
      if (h % rh !== 0) issues.push({ type: "repeatIncompatibleV", c: 0, r: ch.repeat.r, len: rh });
    }

    // crosses 自身重叠：两个交叉事件占用了重叠的针位
    if (ch.crosses && ch.crosses.length >= 2) {
      for (let a = 0; a < ch.crosses.length; a++) {
        const x = ch.crosses[a];
        for (let b = a + 1; b < ch.crosses.length; b++) {
          const y = ch.crosses[b];
          if (x.row !== y.row) continue;
          const xL = x.c0, xR = x.c0 + x.left + x.right;
          const yL = y.c0, yR = y.c0 + y.left + y.right;
          if (xL < yR && yL < xR) {
            issues.push({ type: "crossOverlap", c: Math.max(xL, yL), r: x.row });
          }
        }
      }
    }

    // 密度离谱：针/行 per 10cm 明显超物理可能范围
    if (ch.gauge) {
      const g = ch.gauge;
      if (g.sts && (g.sts < 5 || g.sts > 100)) issues.push({ type: "gaugeAbsurdSts", c: 0, r: 0, len: g.sts });
      if (g.rows && (g.rows < 5 || g.rows > 140)) issues.push({ type: "gaugeAbsurdRows", c: 0, r: 0, len: g.rows });
    }

    render();
    document.dispatchEvent(new CustomEvent("rules:updated", { detail: issues.slice(0, 80) }));
  }

  const label = {
    stray: "check.stray",
    emptyRow: "check.emptyRow",
    oob: "check.oob",
    floatLong: "check.floatLong",
    floatHuge: "check.floatHuge",
    manyColors: "check.manyColors",
    repeatIncompatible: "check.repeatIncompatible",
    repeatIncompatibleV: "check.repeatIncompatibleV",
    crossOverlap: "check.crossOverlap",
    gaugeAbsurdSts: "check.gaugeAbsurdSts",
    gaugeAbsurdRows: "check.gaugeAbsurdRows"
  };
  const withLen = { floatLong: 1, floatHuge: 1, repeatIncompatible: 1, repeatIncompatibleV: 1, gaugeAbsurdSts: 1, gaugeAbsurdRows: 1 };

  function render() {
    const ul = document.getElementById("checkList");
    if (!ul) return;
    ul.innerHTML = "";
    if (!issues.length) {
      const li = document.createElement("li");
      li.className = "ok";
      li.textContent = I18N.t("check.none");
      ul.appendChild(li);
      return;
    }
    const counts = {};
    const shown = {};
    issues.forEach((i) => { counts[i.type] = (counts[i.type] || 0) + 1; });
    Object.keys(counts).forEach((type) => {
      const li = document.createElement("li");
      const name = I18N.t(label[type] || type);
      li.innerHTML = "<b>" + name + "</b> × " + counts[type];
      li.addEventListener("click", () => {
        const first = issues.find((i) => i.type === type);
        if (first) Editor.goto(first.c, first.r);
      });
      ul.appendChild(li);
      shown[type] = true;
    });
    issues.slice(0, 30).forEach((i) => {
      const li = document.createElement("li");
      const name = I18N.t(label[i.type] || i.type);
      const len = withLen[i.type] && i.len ? " " + i.len + I18N.t("check.sts") : "";
      li.textContent = name + len + " @ " + (i.c + 1) + "×" + (i.r + 1);
      li.addEventListener("click", () => Editor.goto(i.c, i.r));
      ul.appendChild(li);
    });
  }

  return { init, run, get issues() { return issues; } };
})();
