// Configuration
const IDLE_THRESHOLD = 15; // seconds of inactivity before considered "idle"

// Helper function to safely send a message to a tab
function sendMessageToTab(tabId, message) {
  try {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      // We're just capturing the error, no need to handle it
      // This prevents the "receiving end does not exist" error from showing
    });
  } catch (error) {
    // Silently catch and ignore errors
    console.debug("Error sending message to tab:", error);
  }
}

// Listen for the keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'activate-hints') {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Send a message to the content script
        sendMessageToTab(tabs[0].id, { action: 'activateHints', mode: 'normal' });
      }
    });
  } else if (command === 'activate-hints-new-tab') {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Send a message to the content script
        sendMessageToTab(tabs[0].id, { action: 'activateHints', mode: 'newTab' });
      }
    });
  } else if (command === 'activate-hints-new-tab-switch') {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Send a message to the content script
        sendMessageToTab(tabs[0].id, { action: 'activateHints', mode: 'newTabSwitch' });
      }
    });
  }
});

// Set up idle detection
chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

// Monitor for state changes
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle') {
    // Get the active tab when browser becomes idle
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Tell content script to pre-compute clickable elements
        sendMessageToTab(tabs[0].id, { action: 'precomputeHints' });
      }
    });
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'openInNewTab') {
      // Alt+K: Open in new tab but don't switch to it
      console.log('Opening in new tab without switching:', message.url);
      chrome.tabs.create({
        url: message.url,
        active: false  // Don't switch to the new tab
      });
      sendResponse({ success: true });
    } else if (message.action === 'openAndSwitchToTab') {
      // Alt+L: Open in new tab and switch to it
      console.log('Opening in new tab and switching:', message.url);
      chrome.tabs.create({
        url: message.url,
        active: true  // Switch to the new tab
      });
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for the async response
});