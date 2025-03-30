// Import shared types
import { RecordingState, CommandResponse } from './types';
// Import config for API credentials
import { config } from './config';

// DOM Elements
const startButton = document.getElementById('startInterpreting') as HTMLButtonElement;
const videoPreview = document.getElementById('videoPreview') as HTMLVideoElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const aiResultElement = document.getElementById('aiResult') as HTMLDivElement;

// Track stream and recorder state
let currentStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
// Timer ID, used to call the AI ​​screenshot function every second
let aiInterval: number | undefined;
let isRecording = false;

// Initialize UI state
document.addEventListener('DOMContentLoaded', async () => {
  // Check current recording state
  chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response: RecordingState) => {
    if (response) {
      updateUIState(response.isRecording);
      
      // If already recording, start a new preview stream
      if (response.isRecording) {
        startScreenCapture();
      }
    }
  });
});

// Start recording
startButton.addEventListener('click', async () => {
  try {
    if (isRecording) {
      // If already recording, stop
      stopScreenCaptureAndRecording();
      return;
    }
    
    // Start screen capture for preview
    const stream = await startScreenCapture();
    if (!stream) {
      throw new Error('Failed to get screen capture stream');
    }
    
    // Set up media recorder in the popup
    setupMediaRecorder(stream);
    
    // Send message to background script to update recording state
    chrome.runtime.sendMessage({ 
      action: 'startRecording',
      serverUrl: 'preview-only'
    }, (response) => {
      if (response && response.success) {
        updateUIState(true);
        statusElement.textContent = 'Recording started';
        statusElement.classList.add('recording');
        
        // Start the media recorder (every second collect the data)
        if (mediaRecorder) {
          mediaRecorder.start(1000);
        }
        
        // Take a screenshot every 1 second and call the AI ​​API
        aiInterval = window.setInterval(captureScreenshotAndCallAPI, 1000);
      } else {
        stopScreenCapture();
        statusElement.textContent = response?.error || 'Failed to start recording';
      }
    });
  } catch (error) {
    console.error('Error starting recording:', error);
    statusElement.textContent = error instanceof Error ? error.message : 'Unknown error starting recording';
  }
});

// Update UI based on recording state
function updateUIState(recording: boolean): void {
  isRecording = recording;
  
  if (recording) {
    startButton.textContent = 'STOP INTERPRETING';
    statusElement.classList.remove('hidden');
    statusElement.textContent = 'Interpreting in progress...';
    statusElement.classList.add('recording');
    aiResultElement.classList.remove('hidden');
  } else {
    startButton.textContent = 'START INTERPRETING';
    statusElement.classList.add('hidden');
    aiResultElement.classList.add('hidden');
  }
}

// Set up media recorder
function setupMediaRecorder(stream: MediaStream): void {
  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chrome.runtime.sendMessage({ 
          action: 'addRecordingData', 
          data: event.data 
        });
      }
    };
    
    mediaRecorder.onstop = () => {
      chrome.runtime.sendMessage({ action: 'completeRecording' }, (response) => {
        if (response && response.success) {
          updateUIState(false);
          statusElement.textContent = 'Interpreting completed';
          statusElement.classList.remove('recording');
        }
      });
      
      stopScreenCapture();
    };
    
    mediaRecorder.onerror = (event) => {
      console.error('Media Recorder error:', event);
      statusElement.textContent = 'Recording error occurred';
      stopScreenCapture();
    };
  } catch (error) {
    console.error('Error setting up media recorder:', error);
    throw error;
  }
}

// Start screen capture for preview
async function startScreenCapture(): Promise<MediaStream | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always' as any
      },
      audio: false
    });
    
    videoPreview.srcObject = stream;
    currentStream = stream;
    
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenCaptureAndRecording();
    });
    
    return stream;
  } catch (error) {
    console.error('Error starting screen capture:', error);
    statusElement.textContent = 'Screen capture permission denied';
    return null;
  }
}

// Stop screen capture
function stopScreenCapture(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  videoPreview.srcObject = null;

  if (aiInterval) {
    clearInterval(aiInterval);
    aiInterval = undefined;
  }
}

// Stop screen capture and recording
function stopScreenCaptureAndRecording(): void {
  // Stop AI screenshot timer
  if (aiInterval) {
    clearInterval(aiInterval);
    aiInterval = undefined;
  }

  // Stop the media recorder first
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  } else {
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
      if (response && response.success) {
        updateUIState(false);
        statusElement.textContent = 'Interpreting stopped';
        statusElement.classList.remove('recording');
        stopScreenCapture();
      } else {
        statusElement.textContent = response?.error || 'Failed to stop recording';
      }
    });
  }
}

/**
* Called once per second: Take a screenshot from videoPreview and call the Roboflow AI API,
* Extract the predicted class value from the returned data and update the plugin interface display
 */
async function captureScreenshotAndCallAPI(): Promise<void> {
  if (!videoPreview || videoPreview.videoWidth === 0 || videoPreview.videoHeight === 0) {
    console.error('Video not ready for screenshot');
    return;
  }
  
  // Use canvas to get the current frame screenshot
  const canvas = document.createElement('canvas');
  canvas.width = videoPreview.videoWidth;
  canvas.height = videoPreview.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    return;
  }
  ctx.drawImage(videoPreview, 0, 0, canvas.width, canvas.height);
  
  // Get the image data in Base64 format (remove the "data:image/png;base64," prefix)
  const dataUrl = canvas.toDataURL('image/png');
  const base64Data = dataUrl.split(',')[1];

  try {
    const apiUrl = config.ROBOFLOW_API_URL;
    const apiKey = config.ROBOFLOW_API_KEY;
    const params = new URLSearchParams({ api_key: apiKey });
    
    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64Data
    });
    
    const jsonData = await response.json();
    // Extract the class value of the first predicted object in the prediction result according to the return structure of Roboflow API
    let classValue = "";
    if (jsonData && jsonData.predictions && jsonData.predictions.length > 0) {
      classValue = jsonData.predictions[0].class;
    } else {
      classValue = "No prediction";
    }
    
    // Update ai result in the screen
    aiResultElement.textContent = `AI: ${classValue}`;
  } catch (error) {
    console.error('Error calling AI API', error);
  }
}
