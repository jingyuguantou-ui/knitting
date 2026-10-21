const Yarns = (() => {
  const URL = "data/yarns.json";
  let db = null;
  let loading = null;
  let onReady = null;

  function load() {
    if (db) return Promise.resolve(db);
    if (loading) return loading;
    loading = fetch(URL, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("yarns.json " + r.status);
      return r.json();
    }).then((j) => {
      db = {
        yarns: j.yarns || [],
        lines: j.lines || [],
        count: j.count || (j.yarns || []).length
      };
      return db;
    }).catch((e) => {
      loading = null;
      throw e;
    });
    return loading;
  }

  function ready() { return db ? Promise.resolve(db) : load(); }

  function lines() { return db ? db.lines.slice() : []; }
  function all() { return db ? db.yarns.slice() : []; }
  function count() { return db ? db.count : 0; }

  function lineKey(y) { return y.brand + " / " + y.line; }

  function byLine(key) {
    if (!db) return [];
    const out = [];
    for (const y of db.yarns) if (lineKey(y) === key) out.push(y);
    return out;
  }

  function search(q, key) {
    const src = key ? byLine(key) : all();
    const s = String(q || "").trim().toLowerCase();
    if (!s) return src;
    return src.filter((y) =>
      String(y.code).toLowerCase().indexOf(s) >= 0 ||
      String(y.name).toLowerCase().indexOf(s) >= 0 ||
      String(y.brand).toLowerCase().indexOf(s) >= 0 ||
      String(y.line).toLowerCase().indexOf(s) >= 0 ||
      String(y.lot).toLowerCase().indexOf(s) >= 0
    );
  }

  function label(y) {
    return (y.code ? y.code + " " : "") + y.name;
  }

  // 转成 Chart 的纱线记录；symbols 为已用符号集合
  function toChartYarn(y, used) {
    const spec = [y.brand, y.line, y.weight].filter(Boolean).join(" · ");
    return Chart.mkYarn(y.hex, label(y), { spec: spec, lot: y.lot, photo: y.photo || y.thumb || "" });
  }

  return { ready, lines, all, count, byLine, search, label, lineKey, toChartYarn, get db() { return db; } };
})();