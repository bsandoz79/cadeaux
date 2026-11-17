/**
 * Ajouté à amazon.fr seulement si l'utilisateur a activé « Me demander après mes achats » (voir popup.js).
 * - Fiche produit : retient le produit (nom, prix, photo, adresse) dans le navigateur, sans rien envoyer.
 * - Page de confirmation de commande : propose « C'est un cadeau ? », puis une cagnotte à partager.
 * L'encadré vit dans un Shadow DOM : le style d'Amazon ne le touche pas, et il ne touche pas Amazon.
 */
(async () => {
  const { lireProduit } = await import(chrome.runtime.getURL('produit.js'));
  const L = await import(chrome.runtime.getURL('amazon-logique.js'));
  const maintenant = Date.now();
  const ICONES = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" /></svg>',
    snapchat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" stroke="currentColor" stroke-width=".6" stroke-linejoin="round" d="M12 2.5c2.9 0 5 2.2 5 5v2.4l1.4-.5c.6-.2 1.1.5.7 1l-1.6 1c-.3.2-.4.5-.3.8.7 1.8 2 3 3.6 3.4.4.1.5.6.1.8-.8.4-1.8.6-2.2.8-.2.4-.2 1-.6 1.1-.8.2-1.8-.2-2.8.3-1 .6-1.8 1.7-3.3 1.7s-2.3-1.1-3.3-1.7c-1-.5-2-.1-2.8-.3-.4-.1-.4-.7-.6-1.1-.4-.2-1.4-.4-2.2-.8-.4-.2-.3-.7.1-.8 1.6-.4 2.9-1.6 3.6-3.4.1-.3 0-.6-.3-.8l-1.6-1c-.4-.5.1-1.2.7-1l1.4.5V7.5c0-2.8 2.1-5 5-5Z" /></svg>',
    sms: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 5h16v11H9l-5 4V5Z" /><path fill="currentColor" d="M8 10h2v2H8zm3 0h2v2h-2zm3 0h2v2h-2z" /></svg>',
    partager: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>',
    copier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><path fill="none" stroke="currentColor" stroke-width="2" d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>',
    copie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="m5 12 5 5L20 7" /></svg>',
  };

  if (L.estFicheProduit(location.href)) {
    const produit = lireProduit();
    const { vus = [] } = await chrome.storage.local.get('vus');
    await chrome.storage.local.set({ vus: L.ajouterVu(vus, produit, maintenant) });
    return;
  }
  if (!L.estPageMerci(location.href, document.body?.innerText ?? '')) return;

  const { vus = [], jeton } = await chrome.storage.local.get(['vus', 'jeton']);
  const recents = L.produitsRecents(vus, maintenant);
  const api = (methode, chemin, corps) => chrome.runtime.sendMessage({ type: 'api', methode, chemin, corps });
  const euros = (c) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c / 100);
  const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const saisie = (c) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ','));
  const lireMontant = (s) => { const t = s.replace(/[\s €]/g, '').replace(',', '.'); return /^\d+(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null; };

  const hote = document.createElement('div');
  hote.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
  const racine = hote.attachShadow({ mode: 'closed' });
  racine.innerHTML = `<style>
    :host { all: initial; }
    .boite { width: min(360px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; box-sizing: border-box; background: #fff; color: #24161a; border: 1px solid #d6c8ba; border-radius: 16px; box-shadow: 0 8px 30px rgb(0 0 0 / .2); padding: 16px; font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
    h2 { font: 700 17px/1.3 Georgia, serif; margin: 0 0 8px; display: flex; align-items: center; gap: 8px; }
    p { margin: 0 0 10px; }
    fieldset { border: 0; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
    legend { font-weight: 700; margin-bottom: 4px; padding: 0; }
    label { display: flex; gap: 8px; align-items: center; cursor: pointer; }
    label.champ { display: grid; gap: 3px; font-weight: 600; }
    input[type=text], select { font: inherit; padding: 7px 9px; border: 1px solid #d6c8ba; border-radius: 8px; width: 100%; box-sizing: border-box; background: #fff; color: inherit; }
    .produit { display: grid; grid-template-columns: auto 44px 1fr; gap: 8px; align-items: center; }
    .produit img { width: 44px; height: 44px; object-fit: contain; border-radius: 6px; border: 1px solid #ece3d9; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button, a.bouton { font: inherit; font-weight: 700; border-radius: 999px; padding: 9px 14px; cursor: pointer; border: 1px solid #9e1f2b; background: #9e1f2b; color: #fff; text-decoration: none; }
    button.second, a.second { background: #fff; color: #24161a; border-color: #d6c8ba; }
    button.lien { background: none; border: 0; color: #6a5a5d; text-decoration: underline; padding: 4px; font-weight: 400; }
    .erreur { color: #b3261e; font-weight: 600; }
    a { color: #9e1f2b; }
    .ok { color: #1d6b4a; font-weight: 700; }
    :focus-visible { outline: 3px solid #c7922b; outline-offset: 2px; }
    .logos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .logo { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; border: 1px solid #d6c8ba; background: #fff; color: #24161a; padding: 0; cursor: pointer; }
    .logo svg { width: 22px; height: 22px; }
    .wa { background: #1f8f4e; border-color: #1f8f4e; color: #fff; }
    .snap { background: #fffc00; border-color: #e6e300; color: #111; }
    .sms { background: #2563c9; border-color: #2563c9; color: #fff; }
  </style><section class="boite" role="region" aria-label="Cadeaux : c'est un cadeau ?"></section>`;
  const boite = racine.querySelector('.boite');
  const fermer = () => hote.remove();
  document.body.appendChild(hote);

  const entete = '<h2><span aria-hidden="true">🎁</span> C’est un cadeau ?</h2>';

  if (!jeton) {
    boite.innerHTML = `${entete}<p>Pour noter ce cadeau, connectez-vous dans l’extension Cadeaux (icône du cadeau en haut de Chrome).</p><div class="actions"><button class="second" data-fermer>Fermer</button></div>`;
    boite.querySelector('[data-fermer]').onclick = fermer;
    return;
  }

  // Étape 1 : quel produit, pour qui.
  const [personnes, occasions] = await Promise.all([api('GET', '/personnes'), api('GET', '/occasions')]);
  const proches = personnes.statut === 200 ? personnes.donnees : [];
  const jour = new Date().toISOString().slice(0, 10);
  const aVenir = occasions.statut === 200 ? occasions.donnees.filter((o) => o.date >= jour).sort((a, b) => a.date.localeCompare(b.date)) : [];

  const choixProduits = recents.length
    ? `<fieldset><legend>Le produit acheté</legend>${recents.map((p, i) => `<label class="produit"><input type="radio" name="produit" value="${i}" ${i === 0 ? 'checked' : ''}>${p.image ? `<img src="${echapper(p.image)}" alt="">` : '<span></span>'}<span>${echapper(p.titre.slice(0, 90))}${p.prix ? ` · <strong>${euros(p.prix)}</strong>` : ''}</span></label>`).join('')}<label><input type="radio" name="produit" value="autre"> Autre chose</label></fieldset>`
    : '';
  boite.innerHTML = `${entete}<p>Vous venez de commander. Si c’est pour quelqu’un, notez-le en un clic.</p>
    <form>
      ${choixProduits}
      <div data-autre ${recents.length ? 'hidden' : ''}>
        <label class="champ">Le cadeau <input type="text" name="titre" maxlength="200"></label>
        <label class="champ">Prix (€) <input type="text" name="prix" inputmode="decimal"></label>
      </div>
      <fieldset><legend>Pour qui</legend>
        ${proches.length ? proches.map((p, i) => `<label><input type="radio" name="personne" value="${p.id}" ${i === 0 ? 'checked' : ''}> ${echapper(p.nom)}</label>`).join('') : '<p>Ajoutez vos proches sur cadeaux.bsandoz.fr pour les choisir ici.</p>'}
      </fieldset>
      ${aVenir.length ? `<label class="champ">Pour quelle occasion <select name="occasion"><option value="">Aucune pour l’instant</option>${aVenir.map((o) => `<option value="${o.id}">${echapper(o.titre)}</option>`).join('')}</select></label>` : ''}
      <p class="erreur" role="alert" hidden></p>
      <div class="actions"><button type="submit">Noter le cadeau</button><button type="button" class="second" data-fermer>Non, c’est pour moi</button></div>
      <button type="button" class="lien" data-jamais>Ne plus me demander</button>
    </form>`;
  const form = boite.querySelector('form');
  const erreur = boite.querySelector('.erreur');
  boite.querySelector('[data-fermer]').onclick = fermer;
  boite.querySelector('[data-jamais]').onclick = async () => { await chrome.runtime.sendMessage({ type: 'desactiver-amazon' }); fermer(); };
  form.addEventListener('change', () => { boite.querySelector('[data-autre]').hidden = recents.length > 0 && form.produit?.value !== 'autre'; });
  form.querySelector('input, button')?.focus();

  form.onsubmit = async (e) => {
    e.preventDefault();
    erreur.hidden = true;
    const choisi = recents.length && form.produit.value !== 'autre' ? recents[Number(form.produit.value)] : null;
    const titre = choisi ? choisi.titre : form.titre.value.trim();
    const prix = choisi ? choisi.prix : lireMontant(form.prix.value);
    const personneId = form.personne?.value ? Number(form.personne.value) : null;
    if (!titre) { erreur.textContent = 'Indiquez le cadeau.'; erreur.hidden = false; return; }
    const r = await api('POST', '/cadeaux', {
      titre: titre.slice(0, 200), montantPrevu: prix, montantDepense: prix, statut: 'achete', personneId,
      occasionId: form.occasion?.value ? Number(form.occasion.value) : null, lien: choisi?.lien ?? null, image: choisi?.image ?? null,
    });
    if (r.statut !== 201) { erreur.textContent = r.donnees?.message ?? 'Une erreur est survenue.'; erreur.hidden = false; return; }
    proposerCagnotte({ cadeauId: r.donnees.id, titre, prix, lien: choisi?.lien ?? null, beneficiaire: proches.find((p) => p.id === personneId)?.nom ?? '' });
  };

  // Étape 2 : une cagnotte à plusieurs ?
  function proposerCagnotte({ cadeauId, titre, prix, lien, beneficiaire }) {
    boite.innerHTML = `${entete}<p class="ok">C’est noté${beneficiaire ? ` pour ${echapper(beneficiaire)}` : ''} !</p>
      <p>Vous voulez que d’autres participent${prix ? ` aux ${euros(prix)}` : ''} ? Créez une cagnotte et envoyez-leur le lien.</p>
      <form>
        <label class="champ">Pour qui (prénom) <input type="text" name="beneficiaire" maxlength="80" value="${echapper(beneficiaire)}"></label>
        <label class="champ">Montant total (€) <input type="text" name="objectif" inputmode="decimal" value="${prix ? saisie(prix) : ''}"></label>
        <p class="erreur" role="alert" hidden></p>
        <div class="actions"><button type="submit">Faire une cagnotte</button><button type="button" class="second" data-fermer>Non merci</button></div>
      </form>`;
    boite.querySelector('[data-fermer]').onclick = fermer;
    const f = boite.querySelector('form');
    const err = boite.querySelector('.erreur');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const objectif = lireMontant(f.objectif.value);
      if (!f.beneficiaire.value.trim() || !objectif) { err.textContent = 'Indiquez pour qui et le montant total.'; err.hidden = false; return; }
      const r = await api('POST', '/cagnottes', { titre: titre.slice(0, 200), beneficiaire: f.beneficiaire.value.trim(), objectif, mode: 'libre', lien });
      if (r.statut !== 201) { err.textContent = r.donnees?.message ?? 'Une erreur est survenue.'; err.hidden = false; return; }
      // Le prix ne doit pas compter deux fois dans le bilan : seule la part de l'organisateur dans la cagnotte comptera.
      await api('PATCH', `/cadeaux/${cadeauId}`, { montantPrevu: null, montantDepense: null, cagnotteId: r.donnees.id });
      partager(`https://cadeaux.bsandoz.fr/c/${r.donnees.code}`, f.beneficiaire.value.trim(), titre, r.donnees.id);
    };
  }

  // Étape 3 : envoyer le lien (WhatsApp, SMS, menu de partage, copie).
  function partager(url, beneficiaire, titre, id) {
    const p = L.liensPartage(url, beneficiaire, titre.slice(0, 60));
    boite.innerHTML = `${entete}<p class="ok">Cagnotte créée !</p><p>Envoyez le lien à ceux qui veulent participer :</p>
      <div class="logos">
        <a class="logo wa" href="${p.whatsapp}" target="_blank" rel="noopener" aria-label="Envoyer sur WhatsApp" title="WhatsApp">${ICONES.whatsapp}</a>
        <a class="logo snap" href="${p.snapchat}" target="_blank" rel="noopener" aria-label="Envoyer sur Snapchat" title="Snapchat">${ICONES.snapchat}</a>
        <a class="logo sms" href="${p.sms}" aria-label="Envoyer par SMS" title="SMS">${ICONES.sms}</a>
        ${navigator.share ? `<button type="button" class="logo" data-partager aria-label="Partager avec une autre appli" title="Partager">${ICONES.partager}</button>` : ''}
        <button type="button" class="logo" data-copier aria-label="Copier le lien" title="Copier le lien">${ICONES.copier}</button>
      </div>
      <p style="margin-top:10px">Dans votre bilan, seule votre part comptera : notez-la dans la cagnotte (« Je complète le reste »). <a href="https://cadeaux.bsandoz.fr/cagnottes/${id}" target="_blank" rel="noopener">Suivre la cagnotte</a></p>
      <div class="actions"><button type="button" class="lien" data-fermer>Fermer</button></div>`;
    boite.querySelector('[data-fermer]').onclick = fermer;
    boite.querySelector('[data-copier]').onclick = async (e) => {
      try { await navigator.clipboard.writeText(url); e.currentTarget.innerHTML = ICONES.copie; e.currentTarget.setAttribute('aria-label', 'Lien copié'); } catch { /* lien visible dans « Suivre la cagnotte » */ }
    };
    boite.querySelector('[data-partager]')?.addEventListener('click', () => navigator.share({ title: 'Cagnotte', text: p.texte, url }).catch(() => {}));
  }
})();
