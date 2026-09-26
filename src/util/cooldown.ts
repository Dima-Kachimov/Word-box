// Простий cooldown-реєстр за ключем — використовується скрізь (звук, тули,
// тости), тому винесений в один нейтральний модуль без залежностей.

const sfxCd: Record<string, number> = {};

export function cool(key: string, ms: number): boolean {
  const now = performance.now();
  if ((sfxCd[key] || 0) > now) return false;
  sfxCd[key] = now + ms;
  return true;
}
