# Numérotation et couverture SMS — examen du 22 octobre 2026

## Résultat et limites

Les **neuf pays du seed** ont été comparés aux notifications officielles des
régulateurs publiées par l’UIT. Trois corrections de longueur sont proposées :
**Mali 9 → 8, Niger 9 → 8, Congo-Brazzaville 7–12 → 9**.
Les neuf indicatifs sont cohérents avec ces notifications et l’API publique eSMS.

**Aucun pays n’est déclaré prêt à ouvrir.** Cet examen n’a lu ni modifié Neon,
n’a lu aucune clé, n’a appelé aucun service authentifié, n’a envoyé aucun SMS.
Les seules requêtes fournisseur ont été des GET publics de documentation,
de tarification et de couverture. Les comptes et le pays associé aux appareils
ne sont pas modifiés.

Le point de comparaison est
`lib/db/migrations/2026-10-22-country-operations-and-routing.sql`, **pas un relevé
des valeurs actuelles de Neon**. La migration historique n’est pas corrigée
rétroactivement : son `ON CONFLICT DO NOTHING` ne corrigerait pas les lignes
existantes. Les propositions sont dans [proposals.json](./proposals.json), fichier
documentaire non importé par l’application, non exécuté par les migrations.
`openingApproved: false` y exprime l’absence d’approbation dans cet examen ;
ce n’est pas le statut réel `enabled` de Neon.

## Comparaison par pays

Longueurs **nationales significatives**, hors indicatif `+CCC`, pour les numéros
longs d’abonnés. Les codes d’urgence, numéros courts, services surtaxés ou M2M
ne doivent pas être rendus admissibles à l’inscription par un élargissement
aveugle de ces bornes.

| Pays | Indicatif | Seed min–max | Proposition min–max | Source officielle consultée |
| --- | --- | --- | --- | --- |
| Côte d’Ivoire | +225 | 10–10 | 10–10, conserver | [ARTCI, 24/12/2020][ci] |
| Sénégal | +221 | 9–9 | 9–9, conserver | [ARTP, 03/10/2023 et plan 06/09/2022][sn] |
| Burkina Faso | +226 | 8–8 | 8–8, conserver | [ARCEP, 04/05/2023, notifications cumulées][bf] |
| Bénin | +229 | 10–10 | 10–10, conserver | [ARCEP-BENIN, 24/04/2024][bj] |
| Mali | +223 | 9–9 | **8–8** | [AMRTP, 06/03/2018][ml] |
| Niger | +227 | 9–9 | **8–8** | [ARCEP, 28/10/2020 et 27/05/2020][ne] |
| Togo | +228 | 8–8 | 8–8, conserver | [ARCEP, 11/01/2021][tg] |
| Cameroun | +237 | 9–9 | 9–9, conserver | [ART, 06/10/2014][cm] |
| Congo-Brazzaville | +242 | 7–12 | **9–9** | [ARPCE, 01/11/2024 et plan 01/09/2010][cg] |

Ces documents ont été ouverts, pas seulement retrouvés dans des résultats de
recherche. Ils sont accessibles depuis le [répertoire officiel des plans UIT][itu].
Leurs dates parfois anciennes sont conservées : une consultation en 2026 ne
transforme pas une allocation de 2014 ou 2018 en preuve d’allocation exhaustive
en temps réel. Revalider les nouvelles allocations avant ouverture ; les neuf
longueurs ci-dessus sont étayées, pas la disponibilité de chaque numéro.

### Restrictions de format et précautions

- **Côte d’Ivoire** : passage de 8 à 10 chiffres le 31/01/2021. Mobiles
  `01`, `05`, `07` + huit chiffres ; fixes `21`, `25`, `27` + huit chiffres.
  Le `0` mobile fait partie du numéro international : ne jamais transformer
  `+22507…` en `+2257…`. Dix chiffres seuls ne garantissent pas une ligne mobile.
- **Sénégal** : neuf chiffres. Le plan décrit les classes mobiles `70`, `72`,
  `75`, `76`, `77`, `78`, `79`, et notamment les classes fixes/VoIP `30`, `32`,
  `33`, `36`, `39`, `93`. Les notifications 2023 ajoutent des sous-blocs,
  dont des MVNO : ne pas limiter sans preuve les mobiles à `77`/`78`.
