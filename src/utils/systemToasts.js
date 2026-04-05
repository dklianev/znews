function removeExistingToast(className) {
  if (typeof document === 'undefined') return;
  const existingToast = document.querySelector(`.${className}`);
  if (!existingToast) return;
  if (typeof existingToast.__removeSystemToast === 'function') {
    existingToast.__removeSystemToast();
    return;
  }
  existingToast.remove();
}

export function showSystemToast({
  className,
  message,
  actionLabel = '',
  onAction = null,
  dismissLabel = 'Затвори',
  autoActionMs = 0,
  showDismiss = true,
}) {
  if (typeof document === 'undefined') return null;

  removeExistingToast(className);

  const toast = document.createElement('div');
  toast.className = className;

  let autoActionTimer = null;

  const clearAutoActionTimer = () => {
    if (autoActionTimer && typeof window !== 'undefined') {
      window.clearTimeout(autoActionTimer);
      autoActionTimer = null;
    }
  };

  const removeToast = () => {
    clearAutoActionTimer();
    toast.remove();
  };
  toast.__removeSystemToast = removeToast;

  const runAction = () => {
    if (typeof onAction === 'function') onAction();
    removeToast();
  };

  const msg = document.createElement('span');
  msg.textContent = message;
  toast.appendChild(msg);

  if (actionLabel && typeof onAction === 'function') {
    const actionButton = document.createElement('button');
    actionButton.className = 'pwa-refresh-btn';
    actionButton.textContent = actionLabel;
    actionButton.addEventListener('click', runAction);
    toast.appendChild(actionButton);
  }

  if (showDismiss) {
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'pwa-dismiss-btn';
    dismissBtn.textContent = '\u2715';
    dismissBtn.setAttribute('aria-label', dismissLabel);
    dismissBtn.addEventListener('click', removeToast);
    toast.appendChild(dismissBtn);
  }

  document.body.appendChild(toast);

  if (autoActionMs > 0 && typeof onAction === 'function' && typeof window !== 'undefined') {
    autoActionTimer = window.setTimeout(runAction, autoActionMs);
  }

  return toast;
}

export function showPwaUpdateToast(updateFn) {
  return showSystemToast({
    className: 'pwa-update-toast',
    message: 'Има нова версия на сайта.',
    actionLabel: 'Обнови',
    onAction: updateFn,
    dismissLabel: 'Затвори',
  });
}

export function showPwaOfflineToast() {
  return showSystemToast({
    className: 'pwa-offline-toast',
    message: 'Сайтът е готов и за офлайн режим.',
    dismissLabel: 'Затвори',
  });
}

export function showChunkReloadToast(reloadFn) {
  return showSystemToast({
    className: 'pwa-reload-toast',
    message: 'Открихме нова версия на сайта. Обновяваме...',
    actionLabel: 'Обнови сега',
    onAction: reloadFn,
    autoActionMs: 1500,
    showDismiss: false,
  });
}
