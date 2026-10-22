# Frais et totaux affichés depuis le serveur

Le raccordement des trois pages de transfert/dépôt a été autorisé avec une contrainte explicite : ne changer ni leur apparence, ni leur structure, ni leurs textes, champs et boutons.

## Changements

- Les trois pages utilisent maintenant `useServerTransferQuote`.
- Le module de calcul financier local `transfer-amounts.ts` a été retiré. Les frais, montants reçus et totaux viennent directement des champs du devis serveur.
- Le pourcentage affiché vient également du devis, et non d'un tarif utilisé pour recalculer un montant dans le navigateur.
- Les données sont demandées lorsque le montant, les opérateurs et les numéros requis sont renseignés. Aucun numéro fictif ni OTP n'est envoyé pour obtenir un devis.
- Une temporisation de 500 ms réduit les appels pendant la saisie.
- Tout changement pertinent invalide immédiatement l'ancien affichage ; les requêtes obsolètes sont annulées.
- Une réponse tardive ne peut pas remplacer le devis correspondant à la nouvelle saisie.
- Les devis sont rafraîchis périodiquement et au retour sur la fenêtre ; ils sont revérifiés sur les soumissions existantes de vérification.
- Pendant l'attente, en cas d'erreur ou d'informations incomplètes, les emplacements existants affichent « À confirmer ». Il n'y a aucun calcul de secours local.
- Les erreurs de rafraîchissement ne réaffichent pas un ancien devis en cache.
- Aucun stockage persistant des demandes/devis n'a été ajouté.

Les vérifications préliminaires de formulaire et le formatage des nombres restent côté navigateur pour l'affichage. Aucun calcul de frais, de montant reçu ou de total ne s'y exécute.

## Présentation

La comparaison des arbres JSX avant/après a retrouvé les mêmes éléments, textes fixes, noms d'attributs et valeurs d'attributs statiques :

- Inter-réseaux : 229 entrées identiques.
- International : 221 entrées identiques.
- Dépôt : 158 entrées identiques.

Seuls les hooks, les données et les expressions de raccordement ont changé. Aucun style, élément, libellé ou emplacement de frais n'a été ajouté ou retiré.

## Vérifications exécutées

- Typecheck frontend : réussi.
- Build de production frontend : réussi, avec avertissements Vite de sourcemaps et de taille de bundle non bloquants.
- 16 tests frontend réussis, dont la copie des montants serveur, le cas de frais nuls, les montants indisponibles, les changements de saisie, les réponses tardives et l'échec de rafraîchissement.
- 13 tests HTTP/SQL réussis sur PostgreSQL jetable. Ils incluent les contrats de requête des pages et les totaux serveur du dépôt et de l'international pour les deux choix de paiement des frais.
- Contrôle de secrets sur 600 fichiers texte du projet : aucune détection lors du contrôle.
- Contrôle complémentaire du build : 5 fichiers texte compilés, aucune source map frontend et aucune correspondance aux motifs connus de clés privées, clés live Stripe et URL PostgreSQL avec mot de passe. Ce contrôle ciblé n'est pas une preuve exhaustive d'absence de secret.

Le test des réponses tardives utilise le véritable QueryObserver de TanStack Query ; il ne remplace pas la gestion des requêtes par une simulation de calcul financier.

## Limites conservées

- Aucune clé réelle utilisée dans les tests, aucun appel prestataire réel, aucun mouvement de fonds.
- Aucune migration exécutée contre Neon.
- L'administration et l'exécution des transferts/dépôts restent fermées.
- L'aperçu connecté à Neon réel conserve ses refus d'accès privés. S'il refuse le devis, les pages affichent « À confirmer », jamais un montant inventé.
- Les frais réels ne peuvent être affichés que si le serveur autorise la session et peut lire une configuration financière compatible avec les migrations nécessaires.
- Aucun test navigateur connecté aux pages financières n'a été exécuté ; la préservation de leur présentation a été vérifiée dans le JSX, les états de devis par tests et les contrats par requêtes HTTP isolées.

Un devis affiché ne constitue toujours ni une réservation de fonds, ni un paiement, ni une confirmation prestataire.
