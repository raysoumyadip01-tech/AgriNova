import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { PublicRegisterRole, ThemeMode } from '../types/auth';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}

void testConnection();

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const LANG_PATTERN = /^[a-z]{2,5}$/;

export async function syncUserProfileToFirestore(params: {
  displayName: string;
  role: PublicRegisterRole;
  themePreference: ThemeMode;
  languagePreference: string;
  email: string;
  phone?: string | null;
  location?: string | null;
}): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified || !ID_PATTERN.test(currentUser.uid)) {
    return;
  }

  const profilePath = `user_profiles/${currentUser.uid}`;
  const privatePath = `user_profiles/${currentUser.uid}/private/contact`;
  const cleanDisplayName = params.displayName.trim().slice(0, 100) || 'AgriNova User';
  const cleanLang = LANG_PATTERN.test(params.languagePreference) ? params.languagePreference : 'en';
  const cleanTheme: ThemeMode = ['coffee', 'light', 'dark', 'system'].includes(params.themePreference)
    ? params.themePreference
    : 'coffee';
  const cleanRole: PublicRegisterRole = ['farmer', 'transporter', 'warehouse', 'retailer'].includes(params.role)
    ? params.role
    : 'farmer';

  try {
    const profileRef = doc(db, 'user_profiles', currentUser.uid);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      await setDoc(profileRef, {
        uid: currentUser.uid,
        displayName: cleanDisplayName.length >= 2 ? cleanDisplayName : 'AgriNova User',
        role: cleanRole,
        themePreference: cleanTheme,
        languagePreference: cleanLang,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        profileRef,
        {
          displayName: cleanDisplayName.length >= 2 ? cleanDisplayName : 'AgriNova User',
          themePreference: cleanTheme,
          languagePreference: cleanLang,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  try {
    const privateRef = doc(db, 'user_profiles', currentUser.uid, 'private', 'contact');
    const privatePayload: Record<string, unknown> = {
      uid: currentUser.uid,
      email: params.email.trim().slice(0, 160),
      updatedAt: serverTimestamp(),
    };
    if (params.phone && params.phone.trim()) {
      privatePayload.phone = params.phone.trim().slice(0, 32);
    }
    if (params.location && params.location.trim()) {
      privatePayload.location = params.location.trim().slice(0, 160);
    }
    await setDoc(privateRef, privatePayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}
