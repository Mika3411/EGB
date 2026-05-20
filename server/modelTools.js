import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { makeCorsHeaders } from '../src/utils/corsConfig.js';

const MODEL_TOOL_MAX_BYTES = 350 * 1024 * 1024;
const MODEL_TOOL_TIMEOUT_MS = 30 * 60 * 1000;
const MODEL_TOOL_JOB_TTL_MS = 60 * 60 * 1000;
const MODEL_EXTENSIONS = new Set(['.glb', '.fbx']);
const modelToolJobs = new Map();

const makeHttpError = (message, status = 500, code = 'MODEL_TOOL_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const safeFilename = (value = 'modele.glb') => (
  String(value || 'modele.glb')
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'modele.glb'
);

const baseName = (filename = 'modele') => safeFilename(filename).replace(/\.[^.]+$/, '') || 'modele';

const sendToolJson = (req, res, status, payload) => {
  res.writeHead(status, makeCorsHeaders(req.headers || {}, process.env, {
    'Content-Type': 'application/json; charset=utf-8',
  }));
  res.end(JSON.stringify(payload));
};

const publicJob = (job = {}) => ({
  id: job.id,
  status: job.status,
  progress: Math.max(0, Math.min(100, Math.round(Number(job.progress) || 0))),
  label: job.label || '',
  detail: job.detail || '',
  error: job.error || '',
  filename: job.filename || '',
  originalSize: job.originalSize || 0,
  outputSize: job.outputSize || 0,
  sourceFormat: job.sourceFormat || '',
  createdAt: job.createdAt || 0,
  updatedAt: job.updatedAt || 0,
});

const updateJob = (jobId, patch = {}) => {
  const job = modelToolJobs.get(jobId);
  if (!job) return null;
  const nextPatch = { ...patch };
  if (Number.isFinite(Number(nextPatch.progress))) {
    nextPatch.progress = Math.max(Number(job.progress) || 0, Number(nextPatch.progress));
  }
  Object.assign(job, nextPatch, { updatedAt: Date.now() });
  return job;
};

const cleanupJob = async (jobId) => {
  const job = modelToolJobs.get(jobId);
  if (!job) return;
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
  modelToolJobs.delete(jobId);
  if (job.workDir) await fs.rm(job.workDir, { recursive: true, force: true }).catch(() => {});
};

const scheduleJobCleanup = (jobId, delayMs = MODEL_TOOL_JOB_TTL_MS) => {
  const job = modelToolJobs.get(jobId);
  if (!job) return;
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
  job.cleanupTimer = setTimeout(() => {
    cleanupJob(jobId).catch(() => {});
  }, delayMs);
};

const readRequestBuffer = (req, maxBytes = MODEL_TOOL_MAX_BYTES) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;
  let settled = false;

  const rejectOnce = (error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };

  req.on('data', (chunk) => {
    if (settled) return;
    total += chunk.byteLength;
    if (total > maxBytes) {
      req.resume?.();
      rejectOnce(makeHttpError('Fichier trop volumineux pour l outil local.', 413, 'MODEL_TOOL_PAYLOAD_TOO_LARGE'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (settled) return;
    settled = true;
    resolve(Buffer.concat(chunks, total));
  });
  req.on('error', rejectOnce);
});

const parseContentDisposition = (value = '') => {
  const result = {};
  String(value).split(';').forEach((part) => {
    const [rawKey, ...rawValueParts] = part.trim().split('=');
    const key = rawKey?.trim().toLowerCase();
    if (!key || !rawValueParts.length) return;
    const rawValue = rawValueParts.join('=').trim();
    result[key] = rawValue.replace(/^"|"$/g, '');
  });
  return result;
};

const parseMultipartBody = (body, contentType = '') => {
  const boundary = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1]
    || String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
  if (!boundary) throw makeHttpError('Formulaire local invalide.', 400, 'MODEL_TOOL_MULTIPART_INVALID');

  const boundaryBytes = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = body.indexOf(boundaryBytes);

  while (cursor >= 0) {
    let start = cursor + boundaryBytes.length;
    const isFinal = body.slice(start, start + 2).toString('latin1') === '--';
    if (isFinal) break;
    if (body.slice(start, start + 2).toString('latin1') === '\r\n') start += 2;

    const next = body.indexOf(boundaryBytes, start);
    if (next < 0) break;
    let end = next;
    if (body.slice(end - 2, end).toString('latin1') === '\r\n') end -= 2;
    parts.push(body.slice(start, end));
    cursor = next;
  }

  const fields = {};
  const files = {};
  parts.forEach((part) => {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd < 0) return;
    const headerText = part.slice(0, headerEnd).toString('latin1');
    const data = part.slice(headerEnd + 4);
    const headers = {};
    headerText.split('\r\n').forEach((line) => {
      const separator = line.indexOf(':');
      if (separator < 0) return;
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    });
    const disposition = parseContentDisposition(headers['content-disposition']);
    const name = disposition.name;
    if (!name) return;
    if (disposition.filename) {
      files[name] = {
        filename: disposition.filename,
        contentType: headers['content-type'] || 'application/octet-stream',
        data,
      };
      return;
    }
    fields[name] = data.toString('utf8');
  });

  return { fields, files };
};

