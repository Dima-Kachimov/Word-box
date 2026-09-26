// Обробка вказівника: малювання пензлем, "постріл" одноразовим інструментом,
// панорамування однією рукою/кнопкою, pinch-zoom двома пальцями, колесо миші.

import { clamp } from '../world/noise';
import { camera, clampCam, zoomAt, type Point } from '../render/camera';
import { uiState } from './state';
import { shotCd, paintAt, paintLine, shootAt } from '../sim/tools';

type PointerMode = 'idle' | 'paint' | 'pan' | 'pinch';

const ptrs = new Map<number, Point>();
let mode: PointerMode = 'idle';
let pinch: { d: number; z: number; m: Point; cx: number; cy: number } | null = null;
let lastPos: Point | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let lastHold = 0;

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function devPos(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }): Point {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * camera.dpr, y: (e.clientY - r.top) * camera.dpr };
}

function startPainting(p: Point): void {
  uiState.painting = true; uiState.cursor = p;
  if (shotCd(uiState.tool)) { shootAt(uiState.tool, p); uiState.lastShot = performance.now(); }
  else paintAt(uiState.tool, uiState.brushR, p);
}

export function initInput(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('pointerdown', e => {
    const p = devPos(canvas, e);
    ptrs.set(e.pointerId, p);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* деякі браузери на touch кидають тут — ігноруємо */ }
    if (ptrs.size === 2) {
      if (pendingTimer) clearTimeout(pendingTimer);
      uiState.painting = false; uiState.cursor = null;
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.max(10, dist(a, b)), z: camera.zoom, m: mid(a, b), cx: camera.camX, cy: camera.camY };
      mode = 'pinch';
      return;
    }
    if (ptrs.size > 2) return;
    lastPos = p;
    if (uiState.panMode || e.button === 1 || e.button === 2) { mode = 'pan'; return; }
    mode = 'paint';
    if (e.pointerType === 'mouse') startPainting(p);
    else pendingTimer = setTimeout(() => { if (mode === 'paint' && lastPos) startPainting(lastPos); }, 80);
  });

  canvas.addEventListener('pointermove', e => {
    const p = devPos(canvas, e);
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') uiState.cursor = p; return; }
    ptrs.set(e.pointerId, p);
    if (mode === 'pinch' && ptrs.size >= 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const m = mid(a, b);
      const nz = clamp(pinch.z * dist(a, b) / pinch.d, camera.minZoom, camera.maxZoom);
      const wx0 = (pinch.m.x - pinch.cx) / pinch.z, wy0 = (pinch.m.y - pinch.cy) / pinch.z;
      camera.zoom = nz; camera.camX = m.x - wx0 * camera.zoom; camera.camY = m.y - wy0 * camera.zoom; clampCam();
    } else if (mode === 'pan' && lastPos) {
      camera.camX += p.x - lastPos.x; camera.camY += p.y - lastPos.y; lastPos = p; clampCam();
    } else if (mode === 'paint') {
      if (uiState.painting && lastPos) {
        if (!shotCd(uiState.tool)) paintLine(uiState.tool, uiState.brushR, lastPos, p);
        uiState.cursor = p;
      }
      lastPos = p;
    }
  });

  const endPtr = (e: PointerEvent): void => {
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0) {
      if (pendingTimer) clearTimeout(pendingTimer);
      mode = 'idle'; uiState.painting = false;
      if (e.pointerType !== 'mouse') uiState.cursor = null;
    } else if (mode === 'pinch') mode = 'idle';
  };
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) uiState.cursor = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const p = devPos(canvas, e);
    zoomAt(p.x, p.y, camera.zoom * Math.pow(1.0015, -e.deltaY));
  }, { passive: false });
}

/** Продовжує малювання/стрільбу поки палець/кнопка утримується — викликається щокадру з main.ts. */
export function continuousPaint(ts: number): void {
  if (!(uiState.painting && mode === 'paint' && lastPos)) return;
  const cd = shotCd(uiState.tool);
  if (cd) {
    if (ts - uiState.lastShot > cd) { uiState.lastShot = ts; shootAt(uiState.tool, lastPos); }
  } else if (ts - lastHold > 70) {
    lastHold = ts; paintAt(uiState.tool, uiState.brushR, lastPos);
  }
}
