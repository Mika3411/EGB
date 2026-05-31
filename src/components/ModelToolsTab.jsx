import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BadgeCheck,
  Download,
  FileArchive,
  HardDrive,
  SlidersHorizontal,
  Upload,
  Wrench,
} from 'lucide-react';
import { formatBytes, optimizeCharacterGlbFile } from '../utils/glbOptimizer';
import {
  getThreeModelArchiveFileFormat,
  getThreeModelFileFormat,
  getThreeModelFormatLabel,
} from '../utils/threeModelUtils.js';

const QUALITY_OPTIONS = [
  { id: 'web', label: 'Jeu fluide', textureSize: 1024, jpegQuality: 0.82 },
  { id: 'quality', label: 'Qualite', textureSize: 2048, jpegQuality: 0.92 },
  { id: 'lite', label: 'Tres leger', textureSize: 512, jpegQuality: 0.74 },
];
const PROGRESS_IDLE = { active: false, value: 0, label: '', detail: '' };
const MODEL_TOOL_MODEL_FORMATS = new Set(['glb', 'fbx']);

export const MODEL_TOOL_ACCEPT = [
  '.glb',
  '.fbx',
  '.zip',
  'model/gltf-binary',
  'application/vnd.autodesk.fbx',
  'model/vnd.fbx',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
].join(',');

const getSafeBaseName = (filename = 'modele') => (
  String(filename || 'modele')
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'modele'
);

const getDispositionFilename = (value = '') => {
  const match = String(value).match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].replace(/^"|"$/g, ''));
  } catch {
    return match[1].replace(/^"|"$/g, '');
  }
};

const MODEL_TOOLS_API_PREFIX = '/api/model-tools';
const MODEL_TOOLS_HEALTH_PATH = '/api/health';
const MODEL_TOOLS_LOCAL_PORT = '8787';
const MODEL_TOOLS_STATUS_RETRY_LIMIT = 8;

const pushUnique = (list, value) => {
  if (value && !list.includes(value)) list.push(value);
};

export const getModelToolsApiUrls = (pathSuffix = '') => {
  const apiPath = `${MODEL_TOOLS_API_PREFIX}${pathSuffix}`;
  if (typeof window === 'undefined') return [apiPath];

  const urls = [];
  pushUnique(urls, apiPath);
  pushUnique(urls, `http://localhost:${MODEL_TOOLS_LOCAL_PORT}${apiPath}`);
  pushUnique(urls, `http://127.0.0.1:${MODEL_TOOLS_LOCAL_PORT}${apiPath}`);
  return urls;
};

const getHealthUrlForApiUrl = (apiUrl = '') => {
  try {
    return `${new URL(apiUrl, window.location.origin).origin}${MODEL_TOOLS_HEALTH_PATH}`;
  } catch {
    return MODEL_TOOLS_HEALTH_PATH;
  }
};

const getModelToolsUnavailableMessage = (error = null) => {
  const message = String(error?.message || '').trim();
  if (!message || message === 'Failed to fetch') {
    return 'API locale 3D indisponible. Relance le serveur local puis reessaie.';
  }
  return `API locale 3D indisponible: ${message}`;
};

export const getModelToolsDisplayError = (error = null, fallback = 'Conversion locale impossible.') => {
  const message = String(error?.message || error || '').trim();
  if (!message) return fallback;
  if (message === 'Failed to fetch') {
    return error instanceof TypeError
      ? 'Connexion API locale 3D interrompue. Relance le serveur local puis reessaie.'
      : 'Optimisation GLB impossible: une ressource du modele n a pas pu etre lue. Reessaie avec un ZIP contenant le modele et toutes ses textures.';
  }
  if (/network\s*error|load\s*failed|connexion interrompue|api locale 3d indisponible/i.test(message)) {
    return 'Connexion API locale 3D interrompue. Relance le serveur local puis reessaie.';
  }
  return message;
};

const isRecoverableModelToolsNetworkError = (error = null) => {
  const message = String(error?.message || error || '').trim();
  return message === 'Failed to fetch'
    || /network\s*error|load\s*failed|connexion interrompue|api locale 3d indisponible/i.test(message);
};

