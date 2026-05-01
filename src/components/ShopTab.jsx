import { useMemo, useState } from 'react';

const parsePack = (value, fallback) => {
  const [credits, price, url] = String(value || '').split('|').map((entry) => entry.trim());
  return {
    credits: Number(credits || fallback.credits),
    price: price || fallback.price,
    url: url || fallback.url,
  };
};

const defaultPacks = [
  { credits: 100, price: '3,99 €', url: import.meta.env.VITE_GUMROAD_PACK_100_URL || 'https://mickalicious77.gumroad.com/l/blfvpj' },
  { credits: 250, price: '9,49 €', url: import.meta.env.VITE_GUMROAD_PACK_250_URL || 'https://mickalicious77.gumroad.com/l/lvnjan' },
  { credits: 500, price: '17,99 €', url: import.meta.env.VITE_GUMROAD_PACK_500_URL || 'https://mickalicious77.gumroad.com/l/ojrsxa' },
  { credits: 1000, price: '33,99 €', url: import.meta.env.VITE_GUMROAD_PACK_1000_URL || 'https://mickalicious77.gumroad.com/l/zyedcq' },
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
      setCopyStatus('Identifiant copié.');
    } catch {
      setCopyStatus("Copie impossible, sélectionne l'identifiant manuellement.");
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
          Achète un pack de crédits puis garde le même compte dans l'application. L'identifiant ci-dessous permet de retrouver ton achat.
        </p>

        <div className="shop-identity-panel">
          <span className="section-kicker">Identifiant achat</span>
          <strong>{purchaseId}</strong>
          <button type="button" className="secondary-action" onClick={copyPurchaseId}>Copier</button>
          {copyStatus ? <p className="small-note">{copyStatus}</p> : null}
        </div>

        <div className="combo-card shop-info-card">
          <strong>Repères</strong>
          <p>Un projet comme l'exemple récent consomme environ 36 crédits hors images.</p>
          <p>Miniature économique d'objet: 1 crédit. Image d'objet détaillée: 3 crédits. Image de scène: 5 crédits.</p>
        </div>
      </section>

      <section className="panel main">
        <div className="panel-head">
          <div>
            <span className="section-kicker">Crédits IA</span>
            <h2>Packs disponibles</h2>
          </div>
        </div>

        <div className="shop-pack-grid">
          {packs.map((pack) => (
            <article className="shop-pack-card" key={pack.credits}>
              <span className="section-kicker">Pack</span>
              <h3>{pack.credits} crédits</h3>
              <strong>{pack.price}</strong>
              <p>Environ {estimateProjects(pack.credits)} projet{estimateProjects(pack.credits) > 1 ? 's' : ''} complet{estimateProjects(pack.credits) > 1 ? 's' : ''}, hors images.</p>
              <button type="button" disabled={!pack.url} onClick={() => openPack(pack)}>
                {pack.url ? 'Acheter sur Gumroad' : 'Lien Gumroad à configurer'}
              </button>
            </article>
          ))}
        </div>

        <div className="combo-card shop-afterbuy-card">
          <h3>Après paiement</h3>
          <p>
            Les crédits sont ajoutés au compte associé à ton identifiant d'achat. Si le crédit n'apparaît pas tout de suite, envoie ton identifiant et le reçu Gumroad{supportEmail ? ` à ${supportEmail}` : ' au support'}.
          </p>
        </div>
      </section>
    </div>
  );
}
