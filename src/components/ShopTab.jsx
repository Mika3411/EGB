import { useEffect, useMemo, useState } from 'react';
import { archiveSharedShopPack, getShopPacks, loadSharedShopPacks } from '../lib/shopPacksStorage';

const PACK_URLS = {
  100: 'https://mickalicious77.gumroad.com/l/blfvpj',
  250: 'https://mickalicious77.gumroad.com/l/lvnjan',
  500: 'https://mickalicious77.gumroad.com/l/ojrsxa',
  1000: 'https://mickalicious77.gumroad.com/l/zyedcq',
};

const PACK_PRICES = {
  100: '3,99 \u20ac',
  250: '9,49 \u20ac',
  500: '17,99 \u20ac',
  1000: '33,99 \u20ac',
};
const AI_CREDITS_ENDPOINT = import.meta.env.VITE_AI_CREDITS_ENDPOINT || '/api/ai-credits';
const SHOP_PURCHASE_ENDPOINT = import.meta.env.VITE_SHOP_PURCHASE_ENDPOINT || '/api/shop/purchase';
const SHOP_PURCHASES_KEY_PREFIX = 'escapeGameBuilder.shopPurchases';

const isConfiguredUrl = (value = '') => {
  const url = String(value || '').trim();
  return url && !url.toUpperCase().includes('YOUR_GUMROAD');
};

const getPackUrl = (credits, value) => (isConfiguredUrl(value) ? String(value).trim() : PACK_URLS[credits] || '');

const parsePack = (value, fallback) => {
  const [creditsValue, price, url] = String(value || '').split('|').map((entry) => entry.trim());
  const credits = Number(creditsValue || fallback.credits);
  return {
    credits,
    price: PACK_PRICES[credits] || price || fallback.price,
    url: getPackUrl(credits, url || fallback.url),
  };
};

const defaultPacks = [
  { credits: 100, price: PACK_PRICES[100], url: import.meta.env.VITE_GUMROAD_PACK_100_URL || PACK_URLS[100] },
  { credits: 250, price: PACK_PRICES[250], url: import.meta.env.VITE_GUMROAD_PACK_250_URL || PACK_URLS[250] },
  { credits: 500, price: PACK_PRICES[500], url: import.meta.env.VITE_GUMROAD_PACK_500_URL || PACK_URLS[500] },
  { credits: 1000, price: PACK_PRICES[1000], url: import.meta.env.VITE_GUMROAD_PACK_1000_URL || PACK_URLS[1000] },
].map((fallback, index) => parsePack(import.meta.env[`VITE_GUMROAD_PACK_${index + 1}`], fallback));

const estimateProjects = (credits) => Math.max(1, Math.floor(Number(credits || 0) / 36));

const getPurchasesKey = (userId) => `${SHOP_PURCHASES_KEY_PREFIX}.${userId || 'anonymous'}`;

const readPurchases = (userId) => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getPurchasesKey(userId)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePurchases = (userId, purchases) => {
  window.localStorage.setItem(getPurchasesKey(userId), JSON.stringify(purchases));
  window.dispatchEvent(new CustomEvent('shop-purchases-updated'));
  return purchases;
};

const readJsonResponse = async (response, fallbackMessage) => {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error(fallbackMessage);
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(fallbackMessage);
  }
};

