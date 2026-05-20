import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  DEFAULT_ENGINE,
  addProp,
  getStaticSceneSignature,
} from '../components/arcade/rpg3dSceneBuilders.js';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';

const createSceneConfig = () => {
  const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
  config.world = { width: 500, height: 400, grid: 100 };
  config.props = [];
  return config;
};

describe('rpg3d scene builders', () => {
  it('keeps floor textures in repeated mode on the map', () => {
    const config = createSceneConfig();
    const group = new THREE.Group();
    const getTexture = vi.fn(() => new THREE.Texture());
    const floor = {
      id: 'floor-texture-1',
      x: 250,
      y: 200,
      w: 240,
      h: 160,
      r: 120,
      renderMode: 'floor',
      imageData: 'data:image/png;base64,texture',
      repeatTexture: false,
    };

    addProp(group, config, floor, DEFAULT_ENGINE, false, getTexture, () => null);

    expect(getTexture).toHaveBeenCalledWith(floor.imageData, true);
  });

  it('keeps GLB material brightness out of the static rebuild signature', () => {
    const config = createSceneConfig();
    config.props = [{
      id: 'statue-1',
      x: 250,
      y: 200,
      w: 120,
      h: 120,
      decorModelUrl: 'statue.glb',
      materialBrightness: 0.55,
    }];
    const signature = getStaticSceneSignature(config);

    config.props[0].materialBrightness = 1.2;

    expect(getStaticSceneSignature(config)).toBe(signature);
  });
});
