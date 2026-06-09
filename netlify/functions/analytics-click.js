import {
  getSupabaseAdminClient,
  json,
  privateDataBucket,
  verifyUser,
  withErrors,
} from './_shared.js';
import {
  PRO_CLICK_ANALYTICS_STORAGE_PATH,
  getProjectProClickAnalyticsSummary,
  recordProClickAnalytics,
} from '../../server/proClickAnalytics.js';
import { getVisitorRequestMetadata } from '../../server/visitorAnalytics.js';

const MAX_ANALYTICS_BODY_BYTES = 4096;

const isMissingStorageResource = (error) => Number(error?.statusCode || error?.status) === 404
  || /not found/i.test(String(error?.message || ''));

const parseAnalyticsBody = (event = {}) => {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : String(event.body || '');

  if (Buffer.byteLength(raw, 'utf8') > MAX_ANALYTICS_BODY_BYTES) {
    const error = new Error('Payload trop volumineux.');
    error.statusCode = 413;
    error.code = 'PAYLOAD_TOO_LARGE';
    throw error;
  }

  try {
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    const error = new Error('Payload invalide.');
    error.statusCode = 400;
    error.code = 'PAYLOAD_INVALID';
    throw error;
  }
};

const downloadProClickAnalyticsRecord = async (supabase) => {
  const { data, error } = await supabase.storage
    .from(privateDataBucket)
    .download(PRO_CLICK_ANALYTICS_STORAGE_PATH);

  if (error) {
    if (isMissingStorageResource(error)) return {};
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const uploadProClickAnalyticsRecord = async (supabase, record) => {
  const { error } = await supabase.storage
    .from(privateDataBucket)
    .upload(PRO_CLICK_ANALYTICS_STORAGE_PATH, Buffer.from(JSON.stringify(record, null, 2), 'utf8'), {
      upsert: true,
      contentType: 'application/json',
      cacheControl: '0',
    });

  if (error) throw error;
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod === 'GET') {
    const user = await verifyUser(event);
    const projectId = event.queryStringParameters?.projectId || '';
    if (!projectId) return json(400, { error: 'Projet manquant.' });

    const supabase = getSupabaseAdminClient();
    const currentRecord = await downloadProClickAnalyticsRecord(supabase);
    return json(200, {
      summary: getProjectProClickAnalyticsSummary(currentRecord, {
        projectId,
        userId: user.id,
      }),
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const supabase = getSupabaseAdminClient();
  const body = parseAnalyticsBody(event);
  const metadata = getVisitorRequestMetadata(event.headers || {});
  const currentRecord = await downloadProClickAnalyticsRecord(supabase);
  const nextRecord = recordProClickAnalytics(currentRecord, {
    ...body,
    ...metadata,
  });

  await uploadProClickAnalyticsRecord(supabase, nextRecord);
  return json(200, { ok: true });
});
