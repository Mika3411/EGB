export const defaultAiJobTtlMs = 30 * 60 * 1000;
export const defaultAiJobMaxRuntimeMs = 10 * 60 * 1000;

const terminalAiJobStatuses = new Set(['complete', 'error']);
const activeAiJobStatuses = new Set(['pending', 'running']);

export const getAiJobTtlMs = (env = process.env) => {
  const ttlMs = Number(env.AI_JOB_TTL_MS);
  return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : defaultAiJobTtlMs;
};

export const getAiJobCleanupIntervalMs = (ttlMs) => Math.max(1000, Math.min(ttlMs, 60 * 1000));

export const getAiJobMaxRuntimeMs = (env = process.env) => {
  const maxRuntimeMs = Number(env.AI_JOB_MAX_RUNTIME_MS);
  return Number.isFinite(maxRuntimeMs) && maxRuntimeMs > 0 ? maxRuntimeMs : defaultAiJobMaxRuntimeMs;
};

export const cleanupAiJobs = (jobs, {
  now = Date.now(),
  ttlMs = getAiJobTtlMs(),
  maxRuntimeMs = getAiJobMaxRuntimeMs(),
} = {}) => {
  let removedCount = 0;

  for (const [jobId, job] of jobs.entries()) {
    const updatedAt = Date.parse(job.updatedAt || '');
    if (!Number.isFinite(updatedAt)) continue;

    if (terminalAiJobStatuses.has(job?.status)) {
      if (now - updatedAt < ttlMs) continue;
      jobs.delete(jobId);
      removedCount += 1;
      continue;
    }

    if (activeAiJobStatuses.has(job?.status) && now - updatedAt >= maxRuntimeMs) {
      jobs.set(jobId, {
        ...job,
        status: 'error',
        error: 'Generation IA interrompue: delai maximal depasse.',
        code: 'AI_JOB_TIMEOUT',
        updatedAt: new Date(now).toISOString(),
      });
    }
  }

  return removedCount;
};
