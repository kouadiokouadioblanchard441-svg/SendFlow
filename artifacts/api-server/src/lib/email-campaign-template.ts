export type CampaignContactDetails = {
  phoneNumber: string | null;
  whatsappNumber: string | null;
  facebookLabel: string | null;
  facebookUrl: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function renderBodyParagraphs(bodyText: string) {
  return bodyText
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p style="margin:0 0 18px;color:#252534;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function contactLines(contacts: CampaignContactDetails) {
  const lines: string[] = [];
  if (contacts.phoneNumber) {
    const number = escapeHtml(contacts.phoneNumber);
    lines.push(`<div style="margin:0 0 6px"><strong>Téléphone :</strong> <a href="tel:${number}" style="color:#7621de;text-decoration:underline">${number}</a></div>`);
  }
  if (contacts.whatsappNumber) {
    const number = escapeHtml(contacts.whatsappNumber);
    const waNumber = contacts.whatsappNumber.replace(/\D/g, "");
    lines.push(`<div style="margin:0 0 6px"><strong>WhatsApp :</strong> <a href="https://wa.me/${waNumber}" style="color:#7621de;text-decoration:underline">${number}</a></div>`);
  }
  if (contacts.facebookLabel && contacts.facebookUrl) {
    lines.push(`<div style="margin:0 0 6px"><strong>Facebook :</strong> <a href="${escapeHtml(contacts.facebookUrl)}" style="color:#7621de;text-decoration:underline">${escapeHtml(contacts.facebookLabel)}</a></div>`);
  }
  return lines.join("");
}

export function renderCampaignEmailHtml(input: {
  subject: string;
  bodyText: string;
  unsubscribeUrl: string;
  contacts: CampaignContactDetails;
}) {
  const title = escapeHtml(input.subject);
  const unsubscribeUrl = escapeHtml(input.unsubscribeUrl);
  const contacts = contactLines(input.contacts);
  return `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${title}</title></head>
  <body style="margin:0;padding:0;background:#f3f4f6">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${title}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <tr><td style="padding:20px 28px;border-bottom:1px solid #ececf0">
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;letter-spacing:-.2px;color:#191923">SendFlow</span>
          </td></tr>
          <tr><td style="padding:30px 28px 24px">
            <h1 style="margin:0 0 22px;color:#191923;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;font-weight:700">${title}</h1>
            ${renderBodyParagraphs(input.bodyText)}
            <p style="margin:26px 0 0;color:#252534;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">L’équipe SendFlow</p>
          </td></tr>
          <tr><td style="padding:20px 28px;background:#f8f8fa;border-top:1px solid #ececf0">
            <p style="margin:0 0 10px;color:#353542;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;font-weight:700">Service client SendFlow</p>
            ${contacts || '<p style="margin:0 0 8px;color:#656573;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5">Les coordonnées du service client seront disponibles ici dès leur configuration dans SendFlow.</p>'}
            <p style="margin:12px 0 8px;color:#656573;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5">Merci de ne pas répondre à cet e-mail. Cette adresse n’est pas surveillée.</p>
            <p style="margin:0;color:#656573;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5">Vous recevez ce message car vous avez accepté les communications SendFlow. <a href="${unsubscribeUrl}" style="color:#7621de;text-decoration:underline">Se désinscrire</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function renderCampaignEmailText(input: {
  subject: string;
  bodyText: string;
  unsubscribeUrl: string;
  contacts: CampaignContactDetails;
}) {
  const contactRows = [
    input.contacts.phoneNumber ? `Téléphone : ${input.contacts.phoneNumber}` : null,
    input.contacts.whatsappNumber ? `WhatsApp : ${input.contacts.whatsappNumber}` : null,
    input.contacts.facebookLabel && input.contacts.facebookUrl
      ? `Facebook : ${input.contacts.facebookLabel} (${input.contacts.facebookUrl})`
      : null,
  ].filter(Boolean);
  return [
    input.subject,
    "",
    input.bodyText,
    "",
    "L’équipe SendFlow",
    "",
    "Service client SendFlow",
    ...contactRows,
    "",
    "Merci de ne pas répondre à cet e-mail. Cette adresse n’est pas surveillée.",
    "Vous recevez ce message car vous avez accepté les communications SendFlow.",
    `Se désinscrire : ${input.unsubscribeUrl}`,
  ].join("\n");
}
