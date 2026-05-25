import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { makeCorsHeaders } from '../src/utils/corsConfig.js';

const MODEL_TOOL_MAX_BYTES = 350 * 1024 * 1024;
const MODEL_TOOL_TIMEOUT_MS = 30 * 60 * 1000;
const MODEL_TOOL_JOB_TTL_MS = 60 * 60 * 1000;
const MODEL_TOOL_MIB = 1024 * 1024;
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
  cacheUrl: job.cacheUrl || '',
  fromCache: Boolean(job.fromCache),
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

const getModelToolTempRootCandidates = () => [
  process.env.MODEL_TOOL_TMP_DIR,
  ...(process.platform === 'win32'
    ? [
      'G:\\escape-model-tools-temp',
      'E:\\escape-model-tools-temp',
      'D:\\escape-model-tools-temp',
    ]
    : []),
  path.join(os.tmpdir(), 'escape-model-tools'),
].filter(Boolean);

const getModelToolTempRoot = async () => {
  for (const candidate of getModelToolTempRootCandidates()) {
    try {
      await fs.mkdir(candidate, { recursive: true });
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next configured location.
    }
  }
  return os.tmpdir();
};

const getModelToolCacheKey = (uploadedFile, settings = {}) => {
  const contentHash = createHash('sha256').update(uploadedFile.data).digest('hex').slice(0, 32);
  return `${safeFilename(settings.outputSuffix || 'web')}-${contentHash}`;
};

const getModelToolCachePaths = async (cacheKey) => {
  const cacheDir = path.join(await getModelToolTempRoot(), 'cache');
  await fs.mkdir(cacheDir, { recursive: true });
  return {
    outputPath: path.join(cacheDir, `${cacheKey}.glb`),
    metadataPath: path.join(cacheDir, `${cacheKey}.json`),
  };
};

const getModelToolCacheUrl = (cacheKey = '') => (
  cacheKey ? `/api/model-tools/cache/${encodeURIComponent(cacheKey)}.glb` : ''
);

const readModelToolCache = async (cacheKey, outputName = '') => {
  try {
    const { outputPath, metadataPath } = await getModelToolCachePaths(cacheKey);
    const [metadata, outputStats] = await Promise.all([
      fs.readFile(metadataPath, 'utf8').then((content) => JSON.parse(content.replace(/^\uFEFF/, ''))),
      fs.stat(outputPath),
    ]);
    if (!outputStats?.size) return null;
    return {
      ...metadata,
      outputPath,
      outputName: outputName || metadata.outputName || path.basename(outputPath),
      outputSize: outputStats.size,
      cacheId: cacheKey,
      cacheUrl: getModelToolCacheUrl(cacheKey),
      fromCache: true,
    };
  } catch {
    return null;
  }
};

const writeModelToolCache = async (cacheKey, result = {}) => {
  if (!cacheKey || !result.outputPath) return;
  try {
    const { outputPath, metadataPath } = await getModelToolCachePaths(cacheKey);
    if (path.resolve(result.outputPath) !== path.resolve(outputPath)) {
      await fs.copyFile(result.outputPath, outputPath);
    }
    await fs.writeFile(metadataPath, JSON.stringify({
      outputName: result.outputName || path.basename(outputPath),
      originalSize: Number(result.originalSize) || 0,
      outputSize: Number(result.outputSize) || 0,
      sourceFormat: result.sourceFormat || '',
      qualityDetail: result.qualityDetail || '',
      cachedAt: Date.now(),
    }, null, 2), 'utf8');
  } catch {
    // Cache is best-effort; conversion result is still valid.
  }
};

