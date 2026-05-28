import { useCallback, useRef, useState } from 'react';
import { isSameEntity } from '../../utils/rpg3dMapEditing.js';

export default function useRpg3DSelectionState({
  canMultiSelectEntity,
  setIsPaused,
  setMode,
  setTool,
}) {
  const [multiSelected, setMultiSelected] = useState([]);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(selected);

  selectedRef.current = selected;

  const selectSingleEntity = useCallback((entity) => {
    setSelected(entity);
    setMultiSelected(entity && canMultiSelectEntity(entity) ? [entity] : []);
  }, [canMultiSelectEntity]);

  const toggleMultiSelectedEntity = useCallback((entity) => {
    if (!canMultiSelectEntity(entity)) {
      setSelected(entity || null);
      setMultiSelected([]);
      return;
    }
    setTool('select');
    setMultiSelected((current) => {
      const exists = current.some((entry) => isSameEntity(entry, entity));
      if (exists) {
        const next = current.filter((entry) => !isSameEntity(entry, entity));
        const fallback = next[next.length - 1] || entity;
        setSelected(fallback);
        return next.length ? next : [entity];
      }
      setSelected(entity);
      return [...current, entity];
    });
  }, [canMultiSelectEntity, setTool]);

  const handleMarqueeSelect = useCallback((entities = []) => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    const seen = new Set();
    const nextSelection = entities
      .filter(canMultiSelectEntity)
      .filter((entity) => {
        const key = `${entity.type}:${entity.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    setMultiSelected(nextSelection);
    setSelected(nextSelection[nextSelection.length - 1] || null);
  }, [canMultiSelectEntity, setIsPaused, setMode, setTool]);

  return {
    handleMarqueeSelect,
    multiSelected,
    selectSingleEntity,
    selected,
    selectedRef,
    setMultiSelected,
    setSelected,
    toggleMultiSelectedEntity,
  };
}
