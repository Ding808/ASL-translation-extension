// This content script can be used to inject UI elements or communicate with the page
// It runs in the context of the web page

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle any messages from background script if needed
  if (message.action === 'recordingStatus') {
    console.log('Recording status:', message.isRecording ? 'active' : 'inactive');
    
    // You could add UI indicators on the page to show recording status
    if (message.isRecording) {
      showRecordingIndicator();
    } else {
      removeRecordingIndicator();
    }
  }
  
  // Always return false if you don't need to send a response asynchronously
  return false;
});

// Function to show a recording indicator on the page
function showRecordingIndicator(): void {
  // Remove any existing indicator first
  removeRecordingIndicator();
  
  // Create a new recording indicator
  const indicator = document.createElement('div');
  indicator.id = 'screen-recording-indicator';
  indicator.style.position = 'fixed';
  indicator.style.top = '10px';
  indicator.style.right = '10px';
  indicator.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
  indicator.style.color = 'white';
  indicator.style.padding = '5px 10px';
  indicator.style.borderRadius = '4px';
  indicator.style.fontFamily = 'Arial, sans-serif';
  indicator.style.fontSize = '12px';
  indicator.style.zIndex = '9999';
  indicator.textContent = 'Recording';
  
  // Add a pulsing effect
  indicator.style.animation = 'pulse 1.5s infinite';
  
  // Add the indicator to the page
  document.body.appendChild(indicator);
  
  // Add the animation style
  const style = document.createElement('style');
  style.id = 'screen-recording-indicator-style';
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
  `;
  document.head.appendChild(style);
}

// Function to remove the recording indicator
function removeRecordingIndicator(): void {
  const indicator = document.getElementById('screen-recording-indicator');
  if (indicator) {
    indicator.remove();
  }
  
  const style = document.getElementById('screen-recording-indicator-style');
  if (style) {
    style.remove();
  }
}