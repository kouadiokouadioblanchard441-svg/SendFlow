---
title: Stripe — Testing
url: https://docs.stripe.com/testing.md
retrieved: 2026-11-07
http_status: 200
source: official public vendor documentation
---

# Testing

Simulate payments to test your integration.

Test your integration in a *sandbox* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes) by simulating transactions with test values—these transactions don’t move funds.

You can access your sandboxes using the account picker in the [Dashboard](https://dashboard.stripe.com/sandboxes).

Test cards act as “fake” credit cards, and allow you to simulate the following scenarios:

- Successful payments by [card brand](https://docs.stripe.com/testing.md#cards) or [country](https://docs.stripe.com/testing.md#international-cards)
- Card errors due to [declines](https://docs.stripe.com/testing.md#declined-payments), [fraud](https://docs.stripe.com/testing.md#fraud-prevention), or [invalid data](https://docs.stripe.com/testing.md#trigger-an-error-with-invalid-data)
- [Disputes](https://docs.stripe.com/testing.md#disputes), including early fraud warnings, and [refunds](https://docs.stripe.com/testing.md#refunds)
- Authentication with [3D Secure](https://docs.stripe.com/testing.md#regulatory-cards) and [PINs](https://docs.stripe.com/testing.md#terminal)

You can also test non-card payments in a sandbox. Non-card payments are payment methods that aren’t credit or debit cards. Stripe supports various non-card payment options, such as digital wallets and bank transfers. [Each payment method](https://docs.stripe.com/testing.md#non-card-payments) has its own special values.

If you’re testing a subscription integration, see [Test your Billing integration](https://docs.stripe.com/billing/testing.md).

Don’t use testing environments to load test your integration because you might hit [rate limits](https://docs.stripe.com/testing.md#rate-limits). To load test your integration, see [load testing](https://docs.stripe.com/rate-limits.md#load-testing).

## How to use test cards 

When you work with a test card, use [test API keys](https://docs.stripe.com/keys.md#obtain-api-keys) in all API calls. This is true whether you’re serving a payment form to test interactively or writing test code.

Card-level state from one test can affect later tests that use the same card. When a test depends on card-level state, use a different test card for each independent end-to-end scenario.

> #### Don't use real card details
> 
> Don’t use real card details. The [Stripe Services Agreement](https://stripe.com/legal/ssa#1-your-stripe-account) prohibits testing in live mode using real payment method details. Use your test API keys and the card numbers below.

### Testing interactively

When testing interactively, use a card number, such as [4242 4242 4242 4242](https://docs.stripe.com/testing.md?testing-method=card-numbers#visa). Enter the card number in the Dashboard or in any payment form.

- Use a valid future date, such as **12/34**.
- Use any three-digit CVC (four digits for American Express cards).
- Use any value you like for other form fields.

### Test code

When writing test code, use a `PaymentMethod` such as [pm_card_visa](https://docs.stripe.com/testing.md?testing-method=payment-methods#visa) instead of a card number. We don’t recommend using card numbers directly in API calls or server-side code, even in testing environments. If you use them, your code might not be PCI-compliant when you go live. By default, a `PaymentMethod` isn’t attached to a *Customer* (Customer objects represent customers of your business. They let you reuse payment methods and give you the ability to track multiple payments).

```curl
curl https://api.stripe.com/v1/payment_intents \
  -u "<<YOUR_SECRET_KEY>>:" \
  -d amount=500 \
  -d currency=gbp \
  -d payment_method=pm_card_visa
```

When you’re ready to take your integration live, replace your test publishable and secret [API keys](https://docs.stripe.com/keys.md) with live ones.

You can’t process live payments if your integration is still using your test API keys. Store live API keys in a secrets vault or environment variables. Don’t store keys in source code or configuration files checked into version control. To learn how to use live keys safely, see [Best practices for managing secret API keys](https://docs.stripe.com/keys-best-practices.md).

## Simulate a payment by card brand 

To simulate a successful payment for a specific card brand, use test cards from the following list.

Cross-border fees are assessed based on the country of the card issuer. Cards where the issuer country isn’t the US (such as JCB and UnionPay) might be subject to a cross-border fee, even in testing environments.

#### Card numbers

| Brand | Number | CVC | Date |
| --- | --- | --- | --- |
| Visa | 4242424242424242 | Any 3 digits | Any future date |
| Visa (debit) | 4000056655665556 | Any 3 digits | Any future date |
| Mastercard | 5555555555554444 | Any 3 digits | Any future date |
| Mastercard (2-series) | 2223003122003222 | Any 3 digits | Any future date |
| Mastercard (debit) | 5200828282828210 | Any 3 digits | Any future date |
| Mastercard (prepaid) | 5105105105105100 | Any 3 digits | Any future date |
| American Express | 378282246310005 | Any 4 digits | Any future date |
| American Express | 371449635398431 | Any 4 digits | Any future date |
| Discover | 6011111111111117 | Any 3 digits | Any future date |
| Discover | 6011000990139424 | Any 3 digits | Any future date |
| Discover (debit) | 6011981111111113 | Any 3 digits | Any future date |
| Diners Club | 3056930009020004 | Any 3 digits | Any future date |
| Diners Club (14-digit card) | 36227206271667 | Any 3 digits | Any future date |
| BCcard and DinaCard | 6555900000604105 | Any 3 digits | Any future date |
| JCB | 3566002020360505 | Any 3 digits | Any future date |
| UnionPay | 6200000000000005 | Any 3 digits | Any future date |
| UnionPay (debit) | 6200000000000047 | Any 3 digits | Any future date |
| UnionPay (19-digit card) | 6205500000000000004 | Any 3 digits | Any future date |

#### PaymentMethods

| Brand | PaymentMethod |
| --- | --- |
| Visa | `pm_card_visa` |
| Visa (debit) | `pm_card_visa_debit` |
| Mastercard | `pm_card_mastercard` |
| Mastercard (debit) | `pm_card_mastercard_debit` |
| Mastercard (prepaid) | `pm_card_mastercard_prepaid` |
| American Express | `pm_card_amex` |
| Discover | `pm_card_discover` |
| Diners Club | `pm_card_diners` |
| JCB | `pm_card_jcb` |
| UnionPay | `pm_card_unionpay` |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Brand | Token |
| --- | --- |
| Visa | `tok_visa` |
| Visa (debit) | `tok_visa_debit` |
| Mastercard | `tok_mastercard` |
| Mastercard (debit) | `tok_mastercard_debit` |
| Mastercard (prepaid) | `tok_mastercard_prepaid` |
| American Express | `tok_amex` |
| Discover | `tok_discover` |
| Diners Club | `tok_diners` |
| JCB | `tok_jcb` |
| UnionPay | `tok_unionpay` |

Most Cartes Bancaires and eftpos cards are co-branded with either Visa or Mastercard. The test cards in the following table simulate successful payments with co-branded cards.

#### Card numbers

| Brand/Co-brand | Number | CVC | Date |
| --- | --- | --- | --- |
| Cartes Bancaires/Visa | 4000002500001001 | Any 3 digits | Any future date |
| Cartes Bancaires/Mastercard | 5555552500001001 | Any 3 digits | Any future date |
| eftpos Australia/Visa | 4000050360000001 | Any 3 digits | Any future date |
| eftpos Australia/Mastercard | 5555050360000080 | Any 3 digits | Any future date |

#### PaymentMethods

| Brand | PaymentMethod |
| --- | --- |
| Cartes Bancaires/Visa | `pm_card_visa_cartesBancaires` |
| Cartes Bancaires/Mastercard | `pm_card_mastercard_cartesBancaires` |
| eftpos Australia/Visa | `pm_card_visa_debit_eftposAuCoBranded` |
| eftpos Australia/Mastercard | `pm_card_mastercard_debit_eftposAuCoBranded` |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Brand | Token |
| --- | --- |
| Cartes Bancaires/Visa | `tok_visa_cartesBancaires` |
| Cartes Bancaires/Mastercard | `tok_mastercard_cartesBancaires` |
| eftpos Australia/Visa | `tok_visa_debit_eftposAuCoBranded` |
| eftpos Australia/Mastercard | `tok_mastercard_debit_eftposAuCoBranded` |

## Simulate a payment by country 

To simulate successful payments from specific countries, use test cards from the following sections.

> *Strong Customer Authentication* (Strong Customer Authentication (SCA) is a regulatory requirement in effect as of September 14, 2019, that impacts many European online payments. It requires customers to use two-factor authentication like 3D Secure to verify their purchase) regulations require *3D Secure* (3D Secure (3DS) provides an additional layer of authentication for credit card transactions that protects businesses from liability for fraudulent card payments) authentication for online payments within the *European Economic Area* (The European Economic Area is a regional single market with free movement of labor, goods, and capital. It encompasses the European Union member states and three additional states that are part of the European Free Trade Association). The test cards in the Europe and Middle East section simulate a payment that succeeds without authentication. We also recommend testing authentication scenarios using [3D Secure test cards](https://docs.stripe.com/testing.md#regulatory-cards).

#### Card numbers

| Country | Number | Brand |
| --- | --- | --- |
| **AMERICAS** |
| United States (US) | 4242424242424242 | Visa |
| Argentina (AR) | 4000000320000021 | Visa |
| Brazil (BR) | 4000000760000002 | Visa |
| Canada (CA) | 4000001240000000 | Visa |
| Chile (CL) | 4000001520000001 | Visa |
| Colombia (CO) | 4000001700000003 | Visa |
| Costa Rica (CR) | 4000001880000005 | Visa |
| Ecuador (EC) | 4000002180000000 | Visa |
| Mexico (MX) | 4000004840008001 | Visa |
| Mexico (MX) | 5062210000000009 | Carnet |
| Panama (PA) | 4000005910000000 | Visa |
| Paraguay (PY) | 4000006000000066 | Visa |
| Peru (PE) | 4000006040000068 | Visa |
| Uruguay (UY) | 4000008580000003 | Visa |
| **EUROPE and MIDDLE EAST** |
| United Arab Emirates (AE) | 4000007840000001 | Visa |
| United Arab Emirates (AE) | 5200007840000022 | Mastercard |
| Austria (AT) | 4000000400000008 | Visa |
| Belgium (BE) | 4000000560000004 | Visa |
| Bulgaria (BG) | 4000001000000000 | Visa |
| Belarus (BY) | 4000001120000005 | Visa |
| Croatia (HR) | 4000001910000009 | Visa |
| Cyprus (CY) | 4000001960000008 | Visa |
| Czech Republic (CZ) | 4000002030000002 | Visa |
| Denmark (DK) | 4000002080000001 | Visa |
| Estonia (EE) | 4000002330000009 | Visa |
| Finland (FI) | 4000002460000001 | Visa |
| France (FR) | 4000002500000003 | Visa |
| Germany (DE) | 4000002760000016 | Visa |
| Gibraltar (GI) | 4000002920000005 | Visa |
| Greece (GR) | 4000003000000030 | Visa |
| Hungary (HU) | 4000003480000005 | Visa |
| Ireland (IE) | 4000003720000005 | Visa |
| Italy (IT) | 4000003800000008 | Visa |
| Latvia (LV) | 4000004280000005 | Visa |
| Liechtenstein (LI) | 4000004380000004 | Visa |
| Lithuania (LT) | 4000004400000000 | Visa |
| Luxembourg (LU) | 4000004420000006 | Visa |
| Malta (MT) | 4000004700000007 | Visa |
| Netherlands (NL) | 4000005280000002 | Visa |
| Norway (NO) | 4000005780000007 | Visa |
| Poland (PL) | 4000006160000005 | Visa |
| Portugal (PT) | 4000006200000007 | Visa |
| Romania (RO) | 4000006420000001 | Visa |
| Saudi Arabia (SA) | 4000006820000007 | Visa |
| Slovenia (SI) | 4000007050000006 | Visa |
| Slovakia (SK) | 4000007030000001 | Visa |
| Spain (ES) | 4000007240000007 | Visa |
| Sweden (SE) | 4000007520000008 | Visa |
| Switzerland (CH) | 4000007560000009 | Visa |
| United Kingdom (GB) | 4000008260000000 | Visa |
| United Kingdom (GB) | 4000058260000005 | Visa (debit) |
| United Kingdom (GB) | 5555558265554449 | Mastercard |
| **ASIA PACIFIC**  
> To test subscriptions that require mandates and pre-debit notifications, see [India recurring payments](https://docs.stripe.com/india-recurring-payments.md?integration=paymentIntents-setupIntents#testing). |
| Australia (AU) | 4000000360000006 | Visa |
| China (CN) | 4000001560000002 | Visa |
| Hong Kong (HK) | 4000003440000004 | Visa |
| India (IN) | 4000003560000008 | Visa |
| Japan (JP) | 4000003920000003 | Visa |
| Japan (JP) | 3530111333300000 | JCB |
| Malaysia (MY) | 4000004580000002 | Visa |
| New Zealand (NZ) | 4000005540000008 | Visa |
| Singapore (SG) | 4000007020000003 | Visa |
| Taiwan (TW) | 4000001580000008 | Visa |
| Thailand (TH) | 4000007640000003 | Visa (credit) |
| Thailand (TH) | 4000057640000008 | Visa (debit) |

#### PaymentMethods

| Country | PaymentMethod | Brand |
| --- | --- | --- |
| **AMERICAS** |
| United States (US) | `pm_card_us` | Visa |
| Argentina (AR) | `pm_card_ar` | Visa |
| Brazil (BR) | `pm_card_br` | Visa |
| Canada (CA) | `pm_card_ca` | Visa |
| Chile (CL) | `pm_card_cl` | Visa |
| Colombia (CO) | `pm_card_co` | Visa |
| Costa Rica (CR) | `pm_card_cr` | Visa |
| Ecuador (EC) | `pm_card_ec` | Visa |
| Mexico (MX) | `pm_card_mx` | Visa |
| Panama (PA) | `pm_card_pa` | Visa |
| Paraguay (PY) | `pm_card_py` | Visa |
| Peru (PE) | `pm_card_pe` | Visa |
| Uruguay (UY) | `pm_card_uy` | Visa |
| **EUROPE and MIDDLE EAST**  
> *Strong Customer Authentication* (Strong Customer Authentication (SCA) is a regulatory requirement in effect as of September 14, 2019, that impacts many European online payments. It requires customers to use two-factor authentication like 3D Secure to verify their purchase) regulations require *3D Secure* (3D Secure (3DS) provides an additional layer of authentication for credit card transactions that protects businesses from liability for fraudulent card payments) authentication for online payments within the *European Economic Area* (The European Economic Area is a regional single market with free movement of labor, goods, and capital. It encompasses the European Union member states and three additional states that are part of the European Free Trade Association). The test cards in this section simulate a payment that succeeds without authentication. We recommend also testing scenarios that involve authentication, using [3D Secure test cards](https://docs.stripe.com/testing.md#regulatory-cards). |
| United Arab Emirates (AE) | `pm_card_ae` | Visa |
| United Arab Emirates (AE) | `pm_card_ae_mastercard` | Mastercard |
| Austria (AT) | `pm_card_at` | Visa |
| Belgium (BE) | `pm_card_be` | Visa |
| Bulgaria (BG) | `pm_card_bg` | Visa |
| Belarus (BY) | `pm_card_by` | Visa |
| Croatia (HR) | `pm_card_hr` | Visa |
| Cyprus (CY) | `pm_card_cy` | Visa |
| Czech Republic (CZ) | `pm_card_cz` | Visa |
| Denmark (DK) | `pm_card_dk` | Visa |
| Estonia (EE) | `pm_card_ee` | Visa |
| Finland (FI) | `pm_card_fi` | Visa |
| France (FR) | `pm_card_fr` | Visa |
| Germany (DE) | `pm_card_de` | Visa |
| Gibraltar (GI) | `pm_card_gi` | Visa |
| Greece (GR) | `pm_card_gr` | Visa |
| Hungary (HU) | `pm_card_hu` | Visa |
| Ireland (IE) | `pm_card_ie` | Visa |
| Italy (IT) | `pm_card_it` | Visa |
| Latvia (LV) | `pm_card_lv` | Visa |
| Liechtenstein (LI) | `pm_card_li` | Visa |
| Lithuania (LT) | `pm_card_lt` | Visa |
| Luxembourg (LU) | `pm_card_lu` | Visa |
| Malta (MT) | `pm_card_mt` | Visa |
| Netherlands (NL) | `pm_card_nl` | Visa |
| Norway (NO) | `pm_card_no` | Visa |
| Poland (PL) | `pm_card_pl` | Visa |
| Portugal (PT) | `pm_card_pt` | Visa |
| Romania (RO) | `pm_card_ro` | Visa |
| Slovenia (SI) | `pm_card_si` | Visa |
| Slovakia (SK) | `pm_card_sk` | Visa |
| Spain (ES) | `pm_card_es` | Visa |
| Sweden (SE) | `pm_card_se` | Visa |
| Switzerland (CH) | `pm_card_ch` | Visa |
| United Kingdom (GB) | `pm_card_gb` | Visa |
| United Kingdom (GB) | `pm_card_gb_debit` | Visa (debit) |
| United Kingdom (GB) | `pm_card_gb_mastercard` | Mastercard |
| **ASIA PACIFIC** 2  
> To test subscriptions that require mandates and pre-debit notifications, see [India recurring payments](https://docs.stripe.com/india-recurring-payments.md?integration=paymentIntents-setupIntents#testing). |
| Australia (AU) | `pm_card_au` | Visa |
| China (CN) | `pm_card_cn` | Visa |
| Hong Kong (HK) | `pm_card_hk` | Visa |
| India (IN) | `pm_card_in` | Visa |
| Japan (JP) | `pm_card_jp` | Visa |
| Japan (JP) | `pm_card_jcb` | JCB |
| Malaysia (MY) | `pm_card_my` | Visa |
| New Zealand (NZ) | `pm_card_nz` | Visa |
| Singapore (SG) | `pm_card_sg` | Visa |
| Taiwan (TW) | `pm_card_tw` | Visa |
| Thailand (TH) | `pm_card_th_credit` | Visa (credit) |
| Thailand (TH) | `pm_card_th_debit` | Visa (debit) |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Country | Token | Brand |
| --- | --- | --- |
| **AMERICAS** |
| United States (US) | `tok_us` | Visa |
| Argentina (AR) | `tok_ar` | Visa |
| Brazil (BR) | `tok_br` | Visa |
| Canada (CA) | `tok_ca` | Visa |
| Chile (CL) | `tok_cl` | Visa |
| Colombia (CO) | `tok_co` | Visa |
| Costa Rica (CR) | `tok_cr` | Visa |
| Ecuador (EC) | `tok_ec` | Visa |
| Mexico (MX) | `tok_mx` | Visa |
| Panama (PA) | `tok_pa` | Visa |
| Paraguay (PY) | `tok_py` | Visa |
| Peru (PE) | `tok_pe` | Visa |
| Uruguay (UY) | `tok_uy` | Visa |
| **EUROPE and MIDDLE EAST** |
| United Arab Emirates (AE) | `tok_ae` | Visa |
| United Arab Emirates (AE) | `tok_ae_mastercard` | Mastercard |
| Austria (AT) | `tok_at` | Visa |
| Belgium (BE) | `tok_be` | Visa |
| Bulgaria (BG) | `tok_bg` | Visa |
| Belarus (BY) | `tok_by` | Visa |
| Croatia (HR) | `tok_hr` | Visa |
| Cyprus (CY) | `tok_cy` | Visa |
| Czech Republic (CZ) | `tok_cz` | Visa |
| Denmark (DK) | `tok_dk` | Visa |
| Estonia (EE) | `tok_ee` | Visa |
| Finland (FI) | `tok_fi` | Visa |
| France (FR) | `tok_fr` | Visa |
| Germany (DE) | `tok_de` | Visa |
| Gibraltar (GI) | `tok_gi` | Visa |
| Greece (GR) | `tok_gr` | Visa |
| Hungary (HU) | `tok_hu` | Visa |
| Ireland (IE) | `tok_ie` | Visa |
| Italy (IT) | `tok_it` | Visa |
| Latvia (LV) | `tok_lv` | Visa |
| Liechtenstein (LI) | `tok_li` | Visa |
| Lithuania (LT) | `tok_lt` | Visa |
| Luxembourg (LU) | `tok_lu` | Visa |
| Malta (MT) | `tok_mt` | Visa |
| Netherlands (NL) | `tok_nl` | Visa |
| Norway (NO) | `tok_no` | Visa |
| Poland (PL) | `tok_pl` | Visa |
| Portugal (PT) | `tok_pt` | Visa |
| Romania (RO) | `tok_ro` | Visa |
| Slovenia (SI) | `tok_si` | Visa |
| Slovakia (SK) | `tok_sk` | Visa |
| Spain (ES) | `tok_es` | Visa |
| Sweden (SE) | `tok_se` | Visa |
| Switzerland (CH) | `tok_ch` | Visa |
| United Kingdom (GB) | `tok_gb` | Visa |
| United Kingdom (GB) | `tok_gb_debit` | Visa (debit) |
| United Kingdom (GB) | `tok_gb_mastercard` | Mastercard |
| **ASIA PACIFIC**  
> To test subscriptions that require mandates and pre-debit notifications, see [India recurring payments](https://docs.stripe.com/india-recurring-payments.md?integration=paymentIntents-setupIntents#testing). |
| Australia (AU) | `tok_au` | Visa |
| China (CN) | `tok_cn` | Visa |
| Hong Kong (HK) | `tok_hk` | Visa |
| India (IN) | `tok_in` | Visa |
| Japan (JP) | `tok_jp` | Visa |
| Japan (JP) | `tok_jcb` | JCB |
| Malaysia (MY) | `tok_my` | Visa |
| New Zealand (NZ) | `tok_nz` | Visa |
| Singapore (SG) | `tok_sg` | Visa |
| Taiwan (TW) | `tok_tw` | Visa |
| Thailand (TH) | `tok_th_credit` | Visa (credit) |
| Thailand (TH) | `tok_th_debit` | Visa (debit) |

### Simulate customer location with email 

When testing [Checkout Sessions](https://docs.stripe.com/payments/checkout.md), [Payment Links](https://docs.stripe.com/payment-links.md), or [pricing tables](https://docs.stripe.com/payments/checkout/pricing-table.md), you can simulate a customer’s geographic location by using a location-formatted email address. Add a `+location_XX` suffix to the local part of any email address, where `XX` is a valid two-letter [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) country code.

For example, to simulate a customer located in the United States, pass `test+location_US@example.com` as the `customer_email` parameter when creating a Checkout Session and as the `prefilled_email` [URL parameter](https://docs.stripe.com/payment-links/customize.md#customize-checkout-with-url-parameters) when creating a Payment Link.

When you visit the resulting Checkout Session URL, you see the same currency and payment methods that a customer in the specified country would see. Learn more about [testing with location-formatted emails](https://docs.stripe.com/payments/currencies/localize-prices/adaptive-pricing.md#testing).

## Simulate an HSA or FSA card payment 

Use these test card numbers to simulate FSA or HSA transactions in your integration. These accounts are commonly used for medical expenses, and testing with them helps you verify that your application handles healthcare-related transactions correctly.

#### Card numbers

| Brand/Type | Number | CVC | Date |
| --- | --- | --- | --- |
| Visa FSA | 4000051230000072 | Any 3 digits | Any future date |
| Visa HSA | 4000051230000072 | Any 3 digits | Any future date |
| Mastercard FSA | 5200828282828897 | Any 3 digits | Any future date |

#### PaymentMethods

| Brand/Type | PaymentMethod |
| --- | --- |
| Visa FSA | `pm_card_debit_visaFsaProductCode` |
| Visa HSA | `pm_card_debit_visaHsaProductCode` |
| Mastercard FSA | `pm_card_mastercard_debit_mastercardFsaProductCode` |

## Simulate a declined payment 

To test your integration’s error-handling logic by simulating payments that the issuer declines for various reasons, use test cards from this section. These cards return a [card error](https://docs.stripe.com/error-handling.md#payment-errors) with the listed [error code](https://docs.stripe.com/error-codes.md) and [decline code](https://docs.stripe.com/declines/codes.md).

Provide a CVC when you test CVC behavior. Stripe skips the CVC check if you omit it, so the check can’t fail. To simulate an incorrect CVC, use the “Incorrect CVC decline” test card listed in the following table and provide any three-digit CVC.

#### Card numbers

| Description | Number | Error code | Decline code |
| --- | --- | --- | --- |
| Generic decline | 4000000000000002 | [card_declined](https://docs.stripe.com/error-codes.md#card-declined) | [generic_decline](https://docs.stripe.com/declines/codes.md#generic_decline) |
| Insufficient funds decline | 4000000000009995 | [card_declined](https://docs.stripe.com/error-codes.md#card-declined) | [insufficient_funds](https://docs.stripe.com/declines/codes.md#insufficient_funds) |
| Lost card decline | 4000000000009987 | [card_declined](https://docs.stripe.com/error-codes.md#card-declined) | [lost_card](https://docs.stripe.com/declines/codes.md#lost_card) |
| Stolen card decline | 4000000000009979 | [card_declined](https://docs.stripe.com/error-codes.md#card-declined) | [stolen_card](https://docs.stripe.com/declines/codes.md#stolen_card) |
| Expired card decline | 4000000000000069 | [expired_card](https://docs.stripe.com/error-codes.md#expired-card) | n/a |
| Incorrect CVC decline | 4000000000000127 | [incorrect_cvc](https://docs.stripe.com/declines/codes.md#incorrect_cvc) | n/a |
| Processing error decline | 4000000000000119 | [processing_error](https://docs.stripe.com/error-codes.md#processing-error) | n/a |
| Incorrect number decline | 4242424242424241 | [incorrect_number](https://docs.stripe.com/declines/codes.md#incorrect_number) | n/a |
| Exceeding velocity limit decline | 4000000000006975 | [card_declined](https://docs.stripe.com/error-codes.md#card-declined) | [card_velocity_exceeded](https://docs.stripe.com/declines/codes.md#card_velocity_exceeded) |

You can’t attach cards that simulate issuer declines to a `Customer` object. To simulate a declined payment with an attached card, use the “Decline after attaching” test card listed in the following table.

| Description | Number | Details |
| --- | --- | --- |
| Decline after attaching | 4000000000000341 | Attaching this card to a [Customer](https://docs.stripe.com/api/customers.md) object succeeds, but attempts to charge the customer fail. |

#### PaymentMethods

| Description | Number | Error code | Decline code |
| --- | --- | --- | --- |
| Generic decline | `pm_card_visa_chargeDeclined` | `card_declined` | `generic_decline` |
| Insufficient funds decline | `pm_card_visa_chargeDeclinedInsufficientFunds` | `card_declined` | `insufficient_funds` |
| Lost card decline | `pm_card_visa_chargeDeclinedLostCard` | `card_declined` | `lost_card` |
| Stolen card decline | `pm_card_visa_chargeDeclinedStolenCard` | `card_declined` | `stolen_card` |
| Expired card decline | `pm_card_chargeDeclinedExpiredCard` | `expired_card` | n/a |
| Incorrect CVC decline | `pm_card_chargeDeclinedIncorrectCvc` | `incorrect_cvc` | n/a |
| Processing error decline | `pm_card_chargeDeclinedProcessingError` | `processing_error` | n/a |
| Exceeding velocity limit decline | `pm_card_visa_chargeDeclinedVelocityLimitExceeded` | `card_declined` | `card_velocity_exceeded` |

You can’t attach cards that simulate issuer declines to a `Customer` object. To simulate a declined payment with an attached card, use the “Decline after attaching” test card listed in the following table.

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Decline after attaching | `pm_card_chargeCustomerFail` | Attaching this card to a [Customer](https://docs.stripe.com/api/customers.md) object succeeds, but attempts to charge the customer fail. |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Description | Number | Error code | Decline code |
| --- | --- | --- | --- |
| Generic decline | `tok_visa_chargeDeclined` | `card_declined` | `generic_decline` |
| Insufficient funds decline | `tok_visa_chargeDeclinedInsufficientFunds` | `card_declined` | `insufficient_funds` |
| Insufficient debit funds decline | `tok_visa_debit_chargeDeclinedInsufficientFunds` | `card_declined` | `insufficient_funds` |
| Lost card decline | `tok_visa_chargeDeclinedLostCard` | `card_declined` | `lost_card` |
| Stolen card decline | `tok_visa_chargeDeclinedStolenCard` | `card_declined` | `stolen_card` |
| Expired card decline | `tok_chargeDeclinedExpiredCard` | `expired_card` | n/a |
| Expired card decline | `tok_visa_chargeDeclinedExpiredCard` | `expired_card` | n/a |
| Fraudulent card decline | `tok_visa_chargeDeclinedFraudulent` | `card_declined` | `fraudulent` |
| Incorrect CVC decline | `tok_chargeDeclinedIncorrectCvc` | `incorrect_cvc` | n/a |
| Incorrect CVC decline | `tok_visa_chargeDeclinedIncorrectCvc` | `incorrect_cvc` | n/a |
| Processing error decline | `tok_chargeDeclinedProcessingError` | `processing_error` | n/a |
| Processing error decline | `tok_visa_chargeDeclinedProcessingError` | `processing_error` | n/a |
| Exceeding velocity limit decline | `tok_visa_chargeDeclinedVelocityLimitExceeded` | `card_declined` | `card_velocity_exceeded` |

You can’t attach cards that simulate issuer declines to a `Customer` object. To simulate a declined payment with an attached card, use the “Decline after attaching” test card listed in the following table.

| Description | Token | Details |
| --- | --- | --- |
| Decline after attaching | `tok_chargeCustomerFail` | Attaching this card to a [Customer](https://docs.stripe.com/api/customers.md) object succeeds, but attempts to charge the customer fail. |
| Decline after attaching | `tok_visa_chargeCustomerFail` | Attaching this card to a [Customer](https://docs.stripe.com/api/customers.md) object succeeds, but attempts to charge the customer fail. |
| Decline after attaching due to lost card | `tok_visa_chargeCustomerFailLostCard` | Attaching this card to a [Customer](https://docs.stripe.com/api/customers.md) object succeeds, but attempts to charge the customer fail due to a lost card. |
| Decline after attaching due to stolen card | `tok_visa_chargeCustomerFailStolenCard` | Attaching this card to a [Customer](https://docs.stripe.com/api/customers.md) object succeeds, but attempts to charge the customer fail due to a stolen card. |

## Fraud prevention

Stripe’s fraud prevention system, Radar, can block payments when they have a high risk level or fail verification checks. You can use the cards in this section to test your Radar settings. You can also use them to test how your integration responds to blocked payments.

Each card simulates specific risk factors. Your Radar settings determine which risk factors cause it to block a payment. Blocked payments result in [card errors with an error code of fraud](https://docs.stripe.com/error-handling.md).

To trigger a failed CVC check, include a CVC (any three-digit number). To trigger a failed postal code check, include any valid postal code. If you omit these fields, Radar skips those checks, so they can’t fail.

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Always blocked | 4100000000000019 | The charge has a [risk level of “highest”](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk)

Radar always blocks it. |
| Highest risk | 4000000000004954 | The charge has a [risk level of “highest”](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk)

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| Elevated risk | 4000000000009235 | The charge has a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might [queue it for review](https://docs.stripe.com/radar/transaction-reviews.md). |
| High fraud dispute score | 4000008400000407 | This charge has a high fraud dispute score.

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| High early fraud warning score | 4000008400000159 | This charge has a high early fraud warning score.

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| Dynamic risk thresholds | 4000008400001017 | This charge triggers the Radar Dynamic risk thresholds control, when enabled.

Radar blocks the transaction if you enable the [Dynamic risk thresholds](https://docs.stripe.com/radar/risk-settings.md#dynamic-risk-thresholds). |
| Free trial abuse | 4001858821843804 | This charge triggers the Radar free trial abuse risk control, when enabled.

Radar blocks the transaction if you enable the [free trial abuse risk control](https://docs.stripe.com/radar/risk-settings.md). |
| Adaptive 3DS | 4000008405600003 | This charge triggers the Radar Adaptive 3DS risk control, when enabled.

If you enable Adaptive 3DS, Radar requests 3DS authentication when using this test card. |
| CVC check fails | 4000000000000101 | If you provide a CVC number, the CVC check fails.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Postal code check fails | 4000000000000036 | If you provide a postal code, the postal code check fails.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| CVC check fails with elevated risk | 4000058400307872 | If you provide a CVC number, the CVC check fails with a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Postal code check fails with elevated risk | 4000058400306072 | If you provide a postal code, the postal code check fails with a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might block it [depending on your settings](https://docs.stripe.com/radar/rules.md#traditional-bank-checks). |
| Line1 check fails | 4000000000000028 | The address line 1 check fails.

The payment succeeds unless you [block it with a custom Radar rule](https://docs.stripe.com/radar/rules/reference.md#post-authorization-attributes). |
| Address checks fail | 4000000000000010 | The address postal code check and address line 1 check both fail.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Address unavailable | 4000000000000044 | The address postal code check and address line 1 check are both unavailable.

The payment succeeds unless you [block it with a custom Radar rule](https://docs.stripe.com/radar/rules/reference.md#post-authorization-attributes). |

#### PaymentMethods

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Always blocked | `pm_card_radarBlock` | The charge has a [risk level of “highest”](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk)

Radar always blocks it. |
| Highest risk | `pm_card_riskLevelHighest` | The charge has a [risk level of “highest”](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk)

Radar might block it depending on your settings. |
| Elevated risk | `pm_card_riskLevelElevated` | The charge has a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might [queue it for review](https://docs.stripe.com/radar/transaction-reviews.md). |
| High fraud dispute score | `pm_card_highFraudDisputeScore` | This charge has a high fraud dispute score.

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| High early fraud warning score | `pm_card_highEfwScore` | This charge has a high early fraud warning score.

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| Dynamic risk thresholds | `pm_card_radarDynamicRiskThreshold` | This charge triggers the Radar Dynamic risk thresholds control, when enabled.

Radar blocks the transaction if you enable the [Dynamic risk thresholds](https://docs.stripe.com/radar/risk-settings.md#dynamic-risk-thresholds). |
| Free trial abuse | `pm_card_freeTrialAbuseBlock` | This charge triggers the Radar free trial abuse risk control, when enabled.

Radar blocks the transaction if you enable the [free trial abuse risk control](https://docs.stripe.com/radar/risk-settings.md). |
| Adaptive 3DS | `pm_card_adaptive3dsChallenge` | This charge triggers the Radar Adaptive 3DS risk control, when enabled.

If you enable Adaptive 3DS, Radar requests 3DS authentication when using this test card. |
| CVC check fails | `pm_card_cvcCheckFail` | If you provide a CVC number, the CVC check fails.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Postal code check fails | `pm_card_avsZipFail` | If you provide a postal code, the postal code check fails.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| CVC check fails with elevated risk | `pm_card_cvcCheckFailElevatedRisk` | If you provide a CVC number, the CVC check fails with a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might block it [depending on your settings](https://docs.stripe.com/radar/rules.md#traditional-bank-checks). |
| Postal code check fails with elevated risk | `pm_card_avsZipFailElevatedRisk` | If you provide a postal code, the postal code check fails with a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might block it [depending on your settings](https://docs.stripe.com/radar/rules.md#traditional-bank-checks). |
| Line1 check fails | `pm_card_avsLine1Fail` | The address line 1 check fails.

The payment succeeds unless you [block it with a custom Radar rule](https://docs.stripe.com/radar/rules/reference.md#post-authorization-attributes). |
| Address checks fail | `pm_card_avsFail` | The address postal code check and address line 1 check both fail.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Address unavailable | `pm_card_avsUnchecked` | The address postal code check and address line 1 check are both unavailable.

The payment succeeds unless you [block it with a custom Radar rule](https://docs.stripe.com/radar/rules/reference.md#post-authorization-attributes). |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Description | Token | Details |
| --- | --- | --- |
| Always blocked | `tok_radarBlock` | The charge has a [risk level of “highest”](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk)

Radar always blocks it. |
| Highest risk | `tok_riskLevelHighest` | The charge has a [risk level of “highest”](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk)

Radar might block it depending on your settings. |
| Elevated risk | `tok_riskLevelElevated` | The charge has a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might [queue it for review](https://docs.stripe.com/radar/transaction-reviews.md). |
| High fraud dispute score | `tok_highFraudDisputeScore` | This charge has a high fraud dispute score.

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| High early fraud warning score | `tok_highEfwScore` | This charge has a high early fraud warning score.

Radar might block it [depending on your settings](https://docs.stripe.com/radar/risk-settings.md). |
| Dynamic risk thresholds | `tok_radarDynamicRiskThreshold` | This charge triggers the Radar Dynamic risk thresholds control, when enabled.

Radar blocks the transaction if you enable the [Dynamic risk thresholds](https://docs.stripe.com/radar/risk-settings.md#dynamic-risk-thresholds). |
| Free trial abuse | `tok_freeTrialAbuseBlock` | This charge triggers the Radar free trial abuse risk control, when enabled.

Radar blocks the transaction if you enable the [free trial abuse risk control](https://docs.stripe.com/radar/risk-settings.md). |
| Adaptive 3DS | `tok_adaptive3dsChallenge` | This charge triggers the Radar Adaptive 3DS risk control, when enabled.

If you enable Adaptive 3DS, Radar requests 3DS authentication when using this test card. |
| CVC check fails | `tok_cvcCheckFail` | If you provide a CVC number, the CVC check fails.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Postal code check fails | `tok_avsZipFail` | If you provide a postal code, the postal code check fails.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| CVC check fails with elevated risk | `tok_cvcCheckFailElevatedRisk` | If you provide a CVC number, the CVC check fails with a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might block it [depending on your settings](https://docs.stripe.com/radar/rules.md#traditional-bank-checks). |
| Postal code check fails with elevated risk | `tok_avsZipFailElevatedRisk` | If you provide a postal code, the postal code check fails with a [risk level of “elevated”](https://docs.stripe.com/radar/transaction-risk-prevention.md#elevated-risk)

Radar might block it [depending on your settings](https://docs.stripe.com/radar/rules.md#traditional-bank-checks). |
| Line1 check fails | `tok_avsLine1Fail` | The address line 1 check fails.

The payment succeeds unless you [block it with a custom Radar rule](https://docs.stripe.com/radar/rules/reference.md#post-authorization-attributes). |
| Address checks fail | `tok_avsFail` | The address postal code check and address line 1 check both fail.

Radar might block it [depending on your settings.](https://docs.stripe.com/radar/rules.md#traditional-bank-checks) |
| Address unavailable | `tok_avsUnchecked` | The address postal code check and address line 1 check are both unavailable.

The payment succeeds unless you [block it with a custom Radar rule](https://docs.stripe.com/radar/rules/reference.md#post-authorization-attributes). |

## Trigger an error with invalid data

To test errors resulting from invalid data, provide invalid details. You don’t need a special test card for this. Any invalid value works. For instance:

- [invalid_expiry_month](https://docs.stripe.com/declines/codes.md#invalid_expiry_month): Use an invalid month, such as **13**.
- [invalid_expiry_year](https://docs.stripe.com/declines/codes.md#invalid_expiry_year): Use a year up to 50 years in the past, such as **95**.
- [invalid_cvc](https://docs.stripe.com/declines/codes.md#invalid_cvc): Use a two-digit number, such as **99**.
- [incorrect_number](https://docs.stripe.com/declines/codes.md#incorrect_number): Use a card number that fails the [Luhn check](https://en.wikipedia.org/wiki/Luhn_algorithm), such as `4242424242424241`.

## Disputes and early fraud warnings 

To simulate a [disputed transaction](https://docs.stripe.com/disputes.md) or early fraud warning, use the test cards in this section. Then, to simulate winning or losing a dispute, provide [winning or losing evidence](https://docs.stripe.com/testing.md#evidence).

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Fraudulent (asynchronous) | 4061219946393810 | Use this card for most test cases. With default account settings, the payment succeeds, and Stripe creates a [fraudulent](https://docs.stripe.com/disputes/categories.md) dispute shortly afterward, rather than during the payment request. This sequence more closely reflects live-mode behavior. This type of dispute is [protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Fraudulent (synchronous) | 4000000000000259 | With default account settings, payment succeeds, and Stripe creates a [fraudulent](https://docs.stripe.com/disputes/categories.md) dispute during the payment request. This type of dispute is [protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Discover fraudulent | 6026507838377928 | With default account settings, charge succeeds, but is disputed as [fraudulent](https://docs.stripe.com/disputes/categories.md). |
| Not received | 4000000000002685 | With default account settings, charge succeeds, only to be disputed as [product not received](https://docs.stripe.com/disputes/categories.md). This type of dispute [isn’t protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Inquiry | 4000000000001976 | With default account settings, charge succeeds, only to be disputed as [an inquiry](https://docs.stripe.com/disputes/how-disputes-work.md#inquiries). |
| Early fraud warning | 4000000000005423 | With default account settings, charge succeeds, only to receive [an early fraud warning](https://docs.stripe.com/disputes/how-disputes-work.md#early-fraud-warnings). |
| Multiple disputes | 4000000404000079 | With default account settings, charge succeeds, only to be disputed [multiple times](https://docs.stripe.com/disputes/how-disputes-work.md#multiple-disputes). |
| Visa Compelling Evidence 3.0 | 4000000404000038 | With default account settings, charge succeeds, only to be disputed as a [Visa Compelling Evidence 3.0 eligible dispute](https://docs.stripe.com/disputes/api/visa-ce3.md#testing). |
| Visa compliance | 4000008400000779 | With default account settings, charge succeeds, only to be disputed as a [Visa compliance dispute](https://docs.stripe.com/disputes/api/visa-compliance.md#testing). |
| Mastercard compliance | 5105008400000002 | With default account settings, charge succeeds, only to be disputed as a [Mastercard compliance dispute](https://docs.stripe.com/disputes/api/mastercard-compliance.md#testing). |
| Smart disputes | 4000000001000043 | With default account settings, charge succeeds, only to be disputed as a [Smart Disputes](https://docs.stripe.com/disputes/smart-disputes.md) eligible dispute. |
| Partially refunded dispute (asynchronous) | 4000008400000795 | The payment succeeds without automatically creating a refund or dispute. If you partially refund the payment, Stripe asynchronously creates a fraudulent dispute for the amount that isn’t refunded. For example, refunding 3 USD of a 10 USD payment creates a 7 USD dispute. Fully refunding the payment doesn’t trigger a dispute. |

#### PaymentMethods

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Fraudulent | `pm_card_createDispute` | With default account settings, charge succeeds, only to be disputed as [fraudulent](https://docs.stripe.com/disputes/categories.md). This type of dispute is [protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Not received | `pm_card_createDisputeProductNotReceived` | With default account settings, charge succeeds, only to be disputed as [product not received](https://docs.stripe.com/disputes/categories.md). This type of dispute [isn’t protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Inquiry | `pm_card_createDisputeInquiry` | With default account settings, charge succeeds, only to be disputed as [an inquiry](https://docs.stripe.com/disputes/how-disputes-work.md#inquiries). |
| Early fraud warning | `pm_card_createIssuerFraudRecord` | With default account settings, charge succeeds, only to receive [an early fraud warning](https://docs.stripe.com/disputes/how-disputes-work.md#early-fraud-warnings). |
| Multiple disputes | `pm_card_createMultipleDisputes` | With default account settings, charge succeeds, only to be disputed [multiple times](https://docs.stripe.com/disputes/how-disputes-work.md#multiple-disputes). |
| Visa Compelling Evidence 3.0 | `pm_card_createCe3EligibleDispute` | With default account settings, charge succeeds, only to be disputed as a [Visa Compelling Evidence 3.0 eligible dispute](https://docs.stripe.com/disputes/api/visa-ce3.md#testing). |
| Visa compliance | `pm_card_createComplianceDispute` | With default account settings, charge succeeds, only to be disputed as a [Visa compliance dispute](https://docs.stripe.com/disputes/api/visa-compliance.md#testing). |
| Mastercard compliance | `pm_card_createMastercardComplianceDispute` | With default account settings, the charge succeeds, only to be disputed as a [Mastercard compliance dispute](https://docs.stripe.com/disputes/api/mastercard-compliance.md#testing). |
| Smart disputes | `pm_card_createAutoRepresentmentEligibleDispute` | With default account settings, charge succeeds, only to be disputed as a [Smart Disputes](https://docs.stripe.com/disputes/smart-disputes.md) eligible dispute. |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Description | Token | Details |
| --- | --- | --- |
| Fraudulent | `tok_createDispute` | With default account settings, charge succeeds, only to be disputed as [fraudulent](https://docs.stripe.com/disputes/categories.md). This type of dispute is [protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Not received | `tok_createDisputeProductNotReceived` | With default account settings, charge succeeds, only to be disputed as [product not received](https://docs.stripe.com/disputes/categories.md). This type of dispute [isn’t protected](https://docs.stripe.com/payments/3d-secure/authentication-flow.md#disputed-payments) after 3D Secure authentication. |
| Inquiry | `tok_createDisputeInquiry` | With default account settings, charge succeeds, only to be disputed as [an inquiry](https://docs.stripe.com/disputes/how-disputes-work.md#inquiries). |
| Early fraud warning | `tok_createIssuerFraudRecord` | With default account settings, charge succeeds, only to receive [an early fraud warning](https://docs.stripe.com/disputes/how-disputes-work.md#early-fraud-warnings). |
| Multiple disputes | `tok_createMultipleDisputes` | With default account settings, charge succeeds, only to be disputed [multiple times](https://docs.stripe.com/disputes/how-disputes-work.md#multiple-disputes). |
| Visa Compelling Evidence 3.0 | `tok_createCe3EligibleDispute` | With default account settings, charge succeeds, only to be disputed as a [Visa Compelling Evidence 3.0 eligible dispute](https://docs.stripe.com/disputes/api/visa-ce3.md#testing). |
| Visa compliance | `tok_createComplianceDispute` | With default account settings, charge succeeds, only to be disputed as a [Visa compliance dispute](https://docs.stripe.com/disputes/api/visa-compliance.md#testing). |
| Mastercard compliance | `tok_createMastercardComplianceDispute` | With default account settings, the charge succeeds, only to be disputed as a [Mastercard compliance dispute](https://docs.stripe.com/disputes/api/mastercard-compliance.md#testing). |
| Smart disputes | `tok_createAutoRepresentmentEligibleDispute` | With default account settings, charge succeeds, only to be disputed as a [Smart Disputes](https://docs.stripe.com/disputes/smart-disputes.md) eligible dispute. |

### Evidence 

To simulate winning or losing the dispute, respond with one of the evidence values from the table below.

- If you [respond using the API](https://docs.stripe.com/disputes/api.md), pass the value from the table as [uncategorized_text](https://docs.stripe.com/api/disputes/update.md#update_dispute-evidence-uncategorized_text).
- If you [respond in the Dashboard](https://docs.stripe.com/disputes/responding.md) or in [Connect embedded components](https://docs.stripe.com/connect/supported-embedded-components/disputes-list.md), enter the value from the table in the **Additional information** field. Then, click **Submit evidence**.

| Evidence | Description |
| --- | --- |
| `winning_evidence` | Closes the dispute as won and credits your account for the amount of the charge and related fees. |
| `losing_evidence` | Closes the dispute as lost without crediting your account. For inquiries, this closes the inquiry without escalation. |
| `escalate_inquiry_evidence` | Escalates the inquiry to a chargeback. This transitions the inquiry to a full dispute and debits your account for the amount of the dispute and related fees. |

### Dispute prevention 

[Dispute prevention](https://docs.stripe.com/disputes/prevention.md) helps resolve or block disputes before they become chargebacks. To simulate prevented disputes in a sandbox, use the test cards in this section. If your account has [Dispute Resolution or Dispute Deflection](https://dashboard.stripe.com/settings/disputes) enabled, the dispute on the transaction is either blocked or resolved. Otherwise, the transaction is successfully disputed.

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Visa Rapid Dispute Resolution | 4000000404004816 | Charge succeeds, then Visa RDR prevents the dispute if the account is enrolled in Dispute Resolution. Otherwise, creates a dispute. |
| Verifi CE3 block | 4000000404005649 | Charge succeeds, then Compelling Evidence 3.0 blocks the dispute if the account is enrolled in Dispute Deflection. Otherwise, creates a dispute. |
| Ethoca alert | 5105000300000018 | Charge succeeds, then Ethoca Alerts prevents the dispute if the account is enrolled in Dispute Resolution. Otherwise, creates a dispute. |

#### PaymentMethods

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Visa Rapid Dispute Resolution | `pm_card_createRapidDisputeResolutionDispute` | Charge succeeds, then Visa RDR prevents the dispute if the account is enrolled in Dispute Resolution. Otherwise, creates a dispute. |
| Verifi CE3 block | `pm_card_createCe3BlockDispute` | Charge succeeds, then Compelling Evidence 3.0 blocks the dispute if the account is enrolled in Dispute Deflection. Otherwise, creates a dispute. |
| Ethoca alert | `pm_card_createEthocaAlert` | Charge succeeds, then Ethoca Alerts prevents the dispute if the account is enrolled in Dispute Resolution. Otherwise, creates a dispute. |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Description | Token | Details |
| --- | --- | --- |
| Visa Rapid Dispute Resolution | `tok_createRapidDisputeResolutionDispute` | Charge succeeds, then Visa RDR prevents the dispute if the account is enrolled in Dispute Resolution. Otherwise, creates a dispute. |
| Verifi CE3 block | `tok_createCe3BlockDispute` | Charge succeeds, then Compelling Evidence 3.0 blocks the dispute if the account is enrolled in Dispute Deflection. Otherwise, creates a dispute. |
| Ethoca alert | `tok_createEthocaAlert` | Charge succeeds, then Ethoca Alerts prevents the dispute if the account is enrolled in Dispute Resolution. Otherwise, creates a dispute. |

## Simulate an asynchronous refund 

In live mode, refunds are asynchronous: a refund can appear to succeed and later fail, or can appear as `pending` at first and later succeed. To simulate refunds with those behaviors, use the test cards in this section. With all other test cards, refunds succeed immediately and don’t change status after that.

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Asynchronous success | 4000000000007726 | The charge succeeds. If you initiate a refund, its status begins as `pending`. Some time later, its status transitions to `succeeded` and sends a `refund.updated` [event](https://docs.stripe.com/api/events/types.md#event_types-refund.updated). |
| Asynchronous failure | 4000000000005126 | The charge succeeds. If you initiate a refund, its status begins as `succeeded`. After a few minutes, its status transitions to `failed` and sends a `refund.failed` [event](https://docs.stripe.com/api/events/types.md#event_types-refund.failed). |

#### PaymentMethods

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Asynchronous success | `pm_card_pendingRefund` | The charge succeeds. If you initiate a refund, its status begins as `pending`. Some time later, its status transitions to `succeeded` and sends a `refund.updated` [event](https://docs.stripe.com/api/events/types.md#event_types-refund.updated). |
| Asynchronous failure | `pm_card_refundFail` | The charge succeeds. If you initiate a refund, its status begins as `succeeded`. After a few minutes, its status transitions to `failed` and sends a `refund.failed` [event](https://docs.stripe.com/api/events/types.md#event_types-refund.failed). |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Description | Token | Details |
| --- | --- | --- |
| Asynchronous success | `tok_pendingRefund` | The charge succeeds. If you initiate a refund, its status begins as `pending`. Some time later, its status transitions to `succeeded` and sends a `refund.updated` [event](https://docs.stripe.com/api/events/types.md#event_types-refund.updated). |
| Asynchronous failure | `tok_refundFail` | The charge succeeds. If you initiate a refund, its status begins as `succeeded`. After a few minutes, its status transitions to `failed` and sends a `refund.failed` [event](https://docs.stripe.com/api/events/types.md#event_types-refund.failed). |

You can cancel a card refund only by using the Dashboard. In live mode, you can cancel a card refund within a short but nonspecific period of time. Testing environments simulate that period by allowing you to cancel a card refund within 30 minutes.

## Send funds to your available balance 

To send the funds from a test transaction directly to your available balance, use the test cards in this section. Other test cards send funds from a successful payment to your pending balance.

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Bypass pending balance | 4000000000000077 | The US charge succeeds. Funds are added directly to your available balance, bypassing your pending balance. |
| Bypass pending balance | 4000003720000278 | The international charge succeeds. Funds are added directly to your available balance, bypassing your pending balance. |

#### PaymentMethods

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Bypass pending balance | `pm_card_bypassPending` | The US charge succeeds. Funds are added directly to your available balance, bypassing your pending balance. |
| Bypass pending balance | `pm_card_bypassPendingInternational` | The international charge succeeds. Funds are added directly to your available balance, bypassing your pending balance. |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| Description | Token | Details |
| --- | --- | --- |
| Bypass pending balance | `tok_bypassPending` | The US charge succeeds. Funds are added directly to your available balance, bypassing your pending balance. |
| Bypass pending balance | `tok_bypassPendingInternational` | The international charge succeeds. Funds are added directly to your available balance, bypassing your pending balance. |

## Test 3D Secure authentication 

3D Secure requires an additional layer of authentication for credit card transactions. The test cards in this section allow you to simulate triggering authentication in different payment flows.

Only cards in this section effectively test your 3D Secure integration by simulating defined 3DS behavior, such as a challenge flow or an unsupported card. Other Stripe testing cards might still trigger 3DS, but Stripe returns `attempt_acknowledged` to bypass the additional steps because 3DS testing isn’t the objective for those cards.

> #### Dashboard not supported
> 
> 3D Secure redirects won’t occur for payments created directly in the Stripe Dashboard. Instead, use your integration’s own front end or an API call.

### Authentication and setup

To simulate payment flows that include authentication, use the test cards in this section. Some of these cards can also be [set up](https://docs.stripe.com/payments/save-and-reuse.md) for future payments, or have already been.

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Authenticate unless set up | 4000002500003155 | This card requires authentication for off-session payments unless you [set it up](https://docs.stripe.com/payments/save-and-reuse.md) for future payments. After you set it up, off-session payments no longer require authentication. However, on-session payments with this card always require authentication. |
| Always authenticate | 4000002760003184 | This card requires authentication on all transactions, regardless of how the card is set up. |
| Already set up | 4000003800000446 | This card is already set up for off-session use. It requires authentication for [one-time](https://docs.stripe.com/payments/accept-a-payment.md?platform=web) and other [on-session](https://docs.stripe.com/payments/existing-customers.md?platform=web&ui=elements) payments. However, all *off-session payments* (A payment is described as off-session if it occurs without the direct involvement of the customer, using previously-collected payment information) succeed as if the card has been previously [set up](https://docs.stripe.com/payments/save-and-reuse.md). |
| Insufficient funds | 4000008260003178 | This card requires authentication for [one-time payments](https://docs.stripe.com/payments/accept-a-payment.md?platform=web). All payments are declined with an `insufficient_funds` failure code even after being successfully authenticated or previously [set up](https://docs.stripe.com/payments/save-and-reuse.md). |

#### PaymentMethods

| Description | PaymentMethod | Details |
| --- | --- | --- |
| Authenticate unless set up | `pm_card_authenticationRequiredOnSetup` | This card requires authentication for every payment unless you [set it up](https://docs.stripe.com/payments/save-and-reuse.md) for future payments. After you set it up, it no longer requires authentication. |
| Always authenticate | `pm_card_authenticationRequired` | This card requires authentication on all transactions, regardless of how the card is set up. |
| Already set up | `pm_card_authenticationRequiredSetupForOffSession` | This card is already set up for off-session use. It requires authentication for [one-time](https://docs.stripe.com/payments/accept-a-payment.md?platform=web) and other [on-session](https://docs.stripe.com/payments/existing-customers.md?platform=web&ui=elements) payments. However, all off-session payments succeed as if the card has been previously [set up](https://docs.stripe.com/payments/save-and-reuse.md). |
| Insufficient funds | `pm_card_authenticationRequiredChargeDeclinedInsufficientFunds` | This card requires authentication for [one-time payments](https://docs.stripe.com/payments/accept-a-payment.md?platform=web). All payments are declined with an `insufficient_funds` failure code even after being successfully authenticated or previously [set up](https://docs.stripe.com/payments/save-and-reuse.md). |

### Support and availability 

Stripe requests authentication when required by regulation or when triggered by your Radar rules or custom code. Even if authentication is requested, it can’t always be performed—for instance, the customer’s card might not be enrolled, or an error might occur. Use the test cards in this section to simulate various combinations of these factors.

All 3DS references indicate [3D Secure 2](https://stripe.com/guides/3d-secure-2).

#### Card numbers

| 3D Secure usage | Outcome | Number | Details |
| --- | --- | --- | --- |
| 3DS Required | OK | 4000000000003220 | 3D Secure authentication must be completed for the payment to be successful. By default, your Radar rules request 3D Secure authentication for this card. Ireland-issued (`IE`). |
| 3DS Required | OK | 4000008400000027 | 3D Secure authentication must be completed for the payment to be successful. By default, your Radar rules request 3D Secure authentication for this card. US-issued (`US`). |
| 3DS Required | Declined | 4000008400001629 | 3D Secure authentication is required, but payments are declined with a `card_declined` failure code after authentication. By default, your Radar rules request 3D Secure authentication for this card. |
| 3DS Required | Error | 4000008400001280 | 3D Secure authentication is required, but the 3D Secure lookup request fails with a processing error. Payments are declined with a `card_declined` failure code. By default, your Radar rules request 3D Secure authentication for this card. |
| 3DS Supported | OK | 4000000000003055 | 3D Secure authentication might still be performed, but isn’t required. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| 3DS Supported | Error | 4000000000003097 | 3D Secure authentication might still be performed, but isn’t required. However, attempts to perform 3D Secure result in a processing error. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| 3DS Supported | Unenrolled | 4242424242424242 | 3D Secure is supported for this card, but this card isn’t enrolled in 3D Secure. Even if your Radar rules request 3D Secure, the customer won’t be prompted to authenticate. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| 3DS Not supported | 378282246310005 | 3D Secure isn’t supported on this card and can’t be invoked. The PaymentIntent or SetupIntent proceeds without performing authentication. |
| 3DS Frictionless flow | OK | 4000000032200000 | 3D Secure authentication is required on all transactions, regardless of how the card is set up. The authentication proceeds through a frictionless flow, and succeeds. |

#### PaymentMethods

| 3D Secure usage | Outcome | PaymentMethod | Details |
| --- | --- | --- | --- |
| Required | OK | `pm_card_threeDSecure2Required` | 3D Secure authentication must be completed for the payment to be successful. By default, your Radar rules request 3D Secure authentication for this card. |
| Required | Declined | `pm_card_threeDSecureRequiredChargeDeclined` | 3D Secure authentication is required, but payments are declined with a `card_declined` failure code after authentication. By default, your Radar rules request 3D Secure authentication for this card. |
| Required | Error | `pm_card_threeDSecureRequiredProcessingError` | 3D Secure authentication is required, but the 3D Secure lookup request fails with a processing error. Payments are declined with a `card_declined` failure code. By default, your Radar rules request 3D Secure authentication for this card. |
| Supported | OK | `pm_card_threeDSecureOptional` | 3D Secure authentication might still be performed, but isn’t required. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| Supported | Error | `pm_card_threeDSecureOptionalProcessingError` | 3D Secure authentication might still be performed, but isn’t required. However, attempts to perform 3D Secure result in a processing error. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| Supported | Unenrolled | `pm_card_visa` | 3D Secure is supported for this card, but this card isn’t enrolled in 3D Secure. Even if your Radar rules request 3D Secure, the customer won’t be prompted to authenticate. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| Not supported |  | `pm_card_amex_threeDSecureNotSupported` | 3D Secure isn’t supported on this card and can’t be invoked. The PaymentIntent or SetupIntent proceeds without performing authentication. |

#### Tokens

Most integrations don’t use tokens anymore, but we make test tokens such as [tok_visa](https://docs.stripe.com/testing.md?testing-method=tokens#visa) available if you need them.

| 3D Secure usage | Outcome | Token | Details |
| --- | --- | --- | --- |
| Required | OK | `tok_threeDSecure2Required` | 3D Secure authentication must be completed for the payment to be successful. By default, your Radar rules request 3D Secure authentication for this card. |
| Required | Declined | `tok_threeDSecureRequiredChargeDeclined` | 3D Secure authentication is required, but payments are declined with a `card_declined` failure code after authentication. By default, your Radar rules request 3D Secure authentication for this card. |
| Required | Error | `tok_threeDSecureRequiredProcessingError` | 3D Secure authentication is required, but the 3D Secure lookup request fails with a processing error. Payments are declined with a `card_declined` failure code. By default, your Radar rules request 3D Secure authentication for this card. |
| Supported | OK | `tok_threeDSecureOptional` | 3D Secure authentication might still be performed, but isn’t required. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| Supported | Error | `tok_threeDSecureOptionalProcessingError` | 3D Secure authentication might still be performed, but isn’t required. However, attempts to perform 3D Secure result in a processing error. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| Supported | Unenrolled | `tok_visa` | 3D Secure is supported for this card, but this card isn’t enrolled in 3D Secure. Even if your Radar rules request 3D Secure, the customer won’t be prompted to authenticate. By default, your Radar rules don’t request 3D Secure authentication for this card. |
| Not supported |  | `tok_amex_threeDSecureNotSupported` | 3D Secure isn’t supported on this card and can’t be invoked. The PaymentIntent proceeds without performing authentication. |

### 3D Secure mobile challenge flows

In a mobile payment, several challenge flows for authentication—where the customer has to interact with prompts in the UI—are available. Use the test cards in this section to trigger a specific challenge flow for test purposes. These cards aren’t useful in browser-based payment forms or in API calls. In those environments, they work but don’t trigger any special behavior. Because they’re not useful in API calls, we don’t provide any `PaymentMethod` or `Token` values to test with.

| Challenge flow | Number | Details |
| --- | --- | --- |
| Out of band | 4000582600000094 | 3D Secure 2 authentication must be completed on all transactions. Triggers the challenge flow with Out of Band UI. |
| One time passcode | 4000582600000045 | 3D Secure 2 authentication must be completed on all transactions. Triggers the challenge flow with One Time Passcode UI. |
| Single select | 4000582600000102 | 3D Secure 2 authentication must be completed on all transactions. Triggers the challenge flow with single-select UI. |
| Multi select | 4000582600000110 | 3D Secure 2 authentication must be completed on all transactions. Triggers the challenge flow with multi-select UI. |

## Simulate a captcha challenge 

To prevent fraud, Stripe might display a captcha challenge to the user on the payment page. Use the following test cards to simulate this flow.

| Description | Number | Details |
| --- | --- | --- |
| Captcha challenge | 4000000000001208 | The charge succeeds if the user correctly answers the captcha challenge. |
| Captcha challenge | 4000000000003725 | The charge succeeds if the user correctly answers the captcha challenge. |

## Simulate an in-person payment with a PIN 

Use the test cards in this section to simulate successful in-person payments where a PIN is involved. For additional testing options, including a simulated reader and physical test cards, see [Test Stripe Terminal](https://docs.stripe.com/terminal/references/testing.md).

#### Card numbers

| Description | Number | Details |
| --- | --- | --- |
| Offline PIN | 4001007020000002 | This card simulates a payment where the cardholder is prompted for and enters an *offline PIN* (Offline PIN is a card verification method for EMV chip cards. These cards store the PIN securely on the chip itself, so PIN verification can occur without a network connection). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `offline_pin`. |
| Offline PIN retry | 4000008260000075 | Simulates an SCA-triggered retry flow where a cardholder’s initial contactless charge fails and the reader then prompts the user to insert their card and enter their *offline PIN* (Offline PIN is a card verification method for EMV chip cards. These cards store the PIN securely on the chip itself, so PIN verification can occur without a network connection). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `offline_pin`. |
| Online PIN | 4001000360000005 | This card simulates a payment where the cardholder is prompted for and enters an *online PIN* (Online PIN is a card verification method for EMV chip cards. These cards require the terminal to contact the issuer over a network connection to verify the PIN). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `online_pin`. |
| Online PIN retry | 4000002760000008 | Simulates an SCA-triggered retry flow where a cardholder’s initial contactless charge fails and the reader then prompts the user to insert their card and enter their *online PIN* (Online PIN is a card verification method for EMV chip cards. These cards require the terminal to contact the issuer over a network connection to verify the PIN). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `online_pin`. |

#### PaymentMethods

| Description | Number | Details |
| --- | --- | --- |
| Offline PIN | `offline_pin_cvm` | This card simulates a payment where the cardholder is prompted for and enters an *offline PIN* (Offline PIN is a card verification method for EMV chip cards. These cards store the PIN securely on the chip itself, so PIN verification can occur without a network connection). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `offline_pin`. |
| Offline PIN retry | `offline_pin_sca_retry` | Simulates an SCA-triggered retry flow where a cardholder’s initial contactless charge fails and the reader then prompts the user to insert their card and enter their *offline PIN* (Offline PIN is a card verification method for EMV chip cards. These cards store the PIN securely on the chip itself, so PIN verification can occur without a network connection). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `offline_pin`. |
| Online PIN | `online_pin_cvm` | This card simulates a payment where the cardholder is prompted for and enters an *online PIN* (Online PIN is a card verification method for EMV chip cards. These cards require the terminal to contact the issuer over a network connection to verify the PIN). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `online_pin`. |
| Online PIN retry | `online_pin_sca_retry` | Simulates an SCA-triggered retry flow where a cardholder’s initial contactless charge fails and the reader then prompts the user to insert their card and enter their *online PIN* (Online PIN is a card verification method for EMV chip cards. These cards require the terminal to contact the issuer over a network connection to verify the PIN). The resulting charge has [cardholder_verification_method](https://docs.stripe.com/api/charges/object.md#charge_object-payment_method_details-card_present-receipt-cardholder_verification_method) set to `online_pin`. |

## Test a webhook or event destination 

To test your webhook endpoint or [event destination](https://docs.stripe.com/events/how-events-work.md), choose one of these two options:

1. Perform actions in a sandbox that trigger real events to your event destination. For example, to trigger the [charge.succeeded](https://docs.stripe.com/api.md#event_types-charge.succeeded) event, you can use a [test card that produces a successful charge](https://docs.stripe.com/testing.md#cards).
2. [Trigger events using the Stripe CLI](https://docs.stripe.com/webhooks.md#test-webhook) or [using Stripe for Visual Studio Code](https://docs.stripe.com/stripe-vscode.md#webhooks).

## Rate limits

If requests in your test environment return `429` errors, reduce your request frequency. The rate limiter is stricter in test environments than in live mode. For an alternative, see [Load testing](https://docs.stripe.com/rate-limits.md#load-testing).

## Test a non-card payment method 

When you use a test non-card payment method, use [test API keys](https://docs.stripe.com/keys.md#obtain-api-keys) in all API calls. This is true whether you’re serving a payment form you can test interactively or writing test code.

Different payment methods have different test procedures:

#### ACH Direct Debit

Learn how to test scenarios with instant verifications using [Financial Connections](https://docs.stripe.com/financial-connections/testing.md#web-how-to-use-test-accounts).

### Send transaction emails in a sandbox

After you collect the bank account details and accept a mandate, send the mandate confirmation and microdeposit verification emails in a *sandbox* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes).

If your domain is **{domain}** and your username is **{username}**, use the following email format to send test transaction emails: **{username}+test\_email@{domain}**.

For example, if your domain is **example.com** and your username is **info**, use the format **info+test\_email@example.com** for testing ACH Direct Debit payments. This format ensures that emails route correctly. If you don’t include the **+test\_email** suffix, Stripe won’t send the email.

> You must [set up your Stripe account](https://docs.stripe.com/get-started/account/set-up.md) before you can trigger these emails while testing.

### Test account numbers

Stripe provides several test account numbers and corresponding tokens you can use to make sure your integration for manually-entered bank accounts is ready for production.

| Account number | Token | Routing number | Behavior |
| --- | --- | --- | --- |
| `000123456789` | `pm_usBankAccount_success` | `110000000` | The payment succeeds. |
| `000111111113` | `pm_usBankAccount_accountClosed` | `110000000` | The payment fails because the account is closed. |
| `000000004954` | `pm_usBankAccount_riskLevelHighest` | `110000000` | The payment is blocked by Radar due to a [high risk of fraud](https://docs.stripe.com/radar/transaction-risk-prevention.md#high-risk). |
| `000111111116` | `pm_usBankAccount_noAccount` | `110000000` | The payment fails because no account is found. |
| `000222222227` | `pm_usBankAccount_insufficientFunds` | `110000000` | The payment fails due to insufficient funds. |
| `000333333335` | `pm_usBankAccount_debitNotAuthorized` | `110000000` | The payment fails because debits aren’t authorized. |
| `000444444440` | `pm_usBankAccount_invalidCurrency` | `110000000` | The payment fails due to invalid currency. |
| `000666666661` | `pm_usBankAccount_failMicrodeposits` | `110000000` | The payment fails to send microdeposits. |
| `000555555559` | `pm_usBankAccount_dispute` | `110000000` | The payment triggers a dispute. |
| `000000000009` | `pm_usBankAccount_processing` | `110000000` | The payment stays in processing indefinitely. Useful for testing [PaymentIntent cancellation](https://docs.stripe.com/api/payment_intents/cancel.md). |
| `000777777771` | `pm_usBankAccount_weeklyLimitExceeded` | `110000000` | The payment fails due to payment amount causing the account to exceed its weekly payment volume limit. |
| `000888888885` |  | `110000000` | The payment fails because of a deactivated [tokenized account number](https://docs.stripe.com/financial-connections/tokenized-account-numbers.md). |

Before test transactions can complete, you need to verify all test accounts that automatically succeed or fail the payment. To do so, use the test microdeposit amounts or descriptor codes in the following table.

### Test microdeposit amounts and descriptor codes

To mimic different scenarios, use these microdeposit amounts or 0.01 descriptor code values.

| Microdeposit values | 0.01 descriptor code values | Scenario |
| --- | --- | --- |
| `32` and `45` | SM11AA | Simulates verifying the account. |
| `10` and `11` | SM33CC | Simulates exceeding the number of allowed verification attempts. |
| `40` and `41` | SM44DD | Simulates a microdeposit timeout. |

### Test settlement behavior

Test transactions settle instantly and are added to your available test balance. This behavior differs from live mode, where transactions can take [multiple days](https://docs.stripe.com/payments/ach-direct-debit.md#timing) to settle in your available balance.

#### SEPA Direct Debit

Create a test `PaymentIntent` that either succeeds or fails by doing the following:

1. Create a test *PaymentMethod* (PaymentMethods represent your customer's payment instruments, used with the Payment Intents or Setup Intents APIs) with a test account number.
2. Use the resulting `PaymentMethod` in a `confirmSepaDebitPayment` request to create the test charge.

### AT

| Account Number | Token | Description |
| --- | --- | --- |
| AT611904300234573201 | pm_sepaDebit_success_at | The PaymentIntent status transitions from `processing` to `succeeded`. |
| AT321904300235473204 | pm_sepaDebit_successDelayed_at | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| AT861904300235473202 | pm_sepaDebit_failed_at | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| AT051904300235473205 | pm_sepaDebit_failedDelayed_at | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| AT201904300000454545 | pm_sepaDebit_mandateRevoked_at | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| AT591904300235473203 | pm_sepaDebit_disputed_at | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| AT981904300000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_at | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| AT601904300000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_at | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| AT981904300002222227 | pm_sepaDebit_insufficientFunds_at | The payment fails with an `insufficient_funds` failure code. |
| AT511904300000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### BE

| Account Number | Token | Description |
| --- | --- | --- |
| BE62510007547061 | pm_sepaDebit_success_be | The PaymentIntent status transitions from `processing` to `succeeded`. |
| BE78510007547064 | pm_sepaDebit_successDelayed_be | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| BE68539007547034 | pm_sepaDebit_failed_be | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| BE51510007547065 | pm_sepaDebit_failedDelayed_be | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| BE12510000454545 | pm_sepaDebit_mandateRevoked_be | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| BE08510007547063 | pm_sepaDebit_disputed_be | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| BE90510000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_be | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| BE52510000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_be | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| BE90510002222227 | pm_sepaDebit_insufficientFunds_be | The payment fails with an `insufficient_funds` failure code. |
| BE43510000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### HR

| Account Number | Token | Description |
| --- | --- | --- |
| HR7624020064583467589 | pm_sepaDebit_success_hr | The PaymentIntent status transitions from `processing` to `succeeded`. |
| HR6323600002337876649 | pm_sepaDebit_successDelayed_hr | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| HR2725000096983499248 | pm_sepaDebit_failed_hr | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| HR6723600004878117427 | pm_sepaDebit_failedDelayed_hr | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| HR9324020060000454545 | pm_sepaDebit_mandateRevoked_hr | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| HR8724840081455523553 | pm_sepaDebit_disputed_hr | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| HR7424020060000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_hr | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| HR3624020060000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_hr | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| HR7424020060002222227 | pm_sepaDebit_insufficientFunds_hr | The payment fails with an `insufficient_funds` failure code. |
| HR2724020060000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### EE

| Account Number | Token | Description |
| --- | --- | --- |
| EE382200221020145685 | pm_sepaDebit_success_ee | The PaymentIntent status transitions from `processing` to `succeeded`. |
| EE222200221020145682 | pm_sepaDebit_successDelayed_ee | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| EE762200221020145680 | pm_sepaDebit_failed_ee | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| EE922200221020145683 | pm_sepaDebit_failedDelayed_ee | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| EE862200000000454545 | pm_sepaDebit_mandateRevoked_ee | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| EE492200221020145681 | pm_sepaDebit_disputed_ee | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| EE672200000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_ee | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| EE292200000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_ee | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| EE672200000002222227 | pm_sepaDebit_insufficientFunds_ee | The payment fails with an `insufficient_funds` failure code. |
| EE202200000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### FI

| Account Number | Token | Description |
| --- | --- | --- |
| FI2112345600000785 | pm_sepaDebit_success_fi | The PaymentIntent status transitions from `processing` to `succeeded`. |
| FI3712345600000788 | pm_sepaDebit_successDelayed_fi | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| FI9112345600000786 | pm_sepaDebit_failed_fi | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| FI1012345600000789 | pm_sepaDebit_failedDelayed_fi | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| FI8612345600454545 | pm_sepaDebit_mandateRevoked_fi | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| FI6412345600000787 | pm_sepaDebit_disputed_fi | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| FI6712345600343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_fi | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| FI2912345600121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_fi | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| FI6712345602222227 | pm_sepaDebit_insufficientFunds_fi | The payment fails with an `insufficient_funds` failure code. |
| FI2012345600066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### FR

| Account Number | Token | Description |
| --- | --- | --- |
| FR1420041010050500013M02606 | pm_sepaDebit_success_fr | The PaymentIntent status transitions from `processing` to `succeeded`. |
| FR3020041010050500013M02609 | pm_sepaDebit_successDelayed_fr | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| FR8420041010050500013M02607 | pm_sepaDebit_failed_fr | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| FR7920041010050500013M02600 | pm_sepaDebit_failedDelayed_fr | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| FR1920041010050000000454545 | pm_sepaDebit_mandateRevoked_fr | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| FR5720041010050500013M02608 | pm_sepaDebit_disputed_fr | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| FR9720041010050000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_fr | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| FR5920041010050000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_fr | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| FR9720041010050000002222227 | pm_sepaDebit_insufficientFunds_fr | The payment fails with an `insufficient_funds` failure code. |
| FR5020041010050000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### DE

| Account Number | Token | Description |
| --- | --- | --- |
| DE89370400440532013000 | pm_sepaDebit_success_de | The PaymentIntent status transitions from `processing` to `succeeded`. |
| DE08370400440532013003 | pm_sepaDebit_successDelayed_de | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| DE62370400440532013001 | pm_sepaDebit_failed_de | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| DE78370400440532013004 | pm_sepaDebit_failedDelayed_de | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| DE84370400440000454545 | pm_sepaDebit_mandateRevoked_de | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| DE35370400440532013002 | pm_sepaDebit_disputed_de | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| DE65370400440000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_de | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| DE27370400440000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_de | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| DE65370400440002222227 | pm_sepaDebit_insufficientFunds_de | The payment fails with an `insufficient_funds` failure code. |
| DE18370400440000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### GI

| Account Number | Token | Description |
| --- | --- | --- |
| GI60MPFS599327643783385 | pm_sepaDebit_success_gi | The PaymentIntent status transitions from `processing` to `succeeded`. |
| GI08RRNW626436291644533 | pm_sepaDebit_successDelayed_gi | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| GI41SAFA461293238477751 | pm_sepaDebit_failed_gi | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| GI50LROG772261344693297 | pm_sepaDebit_failedDelayed_gi | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| GI33NWBK000000000454545 | pm_sepaDebit_mandateRevoked_gi | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| GI26KJBC361883934534696 | pm_sepaDebit_disputed_gi | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| GI14NWBK000000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_gi | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| GI73NWBK000000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_gi | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| GI14NWBK000000002222227 | pm_sepaDebit_insufficientFunds_gi | The payment fails with an `insufficient_funds` failure code. |
| GI64NWBK000000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### IE

| Account Number | Token | Description |
| --- | --- | --- |
| IE29AIBK93115212345678 | pm_sepaDebit_success_ie | The PaymentIntent status transitions from `processing` to `succeeded`. |
| IE24AIBK93115212345671 | pm_sepaDebit_successDelayed_ie | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| IE02AIBK93115212345679 | pm_sepaDebit_failed_ie | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| IE94AIBK93115212345672 | pm_sepaDebit_failedDelayed_ie | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| IE29AIBK93115200454545 | pm_sepaDebit_mandateRevoked_ie | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| IE51AIBK93115212345670 | pm_sepaDebit_disputed_ie | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| IE10AIBK93115200343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_ie | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| IE69AIBK93115200121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_ie | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| IE10AIBK93115202222227 | pm_sepaDebit_insufficientFunds_ie | The payment fails with an `insufficient_funds` failure code. |
| IE60AIBK93115200066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### LI

| Account Number | Token | Description |
| --- | --- | --- |
| LI0508800636123378777 | pm_sepaDebit_success_li | The PaymentIntent status transitions from `processing` to `succeeded`. |
| LI4408800387787111369 | pm_sepaDebit_successDelayed_li | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| LI1208800143823175626 | pm_sepaDebit_failed_li | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| LI4908800356441975566 | pm_sepaDebit_failedDelayed_li | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| LI4308800000000454545 | pm_sepaDebit_mandateRevoked_li | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| LI7708800125525347723 | pm_sepaDebit_disputed_li | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| LI2408800000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_li | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| LI8308800000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_li | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| LI2408800000002222227 | pm_sepaDebit_insufficientFunds_li | The payment fails with an `insufficient_funds` failure code. |
| LI7408800000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### LT

| Account Number | Token | Description |
| --- | --- | --- |
| LT121000011101001000 | pm_sepaDebit_success_lt | The PaymentIntent status transitions from `processing` to `succeeded`. |
| LT281000011101001003 | pm_sepaDebit_successDelayed_lt | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| LT821000011101001001 | pm_sepaDebit_failed_lt | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| LT981000011101001004 | pm_sepaDebit_failedDelayed_lt | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| LT781000000000454545 | pm_sepaDebit_mandateRevoked_lt | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| LT551000011101001002 | pm_sepaDebit_disputed_lt | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| LT591000000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_lt | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| LT211000000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_lt | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| LT591000000002222227 | pm_sepaDebit_insufficientFunds_lt | The payment fails with an `insufficient_funds` failure code. |
| LT121000000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### LU

| Account Number | Token | Description |
| --- | --- | --- |
| LU280019400644750000 | pm_sepaDebit_success_lu | The PaymentIntent status transitions from `processing` to `succeeded`. |
| LU440019400644750003 | pm_sepaDebit_successDelayed_lu | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| LU980019400644750001 | pm_sepaDebit_failed_lu | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| LU170019400644750004 | pm_sepaDebit_failedDelayed_lu | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| LU120010000000454545 | pm_sepaDebit_mandateRevoked_lu | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| LU710019400644750002 | pm_sepaDebit_disputed_lu | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| LU900010000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_lu | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| LU520010000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_lu | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| LU900010000002222227 | pm_sepaDebit_insufficientFunds_lu | The payment fails with an `insufficient_funds` failure code. |
| LU430010000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### NL

| Account Number | Token | Description |
| --- | --- | --- |
| NL39RABO0300065264 | pm_sepaDebit_success_nl | The PaymentIntent status transitions from `processing` to `succeeded`. |
| NL55RABO0300065267 | pm_sepaDebit_successDelayed_nl | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| NL91ABNA0417164300 | pm_sepaDebit_failed_nl | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| NL28RABO0300065268 | pm_sepaDebit_failedDelayed_nl | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| NL46RABO0000454545 | pm_sepaDebit_mandateRevoked_nl | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| NL82RABO0300065266 | pm_sepaDebit_disputed_nl | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| NL27RABO0000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_nl | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| NL86RABO0000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_nl | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| NL27RABO0002222227 | pm_sepaDebit_insufficientFunds_nl | The payment fails with an `insufficient_funds` failure code. |
| NL77RABO0000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### NO

| Account Number | Token | Description |
| --- | --- | --- |
| NO9386011117947 | pm_sepaDebit_success_no | The PaymentIntent status transitions from `processing` to `succeeded`. |
| NO8886011117940 | pm_sepaDebit_successDelayed_no | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| NO6686011117948 | pm_sepaDebit_failed_no | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| NO6186011117941 | pm_sepaDebit_failedDelayed_no | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| NO2486010454545 | pm_sepaDebit_mandateRevoked_no | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| NO3986011117949 | pm_sepaDebit_disputed_no | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| NO0586010343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_no | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| NO6486010121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_no | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| NO0586012222227 | pm_sepaDebit_insufficientFunds_no | The payment fails with an `insufficient_funds` failure code. |
| NO5586010066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### PT

| Account Number | Token | Description |
| --- | --- | --- |
| PT50000201231234567890154 | pm_sepaDebit_success_pt | The PaymentIntent status transitions from `processing` to `succeeded`. |
| PT66000201231234567890157 | pm_sepaDebit_successDelayed_pt | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| PT23000201231234567890155 | pm_sepaDebit_failed_pt | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| PT39000201231234567890158 | pm_sepaDebit_failedDelayed_pt | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| PT24000201230000000454545 | pm_sepaDebit_mandateRevoked_pt | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| PT93000201231234567890156 | pm_sepaDebit_disputed_pt | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| PT05000201230000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_pt | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| PT64000201230000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_pt | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| PT05000201230000002222227 | pm_sepaDebit_insufficientFunds_pt | The payment fails with an `insufficient_funds` failure code. |
| PT55000201230000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### ES

| Account Number | Token | Description |
| --- | --- | --- |
| ES0700120345030000067890 | pm_sepaDebit_success_es | The PaymentIntent status transitions from `processing` to `succeeded`. |
| ES2300120345030000067893 | pm_sepaDebit_successDelayed_es | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| ES9121000418450200051332 | pm_sepaDebit_failed_es | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| ES9300120345030000067894 | pm_sepaDebit_failedDelayed_es | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| ES3600120345000000454545 | pm_sepaDebit_mandateRevoked_es | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| ES5000120345030000067892 | pm_sepaDebit_disputed_es | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| ES1700120345000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_es | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| ES7600120345000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_es | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| ES1700120345000002222227 | pm_sepaDebit_insufficientFunds_es | The payment fails with an `insufficient_funds` failure code. |
| ES6700120345000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### SE

| Account Number | Token | Description |
| --- | --- | --- |
| SE3550000000054910000003 | pm_sepaDebit_success_se | The PaymentIntent status transitions from `processing` to `succeeded`. |
| SE5150000000054910000006 | pm_sepaDebit_successDelayed_se | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| SE0850000000054910000004 | pm_sepaDebit_failed_se | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| SE2450000000054910000007 | pm_sepaDebit_failedDelayed_se | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| SE4750000000000000454545 | pm_sepaDebit_mandateRevoked_se | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| SE7850000000054910000005 | pm_sepaDebit_disputed_se | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| SE2850000000000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_se | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| SE8750000000000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_se | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| SE2850000000000002222227 | pm_sepaDebit_insufficientFunds_se | The payment fails with an `insufficient_funds` failure code. |
| SE7850000000000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### CH

| Account Number | Token | Description |
| --- | --- | --- |
| CH9300762011623852957 | pm_sepaDebit_success_ch | The PaymentIntent status transitions from `processing` to `succeeded`. |
| CH8656663438253651553 | pm_sepaDebit_successDelayed_ch | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| CH5362200119938136497 | pm_sepaDebit_failed_ch | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| CH1843597160341964438 | pm_sepaDebit_failedDelayed_ch | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| CH3700762000000454545 | pm_sepaDebit_mandateRevoked_ch | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| CH1260378413965193069 | pm_sepaDebit_disputed_ch | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| CH1800762000000343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_ch | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| CH7700762000000121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_ch | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| CH1800762000002222227 | pm_sepaDebit_insufficientFunds_ch | The payment fails with an `insufficient_funds` failure code. |
| CH6800762000000066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

### GB

| Account Number | Token | Description |
| --- | --- | --- |
| GB82WEST12345698765432 | pm_sepaDebit_success_gb | The PaymentIntent status transitions from `processing` to `succeeded`. |
| GB98WEST12345698765435 | pm_sepaDebit_successDelayed_gb | The PaymentIntent status transitions from `processing` to `succeeded` after at least three minutes. |
| GB55WEST12345698765433 | pm_sepaDebit_failed_gb | The PaymentIntent status transitions from `processing` to `requires_payment_method`. |
| GB71WEST12345698765436 | pm_sepaDebit_failedDelayed_gb | The PaymentIntent status transitions from `processing` to `requires_payment_method` after at least three minutes. |
| GB89WEST12345600454545 | pm_sepaDebit_mandateRevoked_gb | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate becomes `inactive`. Collect a new mandate before retrying the payment. |
| GB28WEST12345698765434 | pm_sepaDebit_disputed_gb | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| GB70WEST12345600343434 | pm_sepaDebit_exceedsWeeklyVolumeLimit_gb | The payment fails with a `charge_exceeds_source_limit` failure code due to payment amount causing account to exceed its weekly payment volume limit. |
| GB32WEST12345600121212 | pm_sepaDebit_exceedsWeeklyTransactionLimit_gb | The payment fails with a `charge_exceeds_weekly_limit` failure code due to payment amount exceeding account's transaction volume limit. |
| GB70WEST12345602222227 | pm_sepaDebit_insufficientFunds_gb | The payment fails with an `insufficient_funds` failure code. |
| GB23WEST12345600066666 |  | Payment method creation fails with a `bank_account_unusable` error. Use a different bank account or payment method. Applies to SetupIntents and PaymentIntents that include inline IBAN data. |

#### BACS Direct Debit

There are several [test bank account numbers](https://docs.stripe.com/keys.md#test-live-modes) you can use in a *sandbox* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes) to make sure this integration is ready. You can also use the corresponding token to skip manually entering bank account details.

| Sort code | Account number | Token | Description |
| --- | --- | --- | --- |
| `108800` | `00012345` | `pm_bacsDebit_success` | The payment succeeds and the PaymentIntent transitions from `processing` to `succeeded`. |
| `108800` | `90012345` | `pm_bacsDebit_successDelayed` | The payment succeeds after three minutes and the PaymentIntent transitions from `processing` to `succeeded`. |
| `108800` | `33333335` | `pm_bacsDebit_debitNotAuthorized` | The payment is accepted but then immediately fails with a `debit_not_authorized` failure code and the PaymentIntent transitions from `processing` to `requires_payment_method`. The mandate becomes `inactive` and the PaymentMethod can’t be used again. |
| `108800` | `93333335` | `pm_bacsDebit_debitNotAuthorizedDelayed` | The payment fails after three minutes with a `debit_not_authorized` failure code and the PaymentIntent transitions from `processing` to `requires_payment_method`. The mandate becomes `inactive` and the PaymentMethod can’t be used again. |
| `108800` | `22222227` | `pm_bacsDebit_insufficientFunds` | The payment fails with an `insufficient_funds` failure code and the PaymentIntent transitions from `processing` to `requires_payment_method`. The mandate remains `active` and the PaymentMethod can be used again. |
| `108800` | `92222227` | `pm_bacsDebit_insufficientFundsDelayed` | The payment fails after three minutes with an `insufficient_funds` failure code and the PaymentIntent transitions from `processing` to `requires_payment_method`. The mandate remains `active` and the PaymentMethod can be used again. |
| `108800` | `55555559` | `pm_bacsDebit_dispute` | The payment succeeds after three minutes and the PaymentIntent transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| `108800` | `00033333` | `pm_bacsDebit_mandateRefused` | PaymentMethod creation succeeds, but the mandate is refused by the customer’s bank and immediately transitions to `inactive`. |
| `108800` | `00044444` | — | The request to set up Bacs Direct Debit fails immediately due to an invalid account number and the customer is prompted to update their information before submitting. Payment details aren’t collected, so no synthetic token corresponds to this scenario. |
| `108800` | `34343434` | `pm_bacsDebit_exceedsWeeklyLimit` | The payment fails with a `charge_exceeds_source_limit` failure code due to the payment amount causing the account to exceed its weekly payment volume limit. |
| `108800` | `12121212` | `pm_bacsDebit_exceedsTransactionLimit` | The payment fails with a `charge_exceeds_transaction_limit` failure code due to the payment amount exceeding the account’s transaction volume limit. |

You can test using any of the account numbers provided above. However, because Bacs Direct Debit payments take several days to process, use the test account numbers that operate on a three-minute delay to better simulate the behavior of live payments.

> By default, Stripe automatically sends [emails](https://docs.stripe.com/payments/bacs-debit.md#debit-notifications) to the customer when payment details are initially collected and each time a debit will be made on their account. These notifications aren’t sent in sandboxes.

#### AU BECS Direct Debit

You can create a test `PaymentIntent` that either succeeds or fails by doing the following:

1. Create a test *PaymentMethod* (PaymentMethods represent your customer's payment instruments, used with the Payment Intents or Setup Intents APIs) with the test `BSB 000000` and a test account number from the list below.
2. Use the resulting `PaymentMethod` in a `confirmAuBecsDebitPayment` request to create the test charge.

### Test account numbers 

| BSB Number | Account number | Token | Description |
| --- | --- | --- | --- |
| `000000` | `000123456` | `pm_auBecsDebit_success` | The PaymentIntent status transitions from `processing` to `succeeded`. The mandate status remains `active`. |
| `000000` | `900123456` | `pm_auBecsDebit_successDelayed` | The PaymentIntent status transitions from `processing` to `succeeded` (with a three-minute delay). The mandate status remains `active`. |
| `000000` | `111111113` | `pm_auBecsDebit_accountClosed` | The PaymentIntent status transitions from `processing` to `requires_payment_method` with an `account_closed` failure code. The mandate status becomes `inactive`. |
| `000000` | `111111116` | `pm_auBecsDebit_noAccount` | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `no_account` failure code. The mandate status becomes `inactive`. |
| `000000` | `222222227` | `pm_auBecsDebit_referToCustomer` | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `refer_to_customer` failure code. The mandate status remains `active`. |
| `000000` | `922222227` | `pm_auBecsDebit_referToCustomerDelayed` | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `refer_to_customer` failure code (with a three-minute delay). The mandate status remains `active`. |
| `000000` | `333333335` | `pm_auBecsDebit_debitNotAuthorized` | The PaymentIntent status transitions from `processing` to `requires_payment_method` with a `debit_not_authorized` failure code. The mandate status becomes `inactive`. |
| `000000` | `666666660` | `pm_auBecsDebit_dispute` | The PaymentIntent status transitions from `processing` to `succeeded`, but a dispute is immediately created. |
| `000000` | `343434343` | `pm_auBecsDebit_exceedsWeeklyLimit` | The PaymentIntent fails with a `charge_exceeds_source_limit` error due to the payment amount causing the account to exceed its weekly payment volume limit. |
| `000000` | `121212121` | `pm_auBecsDebit_exceedsTransactionLimit` | The PaymentIntent fails with a `charge_exceeds_transaction_limit` error due to the payment amount exceeding the account’s transaction volume limit. |

#### Others

With other payment methods, testing information is included with the documentation. [Find your payment method](https://docs.stripe.com/payments/payment-methods/overview.md) and read the associated guide to accept and test payments.

## Test asynchronous payment methods

Asynchronous, or “delayed notification,” payment methods don’t immediately confirm whether a payment succeeds or fails. After your customer submits payment details, the `PaymentIntent` can enter a `processing` state. The final outcome, such as `succeeded` or `requires_payment_method`, arrives later, from a few minutes in a sandbox to several business days in live mode.

This behavior differs from most card payments, which usually receive an immediate authorization response from the issuer.

Don’t rely on a client-side callback or redirect to determine the final status for these payment methods. Always use webhooks to drive fulfillment.

### Understand the PaymentIntent lifecycle

Payment methods that don’t require further action from your customer to authorize the payment, such as bank debits, move through these states after your customer submits payment:

| Step | State | Description |
| --- | --- | --- |
| 1 | `processing` | Your customer submitted the payment, and the outcome isn’t yet known. |
| 2a | `succeeded` | The payment is confirmed. |
| 2b | `requires_payment_method` | The payment failed, for example because of insufficient funds or a closed account. |

Payment methods that require further action from your customer to authorize the payment, such as voucher-based methods including Multibanco, Boleto, OXXO, and Konbini, add an earlier state before `processing`:

| Step | State | Description |
| --- | --- | --- |
| 1 | `requires_action` | Stripe issued a voucher or payment code and is waiting for your customer to pay out of band. |
| 2 | `processing` | Stripe is waiting for the final outcome, and your customer can no longer complete the voucher payment through the original flow. |
| 3a | `succeeded` | Your customer paid the voucher. |
| 3b | `requires_payment_method` | The voucher expired or the payment failed. |

### Handle webhook events

Register a webhook handler, or use the [Stripe CLI](https://docs.stripe.com/cli.md) to listen locally with `stripe listen --forward-to localhost:4242/webhook`, and handle these events:

| Event | Description | Recommended action |
| --- | --- | --- |
| `payment_intent.processing` | Your customer successfully submitted payment and the result is pending. This is most common for bank debits. | Send a “payment pending” confirmation email and hold order fulfillment. |
| `payment_intent.succeeded` | The payment is confirmed. | Fulfill the order. |
| `payment_intent.payment_failed` | The payment failed, such as for insufficient funds, an expired voucher, or a closed account. | Notify your customer and request a new payment method. |
| `payment_intent.requires_action` | Stripe issued a voucher or out-of-band action and is waiting for your customer. This applies to Multibanco, Boleto, OXXO, and Konbini. | Send your customer the voucher or payment instructions. |
| `payment_intent.canceled` | The `PaymentIntent` was canceled before your customer completed payment. | Notify your customer. Don’t fulfill the order. |

For Checkout-based integrations, these corresponding session-level events also trigger:

- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

### Review expected webhook sequence by payment method

The test values for each method are in the [Test a non-card payment method](https://docs.stripe.com/testing.md#non-card-payments) section. Use the following tables to understand which webhook sequence to expect when you use those test values.

### Review bank debit webhook sequence

All bank debit methods follow the `processing` to `succeeded` or `payment_failed` pattern. In a sandbox, transitions happen after about 3 minutes for account numbers that simulate a delay. These use a `9` prefix or suffix. See the test values for each method in the referenced section.

| Method | Test values | Expected webhooks for success | Expected webhooks for failure |
| --- | --- | --- | --- |
| SEPA Direct Debit | [See SEPA Direct Debit](https://docs.stripe.com/testing.md?payment-method=sepa-direct-debit#non-card-payments) | `payment_intent.processing`, then `payment_intent.succeeded` | `payment_intent.processing`, then `payment_intent.payment_failed` |
| ACH Direct Debit | [See ACH Direct Debit](https://docs.stripe.com/testing.md?payment-method=ach-direct-debit#non-card-payments) | `payment_intent.processing`, then `payment_intent.succeeded` | `payment_intent.processing`, then `payment_intent.payment_failed` |
| BACS Direct Debit | [See BACS Direct Debit](https://docs.stripe.com/testing.md?payment-method=bacs-direct-debit#non-card-payments) | `payment_intent.processing`, then `payment_intent.succeeded` | `payment_intent.processing`, then `payment_intent.payment_failed` |
| AU BECS Direct Debit | [See AU BECS Direct Debit](https://docs.stripe.com/testing.md?payment-method=au-becs-direct-debit#non-card-payments) | `payment_intent.processing`, then `payment_intent.succeeded` | `payment_intent.processing`, then `payment_intent.payment_failed` |

### Review voucher-based webhook sequence

Voucher methods issue a payment code that your customer pays out of band. The `PaymentIntent` enters `requires_action` immediately after confirmation. The delayed outcome arrives when your customer pays or when the voucher expires.

For Multibanco, Boleto, OXXO, and Konbini, use the email address patterns in [their respective test sections](https://docs.stripe.com/testing.md#non-card-payments) to control whether the simulated voucher is paid, expires, or never resolves.

| Method | Expected webhooks for success | Expected webhooks for failure or expiry |
| --- | --- | --- |
| Multibanco | `payment_intent.requires_action`, then `payment_intent.processing`, then `payment_intent.succeeded` | `payment_intent.requires_action`, then `payment_intent.processing`, then `payment_intent.payment_failed` |
| Boleto, OXXO, and Konbini | `payment_intent.requires_action`, then `payment_intent.succeeded` | `payment_intent.requires_action`, then `payment_intent.payment_failed` |

### Review redirect and delayed notification method

Some payment methods redirect your customer for authentication. Depending on the payment method and configuration, Stripe might confirm the final outcome immediately after the redirect or deliver it asynchronously.

Expected webhook events for a successful payment:

- `payment_intent.processing`
- `payment_intent.succeeded`

BLIK can also fail asynchronously in two ways. Use the email patterns in the BLIK test section to simulate them:

- **Delayed bank decline**: The bank declines the payment after your customer approves it, and `payment_intent.payment_failed` triggers after a delay.
- **Timeout**: Your customer doesn’t respond in time, and `payment_intent.payment_failed` triggers after the timeout window.

BLIK can also fail immediately, such as when a code is expired or invalid. These synchronous failures don’t involve a delayed webhook.

### Test asynchronous flow end to end

Use these tips to test your integration.

Use the Stripe CLI to receive webhooks locally:

```bash
stripe listen --forward-to localhost:4242/webhook
```

Trigger specific events manually to test your handler in isolation without running a full payment flow:

```bash
stripe trigger payment_intent.processing
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
```

Handle `processing` in your return URL UI. When Stripe redirects your customer back to your site, `paymentIntent.status` might be `processing`, not `succeeded`. Show a `payment pending` state instead of an error.

Don’t fulfill physical goods on `processing`. Wait for `payment_intent.succeeded`. For digital goods, you might choose to grant access speculatively on `processing`, but your webhook handler must revoke access if `payment_intent.payment_failed` arrives later.

Test expiration and timeout paths. Use the `expire_immediately` or `fill_never` email patterns, where available, to verify that your integration handles unpaid vouchers correctly.

If you use the mobile PaymentSheet, enable `allowsDelayedPaymentMethods` to show delayed notification methods. The final payment status isn’t known when the sheet completes. Tell your customers their order is confirmed, and fulfill only after `payment_intent.succeeded` arrives.

### Review asynchronous payment methods

The following table summarizes the PaymentIntent state each method enters immediately after confirmation, and the webhook events your server should expect after the delayed outcome arrives.

| Method | Category | State after confirm | Delayed success event | Delayed failure event |
| --- | --- | --- | --- | --- |
| SEPA Direct Debit | Bank debit | `processing` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| ACH Direct Debit | Bank debit | `processing` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| BACS Direct Debit | Bank debit | `processing` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| AU BECS Direct Debit | Bank debit | `processing` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| Multibanco | Voucher | `requires_action` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| Boleto | Voucher | `requires_action` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| OXXO | Voucher | `requires_action` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| Konbini | Voucher | `requires_action` | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| Pay by Bank | Redirect and delayed notification | `requires_action`, then usually `succeeded` or `requires_payment_method` after the redirect | `payment_intent.succeeded` | `payment_intent.payment_failed` |
| BLIK | Redirect and delayed notification or timeout | varies | `payment_intent.succeeded` | `payment_intent.payment_failed` |

## Test Link

> Don’t store real user data in *sandbox* (A sandbox is an isolated test environment that allows you to test Stripe functionality in your account without affecting your live integration. Use sandboxes to safely experiment with new features and changes) Link accounts. Treat them as if they’re publicly available, because these test accounts are associated with your publishable key.

Link supports credit cards, debit cards, and qualified US bank account purchases.

You can create sandbox accounts for Link using any valid email address. The following table shows the fixed one-time passcode values that Stripe accepts for authenticating sandbox accounts:

| Value | Outcome |
| --- | --- |
| Any other 6 digits not listed below | Success |
| 000001 | Error, code invalid |
| 000002 | Error, code expired |
| 000003 | Error, max attempts exceeded |

### Multiple funding sources

Stripe automatically supports additional funding sources without changes to your integration. They use the same transaction settlement time and processing behavior as card and bank account payments.

## Test a redirect-based flow 

To test your integration’s redirect-handling logic by simulating a payment that uses a redirect flow (for example, iDEAL), use a supported payment method that [requires redirects](https://docs.stripe.com/payments/payment-methods/payment-method-support.md#additional-api-supportability).

To create a test `PaymentIntent` that either succeeds or fails:

1. Go to the [payment methods settings in the Dashboard](https://dashboard.stripe.com/settings/payment_methods) and enable a supported payment method by clicking **Turn on** in your testing environment.
2. Collect payment details.
3. Submit the payment to Stripe.
4. Authorize or fail the test payment.

Make sure that the page (corresponding to `return_url`) on your website provides the status of the payment.

## See also

- [Testing your Connect integration](https://docs.stripe.com/connect/testing.md)
- [Testing your Billing integration](https://docs.stripe.com/billing/testing.md)
- [Testing your Terminal integration](https://docs.stripe.com/terminal/references/testing.md)
- [Load testing](https://docs.stripe.com/rate-limits.md#load-testing)
- [Testing use cases](https://docs.stripe.com/testing-use-cases.md)
