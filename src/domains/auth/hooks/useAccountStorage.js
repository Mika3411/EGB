import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatStorageSize,
  getAccountExactStorageAssetSizes,
  getAccountStorageUsageBytes,
  getStorageQuotaBytes,
} from '../../../shared/services/storageQuota';

const EXACT_USAGE_DEBOUNCE_MS = 700;
const EXACT_STORAGE_ASSET_OPTIONS = { includeLegacyFields: true };

export function useAccountStorage({
  activeProject,
  activeProjectId,
  projects,
  user = null,
  autoExact = false,
} = {}) {
  const [remoteStorageQuotaBytes, setRemoteStorageQuotaBytes] = useState(0);
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

  const accountStorageQuotaBytes = useMemo(
    () => getStorageQuotaBytes({ storageQuotaBytes: remoteStorageQuotaBytes, account: user }),
    [remoteStorageQuotaBytes, user],
  );

  const updateStorageQuotaBytes = useCallback((storageQuotaBytes) => {
    const bytes = Math.max(0, Math.round(Number(storageQuotaBytes || 0)));
    setRemoteStorageQuotaBytes(bytes);
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
