// Камера: масштаб і зсув переглядового вікна відносно текстурного буфера світу
// (буфер має розмір BW×BH пікселів, canvas — розмір вʼюпорта у фізичних пікселях).

import { world } from '../world/state';
import { clamp } from '../world/noise';
import { SUB } from '../world/constants';
import { view } from './context';

export interface Point { x: number; y: number; }

export const camera = {
  dpr: 1,
  zoom: 1,
  minZoom: 1,
  maxZoom: 10,
  /** Масштаб "вписати весь світ" — використовується як опорний для UI (поріг showEmo тощо). */
  fitZ: 1,
  camX: 0,
  camY: 0
};

export function sizeCanvas(wrap: HTMLElement): void {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  camera.dpr = Math.min(window.devicePixelRatio || 1, 3);
  view.canvas.width = Math.round(w * camera.dpr);
  view.canvas.height = Math.round(h * camera.dpr);
  view.canvas.style.width = w + 'px';
  view.canvas.style.height = h + 'px';
}

export function fitCamera(): void {
  const cw = view.canvas.width, ch = view.canvas.height;
  camera.zoom = Math.max(cw / world.BW, ch / world.BH);
  camera.minZoom = Math.min(cw / world.BW, ch / world.BH) * 0.9;
  camera.maxZoom = Math.max(camera.zoom * 10, 24);
  camera.fitZ = camera.zoom;
  camera.camX = (cw - world.BW * camera.zoom) / 2;
  camera.camY = (ch - world.BH * camera.zoom) / 2;
}

export function clampCam(): void {
  const cw = view.canvas.width, ch = view.canvas.height;
  const mw = world.BW * camera.zoom, mh = world.BH * camera.zoom;
  camera.camX = clamp(camera.camX, Math.min(cw * 0.5 - mw, (cw - mw) / 2), Math.max(cw * 0.5, (cw - mw) / 2));
  camera.camY = clamp(camera.camY, Math.min(ch * 0.5 - mh, (ch - mh) / 2), Math.max(ch * 0.5, (ch - mh) / 2));
}

export function zoomAt(px: number, py: number, nz: number): void {
  nz = clamp(nz, camera.minZoom, camera.maxZoom);
  const wx0 = (px - camera.camX) / camera.zoom, wy0 = (py - camera.camY) / camera.zoom;
  camera.zoom = nz;
  camera.camX = px - wx0 * camera.zoom;
  camera.camY = py - wy0 * camera.zoom;
  clampCam();
}

/** Екранна точка (у фізичних пікселях canvas) → координата клітинки світу (дробова). */
export function toTile(p: Point): Point {
  return { x: (p.x - camera.camX) / camera.zoom / SUB, y: (p.y - camera.camY) / camera.zoom / SUB };
}

/** Чи клітинка (в координатах сітки) потрапляє у видиму область екрана. */
export function visibleTile(x: number, y: number): boolean {
  const sx = camera.camX + x * SUB * camera.zoom, sy = camera.camY + y * SUB * camera.zoom;
  return sx > -20 && sy > -20 && sx < view.canvas.width + 20 && sy < view.canvas.height + 20;
}
