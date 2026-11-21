import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(adminApp);

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return adminAuth.verifyIdToken(idToken);
}
