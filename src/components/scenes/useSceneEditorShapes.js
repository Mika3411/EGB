import React from 'react';
import { HelpLabel } from './SceneEditorChrome.jsx';
import {
  clampPercent,
  getElementShapeCorners,
  getElementShapePoints,
  getElementShapeType,
  makeRegularShapePoints,
} from './sceneEditorUtils.js';

export const getResizeHandleStyle = (entry, handle) => {
  const corners = getElementShapeCorners(entry);
  if (corners[handle]) return { left: `${corners[handle].x}%`, top: `${corners[handle].y}%` };

  const edgeCorners = {
    n: [corners.nw, corners.ne],
    e: [corners.ne, corners.se],
    s: [corners.sw, corners.se],
    w: [corners.nw, corners.sw],
  }[handle];

  return {
    left: `${(edgeCorners[0].x + edgeCorners[1].x) / 2}%`,
    top: `${(edgeCorners[0].y + edgeCorners[1].y) / 2}%`,
  };
};

export function useSceneEditorShapes({
  selectedScene,
  selectedSceneId,
  patchProject,
}) {
  const getEditorElementByType = (scene, type, id) => {
    const collections = {
      hotspot: scene?.hotspots,
      sceneObject: scene?.sceneObjects,
      visualEffectZone: scene?.visualEffectZones,
    };
    return collections[type]?.find((item) => item.id === id) || null;
  };

  const getAbsoluteShapeCorners = (entry) => {
    const corners = getElementShapeCorners(entry);
    const left = Number(entry.x) - Number(entry.width) / 2;
    const top = Number(entry.y) - Number(entry.height) / 2;
    return Object.fromEntries(Object.entries(corners).map(([key, corner]) => ([
      key,
      {
        x: left + (Number(entry.width) * corner.x) / 100,
        y: top + (Number(entry.height) * corner.y) / 100,
      },
    ])));
  };

  const getAbsoluteShapePoints = (entry) => {
    const points = getElementShapePoints(entry);
    const left = Number(entry.x) - Number(entry.width) / 2;
    const top = Number(entry.y) - Number(entry.height) / 2;
    return points.map((point) => ({
      x: left + (Number(entry.width) * point.x) / 100,
      y: top + (Number(entry.height) * point.y) / 100,
    }));
  };

  const applyShapePoints = (entry, absolutePoints) => {
    const xs = absolutePoints.map((point) => point.x);
    const ys = absolutePoints.map((point) => point.y);
    const minSize = 2;
    let left = clampPercent(Math.min(...xs));
    let right = clampPercent(Math.max(...xs));
    let top = clampPercent(Math.min(...ys));
    let bottom = clampPercent(Math.max(...ys));

    if (right - left < minSize) right = Math.min(100, left + minSize);
    if (right - left < minSize) left = Math.max(0, right - minSize);
    if (bottom - top < minSize) bottom = Math.min(100, top + minSize);
    if (bottom - top < minSize) top = Math.max(0, bottom - minSize);

    const width = right - left;
    const height = bottom - top;
    entry.x = Number(((left + right) / 2).toFixed(2));
    entry.y = Number(((top + bottom) / 2).toFixed(2));
    entry.width = Number(width.toFixed(2));
    entry.height = Number(height.toFixed(2));
    entry.shapeType = 'free';
    entry.shapePointCount = absolutePoints.length;
    entry.shapePoints = absolutePoints.map((point) => ({
      x: Number(clampPercent(((point.x - left) / width) * 100).toFixed(2)),
      y: Number(clampPercent(((point.y - top) / height) * 100).toFixed(2)),
    }));
    delete entry.shapeCorners;
  };

  const renderShapeOutline = (entry, isSelected) => {
    if (getElementShapeType(entry) !== 'free') return null;
    const points = getElementShapePoints(entry);
    return React.createElement(
      'svg',
      {
        className: `editor-shape-outline ${isSelected ? 'selected' : ''}`,
        viewBox: '0 0 100 100',
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      },
      React.createElement('polygon', {
        points: points.map((point) => `${point.x},${point.y}`).join(' '),
      }),
    );
  };

  const getShapeClassName = (entry) => `editor-shape-${getElementShapeType(entry)}`;

  const patchEditorElementShape = (type, id, updater) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      const entry = getEditorElementByType(scene, type, id);
      if (entry) updater(entry);
    });
  };

  const setEditorElementShapeType = (type, id, shapeType) => {
    patchEditorElementShape(type, id, (entry) => {
      entry.shapeType = shapeType;
      if (shapeType === 'free') {
        const count = Math.max(3, Number(entry.shapePointCount) || getElementShapePoints(entry).length || 4);
        entry.shapePointCount = count;
        entry.shapePoints = makeRegularShapePoints(count);
        delete entry.shapeCorners;
      } else {
        delete entry.shapePoints;
        delete entry.shapeCorners;
      }
    });
  };

  const setEditorElementShapePointCount = (type, id, count) => {
    const nextCount = Math.max(3, Math.min(16, Math.round(Number(count) || 3)));
    patchEditorElementShape(type, id, (entry) => {
      entry.shapeType = 'free';
      entry.shapePointCount = nextCount;
      entry.shapePoints = makeRegularShapePoints(nextCount);
      delete entry.shapeCorners;
    });
  };

  const renderShapeControls = (type, id) => {
    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry) return null;
    const shapeType = getElementShapeType(entry);
    return React.createElement(
      'div',
      { className: 'shape-editor-controls' },
      React.createElement(
        HelpLabel,
        {
          help: 'Forme de la zone interactive. Rectangle est le comportement classique, ronde devient une ellipse et libre permet de tirer chaque point.',
        },
        'Forme',
      ),
      React.createElement(
        'select',
        {
          value: shapeType,
          onChange: (event) => setEditorElementShapeType(type, id, event.target.value),
        },
        React.createElement('option', { value: 'rectangle' }, 'Rectangle'),
        React.createElement('option', { value: 'ellipse' }, 'Ronde / ovale'),
        React.createElement('option', { value: 'free' }, 'Libre'),
      ),
      shapeType === 'free' ? React.createElement(
        'div',
        null,
        React.createElement(
          HelpLabel,
          {
            help: 'Nombre de points de la forme libre. Minimum 3. Changer ce nombre recrée une forme régulière que tu peux ensuite déformer.',
          },
          "Nombre d'angles",
        ),
        React.createElement('input', {
          type: 'number',
          min: '3',
          max: '16',
          value: Number(entry.shapePointCount) || getElementShapePoints(entry).length,
          onChange: (event) => setEditorElementShapePointCount(type, id, event.target.value),
        }),
      ) : null,
    );
  };

  return {
    getEditorElementByType,
    getAbsoluteShapeCorners,
    getAbsoluteShapePoints,
    applyShapePoints,
    renderShapeOutline,
    getShapeClassName,
    getResizeHandleStyle,
    renderShapeControls,
  };
}
