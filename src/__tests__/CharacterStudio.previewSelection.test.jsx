import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CharacterStudio from '../domains/characters/CharacterStudio.jsx';

vi.mock('../domains/characters/preview/Character3DPreview.jsx', () => ({
  default: ({ animationSlot = '', autoPreviewAnimation = true, children, model = {} }) => {
    const inventory = Array.isArray(model.inventory) ? model.inventory : [];
    const weapon = inventory.find((item) => item?.type === 'weapon');
    const helmet = inventory.find((item) => item?.type === 'helmet');
    const shield = inventory.find((item) => item?.type === 'shield');
    const leggings = inventory.find((item) => item?.type === 'leggings');
    return (
      <div
        data-testid="character-preview"
        data-animation-slot={animationSlot}
        data-auto-preview-animation={String(autoPreviewAnimation)}
        data-inventory-count={String(inventory.length)}
        data-weapon-source={weapon?.weaponModelUrl || ''}
        data-helmet-source={helmet?.weaponModelUrl || ''}
        data-helmet-mouth-enabled={helmet?.armorGripMouthEnabled ? 'true' : 'false'}
        data-helmet-mouth-y={String(helmet?.armorGripMouthY ?? '')}
        data-shield-source={shield?.weaponModelUrl || ''}
        data-leggings-source={leggings?.weaponModelUrl || ''}
        data-leggings-left-knee-enabled={leggings?.armorGripLeftKneeEnabled ? 'true' : 'false'}
        data-leggings-left-knee-y={String(leggings?.armorGripLeftKneeY ?? '')}
      >
        {children}
      </div>
    );
  },
}));

afterEach(() => {
  cleanup();
});

const makeProject = () => ({
  decorModels3d: [],
  characterModels3d: [
    {
      id: 'hero',
      name: 'Hero test',
      role: 'hero',
      shape: 'glb',
      modelUrl: 'blob:hero-model',
      modelName: 'hero.glb',
      modelFormat: 'glb',
      modelAnimations: {
        idle: {
          modelUrl: 'blob:hero-idle',
          modelName: 'idle.glb',
          modelFormat: 'glb',
        },
        walk: {
          modelUrl: 'blob:hero-walk',
          modelName: 'walk.glb',
          modelFormat: 'glb',
        },
        attack: {
          modelUrl: 'blob:hero-attack',
          modelName: 'attack.glb',
          modelFormat: 'glb',
        },
      },
    },
  ],
});

