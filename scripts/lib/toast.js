/**
 * Shared toast notification utility.
 * Displays a transient popup message at the top-right of the viewport.
 *
 * @param {string} message - The text content of the toast.
 * @param {'info'|'error'|'success'|'warning'} [type='info'] - Visual variant.
 * @param {number} [duration=3500] - Auto-dismiss delay in milliseconds.
 */
export function showToast(message, type = 'info', duration = 3500) {
  // Ensure the toast container exists (singleton)
  let container = document.getElementById('site-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'site-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `site-toast site-toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;

  // Close button for keyboard / screen-reader accessibility
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'site-toast__close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => dismiss(toast));
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Trigger enter animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('site-toast--visible'));
  });

  // Auto-dismiss
  const timer = setTimeout(() => dismiss(toast), duration);

  // Allow early dismiss via close button (clear timer to avoid double-removal)
  closeBtn.addEventListener('click', () => clearTimeout(timer), { once: true });
}

function dismiss(toast) {
  toast.classList.remove('site-toast--visible');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}
