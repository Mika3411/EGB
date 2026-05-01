import { useMemo, useState } from 'react';

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

export default function ShopTab({ user }) {
  const [copyStatus, setCopyStatus] = useState('');
  const purchaseId = user?.id || user?.email || 'compte-invite';
  const supportEmail = import.meta.env.VITE_SHOP_SUPPORT_EMAIL || '';
  const packs = useMemo(() => defaultPacks.filter((pack) => pack.credits > 0), []);

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
          <button type="button" className="secondary-action" onClick={copyPurchaseId}>Copier</button>
          {copyStatus ? <p className="small-note">{copyStatus}</p> : null}
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
      </section>
    </div>
  );
}
