// 8×8 піксель-іконки для кнопок інструментів і вкладок (окремі від спрайтів
// тварин, які використовують getSpeciesIcon()).

export interface IconDef {
  rows: string[];
  pal: Record<string, string>;
}

export const ICONS: Record<string, IconDef> = {
  tabLand: { rows: ['........', '....w...', '...wsw..', '..wssss.', '.gssssss', 'ggsssggg', 'gggggggg', '........'], pal: { w: '#eef3f7', s: '#8a8a90', g: '#5cb84a' } },
  fire: { rows: ['...y....', '..yy..y.', '..yoy.y.', '.yoooyy.', '.oorooy.', 'yorrroo.', '.orrro..', '..ooo...'], pal: { y: '#ffe45c', o: '#ff8a1e', r: '#d8361c' } },
  rain: { rows: ['...b....', '...b....', '..bbb...', '.bbbbb..', '.blbbb..', '.bbbbb..', '..bbb...', '........'], pal: { b: '#4aa8ff', l: '#cfe9ff' } },
  snow: { rows: ['...w....', '.w.w.w..', '..www...', 'wwwcwww.', '..www...', '.w.w.w..', '...w....', '........'], pal: { w: '#dff4ff', c: '#7fd0ff' } },
  cloud: { rows: ['...gg...', '.gglgg..', 'glllllgg', 'gggggggg', '.dddddd.', '..y..b..', '.y..b...', '........'], pal: { g: '#aab4bf', l: '#e6ebf0', d: '#6b7480', y: '#ffe45c', b: '#5ab0ff' } },
  bolt: { rows: ['....yy..', '...yy...', '..yy....', '.yyyyy..', '...yy...', '..yy....', '.yy.....', '.y......'], pal: { y: '#ffe45c' } },
  tornado: { rows: ['wwwwwwww', '.gwwwwg.', '..wwww..', '..gwwg..', '...ww...', '...gw...', '....w...', '...gg...'], pal: { w: '#e4e8ec', g: '#9aa4ae' } },
  lava: { rows: ['........', '...rr...', '..royr..', '.rooyor.', 'roooyoor', 'rroooorr', 'ddrrrrdd', 'dddddddd'], pal: { r: '#d8361c', o: '#ff8a1e', y: '#ffe45c', d: '#3a2a26' } },
  meteor: { rows: ['y.......', '.o......', '..oo....', '...orr..', '...rddd.', '....dgdd', '....dddd', '.....dd.'], pal: { y: '#ffe45c', o: '#ff8a1e', r: '#d8361c', d: '#5a4a44', g: '#8a7a70' } },
  lower: { rows: ['...r....', '...r....', '.rrrrr..', '..rrr...', '...r....', '........', 'bbbbbbbb', 'lblbblbb'], pal: { r: '#ff5a3c', b: '#2e74d0', l: '#7fc0ff' } },
  raise: { rows: ['...g....', '..ggg...', '.ggggg..', '...g....', '...w....', '..wss...', '.wssss..', 'wsssssss'], pal: { g: '#7cff5a', w: '#eef3f7', s: '#8a8a90' } },
  tree: { rows: ['..lll...', '.lmmml..', 'lmmmmmd.', 'lmmmmdd.', '.mmmdd..', '...t....', '...t....', '..ttt...'], pal: { l: '#7cd35a', m: '#3e9a3e', d: '#22662e', t: '#7a4e2a' } },
  inspect: { rows: ['.www....', 'w...w...', 'w...w...', 'w...w...', '.www....', '....bb..', '.....bb.', '......bb'], pal: { w: '#e8f0ff', b: '#c8a060' } },
  clear: { rows: ['r......r', '.r....r.', '..r..r..', '...rr...', '...rr...', '..r..r..', '.r....r.', 'r......r'], pal: { r: '#ff5a3c' } }
};

export function iconCanvas(ic: IconDef): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const g = c.getContext('2d')!;
  ic.rows.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
      const ch = row[x];
      if (ch && ch !== '.') { g.fillStyle = ic.pal[ch]; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}
