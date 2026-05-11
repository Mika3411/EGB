import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACCOUNT_FREE_STORAGE_BYTES,
  formatStorageSize,
  getAccountExactStorageUsageBytes,
  getAccountStorageUsageBytes,
  getStorageQuotaBytes,
} from '../lib/storageQuota';

const EXACT_USAGE_DEBOUNCE_MS = 700;

export function useAccountStorage({
  activeProject,
  activeProjectId,
  projects,
  autoExact = false,
} = {}) {
  const [accountStorageQuotaBytes, setAccountStorageQuotaBytes] = useState(ACCOUNT_FREE_STORAGE_BYTES);
  const [exactStorageUsageBytes, setExactStorageUsageBytes] = useState(null);
  const [usageInvalidationVersion, setUsageInvalidationVersion] = useState(0);
  const exactUsageRequestRef = useRef(0);

  const projectsForStorageUsage = useMemo(() => ([
    ...((projects || []).map((projectRecord) => (
      projectRecord.id === activeProjectId ? { ...projectRecord, data: activeProject } : projectRecord
    ))),
    activeProjectId ? null : activeProject,
  ].filter(Boolean)), [activeProject, activeProjectId, projects]);

  const estimatedStorageUsageBytes = useMemo(
    () => getAccountStorageUsageBytes(projectsForStorageUsage),
    [projectsForStorageUsage],
  );

  useEffect(() => {
    if (!autoExact) {
      setExactStorageUsageBytes(null);
      return undefined;
    }

    let isCurrent = true;
    exactUsageRequestRef.current += 1;
    const requestId = exactUsageRequestRef.current;
    setExactStorageUsageBytes(null);

    const timer = window.setTimeout(() => {
      getAccountExactStorageUsageBytes(projectsForStorageUsage).then((bytes) => {
        if (isCurrent && requestId === exactUsageRequestRef.current) {
          setExactStorageUsageBytes(bytes);
        }
      });
    }, EXACT_USAGE_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [autoExact, projectsForStorageUsage, usageInvalidationVersion]);

  const getCurrentStorageUsageBytes = useCallback(async () => {
    if (exactStorageUsageBytes !== null) return exactStorageUsageBytes;
    exactUsageRequestRef.current += 1;
    const requestId = exactUsageRequestRef.current;
    const bytes = await getAccountExactStorageUsageBytes(projectsForStorageUsage);
    if (requestId === exactUsageRequestRef.current) {
      setExactStorageUsageBytes(bytes);
    }
    return bytes;
  }, [exactStorageUsageBytes, projectsForStorageUsage]);

  const invalidateStorageUsage = useCallback(() => {
    exactUsageRequestRef.current += 1;
    setExactStorageUsageBytes(null);
    setUsageInvalidationVersion((version) => version + 1);
  }, []);

  const updateStorageQuotaBytes = useCallback((storageQuotaBytes) => {
    setAccountStorageQuotaBytes(getStorageQuotaBytes({ storageQuotaBytes }));
  }, []);

  const effectiveStorageUsageBytes = exactStorageUsageBytes ?? estimatedStorageUsageBytes;
  const storageSummary = useMemo(() => ({
    usedBytes: effectiveStorageUsageBytes,
    quotaBytes: accountStorageQuotaBytes,
    usedLabel: exactStorageUsageBytes === null
      ? `${formatStorageSize(effectiveStorageUsageBytes)} env.`
      : formatStorageSize(effectiveStorageUsageBytes),
    quotaLabel: formatStorageSize(accountStorageQuotaBytes),
    isExact: exactStorageUsageBytes !== null,
  }), [accountStorageQuotaBytes, effectiveStorageUsageBytes, exactStorageUsageBytes]);

  return {
    accountStorageQuotaBytes,
    estimatedStorageUsageBytes,
    exactStorageUsageBytes,
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    storageSummary,
    updateStorageQuotaBytes,
  };
}
