chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "login") {
    // Find the tab that sent the message
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      // Send a message to the content script to trigger the login process
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: () => {
          // Trigger the login process here, such as submitting the login form
        },
      });
    });
  }
});

chrome.runtime.onStartup.addListener(() => {});
