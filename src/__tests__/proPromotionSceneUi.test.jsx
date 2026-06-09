import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HotspotActionFields, { getProjectLinkOptions } from '../domains/scenes/studio/components/HotspotActionFields.jsx';
import HotspotInspectorPanel from '../domains/scenes/studio/components/HotspotInspectorPanel.jsx';
import CinematicStudio from '../domains/scenes/cinematics/CinematicStudio.jsx';
import EnigmaStudio from '../domains/scenes/enigmas/EnigmaStudio.jsx';
import SceneCanvasQuickToolbar, { getContainedToolbarOffsetX } from '../domains/scenes/studio/components/SceneCanvasQuickToolbar.jsx';
import { EditorToolbarMenus } from '../domains/scenes/studio/components/SceneEditorChrome.jsx';
import SceneObjectEditPanel from '../domains/scenes/studio/components/SceneObjectEditPanel.jsx';
import SceneSidebar from '../domains/scenes/studio/components/SceneSidebar.jsx';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';
import { PRO_PROMOTION_PROJECT_MODE, applyProPromotionProjectSetup } from '../shared/services/proPromotion';
import SceneObjectBlockContent from '../shared/ui/scene/SceneObjectBlockContent.jsx';
import { useAccessibleDialog } from '../shared/ui/AccessibleDialog.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('pro promotion scene UI', () => {
  function DialogHarness({ children }) {
    const { dialog } = useAccessibleDialog();
    return (
      <>
        {children}
        {dialog}
      </>
    );
  }

  test('garde la barre rapide dans les bords du canvas quand elle est large', () => {
    const containerWidth = 515;
    const toolbarWidth = 493;
    const anchorX = 320;
    const offsetX = getContainedToolbarOffsetX({ anchorX, containerWidth, toolbarWidth });
    const toolbarLeft = anchorX + offsetX;
    const toolbarRight = toolbarLeft + toolbarWidth;

    expect(toolbarLeft).toBeGreaterThanOrEqual(6);
    expect(toolbarRight).toBeLessThanOrEqual(containerWidth - 6);
  });

  test('permet de supprimer une zone depuis l inspecteur', async () => {
    const selectedHotspot = {
      id: 'spot-1',
      name: 'Nouvelle zone',
      x: 50,
      y: 50,
      width: 20,
      height: 15,
      actionType: 'dialogue',
      dialogue: 'Quelque chose attire ton attention.',
    };
    const project = { scenes: [{ id: 'scene-1', hotspots: [selectedHotspot] }] };
    const patchProject = vi.fn((updater) => updater(project));
    const onHotspotDeleted = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <HotspotInspectorPanel
        selectedHotspot={selectedHotspot}
        selectedHotspotId="spot-1"
        selectedSceneId="scene-1"
        project={project}
        patchProject={patchProject}
        renderShapeControls={() => null}
        setConversationEditorOpen={vi.fn()}
        addConversationQuestion={vi.fn()}
        getSceneLabel={(scene) => scene?.name || 'Scene'}
        handleUpload={vi.fn()}
        onHotspotDeleted={onHotspotDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la zone' }));

    await waitFor(() => {
      expect(project.scenes[0].hotspots).toHaveLength(0);
    });
    expect(onHotspotDeleted).toHaveBeenCalledTimes(1);
  });

  test('supprime une zone avec la confirmation reelle de l interface', async () => {
    const selectedHotspot = {
      id: 'spot-1',
      name: 'Nouvelle zone',
      x: 50,
      y: 50,
      width: 20,
      height: 15,
      actionType: 'dialogue',
    };
    const project = { scenes: [{ id: 'scene-1', hotspots: [selectedHotspot] }] };
    const patchProject = vi.fn((updater) => updater(project));

    render(
      <DialogHarness>
        <HotspotInspectorPanel
          selectedHotspot={selectedHotspot}
          selectedHotspotId="spot-1"
          selectedSceneId="scene-1"
          project={project}
          patchProject={patchProject}
          renderShapeControls={() => null}
          setConversationEditorOpen={vi.fn()}
          addConversationQuestion={vi.fn()}
          getSceneLabel={(scene) => scene?.name || 'Scene'}
          handleUpload={vi.fn()}
        />
      </DialogHarness>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la zone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(project.scenes[0].hotspots).toHaveLength(0);
    });
  });

  test('edite le nom statistique d une zone', () => {
    const selectedHotspot = {
      id: 'spot-1',
      name: 'CTA interne',
      x: 50,
      y: 50,
      width: 20,
      height: 15,
      actionType: 'external_link',
      externalUrl: '',
    };
    const project = { scenes: [{ id: 'scene-1', hotspots: [selectedHotspot] }], items: [], enigmas: [], cinematics: [] };
    const patchProject = vi.fn((updater) => updater(project));
    const { container } = render(
      <HotspotInspectorPanel
        selectedHotspot={selectedHotspot}
        selectedHotspotId="spot-1"
        selectedSceneId="scene-1"
        project={project}
        patchProject={patchProject}
        renderShapeControls={() => null}
        setConversationEditorOpen={vi.fn()}
        addConversationQuestion={vi.fn()}
        getSceneLabel={(scene) => scene?.name || 'Scene'}
        handleUpload={vi.fn()}
      />,
    );

    const analyticsNameInput = container.querySelector('[data-tour="hotspot-analytics-label"]');
    expect(analyticsNameInput).toBeTruthy();
    fireEvent.change(analyticsNameInput, { target: { value: 'Réserver une session' } });

    expect(project.scenes[0].hotspots[0].analyticsLabel).toBe('Réserver une session');
  });


  test('affiche un bouton crayon pour editer un texte selectionne', () => {
    const selectedScene = {
      id: 'scene-1',
      hotspots: [],
      sceneObjects: [{
        id: 'text-1',
        name: 'Texte',
        blockType: 'text',
        blockText: 'Projet a relier',
        x: 50,
        y: 50,
        width: 28,
        height: 12,
      }],
    };
    const onEditSceneObjectText = vi.fn();

    render(
      <SceneCanvasQuickToolbar
        selectedScene={selectedScene}
        selectedSceneId="scene-1"
        selectedSceneObjectId="text-1"
        duplicateSelectedEditorItems={vi.fn()}
        deleteSelectedEditorItems={vi.fn()}
        patchLayerItem={vi.fn()}
        sendLayerToEdge={vi.fn()}
        projectMode={PRO_PROMOTION_PROJECT_MODE}
        onEditSceneObjectText={onEditSceneObjectText}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le texte' }));

    expect(onEditSceneObjectText).toHaveBeenCalledWith('text-1');
  });

  test('rend un texte deplacable hors edition puis editable en mode texte', () => {
    const textObject = {
      id: 'text-1',
      name: 'Texte',
      blockType: 'text',
      blockText: 'Projet a relier',
    };
    const onEditEnd = vi.fn();
    const { rerender } = render(
      <SceneObjectBlockContent object={textObject} editable={false} />,
    );

    expect(screen.queryByRole('textbox', { name: 'Texte de Texte' })).toBeNull();
    expect(screen.getByText('Projet a relier')).toBeTruthy();

    rerender(
      <SceneObjectBlockContent
        object={textObject}
        editable
        onEditEnd={onEditEnd}
      />,
    );

    const textarea = screen.getByRole('textbox', { name: 'Texte de Texte' });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(onEditEnd).toHaveBeenCalledTimes(1);

    fireEvent.blur(textarea);
    expect(onEditEnd).toHaveBeenCalledTimes(2);
  });

  test('supprime directement un texte de page extension depuis l inspecteur', async () => {
    const selectedSceneObject = {
      id: 'text-1',
      name: 'Texte',
      blockType: 'text',
      blockText: 'Projet a relier',
      x: 50,
      y: 50,
      width: 28,
      height: 12,
    };
    const project = {
      creationMode: PRO_PROMOTION_PROJECT_MODE,
      scenes: [{ id: 'scene-1', sceneObjects: [selectedSceneObject] }],
    };
    const patchProject = vi.fn((updater) => updater(project));
    const onSceneObjectDeleted = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SceneObjectEditPanel
        project={project}
        selectedSceneId="scene-1"
        selectedSceneObject={selectedSceneObject}
        selectedSceneObjectId="text-1"
        patchProject={patchProject}
        renderShapeControls={() => null}
        handleUpload={vi.fn()}
        getSceneLabel={(scene) => scene?.name || 'Scene'}
        setSelectedSceneObjectId={vi.fn()}
        onSceneObjectDeleted={onSceneObjectDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: "Supprimer l'objet visible" }));

    await waitFor(() => {
      expect(project.scenes[0].sceneObjects).toHaveLength(0);
    });
    expect(onSceneObjectDeleted).toHaveBeenCalledTimes(1);
  });

  test('supprime un texte avec la confirmation reelle de l interface', async () => {
    const selectedSceneObject = {
      id: 'text-1',
      name: 'Texte',
      blockType: 'text',
      blockText: 'Projet a relier',
      x: 50,
      y: 50,
      width: 28,
      height: 12,
    };
    const project = {
      creationMode: PRO_PROMOTION_PROJECT_MODE,
      scenes: [{ id: 'scene-1', sceneObjects: [selectedSceneObject] }],
    };
    const patchProject = vi.fn((updater) => updater(project));

    render(
      <DialogHarness>
        <SceneObjectEditPanel
          project={project}
          selectedSceneId="scene-1"
          selectedSceneObject={selectedSceneObject}
          selectedSceneObjectId="text-1"
          patchProject={patchProject}
          renderShapeControls={() => null}
          handleUpload={vi.fn()}
          getSceneLabel={(scene) => scene?.name || 'Scene'}
          setSelectedSceneObjectId={vi.fn()}
        />
      </DialogHarness>,
    );

    fireEvent.click(screen.getByRole('button', { name: "Supprimer l'objet visible" }));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }));

    await waitFor(() => {
      expect(project.scenes[0].sceneObjects).toHaveLength(0);
    });
  });

  test('liste les autres projets du profil comme cibles de lien', () => {
    expect(getProjectLinkOptions([
      { id: 'current-extension', name: 'Extension active' },
      { id: 'main-game', name: 'Salle principale' },
      { project_id: 'campaign', data: { title: 'Campagne été' } },
      { data: { projectId: 'after-game', title: 'Après-jeu' } },
    ], 'current-extension', { id: 'user-1' })).toEqual([
      { id: 'main-game', userId: 'user-1', title: 'Salle principale' },
      { id: 'campaign', userId: 'user-1', title: 'Campagne été' },
      { id: 'after-game', userId: 'user-1', title: 'Après-jeu' },
    ]);
  });

  test('liste uniquement les pages pro quand le filtre pro est actif', () => {
    expect(getProjectLinkOptions([
      { id: 'current-game', name: 'Jeu principal' },
      { id: 'main-game', name: 'Salle principale' },
      { id: 'pro-before', name: 'Prologue VIP', data: { creationMode: PRO_PROMOTION_PROJECT_MODE } },
      { id: 'pro-after', name: 'Épilogue VIP', data: { proPage: { kind: 'extend' } } },
    ], 'current-game', { id: 'user-1' }, { proOnly: true })).toEqual([
      { id: 'pro-before', userId: 'user-1', title: 'Prologue VIP' },
      { id: 'pro-after', userId: 'user-1', title: 'Épilogue VIP' },
    ]);
  });

  test('masque la navigation dans les pages extension', () => {
    const project = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));

    const { container } = render(
      <SceneSidebar
        project={project}
        actsWithScenes={[]}
        addAct={vi.fn()}
        deleteAct={vi.fn()}
        addScene={vi.fn()}
        selectedSceneId={project.scenes[0].id}
        collapsedActIds={new Set()}
        setActCollapsed={vi.fn()}
        collapsedSceneIds={new Set()}
        toggleSceneChildren={vi.fn()}
        selectSceneFromTree={vi.fn()}
      />,
    );

    expect(container.childElementCount).toBe(0);
    expect(screen.queryByRole('heading', { name: 'Page d’extension' })).toBeNull();
    expect(screen.queryByText('Page unique')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Acte' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Scène' })).toBeNull();
    expect(screen.queryByText('Acte I')).toBeNull();
  });

  test('limite le menu ajouter aux zones action, texte et zones visuelles', () => {
    render(
      <EditorToolbarMenus
        selectedSceneId="scene-1"
        previewScene={vi.fn()}
        deleteScene={vi.fn()}
        undoProjectChange={vi.fn()}
        redoProjectChange={vi.fn()}
        duplicateSelectedEditorItems={vi.fn()}
        activeSelectionCount={0}
        multiSelectEnabled={false}
        setMultiSelectEnabled={vi.fn()}
        deleteSelectedEditorItems={vi.fn()}
        enterEditorFullscreen={vi.fn()}
        addHotspot={vi.fn()}
        addSceneObject={vi.fn()}
        addAnimationObject={vi.fn()}
        addInvisibleSceneObject={vi.fn()}
        addInteractiveBlock={vi.fn()}
        addVisualEffectZone={vi.fn()}
        isSinglePageMode
      />,
    );

    expect(screen.getByRole('button', { name: "Zone d'action" })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Texte' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zone visuelle' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Objet visible' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bloc' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Animation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Objet invisible' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Image' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bouton' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Champ de saisie' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Indice' })).toBeNull();
  });

  test('propose les liens externes et projets dans les actions de zone pro', () => {
    const selectedScene = {
      id: 'scene-1',
      hotspots: [{ id: 'spot-1', name: 'Zone', x: 50, y: 50, width: 14, height: 12, actionType: 'dialogue' }],
      sceneObjects: [],
    };
    const patchLayerItem = vi.fn((type, id, updater) => {
      expect(type).toBe('hotspot');
      expect(id).toBe('spot-1');
      updater(selectedScene.hotspots[0]);
    });

    render(
      <SceneCanvasQuickToolbar
        selectedScene={selectedScene}
        selectedSceneId="scene-1"
        selectedHotspotId="spot-1"
        duplicateSelectedEditorItems={vi.fn()}
        deleteSelectedEditorItems={vi.fn()}
        patchLayerItem={patchLayerItem}
        sendLayerToEdge={vi.fn()}
        projectMode={PRO_PROMOTION_PROJECT_MODE}
      />,
    );

    fireEvent.click(screen.getByTitle('Changer action'));

    expect(screen.getByRole('option', { name: 'Aucun' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Lien externe' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Projet cible' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Dialogue + objet' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Changer de scène' })).toBeNull();

    fireEvent.click(screen.getByRole('option', { name: 'Aucun' }));
    expect(selectedScene.hotspots[0].actionType).toBe('none');
  });

  test('reserve l action Projet cible aux comptes pro dans un projet classique', () => {
    const selectedScene = {
      id: 'scene-1',
      hotspots: [{ id: 'spot-1', name: 'Zone', x: 50, y: 50, width: 14, height: 12, actionType: 'dialogue' }],
      sceneObjects: [],
    };

    const { rerender } = render(
      <SceneCanvasQuickToolbar
        selectedScene={selectedScene}
        selectedSceneId="scene-1"
        selectedHotspotId="spot-1"
        duplicateSelectedEditorItems={vi.fn()}
        deleteSelectedEditorItems={vi.fn()}
        patchLayerItem={vi.fn()}
        sendLayerToEdge={vi.fn()}
        projectMode="expert"
      />,
    );

    fireEvent.click(screen.getByTitle('Changer action'));
    expect(screen.queryByRole('option', { name: 'Projet cible' })).toBeNull();

    fireEvent.keyDown(document, { key: 'Escape' });
    rerender(
      <SceneCanvasQuickToolbar
        selectedScene={selectedScene}
        selectedSceneId="scene-1"
        selectedHotspotId="spot-1"
        duplicateSelectedEditorItems={vi.fn()}
        deleteSelectedEditorItems={vi.fn()}
        patchLayerItem={vi.fn()}
        sendLayerToEdge={vi.fn()}
        projectMode="expert"
        canUseProPages
      />,
    );

    fireEvent.click(screen.getByTitle('Changer action'));
    expect(screen.getByRole('option', { name: 'Projet cible' })).toBeTruthy();
  });


  test('propose les liens externes et projets dans les actions de texte pro', () => {
    const selectedScene = {
      id: 'scene-1',
      hotspots: [],
      sceneObjects: [{
        id: 'text-1',
        name: 'Texte',
        blockType: 'text',
        x: 50,
        y: 50,
        width: 28,
        height: 12,
        clickMode: 'none',
        actionType: 'dialogue',
      }],
    };
    const patchLayerItem = vi.fn((type, id, updater) => {
      expect(type).toBe('sceneObject');
      expect(id).toBe('text-1');
      updater(selectedScene.sceneObjects[0]);
    });

    render(
      <SceneCanvasQuickToolbar
        selectedScene={selectedScene}
        selectedSceneId="scene-1"
        selectedSceneObjectId="text-1"
        duplicateSelectedEditorItems={vi.fn()}
        deleteSelectedEditorItems={vi.fn()}
        patchLayerItem={patchLayerItem}
        sendLayerToEdge={vi.fn()}
        projectMode={PRO_PROMOTION_PROJECT_MODE}
      />,
    );

    fireEvent.click(screen.getByTitle('Changer action'));

    expect(screen.getByRole('option', { name: 'Aucun' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Lien externe' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Projet cible' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Dialogue + objet' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Changer de scène' })).toBeNull();

    fireEvent.click(screen.getByRole('option', { name: 'Lien externe' }));
    expect(selectedScene.sceneObjects[0].clickMode).toBe('action');
    expect(selectedScene.sceneObjects[0].actionType).toBe('external_link');

    fireEvent.click(screen.getByTitle('Changer action'));
    fireEvent.click(screen.getByRole('option', { name: 'Aucun' }));
    expect(selectedScene.sceneObjects[0].clickMode).toBe('none');
    expect(selectedScene.sceneObjects[0].actionType).toBe('dialogue');
  });

  test('edite les champs de lien externe et de projet cible', () => {
    const project = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));
    const externalEntry = { actionType: 'external_link', dialogue: '', externalUrl: '' };
    const updateExternalEntry = (updater) => updater(externalEntry);
    const { rerender, container } = render(
      <HotspotActionFields
        entry={externalEntry}
        updateEntry={updateExternalEntry}
        actionType="external_link"
        project={project}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('https://ton-site.fr/page'), {
      target: { value: 'https://example.com/reserver' },
    });
    expect(externalEntry.externalUrl).toBe('https://example.com/reserver');
    expect(screen.queryByText('Énigme liée')).toBeNull();

    const projectEntry = { actionType: 'project_link', dialogue: '', targetProjectId: '', targetProjectUserId: '' };
    const updateProjectEntry = (updater) => updater(projectEntry);
    rerender(
      <HotspotActionFields
        entry={projectEntry}
        updateEntry={updateProjectEntry}
        actionType="project_link"
        project={project}
        user={{ id: 'user-1' }}
        activeProjectId="current-extension"
        projectLibrary={[
          { id: 'current-extension', name: 'Extension active' },
          { id: 'main-game', name: 'Salle principale' },
          { id: 'pro-page', name: 'Page avant-jeu', data: { creationMode: PRO_PROMOTION_PROJECT_MODE } },
        ]}
      />,
    );

    fireEvent.change(container.querySelector('[data-tour="hotspot-target-project"]'), {
      target: { value: 'main-game' },
    });
    expect(projectEntry.targetProjectId).toBe('main-game');
    expect(projectEntry.targetProjectUserId).toBe('user-1');
    expect(screen.getByRole('option', { name: 'Salle principale' })).toBeTruthy();
    expect(screen.queryByText('Dialogue')).toBeNull();
    expect(screen.queryByText('Énigme liée')).toBeNull();
    fireEvent.click(screen.getByLabelText("Bloquer l'accès par code"));
    expect(projectEntry.accessCodeEnabled).toBe(true);
    rerender(
      <HotspotActionFields
        entry={projectEntry}
        updateEntry={updateProjectEntry}
        actionType="project_link"
        project={project}
        user={{ id: 'user-1' }}
        activeProjectId="current-extension"
        projectLibrary={[
          { id: 'current-extension', name: 'Extension active' },
          { id: 'main-game', name: 'Salle principale' },
          { id: 'pro-page', name: 'Page avant-jeu', data: { creationMode: PRO_PROMOTION_PROJECT_MODE } },
        ]}
      />,
    );
    fireEvent.change(container.querySelector('[data-tour="hotspot-access-code"]'), {
      target: { value: 'secret' },
    });
    expect(projectEntry.accessCode).toBe('secret');
  });

  test('propose Page pro comme déblocage d énigme pour un compte pro', () => {
    const project = normalizeProject(createInitialProject());
    const selectedEnigma = project.enigmas[0];
    const patchProject = (updater) => updater(project);
    const props = {
      project,
      user: { id: 'user-1', account_type: 'professionnel' },
      projectLibrary: [
        { id: 'current-game', name: 'Jeu principal' },
        { id: 'classic-page', name: 'Classique' },
        { id: 'pro-page', name: 'Page avant-jeu', data: { creationMode: PRO_PROMOTION_PROJECT_MODE } },
      ],
      activeProjectId: 'current-game',
      selectedEnigmaId: selectedEnigma.id,
      setSelectedEnigmaId: vi.fn(),
      selectedEnigma,
      addEnigma: vi.fn(),
      deleteEnigma: vi.fn(),
      patchProject,
      getSceneLabel: (id) => id,
      handleUpload: vi.fn(),
      mediaLibrary: [],
      previewEnigma: vi.fn(),
    };
    const { container, rerender } = render(<EnigmaStudio {...props} />);
    const getUnlockSelect = () => Array.from(container.querySelectorAll('select'))
      .find((select) => Array.from(select.options).some((option) => option.value === 'project_link'));

    expect(screen.getByRole('option', { name: 'Page pro' })).toBeTruthy();
    fireEvent.change(getUnlockSelect(), { target: { value: 'project_link' } });
    rerender(<EnigmaStudio {...props} />);

    const targetProjectSelect = Array.from(container.querySelectorAll('select'))
      .find((select) => Array.from(select.options).some((option) => option.value === 'classic-page'));
    fireEvent.change(targetProjectSelect, { target: { value: 'classic-page' } });
    expect(selectedEnigma.unlockType).toBe('project_link');
    expect(selectedEnigma.targetProjectId).toBe('classic-page');
    expect(selectedEnigma.targetProjectUserId).toBe('user-1');
    expect(screen.getByRole('option', { name: 'Classique' })).toBeTruthy();
  });

  test('propose Projet cible comme action de fin de cinématique pour un compte pro', () => {
    const project = normalizeProject(createInitialProject());
    const selectedCinematic = project.cinematics[0];
    const patchProject = (updater) => updater(project);
    const props = {
      project,
      user: { id: 'user-1', account_type: 'professionnel' },
      projectLibrary: [
        { id: 'current-game', name: 'Jeu principal' },
        { id: 'classic-page', name: 'Classique' },
        { id: 'pro-page', name: 'Page après-jeu', data: { proPage: { kind: 'extend' } } },
      ],
      activeProjectId: 'current-game',
      selectedCinematicId: selectedCinematic.id,
      setSelectedCinematicId: vi.fn(),
      selectedCinematic,
      addCinematic: vi.fn(),
      addSlide: vi.fn(),
      patchProject,
      handleUpload: vi.fn(),
      mediaLibrary: [],
      previewCinematic: vi.fn(),
    };
    const { container, rerender } = render(<CinematicStudio {...props} />);

    expect(screen.getByRole('option', { name: 'Projet cible' })).toBeTruthy();
    fireEvent.change(container.querySelector('[data-tour="cinematic-end-action"]'), {
      target: { value: 'project_link' },
    });
    rerender(<CinematicStudio {...props} />);

    const projectTargetSelect = container.querySelector('.cinematic-end-settings select:last-of-type');
    fireEvent.change(projectTargetSelect, { target: { value: 'classic-page' } });
    expect(selectedCinematic.onEndType).toBe('project_link');
    expect(selectedCinematic.targetProjectId).toBe('classic-page');
    expect(selectedCinematic.targetProjectUserId).toBe('user-1');
    expect(screen.getByRole('option', { name: 'Classique' })).toBeTruthy();
  });

  test('edite un lien externe ou projet sur un texte pro', () => {
    const project = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));
    const selectedSceneObject = {
      id: 'text-1',
      name: 'Texte',
      blockType: 'text',
      blockText: 'Reserve ta session.',
      dialogue: 'Reserve ta session.',
      x: 50,
      y: 50,
      width: 28,
      height: 12,
      shapeType: 'rect',
      clickMode: 'action',
      actionType: 'external_link',
      externalUrl: '',
    };
    project.scenes[0].sceneObjects = [selectedSceneObject];
    const patchProject = (updater) => updater(project);
    const { container, rerender } = render(
      <SceneObjectEditPanel
        project={project}
        selectedSceneId={project.scenes[0].id}
        selectedSceneObject={selectedSceneObject}
        selectedSceneObjectId={selectedSceneObject.id}
        patchProject={patchProject}
        renderShapeControls={() => null}
        handleUpload={vi.fn()}
        mediaLibrary={[]}
        getSceneLabel={(id) => id}
        setSelectedSceneObjectId={vi.fn()}
      />,
    );

    expect(screen.queryByRole('option', { name: 'Dialogue + objet' })).toBeNull();
    fireEvent.change(container.querySelector('[data-tour="scene-object-pro-text-external-url"]'), {
      target: { value: 'https://example.com/reserver' },
    });
    fireEvent.change(container.querySelector('[data-tour="scene-object-analytics-label"]'), {
      target: { value: 'Réserver une session' },
    });
    expect(project.scenes[0].sceneObjects[0].clickMode).toBe('action');
    expect(project.scenes[0].sceneObjects[0].externalUrl).toBe('https://example.com/reserver');
    expect(project.scenes[0].sceneObjects[0].analyticsLabel).toBe('Réserver une session');
    expect(screen.queryByText('Énigme liée')).toBeNull();

    selectedSceneObject.actionType = 'project_link';
    rerender(
      <SceneObjectEditPanel
        project={project}
        selectedSceneId={project.scenes[0].id}
        selectedSceneObject={selectedSceneObject}
        selectedSceneObjectId={selectedSceneObject.id}
        user={{ id: 'user-1' }}
        projectLibrary={[
          { id: 'current-extension', name: 'Extension active' },
          { id: 'main-game', name: 'Salle principale' },
          { id: 'pro-page', name: 'Page avant-jeu', data: { creationMode: PRO_PROMOTION_PROJECT_MODE } },
        ]}
        activeProjectId="current-extension"
        patchProject={patchProject}
        renderShapeControls={() => null}
        handleUpload={vi.fn()}
        mediaLibrary={[]}
        getSceneLabel={(id) => id}
        setSelectedSceneObjectId={vi.fn()}
      />,
    );

    fireEvent.change(container.querySelector('[data-tour="scene-object-pro-text-target-project"]'), {
      target: { value: 'main-game' },
    });
    expect(project.scenes[0].sceneObjects[0].targetProjectId).toBe('main-game');
    expect(project.scenes[0].sceneObjects[0].targetProjectUserId).toBe('user-1');
  });

  test('masque le libelle et le son sur les textes pro', () => {
    const project = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));
    const selectedSceneObject = {
      id: 'text-1',
      name: 'Texte',
      blockType: 'text',
      blockLabel: 'Texte',
      blockText: 'Un message apparait dans la scène.',
      x: 50,
      y: 50,
      width: 28,
      height: 12,
      shapeType: 'rect',
      clickMode: 'none',
    };
    project.scenes[0].sceneObjects = [selectedSceneObject];

    render(
      <SceneObjectEditPanel
        project={project}
        selectedSceneId={project.scenes[0].id}
        selectedSceneObject={selectedSceneObject}
        selectedSceneObjectId={selectedSceneObject.id}
        patchProject={vi.fn()}
        renderShapeControls={() => null}
        handleUpload={vi.fn()}
        mediaLibrary={[]}
        getSceneLabel={(id) => id}
        setSelectedSceneObjectId={vi.fn()}
      />,
    );

    expect(screen.queryByText('Libellé du bloc')).toBeNull();
    expect(screen.queryByText("Son de l'objet")).toBeNull();
    expect(screen.queryByText('Importer un son')).toBeNull();
    expect(screen.queryByText('Texte')).toBeNull();
  });

  test('permet de choisir une police pour un texte pro', () => {
    const project = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));
    const selectedSceneObject = {
      id: 'text-1',
      name: 'Texte',
      blockType: 'text',
      blockText: 'Un message apparait dans la scène.',
      x: 50,
      y: 50,
      width: 28,
      height: 12,
      shapeType: 'rect',
      clickMode: 'none',
      fontSize: 13,
      fontFamily: 'system',
    };
    project.scenes[0].sceneObjects = [selectedSceneObject];
    const patchProject = (updater) => updater(project);
    const { container } = render(
      <SceneObjectEditPanel
        project={project}
        selectedSceneId={project.scenes[0].id}
        selectedSceneObject={selectedSceneObject}
        selectedSceneObjectId={selectedSceneObject.id}
        patchProject={patchProject}
        renderShapeControls={() => null}
        handleUpload={vi.fn()}
        mediaLibrary={[]}
        getSceneLabel={(id) => id}
        setSelectedSceneObjectId={vi.fn()}
      />,
    );

    const fontSelect = container.querySelector('[data-tour="scene-object-font-family"]');
    const textColorInput = container.querySelector('[data-tour="scene-object-text-color"]');
    const backgroundColorInput = container.querySelector('[data-tour="scene-object-background-color"]');
    const backgroundOpacityInput = container.querySelector('.scene-text-opacity-number input[type="number"]');
    expect(fontSelect).toBeTruthy();
    expect(textColorInput).toBeTruthy();
    expect(backgroundColorInput).toBeTruthy();
    expect(backgroundOpacityInput).toBeTruthy();
    expect(screen.getByText('Taille de police')).toBeTruthy();
    expect(screen.getByText('Couleur texte')).toBeTruthy();
    expect(screen.getByText('Couleur fond')).toBeTruthy();
    expect(screen.getByText('Opacité fond')).toBeTruthy();
    fireEvent.change(fontSelect, { target: { value: 'mono' } });
    fireEvent.change(textColorInput, { target: { value: '#fef3c7' } });
    fireEvent.change(backgroundColorInput, { target: { value: '#112233' } });
    fireEvent.change(backgroundOpacityInput, { target: { value: '35' } });

    expect(project.scenes[0].sceneObjects[0].fontFamily).toBe('mono');
    expect(project.scenes[0].sceneObjects[0].textColor).toBe('#fef3c7');
    expect(project.scenes[0].sceneObjects[0].backgroundColor).toBe('#112233');
    expect(project.scenes[0].sceneObjects[0].backgroundOpacity).toBe(35);
  });

  test('applique la police choisie au rendu du texte de scène', () => {
    render(
      <SceneObjectBlockContent
        object={{
          blockType: 'text',
          blockText: 'Texte stylé',
          fontFamily: 'mono',
          fontSize: 18,
          textColor: '#fef3c7',
          backgroundColor: '#112233',
          backgroundOpacity: 35,
        }}
      />,
    );

    const renderedText = screen.getByText('Texte stylé');
    expect(renderedText.getAttribute('style')).toContain('Courier New');
    expect(renderedText.getAttribute('style')).toContain('--scene-object-font-size: 18px');
    expect(renderedText.getAttribute('style')).toContain('font-size: calc(var(--scene-object-font-size) * var(--scene-object-text-scale, 1))');
    expect(renderedText.getAttribute('style')).toContain('rgb(254, 243, 199)');
    expect(renderedText.getAttribute('style')).toContain('rgba(17, 34, 51, 0.35)');
  });

  test('edite le texte de scène directement dans le bloc du canvas', () => {
    const handleTextChange = vi.fn();

    render(
      <SceneObjectBlockContent
        object={{
          name: 'Titre enseigne',
          blockType: 'text',
          blockText: 'Ancien texte',
        }}
        editable
        onTextChange={handleTextChange}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Texte de Titre enseigne' }), {
      target: { value: 'Nouveau texte' },
    });

    expect(handleTextChange).toHaveBeenCalledWith('Nouveau texte');
  });
});
