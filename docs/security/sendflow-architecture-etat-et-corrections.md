# SendFlow — architecture, état réel et corrections

État vérifié le 22 octobre 2026. Complément au rapport `sendflow-financial-hardening-2026-10-22.md`.

**Mise à jour après autorisation du raccordement des pages :** les calculs locaux des trois formulaires ont depuis été retirés sans modification de leur présentation. La section 5 ci-dessous décrit le constat antérieur ; voir `server-quote-display.md` pour les changements et vérifications de ce raccordement.

## 1. Ce que signifie « tout côté serveur »

Le serveur doit être l'unique autorité financière et de sécurité. Cela ne signifie pas supprimer tout JavaScript du navigateur.

| Dans le navigateur | Exclusivement comme décision serveur |
|---|---|
| Formulaires, navigation, animations, menus, affichage | Identification réelle du client et permissions |
| Saisie du montant souhaité et du destinataire | Acceptation du montant, calcul applicable des frais et des plafonds |
| Message préliminaire d'erreur de saisie | Validation définitive et refus d'une opération |
| Affichage du solde reçu de l'API | Lecture et modification du vrai solde |
| Affichage d'une confirmation reçue du serveur | Preuve de paiement et transition de statut |
| État visuel « PIN saisi » | Session PIN effectivement vérifiée et non expirée |

Un navigateur compromis doit pouvoir modifier son propre affichage, mais jamais un solde réel ni un privilège serveur. Le montant saisi est une intention du client, pas une instruction de débit déjà autorisée.

Le frontend doit nécessairement recevoir les données qu'il affiche à l'utilisateur autorisé. En revanche, il n'a besoin ni des secrets prestataires, ni d'un accès PostgreSQL, ni de privilèges administrateur BDD.

## 2. Stack et séparation actuelle

```text
artifacts/sendflow
  React + TypeScript + Vite
  Pages, formulaires, appels HTTP ; aucun accès direct PostgreSQL identifié
           ↓
Contrat OpenAPI → types/validateurs générés
           ↓
artifacts/api-server
  Node.js + Express
  Sessions, PIN, validation Zod, contrôles d'accès, routes
           ↓
services / data
  Devis, ajustement de portefeuille, prix, quotas, état KYC
           ↓
lib/db
  PostgreSQL + Drizzle
  Transactions SQL, unicité, contraintes et verrous
           ↓
Didit / eSMS
  Appels et secrets côté serveur ; aucun appel réel pendant les tests
```

Il s'agit d'une séparation frontend/backend au sein d'un monorepo : les dossiers peuvent rester dans le même dépôt. Les héberger séparément ne suffirait pas à sécuriser les décisions ; ce sont les contrôles d'accès et les frontières de confiance qui comptent.

## 3. Inventaire des routes

55 déclarations littérales détectées dans les modules de routes : 25 GET, 20 POST, 6 PATCH, 3 PUT, 1 DELETE. Ce nombre est un inventaire statique, pas la preuve de 55 parcours testés.

| Famille | Déclarations |
|---|---:|
| Compte, transactions et devis | 4 |
| Authentification client et récupération | 8 |
| Vérification OTP téléphone | 2 |
| Identité et webhook Didit | 4 |
| Accès et administration générale | 7 |
| Actions administratives sur comptes/portefeuilles | 5 |
| Journaux connexion/OTP et politiques OTP | 4 |
| Agrégateurs administrés | 4 |
| Catalogue/prix opérateurs | 5 |
| Bannières | 6 |
| Paramètres d'inscription | 3 |
| Santé, état BDD et stockage | 3 |
| **Total** | **55** |

Les routes publiques de catalogue ne confèrent pas de droit financier. Les routes sensibles doivent continuer à vérifier l'identité côté serveur même si leur URL est connue.

## 4. Ce qui est déjà protégé et vérifié

- Les API privées testées vérifient la session serveur et le déverrouillage PIN, indépendamment des drapeaux du navigateur.
- Les cookies de session sont HttpOnly et Secure. Leur politique SameSite=None impose de conserver les contrôles d'origine/CSRF adaptés ; le cookie seul n'est pas une protection CSRF.
- L'accès à la transaction d'un autre client est refusé.
- Le devis utilise des prix chargés côté serveur et le plafond du compte authentifié ; les frais, totaux, identités et statuts supplémentaires envoyés par le navigateur n'en deviennent pas les paramètres de décision.
- Les montants financiers vérifiés sont des entiers sûrs ; les calculs de frais serveur ne dépendent pas des nombres calculés dans l'interface.
- L'ajustement interne du portefeuille utilise des verrous, un solde attendu et une transaction atomique incluant le registre et l'audit.
- Une même clé d'idempotence ne doit produire qu'un effet ; son utilisation avec un contenu contradictoire est refusée.
- Les webhooks Didit sont authentifiés, dédupliqués et ordonnés. L'expiration KYC ou un retrait AML peut retirer le plafond supérieur.
- Le quota de devis est partagé en base et non limité à la mémoire d'un processus.
- Les appels prestataires sont protégés contre une utilisation réelle depuis l'aperçu.

