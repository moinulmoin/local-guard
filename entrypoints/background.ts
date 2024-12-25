

interface ExtensionState {
  id: string;
  enabled: boolean;
}

// Save initial extension states when extension is installed
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    console.log('Extension installed');

    const extensions = await chrome.management.getAll();
    const initialState = extensions
      .filter(ext => ext.id !== chrome.runtime.id)
      .map(ext => ({
        id: ext.id,
        enabled: ext.enabled
      }));

    await chrome.storage.local.set({ initialExtensionStates: initialState });
  }
});

export default defineBackground(() => {
  // Check current tab when extension starts
  chrome.tabs.query({ active: true, currentWindow: true }, async ([currentTab]) => {
    if (currentTab?.url?.includes('localhost')) {
      await handleLocalhostTab();
    }
  });

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      if (changeInfo.url.includes('localhost')) {
        await handleLocalhostTab();
      } else {
        await restoreExtensions();
      }
    }
  });

  // Listen for tab activation (switching tabs)
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url?.includes('localhost')) {
      await handleLocalhostTab();
    } else {
      await restoreExtensions();
    }
  });

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    // Check if the closed tab was the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && !activeTab.url?.includes('localhost')) {
      await restoreExtensions();
    }
  });
});

async function handleLocalhostTab() {
  // Get current extension states before disabling
  const extensions = await chrome.management.getAll();
  const currentState = extensions
    .filter(ext => ext.id !== chrome.runtime.id)
    .map(ext => ({
      id: ext.id,
      enabled: ext.enabled
    }));

  // Save current state
  await chrome.storage.local.set({ lastKnownStates: currentState });

  // Disable all extensions except our own
  for (const ext of extensions) {
    if (ext.id !== chrome.runtime.id && ext.enabled) {
      await chrome.management.setEnabled(ext.id, false);
    }
  }
}

async function restoreExtensions() {
  const { lastKnownStates } = await chrome.storage.local.get('lastKnownStates');
  if (lastKnownStates) {
    for (const state of lastKnownStates) {
      if (state.enabled) {
        await chrome.management.setEnabled(state.id, true);
      }
    }
  }
}