const findBlenderExecutable = async () => {
  const candidates = [
    process.env.BLENDER_PATH,
    'G:\\blender\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.4\\blender.exe',
    'C:\\Program Files\\Blender Foundation\\Blender 4.3\\blender.exe',
    'blender',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === 'blender') return candidate;
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue looking.
    }
  }

  throw makeHttpError(
    'Blender est introuvable. Definis BLENDER_PATH ou installe Blender localement.',
    503,
    'MODEL_TOOL_BLENDER_MISSING',
  );
};

const runCommand = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env || {}) },
    shell: Boolean(options.shell),
    windowsHide: true,
  });
  let output = '';
  let errorOutput = '';
  let liveProgress = Number(options.progressStart) || 0;
  const progressMax = Number(options.progressMax) || 0;
  const clearTimers = () => {
    clearTimeout(timeout);
    if (progressTimer) clearInterval(progressTimer);
  };
  const timeout = setTimeout(() => {
    clearTimers();
    child.kill('SIGKILL');
    reject(makeHttpError('Conversion trop longue. Essaie un fichier plus leger ou reduis les textures.', 504, 'MODEL_TOOL_TIMEOUT'));
  }, options.timeoutMs || MODEL_TOOL_TIMEOUT_MS);
  const progressTimer = options.onProgress && progressMax > liveProgress
    ? setInterval(() => {
      const remaining = progressMax - liveProgress;
      liveProgress = Math.min(progressMax, liveProgress + Math.max(0.1, Math.min(1.2, remaining * 0.045)));
      options.onProgress(liveProgress);
    }, 1200)
    : null;

  const appendOutput = (target, chunk) => {
    const next = `${target}${chunk.toString('utf8')}`;
    return next.length > 12000 ? next.slice(-12000) : next;
  };

  child.stdout.on('data', (chunk) => {
    output = appendOutput(output, chunk);
  });
  child.stderr.on('data', (chunk) => {
    errorOutput = appendOutput(errorOutput, chunk);
  });
  child.on('error', (error) => {
    clearTimers();
    reject(error);
  });
  child.on('exit', (code) => {
    clearTimers();
    if (code === 0) {
      resolve({ output, errorOutput });
      return;
    }
    const detail = [errorOutput.trim(), output.trim()].filter(Boolean).join('\n').trim();
    const commandLabel = options.label || path.basename(command);
    reject(makeHttpError(
      `${commandLabel} a echoue${Number.isFinite(Number(code)) ? ` (code ${code})` : ''}.${detail ? ` ${detail}` : ''}`,
      500,
      'MODEL_TOOL_COMMAND_FAILED',
    ));
  });
});

const blenderScript = `
import bpy
import sys

argv = sys.argv
separator = argv.index('--')
input_path = argv[separator + 1]
output_path = argv[separator + 2]

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
bpy.ops.import_scene.fbx(filepath=input_path)
for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0] if bpy.context.selected_objects else None
bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True)
`;

const convertFbxWithBlender = async (inputPath, outputPath, workDir, progressOptions = {}) => {
  const blenderPath = await findBlenderExecutable();
  const scriptPath = path.join(workDir, 'fbx_to_glb.py');
  await fs.writeFile(scriptPath, blenderScript, 'utf8');
  await runCommand(blenderPath, ['--background', '--python', scriptPath, '--', inputPath, outputPath], {
    ...progressOptions,
    timeoutMs: MODEL_TOOL_TIMEOUT_MS,
  });
};

