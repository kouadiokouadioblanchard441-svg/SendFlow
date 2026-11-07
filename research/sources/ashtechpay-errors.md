---
title: AshTech Pay — Erreurs HTTP
url: https://doc.ashtechpay.com/docs/errors.md
retrieved: 2026-11-07
http_status: 200
source: official public vendor documentation
---

> ## Documentation Index
> Fetch the complete documentation index at: https://doc.ashtechpay.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Erreurs et statuts HTTP

> Comprenez les erreurs API et rendez votre intégration fiable.

| Statut | Signification | Action |
| - | - | - |
| `400` | Requête ou champ invalide | Corriger les données avant de réessayer |
| `401` | Clé absente ou invalide | Vérifier le secret côté serveur |
| `403` | Compte non vérifié ou accès non activé | Contacter AshTech Pay |
| `404` | Transaction ou ressource introuvable | Vérifier l'identifiant |
| `409` | Conflit ou référence déjà utilisée | Utiliser une référence unique |
| `429` | Trop de requêtes | Appliquer un backoff et réduire la fréquence |
| `500` | Erreur temporaire côté serveur | Réessayer avec prudence et vérifier le statut |

## Format d'erreur

```json theme={null}
{
  "error": "invalid_amount",
  "message": "amount must be a positive number."
}
```

## Réessayer sans doubler un paiement

Ne relancez pas aveuglément une création de paiement après un timeout réseau. Enregistrez votre `reference`, vérifiez le statut de la transaction et contactez le support si la réponse reste ambiguë.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.