const makeModelToolWorkDir = async (prefix) => {
  const tempRoot = await getModelToolTempRoot();
  return fs.mkdtemp(path.join(tempRoot, `${prefix}-`));
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

  const summarizeCommandFailureOutput = (value = '') => {
    const lines = String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^(INFO|WARNING)\b/i.test(line));
    const summary = lines.slice(-6).join(' ');
    return summary.length > 600 ? `${summary.slice(0, 600)}...` : summary;
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
    const detail = summarizeCommandFailureOutput([errorOutput.trim(), output.trim()].filter(Boolean).join('\n').trim());
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
animation_only = len(argv) > separator + 3 and argv[separator + 3] == 'animation'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
bpy.ops.import_scene.fbx(filepath=input_path)
if animation_only:
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)
for obj in bpy.context.scene.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bpy.context.selected_objects[0] if bpy.context.selected_objects else None
bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB', export_animations=True, export_force_sampling=True)
`;

const convertFbxWithBlender = async (inputPath, outputPath, workDir, progressOptions = {}) => {
  const blenderPath = await findBlenderExecutable();
  const scriptPath = path.join(workDir, 'fbx_to_glb.py');
  await fs.writeFile(scriptPath, blenderScript, 'utf8');
  await runCommand(blenderPath, ['--background', '--python', scriptPath, '--', inputPath, outputPath, progressOptions.animationOnly ? 'animation' : 'model'], {
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

export const buildGltfTransformOptimizeArgs = (inputPath, outputPath, settings = {}) => {
  const textureSize = Math.max(256, Math.min(4096, Number(settings.textureSize) || 1024));
  const simplify = settings.simplify !== false;
  const simplifyRatio = Math.max(0.25, Math.min(1, Number(settings.simplifyRatio) || 0.75));
  const compression = settings.compression === false ? 'false' : (settings.compression || 'meshopt');
  const textureCompression = settings.textureCompression === false
    ? 'false'
    : (settings.textureCompression || 'webp');
  const args = [
    'optimize',
    inputPath,
    outputPath,
    '--compress',
    compression,
    '--texture-compress',
    textureCompression,
    '--texture-size',
    String(textureSize),
    '--simplify',
    simplify ? 'true' : 'false',
  ];
  if (compression === 'meshopt') {
    args.push('--meshopt-level', settings.meshoptLevel || 'high');
  }
  if (simplify) args.push('--simplify-ratio', String(simplifyRatio));
  return args;
};

export const buildGltfTransformResizeArgs = (inputPath, outputPath, settings = {}) => {
  const textureSize = Math.max(256, Math.min(4096, Number(settings.textureSize) || 1024));
  return [
    'resize',
    inputPath,
    outputPath,
    '--width',
    String(textureSize),
    '--height',
    String(textureSize),
  ];
};

export const buildGltfTransformWebpArgs = (inputPath, outputPath, settings = {}) => {
  const textureQuality = Math.max(1, Math.min(100, Number(settings.textureQuality) || 92));
  const textureEffort = Math.max(0, Math.min(100, Number(settings.textureEffort) || 80));
  const args = [
    'webp',
    inputPath,
    outputPath,
    '--quality',
    String(textureQuality),
    '--effort',
    String(textureEffort),
  ];
  if (settings.textureLossless === true) args.push('--lossless', 'true');
  if (settings.textureNearLossless === true) args.push('--near-lossless', 'true');
  return args;
};

export const buildGltfTransformMeshoptArgs = (inputPath, outputPath, settings = {}) => [
  'meshopt',
  inputPath,
  outputPath,
  '--level',
  settings.meshoptLevel || 'high',
];

export const getQualityTextureVariants = (settings = {}) => {
  const variants = Array.isArray(settings.textureVariants) && settings.textureVariants.length
    ? settings.textureVariants
    : [
      { textureSize: settings.textureSize, textureQuality: settings.textureQuality },
      ...(settings.textureFallbackQualities || []).map((textureQuality) => ({
        textureSize: settings.textureSize,
        textureQuality,
      })),
    ];
  const seen = new Set();

  return variants
    .map((variant = {}) => {
      const textureSize = Math.max(256, Math.min(4096, Number(variant.textureSize) || Number(settings.textureSize) || 1024));
      const textureQuality = Math.max(1, Math.min(100, Number(variant.textureQuality) || Number(settings.textureQuality) || 92));
      return {
        textureSize,
        textureQuality,
        textureEncoding: variant.textureEncoding || 'webp',
        compression: Object.prototype.hasOwnProperty.call(variant, 'compression')
          ? variant.compression
          : settings.compression,
        textureLossless: variant.textureLossless === true,
        textureNearLossless: variant.textureNearLossless === true,
      };
    })
    .filter((variant) => {
      const key = `${variant.textureSize}:${variant.textureQuality}:${variant.textureEncoding}:${variant.compression}:${variant.textureLossless}:${variant.textureNearLossless}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const scoreQualityCandidateSize = (size, settings = {}) => {
  const outputSize = Number(size) || 0;
  const maxOutputBytesFromInput = Number(settings.maxOutputBytesFromInput) || 0;
  if (maxOutputBytesFromInput && outputSize > maxOutputBytesFromInput) return Number.POSITIVE_INFINITY;

  const targetOutputBytes = Number(settings.targetOutputBytes) || 0;
  if (!outputSize || !targetOutputBytes) return 0;

  const minOutputBytes = Number(settings.minOutputBytes) || 0;
  const maxOutputBytes = Number(settings.maxOutputBytes) || 0;
  const distanceFromTarget = Math.abs(outputSize - targetOutputBytes) / targetOutputBytes;

  if (maxOutputBytes && outputSize > maxOutputBytes) {
    return 10 + ((outputSize - maxOutputBytes) / targetOutputBytes) + distanceFromTarget;
  }

  if (minOutputBytes && outputSize < minOutputBytes) {
    return 1 + ((minOutputBytes - outputSize) / targetOutputBytes) * 0.5 + distanceFromTarget * 0.1;
  }

  return distanceFromTarget;
};

