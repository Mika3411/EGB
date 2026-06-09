import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CREATION_TEMPLATES } from '../domains/profile/components/profileUtils.js';
import { createInitialProject } from '../shared/data/projectData.js';
import { applyCreationTemplate } from '../shared/services/projectTemplates.js';

const NON_EMPTY_TEMPLATE_IDS = CREATION_TEMPLATES
  .map(([templateId]) => templateId)
  .filter((templateId) => templateId !== 'empty');

const GENERATED_BACKGROUND_TEMPLATE_IDS = [
  'adventure_choices',
  'book_hero',
  'hero_adventure',
  'investigation',
  'laboratory',
  'manor',
  'museum',
];
const MANUAL_BACKGROUND_TEMPLATE_IDS = NON_EMPTY_TEMPLATE_IDS
  .filter((templateId) => !GENERATED_BACKGROUND_TEMPLATE_IDS.includes(templateId));
const GENERATED_ITEM_IMAGE_TEMPLATE_IDS = [
  'adventure_choices',
  'hero_adventure',
  'investigation',
  'laboratory',
  'manor',
  'museum',
];
const CLASSIC_TEMPLATE_IDS = ['manor', 'investigation', 'laboratory', 'museum'];
const NARRATIVE_TEMPLATE_IDS = [
  'narrative_investigation',
  'magic_forest',
  'survival_choices',
  'npc_dialogue',
  'negotiation',
  'narrative_maze',
];

const publicAssetExists = (assetUrl) => (
  existsSync(join(process.cwd(), 'public', assetUrl.replace(/^\//u, '')))
);

describe('project templates', () => {
  it.each(NON_EMPTY_TEMPLATE_IDS)('%s fournit un plan, des objets et une enigme', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);
    const roomSceneIds = new Set(project.routeMap.rooms.map((room) => room.sceneId));
    const sceneIds = new Set(project.scenes.map((scene) => scene.id));
    const roomIds = new Set(project.routeMap.rooms.map((room) => room.id));

    expect(project.items.length).toBeGreaterThanOrEqual(2);
    expect(project.enigmas.length).toBeGreaterThan(0);
    expect(project.routeMap.rooms.length).toBeGreaterThan(0);
    expect(project.routeMap.connections.length).toBeGreaterThan(0);
    expect([...roomSceneIds].every((sceneId) => !sceneId || sceneIds.has(sceneId))).toBe(true);
    expect(project.routeMap.connections.every((connection) => (
      roomIds.has(connection.fromRoomId) && roomIds.has(connection.toRoomId)
    ))).toBe(true);
  });

  it.each(GENERATED_BACKGROUND_TEMPLATE_IDS)('%s fournit des fonds jouables en preview', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);

    expect(project.scenes.length).toBeGreaterThan(0);
    project.scenes.forEach((scene) => {
      expect(scene.backgroundData).toMatch(/^\/assets\/generated\//);
      expect(scene.backgroundName).toMatch(/\.png$/);
      expect(scene.backgroundWidth).toBeGreaterThan(0);
      expect(scene.backgroundHeight).toBeGreaterThan(0);
      expect(scene.backgroundAspectRatio).toBeGreaterThan(1);
      expect(publicAssetExists(scene.backgroundData)).toBe(true);
    });
  });

  it.each(MANUAL_BACKGROUND_TEMPLATE_IDS)('%s ne plaque pas de fond genere sans pack visuel dedie', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);

    expect(project.scenes.length).toBeGreaterThan(0);
    project.scenes.forEach((scene) => {
      expect(scene.backgroundData).toBe('');
      expect(scene.backgroundName).toBe('');
      expect(scene.backgroundWidth).toBe(0);
      expect(scene.backgroundHeight).toBe(0);
    });
  });

  it.each(NON_EMPTY_TEMPLATE_IDS)('%s fournit des icones d objets finalisees', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);

    expect(project.items.length).toBeGreaterThan(0);
    project.items.forEach((item) => {
      expect(item.icon).toBeTruthy();
      expect(item.icon).not.toBe('[]');
    });
  });

  it.each(GENERATED_ITEM_IMAGE_TEMPLATE_IDS)('%s fournit des objets illustrés', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);

    expect(project.items.length).toBeGreaterThan(0);
    project.items.forEach((item) => {
      expect(item.imageData).toMatch(/^\/assets\/generated\/templates\//);
      expect(item.imageName).toMatch(/\.png$/);
      expect(publicAssetExists(item.imageData)).toBe(true);
    });
  });

  it.each(CLASSIC_TEMPLATE_IDS)('%s remplace le contenu de demo par un mini-jeu coherent', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);
    const itemNames = project.items.map((item) => item.name);
    const enigmaNames = project.enigmas.map((enigma) => enigma.name);

    expect(itemNames).not.toContain('Petite cle');
    expect(itemNames).not.toContain('Petite clé');
    expect(enigmaNames).not.toContain('Code du tiroir');
    expect(project.items.length).toBe(3);
    expect(project.enigmas.length).toBe(1);
    expect(project.routeMap.notes).toContain('Plan:');
    expect(project.scenes.some((scene) => scene.hotspots.some((hotspot) => hotspot.enigmaId))).toBe(true);
  });

  it.each(NARRATIVE_TEMPLATE_IDS)('%s propose trois objets narratifs utiles', (templateId) => {
    const project = applyCreationTemplate(createInitialProject(), templateId, `Projet ${templateId}`);

    expect(project.items.length).toBe(3);
    expect(project.enigmas[0].unlockType).toBe('scene');
    expect(project.routeMap.connections.some((connection) => connection.locked)).toBe(true);
    expect(project.routeMap.notes).toContain('Objets:');
  });

  it('enrichit le template narration choix multiples avec plusieurs objets et une conclusion', () => {
    const project = applyCreationTemplate(createInitialProject(), 'adventure_choices', 'Projet choix');

    expect(project.items.map((item) => item.name)).toEqual([
      'Jeton du guide',
      'Carte de la vallee',
      'Sceau du guetteur',
    ]);
    expect(project.scenes.some((scene) => scene.hotspots.some((hotspot) => hotspot.name === 'Conclusion'))).toBe(true);
  });
});
