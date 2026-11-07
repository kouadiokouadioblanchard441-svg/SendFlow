---
title: AshTech Pay — Authentification
url: https://doc.ashtechpay.com/docs/authentication.md
retrieved: 2026-11-07
http_status: 200
source: official public vendor documentation
---

> ## Documentation Index
> Fetch the complete documentation index at: https://doc.ashtechpay.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Authentification

> Sécurisez vos appels à l'API AshTech Pay.

## Bearer token

Toutes les routes Direct API protégées utilisent votre clé API dans l'en-tête `Authorization` :

```http theme={null}
Authorization: Bearer YOUR_API_KEY
```

Exemple pour charger les pays avec votre clé API :

> [tab] Node.js
>
> ```javascript theme={null}
> const response = await fetch("https://www.ashtechpay.com/v1/countries", {
>   headers: {
>     Authorization: `Bearer ${process.env.ASHTECH_API_KEY}`,
>   },
> });
>
> const countries = await response.json();
> ```

> [tab] Python
>
> ```python theme={null}
> import os
> import requests
>
> response = requests.get(
>     "https://www.ashtechpay.com/v1/countries",
>     headers={"Authorization": f"Bearer {os.environ['ASHTECH_API_KEY']}"},
> )
> countries = response.json()
> ```

> [tab] cURL
>
> ```bash theme={null}
> curl https://www.ashtechpay.com/v1/countries \
>   -H "Authorization: Bearer $ASHTECH_API_KEY"
> ```

> [tab] PHP / Laravel
>
> ```php theme={null}
> <?php
>
> $ch = curl_init("https://www.ashtechpay.com/v1/countries");
> curl_setopt_array($ch, [
>     CURLOPT_RETURNTRANSFER => true,
>     CURLOPT_HTTPHEADER => [
>         "Authorization: Bearer " . getenv("ASHTECH_API_KEY"),
>     ],
> ]);
>
> $countries = json_decode(curl_exec($ch), true);
> curl_close($ch);
> ```

## Quelle clé utiliser ?

AshTech Pay utilise deux clés actives pour les intégrations actuelles. Elles ne sont pas interchangeables :

| Clé | Où l'utiliser | Usage |
| - | - | - |
| `hp_live_...` (clé Checkout) | Backend uniquement | Crée les liens Hosted Checkout par redirection et permet de consulter leur statut. |
| `ak_...` (clé Direct API) | Backend uniquement | Authentifie les endpoints Direct API comme `/v1/collect`, `/v1/crypto/collect` et `/v1/countries`. |

Pour le Hosted Checkout par redirection, le navigateur reçoit uniquement le `payment_link`. Il ne reçoit aucune clé secrète et aucun script public n'est nécessaire.

## Règles de sécurité

* Conservez la clé dans un secret ou une variable d'environnement.
* Effectuez les appels depuis votre backend.
* Ne mettez jamais `hp_live_...` ou `ak_...` dans une page web, une application mobile ou un dépôt Git.
* Utilisez une clé distincte pour chaque environnement lorsque cela est possible.
* Faites tourner immédiatement une clé exposée depuis le dashboard.

> [!NOTE]
>
> Pour créer un lien Hosted Checkout, utilisez `Authorization: Bearer hp_live_...` depuis votre serveur. Pour les endpoints Direct API `/v1/*`, utilisez `Authorization: Bearer ak_...`.

## Réponse non authentifiée

Une clé absente, invalide ou non autorisée renvoie une erreur HTTP `401`. Un compte vérifié mais non activé peut recevoir `403`.

```json theme={null}
{
  "error": "unauthorized",
  "message": "Invalid API key."
}
```


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.