export const getModelToolOutputOversize = (outputSize, settings = {}) => {
  const maxOutputBytesFromInput = Number(settings.maxOutputBytesFromInput) || 0;
  const normalizedOutputSize = Number(outputSize) || 0;
  if (!maxOutputBytesFromInput || !normalizedOutputSize || normalizedOutputSize <= maxOutputBytesFromInput) return null;
  return {
    outputSize: normalizedOutputSize,
    maxOutputBytesFromInput,
    originalSize: Number(settings.originalInputBytes) || maxOutputBytesFromInput,
  };
};

const assertModelToolOutputFitsInput = (outputSize, settings = {}) => {
  if (settings.allowOutputLargerThanInput === true) return;
  const oversize = getModelToolOutputOversize(outputSize, settings);
  if (!oversize) return;
  throw makeHttpError(
    `Conversion refusee: le GLB genere (${formatBytesForServer(oversize.outputSize)}) est plus lourd que le fichier source (${formatBytesForServer(oversize.originalSize)}). Essaie le mode Tres leger ou reduis les textures.`,
    422,
    'MODEL_TOOL_OUTPUT_TOO_LARGE',
  );
};

const runGltfTransformCli = async (args, progressOptions = {}) => {
  const gltfTransform = await getGltfTransformCommand();
  await runCommand(gltfTransform.command, [
    ...gltfTransform.argsPrefix,
    ...args,
  ], {
    ...progressOptions,
    shell: gltfTransform.shell,
    label: gltfTransform.label,
    timeoutMs: MODEL_TOOL_TIMEOUT_MS,
  });
};

const getModelToolRawMessage = (error = null) => String(error?.message || error || '').trim();

const isModelToolResourceFetchError = (error = null) => (
  getModelToolRawMessage(error) === 'Failed to fetch'
  || /failed to fetch|fetch failed|network\s*error/i.test(getModelToolRawMessage(error))
);

const markModelToolOptimizationFallback = (settings = {}, detail = '') => {
  settings.optimizationFallbackDetail = detail || 'Optimisation contournee: textures source conservees.';
  settings.allowOutputLargerThanInput = true;
  settings.maxOutputBytesFromInput = 0;
};

const withProgressRange = (progressOptions = {}, progressStart, progressMax) => ({
  ...progressOptions,
  progressStart,
  progressMax,
});

