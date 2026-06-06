import React from 'react';
import { lazyWithRetry, preloadLazyImport } from '../../../shared/utils/lazyImportRetry';

const SceneStudio = lazyWithRetry(() => import('../../../domains/scenes/studio/SceneStudio').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      user={tabContext.user}
      projectLibrary={tabContext.projects}
      activeProjectId={tabContext.activeProjectId}
      actsWithScenes={tabContext.editor.actsWithScenes}
      renderSceneTree={tabContext.editor.renderSceneTree}
      addAct={tabContext.editor.addAct}
      deleteAct={tabContext.editor.deleteAct}
      addScene={tabContext.editor.addScene}
      addItem={tabContext.editor.addItem}
      selectedItemId={tabContext.editor.selectedItemId}
      setSelectedItemId={tabContext.editor.setSelectedItemId}
      selectedItem={tabContext.editor.selectedItem}
      selectedScene={tabContext.editor.selectedScene}
      selectedSceneId={tabContext.editor.selectedSceneId}
      setSelectedSceneId={tabContext.editor.setSelectedSceneId}
      setTab={tabContext.editor.setTab}
      deleteScene={tabContext.actions.deleteScene}
      previewScene={tabContext.actions.previewScene}
      patchProject={onUpdateProject}
      rememberProjectState={tabContext.editor.rememberProjectState}
      undoProjectChange={tabContext.editor.undoProjectChange}
      redoProjectChange={tabContext.editor.redoProjectChange}
      canUndoProjectChange={tabContext.editor.canUndoProjectChange}
      canRedoProjectChange={tabContext.editor.canRedoProjectChange}
      selectedHotspotId={tabContext.editor.selectedHotspotId}
      setSelectedHotspotId={tabContext.editor.setSelectedHotspotId}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
      getActById={tabContext.editor.getActById}
      getSceneById={tabContext.editor.getSceneById}
      getSceneDepth={tabContext.editor.getSceneDepth}
      addSubsceneToSelectedScene={tabContext.editor.addSubsceneToSelectedScene}
      childScenes={tabContext.editor.childScenes}
      addHotspot={tabContext.editor.addHotspot}
      selectedHotspot={tabContext.editor.selectedHotspot}
      deleteItem={tabContext.actions.deleteItem}
      deleteHotspot={tabContext.editor.deleteHotspot}
      getSceneLabel={tabContext.editor.getSceneLabel}
      collapsedNavigationActIds={tabContext.editor.collapsedNavigationActIds}
      setNavigationActCollapsed={tabContext.editor.setNavigationActCollapsed}
      collapsedNavigationSceneIds={tabContext.editor.collapsedNavigationSceneIds}
      toggleNavigationSceneCollapsed={tabContext.editor.toggleNavigationSceneCollapsed}
    />
  ),
})));

const MediaLibrary = lazyWithRetry(() => import('../../../domains/media/MediaLibrary').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      selectedScene={tabContext.editor.selectedScene}
      selectedSceneId={tabContext.editor.selectedSceneId}
      setSelectedSceneId={tabContext.editor.setSelectedSceneId}
      setSelectedHotspotId={tabContext.editor.setSelectedHotspotId}
      patchProject={onUpdateProject}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
      getSceneLabel={tabContext.editor.getSceneLabel}
    />
  ),
})));

const SceneObjectsWorkspace = lazyWithRetry(() => import('../../../domains/scenes/objects/SceneObjectsWorkspace.jsx').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      addItem={tabContext.editor.addItem}
      deleteItem={tabContext.actions.deleteItem}
      selectedItemId={tabContext.editor.selectedItemId}
      setSelectedItemId={tabContext.editor.setSelectedItemId}
      selectedItem={tabContext.editor.selectedItem}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
    />
  ),
})));

const SceneRouteMap = lazyWithRetry(() => import('../../../domains/scenes/routes/SceneRouteMap').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      getSceneLabel={tabContext.editor.getSceneLabel}
      setSelectedSceneId={tabContext.editor.setSelectedSceneId}
      setSelectedHotspotId={tabContext.editor.setSelectedHotspotId}
      setTab={tabContext.editor.setTab}
    />
  ),
})));

const NarrativeWorkspace = lazyWithRetry(() => import('../../../domains/scenes/narrative/NarrativeWorkspace.jsx').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      getSceneLabel={tabContext.editor.getSceneLabel}
      setSelectedSceneId={tabContext.editor.setSelectedSceneId}
      setTab={tabContext.editor.setTab}
    />
  ),
})));

