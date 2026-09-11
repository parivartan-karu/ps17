'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Initiates a setDoc operation for a document reference.
 * Awaits the write operation to ensure data persistence.
 */
export async function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  try {
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
    return docRef;
  } catch (error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: data,
      })
    );
    throw error;
  }
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Awaits the write operation to ensure data persistence and returns the new doc ref.
 */
export async function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  try {
    const docRef = await addDoc(colRef, data);
    console.log('Document written with ID:', docRef.id);
    return docRef;
  } catch (error) {
    console.error('Error adding document:', error);
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: data,
      })
    );
    throw error;
  }
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Awaits the write operation to ensure data persistence.
 */
export async function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  try {
    await updateDoc(docRef, data);
    return docRef;
  } catch (error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      })
    );
    throw error;
  }
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Awaits the write operation to ensure data persistence.
 */
export async function deleteDocumentNonBlocking(docRef: DocumentReference) {
  try {
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      })
    );
    throw error;
  }
}