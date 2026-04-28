import React, { useState } from 'react';

export default function SceneCanvas({ scene, onUpdate }) {
  const [dragging, setDragging] = useState(null);

  const objects = scene.sceneObjects || scene.objects || [];

  const handleMouseDown = (e, obj) => {
    e.stopPropagation();
    setDragging(obj.id);
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const updated = objects.map((obj) =>
      obj.id === dragging ? { ...obj, x, y } : obj
    );

    onUpdate({ ...scene, sceneObjects: updated });
  };

  const handleMouseUp = () => setDragging(null);

  return (
    <div
      className="canvas-wrapper"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ position: 'relative' }}
    >
      {scene.backgroundData ? <img src={scene.backgroundData} alt="" /> : null}

      {objects.map((obj) => (
        <div
          key={obj.id}
          className="hotspot scene-object-visual"
          style={{
            top: `${obj.y}%`,
            left: `${obj.x}%`,
            width: `${obj.width || 12}%`,
            height: `${obj.height || 12}%`,
            position: 'absolute',
            transform: 'translate(-50%, -50%)',
            backgroundImage: obj.imageData ? `url(${obj.imageData})` : undefined,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
          onMouseDown={(e) => handleMouseDown(e, obj)}
        >
          {obj.name}
        </div>
      ))}
    </div>
  );
}
