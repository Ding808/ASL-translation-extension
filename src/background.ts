// Import shared types
import { RecordingState, CommandResponse } from './types';

// Initial recording state
const recordingState: RecordingState = {
  isRecording: false,
  serverUrl: '',
  recordedChunks: []
};

// Log when service worker is installed and activated
self.addEventListener('install', (event) => {
  console.log('Service worker installed');
  // Use type assertion to fix TypeScript error
  (self as any).skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startRecording':
      // In our new approach, we'll just store the state and let popup handle the capture
      recordingState.isRecording = true;
      recordingState.serverUrl = message.serverUrl;
      recordingState.recordedChunks = [];
      notifyContentScripts(true);
      sendResponse({ success: true });
      return false;

    case 'stopRecording':
      // Just update the state
      recordingState.isRecording = false;
      notifyContentScripts(false);
      sendResponse({ success: true });
      return false;

    case 'getRecordingState':
      sendResponse({
        isRecording: recordingState.isRecording,
        serverUrl: recordingState.serverUrl
      });
      return false; // Synchronous response
      
    case 'addRecordingData':
      // Store data chunks sent from the popup
      if (message.data && message.data.size > 0) {
        recordingState.recordedChunks.push(message.data);
        sendResponse({ success: true, count: recordingState.recordedChunks.length });
      } else {
        sendResponse({ success: false, error: 'No data provided' });
      }
      return false;
      
    case 'completeRecording':
      storeRecording();
      cleanupRecording();
      sendResponse({ success: true });
      return false;
  }
});

// Store the recording (previously sendRecordingToServer)
function storeRecording(): void {
  if (recordingState.recordedChunks.length === 0) {
    console.warn('No recording data to store');
    return;
  }

  // Create a Blob from the recorded chunks
  const recordedBlob = new Blob(recordingState.recordedChunks, {
    type: 'video/webm'
  });

  console.log(`Recording complete: ${(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB`);
  
  // For now, we're just storing in memory and logging the size
  // In a future version, we could:
  // 1. Save to IndexedDB
  // 2. Create a download link
  // 3. Send to a server if desired
}

// Clean up recording resources
function cleanupRecording(): void {
  // Reset recording state
  recordingState.isRecording = false;
  recordingState.serverUrl = '';
  recordingState.recordedChunks = [];
}

// Notify all content scripts about recording status
function notifyContentScripts(isRecording: boolean): void {
  // Query for all tabs
  chrome.tabs.query({}, (tabs) => {
    // Send message to each tab
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'recordingStatus',
          isRecording
        }).catch(error => {
          // Ignore errors - content script might not be loaded in all tabs
          console.debug(`Could not send message to tab ${tab.id}:`, error);
        });
      }
    });
  });
}