import { useCallback, useEffect } from 'react';

export default function useUnsavedChangesGuard({
  isDirty,
  confirm,
  title = 'Незапазени промени',
  message = 'Имаш незапазени промени. Сигурен ли си, че искаш да излезеш?',
  confirmLabel = 'Излез без запис',
  cancelLabel = 'Остани',
  variant = 'warning',
}) {
  useEffect(() => {
    if (!isDirty) return undefined;

    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const confirmDiscardChanges = useCallback(async () => {
    if (!isDirty) return true;
    if (typeof confirm !== 'function') return false;

    return confirm({
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant,
    });
  }, [cancelLabel, confirm, confirmLabel, isDirty, message, title, variant]);

  return { confirmDiscardChanges };
}