const getReachableModelToolsApiUrls = async (pathSuffix = '') => {
  const urls = getModelToolsApiUrls(pathSuffix);
  if (typeof fetch !== 'function') return urls;

  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetch(getHealthUrlForApiUrl(url), { cache: 'no-store' });
      if (response.ok) {
        return [url, ...urls.filter((candidate) => candidate !== url)];
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(getModelToolsUnavailableMessage(lastError));
};

const fetchModelToolsApi = async (pathSuffix = '', options = {}) => {
  let lastError = null;
  for (const url of getModelToolsApiUrls(pathSuffix)) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(getModelToolsUnavailableMessage(lastError));
};

const triggerDownloadUrl = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const getModelToolFileKind = (file) => {
  const archiveFormat = getThreeModelArchiveFileFormat(file);
  if (archiveFormat) return archiveFormat;
  const modelFormat = getThreeModelFileFormat(file);
  return MODEL_TOOL_MODEL_FORMATS.has(modelFormat) ? modelFormat : '';
};

const getModelToolFormatLabel = (format = '') => (
  format === 'zip' ? 'ZIP' : getThreeModelFormatLabel(format)
);

const getQualitySettings = (qualityId) => (
  QUALITY_OPTIONS.find((option) => option.id === qualityId) || QUALITY_OPTIONS[0]
);

const parseErrorResponse = async (response) => {
  try {
    const payload = await response.json();
    return payload.error || 'Conversion locale impossible.';
  } catch {
    return 'Conversion locale impossible.';
  }
};

const parseErrorBlob = async (blob) => {
  try {
    const text = await blob.text();
    const payload = JSON.parse(text);
    return payload.error || 'Conversion locale impossible.';
  } catch {
    return 'Conversion locale impossible.';
  }
};

const wait = (durationMs) => new Promise((resolve) => window.setTimeout(resolve, durationMs));

const requestLocalConversionJob = async ({ file, quality, onProgress }) => {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('quality', quality);
  const urls = await getReachableModelToolsApiUrls('/jobs');

  return new Promise((resolve, reject) => {
    const sendToUrl = (urlIndex = 0, lastError = '') => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', urls[urlIndex]);
      xhr.responseType = 'text';
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          onProgress?.({ value: 12, label: 'Envoi du fichier...', detail: 'Preparation du transfert local.' });
          return;
        }
        const ratio = event.total ? event.loaded / event.total : 0;
        onProgress?.({
          value: Math.min(35, 5 + ratio * 30),
          label: 'Envoi du fichier...',
          detail: `${formatBytes(event.loaded)} / ${formatBytes(event.total)}`,
        });
      };
      xhr.upload.onload = () => {
        onProgress?.({ value: 31, label: 'Creation du job...', detail: 'Le serveur local prend le relais.' });
      };
      xhr.onerror = () => {
        if (urlIndex + 1 < urls.length) {
          sendToUrl(urlIndex + 1, 'connexion interrompue');
          return;
        }
        reject(new Error(lastError
          ? getModelToolsUnavailableMessage(new Error(lastError))
          : getModelToolsUnavailableMessage()));
      };
      xhr.ontimeout = () => reject(new Error('Conversion trop longue.'));
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          try {
            const payload = JSON.parse(xhr.responseText || '{}');
            reject(new Error(payload.error || 'Conversion locale impossible.'));
          } catch {
            reject(new Error('Conversion locale impossible.'));
          }
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } catch {
          reject(new Error('Reponse locale invalide.'));
        }
      };
      xhr.send(formData);
    };

    sendToUrl();
  });
};

const fetchModelToolJob = async (jobId) => {
  const response = await fetchModelToolsApi(`/jobs/${encodeURIComponent(jobId)}`);
  if (!response.ok) throw new Error(await parseErrorResponse(response));
  return response.json();
};

