---
title: AshTech Pay — Introduction
url: https://doc.ashtechpay.com/docs/introduction.md
retrieved: 2026-11-07
http_status: 200
source: official public vendor documentation
---

> ## Documentation Index
> Fetch the complete documentation index at: https://doc.ashtechpay.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Bienvenue sur AshTech Pay

> Intégrez des paiements Mobile Money et crypto dans votre application.

AshTech Pay fournit une API de paiement conçue pour les marchands et les équipes produit qui veulent accepter des paiements en Afrique avec une seule intégration.

> [card] [Hosted Checkout](https://doc.ashtechpay.com/docs/embedded-checkout.md)
>
> Créez un lien de paiement hébergé par AshTech Pay et redirigez votre client vers une page optimisée pour mobile.

> [card] [Direct API](https://doc.ashtechpay.com/docs/direct-api/overview.md)
>
> Gardez le contrôle de votre interface et déclenchez les collectes Mobile Money ou crypto depuis votre serveur.

## Ce que vous pouvez faire

* Consulter les pays et opérateurs disponibles en temps réel.
* Créer une collecte Mobile Money avec une référence marchand.
* Recevoir les mises à jour de transaction par webhook.
* Accepter des paiements crypto avec une adresse et un réseau dédiés.
* Vérifier une transaction et consulter les frais applicables.

## Base URL

Toutes les requêtes API utilisent la base URL suivante :

```text theme={null}
https://www.ashtechpay.com
```

Les clés API doivent rester côté serveur. Ne les exposez jamais dans du JavaScript exécuté dans le navigateur ou dans une application mobile.

> [!NOTE]
>
> Votre environnement de documentation est `doc.ashtechpay.com`. Il documente l'API hébergée sur `www.ashtechpay.com`.

## Parcours recommandé

**1. Activez votre accès API**

Connectez-vous au dashboard AshTech Pay, terminez le KYC et demandez l'activation API si nécessaire.

**2. Choisissez votre intégration**

Utilisez Hosted Checkout pour rediriger rapidement un client vers AshTech Pay, ou Direct API pour une expérience entièrement personnalisée.

**3. Testez avant la production**

Commencez par les endpoints de pays et de frais, puis testez une collecte et votre webhook avec des références uniques.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.