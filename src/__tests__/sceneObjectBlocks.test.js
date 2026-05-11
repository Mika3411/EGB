import { describe, expect, it } from 'vitest';
import { applySceneObjectTextOverride } from '../lib/sceneObjectBlocks';

describe('scene object block text overrides', () => {
  it('maps update_text overrides to the visible field for each block kind', () => {
    expect(applySceneObjectTextOverride({
      blockType: 'text',
      blockText: 'Ancien',
      dialogue: 'Ancien',
    }, 'Nouveau')).toMatchObject({
      blockText: 'Nouveau',
      dialogue: 'Nouveau',
    });

    expect(applySceneObjectTextOverride({
      blockType: 'button',
      buttonLabel: 'Ouvrir',
    }, 'Forcer')).toMatchObject({
      buttonLabel: 'Forcer',
    });

    expect(applySceneObjectTextOverride({
      blockType: 'input',
      placeholder: 'Code ?',
    }, 'Mot de passe')).toMatchObject({
      placeholder: 'Mot de passe',
    });

    expect(applySceneObjectTextOverride({
      blockType: 'code',
      blockLabel: 'Code',
      placeholder: 'Entre le code',
    }, 'Terminal')).toMatchObject({
      blockLabel: 'Terminal',
      placeholder: 'Terminal',
    });
  });
});
