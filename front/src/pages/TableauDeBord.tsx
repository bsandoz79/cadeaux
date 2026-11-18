import { useState } from 'react';
import { api } from '../api/client';
import { libelleType } from '../api/types';
import { euros } from '../calculs/argent';
import { aujourdhui, bilanAnnee, dateLisible, delai, prochainsAnniversaires } from '../calculs/bilan';
import { Chiffre, Jauge, Lien } from '../components/commun';
import { useDonnees } from '../donnees/contexte';
import { useOccasionPour } from '../donnees/useOccasionPour';
import styles from './pages.module.css';

/** Accueil du compte : budget de l'année, anniversaires et occasions à venir, cagnottes en cours. */
export function TableauDeBord() {
  const d = useDonnees();
  const jour = aujourdhui();
  const annee = Number(jour.slice(0, 4));
  const bilan = bilanAnnee(annee, d);
  const anniversaires = prochainsAnniversaires(d.personnes, jour);
  const aVenir = d.occasions.filter((o) => o.date >= jour).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const cagnottes = d.cagnottes.filter((c) => !c.close);
  const { preparer, enCours: prepare } = useOccasionPour();

  return (
    <div className={styles.pile}>
      {d.compte && !d.compte.emailConfirme && <BandeauConfirmation email={d.compte.email} />}
      <header>
        <h1>Bonjour {d.compte?.nom}</h1>
        <p className={styles.chapo}>Vos cadeaux de {annee}, en un coup d’œil.</p>
      </header>

      <section aria-labelledby="titre-budget" className={styles.pile}>
        <h2 id="titre-budget">Budget {annee}</h2>
        <div className={styles.chiffres}>
          <Chiffre libelle="Total de l’année" valeur={euros(bilan.total)} ton="accent" />
          <Chiffre libelle="Déjà dépensé" valeur={euros(bilan.depense)} ton="vert" />
          <Chiffre libelle="Encore prévu" valeur={euros(bilan.prevu)} ton="or" />
          <Chiffre libelle="Mes parts de cagnottes" valeur={euros(bilan.cagnottes)} />
        </div>
        <p><Lien href="/bilan">Voir le détail par occasion et par personne</Lien></p>
      </section>

      <div className={styles.deuxColonnes}>
        <section aria-labelledby="titre-anniv" className="carte">
          <h2 id="titre-anniv">Anniversaires à venir</h2>
          {anniversaires.length === 0 ? (
            <p className={styles.discret}>
              Aucun dans les deux prochains mois. Ajoutez la date de naissance de vos <Lien href="/proches">proches</Lien> pour les voir ici.
            </p>
          ) : (
            <ul className={styles.liste}>
              {anniversaires.map((a) => (
                <li key={a.personne.id} className={styles.ligneListe}>
                  <div>
                    <strong>{a.personne.nom}</strong> · {a.age} ans
                    <div className={styles.discret}>{dateLisible(a.date, true)}, {delai(a.dans)}</div>
                  </div>
                  <button type="button" className="btn btn--petit btn--contour" disabled={prepare === a.personne.id}
                    onClick={() => preparer(a.personne)}>
                    Préparer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="titre-avenir" className="carte">
          <h2 id="titre-avenir">Occasions à venir</h2>
          {aVenir.length === 0 ? (
            <p className={styles.discret}>Rien de prévu. <Lien href="/occasions">Ajouter une occasion</Lien> (Noël, un anniversaire…).</p>
          ) : (
            <ul className={styles.liste}>
              {aVenir.map((o) => {
                const cadeaux = d.cadeaux.filter((c) => c.occasionId === o.id);
                const total = cadeaux.reduce((s, c) => s + (c.montantDepense ?? c.montantPrevu ?? 0), 0);
                return (
                  <li key={o.id} className={styles.ligneListe}>
                    <div>
                      <Lien href={`/occasions/${o.id}`}><strong>{o.titre}</strong></Lien>
                      <div className={styles.discret}>{libelleType(o.type)} · {dateLisible(o.date)} · {cadeaux.length} cadeau{cadeaux.length > 1 ? 'x' : ''}</div>
                    </div>
                    <strong className="chiffre">{euros(total)}</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="titre-cagnottes" className={styles.pile}>
        <div className={styles.titreAvecAction}>
          <h2 id="titre-cagnottes">Cagnottes en cours</h2>
          <Lien className="btn btn--petit btn--contour" href="/cagnottes">Nouvelle cagnotte</Lien>
        </div>
        {cagnottes.length === 0 ? (
          <p className="vide">Un cadeau à plusieurs ? Créez une cagnotte et envoyez le lien aux participants.</p>
        ) : (
          <ul className={styles.grille}>
            {cagnottes.map((c) => {
              const total = c.total ?? 0;
              const etat = { total, reste: Math.max(0, c.objectif - total), pourcentage: c.objectif > 0 ? Math.min(100, Math.round((total / c.objectif) * 100)) : 0 };
              return (
                <li key={c.id} className="carte">
                  <Lien href={`/cagnottes/${c.id}`}><strong>{c.titre}</strong></Lien>
                  <p className={styles.discret}>Pour {c.beneficiaire} · {c.nombreParticipations ?? 0} participant{(c.nombreParticipations ?? 0) > 1 ? 's' : ''}</p>
                  <Jauge pourcentage={etat.pourcentage} libelle={`Cagnotte ${c.titre}`} />
                  <p className="chiffre">{euros(etat.total)} sur {euros(c.objectif)}{etat.reste > 0 ? ` · il manque ${euros(etat.reste)}` : ' · objectif atteint'}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Adresse pas encore confirmée : rappel discret, avec « Renvoyer l'e-mail ». */
function BandeauConfirmation({ email }: { email: string }) {
  const [etat, setEtat] = useState<'pret' | 'envoye' | string>('pret');
  const renvoyer = async () => {
    try { await api('POST', '/email/renvoyer'); setEtat('envoye'); } catch (e) { setEtat(e instanceof Error ? e.message : 'Une erreur est survenue.'); }
  };
  return (
    <p className="carte" role="status" style={{ background: 'var(--c-or-doux)', borderColor: 'transparent' }}>
      Confirmez votre adresse avec le lien envoyé à <strong>{email}</strong> (pensez aux indésirables). Sans elle, pas de rappels par e-mail.{' '}
      {etat === 'pret' ? <button type="button" className="btn btn--lien btn--petit" onClick={renvoyer}>Renvoyer l’e-mail</button>
        : etat === 'envoye' ? <strong>E-mail renvoyé.</strong> : <span className="erreur">{etat}</span>}
    </p>
  );
}
