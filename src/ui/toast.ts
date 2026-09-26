// Спливаюча підказка вгорі екрана. Навмисно без залежностей від інших
// доменів, щоб будь-який модуль (тули, тварини, збереження) міг показати
// повідомлення користувачу без ризику циклічних імпортів.

let toastEl: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function initToast(el: HTMLElement): void {
  toastEl = el;
}

export function showToast(text: string, ms: number): void {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (toastEl) toastEl.style.opacity = '0'; }, ms);
}
