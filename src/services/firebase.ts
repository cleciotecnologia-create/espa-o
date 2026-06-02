/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Detect if we have real configured secrets or are using mock placeholders
export const isLocalMode = !firebaseConfig.apiKey || 
  firebaseConfig.apiKey.includes('mock-api-key') || 
  firebaseConfig.projectId === 'mock-project-id';

let firebaseApp;
let firestoreDb: any = null;
let firebaseAuth: any = null;

if (!isLocalMode) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    firebaseAuth = getAuth(firebaseApp);

    // Validate connection is online from server
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firebase client is currently offline. Simulating local backup queries.");
        }
      }
    };
    testConnection();
  } catch (error) {
    console.error("Failed to initialize Firebase SDK:", error);
  }
}

export const db = firestoreDb;
export const auth = firebaseAuth;

/**
 * Authentication Helper Routines (with robust local storage simulation)
 */
export async function getCurrentUser(): Promise<any> {
  const localUserStr = localStorage.getItem('es_user_session');
  if (localUserStr) {
    return JSON.parse(localUserStr);
  }

  if (auth) {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (usr) => {
        unsubscribe();
        if (usr) {
          const formatted = {
            uid: usr.uid,
            email: usr.email,
            displayName: usr.displayName || 'Clécio Santos',
            photoURL: usr.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
            role: 'superadmin'
          };
          localStorage.setItem('es_user_session', JSON.stringify(formatted));
          resolve(formatted);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Local Dev default session check: return null if not logged in to enforce login screen
  return null;
}

export async function loginWithCredentials(emailArg: string, passwordArg: string): Promise<any> {
  // 1. Try checking the "system_users" collection in Firestore if we are online
  if (!isLocalMode && db) {
    try {
      const q = query(
        collection(db, 'system_users'),
        where('email', '==', emailArg.toLowerCase())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        if (docData.senhaSecreta === passwordArg) {
          const formatted = {
            uid: snap.docs[0].id,
            email: docData.email,
            displayName: docData.nome,
            photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
            role: docData.role
          };
          localStorage.setItem('es_user_session', JSON.stringify(formatted));
          return formatted;
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar operador corporativo remoto:", e);
    }
  }

  // 2. Check our local customized system users list next
  const localUsersStr = localStorage.getItem('es_system_users');
  if (localUsersStr) {
    try {
      const users = JSON.parse(localUsersStr);
      const match = users.find((u: any) => u.email.toLowerCase() === emailArg.toLowerCase() && u.senhaSecreta === passwordArg);
      if (match) {
        const formatted = {
          uid: match.id,
          email: match.email,
          displayName: match.nome,
          photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop',
          role: match.role
        };
        localStorage.setItem('es_user_session', JSON.stringify(formatted));
        return formatted;
      }
    } catch (e) {
      console.error("Erro ao verificar operadores customizados locais:", e);
    }
  }

  // 3. Fallback to Firebase authentication if real Auth is configured
  if (!isLocalMode && auth) {
    try {
      const credential = await signInWithEmailAndPassword(auth, emailArg, passwordArg);
      const formatted = {
        uid: credential.user.uid,
        email: credential.user.email,
        displayName: credential.user.displayName || 'Clécio Santos',
        photoURL: credential.user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
        role: 'superadmin'
      };
      localStorage.setItem('es_user_session', JSON.stringify(formatted));
      return formatted;
    } catch (authError) {
      console.warn("Firebase Auth falhou, verificando demos ou senhas customizadas:", authError);
    }
  }

  // 4. Guaranteed local fallback for demonstration mode (admin@eventspace.com.br / 123456)
  if (emailArg.toLowerCase() === 'admin@eventspace.com.br' && passwordArg === '123456') {
    const formatted = {
      uid: 'clecio_admin_dev_10',
      email: emailArg.toLowerCase(),
      displayName: 'Clécio Santos (Superadmin)',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
      role: 'superadmin'
    };
    localStorage.setItem('es_user_session', JSON.stringify(formatted));
    return formatted;
  } else {
    throw new Error("Credenciais inválidas");
  }
}

export async function loginWithGoogle(): Promise<any> {
  if (!isLocalMode && auth) {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    const formatted = {
      uid: credential.user.uid,
      email: credential.user.email,
      displayName: credential.user.displayName || 'Google User',
      photoURL: credential.user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop'
    };
    localStorage.setItem('es_user_session', JSON.stringify(formatted));
    return formatted;
  }
  
  throw new Error("Modo local simulado");
}

export async function logout(): Promise<void> {
  localStorage.removeItem('es_user_session');
  if (!isLocalMode && auth) {
    await signOut(auth);
  }
}

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentAuth = auth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid || null,
      email: currentAuth?.currentUser?.email || null,
      emailVerified: currentAuth?.currentUser?.emailVerified || null,
      isAnonymous: currentAuth?.currentUser?.isAnonymous || null,
      tenantId: currentAuth?.currentUser?.tenantId || null,
      providerInfo: currentAuth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error Details: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