const CinematicStudio = lazyWithRetry(() => import('../../../domains/scenes/cinematics/CinematicStudio').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      selectedCinematicId={tabContext.editor.selectedCinematicId}
      setSelectedCinematicId={tabContext.editor.setSelectedCinematicId}
      selectedCinematic={tabContext.editor.selectedCinematic}
      addCinematic={tabContext.editor.addCinematic}
      addSlide={tabContext.editor.addSlide}
      patchProject={onUpdateProject}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
      previewCinematic={tabContext.actions.previewCinematic}
    />
  ),
})));

const CombinationRulesWorkspace = lazyWithRetry(() => import('../../../domains/scenes/combinations/CombinationRulesWorkspace').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      addCombination={tabContext.editor.addCombination}
      getItemById={tabContext.editor.getItemById}
      patchProject={onUpdateProject}
    />
  ),
})));

const EnigmaStudio = lazyWithRetry(() => import('../../../domains/scenes/enigmas/EnigmaStudio').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      selectedEnigmaId={tabContext.editor.selectedEnigmaId}
      setSelectedEnigmaId={tabContext.editor.setSelectedEnigmaId}
      selectedEnigma={tabContext.editor.selectedEnigma}
      addEnigma={tabContext.editor.addEnigma}
      deleteEnigma={tabContext.actions.deleteEnigma}
      patchProject={onUpdateProject}
      getSceneLabel={tabContext.editor.getSceneLabel}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
      previewEnigma={tabContext.actions.previewEnigma}
    />
  ),
})));

const LogicRulesWorkspace = lazyWithRetry(() => import('../../../domains/scenes/logic/LogicRulesWorkspace').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
      getSceneLabel={tabContext.editor.getSceneLabel}
      selectedSceneId={tabContext.editor.selectedSceneId}
      collapsedSceneIds={tabContext.editor.collapsedNavigationSceneIds}
      setSceneCollapsed={tabContext.editor.setNavigationSceneCollapsed}
    />
  ),
})));

const HeroDesigner = lazyWithRetry(() => import('../../../domains/characters/hero/HeroDesigner.jsx').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      onPreviewHeroCharacter={tabContext.actions.previewHeroCharacter}
      setTab={tabContext.editor.setTab}
    />
  ),
})));

const CombatWorkspace = lazyWithRetry(() => import('../../../domains/combat/CombatWorkspace.jsx').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      handleUpload={tabContext.actions.handleUpload}
      mediaLibrary={tabContext.mediaLibrary}
      getSceneLabel={tabContext.editor.getSceneLabel}
      setSelectedSceneId={tabContext.editor.setSelectedSceneId}
      setSelectedHotspotId={tabContext.editor.setSelectedHotspotId}
      setTab={tabContext.editor.setTab}
      previewHeroCombat={tabContext.preview.previewHeroCombat}
    />
  ),
})));

const ProjectScoreDashboard = lazyWithRetry(() => import('../../../domains/analytics/project-score/ProjectScoreDashboard').then(({ default: Component }) => ({
  default: ({ project }) => <Component project={project} />,
})));

const AiWorkbench = lazyWithRetry(() => import('../../../domains/ai/AiWorkbench').then(({ default: Component }) => ({
  default: ({ project, tabContext }) => (
    <Component
      project={project}
      user={tabContext.user}
      getSceneLabel={tabContext.editor.getSceneLabel}
      onApplyProject={tabContext.actions.applyAiProject}
      onSaveAiDraft={tabContext.actions.saveAiDraft}
      onPersistAiImage={tabContext.actions.persistAiImage}
      projectStorageKey={tabContext.projectStorageKey}
    />
  ),
})));

const ShopWorkspace = lazyWithRetry(() => import('../../../domains/shop/ShopWorkspace').then(({ default: Component }) => ({
  default: ({ tabContext }) => <Component user={tabContext.user} />,
})));

const ResourceLibrary = lazyWithRetry(() => import('../../../domains/resources/ResourceLibrary').then(({ default: Component }) => ({
  default: () => <Component />,
})));

const HelpCenter = lazyWithRetry(() => import('../../../domains/help/HelpCenter').then(({ default: Component }) => ({
  default: ({ project, tabContext }) => (
    <Component
      project={project}
      projectRecord={tabContext.projectRecord}
      user={tabContext.user}
      projectMode={project?.creationMode}
      onStartTutorial={tabContext.actions.startBuilderTutorialFromProfile}
    />
  ),
})));

