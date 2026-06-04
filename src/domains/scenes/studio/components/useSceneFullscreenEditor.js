import { useEffect, useState } from 'react';
import {
  clampFullscreenZoom,
  clampPercent,
} from '../../../../shared/services/sceneRender.js';

export function useSceneFullscreenEditor({
  fullscreenViewportRef,
  fullscreenCanvasRef,
}) {
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isPanningFullscreen, setIsPanningFullscreen] = useState(false);
  const [fullscreenPanStart, setFullscreenPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [minimapViewport, setMinimapViewport] = useState({ x: 0, y: 0, width: 100, height: 100 });

  useEffect(() => {
    if (!isEditorFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditorFullscreen]);

  useEffect(() => {
    const handleNativeFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsEditorFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleNativeFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleNativeFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isEditorFullscreen) return undefined;

    const updateMinimapViewport = () => {
      const viewport = fullscreenViewportRef.current;
      const stage = fullscreenCanvasRef.current;
      if (!viewport || !stage) return;
      const viewportRect = viewport.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      if (!viewportRect.width || !viewportRect.height || !stageRect.width || !stageRect.height) return;

      const left = clampPercent(((viewportRect.left - stageRect.left) / stageRect.width) * 100);
      const top = clampPercent(((viewportRect.top - stageRect.top) / stageRect.height) * 100);
      const right = clampPercent(((viewportRect.right - stageRect.left) / stageRect.width) * 100);
      const bottom = clampPercent(((viewportRect.bottom - stageRect.top) / stageRect.height) * 100);
      setMinimapViewport({
        x: left,
        y: top,
        width: Math.max(4, right - left),
        height: Math.max(4, bottom - top),
      });
    };

    const frame = requestAnimationFrame(updateMinimapViewport);
    window.addEventListener('resize', updateMinimapViewport);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateMinimapViewport);
    };
  }, [isEditorFullscreen, fullscreenZoom, fullscreenPan, fullscreenViewportRef, fullscreenCanvasRef]);

  const resetFullscreenView = () => {
    setFullscreenZoom(1);
    setFullscreenPan({ x: 0, y: 0 });
  };

  const clampFullscreenPan = (pan, zoom = fullscreenZoom) => {
    const viewport = fullscreenViewportRef.current;
    const stage = fullscreenCanvasRef.current;
    if (!viewport || !stage) return pan;

    const viewportRect = viewport.getBoundingClientRect();
    const stageWidth = stage.offsetWidth || 0;
    const stageHeight = stage.offsetHeight || 0;
    if (!viewportRect.width || !viewportRect.height || !stageWidth || !stageHeight) return pan;

    const scaledWidth = stageWidth * zoom;
    const scaledHeight = stageHeight * zoom;
    const maxX = Math.max(0, (scaledWidth - viewportRect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - viewportRect.height) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, pan.x)),
      y: Math.max(-maxY, Math.min(maxY, pan.y)),
    };
  };

  const setClampedFullscreenZoom = (updater) => {
    setFullscreenZoom((previous) => {
      const requested = typeof updater === 'function' ? updater(previous) : updater;
      const nextZoom = clampFullscreenZoom(requested);
      setFullscreenPan((pan) => clampFullscreenPan(pan, nextZoom));
      return nextZoom;
    });
  };

  const enterEditorFullscreen = () => {
    setIsEditorFullscreen(true);
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root.requestFullscreen().catch(() => {
      // The in-app fullscreen overlay still works if the browser refuses native fullscreen.
    });
  };

  const closeEditorFullscreen = () => {
    setIsEditorFullscreen(false);
    if (!document.fullscreenElement || !document.exitFullscreen) return;
    document.exitFullscreen().catch(() => {});
  };

  const handleFullscreenWheel = (event) => {
    if (!isEditorFullscreen) return;
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setClampedFullscreenZoom((previous) => previous + delta);
  };

  const beginFullscreenPan = (event) => {
    if (!isEditorFullscreen) return;
    const isViewportBackground = event.target === event.currentTarget;
    const isSceneCanvas = fullscreenCanvasRef.current?.contains(event.target);
    const isInteractiveSceneElement = event.target?.closest?.('.editor-hotspot, button, input, select, textarea, a');
    const canPanZoomedScene = fullscreenZoom > 1 && isSceneCanvas && !isInteractiveSceneElement;
    if (event.button !== 1 && !event.altKey && !isViewportBackground && !canPanZoomedScene) return;
    event.preventDefault();
    setIsPanningFullscreen(true);
    setFullscreenPanStart({
      x: event.clientX,
      y: event.clientY,
      panX: fullscreenPan.x,
      panY: fullscreenPan.y,
    });
  };

  const moveFullscreenPan = (event) => {
    if (!isPanningFullscreen) return;
    event.preventDefault();
    setFullscreenPan(clampFullscreenPan({
      x: fullscreenPanStart.panX + event.clientX - fullscreenPanStart.x,
      y: fullscreenPanStart.panY + event.clientY - fullscreenPanStart.y,
    }));
  };

  const stopFullscreenPan = () => {
    setIsPanningFullscreen(false);
  };

  return {
    isEditorFullscreen,
    fullscreenZoom,
    fullscreenPan,
    minimapViewport,
    isPanningFullscreen,
    setClampedFullscreenZoom,
    enterEditorFullscreen,
    closeEditorFullscreen,
    resetFullscreenView,
    handleFullscreenWheel,
    beginFullscreenPan,
    moveFullscreenPan,
    stopFullscreenPan,
  };
}