- **Burkina Faso** : huit chiffres. Le document cumulé inclut les mobiles
  `01`, `02`, `03`, `05`, `06`, `07`, `50`, `51`, `52`, `54`–`58`,
  `60`–`79`. `03` (2022) et `50` (2023) montrent pourquoi une ancienne
  liste de préfixes est insuffisante. Les zéros de `01` etc. sont significatifs.
- **Bénin** : `01` + ancien numéro à huit chiffres, soit dix chiffres, à partir du
  30/11/2024 à 00:00 UTC+1. Conserver `+22901…`, refuser les anciens huit
  chiffres pour une nouvelle inscription. `01` ne distingue pas les mobiles des
  fixes : le tableau décrit notamment `0120…`–`0124…` comme fixes, et les
  anciens blocs `40`–`64` comme mobiles. Il ne faut pas en déduire que
  tous les numéros `01…` sont des mobiles attribués.
- **Mali** : huit chiffres ; classes mobiles `50`, `6`, `7`, `82`, `83`,
  `89`, `90`–`99` dans le plan consulté. Le document décrit séparément
  `2079` et `217` comme mobiles CDMA : leur admissibilité à l’OTP ne se
  déduit pas de cette seule qualification. Les neuf chiffres du seed excluent
  les numéros conformes et admettent une longueur injustifiée.
- **Niger** : huit chiffres ; mobiles `70`, `74`, `80`–`89`, `90`–`99`,
  fixes `20`, `21`, `23` dans la notification. Le bloc `83` est explicitement
  confirmé. Ne pas confondre Niger `NE/+227` et Nigeria `NG/+234`.
- **Togo** : huit chiffres. Dans le document de 2021, mobiles attribués
  `90`–`93`, `96`–`99`, `700`–`705`, `793`–`799` ; d’autres blocs mobiles
  sont alors non attribués. Fixes géographiques en `2…`. Ne pas utiliser
  les blocs non attribués de ce document comme une liste d’interdiction de 2026.
- **Cameroun** : neuf chiffres depuis le 21/11/2014, mobiles de classe `6…`,
  fixes et mobilité restreinte de classe `2…`. La classe `6` n’est pas une
  preuve d’attribution de chaque sous-bloc ni d’opérateur actuel.
- **Congo-Brazzaville** : neuf chiffres depuis octobre 2010. Zéro significatif
  des mobiles historiques `01`, `04`, `05`, `06` ; blocs mobiles spécifiques
  `02` annoncés en 2020 ; fixes en `22`. Ne pas supprimer le zéro après
  `+242`, ni confondre `CG/+242` et `CD/+243`. La borne 7 admet l’ancien plan,
  et la borne 12 admet des longueurs non justifiées pour ces abonnés.

**Incohérences des sources à ne pas reproduire** :
le PDF Bénin annonce novembre 2024 dans son texte et ses colonnes de coexistence
mais comporte des cellules « 2024-08-31 » dans le tableau de changement.
Le PDF Congo 2024 comporte une plage MTN imprimée sur huit chiffres alors que
son en-tête, ses bornes explicites et le plan historique en indiquent neuf.
On retient les longueurs clairement décrites, **sans reconstruire la plage MTN
ambiguë**. Demander une clarification officielle avant de programmer cette
allocation particulière.

## eSMS : ce qui est vérifié, ce qui ne l’est pas

Observations du 22/10/2026, sans authentification :

1. [Ancienne page Coverage & Pricing][legacy-coverage] : liste sept des neuf
   pays ; **Bénin et Togo absents**. Ce n’est pas une preuve de non-couverture.
2. [Documentation actuelle Global Coverage][coverage-doc] : différencie
   `available` et `on_request` et recommande le GET public
   [`/api/pricing/coverage`][coverage-api].
3. Ce GET a répondu avec `total: 232`, `available: 46` ; **les neuf pays
   examinés ont `status: available`**, région `africa`, et les indicatifs du
   tableau ci-dessus. Les prix d’exemple de la documentation ne sont pas repris
   comme devis ou tarifs contractuels.
4. Le GET public [`/api/pricing`][pricing-api] annonce pour chacun les routes
   `ESMS_CI`, `ESMS_SN`, `ESMS_BF`, `ESMS_BJ`, `ESMS_ML`, `ESMS_NE`,
   `ESMS_TG`, `ESMS_CM`, `ESMS_CG`. Les noms de champs observés
   (`route_code`, `sender_id`) diffèrent de l’ancien exemple (`code`,
   `sender_id_default`). Ne pas inventer un `is_active` absent de cette réponse.