const getNpxCommand = () => (process.platform === 'win32' ? 'npx.cmd' : 'npx');

const getLocalGltfTransformCliPath = () => fileURLToPath(
  new URL('../node_modules/@gltf-transform/cli/bin/cli.js', import.meta.url),
);

const getGltfTransformCommand = async () => {
  const localCliPath = getLocalGltfTransformCliPath();
  try {
    await fs.access(localCliPath);
    return {
      command: process.execPath,
      argsPrefix: [localCliPath],
      shell: false,
      label: 'gltf-transform',
    };
  } catch {
    return {
      command: getNpxCommand(),
      argsPrefix: ['--yes', '@gltf-transform/cli'],
      shell: process.platform === 'win32',
      label: 'npx @gltf-transform/cli',
    };
  }
};

const optimizeGlb = async (inputPath, outputPath, settings = {}, progressOptions = {}) => {
  const textureSize = Math.max(256, Math.min(4096, Number(settings.textureSize) || 1024));
  const simplify = settings.simplify !== false;
  const simplifyRatio = Math.max(0.25, Math.min(1, Number(settings.simplifyRatio) || 0.75));
  const gltfTransform = await getGltfTransformCommand();
  const args = [
    ...gltfTransform.argsPrefix,
    'optimize',
    inputPath,
    outputPath,
    '--compress',
    'meshopt',
    '--texture-compress',
    'webp',
    '--texture-size',
    String(textureSize),
    '--meshopt-level',
    'high',
    '--simplify',
    simplify ? 'true' : 'false',
  ];
  if (simplify) args.push('--simplify-ratio', String(simplifyRatio));
  await runCommand(gltfTransform.command, args, {
    ...progressOptions,
    shell: gltfTransform.shell,
    label: gltfTransform.label,
    timeoutMs: MODEL_TOOL_TIMEOUT_MS,
  });
};

const writeUploadedModel = async (file, workDir) => {
  const filename = safeFilename(file.filename || 'modele');
  const extension = path.extname(filename).toLowerCase();
  const inputDir = path.join(workDir, 'input');
  await fs.mkdir(inputDir, { recursive: true });

  if (extension === '.zip') {
    const zipRoot = path.join(inputDir, 'zip');
    await fs.mkdir(zipRoot, { recursive: true });
    const zip = await JSZip.loadAsync(file.data);
    const modelEntries = [];

    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      const normalizedName = entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalizedName || normalizedName.split('/').includes('..')) continue;
      const targetPath = path.resolve(zipRoot, normalizedName);
      if (!targetPath.startsWith(path.resolve(zipRoot))) continue;
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, Buffer.from(await entry.async('uint8array')));
      const entryExtension = path.extname(normalizedName).toLowerCase();
      if (MODEL_EXTENSIONS.has(entryExtension)) modelEntries.push(targetPath);
    }

    const selectedModel = modelEntries.find((entry) => path.extname(entry).toLowerCase() === '.fbx')
      || modelEntries.find((entry) => path.extname(entry).toLowerCase() === '.glb');
    if (!selectedModel) {
      throw makeHttpError('Le ZIP doit contenir un FBX ou un GLB.', 400, 'MODEL_TOOL_ZIP_WITHOUT_MODEL');
    }
    return {
      inputPath: selectedModel,
      sourceFormat: path.extname(selectedModel).slice(1).toLowerCase(),
      sourceName: path.basename(selectedModel),
      originalSize: file.data.byteLength,
    };
  }

  if (!MODEL_EXTENSIONS.has(extension)) {
    throw makeHttpError('Format accepte: .fbx, .glb ou .zip.', 400, 'MODEL_TOOL_FORMAT_UNSUPPORTED');
  }

  const inputPath = path.join(inputDir, filename);
  await fs.writeFile(inputPath, file.data);
  return {
    inputPath,
    sourceFormat: extension.slice(1),
    sourceName: filename,
    originalSize: file.data.byteLength,
  };
};

const qualitySettings = (quality = 'web') => {
  if (quality === 'quality') return { textureSize: 2048, simplify: false, simplifyRatio: 1 };
  if (quality === 'lite') return { textureSize: 512, simplify: true, simplifyRatio: 0.55 };
  return { textureSize: 1024, simplify: true, simplifyRatio: 0.75 };
};