const optimizeGlb = async (inputPath, outputPath, settings = {}, progressOptions = {}) => {
  if (settings.texturePipeline === 'webp-quality') {
    const progressStart = Number(progressOptions.progressStart) || 0;
    const progressMax = Number(progressOptions.progressMax) || 100;
    const progressRange = Math.max(1, progressMax - progressStart);
    const stageBase = path.basename(outputPath, path.extname(outputPath));
    const stageDir = path.dirname(outputPath);
    const textureVariants = getQualityTextureVariants(settings);
    const resizedPathsBySize = new Map();
    const targetOutputBytes = Number(settings.targetOutputBytes) || 0;
    const minOutputBytes = Number(settings.minOutputBytes) || 0;
    const maxOutputBytes = Number(settings.maxOutputBytes) || 0;
    let bestSize = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    settings.qualityCandidates = [];
    settings.selectedQualityCandidate = '';

    for (let index = 0; index < textureVariants.length; index += 1) {
      const variant = textureVariants[index];
      const variantStart = progressStart + progressRange * (index / textureVariants.length);
      const variantResizeEnd = progressStart + progressRange * ((index + 0.42) / textureVariants.length);
      const variantWebpEnd = progressStart + progressRange * ((index + 0.78) / textureVariants.length);
      const variantEnd = progressStart + progressRange * ((index + 1) / textureVariants.length);
      const variantCompression = variant.compression === false ? false : (variant.compression || settings.compression);
      let resizedStagePath = resizedPathsBySize.get(variant.textureSize);
      const hasResizedStage = Boolean(resizedStagePath);
      if (!resizedStagePath) {
        resizedStagePath = path.join(stageDir, `${stageBase}-resized-${variant.textureSize}.glb`);
        resizedPathsBySize.set(variant.textureSize, resizedStagePath);
        await runGltfTransformCli(
          buildGltfTransformResizeArgs(inputPath, resizedStagePath, {
            ...settings,
            textureSize: variant.textureSize,
          }),
          withProgressRange(progressOptions, variantStart, variantResizeEnd),
        );
      }
      const variantLabel = `${variant.textureSize}-${variant.textureEncoding}-${variantCompression || 'raw'}-${variant.textureQuality}-${variant.textureLossless ? 'lossless' : variant.textureNearLossless ? 'near' : 'lossy'}`;
      const webpStagePath = variantCompression === 'meshopt'
        ? path.join(stageDir, `${stageBase}-webp-${variantLabel}.glb`)
        : outputPath;
      const candidatePath = path.join(stageDir, `${stageBase}-candidate-${variantLabel}.glb`);
      if (variant.textureEncoding === 'source') {
        if (variantCompression === 'meshopt') {
          await runGltfTransformCli(
            buildGltfTransformMeshoptArgs(resizedStagePath, candidatePath, settings),
            withProgressRange(progressOptions, hasResizedStage ? variantStart : variantResizeEnd, variantEnd),
          );
        } else {
          await fs.copyFile(resizedStagePath, candidatePath);
        }
      } else {
        await runGltfTransformCli(
          buildGltfTransformWebpArgs(resizedStagePath, webpStagePath, {
            ...settings,
            textureQuality: variant.textureQuality,
            textureLossless: variant.textureLossless,
            textureNearLossless: variant.textureNearLossless,
          }),
          withProgressRange(progressOptions, hasResizedStage ? variantStart : variantResizeEnd, variantCompression === 'meshopt' ? variantWebpEnd : variantEnd),
        );
      }
      if (variantCompression === 'meshopt') {
        if (variant.textureEncoding !== 'source') {
          await runGltfTransformCli(
            buildGltfTransformMeshoptArgs(webpStagePath, candidatePath, settings),
            withProgressRange(progressOptions, variantWebpEnd, variantEnd),
          );
        }
        await fs.rm(webpStagePath, { force: true }).catch(() => {});
      }
      const outputStats = await fs.stat(candidatePath).catch(() => null);
      if (outputStats) {
        const candidateScore = scoreQualityCandidateSize(outputStats.size, settings);
        settings.qualityCandidates.push({
          label: variantLabel,
          size: outputStats.size,
          score: candidateScore,
        });
        if (candidateScore < bestScore) {
          bestScore = candidateScore;
          bestSize = outputStats.size;
          settings.selectedQualityCandidate = variantLabel;
          if (candidatePath !== outputPath) await fs.copyFile(candidatePath, outputPath);
        }
        const inTargetBand = (!minOutputBytes || outputStats.size >= minOutputBytes)
          && (!maxOutputBytes || outputStats.size <= maxOutputBytes);
        if (candidatePath !== outputPath) await fs.rm(candidatePath, { force: true }).catch(() => {});
        if (!targetOutputBytes || inTargetBand) break;
      }
      const nextVariant = textureVariants[index + 1];
      if (nextVariant && nextVariant.textureSize !== variant.textureSize) {
        await fs.rm(resizedStagePath, { force: true }).catch(() => {});
        resizedPathsBySize.delete(variant.textureSize);
      }
    }
    if (bestSize <= 0) {
      const oversizeLimit = Number(settings.maxOutputBytesFromInput) || 0;
      throw makeHttpError(
        oversizeLimit
          ? `Conversion refusee: aucune variante GLB n est plus legere que le fichier source (${formatBytesForServer(Number(settings.originalInputBytes) || oversizeLimit)}). Essaie le mode Tres leger ou reduis les textures.`
          : 'Optimisation qualite impossible.',
        oversizeLimit ? 422 : 500,
        oversizeLimit ? 'MODEL_TOOL_OUTPUT_TOO_LARGE' : 'MODEL_TOOL_QUALITY_FAILED',
      );
    }
    return;
  }

  await runGltfTransformCli(
    buildGltfTransformOptimizeArgs(inputPath, outputPath, settings),
    progressOptions,
  );
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

export const getModelToolQualitySettings = (quality = 'web') => {
  if (quality === 'animation-source-v2') {
    return {
      textureCompression: false,
      compression: false,
      simplify: false,
      outputSuffix: 'animation-source-v2',
      skipOptimization: true,
      allowOutputLargerThanInput: true,
      animationOnly: true,
    };
  }
  if (quality === 'animation-source' || quality === 'animation-source-meshopt' || quality === 'animation') {
    return {
      textureCompression: false,
      compression: false,
      simplify: false,
      outputSuffix: 'animation-source',
      skipOptimization: true,
      allowOutputLargerThanInput: true,
      animationOnly: true,
    };
  }
  if (quality === 'source-meshopt' || quality === 'runtime-source' || quality === 'native') {
    return {
      textureCompression: false,
      compression: 'meshopt',
      simplify: false,
      outputSuffix: 'source-meshopt',
      meshoptOnly: true,
    };
  }
  if (quality === 'source' || quality === 'original' || quality === 'raw') {
    return {
      textureCompression: false,
      compression: false,
      simplify: false,
      outputSuffix: 'source',
      skipOptimization: true,
      allowOutputLargerThanInput: true,
    };
  }
  if (quality === 'quality') {
    return {
      textureSize: 2048,
      textureCompression: false,
      texturePipeline: 'webp-quality',
      textureQuality: 92,
      textureVariants: [
        { textureSize: 4096, textureEncoding: 'source', compression: false },
        { textureSize: 3072, textureEncoding: 'source', compression: false },
        { textureSize: 2048, textureEncoding: 'source', compression: false },
        { textureSize: 1536, textureEncoding: 'source', compression: false },
        { textureSize: 1024, textureEncoding: 'source', compression: false },
        { textureSize: 4096, textureEncoding: 'source' },
        { textureSize: 3072, textureEncoding: 'source' },
        { textureSize: 2048, textureEncoding: 'source' },
        { textureSize: 1536, textureEncoding: 'source' },
        { textureSize: 4096, textureQuality: 100, textureLossless: true },
        { textureSize: 4096, textureQuality: 100, textureNearLossless: true },
        { textureSize: 4096, textureQuality: 100 },
        { textureSize: 4096, textureQuality: 99 },
        { textureSize: 4096, textureQuality: 98 },
        { textureSize: 4096, textureQuality: 97 },
        { textureSize: 4096, textureQuality: 96 },
        { textureSize: 4096, textureQuality: 94 },
        { textureSize: 4096, textureQuality: 92 },
        { textureSize: 4096, textureQuality: 88 },
        { textureSize: 4096, textureQuality: 80 },
        { textureSize: 3072, textureQuality: 90 },
        { textureSize: 3072, textureQuality: 84 },
        { textureSize: 2048, textureQuality: 96 },
        { textureSize: 2048, textureQuality: 92 },
        { textureSize: 2048, textureQuality: 88 },
        { textureSize: 2048, textureQuality: 84 },
        { textureSize: 2048, textureQuality: 82 },
        { textureSize: 1536, textureQuality: 92 },
        { textureSize: 1536, textureQuality: 86 },
        { textureSize: 1536, textureQuality: 80 },
      ],
      textureEffort: 85,
      compression: 'meshopt',
      simplify: false,
      simplifyRatio: 1,
      outputSuffix: 'quality',
      targetOutputRatio: 0.6,
      minOutputRatio: 0.85,
      maxOutputRatio: 1.15,
      minTargetOutputBytes: 48 * MODEL_TOOL_MIB,
    };
  }
  if (quality === 'lite') {
    return {
      textureSize: 512,
      textureCompression: 'webp',
      compression: 'meshopt',
      simplify: true,
      simplifyRatio: 0.55,
      outputSuffix: 'lite',
    };
  }
  return {
    textureSize: 1024,
    textureCompression: 'webp',
    compression: 'meshopt',
    simplify: true,
    simplifyRatio: 0.75,
    outputSuffix: 'web',
  };
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
  const settings = { ...getModelToolQualitySettings(fields.quality || 'web') };
  const outputSuffix = settings.outputSuffix || 'web';
  const outputName = `${baseName(uploadedFile.filename || source.sourceName)}-${outputSuffix}.glb`;
  const cacheKey = getModelToolCacheKey(uploadedFile, settings);
  const forceConversion = String(fields.force || fields.forceConversion || '').toLowerCase() === 'true';
  const cachedResult = forceConversion ? null : await readModelToolCache(cacheKey, outputName);
  if (cachedResult) {
    onProgress({
      progress: 99,
      label: 'GLB cache local...',
      detail: `${formatBytesForServer(cachedResult.outputSize)} deja converti.`,
    });
    return {
      ...cachedResult,
      originalSize: cachedResult.originalSize || source.originalSize || uploadedFile.data.byteLength,
      sourceFormat: cachedResult.sourceFormat || source.sourceFormat,
    };
  }
  if (source.originalSize && source.sourceFormat === 'fbx' && settings.allowOutputLargerThanInput !== true) {
    settings.originalInputBytes = source.originalSize;
    settings.maxOutputBytesFromInput = Math.floor(source.originalSize * (Number(settings.maxOutputToInputRatio) || 1));
  }
  if (settings.targetOutputRatio && source.originalSize && source.sourceFormat === 'fbx') {
    const targetOutputBytes = Math.max(
      Number(settings.minTargetOutputBytes) || 0,
      Math.round(source.originalSize * settings.targetOutputRatio),
    );
    settings.targetOutputBytes = targetOutputBytes;
    settings.minOutputBytes = Math.round(targetOutputBytes * (Number(settings.minOutputRatio) || 0.8));
    settings.maxOutputBytes = Math.round(targetOutputBytes * (Number(settings.maxOutputRatio) || 1.2));
  }
  let convertedPath = path.join(workDir, `${baseName(source.sourceName)}-converted.glb`);
  const optimizedPath = path.join(workDir, `${baseName(source.sourceName)}-${outputSuffix}.glb`);
  let convertedFromSourceCache = false;
  onProgress({
    progress: 24,
    label: source.sourceFormat === 'fbx' ? 'FBX prepare...' : 'GLB prepare...',
    detail: source.sourceFormat === 'zip' ? 'Archive extraite.' : source.sourceName,
  });

  if (settings.meshoptOnly && source.sourceFormat === 'fbx') {
    const sourceCacheKey = getModelToolCacheKey(uploadedFile, { outputSuffix: 'source' });
    const cachedSource = await readModelToolCache(sourceCacheKey, `${baseName(uploadedFile.filename || source.sourceName)}-source.glb`);
    if (cachedSource?.outputPath) {
      convertedPath = cachedSource.outputPath;
      convertedFromSourceCache = true;
      onProgress({
        progress: 66,
        label: 'GLB source cache...',
        detail: `${formatBytesForServer(cachedSource.outputSize)} deja converti.`,
      });
    }
  }

  if (source.sourceFormat === 'fbx') {
    if (!convertedFromSourceCache) {
      onProgress({ progress: 34, label: 'Conversion Blender...', detail: 'Import FBX puis export GLB.' });
      await convertFbxWithBlender(source.inputPath, convertedPath, workDir, {
        animationOnly: Boolean(settings.animationOnly),
        progressStart: 34,
        progressMax: 66,
        onProgress: (progress) => onProgress({ progress, label: 'Conversion Blender...', detail: 'Import FBX puis export GLB.' }),
      });
    }
  } else {
    await fs.copyFile(source.inputPath, convertedPath);
  }

  const optimizeDetail = settings.animationOnly && settings.skipOptimization
    ? 'Animation seule, aucune compression.'
    : settings.skipOptimization
    ? 'Aucune compression ni simplification.'
    : (settings.meshoptOnly
      ? 'Textures source conservees, buffers 3D Meshopt.'
      : settings.texturePipeline === 'webp-quality'
      ? 'Textures 4096 haute qualite.'
      : 'Compression Meshopt/WebP.');
  const optimizeLabel = settings.skipOptimization ? 'Finalisation GLB...' : 'Optimisation GLB...';
  onProgress({ progress: 70, label: optimizeLabel, detail: optimizeDetail });
  if (settings.skipOptimization) {
    await fs.copyFile(convertedPath, optimizedPath);
    onProgress({ progress: 96, label: optimizeLabel, detail: optimizeDetail });
  } else if (settings.meshoptOnly) {
    try {
      await runGltfTransformCli(
        buildGltfTransformMeshoptArgs(convertedPath, optimizedPath, settings),
        {
          progressStart: 70,
          progressMax: 96,
          onProgress: (progress) => onProgress({ progress, label: optimizeLabel, detail: optimizeDetail }),
        },
      );
    } catch (error) {
      if (!isModelToolResourceFetchError(error)) throw error;
      markModelToolOptimizationFallback(settings);
      await fs.copyFile(convertedPath, optimizedPath);
      onProgress({ progress: 96, label: 'GLB source conserve...', detail: settings.optimizationFallbackDetail });
    }
  } else {
    try {
      await optimizeGlb(convertedPath, optimizedPath, settings, {
        progressStart: 70,
        progressMax: 96,
        onProgress: (progress) => onProgress({ progress, label: optimizeLabel, detail: optimizeDetail }),
      });
    } catch (error) {
      if (!isModelToolResourceFetchError(error)) throw error;
      markModelToolOptimizationFallback(settings);
      try {
        await runGltfTransformCli(
          buildGltfTransformMeshoptArgs(convertedPath, optimizedPath, settings),
          {
            progressStart: 70,
            progressMax: 96,
            onProgress: (progress) => onProgress({ progress, label: 'Fallback Meshopt...', detail: settings.optimizationFallbackDetail }),
          },
        );
      } catch {
        await fs.copyFile(convertedPath, optimizedPath);
      }
      onProgress({ progress: 96, label: 'GLB source conserve...', detail: settings.optimizationFallbackDetail });
    }
  }
  const outputStats = await fs.stat(optimizedPath);
  assertModelToolOutputFitsInput(outputStats.size, settings);
  const qualityDetail = settings.optimizationFallbackDetail
    ? settings.optimizationFallbackDetail
    : settings.selectedQualityCandidate
      ? `Preset ${settings.selectedQualityCandidate}.`
    : settings.animationOnly
      ? 'Animation seule sans mesh ni compression.'
    : settings.skipOptimization
      ? 'Qualite source sans compression.'
    : settings.meshoptOnly
      ? 'Textures source conservees, Meshopt sans simplification.'
    : '';
  onProgress({ progress: 99, label: 'GLB pret...', detail: qualityDetail || outputName });
  const result = {
    outputPath: optimizedPath,
    outputName,
    originalSize: source.originalSize || uploadedFile.data.byteLength,
    outputSize: outputStats.size,
    sourceFormat: source.sourceFormat,
    qualityDetail,
    cacheId: cacheKey,
    cacheUrl: getModelToolCacheUrl(cacheKey),
    fromCache: false,
  };
  await writeModelToolCache(cacheKey, result);
  return result;
};

const handleSyncConversion = async (req, res) => {
  const workDir = await makeModelToolWorkDir('escape-model-tools');
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
      detail: `${formatBytesForServer(result.originalSize)} -> ${formatBytesForServer(result.outputSize)}${result.qualityDetail ? ` (${result.qualityDetail})` : ''}`,
      outputPath: result.outputPath,
      filename: result.outputName,
      originalSize: result.originalSize,
      outputSize: result.outputSize,
      sourceFormat: result.sourceFormat,
      cacheUrl: result.cacheUrl || '',
      fromCache: Boolean(result.fromCache),
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

const readSmallJsonBody = async (req) => {
  const body = await readRequestBuffer(req, 64 * 1024);
  if (!body.byteLength) return {};
  try {
    return JSON.parse(body.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw makeHttpError('JSON local invalide.', 400, 'MODEL_TOOL_JSON_INVALID');
  }
};

const findModelToolCachedConversion = async ({ filename = '', size = 0, quality = 'web' } = {}) => {
  const settings = getModelToolQualitySettings(quality || 'web');
  const outputSuffix = settings.outputSuffix || 'web';
  const expectedSize = Number(size) || 0;
  const cacheDir = path.join(await getModelToolTempRoot(), 'cache');
  const inputBase = filename ? baseName(filename) : '';
  let entries = [];
  try {
    entries = await fs.readdir(cacheDir);
  } catch {
    return null;
  }
  let latestMatch = null;
  for (const entry of entries) {
    if (!entry.startsWith(`${outputSuffix}-`) || !entry.endsWith('.json')) continue;
    const metadataPath = path.join(cacheDir, entry);
    try {
      const metadata = JSON.parse((await fs.readFile(metadataPath, 'utf8')).replace(/^\uFEFF/, ''));
      if (expectedSize && Number(metadata.originalSize) !== expectedSize) continue;
      const outputName = metadata.outputName || '';
      if (inputBase && outputName && !baseName(outputName).startsWith(inputBase)) continue;
      const outputPath = path.join(cacheDir, entry.replace(/\.json$/i, '.glb'));
      const outputStats = await fs.stat(outputPath);
      if (!outputStats.size) continue;
      const match = {
        ...metadata,
        cacheId: entry.replace(/\.json$/i, ''),
        outputPath,
        outputName: outputName || `${inputBase || 'modele'}-${outputSuffix}.glb`,
        outputSize: outputStats.size,
      };
      if (expectedSize || inputBase) return match;
      if (!latestMatch || Number(match.cachedAt || 0) > Number(latestMatch.cachedAt || 0)) latestMatch = match;
    } catch {
      // Ignore broken cache entries.
    }
  }
  return latestMatch;
};

const createCachedModelToolJob = async (req, res) => {
  const body = await readSmallJsonBody(req);
  const cachedResult = await findModelToolCachedConversion(body);
  if (!cachedResult) {
    sendToolJson(req, res, 404, { error: 'Aucun GLB local deja converti pour ce fichier.' });
    return;
  }
  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const now = Date.now();
  const job = {
    id: jobId,
    status: 'done',
    progress: 100,
    label: 'Cache local',
    detail: `${formatBytesForServer(cachedResult.originalSize)} -> ${formatBytesForServer(cachedResult.outputSize)}${cachedResult.qualityDetail ? ` (${cachedResult.qualityDetail})` : ''}`,
    filename: cachedResult.outputName,
    cacheUrl: `/api/model-tools/cache/${encodeURIComponent(cachedResult.cacheId)}.glb`,
    fromCache: true,
    originalSize: Number(cachedResult.originalSize) || Number(body.size) || 0,
    outputSize: cachedResult.outputSize,
    sourceFormat: cachedResult.sourceFormat || 'fbx',
    outputPath: cachedResult.outputPath,
    workDir: '',
    createdAt: now,
    updatedAt: now,
    cleanupTimer: null,
  };
  modelToolJobs.set(jobId, job);
  scheduleJobCleanup(jobId);
  sendToolJson(req, res, 200, publicJob(job));
};

const createModelToolJob = async (req, res) => {
  const { fields, uploadedFile } = await prepareUploadedToolRequest(req);
  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const workDir = await makeModelToolWorkDir(`escape-model-job-${jobId}`);
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

const sendModelToolCachedDownload = async (req, res, requestUrl) => {
  const match = requestUrl.pathname.match(/^\/api\/model-tools\/cache\/([^/]+)\.glb$/);
  if (!match) {
    sendToolJson(req, res, 404, { error: 'GLB local introuvable.' });
    return;
  }
  const cacheId = safeFilename(decodeURIComponent(match[1] || '')).replace(/\.glb$/i, '');
  const cachedResult = await readModelToolCache(cacheId);
  if (!cachedResult?.outputPath) {
    sendToolJson(req, res, 404, { error: 'GLB local introuvable.' });
    return;
  }
  const output = await fs.readFile(cachedResult.outputPath);
  const headers = makeCorsHeaders(req.headers || {}, process.env, {
    'Content-Type': 'model/gltf-binary',
    'Content-Disposition': `inline; filename="${cachedResult.outputName || 'modele-cache.glb'}"`,
    'Content-Length': String(output.byteLength),
    'Cache-Control': 'no-store',
    'Access-Control-Expose-Headers': 'Content-Disposition,X-Model-Tools-Original-Size,X-Model-Tools-Output-Size,X-Model-Tools-Source-Format',
    'X-Model-Tools-Original-Size': String(cachedResult.originalSize || 0),
    'X-Model-Tools-Output-Size': String(output.byteLength),
    'X-Model-Tools-Source-Format': cachedResult.sourceFormat || '',
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
  if (req.method === 'POST' && requestUrl.pathname === '/api/model-tools/jobs/from-cache') {
    await createCachedModelToolJob(req, res);
    return;
  }
  if (req.method === 'GET' && requestUrl.pathname.startsWith('/api/model-tools/cache/')) {
    await sendModelToolCachedDownload(req, res, requestUrl);
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
