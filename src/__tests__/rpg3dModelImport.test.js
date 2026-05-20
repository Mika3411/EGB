import { describe, expect, it } from 'vitest';
import { readDecorModelImport, resizeAxesProportionally } from '../utils/rpg3dModelImport.js';

const makeBoxObj = ({ width = 3, height = 2, depth = 4 } = {}) => [
  'o Box',
  'v 0 0 0',
  `v ${width} 0 0`,
  `v ${width} ${height} 0`,
  `v 0 ${height} 0`,
  `v 0 0 ${depth}`,
  `v ${width} 0 ${depth}`,
  `v ${width} ${height} ${depth}`,
  `v 0 ${height} ${depth}`,
  'f 1 2 3 4',
  'f 5 8 7 6',
  'f 1 5 6 2',
  'f 2 6 7 3',
  'f 3 7 8 4',
  'f 4 8 5 1',
].join('\n');

describe('rpg3d model import', () => {
  it('keeps imported decor model bounds as the initial object size', async () => {
    const file = new File([makeBoxObj()], 'cailloux.obj', { type: 'model/obj' });

    const result = await readDecorModelImport(file);

    expect(result.modelDimensions).toMatchObject({
      width: expect.closeTo(3, 5),
      height: expect.closeTo(2, 5),
      depth: expect.closeTo(4, 5),
    });
  });

  it('resizes proportional axes by keeping their current ratio', () => {
    const resized = resizeAxesProportionally({ x: 2, y: 4, z: 8 }, 'x', 5, 0.05, 120);

    expect(resized).toEqual({
      x: 5,
      y: 10,
      z: 20,
    });
  });
});
