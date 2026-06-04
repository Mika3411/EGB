import { describe, expect, it } from 'vitest';
import {
  buildLogicCompletionRefs,
  getLogicRuleCompletionIssues,
  getSceneTimerCompletionIssues,
} from '../shared/services/logicCompletion';

const makeProject = () => ({
  title: 'Projet',
  heroAdventure: {
    hero: {
      skills: [{ id: 'skill1', name: 'Adresse' }],
    },
  },
  scenes: [{
    id: 'scene1',
    name: 'Salle',
    hotspots: [{ id: 'door', name: 'Porte' }],
    sceneObjects: [{
      id: 'panel',
      name: 'Panneau',
      blockType: 'text',
    }, {
      id: 'coin',
      name: 'Pièce',
      blockType: 'object',
    }],
  }, {
    id: 'scene2',
    name: 'Sortie',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [{ id: 'key', name: 'Clé' }],
  cinematics: [{ id: 'cinematic1', name: 'Intro' }],
  enigmas: [{ id: 'enigma1', name: 'Code' }],
  combinations: [{ id: 'combo1' }],
});

describe('logic completion helpers', () => {
  it('flags logic rule actions missing their required targets', () => {
    const refs = buildLogicCompletionRefs(makeProject());

    expect(getLogicRuleCompletionIssues({ conditionType: 'always', actionType: 'scene' }, refs))
      .toContain('Action: Scène cible manquante');
    expect(getLogicRuleCompletionIssues({ conditionType: 'always', actionType: 'cinematic' }, refs))
      .toContain('Action: Cinématique cible manquante');
    expect(getLogicRuleCompletionIssues({ conditionType: 'always', actionType: 'block' }, refs))
      .toContain('Action: Bloc cible manquant');
  });

  it('accepts configured action targets and rejects non-block object targets', () => {
    const refs = buildLogicCompletionRefs(makeProject());

    expect(getLogicRuleCompletionIssues({
      conditionType: 'always',
      actionType: 'block',
      targetBlockId: 'panel',
    }, refs)).toEqual([]);
    expect(getLogicRuleCompletionIssues({
      conditionType: 'always',
      actionType: 'block',
      targetBlockId: 'coin',
    }, refs)).toContain('Action: Bloc cible introuvable');
  });

  it('flags incomplete timer actions only when the timer is enabled', () => {
    const refs = buildLogicCompletionRefs(makeProject());

    expect(getSceneTimerCompletionIssues({
      timerEnabled: true,
      timerEndAction: 'scene',
      timerTargetSceneId: '',
    }, refs)).toContain('Scène cible du timer manquante');
    expect(getSceneTimerCompletionIssues({
      timerEnabled: true,
      timerEndAction: 'cinematic',
      timerTargetCinematicId: '',
    }, refs)).toContain('Cinématique cible du timer manquante');
    expect(getSceneTimerCompletionIssues({
      timerEnabled: false,
      timerEndAction: 'scene',
      timerTargetSceneId: '',
    }, refs)).toEqual([]);
  });
});
