import { useEffect } from 'react';

export default function useRpg3DDeleteShortcut({
  configRef,
  deleteSelected,
  getDeletableSelectionEntities,
  isEditableShortcutTarget,
  mode,
  multiSelected,
  selected,
}) {
  useEffect(() => {
    const handleDeleteShortcut = (event) => {
      if (!['Delete', 'Backspace'].includes(event.code)) return;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (mode !== 'edit' || isEditableShortcutTarget(event.target)) return;
      if (!getDeletableSelectionEntities(configRef.current, selected, multiSelected).length) return;
      event.preventDefault();
      deleteSelected();
    };
    window.addEventListener('keydown', handleDeleteShortcut);
    return () => window.removeEventListener('keydown', handleDeleteShortcut);
  }, [
    configRef,
    deleteSelected,
    getDeletableSelectionEntities,
    isEditableShortcutTarget,
    mode,
    multiSelected,
    selected,
  ]);
}
