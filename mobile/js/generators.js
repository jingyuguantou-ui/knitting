const Generators = (() => {
  function accent(ch) {
    const used = new Set([ch.fg, ch.bg]);
    for (let i = 0; i < ch.palette.length; i++) if (!used.has(i)) return i;
    return ch.fg;
  }

  const gens = {
    clear(ch) {
      ch.cells.fill(ch.bg);
    },

    stripes(ch) {
      const { cols, rows, cells, fg, bg } = ch;
      const acc = accent(ch);
      const band = Math.max(3, Math.round(rows / 8));
      for (let r = 0; r < rows; r++) {
        const block = Math.floor(r / band);
        const base = block % 2 === 0 ? fg : bg;
        const v = r % band === band - 1 && block % 2 === 0 ? acc : base;
        for (let c = 0; c < cols; c++) cells[c + r * cols] = v;
      }
    },

    checker(ch) {
      const { cols, rows, cells, fg, bg } = ch;
      const size = 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          cells[c + r * cols] = (((c / size) | 0) + ((r / size) | 0)) % 2 ? fg : bg;
        }
      }
    },

    argyle(ch) {
      const { cols, rows, cells, fg, bg } = ch;
      const acc = accent(ch);
      const P = Math.max(8, Math.round(cols / 4));
      const half = P >> 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = (c + r) % P;
          const b = ((c - r) % P + P) % P;
          let v = bg;
          if (a < 2 || b < 2) v = fg;
          else if (a === half || b === half) v = bg;
          if (a >= half && a < half + 2 && b >= half && b < half + 2) v = acc;
          cells[c + r * cols] = v;
        }
      }
    },

    zigzag(ch) {
      const { cols, rows, cells, fg, bg } = ch;
      const acc = accent(ch);
      const P = 12, bandH = 5;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ((c % P) + P) % P;
          const tri = x < P / 2 ? x : P - 1 - x;
          const depth = Math.floor(tri / (P / 2) * bandH);
          const rr = (r + depth) % (2 * bandH);
          cells[c + r * cols] = rr < bandH ? fg : (rr === 2 * bandH - 1 ? acc : bg);
        }
      }
    },

    dots(ch) {
      const { cols, rows, cells, fg, bg } = ch;
      const acc = accent(ch);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let v = bg;
          if (c % 6 === 3 && r % 6 === 3) v = fg;
          else if (c % 6 === 0 && r % 6 === 0) v = acc;
          cells[c + r * cols] = v;
        }
      }
    }
  };

  function apply(name) {
    const fn = gens[name];
    if (!fn) return;
    Chart.beginStroke("gen:" + name);
    fn(Chart.state);
    Chart.endStroke();
  }

  function names() { return Object.keys(gens); }

  return { apply, names };
})();
