import assert from "node:assert/strict";
import test from "node:test";
import {
  renderCampaignEmailHtml,
  renderCampaignEmailText,
} from "./email-campaign-template.ts";

const input = {
  subject: "Information <importante>",
  bodyText: "Bonjour,\n\nVotre compte SendFlow est prêt.",
  unsubscribeUrl: "https://sendflow.example/unsubscribe?token=abc&source=mail",
  contacts: {
    phoneNumber: "+2250102030405",
    whatsappNumber: "+2250506070809",
    facebookLabel: "SendFlow",
    facebookUrl: "https://www.facebook.com/SendFlow",
  },
};

test("campaign email template renders a branded responsive layout with live contact settings", () => {
  const html = renderCampaignEmailHtml(input);
  assert.match(html, /max-width:600px/);
  assert.match(html, /background:#ffffff/);
  assert.match(html, /<h1[^>]*>Information &lt;importante&gt;<\/h1>/);
  assert.match(html, /tel:\+2250102030405/);
  assert.match(html, /https:\/\/wa\.me\/2250506070809/);
  assert.match(html, /https:\/\/www\.facebook\.com\/SendFlow/);
  assert.match(html, /Merci de ne pas répondre à cet e-mail/);
  assert.match(html, /Se désinscrire/);
});

test("campaign template escapes user content and never inserts a hard-coded support number", () => {
  const html = renderCampaignEmailHtml({
    ...input,
    bodyText: "<script>alert(1)</script>",
    contacts: { phoneNumber: null, whatsappNumber: null, facebookLabel: null, facebookUrl: null },
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /coordonnées du service client seront disponibles/i);
  assert.doesNotMatch(html, /\+225\s?07\s?00\s?00\s?00\s?00/);
});

test("plain-text fallback includes current contacts and the no-reply instruction", () => {
  const text = renderCampaignEmailText(input);
  assert.match(text, /Téléphone : \+2250102030405/);
  assert.match(text, /WhatsApp : \+2250506070809/);
  assert.match(text, /Merci de ne pas répondre à cet e-mail/);
  assert.match(text, /Se désinscrire : https:\/\/sendflow\.example\/unsubscribe/);
});
