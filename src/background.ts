import { config } from './config';
import { RecordingState } from './types';

let backgroundIsRecording = false;
let activeTabId: number | undefined = undefined;
let contentScriptReady = false;
let lastPrediction: string = '';

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.id) {
    activeTabId = tabs[0].id;
    injectContentScript(activeTabId);
    
    chrome.storage.local.get(['recordingState'], (result) => {
      if (result.recordingState && result.recordingState.isRecording) {
        backgroundIsRecording = true;
      }
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;
  contentScriptReady = false;
  injectContentScript(activeTabId);
});

async function injectContentScript(tabId: number) {
  try {
    chrome.tabs.sendMessage(
      tabId,
      { action: 'pingContentScript' },
      (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).then(() => {
            setTimeout(() => pingContentScript(tabId), 500);
          }).catch(err => {
            console.error('Error injecting content script:', err);
          });
        } else {
          contentScriptReady = true;
        }
      }
    );
  } catch (error) {
    console.error('Error checking content script status:', error);
  }
}

function pingContentScript(tabId: number) {
  try {
    chrome.tabs.sendMessage(
      tabId, 
      { action: 'pingContentScript' },
      (response) => {
        if (chrome.runtime.lastError) {
          contentScriptReady = false;
        } else if (response?.success) {
          contentScriptReady = true;
        }
      }
    );
  } catch (error) {
    contentScriptReady = false;
  }
}

function updateRecordingState(isRecording: boolean) {
  backgroundIsRecording = isRecording;
  
  const recordingState: RecordingState = {
    isRecording,
    serverUrl: config.ROBOFLOW_API_URL || '',
    recordedChunks: []
  };
  
  chrome.storage.local.set({ recordingState });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'contentScriptReady':
      contentScriptReady = true;
      if (sender.tab?.id) {
        activeTabId = sender.tab.id;
      }
      sendResponse({ success: true });
      break;
      
    case 'startRecording':
      updateRecordingState(true);
      
      if (activeTabId) {
        injectContentScript(activeTabId);
        
        setTimeout(() => {
          chrome.tabs.sendMessage(
            activeTabId!,
            { action: 'startRecording' },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error starting recording:', chrome.runtime.lastError.message);
              }
            }
          );
          
          if (message.showCaptions) {
            chrome.tabs.sendMessage(
              activeTabId!,
              { action: 'showCaptions', show: message.showCaptions }
            );
          }
        }, 500);
      }
      sendResponse({ success: true });
      break;

    case 'stopRecording':
      updateRecordingState(false);
      
      if (activeTabId) {
        chrome.tabs.sendMessage(
          activeTabId,
          { action: 'stopRecording' }
        );
      }
      sendResponse({ success: true });
      break;
      
    case 'recordingStarted':
      updateRecordingState(true);
      sendResponse({ success: true });
      break;
      
    case 'recordingStopped':
      updateRecordingState(false);
      sendResponse({ success: true });
      break;
      
    case 'checkRecordingState':
      sendResponse({ 
        isRecording: backgroundIsRecording,
        prediction: lastPrediction
      });
      break;
      
    case 'getLastPrediction':
      sendResponse({ success: true, prediction: lastPrediction });
      break;

    case 'processFrame':
      if (!backgroundIsRecording) {
        sendResponse({ success: false, error: 'Not recording' });
        return true;
      }
      
      handleFrame(message.frame, sender.tab?.id)
        .catch(error => {
          console.error('Error in handleFrame:', error);
        });
        
      sendResponse({ success: true, processing: true });
      break;

    case 'toggleCaptions':
      if (activeTabId) {
        chrome.tabs.sendMessage(
          activeTabId,
          { action: 'showCaptions', show: message.enabled }
        );
      }
      sendResponse({ success: true });
      break;
  }
  return true;
});

async function handleFrame(base64Data: string, tabId?: number) {
  try {
    if (!tabId) return;
    
    const apiUrl = config.ROBOFLOW_API_URL
    const apiKey = config.ROBOFLOW_API_KEY

    if (!apiUrl || !apiKey) return chrome.runtime.sendMessage({ action: 'error', error: 'API URL or API Key not set' });
    
    const params = new URLSearchParams({ api_key: apiKey });
    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64Data
    });

    if (!response.ok) return;

    const jsonData = await response.json();
    
    let result = "No prediction";

    if (jsonData?.predictions?.length > 0) {
      result = jsonData.predictions[0].class;
      
      lastPrediction = result;
      
      chrome.storage.local.set({ lastPrediction: result });
      
      chrome.runtime.sendMessage({
        action: 'newPrediction',
        prediction: result
      }).catch(() => {});
    }

    chrome.tabs.sendMessage(
      tabId,
      { action: 'updateCaptions', text: result }
    );

  } catch (error) {
    console.error('Error processing frame:', error);
  }
}