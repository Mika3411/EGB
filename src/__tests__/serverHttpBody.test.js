import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';
import { readJsonBody } from '../../server/http.js';

const makeRequest = (chunks, headers = {}) => {
  const request = Readable.from(chunks);
  request.headers = headers;
  return request;
};

describe('server HTTP body parser', () => {
  test('parse un body JSON valide', async () => {
    await expect(readJsonBody(makeRequest(['{"ok":true}'], {
      'content-type': 'application/json',
    }))).resolves.toEqual({ ok: true });
  });

  test('renvoie une erreur 400 stable pour un JSON invalide', async () => {
    await expect(readJsonBody(makeRequest(['{"broken"'], {
      'content-type': 'application/json',
    }))).rejects.toMatchObject({
      status: 400,
      code: 'PAYLOAD_INVALID',
    });
  });

  test('renvoie une erreur 413 sans detruire la requete pour un body trop gros', async () => {
    const request = new EventEmitter();
    request.headers = { 'content-type': 'application/json' };
    request.resume = vi.fn();
    request.destroy = vi.fn();
    const bodyPromise = readJsonBody(request, { maxBytes: 10 });

    request.emit('data', '01234567890');

    await expect(bodyPromise).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(request.destroy).not.toHaveBeenCalled();
    expect(request.resume).toHaveBeenCalled();
  });
});
