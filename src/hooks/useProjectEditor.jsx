import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initialProject,
  makeAct,
  makeScene,
  makeHotspot,
  makeItem,
  makeCombination,
  makeCinematic,
  makeCinematicSlide,
  makeEnigma,
} from '../data/projectData';
import {
  getActById as selectActById,
  getItemById as selectItemById,
  getSceneById as selectSceneById,
  getSelectedCinematic,
  getSelectedHotspot,
  getSelectedItem,
  getSelectedScene,
} from '../selectors/projectSelectors';
import { buildSceneLabel, collectDescendantSceneIds, getSceneDepth as computeSceneDepth } from '../lib/sceneHelpers';

const makeSceneObject = (index = 0) => ({
  id: `scene_object_${Math.random().toString(36).slice(2, 10)}`,
  name: `Objet visible ${index + 1}`,
  imageData: '',
  imageName: '',
  popupImageData: '',
  popupImageName: '',
  x: 50,
  y: 50,
  width: 12,
  height: 12,
  interactionMode: 'both',
  linkedItemId: '',
  removeAfterUse: true,
  dialogue: '',
});

const ensureSceneObjects = (scene) => {
  if (!scene.sceneObjects) scene.sceneObjects = [];
  return scene.sceneObjects;
};


export function useProjectEditor() {
  const [project, setProject] = useState(initialProject);
  const projectRef = useRef(initialProject);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [tab, setTab] = useState('scenes');
  const [selectedSceneId, setSelectedSceneId] = useState(initialProject.scenes[0]?.id || '');
  const [selectedHotspotId, setSelectedHotspotId] = useState(initialProject.scenes[0]?.hotspots?.[0]?.id || '');
  const [selectedCinematicId, setSelectedCinematicId] = useState(initialProject.cinematics[0]?.id || '');
  const [selectedItemId, setSelectedItemId] = useState(initialProject.items[0]?.id || '');
  const [selectedEnigmaId, setSelectedEnigmaId] = useState(initialProject.enigmas?.[0]?.id || '');
  const [selectedSceneObjectId, setSelectedSceneObjectId] = useState(initialProject.scenes[0]?.sceneObjects?.[0]?.id || '');

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const rememberProjectState = useCallback(() => {
    setUndoStack((previous) => [...previous.slice(-49), structuredClone(projectRef.current)]);
    setRedoStack([]);
  }, []);

  const patchProject = useCallback((updater, options = {}) => {
    if (options.rememberHistory !== false) rememberProjectState();
    setProject((prev) => {
      const next = structuredClone(prev);
      updater(next);
      projectRef.current = next;
      return next;
    });
  }, [rememberProjectState]);

  const undoProjectChange = useCallback(() => {
    setUndoStack((previous) => {
      if (!previous.length) return previous;
      const nextUndoStack = previous.slice(0, -1);
      const previousProject = previous[previous.length - 1];
      const currentProject = structuredClone(projectRef.current);
      setRedoStack((nextRedoStack) => [...nextRedoStack.slice(-49), currentProject]);
      projectRef.current = previousProject;
      setProject(previousProject);
      return nextUndoStack;
    });
  }, []);

  const redoProjectChange = useCallback(() => {
    setRedoStack((previous) => {
      if (!previous.length) return previous;
      const nextRedoStack = previous.slice(0, -1);
      const nextProject = previous[previous.length - 1];
      const currentProject = structuredClone(projectRef.current);
      setUndoStack((nextUndoStack) => [...nextUndoStack.slice(-49), currentProject]);
      projectRef.current = nextProject;
      setProject(nextProject);
      return nextRedoStack;
    });
  }, []);

  const getActById = useCallback((id) => selectActById(project, id), [project]);
  const getSceneById = useCallback((id) => selectSceneById(project, id), [project]);
  const getItemById = useCallback((id) => selectItemById(project, id), [project]);

  const selectedScene = useMemo(() => getSelectedScene(project, selectedSceneId), [project, selectedSceneId]);
  const selectedHotspot = useMemo(() => getSelectedHotspot(selectedScene, selectedHotspotId), [selectedScene, selectedHotspotId]);
  const selectedCinematic = useMemo(() => getSelectedCinematic(project, selectedCinematicId), [project, selectedCinematicId]);
  const selectedItem = useMemo(() => getSelectedItem(project, selectedItemId), [project, selectedItemId]);
  const selectedSceneObject = useMemo(() => (selectedScene?.sceneObjects || []).find((entry) => entry.id === selectedSceneObjectId) || null, [selectedScene, selectedSceneObjectId]);
  const selectedEnigma = useMemo(() => (project.enigmas || []).find((entry) => entry.id === selectedEnigmaId) || null, [project, selectedEnigmaId]);

  const actsWithScenes = useMemo(() => (
    project.acts.map((act) => ({
      ...act,
      scenes: project.scenes.filter((scene) => scene.actId === act.id),
    }))
  ), [project]);

  const childScenes = useMemo(
    () => project.scenes.filter((scene) => scene.parentSceneId === selectedSceneId),
    [project, selectedSceneId],
  );

  const getSceneLabel = useCallback((sceneId) => buildSceneLabel(sceneId, getSceneById, getActById), [getActById, getSceneById]);
  const getSceneDepth = useCallback((scene) => computeSceneDepth(scene, getSceneById), [getSceneById]);

  const addAct = useCallback(() => {
    const act = makeAct(`Acte ${project.acts.length + 1}`);
    patchProject((draft) => draft.acts.push(act));
  }, [patchProject, project.acts.length]);

  const deleteAct = useCallback((actId) => {
    const actScenes = project.scenes.filter((scene) => scene.actId === actId);
    if (actScenes.length) return false;
    if (project.acts.length <= 1) return false;
    patchProject((draft) => {
      draft.acts = draft.acts.filter((act) => act.id !== actId);
      if (draft.start?.targetActId === actId) draft.start.targetActId = '';
    });
    return true;
  }, [patchProject, project.acts.length, project.scenes]);

  const addScene = useCallback(() => {
    const defaultActId = selectedScene?.actId || project.acts[0]?.id || '';
    const scene = makeScene({ actId: defaultActId });
    scene.sceneObjects = scene.sceneObjects || [];
    patchProject((draft) => draft.scenes.push(scene));
    setSelectedSceneId(scene.id);
    setSelectedHotspotId(scene.hotspots[0]?.id || '');
    setSelectedSceneObjectId(scene.sceneObjects[0]?.id || '');
    setSelectedItemId('');
  }, [patchProject, project.acts, selectedScene]);

  const addSubsceneToSelectedScene = useCallback(() => {
    if (!selectedScene) return;
    const scene = makeScene({
      actId: selectedScene.actId,
      parentSceneId: selectedScene.id,
      name: `Sous-scène de ${selectedScene.name}`,
    });
    scene.sceneObjects = scene.sceneObjects || [];
    patchProject((draft) => draft.scenes.push(scene));
    setSelectedSceneId(scene.id);
    setSelectedHotspotId(scene.hotspots[0]?.id || '');
    setSelectedSceneObjectId(scene.sceneObjects[0]?.id || '');
    setSelectedItemId('');
  }, [patchProject, selectedScene]);

  const addHotspot = useCallback(() => {
    const hotspot = {
      ...makeHotspot(),
      tutorialCreated: Boolean(document.body.classList.contains('tutorial-active')),
    };
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (scene) scene.hotspots.push(hotspot);
    });
    setSelectedHotspotId(hotspot.id);
    setSelectedItemId('');
  }, [patchProject, selectedSceneId]);

  const deleteHotspot = useCallback((sceneId, hotspotId) => {
    let fallbackHotspotId = '';
    patchProject((draft) => {
      draft.scenes.forEach((scene) => {
        scene.hotspots.forEach((spot) => {
          if (spot.requiredHotspotId === hotspotId) spot.requiredHotspotId = '';
        });
      });
      const scene = draft.scenes.find((entry) => entry.id === sceneId);
      if (!scene) return;
      scene.hotspots = scene.hotspots.filter((spot) => spot.id !== hotspotId);
      if (!scene.hotspots.length) scene.hotspots = [makeHotspot()];
      fallbackHotspotId = scene.hotspots[0]?.id || '';
    });
    setSelectedHotspotId(fallbackHotspotId);
  }, [patchProject]);

  const addItem = useCallback(() => {
    const item = makeItem();
    patchProject((draft) => draft.items.push(item));
    setSelectedItemId(item.id);
  }, [patchProject]);


  const addSceneObject = useCallback(() => {
    const sceneObject = makeSceneObject(selectedScene?.sceneObjects?.length || 0);
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      ensureSceneObjects(scene).push(sceneObject);
    });
    setSelectedSceneObjectId(sceneObject.id);
    setSelectedHotspotId('');
    setSelectedItemId('');
  }, [patchProject, selectedScene, selectedSceneId]);

  const deleteSceneObject = useCallback((sceneId, sceneObjectId) => {
    let fallbackSceneObjectId = '';
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === sceneId);
      if (!scene) return;
      scene.sceneObjects = (scene.sceneObjects || []).filter((entry) => entry.id !== sceneObjectId);
      fallbackSceneObjectId = scene.sceneObjects[0]?.id || '';
    });
    setSelectedSceneObjectId(fallbackSceneObjectId);
  }, [patchProject]);

  const deleteItem = useCallback((itemId) => {
    let nextSelectedItemId = '';
    patchProject((draft) => {
      draft.items = draft.items.filter((item) => item.id !== itemId);
      draft.combinations = (draft.combinations || []).filter((combo) => (
        combo.itemAId !== itemId && combo.itemBId !== itemId && combo.resultItemId !== itemId
      ));
      draft.scenes.forEach((scene) => {
        (scene.sceneObjects || []).forEach((sceneObject) => {
          if (sceneObject.linkedItemId === itemId) sceneObject.linkedItemId = '';
        });
        scene.hotspots.forEach((spot) => {
          if (spot.requiredItemId === itemId) spot.requiredItemId = '';
          if (spot.rewardItemId === itemId) spot.rewardItemId = '';
          if (spot.secondRequiredItemId === itemId) spot.secondRequiredItemId = '';
          if (spot.secondRewardItemId === itemId) spot.secondRewardItemId = '';
          (spot.logicRules || []).forEach((rule) => {
            if (rule.itemId === itemId) rule.itemId = '';
            if (rule.rewardItemId === itemId) rule.rewardItemId = '';
          });
        });
      });
      nextSelectedItemId = draft.items[0]?.id || '';
    });
    if (selectedItemId === itemId) setSelectedItemId(nextSelectedItemId);
  }, [patchProject, selectedItemId]);

  const addCombination = useCallback(() => {
    patchProject((draft) => {
      if (!draft.combinations) draft.combinations = [];
      draft.combinations.push(makeCombination());
    });
  }, [patchProject]);

  const addEnigma = useCallback(() => {
    const enigma = makeEnigma();
    patchProject((draft) => {
      if (!draft.enigmas) draft.enigmas = [];
      draft.enigmas.push(enigma);
    });
    setSelectedEnigmaId(enigma.id);
  }, [patchProject]);

  const deleteEnigma = useCallback((enigmaId) => {
    let nextSelectedEnigmaId = '';
    patchProject((draft) => {
      draft.enigmas = (draft.enigmas || []).filter((enigma) => enigma.id !== enigmaId);
      draft.scenes.forEach((scene) => {
        scene.hotspots.forEach((spot) => {
          if (spot.enigmaId === enigmaId) spot.enigmaId = '';
          if (spot.secondEnigmaId === enigmaId) spot.secondEnigmaId = '';
          (spot.logicRules || []).forEach((rule) => {
            if (rule.conditionEnigmaId === enigmaId) rule.conditionEnigmaId = '';
            if (rule.enigmaId === enigmaId) rule.enigmaId = '';
          });
        });
      });
      nextSelectedEnigmaId = draft.enigmas?.[0]?.id || '';
    });
    if (selectedEnigmaId === enigmaId) setSelectedEnigmaId(nextSelectedEnigmaId);
  }, [patchProject, selectedEnigmaId]);

  const addCinematic = useCallback(() => {
    const cinematic = makeCinematic();
    patchProject((draft) => draft.cinematics.push(cinematic));
    setSelectedCinematicId(cinematic.id);
  }, [patchProject]);

  const addSlide = useCallback(() => {
    patchProject((draft) => {
      const cinematic = draft.cinematics.find((entry) => entry.id === selectedCinematicId);
      if (cinematic) cinematic.slides.push(makeCinematicSlide());
    });
  }, [patchProject, selectedCinematicId]);

  const deleteScene = useCallback((sceneId) => {
    const sceneIdsToDelete = collectDescendantSceneIds(project.scenes, sceneId);
    const remainingScenes = project.scenes.filter((scene) => !sceneIdsToDelete.has(scene.id));
    const fallbackScene = remainingScenes[0] || null;

    patchProject((draft) => {
      draft.scenes = draft.scenes.filter((scene) => !sceneIdsToDelete.has(scene.id));
      draft.scenes.forEach((scene) => {
        if (scene.parentSceneId && sceneIdsToDelete.has(scene.parentSceneId)) scene.parentSceneId = '';
        scene.hotspots.forEach((spot) => {
          if (spot.targetSceneId && sceneIdsToDelete.has(spot.targetSceneId)) spot.targetSceneId = '';
        });
      });
    });

    setSelectedSceneId(fallbackScene?.id || '');
    setSelectedHotspotId(fallbackScene?.hotspots?.[0]?.id || '');
    setSelectedSceneObjectId(fallbackScene?.sceneObjects?.[0]?.id || '');
    setSelectedItemId('');
  }, [patchProject, project.scenes]);

  const renderSceneTree = useCallback((scenes, depth = 0) => (
    scenes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((scene) => {
        const children = project.scenes.filter((candidate) => candidate.parentSceneId === scene.id && candidate.actId === scene.actId);
        return (
          <details key={scene.id} className="scene-tree-node" open>
            <summary className={`scene-summary ${scene.id === selectedSceneId ? 'selected' : ''}`}>
              <button
                type="button"
                className="scene-select-button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedSceneId(scene.id);
                  setSelectedHotspotId(scene.hotspots[0]?.id || '');
                  setSelectedSceneObjectId(scene.sceneObjects?.[0]?.id || '');
                  setSelectedItemId('');
                }}
              >
                <span className="scene-title-line" style={{ paddingLeft: `${depth * 14}px` }}>
                  <strong>{scene.name}</strong>
                  <small>{children.length ? `${children.length} sous-scène(s)` : 'Aucune sous-scène'}</small>
                </span>
              </button>
            </summary>
            {children.length ? <div className="scene-children">{renderSceneTree(children, depth + 1)}</div> : null}
          </details>
        );
      })
  ), [project.scenes, selectedSceneId]);

  const loadProject = useCallback((nextProject) => {
    projectRef.current = nextProject;
    setProject(nextProject);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedSceneId(nextProject.scenes?.[0]?.id || '');
    setSelectedHotspotId(nextProject.scenes?.[0]?.hotspots?.[0]?.id || '');
    setSelectedSceneObjectId(nextProject.scenes?.[0]?.sceneObjects?.[0]?.id || '');
    setSelectedCinematicId(nextProject.cinematics?.[0]?.id || '');
    setSelectedItemId(nextProject.items?.[0]?.id || '');
    setSelectedEnigmaId(nextProject.enigmas?.[0]?.id || '');
  }, []);

  return {
    project,
    setProject,
    loadProject,
    rememberProjectState,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange: undoStack.length > 0,
    canRedoProjectChange: redoStack.length > 0,
    tab,
    setTab,
    patchProject,
    selectedSceneId,
    setSelectedSceneId,
    selectedHotspotId,
    setSelectedHotspotId,
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    selectedCinematicId,
    setSelectedCinematicId,
    selectedItemId,
    setSelectedItemId,
    selectedScene,
    selectedHotspot,
    selectedSceneObject,
    selectedCinematic,
    selectedItem,
    selectedEnigmaId,
    setSelectedEnigmaId,
    selectedEnigma,
    actsWithScenes,
    childScenes,
    getActById,
    getSceneById,
    getItemById,
    getSceneLabel,
    getSceneDepth,
    addAct,
    deleteAct,
    addScene,
    addSubsceneToSelectedScene,
    deleteScene,
    addHotspot,
    deleteHotspot,
    addSceneObject,
    deleteSceneObject,
    addItem,
    deleteItem,
    addCombination,
    addEnigma,
    deleteEnigma,
    addCinematic,
    addSlide,
    renderSceneTree,
  };
}
