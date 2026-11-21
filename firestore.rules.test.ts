// Dirty Dozen Security Test Vectors for AgriNova Firestore Rules (Phase 0 TDD)
export interface SecurityTestCase {
  id: string;
  title: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01',
    title: 'Unauthenticated read on user profile',
    operation: 'get',
    path: 'user_profiles/user-1',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02',
    title: 'Blanket list query on user_profiles',
    operation: 'list',
    path: 'user_profiles',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03',
    title: 'Cross-user PII peek on private contact record',
    operation: 'get',
    path: 'user_profiles/user-2/private/contact',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04',
    title: 'Privilege escalation assigning admin role on create',
    operation: 'create',
    path: 'user_profiles/user-1',
    auth: { uid: 'user-1', email: 'attacker@example.com', email_verified: true },
    payload: {
      uid: 'user-1',
      displayName: 'Attacker',
      role: 'admin',
      themePreference: 'coffee',
      languagePreference: 'en',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05',
    title: 'Privilege escalation mutating role on update',
    operation: 'update',
    path: 'user_profiles/user-1',
    auth: { uid: 'user-1', email: 'attacker@example.com', email_verified: true },
    payload: { role: 'transporter' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06',
    title: 'Shadow/ghost field injection',
    operation: 'create',
    path: 'user_profiles/user-1',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    payload: {
      uid: 'user-1',
      displayName: 'Farmer',
      role: 'farmer',
      themePreference: 'coffee',
      languagePreference: 'en',
      isVerified: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07',
    title: 'Unverified email write attempt',
    operation: 'create',
    path: 'user_profiles/user-1',
    auth: { uid: 'user-1', email: 'soumyadipray2006@gmail.com', email_verified: false },
    payload: {
      uid: 'user-1',
      displayName: 'Spoof',
      role: 'farmer',
      themePreference: 'coffee',
      languagePreference: 'en',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08',
    title: 'ID poisoning exceeding 128 characters',
    operation: 'create',
    path: `crop_batches/${'a'.repeat(180)}`,
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user-1', name: 'Tomatoes' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09',
    title: 'String payload exhaustion exceeding maxLength',
    operation: 'create',
    path: 'crop_batches/batch-1',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user-1', name: 'X'.repeat(500) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10',
    title: 'Owner UID spoofing on crop batch creation',
    operation: 'create',
    path: 'crop_batches/batch-2',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user-2', batchCode: 'BCH-TOM-999', name: 'Tomato' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11',
    title: 'Immutable ownerId mutation on update',
    operation: 'update',
    path: 'crop_batches/batch-1',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    payload: { ownerId: 'user-2' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12',
    title: 'Terminal shipment state modification after delivery',
    operation: 'update',
    path: 'shipments/ship-1',
    auth: { uid: 'user-1', email: 'farmer@example.com', email_verified: true },
    payload: { status: 'In Transit' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
