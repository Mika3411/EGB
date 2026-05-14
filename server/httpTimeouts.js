export const defaultServerRequestTimeoutMs = 10 * 60 * 1000;
export const defaultServerHeadersTimeoutMs = 60 * 1000;

const parsePositiveTimeoutMs = (value, fallback) => {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : fallback;
};

export const getServerHttpTimeouts = (env = process.env) => {
  const requestTimeoutMs = parsePositiveTimeoutMs(
    env.SERVER_REQUEST_TIMEOUT_MS,
    defaultServerRequestTimeoutMs,
  );
  const headersTimeoutMs = Math.min(
    parsePositiveTimeoutMs(env.SERVER_HEADERS_TIMEOUT_MS, defaultServerHeadersTimeoutMs),
    requestTimeoutMs,
  );

  return { requestTimeoutMs, headersTimeoutMs };
};