Cela ne certifie pas tous les parcours de toutes les routes, tous les droits de la base réelle, ni tous les scénarios de paiement.

## 5. Ce qui reste encore dans le frontend

### Frais et totaux d'affichage

`artifacts/sendflow/src/lib/transfer-amounts.ts` calcule encore un montant de frais, le montant reçu et le total affiché. Il est utilisé par :

- `pages/inter-transfer.tsx`
- `pages/international-transfer.tsx`
- `pages/deposit.tsx`

Le serveur possède son propre calcul indépendant. Néanmoins, conserver deux calculs peut produire un écran incohérent avec la réponse serveur. Le raccordement de ces pages doit afficher les champs du devis serveur au lieu de recalculer les résultats.

Il faut aussi gérer les changements rapides de saisie : une ancienne réponse de devis ne doit pas remplacer la réponse correspondant au montant ou à l'opérateur actuellement sélectionné. Les résultats indisponibles doivent rester indisponibles, pas être remplacés par un tarif local.

**Ces fichiers de pages n'ont pas été modifiés pendant ce lot.** Supprimer leurs calculs exige d'autoriser une modification de leur code de raccordement à l'API, même si leur apparence reste identique.

### Profil et stockage local

`src/lib/account-profile.ts` conserve un profil local et contient encore un profil fictif par défaut. Ce stockage ne prouve ni le nom, ni la date de naissance, ni la vérification d'identité d'un client.

Ces informations doivent venir d'une source serveur autorisée, avec une distinction explicite entre données déclarées, absentes et vérifiées. Les fausses valeurs de secours doivent disparaître du parcours concerné ; leur remplacement ne doit pas inventer de données.

### Drapeaux PIN et préférences

Les drapeaux sessionStorage influencent la navigation de plusieurs pages. Ils peuvent être falsifiés : ils ne doivent jamais remplacer les contrôles de session/PIN serveur.

Les préférences purement visuelles, la langue et l'étape d'un écran d'accueil peuvent rester locales. Tout déplacer en base ne rendrait pas automatiquement l'application plus sûre.

## 6. Corrections supplémentaires réellement effectuées

### A. Fraîcheur authentifiée du webhook

**Risque : haut pour le mécanisme anti-rejeu.** Une signature V2 valide porte sur le corps, pas sur les en-têtes HTTP. Vérifier seulement qu'un X-Timestamp non signé est récent ne suffit pas : une ancienne signature capturée peut conserver une signature valide si seul cet en-tête est remplacé.

Correction :

- exiger un `timestamp` numérique dans le contenu signé ;
- vérifier qu'il correspond à X-Timestamp ;
- appliquer la fenêtre de cinq minutes ;
- conserver `created_at` comme date de modification du dossier, distincte de l'heure d'envoi ;
- garder les contrôles d'idempotence et d'ordre existants.

Le test utilise une vraie signature HMAC synthétique valide sur un ancien corps, puis ne remplace que l'en-tête. La requête est refusée en HTTP 401 avant toute écriture d'événement.

Cela ne prouve pas un débit frauduleux possible avant correction : le traitement possédait déjà des protections d'idempotence et d'ordre, et les paiements sont désactivés.

### B. Formats de signatures invalides

**Risque : moyen, robustesse de l'authentification.** Une chaîne de 64 caractères non ASCII peut occuper plus de 64 octets et provoquer une exception dans la comparaison cryptographique.

Correction : accepter uniquement une signature hexadécimale de longueur correcte, puis comparer des octets de digest de même taille. Une signature malformée entraîne un refus 401, pas une erreur interne 500.

### C. Dernière barrière de gestion des erreurs

**Risque : moyen, fuite de détails techniques ou de contenu soumis.** En l'absence de gestionnaire final, les erreurs laissées à Express peuvent produire des réponses HTML avec détails en développement ou des journaux bruts.

Correction :

- gestionnaire final commun après les routes ;
- erreurs 400/413/415 avec messages fixes pour les corps malformés, trop gros ou encodages non acceptés ;
- chemin mal encodé : 400 sans recopier le chemin ;
- erreur interne : JSON générique 500 ;
- journalisation d'une représentation d'erreur nettoyée, sans message brut, SQL, paramètres ou corps ;
- réponse déjà commencée : fermeture sans déléguer à la sortie d'erreur par défaut ;
- route API inconnue : JSON 404 fixe, sans recopier une URL fournie par le client.

### Fichiers de ce passage

- `artifacts/api-server/src/lib/didit.ts`
- `artifacts/api-server/src/routes/identity-verification.ts`
- `artifacts/api-server/src/lib/http-error-handler.ts`
- `artifacts/api-server/src/app.ts`
- `lib/api-spec/openapi.yaml` et validateurs/types régénérés
- Tests de fraîcheur/signature, erreurs HTTP et suite HTTP/SQL isolée

Aucune nouvelle migration ni modification de données n'a été exécutée pendant ce passage.

