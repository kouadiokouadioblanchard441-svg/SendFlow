export type BucketFingerprinter = (value: string) => string;

export function getCustomerAccessPhoneAttemptBucket(
  phoneHash: string,
  fingerprint: BucketFingerprinter,
) {
  return fingerprint(`customer-access-phone:${phoneHash}`);
}

export function getCustomerAccessAttemptBuckets(
  phoneHash: string | null,
  requesterHash: string,
  fingerprint: BucketFingerprinter,
) {
  return [
    ...(phoneHash ? [getCustomerAccessPhoneAttemptBucket(phoneHash, fingerprint)] : []),
    fingerprint(`customer-access-requester:${requesterHash}`),
  ];
}

export function getCustomerAccessAttemptBucketsForRequest(
  phone: string | null,
  requesterAddress: string,
  fingerprint: BucketFingerprinter,
) {
  return getCustomerAccessAttemptBuckets(
    phone ? fingerprint(`phone:${phone}`) : null,
    fingerprint(`requester:${requesterAddress}`),
    fingerprint,
  );
}
