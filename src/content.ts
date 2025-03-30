let contentIsRecording = false;
let captureStream: MediaStream | null = null;
let videoElement: HTMLVideoElement | null = null;
let captionElement: HTMLDivElement | null = null;

initializeContentScript();

function initializeContentScript() {
  try {
    chrome.runtime.sendMessage({
      action: 'contentScriptReady'
    });
  } catch (err) {
    console.error('Failed to notify background script:', err);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message.action) {
        case 'startRecording':
          startRecording().then(() => {
            sendResponse({ success: true });
          }).catch(error => {
            console.error('Error in startRecording:', error);
            sendResponse({ success: false, error: error.message });
          });
          break;

        case 'stopRecording':
          stopRecording();
          sendResponse({ success: true });
          break;

        case 'showCaptions':
          toggleCaptions(message.show);
          sendResponse({ success: true });
          break;

        case 'updateCaptions':
          updateCaptionText(message.text);
          sendResponse({ success: true });
          break;
        
        case 'pingContentScript':
          sendResponse({ success: true, message: 'Content script is active' });
          break;

        case 'error':
          console.error('Error from background script:', message.error);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    return true;
  });
}

async function startRecording() {
  try {
    if (contentIsRecording) return;

    captureStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true,
      audio: false 
    });

    videoElement = document.createElement('video');
    videoElement.srcObject = captureStream;
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);
    
    await videoElement.play();
    
    contentIsRecording = true;
    
    try {
      chrome.runtime.sendMessage({
        action: 'recordingStarted'
      });
    } catch (err) {
      console.error('Failed to notify background of recording start:', err);
    }
    
    captureAndSendFrames();

    captureStream.getVideoTracks()[0].onended = () => {
      stopRecording();
    };

    toggleCaptions(true);

  } catch (error) {
    console.error('Failed to start recording:', error);
    stopRecording();
    throw error;
  }
}

function stopRecording() {
  contentIsRecording = false;
  
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
    captureStream = null;
  }

  if (videoElement) {
    videoElement.pause();
    if (videoElement.srcObject) {
      videoElement.srcObject = null;
    }
    videoElement.remove();
    videoElement = null;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'recordingStopped'
    });
  } catch (err) {
    console.error('Failed to notify background of recording stop:', err);
  }
  
  toggleCaptions(false);
}

function captureAndSendFrames() {
  if (!contentIsRecording || !videoElement) {
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      
      context?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      try {
        const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        chrome.runtime.sendMessage({
          action: 'processFrame',
          frame: base64Data
        });
      } catch (error) {
        console.error('Error capturing frame:', error);
      }
    }

    if (contentIsRecording) {
      setTimeout(() => captureAndSendFrames(), 1000);
    }
  } catch (error) {
    console.error('Error in captureAndSendFrames:', error);
    if (contentIsRecording) {
      setTimeout(() => captureAndSendFrames(), 1000);
    }
  }
}

function toggleCaptions(show: boolean) {
  const existingCaption = document.getElementById('aslInterpreterCaptions');
  if (existingCaption) existingCaption.remove();
  
  if (show) {
    captionElement = document.createElement('div');
    captionElement.id = 'aslInterpreterCaptions';
    captionElement.style.cssText = `
      position: fixed;
      bottom: 50px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 20px;
      z-index: 10000;
      transition: opacity 0.3s;
    `;
    captionElement.textContent = 'ASL Interpreter ready...';
    document.body.appendChild(captionElement);
  } else {
    captionElement = null;
  }
}

function updateCaptionText(text: string) {
  const caption = document.getElementById('aslInterpreterCaptions');
  if (caption) {
    caption.textContent = text;
    caption.style.background = 'rgba(0, 128, 255, 0.8)';
    setTimeout(() => {
      if (caption) {
        caption.style.background = 'rgba(0, 0, 0, 0.7)';
      }
    }, 300);
  } else {
    toggleCaptions(true);
    updateCaptionText(text);
  }
}