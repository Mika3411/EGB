import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import LogicTab from '../components/LogicTab.jsx';

const makeProject = () => ({
  title: 'Projet logique',
  creationMode: 'expert',
  acts: [{ id: 'act-1', name: 'Acte I' }],
  items: [{ id: 'key', icon: 'K', name: 'Clé' }],
  cinematics: [{ id: 'cinematic-1', name: 'Bureau' }],
  enigmas: [],
  combinations: [],
  scenes: [{
    id: 'scene-1',
    actId: 'act-1',
    name: 'Bureau',
    hotspots: [{
      id: 'door',
      name: 'Porte',
      actionType: 'dialogue',
      logicRules: [{
        id: 'rule-1',
        name: 'Change de scène bureau 2',
        conditionType: 'launched_cinematic',
        cinematicId: 'cinematic-1',
        actionType: 'scene',
        targetSceneId: 'scene-2',
        dialogue: 'Un coffre fort caché ...',
      }],
    }],
    sceneObjects: [],
  }, {
    id: 'scene-2',
    actId: 'act-1',
    name: 'Bureau 2',
    hotspots: [],
    sceneObjects: [],
  }],
});

describe('LogicTab UX layout', () => {
  afterEach(() => {
    cleanup();
  });

  it('presents a rule as a readable if-then-else flow', () => {
    render(
      <LogicTab
        project={makeProject()}
        patchProject={() => {}}
        handleUpload={() => {}}
        getSceneLabel={(sceneId) => (sceneId === 'scene-2' ? 'Acte I · Bureau 2' : 'Acte I · Bureau')}
        selectedSceneId="scene-1"
      />,
    );

    expect(screen.getByText('Si')).toBeTruthy();
    expect(screen.getByText('cette condition est respectée')).toBeTruthy();
    expect(screen.getByText('Alors')).toBeTruthy();
    expect(screen.getByText('cette action est déclenchée')).toBeTruthy();
    expect(screen.getByText('Sinon')).toBeTruthy();
    expect(screen.getByText('si la condition n’est pas remplie')).toBeTruthy();
    expect(screen.getByText('Scène cible')).toBeTruthy();
    expect(screen.getByDisplayValue('Un coffre fort caché ...')).toBeTruthy();
  });
});
