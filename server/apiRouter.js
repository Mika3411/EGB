const exactRoute = (id, methods, path) => ({
  id,
  methods,
  matches: (pathname) => pathname === path,
});

const prefixRoute = (id, methods, prefix) => ({
  id,
  methods,
  matches: (pathname) => pathname === prefix || pathname.startsWith(`${prefix}/`),
});

export const apiRouteDefinitions = [
  exactRoute('health', ['GET'], '/api/health'),
  prefixRoute('adminUsersList', ['GET'], '/api/admin/users'),
  exactRoute('adminUsersUpdate', ['POST'], '/api/admin/users'),
  prefixRoute('adminCredits', ['GET', 'POST'], '/api/admin/credits'),
  prefixRoute('adminProjects', ['GET'], '/api/admin/projects'),
  prefixRoute('adminModeration', ['GET', 'POST'], '/api/admin/moderation'),
  prefixRoute('adminSupport', ['GET', 'POST'], '/api/admin/support'),
  prefixRoute('moderation', ['GET', 'POST'], '/api/moderation'),
  prefixRoute('support', ['GET', 'POST'], '/api/support'),
  exactRoute('visitorAnalytics', ['POST'], '/api/analytics/visit'),
  exactRoute('projectPublication', ['POST'], '/api/projects/publication'),
  prefixRoute('shopPacks', ['GET', 'POST'], '/api/shop/packs'),
  prefixRoute('creditsAdminList', ['GET'], '/api/ai-credits/admin'),
  exactRoute('creditTopUp', ['POST'], '/api/ai-credits/top-up'),
  exactRoute('creditsAdminUpdate', ['POST'], '/api/ai-credits/admin'),
  prefixRoute('credits', ['GET'], '/api/ai-credits'),
  exactRoute('storageUpgrade', ['POST'], '/api/storage-upgrade'),
  exactRoute('storageUpload', ['POST'], '/api/storage-upload'),
  exactRoute('shopPurchase', ['POST'], '/api/shop/purchase'),
  exactRoute('gumroadWebhook', ['POST'], '/api/gumroad/webhook'),
  exactRoute('generate', ['POST'], '/api/generate'),
  prefixRoute('aiJob', ['GET'], '/api/ai-job'),
  exactRoute('image', ['POST'], '/api/image'),
  exactRoute('removeBackground', ['POST'], '/api/remove-background'),
  prefixRoute('modelTools', ['GET', 'POST', 'DELETE'], '/api/model-tools'),
];

export const resolveApiRoute = (method = '', pathname = '') => {
  const requestMethod = String(method || '').toUpperCase();
  const requestPathname = String(pathname || '');
  const route = apiRouteDefinitions.find((entry) => (
    entry.methods.includes(requestMethod) && entry.matches(requestPathname)
  ));

  if (route) {
    return { type: 'handler', routeId: route.id };
  }

  if (apiRouteDefinitions.some((entry) => entry.matches(requestPathname))) {
    return { type: 'methodNotAllowed' };
  }

  if (requestPathname.startsWith('/api/')) {
    return { type: 'apiNotFound' };
  }

  return { type: 'static' };
};
