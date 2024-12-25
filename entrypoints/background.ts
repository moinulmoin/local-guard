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
    if (currentTab?.id && currentTab?.url?.includes('localhost')) {
      await handleLocalhostTab(currentTab.id);
    }
  });

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      if (changeInfo.url.includes('localhost')) {
        await handleLocalhostTab(tabId);
      } else {
        await restoreExtensions(tabId);
      }
    }
  });

  // Listen for tab activation (switching tabs)
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url?.includes('localhost')) {
      await handleLocalhostTab(tabId);
    } else {
      await restoreExtensions(tabId);
    }
  });

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    // Check if the closed tab was the active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && !activeTab.url?.includes('localhost')) {
      await restoreExtensions(activeTab.id);
    }
  });
});

async function handleLocalhostTab(tabId: number) {
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

  // Reload the tab after disabling extensions
  await chrome.tabs.reload(tabId);
}

async function restoreExtensions(tabId: number) {
  const { lastKnownStates } = await chrome.storage.local.get('lastKnownStates');
  if (lastKnownStates) {
    for (const state of lastKnownStates) {
      if (state.enabled) {
        await chrome.management.setEnabled(state.id, true);
      }
    }
    // Reload the tab after restoring extensions
    await chrome.tabs.reload(tabId);
  }
}