| Pays | Route publique observée | Statut public | Verify SendFlow | Livraison par opérateur |
| --- | --- | --- | --- | --- |
| CI | ESMS_CI | available | non vérifié | non testée |
| SN | ESMS_SN | available | non vérifié | non testée |
| BF | ESMS_BF | available | non vérifié | non testée |
| BJ | ESMS_BJ | available | non vérifié | non testée |
| ML | ESMS_ML | available | non vérifié | non testée |
| NE | ESMS_NE | available | non vérifié | non testée |
| TG | ESMS_TG | available | non vérifié | non testée |
| CM | ESMS_CM | available | non vérifié | non testée |
| CG | ESMS_CG | available | non vérifié | non testée |

Un statut public n’atteste ni le solde, ni les droits du compte, ni l’expéditeur
autorisé, ni les restrictions opérateur, ni la réception effective d’un OTP.
La [configuration Verify App][verify-app] porte sa propre liste
`allowed_countries` et son indicateur `enabled`. Ceux du compte SendFlow restent
**inconnus** ici. Faire vérifier cette configuration par le responsable autorisé,
sans partager de clés. Les restrictions par réseau, le format Bénin à dix chiffres,
les zéros significatifs et les conditions d’expéditeur doivent être confirmés.

La documentation fournisseur est également incohérente sur les chemins Verify :
[référence SMS][api-reference] et [page produit][verify-product] donnent
`/api/verify/start`, comme le client actuel
`artifacts/api-server/src/lib/esms-verify.ts`, alors que la
[documentation Verify][verify-doc] donne `/v1/verify/start`.
Ne pas changer d’URL ni essayer un POST pour résoudre cette divergence.
La documentation récente annonce un mode test gratuit, mais une observation
antérieure du projet a reçu un 402 avec une clé de test : ne pas supposer
qu’un préfixe de clé garantit un envoi gratuit. Aucun essai Verify n’a été fait ici.

Enfin la consigne générique eSMS « drop the leading 0 » concerne un **préfixe
national de sélection**, pas tous les zéros initiaux. Les notifications
nationales priment pour CI, BJ, BF et CG : leurs zéros significatifs doivent rester.

## Effet dans le code et corrections proposées

### 1. Configuration, sans ouverture

Après autorisation explicite seulement, relever les versions et valeurs actuelles
dans l’administration autorisée. Comparer à l’attendu du fichier de proposition ;
si elles ont changé, arrêter et refaire la comparaison. Pour ML/NE proposer
`minPhoneDigits = maxPhoneDigits = 8`, pour CG `= 9`.
Conserver `phonePrefix` et `countryName` réels. Utiliser la version actuelle
`expectedVersion` et un motif d’audit qui cite cet examen ; ne jamais recopier
la version fictive des tests.

Ne pas activer `enabled` ni les opérations à cette occasion ; les booléens
existants doivent être conservés et toute suspension ou ouverture décidée
explicitement. La route PATCH exige un corps complet : ne pas écraser les
réglages d’opération avec des valeurs par défaut. Un conflit de version 409 exige
une nouvelle lecture, pas un retry qui force la modification. Aucune commande de
mutation, migration automatique ou patch prêt à exécuter sur Neon n’est fourni.

### 2. Limites qu’une correction de longueur ne peut pas résoudre

- `routes/country-management.ts` vérifie indicatif, bornes et limite E.164 de
  quinze chiffres, **pas un plan réglementaire ou la couverture eSMS**.
  `/auth/countries` retourne aussi les pays désactivés avec leur statut :
  présence dans ce résultat ≠ droit de s’inscrire.
- `routes/customer-auth.ts` filtre les pays activés et les longueurs, avec
  verrou partagé pendant l’inscription et choix non ambigu du plus long
  indicatif. Une correction des trois lignes corrigerait ce contrôle de longueur,
  **pas les préfixes de service**. Ne pas modifier les comptes existants ni le
  mécanisme multi-appareils dans ce travail.
- `services/transfer-quote.ts` lit les mêmes bornes via ses dépendances et
  contrôle séparément pays/opérateur/opération. Il compte actuellement les
  chiffres après suppression de caractères non numériques. Les schémas HTTP
  Zod imposent bien un format canonique : la permissivité du service n’est
  **pas présentée comme un contournement HTTP démontré**.
- L’inscription, l’OTP et les devis acceptent structurellement de nombreux
  préfixes non mobiles si seule la longueur est bonne. Le numéro peut être un
  fixe ou un bloc réservé. La route `routes/phone-otp.ts` valide le schéma
  E.164, mais ne consulte pas le catalogue pays avant `esms.start` :
  corriger `sf_countries` ne suffit pas à empêcher une demande OTP vers
  un pays désactivé ou une longueur nationale erronée.

