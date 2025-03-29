// src/popup.ts
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "ASL_RESULT") {
      const resultDiv = document.getElementById("result");
      if (resultDiv) {
        resultDiv.textContent = message.data;
      }
    }
  });
  