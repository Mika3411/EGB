import React from 'react';

const ScenesTab = React.lazy(() => import('./ScenesTab').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
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

const MediaTab = React.lazy(() => import('./MediaTab').then(({ default: Component }) => ({
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

const ObjectsTab = React.lazy(() => import('./ObjectsTab.jsx').then(({ default: Component }) => ({
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

const RouteMapTab = React.lazy(() => import('./RouteMapTab').then(({ default: Component }) => ({
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

const AdventureTab = React.lazy(() => import('./AdventureTab.jsx').then(({ default: Component }) => ({
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

const CinematicsTab = React.lazy(() => import('./CinematicsTab').then(({ default: Component }) => ({
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

const CombinationsTab = React.lazy(() => import('./CombinationsTab').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      addCombination={tabContext.editor.addCombination}
      getItemById={tabContext.editor.getItemById}
      patchProject={onUpdateProject}
    />
  ),
})));

const EnigmasTab = React.lazy(() => import('./EnigmasTab').then(({ default: Component }) => ({
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

const LogicTab = React.lazy(() => import('./LogicTab').then(({ default: Component }) => ({
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

const HeroTab = React.lazy(() => import('./HeroTab.jsx').then(({ default: Component }) => ({
  default: ({ project, onUpdateProject, tabContext }) => (
    <Component
      project={project}
      patchProject={onUpdateProject}
      onPreviewHeroCharacter={tabContext.actions.previewHeroCharacter}
      setTab={tabContext.editor.setTab}
    />
  ),
})));

const CombatTab = React.lazy(() => import('./CombatTab.jsx').then(({ default: Component }) => ({
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

const ScoreTab = React.lazy(() => import('./ScoreTab').then(({ default: Component }) => ({
  default: ({ project }) => <Component project={project} />,
})));

const AiTab = React.lazy(() => import('./AiTab').then(({ default: Component }) => ({
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

const ShopTab = React.lazy(() => import('./ShopTab').then(({ default: Component }) => ({
  default: ({ tabContext }) => <Component user={tabContext.user} />,
})));

const HelpTab = React.lazy(() => import('./HelpTab').then(({ default: Component }) => ({
  default: ({ project, tabContext }) => (
    <Component
      user={tabContext.user}
      projectMode={project?.creationMode}
      onStartTutorial={tabContext.actions.startBuilderTutorialFromProfile}
    />
  ),
})));

const PreviewPlayerPanel = React.lazy(() => import('./PreviewPlayerPanel').then(({ default: Component }) => ({
  default: ({ tabContext, sharedPlayerMode = false }) => (
    <Component
      editor={tabContext.editor}
      preview={tabContext.preview}
      heroCharacterPreviewRequestKey={tabContext.heroCharacterPreviewRequestKey}
      sharedPlayerMode={sharedPlayerMode}
    />
  ),
})));

const TwoDAnimeEditor = React.lazy(() => import('./TwoDAnimeEditor.jsx').then(({ default: Component }) => ({
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

export const TABS = {
  scenes: { component: ScenesTab, label: 'Scènes' },
  media: { component: MediaTab, label: 'Média' },
  objects: { component: ObjectsTab, label: 'Objets' },
  plan: { component: RouteMapTab, label: 'Plan', value: 'map' },
  adventure: { component: AdventureTab, label: 'Narration' },
  cinematics: { component: CinematicsTab, label: 'Cinématiques' },
  combinations: { component: CombinationsTab, label: 'Combinaisons' },
  enigmas: { component: EnigmasTab, label: 'Énigmes' },
  logic: { component: LogicTab, label: 'Logique' },
  hero: { component: HeroTab, label: 'Héros' },
  combat: { component: CombatTab, label: 'Combat' },
  preview: { component: PreviewPlayerPanel, label: 'Preview' },
  animation: { component: TwoDAnimeEditor, label: 'Animation' },
  ai: { component: AiTab, label: 'IA' },
  shop: { component: ShopTab, label: 'Boutique' },
  help: { component: HelpTab, label: 'Aide' },
  score: { component: ScoreTab, label: 'Bilan' },
};

export const getTabValue = (tabKey) => TABS[tabKey].value || tabKey;
export const getTabKey = (tabValue) => (
  Object.keys(TABS).find((tabKey) => getTabValue(tabKey) === tabValue) || tabValue
);
