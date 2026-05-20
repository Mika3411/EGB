import { describe, expect, it } from 'vitest';
import {
  MODEL_TOOL_ACCEPT,
  getModelToolFileKind,
} from '../components/ModelToolsTab.jsx';

describe('ModelToolsTab file filtering', () => {
  it('keeps OBJ out of the GLB conversion tool file picker', () => {
    const accepted = MODEL_TOOL_ACCEPT.split(',');

    expect(accepted).toEqual(expect.arrayContaining([
      '.glb',
      '.fbx',
      '.zip',
      'model/gltf-binary',
      'application/vnd.autodesk.fbx',
    ]));
    expect(accepted).not.toContain('.obj');
    expect(accepted).not.toContain('model/obj');
  });

  it('disables direct OBJ files while still accepting GLB, FBX and ZIP inputs', () => {
    expect(getModelToolFileKind(new File(['glb'], 'hero.glb', { type: 'model/gltf-binary' }))).toBe('glb');
    expect(getModelToolFileKind(new File(['fbx'], 'hero.fbx', { type: 'application/octet-stream' }))).toBe('fbx');
    expect(getModelToolFileKind(new File(['zip'], 'hero.zip', { type: 'application/zip' }))).toBe('zip');
    expect(getModelToolFileKind(new File(['obj'], 'decor.obj', { type: 'text/plain' }))).toBe('');
  });
});
