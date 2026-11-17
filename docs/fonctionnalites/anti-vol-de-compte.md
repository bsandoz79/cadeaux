# Protection contre le vol de compte

## Le risque
Quelqu'un qui trouve le mot de passe pourrait changer l'adresse e-mail, prendre le compte, mettre son RIB sur une cagnotte et recevoir l'argent des participants.

## Les protections
1. **Changement d'adresse retardé** : la nouvelle adresse doit être confirmée par un lien, et le changement n'a lieu que 48 heures après la demande. L'ancienne adresse reçoit tout de suite un e-mail avec « Ce n'est pas moi ».
2. **« Ce n'est pas moi »** (page `/securite/<lien>`, bouton à cliquer) : toutes les connexions fermées, compte bloqué (connexion refusée) jusqu'à un nouveau mot de passe, RIB de toutes les cagnottes effacés, changement d'adresse annulé ; un lien de nouveau mot de passe part à la vraie adresse. Le même lien arrive après un changement de mot de passe, l'ajout d'un RIB, et une connexion depuis un nouvel appareil.
3. **RIB protégé** : mot de passe redemandé ; refusé pendant 48 heures après un changement de mot de passe ou d'adresse ; e-mail à chaque ajout.
4. **Alerte aux participants** : un RIB ajouté ou changé depuis moins de 48 heures est signalé sur la page de la cagnotte : vérifier auprès de l'organisateur avant de virer.
5. **Nouvel appareil** : le navigateur tire un identifiant au hasard (gardé haché côté serveur) ; une connexion depuis un identifiant inconnu envoie un e-mail (« Chrome sur Windows, le … »).

## Tests
`api/tests/AntivolTest.php` (scénario complet du voleur, RIB protégé, nouvel appareil) ; `front/src/App.test.tsx` (« Ce n'est pas moi », identifiant d'appareil, avertissement RIB récent).