describe('CharacterStudio preview selection', () => {
  it('keeps only the clicked preview selected', async () => {
    render(
      <CharacterStudio
        project={makeProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');
    const [modelPreview, classicPreview, walkPreview, attackPreview] = screen.getAllByRole('button', { name: 'Apercu' });

    expect(preview.getAttribute('data-auto-preview-animation')).toBe('false');
    expect(preview.getAttribute('data-animation-slot')).toBe('');
    expect(screen.queryByText('Remplacer stand-by')).toBeNull();
    expect(screen.getByText('Ajouter stand-by')).toBeTruthy();
    expect(screen.getByText('Ajouter marche')).toBeTruthy();
    expect(screen.getByText('Ajouter attaque')).toBeTruthy();
    expect(modelPreview.classList.contains('active')).toBe(true);
    expect(classicPreview.classList.contains('active')).toBe(false);
    expect(walkPreview.classList.contains('active')).toBe(false);
    expect(attackPreview.classList.contains('active')).toBe(false);

    fireEvent.click(classicPreview);

    expect(preview.getAttribute('data-animation-slot')).toBe('idle');
    expect(modelPreview.classList.contains('active')).toBe(false);
    expect(classicPreview.classList.contains('active')).toBe(true);
    expect(walkPreview.classList.contains('active')).toBe(false);
    expect(attackPreview.classList.contains('active')).toBe(false);

    fireEvent.click(walkPreview);

    expect(preview.getAttribute('data-animation-slot')).toBe('walk');
    expect(modelPreview.classList.contains('active')).toBe(false);
    expect(classicPreview.classList.contains('active')).toBe(false);
    expect(walkPreview.classList.contains('active')).toBe(true);
    expect(attackPreview.classList.contains('active')).toBe(false);

    fireEvent.click(attackPreview);

    expect(preview.getAttribute('data-animation-slot')).toBe('attack');
    expect(modelPreview.classList.contains('active')).toBe(false);
    expect(classicPreview.classList.contains('active')).toBe(false);
    expect(walkPreview.classList.contains('active')).toBe(false);
    expect(attackPreview.classList.contains('active')).toBe(true);

    fireEvent.click(attackPreview);

    expect(preview.getAttribute('data-animation-slot')).toBe('');
    expect(modelPreview.classList.contains('active')).toBe(true);
    expect(classicPreview.classList.contains('active')).toBe(false);
    expect(walkPreview.classList.contains('active')).toBe(false);
    expect(attackPreview.classList.contains('active')).toBe(false);
  });

  it('does not preview a stale direct weapon url when the selected model is Aucun', async () => {
    const project = makeProject();
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-weapon',
        type: 'weapon',
        name: 'Arme',
        equipped: true,
        weaponModel3dId: '',
        weaponModelUrl: 'blob:stale-sword',
        weaponModelName: 'old-sword.glb',
        weaponModelScale: 1.2,
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-inventory-count')).toBe('0');
    expect(preview.getAttribute('data-weapon-source')).toBe('');
    expect(screen.queryByText('Main')).toBeNull();
  });

  it('does not show tuning controls for a selected weapon', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'sword',
        kind: 'inventory-weapon',
        name: 'Sword',
        modelUrl: 'blob:sword-model',
        modelName: 'sword.glb',
        modelFormat: 'glb',
      },
    ];
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-weapon',
        type: 'weapon',
        name: 'Arme',
        equipped: true,
        weaponModel3dId: 'sword',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-inventory-count')).toBe('1');
    expect(preview.getAttribute('data-weapon-source')).toBe('blob:sword-model');
    expect(screen.queryByText('Main')).toBeNull();
    expect(screen.queryByText('Taille')).toBeNull();
    expect(screen.queryByText('Offset X')).toBeNull();
    expect(screen.queryByText('Rot X')).toBeNull();
  });

  it('keeps legacy named weapon and shield models in the equipment lists', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'legacy-sword',
        kind: 'decor',
        name: 'Old sword',
        modelUrl: 'blob:legacy-sword',
        modelName: 'old-sword.glb',
        modelFormat: 'glb',
      },
      {
        id: 'legacy-shield',
        kind: 'decor',
        name: 'Old shield',
        modelUrl: 'blob:legacy-shield',
        modelName: 'old-shield.glb',
        modelFormat: 'glb',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    await screen.findByTestId('character-preview');

    expect(screen.getAllByRole('option', { name: 'Old sword' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Old shield' }).length).toBeGreaterThan(0);
  });

  it('keeps generic existing 3D objects in equipment lists as fallback choices', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'generic-object',
        kind: 'decor',
        name: 'Imported object',
        modelUrl: 'blob:generic-object',
        modelName: 'object.glb',
        modelFormat: 'glb',
      },
      {
        id: 'local-object',
        kind: 'decor',
        name: 'Local object',
        localModelFileId: 'decor-local-object',
        modelName: 'local-object.glb',
        modelFormat: 'glb',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    await screen.findByTestId('character-preview');

    expect(screen.getAllByRole('option', { name: 'Imported object' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Local object' }).length).toBeGreaterThan(0);
  });

  it('previews selected legacy named equipment models', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'legacy-sword',
        kind: 'decor',
        name: 'Old sword',
        modelUrl: 'blob:legacy-sword',
        modelName: 'old-sword.glb',
        modelFormat: 'glb',
      },
    ];
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-weapon',
        type: 'weapon',
        name: 'Arme',
        equipped: true,
        weaponModel3dId: 'legacy-sword',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-inventory-count')).toBe('1');
    expect(preview.getAttribute('data-weapon-source')).toBe('blob:legacy-sword');
  });

  it('adds helmets as character equipment from 3D inventory objects', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'helmet',
        kind: 'inventory-helmet',
        name: 'Steel helmet',
        modelUrl: 'blob:helmet-model',
        modelName: 'helmet.glb',
        modelFormat: 'glb',
        width: 0.7,
        height: 0.55,
        depth: 0.8,
        modelRotationY: 25,
        armorGripMouthEnabled: true,
        armorGripMouthX: 0,
        armorGripMouthY: -0.32,
        armorGripMouthZ: 0.18,
      },
    ];
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-helmet',
        type: 'helmet',
        name: 'Casque',
        equipped: true,
        weaponModel3dId: 'helmet',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-inventory-count')).toBe('1');
    expect(preview.getAttribute('data-helmet-source')).toBe('blob:helmet-model');
    expect(preview.getAttribute('data-helmet-mouth-enabled')).toBe('true');
    expect(preview.getAttribute('data-helmet-mouth-y')).toBe('-0.32');
    expect(screen.getByText('Casque')).toBeTruthy();
  });

  it('adds leggings as character equipment from 3D inventory objects', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'leggings',
        kind: 'inventory-leggings',
        name: 'Steel leggings',
        modelUrl: 'blob:leggings-model',
        modelName: 'leggings.glb',
        modelFormat: 'glb',
        width: 0.8,
        height: 1.1,
        depth: 0.6,
        armorGripLeftKneeEnabled: true,
        armorGripLeftKneeX: -0.22,
        armorGripLeftKneeY: -0.7,
        armorGripLeftKneeZ: 0.05,
      },
    ];
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-leggings',
        type: 'leggings',
        name: 'Jambieres',
        equipped: true,
        weaponModel3dId: 'leggings',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-inventory-count')).toBe('1');
    expect(preview.getAttribute('data-leggings-source')).toBe('blob:leggings-model');
    expect(preview.getAttribute('data-leggings-left-knee-enabled')).toBe('true');
    expect(preview.getAttribute('data-leggings-left-knee-y')).toBe('-0.7');
    expect(screen.getByText('Jambieres')).toBeTruthy();
  });

  it('previews selected shield models without per-character tuning controls', async () => {
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'shield',
        kind: 'inventory-shield',
        name: 'Shield',
        modelUrl: 'blob:shield-model',
        modelName: 'shield.glb',
        modelFormat: 'glb',
      },
    ];
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-shield',
        type: 'shield',
        name: 'Bouclier',
        equipped: true,
        weaponModel3dId: 'shield',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-shield-source')).toBe('blob:shield-model');
    expect(screen.queryByText('Bras')).toBeNull();
    expect(screen.queryByText('Taille')).toBeNull();
    expect(screen.queryByText('Offset X')).toBeNull();
    expect(screen.queryByText('Rot X')).toBeNull();
  });

  it('does not show shield tuning when the selected model is missing from the list', async () => {
    const project = makeProject();
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = structuredClone(project);
      updater(draft);
      patchedProject = draft;
    });
    project.characterModels3d[0].inventory = [
      {
        id: 'character-equipment-shield',
        type: 'shield',
        name: 'Bouclier',
        equipped: true,
        weaponModel3dId: 'missing-shield',
        weaponModelUrl: 'blob:old-shield',
        weaponModelScale: 0.85,
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={patchProject}
      />,
    );

    await screen.findByTestId('character-preview');

    await waitFor(() => expect(patchProject).toHaveBeenCalled());
    expect(patchedProject.characterModels3d[0].inventory).toEqual([]);
    expect(screen.queryByText('Bras')).toBeNull();
    expect(screen.queryByText('Taille')).toBeNull();
    expect(screen.queryByText('Offset X')).toBeNull();
    expect(screen.queryByText('Rot X')).toBeNull();
  });

  it('previews a rig-object test without saving it as character equipment', async () => {
    const onPreviewEquipmentTestClear = vi.fn();
    const patchProject = vi.fn();
    const project = makeProject();
    project.decorModels3d = [
      {
        id: 'rig-sword',
        kind: 'inventory-weapon',
        name: 'Rig sword',
        modelUrl: 'blob:rig-sword-model',
        modelName: 'rig-sword.glb',
        modelFormat: 'glb',
      },
    ];

    render(
      <CharacterStudio
        project={project}
        patchProject={patchProject}
        previewEquipmentTest={{ decorModelId: 'rig-sword', characterModelId: 'hero', type: 'weapon' }}
        onPreviewEquipmentTestClear={onPreviewEquipmentTestClear}
      />,
    );

    const preview = await screen.findByTestId('character-preview');

    expect(preview.getAttribute('data-inventory-count')).toBe('1');
    expect(preview.getAttribute('data-weapon-source')).toBe('blob:rig-sword-model');
    expect(project.characterModels3d[0].inventory).toBeUndefined();

    fireEvent.change(screen.getAllByLabelText('Modele')[0], { target: { value: '' } });

    expect(onPreviewEquipmentTestClear).toHaveBeenCalledTimes(1);
    expect(patchProject).toHaveBeenCalledTimes(1);
  });
});
