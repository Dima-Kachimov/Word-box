// Інструменти гравця: пензлі, що змінюють рельєф/погоду/вогонь (applyTool),
// та диспетчер "пострілових" інструментів (блискавка/метеор/тварина/огляд).

import { rnd } from '../world/noise';
import { world } from '../world/state';
import { SUB, SEA, C_NONE, C_TREE, C_FIRE, C_BURNT, C_ICE, C_LAVA, C_BASALT } from '../world/constants';
import { isVeg, setH } from '../world/generate';
import { SFX } from '../audio/sfx';
import { cool } from '../util/cooldown';
import { rainAt, snowAt, emberAt, steamAt } from './particles';
import { strike, launchMeteor, spawnTornado } from './events';
import { spawnStorm } from './clouds';
import { toTile, type Point } from '../render/camera';
import { markDirty } from '../render/buffer';
import { SPECIES } from '../creatures/species';
import { spawnFromTool, pickAnimal, creatureState } from '../creatures/animal';
import { pickCiv, playerSpawnRace, playerWar, playerPeace } from '../civ/actions';
import { civState } from '../civ/state';
import type { RaceId } from '../civ/races';
import { showToast } from '../ui/toast';

export type ToolId = string;

const ONESHOT: Record<string, number> = {
  bolt: 180, meteor: 380, cloud: 700, tornado: 1500, inspect: 250,
  race0: 900, race1: 900, race2: 900, race3: 900, war: 900, peace: 900
};

/** Скільки мс має пройти між "пострілами" цього інструмента (0 = це пензель, а не постріл). */
export function shotCd(t: ToolId): number {
  return ONESHOT[t] || (SPECIES[t] ? 260 : 0);
}

export function applyTool(tool: ToolId, brushR: number, fx: number, fy: number): void {
  const cx = Math.floor(fx), cy = Math.floor(fy), Rb = brushR;
  for (let dy = -Rb; dy <= Rb; dy++) for (let dx = -Rb; dx <= Rb; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > Rb + 0.3) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= world.W || y >= world.H) continue;
    const i = y * world.W + x, h = world.hgt[i], c = world.cover[i], fall = 1 - d / (Rb + 1);
    switch (tool) {
      case 'raise': setH(i, h + 0.014 * fall); break;
      case 'lower': setH(i, h - 0.014 * fall); break;
      case 'fire':
        if (isVeg(h) && world.wet[i] === 0) {
          world.snow[i] = 0;
          if (c === C_TREE) { world.cover[i] = C_FIRE; world.timer[i] = 28 + ((rnd() * 16) | 0); }
          else if (c === C_NONE && rnd() < 0.35) { world.cover[i] = C_FIRE; world.timer[i] = 10 + ((rnd() * 8) | 0); }
        }
        break;
      case 'rain':
        if (c === C_FIRE) { world.cover[i] = C_BURNT; world.timer[i] = 60 + ((rnd() * 60) | 0); }
        if (c === C_LAVA) { world.timer[i] -= 4; if (rnd() < 0.1) steamAt(x * SUB + 2, y * SUB); }
        if (h >= SEA) world.wet[i] = 120;
        if (world.snow[i] > 0) world.snow[i] = Math.max(0, world.snow[i] - 20);
        break;
      case 'snow':
        if (h < SEA) { if (c !== C_ICE) { world.cover[i] = C_ICE; world.timer[i] = 350 + ((rnd() * 250) | 0); } }
        else {
          if (c === C_FIRE) { world.cover[i] = C_BURNT; world.timer[i] = 60; }
          if (c === C_LAVA) { world.cover[i] = C_BASALT; world.timer[i] = 900; steamAt(x * SUB + 2, y * SUB); }
          else world.snow[i] = Math.min(900, world.snow[i] + 60 * fall);
        }
        break;
      case 'lava':
        if (rnd() < 0.3 * fall) {
          if (h >= SEA) { world.cover[i] = C_LAVA; world.timer[i] = 40 + ((rnd() * 20) | 0); world.snow[i] = 0; }
          else { setH(i, SEA + 0.012); world.cover[i] = C_BASALT; world.timer[i] = 900; steamAt(x * SUB + 2, y * SUB); }
        }
        break;
      case 'tree':
        if (isVeg(h)) {
          if (c === C_BURNT || c === C_BASALT) world.cover[i] = C_NONE;
          else if (c === C_NONE && rnd() < 0.18) world.cover[i] = C_TREE;
        }
        break;
      case 'clear': world.cover[i] = C_NONE; world.snow[i] = 0; world.wet[i] = 0; world.bld[i] = 0; break;
    }
  }
  const spread = () => ({ x: (fx + (rnd() * 2 - 1) * Rb) * SUB, y: (fy + (rnd() * 2 - 1) * Rb) * SUB });
  if (tool === 'rain') for (let k = 0; k < 5; k++) { const s = spread(); rainAt(s.x, s.y); }
  if (tool === 'snow') for (let k = 0; k < 3; k++) { const s = spread(); snowAt(s.x, s.y); }
  if (tool === 'lava') for (let k = 0; k < 2; k++) { const s = spread(); emberAt(s.x, s.y); }
  if (tool === 'fire') { const s = spread(); emberAt(s.x, s.y); if (cool('tfire', 110)) SFX.crackle(0.12); }
  if ((tool === 'raise' || tool === 'lower') && cool('earth', 260)) SFX.rumble();
  if (tool === 'lava' && cool('tlava', 280)) SFX.blup();
  markDirty();
}

export function paintAt(tool: ToolId, brushR: number, p: Point): void {
  const t = toTile(p);
  applyTool(tool, brushR, t.x, t.y);
}

export function paintLine(tool: ToolId, brushR: number, a: Point, b: Point): void {
  const ta = toTile(a), tb = toTile(b);
  const steps = Math.max(1, Math.ceil(Math.hypot(tb.x - ta.x, tb.y - ta.y) / 1.5));
  for (let s = 1; s <= steps; s++) applyTool(tool, brushR, ta.x + (tb.x - ta.x) * s / steps, ta.y + (tb.y - ta.y) * s / steps);
}

export function shootAt(tool: ToolId, p: Point): void {
  const t = toTile(p);
  if (tool !== 'inspect' && (t.x < 0 || t.y < 0 || t.x >= world.W || t.y >= world.H)) return;
  if (tool === 'inspect') {
    if (pickCiv(t.x, t.y)) { creatureState.selected = null; SFX.click(); }
    else { civState.selUnit = null; civState.selCity = null; pickAnimal(p); }
    return;
  }
  if (tool.startsWith('race')) { showToast(playerSpawnRace(+tool[4] as RaceId, t.x, t.y), 2200); SFX.pop(); return; }
  if (tool === 'war') { showToast(playerWar(t.x, t.y), 2200); return; }
  if (tool === 'peace') { showToast(playerPeace(t.x, t.y), 2200); return; }
  if (SPECIES[tool]) spawnFromTool(tool, t.x, t.y);
  else if (tool === 'bolt') strike(t.x, t.y, false);
  else if (tool === 'meteor') launchMeteor(t.x, t.y);
  else if (tool === 'cloud') spawnStorm(t.x, t.y);
  else if (tool === 'tornado') spawnTornado(t.x, t.y);
}