## 7. État réel des fonctions financières

| Fonction | État à retenir |
|---|---|
| Calcul serveur de devis | Implémenté et testé avec données synthétiques |
| Quota et contrôles de plafonds | Implémentés ; nécessitent le schéma compatible |
| Ajustement atomique interne d'un portefeuille | Service testé ; cela n'ouvre pas l'administration |
| Accès administrateur utilisable | Toujours fermé, non activé par ces corrections |
| Transfert/dépôt client réellement exécuté | Toujours désactivé |
| Preuve d'un débit/crédit par un agrégateur réel | Non validée par ces tests |
| Réservation de solde/plafond pour des transferts simultanés | À qualifier lors de l'implémentation de l'exécution réelle |
| Conversion internationale, change réel, rapprochement, remboursements | Non certifiés opérationnels par ce lot |
| Migration de la base réelle | Non appliquée |
| Permissions réelles PostgreSQL et sauvegardes/restauration | Non vérifiées sur la base réelle |
| Rapprochement opérationnel des événements KYC ambigus | Reste à organiser |

Un registre d'ajustements administratifs ne constitue pas à lui seul un grand livre complet à partie double couvrant les paiements, frais, prestataires et contrepassations.

## 8. Pourquoi certaines fonctions peuvent être bloquées dans l'aperçu

L'aperçu est configuré avec une base Neon partagée contenant des données réelles. Les garde-fous existants bloquent les accès privés et les écritures concernées dans cet environnement. Une réponse 503 à une fonction privée peut donc être un refus volontaire, pas une panne ni une indication de clé incorrecte.

Une clé réelle reste une clé réelle ; l'environnement d'exécution de l'aperçu n'est pas pour autant un environnement autorisé à débiter ou à modifier des comptes réels. Je n'ai ni changé les clés ni retiré ces protections.

Pour tester les parcours complets sans risque, il faut un environnement de données isolé. Les tests de ce passage créent leur propre PostgreSQL jetable sans utiliser Neon.

## 9. Résultats effectivement obtenus

| Contrôle | Résultat |
|---|---|
| Génération OpenAPI et typecheck monorepo | Réussis |
| Typecheck serveur après les derniers changements | Réussi |
| Tests de politiques, sécurité, chiffrement et services | 85/85 |
| Tests d'intégration HTTP/SQL réels en base jetable | 12/12 |
| Simulations mémoire distinctes de concurrence | 3/3 |
| **Total des tests de la passe finale** | **100 réussis** |
| Contrôle de secrets sur les sources texte | 598 fichiers examinés lors du contrôle, 0 détection |
| Audit des dépendances | 0 vulnérabilité remontée |
| SAST | 0 résultat, scan déclaré non incomplet |
| HoundDog | 0 vulnérabilité remontée |
| Redémarrage API, requête de santé | Réussis |
| Capture de l'accueil public | Affichage présent, pas d'erreur console observée |

La suite d'intégration couvre notamment IDOR, absence de session, faux privilèges, statuts falsifiés, prix fournis par le navigateur, limites, PIN verrouillé, quota, concurrence, rollback, registre append-only, ancien KYC, signatures invalides, rejeu et erreurs de parsing.

Les tests ne touchent aucune donnée réelle et n'envoient aucune requête réelle Didit/eSMS. Aucun test navigateur connecté n'a été lancé pour ce passage.

## 10. Compétences et limites de l'audit

Les neuf compétences installées sont recensées dans le premier rapport. Pour ce passage, les instructions de revue de code, sécurité API et OWASP ont été réutilisées pour inspecter les frontières de confiance et définir des preuves ciblées.

**Strix n'est pas disponible et aucun scan Strix n'a été lancé.** Les trois scanners cités ci-dessus sont d'autres outils. Zéro détection ne signifie pas absence de vulnérabilité.

L'inventaire de 55 routes ne remplace pas une matrice de tests complète pour chaque route, rôle et état. L'historique Git entier, les bundles de production, les permissions en production, les sauvegardes et les intégrations live ne sont pas certifiés par cette passe.

## 11. Ordre de poursuite recommandé

1. Autoriser explicitement le raccordement des pages au devis et aux données serveur, sans changement d'apparence.
2. Retirer les calculs financiers et profils fictifs des parcours concernés ; conserver seulement la présentation et la saisie côté navigateur.
3. Préparer séparément l'activation des migrations et des permissions réelles avec sauvegarde, contrôle de cible et accord avant application.
4. Organiser le rapprochement des événements KYC ambigus, avec alertes et conservation maîtrisée des reçus chiffrés.
5. Avant toute activation des transferts : implémenter et qualifier l'exécution prestataire, les réservations atomiques, les transitions financières, les remboursements et le rapprochement.
6. Valider chaque nouveau parcours sur données isolées et compléter la matrice d'accès par route.

Les pages restent inchangées à la fin de cette intervention. Il serait inexact d'affirmer que toute logique financière d'affichage a déjà disparu du frontend, ou que SendFlow est prêt à déplacer des fonds réels.