Proposition avant ouverture : validation serveur partagée du format canonique,
indicatif, longueur et service admissible, puis contrôles indépendants de
l’éligibilité OTP et des paiements. Les règles de service doivent être sourcées,
datées et actualisables ; les listes historiques ci-dessus ne sont pas un
routeur Mobile Money ni une liste exhaustive d’opérateurs actuels.
Les éventuelles restrictions d’une nouvelle inscription ne doivent pas casser
la connexion/récupération des comptes existants sans stratégie explicite.
Ce rapport **propose**, mais ne branche pas ces nouvelles règles en production.

## Tests isolés et reproduction

Depuis la racine, sans serveur ni base :

```sh
node scripts/country-validation/proposal-audit.mjs
node --experimental-strip-types --test scripts/country-validation/proposal-audit.test.mjs
```

Le premier ne produit qu’un diff JSON des trois changements proposés ;
il n’ouvre aucune connexion et n’a pas de mode d’application.
Les tests n’importent ni le serveur, ni `@workspace/db`, ni le client eSMS,
ne chargent aucun fichier d’environnement et interdisent `fetch`.
Les exemples sont des chaînes synthétiques, jamais des destinataires à contacter ;
leur conformité de forme ne prouve ni allocation individuelle ni possession.

Couverture : exhaustivité des neuf pays par rapport au seed inchangé, cohérence
des indicatifs/sources, corrections exactes, E.164 ≤ quinze chiffres,
formats malformés, limites inférieure/supérieure, anciens plans et zéros
significatifs ; vrais schémas Zod d’administration/inscription/OTP/devis ;
vrai service de devis pour dépôt, inter-réseaux et international avec dépendances
en mémoire, pays/opération désactivés et mauvais indicatifs.
Les tests de caractérisation rendent explicites les lacunes restantes
(fixes/préfixes de service et permissivité interne), sans prétendre les corriger.

Pas de test HTTP d’inscription ou d’OTP connecté, de transaction SQL,
de quota/concurrence, ni de livraison réelle. Ces tests ne prouvent pas
le comportement d’une session complète ni l’état de Neon. Aucun écran,
service applicatif ou contrat n’a été modifié ; pas de redémarrage requis.

## Conditions avant une ouverture autorisée

1. Faire approuver et appliquer séparément les corrections nécessaires, avec
   versions actuelles, audit et vérification de lecture, sans activer d’opération.
2. Fermer les lacunes de validation serveur et tester leurs branches refusées
   dans une base réellement isolée ; préserver les comptes existants.
3. Faire confirmer par le responsable eSMS les pays permis pour l’app Verify,
   l’URL contractuelle, le solde/droits, expéditeurs et réseaux couverts.
   Réactualiser le GET public ; un statut absent, inconnu ou `on_request`
   bloque une nouvelle ouverture.
4. Décider séparément d’une éventuelle recette de livraison sur des numéros
   contrôlés, avec budget et consentement explicites. Non réalisée dans cet examen.
5. Autoriser chaque pays et chaque opération seulement après leurs propres
   contrôles financiers et fournisseurs ; SMS disponible ≠ paiement disponible.

[itu]: https://www.itu.int/oth/T0202.aspx?lang=fr&parent=T0202
[ci]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000310006PDFE.pdf
[sn]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000B80006PDFE.pdf
[bf]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000210020PDFE.pdf
[bj]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000170002PDFE.pdf
[ml]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000830004PDFE.pdf
[ne]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T020200009B0003PDFE.pdf
[tg]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000D10003PDFE.pdf
[cm]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T02020000240001PDFE.pdf
[cg]: https://www.itu.int/dms_pub/itu-t/oth/02/02/T020200002E0009PDFE.pdf
[legacy-coverage]: https://esmsafrica.io/docs/help/coverage
[coverage-doc]: https://docs.esmsafrica.io/docs/sms/coverage
[coverage-api]: https://sms.esmsafrica.io/api/pricing/coverage
[pricing-api]: https://sms.esmsafrica.io/api/pricing
[verify-app]: https://docs.esmsafrica.io/docs/verify/apps
[verify-doc]: https://docs.esmsafrica.io/docs/verify
[verify-product]: https://esmsafrica.io/verify
[api-reference]: https://docs.esmsafrica.io/docs/api-reference
