import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuickLogicModal from '../components/scenes/QuickLogicModal.jsx';

const makeProject = () => ({
  storyVariables: [{ id: 'var-trust', key: 'trust', type: 'number', defaultValue: 0 }],
  items: [{ id: 'key', icon: '', name: 'Key' }],
  enigmas: [{ id: 'enigma-code', name: 'Code' }],
  cinematics: [],
  combinations: [],
  scenes: [{
    id: 'scene-1',
    name: 'Hall',
    hotspots: [{
      id: 'target',
      name: 'Door',
      actionType: 'dialogue',
      logicRules: [{
        id: 'rule-visited',
        name: 'Visited scene',
        conditionType: 'visited_scene',
        conditionSceneId: 'scene-2',
        actionType: 'dialogue',
      }, {
        id: 'rule-reply',
        name: 'Chosen reply',
        conditionType: 'chose_reply',
        conditionReplyId: 'reply-help',
        actionType: 'dialogue',
      }, {
        id: 'rule-variable',
        name: 'Story variable',
        conditionType: 'story_variable',
        conditionVariableKey: 'trust',
        conditionVariableOperator: 'greater_or_equal',
        conditionVariableValue: '2',
        actionType: 'dialogue',
      }, {
        id: 'rule-advanced',
        name: 'Advanced rule',
        conditionType: 'advanced',
        advancedConditionMode: 'any',
        advancedConditions: [{
          id: 'advanced-variable',
          type: 'story_variable',
          variableKey: 'trust',
          operator: 'truthy',
          value: '',
        }, {
          id: 'advanced-reply',
          type: 'chose_reply',
          replyId: 'reply-help',
        }],
        actionType: 'dialogue',
      }],
    }, {
      id: 'guide',
      name: 'Guide',
      actionType: 'conversation',
      conversation: {
        nodes: [{
          id: 'start',
          text: 'Need help?',
          replies: [{ id: 'reply-help', label: 'Help me' }],
        }],
      },
    }],
    sceneObjects: [{ id: 'panel', name: 'Panel', blockType: 'text' }],
  }, {
    id: 'scene-2',
    name: 'Office',
    hotspots: [],
    sceneObjects: [],
  }],
});

describe('QuickLogicModal', () => {
  it('exposes and configures the advanced logic condition types', () => {
    const { container } = render(
      <QuickLogicModal
        project={makeProject()}
        selectedSceneId="scene-1"
        targetRef={{ type: 'hotspot', id: 'target' }}
        patchProject={vi.fn()}
        handleUpload={vi.fn()}
        onClose={vi.fn()}
        getSceneLabel={(sceneId) => ({ 'scene-1': 'Hall', 'scene-2': 'Office' }[sceneId] || sceneId)}
      />,
    );

    const optionValues = Array.from(container.querySelectorAll('option')).map((option) => option.value);
    expect(optionValues).toEqual(expect.arrayContaining([
      'visited_scene',
      'chose_reply',
      'story_variable',
      'advanced',
    ]));

    const selectValues = Array.from(container.querySelectorAll('select')).map((select) => select.value);
    expect(selectValues).toEqual(expect.arrayContaining([
      'visited_scene',
      'scene-2',
      'chose_reply',
      'reply-help',
      'story_variable',
      'greater_or_equal',
      'advanced',
      'any',
      'truthy',
    ]));
    expect(container.querySelector('datalist#quick-logic-story-variable-keys option[value="trust"]')).toBeTruthy();
    expect(screen.getByText('+ Condition')).toBeTruthy();
  });
});
