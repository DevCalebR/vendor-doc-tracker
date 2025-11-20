/**
 * Storage Helper Utilities
 * Wraps the window.storage API with error handling and convenience methods
 */

const handleStorageError = (error, operation, key) => {
  console.error(`Storage ${operation} error for key "${key}":`, error);
  if (error.message?.includes('404') || error.message?.includes('Database error: 404')) {
    return null;
  }
  throw error;
};

export const getStorageItem = async (key, shared = false) => {
  try {
    const result = await window.storage.get(key, shared);
    if (!result || !result.value) return null;
    return JSON.parse(result.value);
  } catch (error) {
    return handleStorageError(error, 'get', key);
  }
};

export const setStorageItem = async (key, value, shared = false) => {
  try {
    const stringValue = JSON.stringify(value);
    const result = await window.storage.set(key, stringValue, shared);
    return result !== null;
  } catch (error) {
    handleStorageError(error, 'set', key);
    return false;
  }
};

export const deleteStorageItem = async (key, shared = false) => {
  try {
    const result = await window.storage.delete(key, shared);
    return result !== null;
  } catch (error) {
    handleStorageError(error, 'delete', key);
    return false;
  }
};

export const listStorageKeys = async (prefix = '', shared = false) => {
  try {
    const result = await window.storage.list(prefix, shared);
    return result?.keys || [];
  } catch (error) {
    handleStorageError(error, 'list', prefix);
    return [];
  }
};

export const storageKeyExists = async (key, shared = false) => {
  try {
    const result = await window.storage.get(key, shared);
    return result !== null;
  } catch (error) {
    return false;
  }
};

export default {
  get: getStorageItem,
  set: setStorageItem,
  delete: deleteStorageItem,
  list: listStorageKeys,
  exists: storageKeyExists
};