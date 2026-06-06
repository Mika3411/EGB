import { describe, expect, it } from 'vitest';
import { CREATION_TEMPLATES } from '../domains/profile/components/profileUtils.js';
import { createInitialProject } from '../shared/data/projectData.js';
import { applyCreationTemplate } from '../shared/services/projectTemplates.js';

const NON_EMPTY_TEMPLATE_IDS = CREATION_TEMPLATES
  .map(([templateId]) => templateId)
  .filter((templateId) => templateId !== 'empty');

const CLASSIC_TEMPLATE_IDS = ['manor', 'investigation', 'laboratory', 'museum'];
const NARRATIVE_TEMPLATE_IDS = [
  'narrative_investigation',
  'magic_forest',
  'survival_choices',
  'npc_dialogue',
  'negotiation',
  'narrative_maze',
];

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
