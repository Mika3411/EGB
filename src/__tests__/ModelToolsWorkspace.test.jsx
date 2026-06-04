import { describe, expect, it } from 'vitest';
import {
  MODEL_TOOL_ACCEPT,
  getModelToolsDisplayError,
  getModelToolsApiUrls,
  getModelToolFileKind,
} from '../domains/rpg3d/model-tools/ModelToolsWorkspace.jsx';

describe('ModelToolsWorkspace file filtering', () => {
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

  it('tries the same-origin model-tools API before direct local fallbacks', () => {
    expect(getModelToolsApiUrls('/jobs')).toEqual([
      '/api/model-tools/jobs',
      'http://localhost:8787/api/model-tools/jobs',
      'http://127.0.0.1:8787/api/model-tools/jobs',
    ]);
  });

  it('replaces raw browser network errors with a user-facing message', () => {
    expect(getModelToolsDisplayError(new TypeError('Failed to fetch'))).toBe(
      'Connexion API locale 3D interrompue. Relance le serveur local puis reessaie.',
    );
    expect(getModelToolsDisplayError('Failed to fetch')).toBe(
      'Optimisation GLB impossible: une ressource du modele n a pas pu etre lue. Reessaie avec un ZIP contenant le modele et toutes ses textures.',
    );
    expect(getModelToolsDisplayError(new TypeError('API locale 3D indisponible: Failed to fetch'))).toBe(
      'Connexion API locale 3D interrompue. Relance le serveur local puis reessaie.',
    );
  });
});