const PlayerPreviewShell = lazyWithRetry(() => import('../../../domains/player/PlayerPreviewShell').then(({ default: Component }) => ({
  default: ({ tabContext, sharedPlayerMode = false }) => (
    <Component
      editor={tabContext.editor}
      preview={tabContext.preview}
      heroCharacterPreviewRequestKey={tabContext.heroCharacterPreviewRequestKey}
      sharedPlayerMode={sharedPlayerMode}
    />
  ),
})));

const Anime2DStudio = lazyWithRetry(() => import('../../../domains/anime2d/Anime2DStudio.jsx').then(({ default: Component }) => ({
  default: ({ project, tabContext }) => (
    <Component
      user={tabContext.user}
      projectName={project.title}
      projectDraft={project.anime2dDraft}
      draftStorageKey={tabContext.anime2dStorageId}
      onSaveDraft={tabContext.actions.saveAnime2dDraft}
      onDirtyChange={tabContext.actions.setAnime2dHasUnsavedChanges}
      onRegisterSaveBeforeLeave={tabContext.actions.registerAnime2dSaveBeforeLeave}
      onBackToBuilder={() => tabContext.editor.setTab('preview')}
    />
  ),
})));

const BUILDER_DOMAIN_IMPORTERS = [
  () => import('../../../domains/scenes/studio/SceneStudio'),
  () => import('../../../domains/media/MediaLibrary'),
  () => import('../../../domains/scenes/objects/SceneObjectsWorkspace.jsx'),
  () => import('../../../domains/scenes/routes/SceneRouteMap'),
  () => import('../../../domains/scenes/narrative/NarrativeWorkspace.jsx'),
  () => import('../../../domains/scenes/cinematics/CinematicStudio'),
  () => import('../../../domains/scenes/combinations/CombinationRulesWorkspace'),
  () => import('../../../domains/scenes/enigmas/EnigmaStudio'),
  () => import('../../../domains/scenes/logic/LogicRulesWorkspace'),
  () => import('../../../domains/characters/hero/HeroDesigner.jsx'),
  () => import('../../../domains/combat/CombatWorkspace.jsx'),
  () => import('../../../domains/analytics/project-score/ProjectScoreDashboard'),
  () => import('../../../domains/ai/AiWorkbench'),
  () => import('../../../domains/shop/ShopWorkspace'),
  () => import('../../../domains/resources/ResourceLibrary'),
  () => import('../../../domains/help/HelpCenter'),
  () => import('../../../domains/player/PlayerPreviewShell'),
  () => import('../../../domains/anime2d/Anime2DStudio.jsx'),
];

export const preloadBuilderTabs = () => {
  BUILDER_DOMAIN_IMPORTERS.forEach((importer) => {
    preloadLazyImport(importer, { retries: 1, delayMs: 200 });
  });
};

export const TABS = {
  scenes: { component: SceneStudio, label: 'Scènes' },
  media: { component: MediaLibrary, label: 'Média' },
  objects: { component: SceneObjectsWorkspace, label: 'Objets' },
  plan: { component: SceneRouteMap, label: 'Plan', value: 'map' },
  adventure: { component: NarrativeWorkspace, label: 'Narration' },
  cinematics: { component: CinematicStudio, label: 'Cinématiques' },
  combinations: { component: CombinationRulesWorkspace, label: 'Combinaisons' },
  enigmas: { component: EnigmaStudio, label: 'Énigmes' },
  logic: { component: LogicRulesWorkspace, label: 'Logique' },
  hero: { component: HeroDesigner, label: 'Héros' },
  combat: { component: CombatWorkspace, label: 'Combat' },
  preview: { component: PlayerPreviewShell, label: 'Preview' },
  animation: { component: Anime2DStudio, label: 'Animation' },
  ai: { component: AiWorkbench, label: 'IA' },
  shop: { component: ShopWorkspace, label: 'Boutique' },
  resources: { component: ResourceLibrary, label: 'Ressources' },
  help: { component: HelpCenter, label: 'Aide' },
  score: { component: ProjectScoreDashboard, label: 'Bilan' },
};

export const getTabValue = (tabKey) => TABS[tabKey]?.value || tabKey;
export const getTabKey = (tabValue) => (
  Object.keys(TABS).find((tabKey) => getTabValue(tabKey) === tabValue) || tabValue
);