const prepareUploadedToolRequest = async (req) => {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw makeHttpError('Envoie le fichier via FormData.', 400, 'MODEL_TOOL_FORMDATA_REQUIRED');
  }
  const { fields, files } = parseMultipartBody(await readRequestBuffer(req), contentType);
  const uploadedFile = files.file;
  if (!uploadedFile?.data?.byteLength) {
    throw makeHttpError('Aucun fichier 3D recu.', 400, 'MODEL_TOOL_FILE_MISSING');
  }
  return { fields, uploadedFile };
};

const buildOptimizedGlb = async (uploadedFile, fields, workDir, onProgress = () => {}) => {
  onProgress({ progress: 12, label: 'Preparation...', detail: 'Lecture du fichier.' });
  const source = await writeUploadedModel(uploadedFile, workDir);
  const convertedPath = path.join(workDir, `${baseName(source.sourceName)}-converted.glb`);
  const optimizedPath = path.join(workDir, `${baseName(source.sourceName)}-web.glb`);
  onProgress({
    progress: 24,
    label: source.sourceFormat === 'fbx' ? 'FBX prepare...' : 'GLB prepare...',
    detail: source.sourceFormat === 'zip' ? 'Archive extraite.' : source.sourceName,
  });

  if (source.sourceFormat === 'fbx') {
    onProgress({ progress: 34, label: 'Conversion Blender...', detail: 'Import FBX puis export GLB.' });
    await convertFbxWithBlender(source.inputPath, convertedPath, workDir, {
      progressStart: 34,
      progressMax: 66,
      onProgress: (progress) => onProgress({ progress, label: 'Conversion Blender...', detail: 'Import FBX puis export GLB.' }),
    });
  } else {
    await fs.copyFile(source.inputPath, convertedPath);
  }

  onProgress({ progress: 70, label: 'Optimisation GLB...', detail: 'Compression Meshopt/WebP.' });
  await optimizeGlb(convertedPath, optimizedPath, qualitySettings(fields.quality || 'web'), {
    progressStart: 70,
    progressMax: 96,
    onProgress: (progress) => onProgress({ progress, label: 'Optimisation GLB...', detail: 'Compression Meshopt/WebP.' }),
  });
  const outputStats = await fs.stat(optimizedPath);
  const outputName = `${baseName(uploadedFile.filename || source.sourceName)}-web.glb`;
  onProgress({ progress: 99, label: 'GLB pret...', detail: outputName });
  return {
    outputPath: optimizedPath,
    outputName,
    originalSize: source.originalSize || uploadedFile.data.byteLength,
    outputSize: outputStats.size,
    sourceFormat: source.sourceFormat,
  };
};

const handleSyncConversion = async (req, res) => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'escape-model-tools-'));
  try {
    const { fields, uploadedFile } = await prepareUploadedToolRequest(req);
    const result = await buildOptimizedGlb(uploadedFile, fields, workDir);
    const output = await fs.readFile(result.outputPath);
    const headers = makeCorsHeaders(req.headers || {}, process.env, {
      'Content-Type': 'model/gltf-binary',
      'Content-Disposition': `attachment; filename="${result.outputName}"`,
      'Content-Length': String(output.byteLength),
      'Access-Control-Expose-Headers': 'Content-Disposition,X-Model-Tools-Original-Size,X-Model-Tools-Output-Size,X-Model-Tools-Source-Format',
      'X-Model-Tools-Original-Size': String(result.originalSize),
      'X-Model-Tools-Output-Size': String(output.byteLength),
      'X-Model-Tools-Source-Format': result.sourceFormat,
    });
    res.writeHead(200, headers);
    res.end(output);
  } finally {
    fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
};

