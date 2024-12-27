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

    // Check current tab after installation
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab?.id && currentTab?.url) {
      const isLocalhost = currentTab.url.includes('localhost');
      if (isLocalhost) {
        await handleLocalhostTab(currentTab.id, true); // Reload on install if localhost
      }
    }
  }
});

export default defineBackground(() => {
  let lastTabWasLocalhost: boolean | null = null;

  // Check current tab when extension starts
  chrome.tabs.query({ active: true, currentWindow: true }, async ([currentTab]) => {
    if (currentTab?.id && currentTab?.url) {
      const isLocalhost = currentTab.url.includes('localhost');
      // On first load, reload if we're on localhost (need to disable extensions)
      const shouldReload = isLocalhost;
      lastTabWasLocalhost = isLocalhost;
      if (isLocalhost) {
        await handleLocalhostTab(currentTab.id, shouldReload);
      }
    }
  });

  // Listen for tab updates (URL changes)
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active) {
      const isLocalhost = changeInfo.url.includes('localhost');
      if (isLocalhost) {
        await handleLocalhostTab(tabId, false); // Don't reload on URL change
      } else {
        await restoreExtensions(tabId, false); // Don't reload on URL change
      }
    }
  });

  // Listen for tab activation (switching tabs)
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) {
      const isLocalhost = tab.url.includes('localhost');
      // Only reload if switching between localhost and non-localhost
      const shouldReload = lastTabWasLocalhost !== null && isLocalhost !== lastTabWasLocalhost;

      if (isLocalhost) {
        await handleLocalhostTab(tabId, shouldReload);
      } else {
        await restoreExtensions(tabId, shouldReload);
      }

      lastTabWasLocalhost = isLocalhost;
    }
  });

  // Listen for tab removal
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id && activeTab.url) {
      const isLocalhost = activeTab.url.includes('localhost');
      // Only reload if switching between localhost and non-localhost
      const shouldReload = lastTabWasLocalhost !== null && isLocalhost !== lastTabWasLocalhost;

      if (!isLocalhost) {
        await restoreExtensions(activeTab.id, shouldReload);
      }

      lastTabWasLocalhost = isLocalhost;
    }
  });
});

async function handleLocalhostTab(tabId: number, shouldReload: boolean) {
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

  // Reload the tab only if needed (switching between localhost and non-localhost)
  if (shouldReload) {
    await chrome.tabs.reload(tabId);
  }
}

async function restoreExtensions(tabId: number, shouldReload: boolean) {
  const { lastKnownStates } = await chrome.storage.local.get('lastKnownStates');
  if (lastKnownStates) {
    for (const state of lastKnownStates) {
      if (state.enabled) {
        await chrome.management.setEnabled(state.id, true);
      }
    }
    // Reload the tab only if needed (switching between localhost and non-localhost)
    if (shouldReload) {
      await chrome.tabs.reload(tabId);
    }
  }
}
