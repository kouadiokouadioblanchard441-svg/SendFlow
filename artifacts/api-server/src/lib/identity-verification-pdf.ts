import PDFDocument from "pdfkit";

export type IdentityVerificationPdfPhoto = {
  kind: "front" | "back" | "selfie";
  buffer: Buffer;
};

export type IdentityVerificationPdfData = {
  requestId: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Date | string;
  reviewedAt: Date | string | null;
  reviewedBy: string | null;
  decisionReason: string | null;
  personalData: {
    firstName: string;
    lastName: string;
    documentType: string;
    documentNumber: string;
    birthDate: string;
    documentExpiryDate: string;
  };
  user: {
    id: string;
    displayName: string | null;
    phone: string | null;
    email: string | null;
    countryCode: string | null;
    status: string;
  };
  photos: IdentityVerificationPdfPhoto[];
};

const BRAND = "#6D35D8";
const DARK = "#20202A";
const MUTED = "#626675";
const STATUS_LABEL: Record<IdentityVerificationPdfData["status"], string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};
const PHOTO_LABEL: Record<IdentityVerificationPdfPhoto["kind"], string> = {
  front: "Pièce d’identité — recto",
  back: "Pièce d’identité — verso",
  selfie: "Selfie avec la pièce",
};

function formatDate(value: Date | string | null) {
  if (!value) return "Non renseignée";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function addFooter(doc: PDFKit.PDFDocument, pageLabel: string) {
  const bottom = doc.page.height - 34;
  doc.save();
  doc.strokeColor("#E5E1EC").moveTo(42, bottom - 8).lineTo(doc.page.width - 42, bottom - 8).stroke();
  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text("SendFlow — Document confidentiel", 42, bottom, { lineBreak: false });
  doc.text(pageLabel, doc.page.width - 140, bottom, { width: 98, align: "right", lineBreak: false });
  doc.restore();
}

function addHeader(doc: PDFKit.PDFDocument, subtitle: string) {
  doc.save();
  doc.rect(0, 0, doc.page.width, 88).fill(BRAND);
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF").text("SendFlow", 42, 24);
  doc.font("Helvetica").fontSize(10).fillColor("#F3ECFF").text(subtitle, 42, 55);
  doc.restore();
  doc.y = 112;
}

function addField(doc: PDFKit.PDFDocument, label: string, value: string | null | undefined) {
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label.toLocaleUpperCase("fr-FR"), 44);
  doc.moveDown(0.15);
  doc.font("Helvetica").fontSize(11).fillColor(DARK)
    .text(value?.trim() || "Non renseigné", 44, undefined, { width: doc.page.width - 88 });
  doc.moveDown(0.6);
}

function toPdfBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.once("end", () => resolve(Buffer.concat(chunks)));
    doc.once("error", reject);
  });
}

export async function buildIdentityVerificationPdf(data: IdentityVerificationPdfData): Promise<Buffer> {
  const photoKinds = data.photos.map((photo) => photo.kind);
  if (
    photoKinds.length !== 3
    || new Set(photoKinds).size !== 3
    || !(["front", "back", "selfie"] as const).every((kind) => photoKinds.includes(kind))
  ) {
    throw new Error("All identity verification photos are required for PDF export");
  }

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 38, bottom: 44, left: 42, right: 42 },
    compress: true,
    info: {
      Title: `Dossier de vérification SendFlow ${data.requestId}`,
      Author: "SendFlow",
      Subject: "Dossier confidentiel de vérification d’identité",
    },
  });
  const result = toPdfBuffer(doc);

  addHeader(doc, "Dossier de vérification d’identité");
  doc.font("Helvetica-Bold").fontSize(17).fillColor(DARK).text("Informations du dossier", 44);
  doc.moveDown(0.7);
  addField(doc, "Identifiant de la demande", data.requestId);
  addField(doc, "Statut", STATUS_LABEL[data.status]);
  addField(doc, "Soumise le", formatDate(data.submittedAt));
  addField(doc, "Examinée le", formatDate(data.reviewedAt));
  addField(doc, "Identifiant de l’administrateur ayant examiné", data.reviewedBy);

  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text("Identité déclarée", 44);
  doc.moveDown(0.5);
  addField(doc, "Nom complet", `${data.personalData.firstName} ${data.personalData.lastName}`);
  addField(doc, "Type de document", data.personalData.documentType);
  addField(doc, "Numéro du document", data.personalData.documentNumber);
  addField(doc, "Date de naissance", data.personalData.birthDate);
  addField(doc, "Date d’expiration", data.personalData.documentExpiryDate);

  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text("Profil utilisateur", 44);
  doc.moveDown(0.5);
  addField(doc, "Identifiant utilisateur", data.user.id);
  addField(doc, "Nom du profil", data.user.displayName);
  addField(doc, "Téléphone", data.user.phone);
  addField(doc, "E-mail", data.user.email);
  addField(doc, "Pays", data.user.countryCode);
  addField(doc, "État du compte", data.user.status);
  if (data.decisionReason) {
    addField(doc, "Motif de décision", data.decisionReason);
  }
  addFooter(doc, "Résumé");

  for (const photo of data.photos) {
    doc.addPage({ size: "A4", margins: { top: 38, bottom: 44, left: 42, right: 42 } });
    addHeader(doc, "Dossier de vérification d’identité");
    doc.font("Helvetica-Bold").fontSize(16).fillColor(DARK).text(PHOTO_LABEL[photo.kind], 44);
    doc.moveDown(1);
    doc.image(photo.buffer, 44, doc.y, {
      fit: [doc.page.width - 88, doc.page.height - doc.y - 92],
      align: "center",
      valign: "center",
    });
    addFooter(doc, PHOTO_LABEL[photo.kind]);
  }

  doc.end();
  return result;
}