const runModelToolJob = async (jobId, uploadedFile, fields) => {
  const job = modelToolJobs.get(jobId);
  if (!job) return;
  try {
    const result = await buildOptimizedGlb(uploadedFile, fields, job.workDir, (progress) => {
      updateJob(jobId, progress);
    });
    updateJob(jobId, {
      status: 'done',
      progress: 100,
      label: 'Termine',
      detail: `${formatBytesForServer(result.originalSize)} -> ${formatBytesForServer(result.outputSize)}`,
      outputPath: result.outputPath,
      filename: result.outputName,
      originalSize: result.originalSize,
      outputSize: result.outputSize,
      sourceFormat: result.sourceFormat,
    });
  } catch (error) {
    updateJob(jobId, {
      status: 'error',
      progress: 100,
      label: 'Erreur',
      detail: error.message || 'Conversion locale impossible.',
      error: error.message || 'Conversion locale impossible.',
    });
  } finally {
    scheduleJobCleanup(jobId);
  }
};

const formatBytesForServer = (bytes = 0) => {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
  if (value >= 1024) return `${Math.round(value / 1024)} Ko`;
  return `${Math.round(value)} o`;
};

const createModelToolJob = async (req, res) => {
  const { fields, uploadedFile } = await prepareUploadedToolRequest(req);
  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `escape-model-job-${jobId}-`));
  const now = Date.now();
  const job = {
    id: jobId,
    status: 'running',
    progress: 30,
    label: 'Fichier recu',
    detail: uploadedFile.filename || 'Modele 3D',
    filename: '',
    originalSize: uploadedFile.data.byteLength,
    outputSize: 0,
    sourceFormat: '',
    outputPath: '',
    workDir,
    createdAt: now,
    updatedAt: now,
    cleanupTimer: null,
  };
  modelToolJobs.set(jobId, job);
  sendToolJson(req, res, 202, publicJob(job));
  setTimeout(() => runModelToolJob(jobId, uploadedFile, fields), 0);
};

const getJobFromRequest = (requestUrl) => {
  const match = requestUrl.pathname.match(/^\/api\/model-tools\/jobs\/([^/]+)(?:\/(download))?$/);
  if (!match) return null;
  return { id: match[1], action: match[2] || 'status' };
};

const sendModelToolJobStatus = (req, res, jobId) => {
  const job = modelToolJobs.get(jobId);
  if (!job) {
    sendToolJson(req, res, 404, { error: 'Job local introuvable ou expire.' });
    return;
  }
  sendToolJson(req, res, 200, publicJob(job));
};

const sendModelToolJobDownload = async (req, res, jobId) => {
  const job = modelToolJobs.get(jobId);
  if (!job) {
    sendToolJson(req, res, 404, { error: 'Job local introuvable ou expire.' });
    return;
  }
  if (job.status !== 'done' || !job.outputPath) {
    sendToolJson(req, res, 409, { error: 'Le GLB n est pas encore pret.' });
    return;
  }
  const output = await fs.readFile(job.outputPath);
  const headers = makeCorsHeaders(req.headers || {}, process.env, {
    'Content-Type': 'model/gltf-binary',
    'Content-Disposition': `attachment; filename="${job.filename || 'modele-web.glb'}"`,
    'Content-Length': String(output.byteLength),
    'Access-Control-Expose-Headers': 'Content-Disposition,X-Model-Tools-Original-Size,X-Model-Tools-Output-Size,X-Model-Tools-Source-Format',
    'X-Model-Tools-Original-Size': String(job.originalSize || 0),
    'X-Model-Tools-Output-Size': String(output.byteLength),
    'X-Model-Tools-Source-Format': job.sourceFormat || '',
  });
  res.writeHead(200, headers);
  res.end(output);
};

export const handleModelTools = async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && requestUrl.pathname === '/api/model-tools/convert') {
    await handleSyncConversion(req, res);
    return;
  }
  if (req.method === 'POST' && requestUrl.pathname === '/api/model-tools/jobs') {
    await createModelToolJob(req, res);
    return;
  }

  const jobRequest = getJobFromRequest(requestUrl);
  if (jobRequest && req.method === 'GET' && jobRequest.action === 'status') {
    sendModelToolJobStatus(req, res, jobRequest.id);
    return;
  }
  if (jobRequest && req.method === 'GET' && jobRequest.action === 'download') {
    await sendModelToolJobDownload(req, res, jobRequest.id);
    return;
  }
  if (jobRequest && req.method === 'DELETE') {
    await cleanupJob(jobRequest.id);
    sendToolJson(req, res, 200, { ok: true });
    return;
  }

  throw makeHttpError('Outil modele introuvable.', 404, 'MODEL_TOOL_NOT_FOUND');
};
