import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { createInitialProject } from '../shared/data/projectData';
import { BUILDER_TUTORIAL_STEPS } from '../shared/data/tutorialStepData';
import {
  isTutorialStepComplete,
  prepareProjectForTutorial,
} from '../shared/data/tutorialSteps';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readSource = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');
const sceneTutorialSteps = BUILDER_TUTORIAL_STEPS.filter((step) => (step.tutorial || step.tab) === 'scenes');
const allowedSceneTutorialTabs = ['scenes', 'media', 'objects', 'preview'];

const sourceForSceneTutorial = () => [
  'src/app/builder/navigation/BuilderDomainNav.jsx',
  'src/domains/media/MediaLibrary.jsx',
  'src/domains/player/PlaytestWorkspace.jsx',
  'src/domains/scenes/objects/SceneObjectsWorkspace.jsx',
  'src/domains/scenes/studio/SceneStudio.jsx',
  'src/domains/scenes/studio/components/SceneContextPanel.jsx',
  'src/domains/scenes/studio/components/SceneEditorChrome.jsx',
  'src/domains/scenes/studio/components/SceneEditorDrawer.jsx',
  'src/domains/scenes/studio/components/SceneObjectEditPanel.jsx',
  'src/domains/scenes/studio/components/SceneSidebar.jsx',
  'src/shared/ui/media/MediaSourcePicker.jsx',
].map(readSource).join('\n');

const extractTourSelectors = (step) => [step.selector, step.fallbackSelector]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour="([^"]+)"\]/)?.[1])
  .filter(Boolean);

const extractTabSelectors = (step) => [step.selector, step.fallbackSelector]
  .filter(Boolean)
  .map((selector) => selector.match(/\[data-tour-tab="([^"]+)"\]/)?.[1])
  .filter(Boolean);

const sourceHasTour = (source, tour) => (
  source.includes(`data-tour="${tour}"`)
  || source.includes(`tour="${tour}"`)
  || source.includes(`tourId="${tour}"`)
  || source.includes(`'${tour}'`)
);

const makePreparedSceneProject = () => prepareProjectForTutorial(createInitialProject(), 'scenes');

const addTutorialObject = (project, patch = {}) => {
  const nextProject = structuredClone(project);
  nextProject.scenes[0].sceneObjects = [{
    id: 'scene-object-guide',
    name: 'Clé rouillée',
    x: 50,
    y: 50,
    width: 14,
    height: 14,
    tutorialCreated: true,
    ...patch,
  }];
  return nextProject;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('didacticiel scenes', () => {
  test('reference uniquement des data-tour presents dans la nouvelle UI de scene', () => {
    const source = sourceForSceneTutorial();
    const missingTours = sceneTutorialSteps
      .flatMap(extractTourSelectors)
      .filter((tour) => !sourceHasTour(source, tour));
    const missingTabs = sceneTutorialSteps
      .flatMap(extractTabSelectors)
      .filter((tab) => !source.includes('data-tour-tab={tabValue}') || !allowedSceneTutorialTabs.includes(tab));

    expect(missingTours).toEqual([]);
    expect(missingTabs).toEqual([]);
  });

  test('rend les conditions du parcours scenes validables', () => {
    const project = makePreparedSceneProject();

    sceneTutorialSteps
      .filter((step) => step.completedWhen?.type === 'interact')
      .forEach((step) => {
        expect(isTutorialStepComplete(step, new Set([step.selector]), project)).toBe(true);
      });

    sceneTutorialSteps
      .filter((step) => step.completedWhen?.type === 'fake-file')
      .forEach((step) => {
        expect(isTutorialStepComplete(step, new Set([`fake-file:${step.selector}`]), project)).toBe(true);
      });

    document.body.innerHTML = '<div data-tour="scene-name"><input value="Salon"></div>';
    const sceneNameStep = sceneTutorialSteps.find((step) => step.selector === '[data-tour="scene-name"]');
    expect(isTutorialStepComplete(sceneNameStep, new Set(), project)).toBe(true);

    document.body.innerHTML = '<div data-tour="scene-intro"><input value="Une horloge arrêtée domine la pièce."></div>';
    const sceneIntroStep = sceneTutorialSteps.find((step) => step.selector === '[data-tour="scene-intro"]');
    expect(isTutorialStepComplete(sceneIntroStep, new Set(), project)).toBe(true);

    document.body.innerHTML = '<input data-tour="object-name" value="Clé rouillée">';
    const objectNameStep = sceneTutorialSteps.find((step) => step.selector === '[data-tour="object-name"]');
    expect(isTutorialStepComplete(objectNameStep, new Set(), project)).toBe(true);

    document.body.innerHTML = '<details data-tour="scene-add-menu" open></details>';
    const addMenuStep = sceneTutorialSteps.find((step) => step.selector === '[data-tour="scene-add-menu"]');
    expect(isTutorialStepComplete(addMenuStep, new Set(), project)).toBe(true);

    const visualEffectStep = sceneTutorialSteps.find((step) => step.completedWhen?.type === 'project-scene-field-not');
    expect(isTutorialStepComplete(visualEffectStep, new Set(), project)).toBe(false);
    const projectWithEffect = structuredClone(project);
    projectWithEffect.scenes[0].visualEffect = 'fog';
    expect(isTutorialStepComplete(visualEffectStep, new Set(), projectWithEffect)).toBe(true);

    const objectCreatedStep = sceneTutorialSteps.find((step) => step.completedWhen?.type === 'project-scene-object-created');
    const objectMovedStep = sceneTutorialSteps.find((step) => step.completedWhen?.type === 'project-scene-object-moved');
    expect(isTutorialStepComplete(objectCreatedStep, new Set(), project)).toBe(false);
    expect(isTutorialStepComplete(objectCreatedStep, new Set(), addTutorialObject(project))).toBe(true);
    expect(isTutorialStepComplete(objectMovedStep, new Set(), addTutorialObject(project))).toBe(false);
    expect(isTutorialStepComplete(objectMovedStep, new Set(), addTutorialObject(project, { x: 62 }))).toBe(true);
  });

  test('prepare le projet temporaire scenes sans anciens marqueurs tutoriel', () => {
    const project = createInitialProject();
    project.scenes[0].hotspots[0].tutorialCreated = true;
    project.scenes[0].sceneObjects = [{ id: 'old-object', tutorialCreated: true }];
    project.scenes[0].visualEffectZones = [{ id: 'old-zone', tutorialCreated: true }];

    const preparedProject = prepareProjectForTutorial(project, 'scenes');
    const preparedScene = preparedProject.scenes[0];

    expect(preparedScene.name).toBe('');
    expect(preparedScene.introText).toBe('');
    expect(preparedScene.hotspots.some((hotspot) => hotspot.tutorialCreated)).toBe(false);
    expect(preparedScene.sceneObjects.some((object) => object.tutorialCreated)).toBe(false);
    expect(preparedScene.visualEffectZones.some((zone) => zone.tutorialCreated)).toBe(false);
  });
});
