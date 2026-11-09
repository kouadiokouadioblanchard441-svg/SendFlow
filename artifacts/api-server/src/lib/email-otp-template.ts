import { EMAIL_OTP_LIFETIME_SECONDS, type EmailOtpPurpose } from "./email-otp-code.ts";

const FONT_STACK = "'DM Sans',Roboto,'Helvetica Neue',Arial,sans-serif";

const COPY: Record<EmailOtpPurpose, { subject: string; intro: string }> = {
  signup: {
    subject: "Vérifiez votre adresse e-mail — SendFlow",
    intro: "Utilisez ce code pour vérifier votre adresse e-mail et terminer la création de votre compte SendFlow.",
  },
  password_reset: {
    subject: "Réinitialisation de votre mot de passe — SendFlow",
    intro: "Utilisez ce code pour continuer la réinitialisation de votre mot de passe SendFlow.",
  },
  pin_reset: {
    subject: "Réinitialisation de votre code PIN — SendFlow",
    intro: "Utilisez ce code pour continuer la réinitialisation de votre code PIN SendFlow.",
  },
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

function sendFlowLogoUrl(publicSiteUrl?: string) {
  if (!publicSiteUrl) return null;
  try {
    const site = new URL(publicSiteUrl);
    if (
      site.protocol !== "https:"
      || site.username
      || site.password
      || site.search
      || site.hash
      || site.pathname !== "/"
    ) return null;
    return new URL("/sendflow-favicon.png", site.origin).toString();
  } catch {
    return null;
  }
}

export function renderEmailOtpContent(
  purpose: EmailOtpPurpose,
  code: string,
  options: { publicSiteUrl?: string; now?: Date } = {},
) {
  if (!/^[0-9]{6}$/.test(code)) {
    throw new Error("Invalid email verification code");
  }

  const copy = COPY[purpose];
  const safeCode = escapeHtml(code);
  const logoUrl = sendFlowLogoUrl(options.publicSiteUrl);
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="44" height="44" alt="Logo SendFlow" style="display:block;width:44px;height:44px;object-fit:contain;border:0">`
    : "";
  const year = (options.now ?? new Date()).getFullYear();
  const expiryMinutes = Math.ceil(EMAIL_OTP_LIFETIME_SECONDS / 60);
  const expiryMessage = `Ce code est valable pendant ${expiryMinutes} minutes.`;
  const securityMessage = "Si vous n’avez pas demandé ce code, ignorez cet e-mail. En cas de doute, contactez le service client depuis l’application SendFlow.";
  const noReplyMessage = "Merci de ne pas répondre à cet e-mail.";

  return {
    subject: copy.subject,
    text: [
      "SendFlow",
      "",
      copy.intro,
      "",
      "Votre code de vérification :",
      code,
      "",
      expiryMessage,
      securityMessage,
      noReplyMessage,
    ].join("\n"),
    html: `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(copy.subject)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&amp;display=swap">
    <style type="text/css">body,table,td,p,h1,a,strong { font-family:${FONT_STACK}; }</style>
  </head>
  <body style="margin:0;padding:0;background:#eef2f6;color:#252534;font-family:${FONT_STACK}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef2f6;font-family:${FONT_STACK}">
      <tr><td align="center" style="padding:32px 14px">
        <table role="presentation" width="520" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;border-collapse:separate;border-spacing:0;font-family:${FONT_STACK}">
          <tr><td align="center" style="padding:8px 12px 24px">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="font-family:${FONT_STACK}">
              <tr>
                ${logo ? `<td valign="middle" style="padding-right:10px">${logo}</td>` : ""}
                <td valign="middle" style="color:#171522;font-family:${FONT_STACK};font-size:25px;font-weight:800;letter-spacing:-.7px">SendFlow</td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:34px 30px 30px;background:#ffffff;border:1px solid #e3e8ef;border-radius:12px">
            <p style="margin:0 0 12px;color:#252534;font-family:${FONT_STACK};font-size:15px;line-height:1.65">${escapeHtml(copy.intro)}</p>
            <h1 style="margin:26px 0 14px;color:#252534;font-family:${FONT_STACK};font-size:18px;line-height:1.4;font-weight:700;text-align:center">Votre code de vérification :</h1>
            <p style="margin:0;padding:8px 0 12px;color:#252534;font-family:Arial,Roboto,'Helvetica Neue',sans-serif;font-size:34px;line-height:1.3;font-weight:700;letter-spacing:9px;text-align:center">${safeCode}</p>
            <p style="margin:8px 0 18px;color:#49515d;font-family:${FONT_STACK};font-size:15px;line-height:1.6;text-align:center">${expiryMessage}</p>
            <p style="margin:0;color:#626b77;font-family:${FONT_STACK};font-size:14px;line-height:1.65;text-align:center">${securityMessage}</p>
          </td></tr>
          <tr><td align="center" style="padding:20px 16px 4px;color:#737c88;font-family:${FONT_STACK};font-size:12px;line-height:1.6">
            <p style="margin:0 0 5px">${noReplyMessage}</p>
            <p style="margin:0">© ${year} SendFlow. Tous droits réservés.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}