export default function ShopTab({ user }) {
  const [copyStatus, setCopyStatus] = useState('');
  const [productPacks, setProductPacks] = useState(() => getShopPacks());
  const [aiCredits, setAiCredits] = useState({ balance: null, isLoading: false, error: '' });
  const [purchases, setPurchases] = useState(() => readPurchases(user?.id || user?.email || 'anonymous'));
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [buyingPackId, setBuyingPackId] = useState('');
  const purchaseId = user?.id || user?.email || 'compte-invite';
  const supportEmail = import.meta.env.VITE_SHOP_SUPPORT_EMAIL || '';
  const packs = useMemo(() => defaultPacks.filter((pack) => pack.credits > 0), []);

  useEffect(() => {
    const refreshPacks = () => {
      loadSharedShopPacks()
        .then(setProductPacks)
        .catch(() => setProductPacks(getShopPacks()));
    };
    refreshPacks();
    window.addEventListener('shop-packs-updated', refreshPacks);
    window.addEventListener('storage', refreshPacks);
    return () => {
      window.removeEventListener('shop-packs-updated', refreshPacks);
      window.removeEventListener('storage', refreshPacks);
    };
  }, []);

  useEffect(() => {
    setPurchases(readPurchases(purchaseId));
  }, [purchaseId]);

  const refreshAiCredits = async () => {
    setAiCredits((previous) => ({ ...previous, isLoading: true, error: '' }));
    try {
      const response = await fetch(`${AI_CREDITS_ENDPOINT}?userId=${encodeURIComponent(purchaseId)}`, {
        headers: purchaseId ? { 'X-AI-User-Id': purchaseId } : {},
      });
      if (!response.ok) throw new Error(`Credits indisponibles (${response.status}).`);
      const payload = await readJsonResponse(response, 'Credits indisponibles. Lance le serveur API pour actualiser le solde.');
      setAiCredits({ balance: Number(payload.balance || 0), isLoading: false, error: '' });
    } catch (error) {
      setAiCredits((previous) => ({ ...previous, isLoading: false, error: error.message || 'Credits indisponibles.' }));
    }
  };

  useEffect(() => {
    refreshAiCredits();
  }, [purchaseId]);

  const copyPurchaseId = async () => {
    try {
      await navigator.clipboard.writeText(purchaseId);
      setCopyStatus('Identifiant copie.');
    } catch {
      setCopyStatus("Copie impossible, selectionne l'identifiant manuellement.");
    }
  };

  const openPack = (pack) => {
    if (!pack.url) return;
    const url = new URL(pack.url);
    url.searchParams.set('wanted', 'true');
    url.searchParams.set('user_id', purchaseId);
    if (user?.email) url.searchParams.set('email', user.email);
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const visibleProductPacks = productPacks.filter((pack) => (
    !pack.archived && !purchases.some((purchase) => purchase.packId === pack.id)
  ));

  const buyProductPack = async (pack) => {
    if (!pack.downloadUrl) {
      setPurchaseStatus('Ce pack n a pas encore de ZIP telechargeable.');
      return;
    }
    const cost = Number(pack.costCredits || 0);
    if (aiCredits.balance != null && aiCredits.balance < cost) {
      setPurchaseStatus(`Credits insuffisants: ${aiCredits.balance}/${cost}.`);
      return;
    }

    setBuyingPackId(pack.id);
    setPurchaseStatus('');
    try {
      const response = await fetch(SHOP_PURCHASE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-User-Id': purchaseId,
        },
        body: JSON.stringify({
          userId: purchaseId,
          packId: pack.id,
          costCredits: cost,
          title: pack.title,
        }),
      });
      const payload = await readJsonResponse(response, 'Achat impossible: le serveur API boutique ne repond pas.');
      if (!response.ok) throw new Error(payload.error || 'Achat impossible.');

      const purchase = {
        packId: pack.id,
        title: pack.title,
        costCredits: cost,
        downloadUrl: pack.downloadUrl,
        downloadFileName: pack.downloadFileName || `${pack.title || 'pack'}.zip`,
        purchasedAt: new Date().toISOString(),
      };
      const nextPurchases = savePurchases(purchaseId, [purchase, ...purchases.filter((entry) => entry.packId !== pack.id)]);
      setPurchases(nextPurchases);
      archiveSharedShopPack(pack.id, {
        archivedReason: 'sold',
        soldAt: purchase.purchasedAt,
        soldTo: purchaseId,
      })
        .then(setProductPacks)
        .catch(() => {});
      setAiCredits((previous) => ({ ...previous, balance: Number(payload.balance ?? Math.max(0, Number(previous.balance || 0) - cost)) }));
      setPurchaseStatus('Pack achete. Le lien de telechargement est disponible ci-dessous.');
    } catch (error) {
      setPurchaseStatus(error.message || 'Achat impossible.');
    } finally {
      setBuyingPackId('');
    }
  };

  return (
    <div className="layout two-cols-wide shop-tab">
      <section className="panel side">
        <div className="panel-head">
          <h2>Boutique</h2>
          <span className="status-badge soft">Gumroad</span>
        </div>
        <p className="small-note">
          Achete un pack de credits puis garde le meme compte dans l'application. L'identifiant ci-dessous permet de retrouver ton achat.
        </p>

        <div className="shop-identity-panel">
          <span className="section-kicker">Identifiant achat</span>
          <strong>{purchaseId}</strong>
          <span className="status-badge soft">
            {aiCredits.isLoading ? 'Credits...' : `${aiCredits.balance ?? 0} credits`}
          </span>
          <button type="button" className="secondary-action" onClick={copyPurchaseId}>Copier</button>
          <button type="button" className="secondary-action" onClick={refreshAiCredits} disabled={aiCredits.isLoading}>Actualiser credits</button>
          {copyStatus ? <p className="small-note">{copyStatus}</p> : null}
          {aiCredits.error ? <p className="small-note">{aiCredits.error}</p> : null}
        </div>

        <div className="combo-card shop-info-card">
          <strong>Reperes</strong>
          <p>Un projet comme l'exemple recent consomme environ 36 credits hors images.</p>
          <p>Miniature economique d'objet: 1 credit. Image d'objet detaillee: 3 credits. Image de scene: 5 credits.</p>
        </div>
      </section>

      <section className="panel main">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Credits IA</span>
            <h2>Packs disponibles</h2>
          </div>
        </div>

        <div className="shop-pack-grid">
          {packs.map((pack) => (
            <article className="shop-pack-card" key={pack.credits}>
              <span className="section-kicker">Pack</span>
              <h3>{pack.credits} credits</h3>
              <strong>{pack.price}</strong>
              <p>Environ {estimateProjects(pack.credits)} projet{estimateProjects(pack.credits) > 1 ? 's' : ''} complet{estimateProjects(pack.credits) > 1 ? 's' : ''}, hors images.</p>
              <button type="button" disabled={!pack.url} onClick={() => openPack(pack)}>
                {pack.url ? 'Acheter ce pack' : 'Pack indisponible'}
              </button>
            </article>
          ))}
        </div>

        <div className="combo-card shop-afterbuy-card">
          <h3>Apres paiement</h3>
          <p>
            Les credits sont ajoutes au compte associe a ton identifiant d'achat. Si le credit n'apparait pas tout de suite, envoie ton identifiant et le recu Gumroad{supportEmail ? ` a ${supportEmail}` : ' au support'}.
          </p>
        </div>

        {purchases.length ? (
          <div className="shop-product-section">
            <div className="panel-head">
              <div>
                <span className="section-kicker">Achats</span>
                <h2>Telechargements debloques</h2>
              </div>
            </div>
            <div className="shop-download-list">
              {purchases.map((purchase) => (
                <a key={purchase.packId} className="shop-download-card" href={purchase.downloadUrl} download={purchase.downloadFileName}>
                  <strong>{purchase.title}</strong>
                  <span>{purchase.downloadFileName}</span>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {visibleProductPacks.length ? (
          <div className="shop-product-section">
            <div className="panel-head">
              <div>
                <span className="section-kicker">Packs de jeux</span>
                <h2>Fiches disponibles</h2>
              </div>
            </div>
            <div className="shop-product-grid">
              {visibleProductPacks.map((pack) => {
                const screenshots = (pack.screenshots || []).filter((screenshot) => screenshot?.src).slice(0, 2);

                return (
                <article className="shop-product-card" key={pack.id}>
                  {screenshots.length ? (
                    <div className="shop-product-screenshots">
                      {screenshots.map((screenshot, index) => (
                        <img
                          key={screenshot.id || screenshot.src}
                          src={screenshot.src}
                          alt={screenshot.name || `${pack.title} screenshot ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div>
                    <span className="section-kicker">{pack.costCredits} credits</span>
                    <h3>{pack.title}</h3>
                    <strong>{pack.rating}/10</strong>
                    <p>{pack.description || 'Pack pret a importer dans un projet.'}</p>
                    <div className="shop-product-metrics">
                      <span>{pack.actsCount} actes</span>
                      <span>{pack.scenesCount} scenes</span>
                      <span>{pack.objectsCount} objets</span>
                      <span>{pack.enigmasCount} enigmes</span>
                      <span>{pack.cinematicsCount} cinematiques</span>
                      <span>{pack.combinationsCount} combinaisons</span>
                    </div>
                    <button
                      type="button"
                      className="profile-action-button shop-buy-button"
                      disabled={buyingPackId === pack.id || !pack.downloadUrl || aiCredits.isLoading}
                      onClick={() => buyProductPack(pack)}
                    >
                      {buyingPackId === pack.id ? 'Achat...' : `Acheter pour ${pack.costCredits} credits`}
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
            {purchaseStatus ? <p className="small-note">{purchaseStatus}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
