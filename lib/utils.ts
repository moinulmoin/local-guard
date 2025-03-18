import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Checks if a URL is a localhost URL
 * Handles various localhost patterns:
 * - http://localhost
 * - https://localhost
 * - http://localhost:PORT
 * - http://127.0.0.1
 * - http://127.0.0.1:PORT
 * - Other 127.x.x.x variations
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'localhost' || 
           urlObj.hostname === '127.0.0.1' ||
           /^127\.\d+\.\d+\.\d+$/.test(urlObj.hostname);
  } catch (e) {
    console.error('Invalid URL:', e);
    return false;
  }
}

/**
 * Safely sets an extension's enabled state with error handling
 * @returns Promise<boolean> indicating success or failure
 */
export async function safeSetExtensionState(id: string, enabled: boolean): Promise<boolean> {
  try {
    await chrome.management.setEnabled(id, enabled);
    return true;
  } catch (error) {
    console.error(`Failed to set extension ${id} to ${enabled ? 'enabled' : 'disabled'}:`, error);
    return false;
  }
}

/**
 * Verifies if all extensions have the expected enabled/disabled states
 * @returns Promise<boolean> indicating if all extensions match expected states
 */
export async function verifyExtensionStates(expectedStates: {id: string, enabled: boolean}[]): Promise<boolean> {
  try {
    const currentExtensions = await chrome.management.getAll();
    for (const expected of expectedStates) {
      const ext = currentExtensions.find(e => e.id === expected.id);
      if (ext && ext.enabled !== expected.enabled) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to verify extension states:', error);
    return false;
  }
}

/**
 * Logs extension state changes for debugging
 */
export function logExtensionStateChange(id: string, name: string | undefined, enabled: boolean): void {
  console.log(`Extension ${name || id} ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Interface for extension state
 */
export interface ExtensionState {
  id: string;
  enabled: boolean;
  name?: string;
}

/**
 * Safely gets data from storage with error handling
 */
export async function safeGetFromStorage<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    console.error(`Failed to get ${key} from storage:`, error);
    return null;
  }
}

/**
 * Safely sets data to storage with error handling
 */
export async function safeSetToStorage(key: string, value: any): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [key]: value });
    return true;
  } catch (error) {
    console.error(`Failed to set ${key} in storage:`, error);
    return false;
  }
}
