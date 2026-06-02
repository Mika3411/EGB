import { createServer } from 'node:http';
import { assertCorsRequestAllowed } from './src/utils/corsConfig.js';
import { port } from './server/config.js';
import { getJsonHeaders, requestContext, sendJson } from './server/http.js';
import { resolveApiRoute } from './server/apiRouter.js';
import { getServerHttpTimeouts } from './server/httpTimeouts.js';
import { handleShopPacks, handleShopPurchase } from './server/shop.js';
import { handleProjectPublication } from './server/projects.js';
import {
  handleAdminProjects,
  handleAdminUsers,
  handleAdminUserUpdate,
} from './server/admin.js';
import { handleAdminModeration, handleModeration } from './server/moderation.js';
import { handleAdminSupport, handleSupport } from './server/support.js';
import {
  handleAdminCredits,
  handleCreditTopUp,
  handleCredits,
  handleCreditsAdminList,
  handleCreditsAdminUpdate,
  handleGumroadWebhook,
  handleStorageUpgrade,
} from './server/credits.js';
import { handleStorageUpload } from './server/storageUploads.js';
import {
  handleAiJob,
  handleGenerate,
  handleImage,
  handleRemoveBackground,
} from './server/ai.js';
import { handleModelTools } from './server/modelTools.js';
import { serveStatic } from './server/staticFiles.js';

const apiRouteHandlers = {
  health: (req, res) => sendJson(res, 200, { ok: true }),
  adminUsersList: handleAdminUsers,
  adminUsersUpdate: handleAdminUserUpdate,
  adminCredits: handleAdminCredits,
  adminProjects: handleAdminProjects,
  adminModeration: handleAdminModeration,
  adminSupport: handleAdminSupport,
  moderation: handleModeration,
  support: handleSupport,
  projectPublication: handleProjectPublication,
  shopPacks: handleShopPacks,
  creditsAdminList: handleCreditsAdminList,
  creditTopUp: handleCreditTopUp,
  creditsAdminUpdate: handleCreditsAdminUpdate,
  credits: handleCredits,
  storageUpgrade: handleStorageUpgrade,
  storageUpload: handleStorageUpload,
  shopPurchase: handleShopPurchase,
  gumroadWebhook: handleGumroadWebhook,
  generate: handleGenerate,
  aiJob: handleAiJob,
  image: handleImage,
  removeBackground: handleRemoveBackground,
  modelTools: handleModelTools,
};

const server = createServer((req, res) => requestContext.run(req, async () => {
  try {
    assertCorsRequestAllowed(req.headers || {}, process.env);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, getJsonHeaders(req));
      res.end();
      return;
    }

    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const { pathname } = requestUrl;
    const route = resolveApiRoute(req.method, pathname);

    if (route.type === 'handler') {
      await apiRouteHandlers[route.routeId](req, res);
      return;
    }

    if (route.type === 'methodNotAllowed') {
      sendJson(res, 405, { error: 'Methode non autorisee.' });
      return;
    }

    if (route.type === 'apiNotFound') {
      sendJson(res, 404, { error: 'Route API introuvable.' });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    console.error('[api-error]', req.method, req.url, error);
    sendJson(res, error.status || error.statusCode || 500, {
      error: error.message || 'Erreur serveur.',
      code: error.code,
      balance: error.balance,
      required: error.required,
      retryAfter: error.retryAfter,
    });
  }
}));

const { requestTimeoutMs, headersTimeoutMs } = getServerHttpTimeouts(process.env);
server.requestTimeout = requestTimeoutMs;
server.headersTimeout = headersTimeoutMs;

server.listen(port, () => {
  console.log(`Escape Game Builder API listening on ${port}`);
});
