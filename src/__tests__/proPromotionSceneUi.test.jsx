import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import HotspotActionFields, { getProjectLinkOptions } from '../domains/scenes/studio/components/HotspotActionFields.jsx';
import SceneCanvasQuickToolbar from '../domains/scenes/studio/components/SceneCanvasQuickToolbar.jsx';
import { EditorToolbarMenus } from '../domains/scenes/studio/components/SceneEditorChrome.jsx';
import SceneObjectEditPanel from '../domains/scenes/studio/components/SceneObjectEditPanel.jsx';
import SceneSidebar from '../domains/scenes/studio/components/SceneSidebar.jsx';
import { createInitialProject, normalizeProject } from '../shared/data/projectData';
import { PRO_PROMOTION_PROJECT_MODE, applyProPromotionProjectSetup } from '../shared/services/proPromotion';
import SceneObjectBlockContent from '../shared/ui/scene/SceneObjectBlockContent.jsx';

afterEach(() => cleanup());

describe('pro promotion scene UI', () => {
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

  test('affiche une navigation de page unique sans actions acte ou scene', () => {
    const project = normalizeProject(applyProPromotionProjectSetup(createInitialProject(), 'promote'));

    render(
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

    expect(screen.getByRole('heading', { name: 'Page d’extension' })).toBeTruthy();
    expect(screen.getByText('Page unique')).toBeTruthy();
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
    expect(screen.getByRole('option', { name: 'Lien projet' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Dialogue + objet' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Changer de scène' })).toBeNull();

    fireEvent.click(screen.getByRole('option', { name: 'Aucun' }));
    expect(selectedScene.hotspots[0].actionType).toBe('none');
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
    expect(screen.getByRole('option', { name: 'Lien projet' })).toBeTruthy();
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
        ]}
      />,
    );

    fireEvent.change(container.querySelector('[data-tour="hotspot-target-project"]'), {
      target: { value: 'main-game' },
    });
    expect(projectEntry.targetProjectId).toBe('main-game');
    expect(projectEntry.targetProjectUserId).toBe('user-1');
    expect(screen.queryByText('Énigme liée')).toBeNull();
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
    expect(project.scenes[0].sceneObjects[0].clickMode).toBe('action');
    expect(project.scenes[0].sceneObjects[0].externalUrl).toBe('https://example.com/reserver');
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
    expect(screen.getByText('Texte')).toBeTruthy();
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
});
