import { defineBackground } from 'wxt/sandbox';
import {
  isLocalhostUrl,
  safeSetExtensionState,
  verifyExtensionStates,
  logExtensionStateChange,
  safeGetFromStorage,
  safeSetToStorage,
  type ExtensionState
} from '@/lib/utils';

// Save initial extension states when extension is installed
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    console.log('Extension installed');

    try {
      const extensions = await chrome.management.getAll();
      const initialState = extensions
        .filter(ext => ext.id !== chrome.runtime.id)
        .map(ext => ({
          id: ext.id,
          name: ext.name,
          enabled: ext.enabled
        }));

      await safeSetToStorage('initialExtensionStates', initialState);
      console.log('Initial extension states saved:', initialState.length);

      // Check current tab after installation
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currentTab?.id && currentTab?.url) {
        const isLocalhost = isLocalhostUrl(currentTab.url);
        if (isLocalhost) {
          await handleLocalhostTab(currentTab.id, true); // Reload on install if localhost
        }
      }
    } catch (error) {
      console.error('Error during installation setup:', error);
    }
  }
});

export default defineBackground(() => {
  let lastTabWasLocalhost: boolean | null = null;

  // Check current tab when extension starts
  chrome.tabs.query({ active: true, currentWindow: true }, async ([currentTab]) => {
    try {
      if (currentTab?.id && currentTab?.url) {
        const isLocalhost = isLocalhostUrl(currentTab.url);
        // On first load, reload if we're on localhost (need to disable extensions)
        const shouldReload = isLocalhost;
        lastTabWasLocalhost = isLocalhost;
        if (isLocalhost) {
          await handleLocalhostTab(currentTab.id, shouldReload);
        }
      }
    } catch (error) {
      console.error('Error checking current tab on startup:', error);
    }
  });

  // Listen for tab updates (URL changes)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
      if (changeInfo.url && tab.active) {
        const isLocalhost = isLocalhostUrl(changeInfo.url);
        if (isLocalhost) {
          await handleLocalhostTab(tabId, false); // Don't reload on URL change
        } else {
          await restoreExtensions(tabId, false); // Don't reload on URL change
        }
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  });

  // Listen for tab activation (switching tabs)
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url) {
        const isLocalhost = isLocalhostUrl(tab.url);
        // Only reload if switching between localhost and non-localhost
        const shouldReload = lastTabWasLocalhost !== null && isLocalhost !== lastTabWasLocalhost;

        if (isLocalhost) {
          await handleLocalhostTab(tabId, shouldReload);
        } else {
          await restoreExtensions(tabId, shouldReload);
        }

        lastTabWasLocalhost = isLocalhost;
      }
    } catch (error) {
      console.error('Error handling tab activation:', error);
    }
  });

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener(async () => {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id && activeTab.url) {
        const isLocalhost = isLocalhostUrl(activeTab.url);
        // Only reload if switching between localhost and non-localhost
        const shouldReload = lastTabWasLocalhost !== null && isLocalhost !== lastTabWasLocalhost;

        if (!isLocalhost) {
          await restoreExtensions(activeTab.id, shouldReload);
        }

        lastTabWasLocalhost = isLocalhost;
      }
    } catch (error) {
      console.error('Error handling tab removal:', error);
    }
  });
});

async function handleLocalhostTab(tabId: number, shouldReload: boolean) {
  try {
    console.log(`Handling localhost tab ${tabId}, shouldReload: ${shouldReload}`);

    // Get current extension states before disabling
    const extensions = await chrome.management.getAll();
    const currentState: ExtensionState[] = extensions
      .filter(ext => ext.id !== chrome.runtime.id)
      .map(ext => ({
        id: ext.id,
        name: ext.name,
        enabled: ext.enabled
      }));

    // Save current state
    const storageSuccess = await safeSetToStorage('lastKnownStates', currentState);
    if (!storageSuccess) {
      console.warn('Failed to save extension states to storage');
    }

    // Disable all extensions except our own
    let allDisabled = true;
    for (const ext of extensions) {
      if (ext.id !== chrome.runtime.id && ext.enabled) {
        const success = await safeSetExtensionState(ext.id, false);
        if (success) {
          logExtensionStateChange(ext.id, ext.name, false);
        } else {
          allDisabled = false;
          console.warn(`Failed to disable extension: ${ext.name || ext.id}`);
        }
      }
    }

    if (!allDisabled) {
      console.warn('Not all extensions were successfully disabled');
    }

    // Verify extensions were disabled
    const verificationResult = await verifyExtensionStates(
      extensions
        .filter(ext => ext.id !== chrome.runtime.id)
        .map(ext => ({ id: ext.id, enabled: false }))
    );

    if (!verificationResult) {
      console.warn('Extension state verification failed - not all extensions are in expected state');
    }

    // Reload the tab only if needed (switching between localhost and non-localhost)
    if (shouldReload) {
      console.log(`Reloading tab ${tabId}`);
      await chrome.tabs.reload(tabId);
    }
  } catch (error) {
    console.error('Error in handleLocalhostTab:', error);
  }
}

async function restoreExtensions(tabId: number, shouldReload: boolean) {
  try {
    console.log(`Restoring extensions for tab ${tabId}, shouldReload: ${shouldReload}`);

    const lastKnownStates = await safeGetFromStorage<ExtensionState[]>('lastKnownStates');
    if (!lastKnownStates || lastKnownStates.length === 0) {
      console.warn('No saved extension states found to restore');
      return;
    }

    console.log(`Restoring ${lastKnownStates.length} extension states`);

    let allRestored = true;
    for (const state of lastKnownStates) {
      if (state.enabled) {
        const success = await safeSetExtensionState(state.id, true);
        if (success) {
          logExtensionStateChange(state.id, state.name, true);
        } else {
          allRestored = false;
          console.warn(`Failed to enable extension: ${state.name || state.id}`);
        }
      }
    }

    if (!allRestored) {
      console.warn('Not all extensions were successfully restored');
    }

    // Verify extensions were restored correctly
    const verificationResult = await verifyExtensionStates(
      lastKnownStates.map(state => ({ id: state.id, enabled: state.enabled }))
    );

    if (!verificationResult) {
      console.warn('Extension state verification failed - not all extensions are in expected state');
    }

    // Reload the tab only if needed (switching between localhost and non-localhost)
    if (shouldReload) {
      console.log(`Reloading tab ${tabId}`);
      await chrome.tabs.reload(tabId);
    }
  } catch (error) {
    console.error('Error in restoreExtensions:', error);
  }
}