const downloadModelToolJob = async (jobId) => {
  const response = await fetchModelToolsApi(`/jobs/${encodeURIComponent(jobId)}/download`);
  if (!response.ok) throw new Error(await parseErrorResponse(response));
  const blob = await response.blob();
  return {
    blob,
    headers: response.headers,
  };
};

export default function ModelToolsTab() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [quality, setQuality] = useState('web');
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(PROGRESS_IDLE);
  const progressTimerRef = useRef(null);
  const resultDownloadUrlRef = useRef('');

  const fileKind = useMemo(() => getModelToolFileKind(selectedFile), [selectedFile]);
  const canUseBrowserCompression = fileKind === 'glb';
  const qualitySettings = getQualitySettings(quality);

  const clearResult = useCallback(() => {
    if (resultDownloadUrlRef.current) {
      URL.revokeObjectURL(resultDownloadUrlRef.current);
      resultDownloadUrlRef.current = '';
    }
    setResult(null);
  }, []);

  const saveResultBlob = useCallback((nextResult, blob) => {
    if (resultDownloadUrlRef.current) URL.revokeObjectURL(resultDownloadUrlRef.current);
    const downloadUrl = URL.createObjectURL(blob);
    resultDownloadUrlRef.current = downloadUrl;
    triggerDownloadUrl(downloadUrl, nextResult.filename);
    setResult({
      ...nextResult,
      downloadUrl,
    });
  }, []);

  const stopProgressTicker = useCallback(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressTicker = useCallback((target = 90, label = 'Traitement local...', detail = 'Optimisation en cours.') => {
    stopProgressTicker();
    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (!current.active || current.value >= target) return current;
        const remaining = target - current.value;
        const step = Math.max(0.15, Math.min(1.4, remaining * 0.055));
        return {
          active: true,
          value: Math.min(target, current.value + step),
          label: current.label || label,
          detail,
        };
      });
    }, 650);
  }, [stopProgressTicker]);

  useEffect(() => () => {
    stopProgressTicker();
    if (resultDownloadUrlRef.current) URL.revokeObjectURL(resultDownloadUrlRef.current);
  }, [stopProgressTicker]);

  const handleFileChange = (file) => {
    setSelectedFile(file || null);
    clearResult();
    setProgress(PROGRESS_IDLE);
    if (!file) {
      setStatus('');
      return;
    }
    const nextKind = getModelToolFileKind(file);
    setStatus(nextKind
      ? `${getModelToolFormatLabel(nextKind)} charge: ${formatBytes(file.size)}`
      : 'Format accepte: FBX, GLB ou ZIP avec FBX/GLB.');
  };

  const runLocalConversion = async () => {
    if (!selectedFile || !fileKind || busy) return;
    setBusy(true);
    clearResult();
    setProgress({
      active: true,
      value: 3,
      label: 'Preparation...',
      detail: selectedFile.name || '',
    });
    setStatus(fileKind === 'glb' ? 'Compression locale en cours...' : 'Conversion locale en cours...');
    let jobId = '';
    try {
      const initialJob = await requestLocalConversionJob({
        file: selectedFile,
        quality,
        onProgress: (nextProgress) => {
          setProgress((current) => ({
            active: true,
            value: Math.max(current.value, nextProgress.value),
            label: nextProgress.label,
            detail: nextProgress.detail,
          }));
        },
      });
      jobId = initialJob.id || '';
      let job = initialJob;
      let statusFetchFailures = 0;
      while (job?.status === 'running') {
        setProgress((current) => ({
          active: true,
          value: Math.max(current.value, Number(job.progress) || 0),
          label: job.label || 'Conversion locale...',
          detail: job.detail || 'Traitement en cours.',
        }));
        setStatus(job.label || 'Conversion locale en cours...');
        await wait(1000);
        try {
          job = await fetchModelToolJob(jobId);
          statusFetchFailures = 0;
        } catch (error) {
          if (!isRecoverableModelToolsNetworkError(error) || statusFetchFailures >= MODEL_TOOLS_STATUS_RETRY_LIMIT) {
            throw error;
          }
          statusFetchFailures += 1;
          const detail = `Tentative ${statusFetchFailures}/${MODEL_TOOLS_STATUS_RETRY_LIMIT}`;
          setProgress((current) => ({
            active: true,
            value: Math.max(current.value, Number(job.progress) || 35),
            label: 'Connexion locale...',
            detail,
          }));
          setStatus(`Connexion API locale 3D en reprise... ${detail}`);
        }
      }
      if (job?.status === 'error') {
        throw new Error(getModelToolsDisplayError(job.error || job.detail));
      }
      if (job?.status !== 'done') {
        throw new Error('Etat de conversion local inattendu.');
      }
      setProgress({
        active: true,
        value: 98,
        label: 'Telechargement du GLB...',
        detail: job.filename || 'Sortie GLB',
      });
      const response = await downloadModelToolJob(jobId);
      stopProgressTicker();
      const blob = response.blob;
      const filename = getDispositionFilename(response.headers.get('content-disposition'))
        || `${getSafeBaseName(selectedFile.name)}-web.glb`;
      const originalSize = Number(response.headers.get('x-model-tools-original-size')) || selectedFile.size || 0;
      const outputSize = Number(response.headers.get('x-model-tools-output-size')) || blob.size || 0;
      saveResultBlob({
        mode: 'local',
        filename,
        originalSize,
        outputSize,
        sourceFormat: response.headers.get('x-model-tools-source-format') || fileKind || '',
      }, blob);
      setProgress({
        active: true,
        value: 100,
        label: 'Termine',
        detail: `${formatBytes(originalSize)} -> ${formatBytes(outputSize)}`,
      });
      setStatus(`GLB pret: ${formatBytes(originalSize)} -> ${formatBytes(outputSize)}`);
    } catch (error) {
      stopProgressTicker();
      const errorMessage = getModelToolsDisplayError(error);
      setProgress({
        active: true,
        value: 100,
        label: 'Erreur',
        detail: errorMessage,
      });
      setStatus(errorMessage);
    } finally {
      if (jobId) {
        fetchModelToolsApi(`/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
      }
      setBusy(false);
    }
  };

  const runBrowserGlbCompression = async () => {
    if (!selectedFile || !canUseBrowserCompression || busy) return;
    setBusy(true);
    clearResult();
    setProgress({
      active: true,
      value: 8,
      label: 'Lecture GLB...',
      detail: selectedFile.name || '',
    });
    setStatus('Compression GLB navigateur...');
    try {
      startProgressTicker(88, 'Compression textures...', 'Le navigateur reconstruit le GLB.');
      const optimization = await optimizeCharacterGlbFile(selectedFile, {
        maxTextureSize: qualitySettings.textureSize,
        jpegQuality: qualitySettings.jpegQuality,
        minFileSize: 0,
      });
      stopProgressTicker();
      if (!optimization.optimized) {
        setStatus('GLB deja compact ou textures non compressibles.');
        setProgress({
          active: true,
          value: 100,
          label: 'Termine',
          detail: 'Aucune reduction utile detectee.',
        });
        saveResultBlob({
          mode: 'browser',
          filename: selectedFile.name,
          originalSize: selectedFile.size,
          outputSize: selectedFile.size,
          sourceFormat: 'glb',
        }, selectedFile);
        return;
      }
      const filename = `${getSafeBaseName(selectedFile.name)}-textures.glb`;
      setProgress({
        active: true,
        value: 100,
        label: 'Termine',
        detail: `${formatBytes(optimization.originalSize)} -> ${formatBytes(optimization.optimizedSize)}`,
      });
      saveResultBlob({
        mode: 'browser',
        filename,
        originalSize: optimization.originalSize,
        outputSize: optimization.optimizedSize,
        sourceFormat: 'glb',
      }, optimization.file);
      setStatus(`Textures allegees: ${formatBytes(optimization.originalSize)} -> ${formatBytes(optimization.optimizedSize)}`);
    } catch {
      stopProgressTicker();
      setProgress({
        active: true,
        value: 100,
        label: 'Erreur',
        detail: 'Compression navigateur impossible.',
      });
      setStatus('Compression navigateur impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="model-tools-tab">
      <section className="panel model-tools-main">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker"><Wrench size={14} /> Outils GLB</span>
            <h2>Conversion et compression</h2>
          </div>
        </div>

        <div className="model-tools-file-row">
          <label className="button like secondary-action model-tools-file-button">
            <Upload aria-hidden="true" size={17} />
            <span>{selectedFile ? 'Remplacer fichier' : 'Choisir fichier'}</span>
            <input
              type="file"
              accept={MODEL_TOOL_ACCEPT}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                event.target.value = '';
                handleFileChange(file);
              }}
            />
          </label>
          {selectedFile ? (
            <div className="model-tools-file-meta">
              <strong>{selectedFile.name}</strong>
              <span>{fileKind ? getModelToolFormatLabel(fileKind) : 'Format non pris en charge'} - {formatBytes(selectedFile.size)}</span>
            </div>
          ) : (
            <div className="model-tools-file-meta">
              <strong>FBX, GLB ou ZIP</strong>
              <span>ZIP avec FBX/GLB, traitement local sans upload Supabase.</span>
            </div>
          )}
        </div>

        <div className="model-tools-quality" role="group" aria-label="Qualite de sortie">
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={quality === option.id ? 'active' : ''}
              onClick={() => setQuality(option.id)}
              disabled={busy}
            >
              <SlidersHorizontal aria-hidden="true" size={15} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>

        <div className="model-tools-actions">
          <button
            type="button"
            className="button like"
            onClick={runLocalConversion}
            disabled={!selectedFile || !fileKind || busy}
          >
            <HardDrive aria-hidden="true" size={17} />
            <span>{busy ? 'Traitement...' : 'Convertir local'}</span>
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={runBrowserGlbCompression}
            disabled={!selectedFile || !canUseBrowserCompression || busy}
          >
            <FileArchive aria-hidden="true" size={17} />
            <span>Compression rapide</span>
          </button>
        </div>

        {status ? <p className="model-tools-status" role="status">{status}</p> : null}
        {progress.active ? (
          <div
            className={`model-tools-progress ${progress.label === 'Erreur' ? 'error' : ''}`}
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(progress.value)}
            aria-label={progress.label || 'Progression conversion'}
          >
            <div className="model-tools-progress-head">
              <strong>{progress.label || 'Traitement...'}</strong>
              <span>{Math.round(progress.value)}%</span>
            </div>
            <div className="model-tools-progress-track">
              <span style={{ width: `${Math.max(0, Math.min(100, progress.value))}%` }} />
            </div>
            {progress.detail ? <small>{progress.detail}</small> : null}
          </div>
        ) : null}
      </section>

      <section className="panel model-tools-result">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker"><BadgeCheck size={14} /> Sortie</span>
            <h2>{result ? result.filename : 'Aucun GLB genere'}</h2>
          </div>
        </div>
        <div className="model-tools-result-grid">
          <span>
            <small>Source</small>
            <strong>{result ? getModelToolFormatLabel(result.sourceFormat) : '-'}</strong>
          </span>
          <span>
            <small>Avant</small>
            <strong>{result ? formatBytes(result.originalSize) : '-'}</strong>
          </span>
          <span>
            <small>Apres</small>
            <strong>{result ? formatBytes(result.outputSize) : '-'}</strong>
          </span>
          <span>
            <small>Mode</small>
            <strong>{result?.mode === 'browser' ? 'Navigateur' : result ? 'Local' : '-'}</strong>
          </span>
        </div>
        {result ? (
          <div className="model-tools-output-actions">
            <p className="model-tools-done">
              <Download aria-hidden="true" size={15} />
              <span>Telecharge dans le dossier Telechargements du navigateur.</span>
            </p>
            <a className="button like model-tools-download-link" href={result.downloadUrl} download={result.filename}>
              <Download aria-hidden="true" size={15} />
              <span>Telecharger a nouveau</span>
            </a>
            <small>Nom du fichier: {result.filename}</small>
          </div>
        ) : null}
      </section>
    </main>
  );
}
