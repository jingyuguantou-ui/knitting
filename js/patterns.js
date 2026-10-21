const Patterns = (() => {
  function accent(ch) {
    const used = new Set([ch.fg, ch.bg]);
    for (let i = 0; i < ch.palette.length; i++) if (!used.has(i)) return i;
    return ch.fg;
  }

  function hash(n) {
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = (n ^ (n >>> 16)) >>> 0;
    return n / 4294967296;
  }

  function parseRows(rows) {
    const h = rows.length;
    const w = rows[0].length;
    const m = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) m[c + r * w] = rows[r].charCodeAt(c) - 48;
    }
    return { w, h, m };
  }

  function gen(w, h, fn) {
    const m = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) m[c + r * w] = fn(c, r);
    }
    return { w, h, m };
  }

  function selbuStar() {
    return gen(16, 16, (c, r) => {
      const D = Math.abs(2 * c - 15);
      const R = Math.abs(2 * r - 15);
      let v = 0;
      if (D <= 1 && R <= 12) v = 1;
      if (R <= 1 && D <= 12) v = 1;
      if (Math.abs(D - R) <= 1 && D <= 14) v = 1;
      if (D + R <= 7) v = 1;
      return v;
    });
  }

  const OXO_ROWS = [
    "000000000010000001",
    "000110000001000010",
    "001001000000100100",
    "010000100000011000",
    "100000010000011000",
    "010000100000100100",
    "001001000001000010",
    "000110000010000001"
  ];
  const HEART_ROWS = [
    "011101110",
    "011111110",
    "011111110",
    "001111100",
    "000111000",
    "000010000"
  ];
  const SNOW_ROWS = [
    "1001001",
    "0101010",
    "0011100",
    "1111111",
    "0011100",
    "0101010",
    "1001001"
  ];
  const STAR5_ROWS = [
    "000010000",
    "000010000",
    "000111000",
    "111111111",
    "011111110",
    "001111100",
    "011000110",
    "110000011",
    "100000001"
  ];

  const defs = [
    /* ---------- parametric ---------- */
    {
      id: "stripesP", group: "param", source: "algo", nameKey: "rules.stripesP",
      params: [
        { key: "band", min: 2, max: 24, def: 6 },
        { key: "accentLine", min: 0, max: 1, def: 1 }
      ],
      roleFn: (p, c, r) => {
        const band = Math.max(2, p.band);
        const block = Math.floor(r / band);
        if (p.accentLine && block % 2 === 0 && r % band === band - 1) return 2;
        return block % 2 === 0 ? 1 : 0;
      }
    },
    {
      id: "twill", group: "param", source: "algo", nameKey: "rules.twill",
      params: [
        { key: "period", min: 2, max: 16, def: 4 },
        { key: "width", min: 1, max: 8, def: 2 },
        { key: "dir", min: 0, max: 1, def: 0 }
      ],
      roleFn: (p, c, r) => {
        const width = Math.min(p.width, p.period - 1);
        const x = p.dir ? c - r : c + r;
        return ((x % p.period) + p.period) % p.period < width ? 1 : 0;
      }
    },
    {
      id: "herringbone", group: "param", source: "algo", nameKey: "rules.herringbone",
      params: [
        { key: "bandH", min: 2, max: 12, def: 5 },
        { key: "step", min: 1, max: 4, def: 2 }
      ],
      roleFn: (p, c, r) => {
        const band = Math.max(2, p.bandH);
        const b = Math.floor(r / band) % 2;
        const x = b ? -c : c;
        return ((x + r * p.step) % (band * 2) + band * 2) % (band * 2) < band ? 1 : 0;
      }
    },
    {
      id: "chevron", group: "param", source: "algo", nameKey: "rules.chevron",
      params: [
        { key: "period", min: 4, max: 24, def: 12 },
        { key: "bandH", min: 2, max: 10, def: 4 },
        { key: "accentLine", min: 0, max: 1, def: 1 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(4, p.period);
        const bh = Math.max(1, p.bandH);
        const x = ((c % P) + P) % P;
        const tri = x < P / 2 ? x : P - 1 - x;
        const depth = Math.floor(tri / (P / 2) * bh);
        const rr = (r + depth) % (2 * bh);
        if (rr < bh) return p.accentLine && rr === bh - 1 ? 2 : 1;
        return 0;
      }
    },
    {
      id: "check", group: "param", source: "algo", nameKey: "rules.check",
      params: [
        { key: "size", min: 2, max: 16, def: 6 },
        { key: "lineW", min: 1, max: 3, def: 1 }
      ],
      roleFn: (p, c, r) => {
        const S = Math.max(2, p.size);
        const inC = c % S < p.lineW;
        const inR = r % S < p.lineW;
        if (inC && inR) return 2;
        if (inC || inR) return 1;
        return 0;
      }
    },
    {
      id: "gingham", group: "param", source: "algo", nameKey: "rules.gingham",
      params: [
        { key: "size", min: 2, max: 16, def: 6 }
      ],
      roleFn: (p, c, r) => {
        const S = Math.max(2, p.size);
        const v = (r % S < S / 2 ? 1 : 0) + (c % S < S / 2 ? 1 : 0);
        return v === 2 ? 2 : v === 1 ? 1 : 0;
      }
    },
    {
      id: "seed", group: "param", source: "algo", nameKey: "rules.seed",
      params: [
        { key: "density", min: 5, max: 60, def: 20 },
        { key: "seed", min: 0, max: 99, def: 7 }
      ],
      roleFn: (p, c, r, cols) => {
        const n = (c + r * cols) ^ Math.imul(p.seed + 1, 2654435761);
        return hash(n) < p.density / 100 ? 1 : 0;
      }
    },
    {
      id: "polka", group: "param", source: "algo", nameKey: "rules.polka",
      params: [
        { key: "size", min: 3, max: 12, def: 6 }
      ],
      roleFn: (p, c, r) => {
        const S = Math.max(3, p.size);
        const mid = Math.floor(S / 2);
        if (c % S === mid && r % S === mid) return 1;
        if (c % S === 0 && r % S === 0) return 2;
        return 0;
      }
    },
    {
      id: "argyleP", group: "param", source: "algo", nameKey: "rules.argyleP",
      params: [
        { key: "spacing", min: 8, max: 32, def: 16 },
        { key: "lineW", min: 1, max: 4, def: 2 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(8, p.spacing);
        const w = Math.min(p.lineW, 4);
        const half = P >> 1;
        const a = ((c + r) % P + P) % P;
        const b = ((c - r) % P + P) % P;
        if (a >= half && a < half + w && b >= half && b < half + w) return 2;
        if (a < w || b < w) return 1;
        return 0;
      }
    },
    {
      id: "basket", group: "param", source: "algo", nameKey: "rules.basket",
      params: [
        { key: "size", min: 2, max: 6, def: 3 }
      ],
      roleFn: (p, c, r) => {
        const S = Math.max(2, p.size);
        const even = (Math.floor(c / S) + Math.floor(r / S)) % 2 === 0;
        return (even ? r % S : c % S) === 0 ? 1 : 0;
      }
    },
    {
      id: "sawtooth", group: "param", source: "algo", nameKey: "rules.sawtooth",
      params: [
        { key: "period", min: 3, max: 16, def: 8 },
        { key: "bandH", min: 2, max: 10, def: 5 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(3, p.period);
        const bh = Math.max(2, p.bandH);
        const x = ((c % P) + P) % P;
        const b = Math.floor(r / bh) % 2;
        const xx = b ? P - 1 - x : x;
        const rr = r % bh;
        if (rr >= Math.round(xx * (bh - 1) / Math.max(1, P - 1))) return b ? 2 : 1;
        return 0;
      }
    },
    {
      id: "ripple", group: "param", source: "algo", nameKey: "rules.ripple",
      params: [
        { key: "period", min: 6, max: 30, def: 16 },
        { key: "amp", min: 0, max: 4, def: 2 },
        { key: "bandH", min: 3, max: 12, def: 6 },
        { key: "lineW", min: 1, max: 4, def: 2 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(6, p.period);
        const bh = Math.max(3, p.bandH);
        const shift = Math.round(Math.sin(c / P * Math.PI * 2) * p.amp);
        const m = (((r + shift) % bh) + bh) % bh;
        if (m < p.lineW) return 1;
        if (m === bh - 1 && bh > 5) return 2;
        return 0;
      }
    },
    {
      id: "plaid", group: "param", source: "algo", nameKey: "rules.plaid",
      params: [
        { key: "period", min: 6, max: 24, def: 12 },
        { key: "lineW", min: 1, max: 4, def: 2 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(6, p.period);
        const w = p.lineW;
        const half = Math.floor(P / 2);
        const vc = c % P < w || c % P === half;
        const vr = r % P < w || r % P === half;
        if (vc && vr) return 2;
        if (vc || vr) return 1;
        return 0;
      }
    },
    {
      id: "lattice", group: "param", source: "algo", nameKey: "rules.lattice",
      params: [
        { key: "period", min: 3, max: 12, def: 4 },
        { key: "lineW", min: 1, max: 3, def: 1 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(3, p.period);
        const w = p.lineW;
        if ((((c + r) % P) + P) % P < w) return 1;
        if ((((c - r) % P) + P) % P < w) return 1;
        return 0;
      }
    },
    {
      id: "diamondDot", group: "param", source: "algo", nameKey: "rules.diamondDot",
      params: [
        { key: "period", min: 4, max: 20, def: 10 },
        { key: "size", min: 1, max: 6, def: 3 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(4, p.period);
        const x = ((c % P) + P) % P - P / 2;
        const y = ((r % P) + P) % P - P / 2;
        const d = Math.abs(x) + Math.abs(y);
        if (d <= 1) return 2;
        if (d <= p.size) return 1;
        return 0;
      }
    },
    {
      id: "honeycomb", group: "param", source: "algo", nameKey: "rules.honeycomb",
      params: [
        { key: "period", min: 4, max: 16, def: 8 },
        { key: "lineW", min: 1, max: 3, def: 1 }
      ],
      roleFn: (p, c, r) => {
        const P = Math.max(4, p.period);
        const x = ((c % P) + P) % P;
        const y = ((r % P) + P) % P;
        const d = Math.abs(x - P / 2) + Math.abs(y - P / 2);
        return d >= P / 2 - p.lineW && d <= P / 2 + 0.5 ? 1 : 0;
      }
    },
    {
      id: "crossTile", group: "param", source: "algo", nameKey: "rules.crossTile",
      params: [
        { key: "period", min: 5, max: 17, def: 9 }
      ],
      roleFn: (p, c, r) => {
        let P = p.period % 2 ? p.period : p.period + 1;
        if (P > 17) P = 17;
        const h = (P - 1) / 2;
        const x = ((c % P) + P) % P;
        const y = ((r % P) + P) % P;
        const d = Math.abs(x - h) + Math.abs(y - h);
        if (d === 0) return 2;
        if (d <= 1 || (d <= h && (x === h || y === h))) return 1;
        return 0;
      }
    },

    /* ---------- bands / borders ---------- */
    {
      id: "oxoBand", group: "band", source: "pd", nameKey: "rules.oxoBand",
      kind: "motif",
      build: () => parseRows(OXO_ROWS)
    },
    {
      id: "waveBand", group: "band", source: "pd", nameKey: "rules.waveBand",
      kind: "motif",
      build: () => gen(16, 8, (c, r) => {
        const mid = 3.5 + Math.sin(c / 16 * Math.PI * 2) * 2.5;
        return Math.abs(r - mid) <= 1.2 ? 1 : 0;
      })
    },
    {
      id: "zigzagBand", group: "band", source: "pd", nameKey: "rules.zigzagBand",
      kind: "motif",
      build: () => gen(16, 8, (c, r) => {
        const t = c % 8;
        const z = t < 4 ? t : 7 - t;
        const a = 6 - z * 2;
        return r === a || r === a + 1 ? 1 : 0;
      })
    },
    {
      id: "triRow", group: "band", source: "pd", nameKey: "rules.triRow",
      kind: "motif",
      build: () => gen(16, 4, (c, r) => {
        const t = c % 8;
        return r >= Math.floor(Math.abs(t - 3.5)) ? 1 : 0;
      })
    },
    {
      id: "diamondBand", group: "band", source: "pd", nameKey: "rules.diamondBand",
      kind: "motif",
      build: () => gen(16, 8, (c, r) => {
        const x = c % 8;
        const d = Math.abs(2 * x - 7) + Math.abs(2 * r - 7);
        if (d === 2) return 2;
        if (d === 6 || d === 8) return 1;
        return 0;
      })
    },

    /* ---------- traditional motifs ---------- */
    {
      id: "selbuStar", group: "fair", source: "pd", nameKey: "rules.selbuStar",
      kind: "motif",
      build: selbuStar
    },
    {
      id: "heart", group: "fair", source: "pd", nameKey: "rules.heart",
      kind: "motif",
      build: () => parseRows(HEART_ROWS)
    },
    {
      id: "snowflake", group: "fair", source: "pd", nameKey: "rules.snowflake",
      kind: "motif",
      build: () => parseRows(SNOW_ROWS)
    },
    {
      id: "star5", group: "fair", source: "pd", nameKey: "rules.star5",
      kind: "motif",
      build: () => parseRows(STAR5_ROWS)
    },
    {
      id: "tree", group: "fair", source: "pd", nameKey: "rules.tree",
      kind: "motif",
      build: () => gen(11, 12, (c, r) => {
        if (r <= 3 && c === 9) return 1;
        if (r <= 8) return Math.abs(c - 5) <= Math.floor((r + 1) * 5 / 9) ? 1 : 0;
        return Math.abs(c - 5) <= 1 ? 1 : 0;
      })
    },
    {
      id: "flower", group: "floral", source: "pd", nameKey: "rules.flower",
      kind: "motif",
      build: () => gen(9, 9, (c, r) => {
        const dx = Math.abs(c - 4), dy = Math.abs(r - 4);
        const D = 2 * (dx + dy);
        if (D === 0) return 2;
        if (D === 4 && dx === dy) return 1;
        if (D === 6) return 1;
        return 0;
      })
    },
    {
      id: "rose", group: "floral", source: "pd", nameKey: "rules.rose",
      kind: "motif",
      build: () => gen(13, 13, (c, r) => {
        const D = 2 * (Math.abs(c - 6) + Math.abs(r - 6));
        if (D <= 2) return 2;
        if (D === 6 || D === 12) return 1;
        return 0;
      })
    },
    {
      id: "diamondFlower", group: "floral", source: "pd", nameKey: "rules.diamondFlower",
      kind: "motif",
      build: () => gen(13, 13, (c, r) => {
        const dx = Math.abs(c - 6), dy = Math.abs(r - 6);
        const D = 2 * (dx + dy);
        if (D <= 2) return 2;
        if (D <= 6) return 1;
        if (D === 12) return 1;
        if (dx === 4 && dy === 4) return 1;
        return 0;
      })
    },
    {
      id: "crossFlower", group: "floral", source: "pd", nameKey: "rules.crossFlower",
      kind: "motif",
      build: () => gen(9, 9, (c, r) => {
        const dx = Math.abs(c - 4), dy = Math.abs(r - 4);
        if (dx === 0 && dy === 0) return 2;
        if ((dy === 4 && dx <= 1) || (dx === 4 && dy <= 1)) return 2;
        if ((dx <= 1 && dy <= 4) || (dy <= 1 && dx <= 4)) return 1;
        if (dx === 2 && dy === 2) return 1;
        return 0;
      })
    },
    {
      id: "sun", group: "floral", source: "pd", nameKey: "rules.sun",
      kind: "motif",
      build: () => gen(11, 11, (c, r) => {
        const dx = Math.abs(c - 5), dy = Math.abs(r - 5);
        if (dx + dy <= 1) return 2;
        if (dx + dy <= 3) return 1;
        if ((dx === 0 && dy <= 5) || (dy === 0 && dx <= 5)) return 1;
        if (dx === dy && dx <= 4) return 1;
        return 0;
      })
    },
    {
      id: "fern", group: "floral", source: "pd", nameKey: "rules.fern",
      kind: "motif",
      build: () => gen(9, 9, (c, r) => {
        if (c === r) return 1;
        if (Math.abs(c - r) === 2 && r % 2 === 0 && r >= 2 && r <= 6) return 1;
        return 0;
      })
    },
    {
      id: "house", group: "fair", source: "pd", nameKey: "rules.house",
      kind: "motif",
      build: () => gen(11, 12, (c, r) => {
        if (r <= 3 && c === 9) return 1;
        if (r <= 4) return Math.abs(c - 5) <= r ? 1 : 0;
        if (c >= 2 && c <= 8) {
          if (r >= 9 && c >= 4 && c <= 6) return 2;
          if (r >= 6 && r <= 7 && (c === 3 || c === 7)) return 2;
          return 1;
        }
        return 0;
      })
    },
    {
      id: "moon", group: "fair", source: "pd", nameKey: "rules.moon",
      kind: "motif",
      build: () => gen(11, 11, (c, r) => {
        const dx = c - 5, dy = r - 5;
        if (c === 9 && r === 1) return 2;
        if (dx * dx + dy * dy <= 25 && (dx - 3) * (dx - 3) + dy * dy > 16) return 1;
        return 0;
      })
    },

    /* ---------- stitch structures ---------- */
    {
      id: "rib1", group: "stitch", source: "pd", nameKey: "rules.rib1",
      kind: "stitch",
      build: () => gen(2, 1, (c) => (c % 2 === 1 ? 1 : 0))
    },
    {
      id: "rib2", group: "stitch", source: "pd", nameKey: "rules.rib2",
      kind: "stitch",
      build: () => gen(4, 1, (c) => (c >= 2 ? 1 : 0))
    },
    {
      id: "seedSt", group: "stitch", source: "pd", nameKey: "rules.seedSt",
      kind: "stitch",
      build: () => gen(2, 2, (c, r) => ((c + r) % 2 === 1 ? 1 : 0))
    },
    {
      id: "mossSt", group: "stitch", source: "pd", nameKey: "rules.mossSt",
      kind: "stitch",
      build: () => gen(4, 4, (c, r) => (((Math.floor(c / 2) + Math.floor(r / 2)) % 2 === 1) ? 1 : 0))
    },
    {
      id: "garterSt", group: "stitch", source: "pd", nameKey: "rules.garterSt",
      kind: "stitch",
      build: () => gen(1, 2, (c, r) => (r % 2 === 1 ? 1 : 0))
    },
    {
      id: "diamondPurl", group: "stitch", source: "pd", nameKey: "rules.diamondPurl",
      kind: "stitch",
      build: () => gen(8, 8, (c, r) => {
        const dx = Math.abs(c - 3.5), dy = Math.abs(r - 3.5);
        const d = dx + dy;
        if (d <= 1.1) return 1;
        if (d >= 2.7 && d <= 4.3) return 1;
        return 0;
      })
    },
    {
      id: "laceBar", group: "stitch", source: "pd", nameKey: "rules.laceBar",
      kind: "stitch",
      build: () => gen(4, 4, (c, r) => (r === 1 ? [0, 2, 0, 3][c] : 0))
    },
    {
      id: "halfFish", group: "stitch", source: "pd", nameKey: "rules.halfFish",
      kind: "stitch",
      build: () => gen(2, 2, (c, r) => (r % 2 === 0 ? (c % 2 === 1 ? 1 : 0) : 0))
    },

    /* ---------- lace & eyelets ---------- */
    {
      id: "eyeletRow", group: "lace", source: "pd", nameKey: "rules.eyeletRow",
      kind: "stitch",
      build: () => gen(4, 4, (c, r) => (r % 4 === 2 && c % 2 === 1 ? 2 : 0))
    },
    {
      id: "laceChevron", group: "lace", source: "pd", nameKey: "rules.laceChevron",
      kind: "stitch",
      build: () => gen(8, 4, (c, r) => {
        const t = ((c % 8) + 8) % 8;
        const z = t < 4 ? t : 7 - t;
        if (r === z) return t < 4 ? 4 : 3;
        if (r === z - 1 && (t === 0 || t === 7)) return 2;
        return 0;
      })
    },
    {
      id: "laceDiamond", group: "lace", source: "pd", nameKey: "rules.laceDiamond",
      kind: "stitch",
      build: () => gen(8, 8, (c, r) => {
        const d = Math.abs(c - 3.5) + Math.abs(r - 3.5);
        if (Math.round(d) === 3) return 2;
        if (Math.round(d) === 6) return 1;
        return 0;
      })
    },
    {
      id: "laceLeaf", group: "lace", source: "pd", nameKey: "rules.laceLeaf",
      kind: "stitch",
      build: () => gen(7, 8, (c, r) => {
        const dx = Math.abs(c - 3);
        if (dx > 0 && dx < 3 && dx === Math.floor(r / 2) && r % 2 === 0) return c < 3 ? 4 : 3;
        if (c === 3 && r % 2 === 1) return 2;
        return 0;
      })
    },
    {
      id: "laceMesh", group: "lace", source: "pd", nameKey: "rules.laceMesh",
      kind: "stitch",
      build: () => gen(4, 4, (c, r) => ((((c + r) % 4 === 0) || (((c - r) % 4 + 4) % 4 === 0)) ? 2 : 0))
    },
    {
      id: "filetGrid", group: "lace", source: "pd", nameKey: "rules.filetGrid",
      kind: "stitch",
      build: () => gen(3, 3, (c, r) => (c === 1 && r === 1 ? 2 : 0))
    },

    /* ---------- cables ---------- */
    {
      id: "cableR", group: "cable", source: "pd", nameKey: "rules.cableR",
      kind: "stitch",
      build: () => gen(4, 8, (c, r) => (r % 8 === 7 ? 9 : 0))
    },
    {
      id: "cableL", group: "cable", source: "pd", nameKey: "rules.cableL",
      kind: "stitch",
      build: () => gen(4, 8, (c, r) => (r % 8 === 7 ? 10 : 0))
    },
    {
      id: "cableWide", group: "cable", source: "pd", nameKey: "rules.cableWide",
      kind: "stitch",
      build: () => gen(8, 10, (c, r) => (r % 10 === 9 ? 9 : 0))
    },
    {
      id: "cableDiamond", group: "cable", source: "pd", nameKey: "rules.cableDiamond",
      kind: "stitch",
      build: () => gen(16, 16, (c, r) => {
        const d = Math.abs(c - 7.5) + Math.abs(r - 7.5);
        if (Math.round(d) !== 8) return 0;
        return (c < 7.5 ? (r < 7.5 ? 9 : 10) : (r < 7.5 ? 10 : 9));
      })
    },
    {
      id: "cableHoney", group: "cable", source: "pd", nameKey: "rules.cableHoney",
      kind: "stitch",
      build: () => gen(8, 8, (c, r) => {
        const row = r % 8;
        if (row === 3 && c < 4) return 9;
        if (row === 7 && c >= 4) return 10;
        return 0;
      })
    },
    {
      id: "cableBraid", group: "cable", source: "pd", nameKey: "rules.cableBraid",
      kind: "stitch",
      build: () => gen(12, 6, (c, r) => {
        const a = ((c + r) % 6 + 6) % 6 === 0;
        const b = ((c - r) % 6 + 6) % 6 === 0;
        if (a && b) return 11;
        if (a) return 9;
        if (b) return 10;
        return 0;
      })
    },

    /* ---------- modern motifs ---------- */
    {
      id: "mSheep", group: "animal", source: "algo", nameKey: "rules.sheep",
      kind: "motif",
      build: () => parseRows([
        "00000000000000",
        "00001111110000",
        "00011111111000",
        "00011222211000",
        "00011222211000",
        "00111122111100",
        "00111111111100",
        "00111111111100",
        "00011111111000",
        "00001111110000",
        "00002000020000",
        "00002000020000"
      ])
    },
    {
      id: "mPenguin", group: "animal", source: "algo", nameKey: "rules.penguin",
      kind: "motif",
      build: () => parseRows([
        "000000000000",
        "000011110000",
        "000111111000",
        "000101101000",
        "000112211000",
        "001111111100",
        "001110011100",
        "001110011100",
        "001110011100",
        "001111111100",
        "001111111100",
        "000220022000"
      ])
    },
    {
      id: "mPuffin", group: "animal", source: "algo", nameKey: "rules.puffin",
      kind: "motif",
      build: () => parseRows([
        "000000000000",
        "000011110000",
        "000111111000",
        "000111111000",
        "000122221000",
        "001111111100",
        "001110011100",
        "001110011100",
        "001110011100",
        "001111111100",
        "000111111000",
        "000220022000"
      ])
    },
    {
      id: "mPolarBear", group: "animal", source: "algo", nameKey: "rules.polarBear",
      kind: "motif",
      build: () => parseRows([
        "000000000000",
        "001111111100",
        "011111111110",
        "011111111110",
        "011121112110",
        "011111111110",
        "011111221110",
        "001111111100",
        "000111111000",
        "000011110000",
        "000000000000"
      ])
    },
    {
      id: "mReindeer", group: "fair", source: "algo", nameKey: "rules.reindeer",
      kind: "motif",
      build: () => parseRows([
        "000000101010",
        "000000111110",
        "000000111110",
        "000000110120",
        "000000111000",
        "000011111000",
        "001111111100",
        "001111111100",
        "001111111100",
        "001111111100",
        "000100001000",
        "000100001000",
        "000200002000"
      ])
    },
    {
      id: "mFox", group: "animal", source: "algo", nameKey: "rules.fox",
      kind: "motif",
      build: () => parseRows([
        "0011000000001100",
        "0011100000011100",
        "0011111111111100",
        "0011111111111100",
        "0011002112001100",
        "0011001111001100",
        "0011000000001100",
        "0011000220001100",
        "0011000000001100",
        "0011100000011100",
        "0000001111000000"
      ])
    },
    {
      id: "mCat", group: "animal", source: "algo", nameKey: "rules.cat",
      kind: "motif",
      build: () => parseRows([
        "011000000110",
        "011100001110",
        "011111111110",
        "011011110110",
        "011012210110",
        "001111111100",
        "011111111110",
        "001111111100",
        "001111111100",
        "001111111110",
        "001100001101"
      ])
    },
    {
      id: "mDoodleCross", group: "street", source: "algo", nameKey: "rules.doodleCross",
      kind: "motif",
      build: () => gen(12, 8, (c, r) => {
        const dx = Math.abs(((c % 6) + 6) % 6 - 2);
        const dy = Math.abs(((r % 8) + 8) % 8 - 3);
        if ((dx <= 1 && dy === 0) || (dx === 0 && dy <= 1)) return 1;
        if (c % 2 === 0 && r % 2 === 1) return 1;
        return 0;
      })
    },
    {
      id: "mDoodleDiam", group: "street", source: "algo", nameKey: "rules.doodleDiam",
      kind: "motif",
      build: () => gen(12, 8, (c, r) => {
        const d = Math.abs(((c % 6) + 6) % 6 - 2.5) + Math.abs(((r % 8) + 8) % 8 - 3.5);
        const dot = (c + r) % 2 === 0;
        if (d === 3) return 1;
        if (d <= 2) return dot ? 0 : 1;
        return dot ? 1 : 0;
      })
    },
    {
      id: "mGeoZig", group: "street", source: "algo", nameKey: "rules.geoZig",
      kind: "motif",
      build: () => gen(12, 6, (c, r) => {
        const t = ((c % 6) + 6) % 6;
        const up = t < 3 ? t : 5 - t;
        const b = ((r % 6) + 6) % 6;
        if (b === up || b === up + 1) return 1;
        if (b === 5 && t % 2 === 0) return 2;
        return 0;
      })
    },
    {
      id: "reindeerBand", group: "fair", source: "pd", nameKey: "rules.reindeerBand",
      kind: "motif",
      build: () => parseRows([
        "........1.1.1.",
        ".........1111.",
        ".........1211.",
        ".........11111",
        "........111...",
        "1......111....",
        "1111111111....",
        ".111111111....",
        "..11...11.....",
        "..11...11.....",
        "..22...22....."
      ])
    },
    {
      id: "snowBand", group: "fair", source: "pd", nameKey: "rules.snowBand",
      kind: "motif",
      build: () => gen(16, 8, (c, r) => {
        if (r === 7) return c % 4 === 2 ? 2 : 0;
        if (c === 8 && r === 3) return 2;
        const x0 = c >= 1 && c <= 7 ? c - 1 : (c >= 9 && c <= 15 ? c - 9 : -1);
        if (x0 >= 0) {
          const v = SNOW_ROWS[r].charCodeAt(x0) - 48;
          if (v > 0) return v;
        }
        return 0;
      })
    },
    {
      id: "starBand", group: "fair", source: "pd", nameKey: "rules.starBand",
      kind: "motif",
      build: () => gen(16, 8, (c, r) => {
        const x = c % 8;
        const dx = Math.abs(x - 3.5);
        const dy = Math.abs(r - 3.5);
        if (dx + dy <= 1.0) return 2;
        const arm = (dx < 0.6 && dy <= 3.0) || (dy < 0.6 && dx <= 3.0) || (Math.abs(dx - dy) < 0.6 && dx <= 3.0 && dy <= 3.0);
        return arm ? 1 : 0;
      })
    },
    {
      id: "houndstooth", group: "geo", source: "pd", nameKey: "rules.houndstooth",
      kind: "motif",
      build: () => gen(8, 8, (c, r) => {
        const warpUp = (((c - r) % 4) + 4) % 4 < 2;
        return warpUp ? (Math.floor(c / 4) % 2) : (Math.floor(r / 4) % 2);
      })
    },
    {
      id: "argyleClassic", group: "geo", source: "pd", nameKey: "rules.argyleClassic",
      kind: "motif",
      build: () => gen(16, 16, (c, r) => {
        const d = Math.abs(c - 7.5) + Math.abs(r - 7.5);
        if (Math.round(d) === 7 || Math.round(d) === 8) return 1;
        const s = ((c - r) % 8 + 8) % 8;
        const t = ((c + r) % 8 + 8) % 8;
        if ((s === 0 || t === 0) && (c + r) % 4 < 2) return 2;
        return 0;
      })
    },
    {
      id: "celticBraid", group: "geo", source: "pd", nameKey: "rules.celticBraid",
      kind: "motif",
      build: () => gen(8, 8, (c, r) => {
        const d1 = ((c - r) % 4 + 4) % 4;
        const d2 = ((c + r) % 4 + 4) % 4;
        const a = d1 < 2;
        const b = d2 < 2;
        if (a && b) return (Math.floor(d1 / 2) + Math.floor(d2 / 2)) % 2 === 0 ? 1 : 2;
        if (a) return 1;
        if (b) return 2;
        return 0;
      })
    },
    {
      id: "greekKey", group: "geo", source: "pd", nameKey: "rules.greekKey",
      kind: "motif",
      build: () => parseRows([
        "11111110",
        "10000010",
        "10111010",
        "10100010",
        "10101110",
        "10100000",
        "10111111"
      ])
    },
    {
      id: "tulip", group: "floral", source: "pd", nameKey: "rules.tulip",
      kind: "motif",
      build: () => parseRows([
        "000101000",
        "001111100",
        "011121110",
        "011121110",
        "001121100",
        "000121000",
        "000121000",
        "011121110",
        "110121011",
        "000121000",
        "000121000",
        "000111000"
      ])
    },
    {
      id: "daisy", group: "floral", source: "pd", nameKey: "rules.daisy",
      kind: "motif",
      build: () => gen(9, 9, (c, r) => {
        const dx = c - 4;
        const dy = r - 4;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx);
        const petal = 2.2 + 1.5 * Math.abs(Math.cos(4 * ang));
        if (dist <= 1.2) return 2;
        if (dist <= petal) return 1;
        return 0;
      })
    },
    {
      id: "clover", group: "floral", source: "pd", nameKey: "rules.clover",
      kind: "motif",
      build: () => gen(11, 11, (c, r) => {
        if (c === 5 && r === 6) return 2;
        const lobes = [[5, 3.2], [2.9, 6.6], [7.1, 6.6]];
        for (let i = 0; i < 3; i++) {
          const dx = c - lobes[i][0];
          const dy = r - lobes[i][1];
          if (dx * dx + dy * dy <= 4.6) return 1;
        }
        if (c === 5 && r >= 8 && r <= 10) return 1;
        return 0;
      })
    },
    {
      id: "scallopBand", group: "band", source: "pd", nameKey: "rules.scallopBand",
      kind: "motif",
      build: () => gen(16, 6, (c, r) => {
        const x = c % 8;
        const dx = x - 3.5;
        const dy = r - 5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - 4) < 0.7) return 1;
        if (r === 3 && (x === 3 || x === 4)) return 2;
        return 0;
      })
    },
    {
      id: "pearlBand", group: "band", source: "pd", nameKey: "rules.pearlBand",
      kind: "motif",
      build: () => gen(16, 6, (c, r) => {
        if (r === 0 || r === 5) return 1;
        const x = c % 8;
        if ((r === 2 || r === 3) && (x === 2 || x === 3)) return 2;
        if ((r === 2 || r === 3) && (x === 6 || x === 7)) return 1;
        return 0;
      })
    },
    {
      id: "camo", group: "runway", source: "algo", nameKey: "rules.camo",
      kind: "motif",
      build: () => gen(16, 16, (c, r) => {
        const v = Math.sin(c * 0.7) * Math.cos(r * 0.6) + Math.sin((c + r) * 0.45) * 0.8 + Math.sin(c * 0.3 - r * 0.5) * 0.6;
        if (v > 0.9) return 1;
        if (v < -0.7) return 2;
        return 0;
      })
    },
    {
      id: "colorBlock", group: "runway", source: "algo", nameKey: "rules.colorBlock",
      kind: "motif",
      build: () => gen(16, 16, (c, r) => {
        if (r < 6 && c < 9) return 1;
        if (r < 4) return 2;
        if (r < 10 && c < 5) return 2;
        if (r < 10) return 1;
        if (c < 11) return 1;
        return 2;
      })
    },
    {
      id: "checkerBig", group: "runway", source: "algo", nameKey: "rules.checkerBig",
      kind: "motif",
      build: () => gen(16, 16, (c, r) => {
        const bx = Math.floor(c / 4);
        const by = Math.floor(r / 4);
        const s = bx + by;
        if (s % 2) return 1;
        if (s % 4 === 0) return 2;
        return 0;
      })
    },
    {
      id: "chainBand", group: "runway", source: "algo", nameKey: "rules.chainBand",
      kind: "motif",
      build: () => gen(16, 8, (c, r) => {
        const x = c % 8;
        const d = Math.pow((x - 3.5) / 4.0, 2) + Math.pow((r - 3.5) / 3.2, 2);
        if (d >= 0.55 && d <= 1.15) return (x < 1 || x > 6) ? 2 : 1;
        return 0;
      })
    },
    {
      id: "y2kStar", group: "street", source: "algo", nameKey: "rules.y2kStar",
      kind: "motif",
      build: () => gen(9, 9, (c, r) => {
        const dx = Math.abs(c - 4);
        const dy = Math.abs(r - 4);
        const t = Math.pow(dx, 0.6) + Math.pow(dy, 0.6);
        if (t <= 1.2) return 2;
        if (t <= Math.pow(4, 0.6) + 0.01) return 1;
        return 0;
      })
    },
    {
      id: "smiley", group: "street", source: "algo", nameKey: "rules.smiley",
      kind: "motif",
      build: () => gen(11, 11, (c, r) => {
        const dx = c - 5;
        const dy = r - 5;
        const d2 = dx * dx + dy * dy;
        if ((c === 3 || c === 7) && r === 4) return 2;
        if (r === 6 && (c === 2 || c === 3 || c === 7 || c === 8)) return 1;
        if (r === 7 && c >= 4 && c <= 6) return 1;
        if (d2 >= 19 && d2 <= 30) return 1;
        return 0;
      })
    },
    {
      id: "butterfly", group: "street", source: "algo", nameKey: "rules.butterfly",
      kind: "motif",
      build: () => parseRows([
        "0001000001000",
        "0011001001100",
        "0111101011110",
        "1111111111111",
        "1111121211111",
        "0111111111110",
        "0011111111100",
        "0001111111000",
        "0000111110000"
      ])
    },
    {
      id: "lightning", group: "street", source: "algo", nameKey: "rules.lightning",
      kind: "motif",
      build: () => parseRows([
        "0000010",
        "0000110",
        "0001100",
        "0011000",
        "0111110",
        "0000110",
        "0001100",
        "0011000",
        "0110000",
        "1100000"
      ])
    },
    {
      id: "dog", group: "animal", source: "algo", nameKey: "rules.dog",
      kind: "motif",
      build: () => parseRows([
        "..1111111..",
        "11.11111.11",
        "11.11111.11",
        "11.12121.11",
        "11.11111.11",
        "11.11211.11",
        "11.11111.11",
        "11.12221.11",
        "...11211...",
        "...11111...",
        ".111111111.",
        ".111111111.",
        ".11.....11.",
        ".11.111.11."
      ])
    },
    {
      id: "rabbit", group: "animal", source: "algo", nameKey: "rules.rabbit",
      kind: "motif",
      build: () => parseRows([
        ".11...11.",
        ".12...21.",
        ".12...21.",
        ".12...21.",
        ".11...11.",
        "111111111",
        "112111211",
        "111121111",
        "111212111",
        ".1111111.",
        ".1111111.",
        "111111111",
        "111101111"
      ])
    },
    {
      id: "panda", group: "animal", source: "algo", nameKey: "rules.panda",
      kind: "motif",
      build: () => parseRows([
        ".11.....11.",
        ".11.....11.",
        "..1111111..",
        ".111...111.",
        ".112...211.",
        ".1..121..1.",
        ".1.......1.",
        "..1111111..",
        ".111111111.",
        ".110000011.",
        ".110000011.",
        "..1100011..",
        "..1100011.."
      ])
    }
  ];

  const byId = {};
  defs.forEach((d) => { byId[d.id] = d; });
  const motifCache = {};

  function get(id) { return byId[id]; }
  function defaults(def) {
    const p = {};
    (def.params || []).forEach((s) => { p[s.key] = s.def; });
    return p;
  }

  function motif(def) {
    if (!motifCache[def.id]) motifCache[def.id] = def.build();
    return motifCache[def.id];
  }

  function roleAt(def, p, c, r, cols) {
    if (def.kind === "motif" || def.kind === "stitch") {
      const m = motif(def);
      const mc = ((c % m.w) + m.w) % m.w;
      const mr = ((r % m.h) + m.h) % m.h;
      return m.m[mc + mr * m.w];
    }
    return def.roleFn(p, c, r, cols);
  }

  function apply(id, params, mode) {
    const def = byId[id];
    if (!def) return false;
    const ch = Chart.state;
    const acc = accent(ch);
    const p = params || defaults(def);

    if (def.kind === "stitch") {
      const m = motif(def);
      const before = Chart.snapshot();
      let changed = false;
      if (mode === "insert") {
        const sel = Editor.getSel();
        const c0 = sel ? sel.c0 + Math.floor((sel.c1 - sel.c0 + 1 - m.w) / 2) : Math.floor((ch.cols - m.w) / 2);
        const r0 = sel ? sel.r0 + Math.floor((sel.r1 - sel.r0 + 1 - m.h) / 2) : Math.floor((ch.rows - m.h) / 2);
        for (let r = 0; r < m.h; r++) {
          for (let c = 0; c < m.w; c++) {
            const x = c0 + c, y = r0 + r;
            if (Chart.setStitch(x, y, m.m[c + r * m.w])) changed = true;
          }
        }
      } else {
        for (let r = 0; r < ch.rows; r++) {
          for (let c = 0; c < ch.cols; c++) {
            const mc = ((c % m.w) + m.w) % m.w;
            const mr = ((r % m.h) + m.h) % m.h;
            if (Chart.setStitch(c, r, m.m[mc + mr * m.w])) changed = true;
          }
        }
      }
      if (changed) {
        Chart.pushUndo("stitch:" + id, before);
        Chart.emit("change", { type: "stitches" });
      }
      return true;
    }

    if (mode === "insert") {
      if (def.kind !== "motif") return false;
      const m = motif(def);
      const sel = Editor.getSel();
      const c0 = sel ? sel.c0 + Math.floor((sel.c1 - sel.c0 + 1 - m.w) / 2) : Math.floor((ch.cols - m.w) / 2);
      const r0 = sel ? sel.r0 + Math.floor((sel.r1 - sel.r0 + 1 - m.h) / 2) : Math.floor((ch.rows - m.h) / 2);
      Chart.beginStroke("rule:" + id);
      for (let r = 0; r < m.h; r++) {
        for (let c = 0; c < m.w; c++) {
          const v = m.m[c + r * m.w];
          if (!v) continue;
          const x = c0 + c, y = r0 + r;
          if (!Chart.inBounds(x, y)) continue;
          Chart.setCell(x, y, v === 2 ? acc : ch.fg);
        }
      }
      Chart.endStroke();
      return true;
    }

    Chart.beginStroke("rule:" + id);
    for (let r = 0; r < ch.rows; r++) {
      for (let c = 0; c < ch.cols; c++) {
        const v = roleAt(def, p, c, r, ch.cols);
        ch.cells[c + r * ch.cols] = v === 2 ? acc : v === 1 ? ch.fg : ch.bg;
      }
    }
    Chart.endStroke();
    return true;
  }

  return { defs, get, defaults, roleAt, apply, accent };
})();
