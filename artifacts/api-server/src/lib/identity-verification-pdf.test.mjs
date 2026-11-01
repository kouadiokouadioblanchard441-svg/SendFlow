import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { buildIdentityVerificationPdf } from "./identity-verification-pdf.ts";

const sample = {
  requestId: "c7c4a87f-741a-414c-b6d2-5b480cc8f901",
  status: "approved",
  submittedAt: "2026-10-31T12:00:00.000Z",
  reviewedAt: "2026-10-31T12:30:00.000Z",
  reviewedBy: "admin-test-id",
  decisionReason: "Document conforme",
  personalData: {
    firstName: "Aminata",
    lastName: "Échantillon",
    documentType: "Passeport",
    documentNumber: "TEST-12345",
    birthDate: "1995-04-12",
    documentExpiryDate: "2030-04-12",
  },
  user: {
    id: "user-test-id",
    displayName: "Aminata Échantillon",
    phone: "+22500000000",
    email: "test@example.invalid",
    countryCode: "CI",
    status: "active",
  },
};

test("identity dossier PDF contains the summary and all three photo pages", async () => {
  const image = await sharp({
    create: {
      width: 320,
      height: 320,
      channels: 3,
      background: { r: 109, g: 53, b: 216 },
    },
  }).jpeg().toBuffer();
  const pdf = await buildIdentityVerificationPdf({
    ...sample,
    photos: [
      { kind: "front", buffer: image },
      { kind: "back", buffer: image },
      { kind: "selfie", buffer: image },
    ],
  });
  const source = pdf.toString("latin1");
  const pages = source.match(/\/Type\s*\/Page\b/g) ?? [];
  assert.ok(source.startsWith("%PDF-"));
  assert.ok(pdf.length > image.length);
  assert.ok(pages.length >= 4);
});

test("identity dossier PDF refuses an incomplete set of photos", async () => {
  await assert.rejects(
    buildIdentityVerificationPdf({
      ...sample,
      photos: [{ kind: "front", buffer: Buffer.from("not-a-real-photo") }],
    }),
    /All identity verification photos are required/,
  );
});
