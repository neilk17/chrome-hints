// Listen for the keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'activate-hints') {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        // Send a message to the content script
        chrome.tabs.sendMessage(tabs[0].id, { action: 'activateHints' });
      }
    });
  }
});