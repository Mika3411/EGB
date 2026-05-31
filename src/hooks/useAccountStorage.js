import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACCOUNT_FREE_STORAGE_BYTES,
  formatStorageSize,
  getAccountExactStorageAssetSizes,
  getAccountStorageUsageBytes,
  getStorageQuotaBytes,
} from '../lib/storageQuota';

const EXACT_USAGE_DEBOUNCE_MS = 700;
const EXACT_STORAGE_ASSET_OPTIONS = { includeLegacyFields: true };

export function useAccountStorage({
  activeProject,
  activeProjectId,
  projects,
  autoExact = false,
} = {}) {
  const [accountStorageQuotaBytes, setAccountStorageQuotaBytes] = useState(ACCOUNT_FREE_STORAGE_BYTES);
  const [exactStorageAssetSizesByUrl, setExactStorageAssetSizesByUrl] = useState(new Map());
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
      setExactStorageAssetSizesByUrl(new Map());
      setExactStorageUsageBytes(null);
      return undefined;
    }

    let isCurrent = true;
    exactUsageRequestRef.current += 1;
    const requestId = exactUsageRequestRef.current;
    setExactStorageUsageBytes(null);

    const timer = window.setTimeout(() => {
      getAccountExactStorageAssetSizes(projectsForStorageUsage, EXACT_STORAGE_ASSET_OPTIONS).then((sizesByUrl) => {
        if (isCurrent && requestId === exactUsageRequestRef.current) {
          setExactStorageAssetSizesByUrl(sizesByUrl);
          setExactStorageUsageBytes([...sizesByUrl.values()].reduce((total, size) => total + (Number(size) || 0), 0));
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
    const sizesByUrl = await getAccountExactStorageAssetSizes(projectsForStorageUsage, EXACT_STORAGE_ASSET_OPTIONS);
    const bytes = [...sizesByUrl.values()].reduce((total, size) => total + (Number(size) || 0), 0);
    if (requestId === exactUsageRequestRef.current) {
      setExactStorageAssetSizesByUrl(sizesByUrl);
      setExactStorageUsageBytes(bytes);
    }
    return bytes;
  }, [exactStorageUsageBytes, projectsForStorageUsage]);

  const getCurrentStorageAssetSizesByUrl = useCallback(async () => {
    if (exactStorageUsageBytes !== null) return exactStorageAssetSizesByUrl;
    exactUsageRequestRef.current += 1;
    const requestId = exactUsageRequestRef.current;
    const sizesByUrl = await getAccountExactStorageAssetSizes(projectsForStorageUsage, EXACT_STORAGE_ASSET_OPTIONS);
    if (requestId === exactUsageRequestRef.current) {
      setExactStorageAssetSizesByUrl(sizesByUrl);
      setExactStorageUsageBytes([...sizesByUrl.values()].reduce((total, size) => total + (Number(size) || 0), 0));
    }
    return sizesByUrl;
  }, [exactStorageAssetSizesByUrl, exactStorageUsageBytes, projectsForStorageUsage]);

  const invalidateStorageUsage = useCallback(() => {
    exactUsageRequestRef.current += 1;
    setExactStorageAssetSizesByUrl(new Map());
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
    exactStorageAssetSizesByUrl,
    exactStorageUsageBytes,
    getCurrentStorageAssetSizesByUrl,
    getCurrentStorageUsageBytes,
    invalidateStorageUsage,
    storageSummary,
    updateStorageQuotaBytes,
  };
}
