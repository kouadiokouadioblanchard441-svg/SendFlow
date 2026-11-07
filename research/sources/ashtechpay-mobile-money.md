---
title: AshTech Pay — Mobile Money
url: https://doc.ashtechpay.com/docs/direct-api/mobile-money.md
retrieved: 2026-11-07
http_status: 200
source: official public vendor documentation
---

> ## Documentation Index
> Fetch the complete documentation index at: https://doc.ashtechpay.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Mobile Money

> Créez et suivez une collecte Mobile Money.

## Créer une collecte

```http theme={null}
POST https://www.ashtechpay.com/v1/collect
```

> [tab] Node.js
>
> ```javascript theme={null}
> const response = await fetch("https://www.ashtechpay.com/v1/collect", {
>   method: "POST",
>   headers: {
>     Authorization: `Bearer ${process.env.ASHTECH_API_KEY}`,
>     "Content-Type": "application/json",
>   },
>   body: JSON.stringify({
>     user_id: "VOTRE_USER_ID",
>     amount: 1000,
>     currency: "XAF",
>     country_code: "CM",
>     operator: "MTN Money",
>     phone: "2376XXXXXXXX",
>     reference: "order_12345",
>     notify_url: "https://example.com/webhooks/ashtechpay",
>   }),
> });
>
> const payment = await response.json();
> ```

> [tab] Python
>
> ```python theme={null}
> import os
> import requests
>
> response = requests.post(
>     "https://www.ashtechpay.com/v1/collect",
>     headers={
>         "Authorization": f"Bearer {os.environ['ASHTECH_API_KEY']}",
>         "Content-Type": "application/json",
>     },
>     json={
>         "user_id": "VOTRE_USER_ID",
>         "amount": 1000,
>         "currency": "XAF",
>         "country_code": "CM",
>         "operator": "MTN Money",
>         "phone": "2376XXXXXXXX",
>         "reference": "order_12345",
>         "notify_url": "https://example.com/webhooks/ashtechpay",
>     },
> )
> payment = response.json()
> ```

> [tab] cURL
>
> ```bash theme={null}
> curl -X POST https://www.ashtechpay.com/v1/collect \
>   -H "Authorization: Bearer $ASHTECH_API_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{
>     "user_id": "VOTRE_USER_ID",
>     "amount": 1000,
>     "currency": "XAF",
>     "country_code": "CM",
>     "operator": "MTN Money",
>     "phone": "2376XXXXXXXX",
>     "reference": "order_12345",
>     "notify_url": "https://example.com/webhooks/ashtechpay"
>   }'
> ```

> [tab] PHP / Laravel
>
> ```php theme={null}
> <?php
>
> $payload = [
>     "user_id" => "VOTRE_USER_ID",
>     "amount" => 1000,
>     "currency" => "XAF",
>     "country_code" => "CM",
>     "operator" => "MTN Money",
>     "phone" => "2376XXXXXXXX",
>     "reference" => "order_12345",
>     "notify_url" => "https://example.com/webhooks/ashtechpay",
> ];
>
> $ch = curl_init("https://www.ashtechpay.com/v1/collect");
> curl_setopt_array($ch, [
>     CURLOPT_POST => true,
>     CURLOPT_RETURNTRANSFER => true,
>     CURLOPT_HTTPHEADER => [
>         "Authorization: Bearer " . getenv("ASHTECH_API_KEY"),
>         "Content-Type: application/json",
>     ],
>     CURLOPT_POSTFIELDS => json_encode($payload),
> ]);
>
> $payment = json_decode(curl_exec($ch), true);
> curl_close($ch);
> ```

## Données importantes

| Champ | Obligatoire | Description |
| - | - | - |
| `user_id` | Oui | Identifiant du profil AshTech Pay associé à la clé Bearer |
| `amount` | Oui | Montant positif à collecter |
| `currency` | Oui | Devise du pays sélectionné |
| `country_code` | Oui | Code pays actif, par exemple `CM` |
| `operator` | Oui | Nom exact de l'opérateur renvoyé par `/v1/countries` (par exemple `MTN Money` ou `Mixx By Yas`), sensible au catalogue actif |
| `phone` | Oui | Numéro international associé au wallet. Les séparateurs usuels sont acceptés; les lettres et autres caractères non téléphoniques sont refusés. |
| `reference` | Non | Référence de votre commande (191 caractères maximum), conservée comme `merchant_reference` et utilisée pour les reprises idempotentes |
| `notify_url` | Non | URL HTTPS de votre webhook marchand |

> [!WARNING]
>
> `country_code` est obligatoire (le champ `country` n'est pas accepté). Utilisez exactement la valeur retournée par `/v1/countries`, par exemple `MTN Money`, `Orange Money` ou `Mixx By Yas` pour Togo. Les anciens noms T-Money restent acceptés pour compatibilité.

## Statut

Le traitement peut être asynchrone. Utilisez `GET /v1/transaction/:id?user_id=VOTRE_USER_ID` pour vérifier une transaction, mais utilisez le webhook pour déclencher votre fulfillment.

Pour les parcours USSD Push, Wave, OTP SMS et OTP USSD, consultez [les flux de paiement détaillés](https://doc.ashtechpay.com/docs/direct-api/payment-flows.md).

> [tab] Node.js
>
> ```javascript theme={null}
> const response = await fetch(
>   "https://www.ashtechpay.com/v1/transaction/TRANSACTION_ID?user_id=VOTRE_USER_ID",
>   {
>     headers: {
>       Authorization: `Bearer ${process.env.ASHTECH_API_KEY}`,
>     },
>   },
> );
> const transaction = await response.json();
> ```

> [tab] Python
>
> ```python theme={null}
> import os
> import requests
>
> response = requests.get(
>     "https://www.ashtechpay.com/v1/transaction/TRANSACTION_ID?user_id=VOTRE_USER_ID",
>     headers={"Authorization": f"Bearer {os.environ['ASHTECH_API_KEY']}"},
> )
> transaction = response.json()
> ```

> [tab] cURL
>
> ```bash theme={null}
> curl "https://www.ashtechpay.com/v1/transaction/TRANSACTION_ID?user_id=VOTRE_USER_ID" \
>   -H "Authorization: Bearer $ASHTECH_API_KEY"
> ```

> [tab] PHP / Laravel
>
> ```php theme={null}
> <?php
>
> $ch = curl_init("https://www.ashtechpay.com/v1/transaction/TRANSACTION_ID?user_id=VOTRE_USER_ID");
> curl_setopt_array($ch, [
>     CURLOPT_RETURNTRANSFER => true,
>     CURLOPT_HTTPHEADER => [
>         "Authorization: Bearer " . getenv("ASHTECH_API_KEY"),
>     ],
> ]);
>
> $transaction = json_decode(curl_exec($ch), true);
> curl_close($ch);
> ```


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.