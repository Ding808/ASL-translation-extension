// Import shared types
import { RecordingState, CommandResponse } from './types';

// DOM Elements
const startButton = document.getElementById('startRecording') as HTMLButtonElement;
const stopButton = document.getElementById('stopRecording') as HTMLButtonElement;
const videoPreview = document.getElementById('videoPreview') as HTMLVideoElement;
const statusElement = document.getElementById('status') as HTMLDivElement;

// Track stream and recorder state
let currentStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;

// Initialize UI state
document.addEventListener('DOMContentLoaded', async () => {
  // Check current recording state
  chrome.runtime.sendMessage({ action: 'getRecordingState' }, (response: RecordingState) => {
    updateUIState(response.isRecording);
    
    // If already recording, start a new preview stream
    if (response.isRecording) {
      startScreenCapture();
    } else {
      statusElement.textContent = 'Click "Start Recording" to begin';
    }
  });
});

// Start recording
startButton.addEventListener('click', async () => {
  try {
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
        
        // Start the media recorder
        if (mediaRecorder) {
          mediaRecorder.start(1000); // Collect data every second
        }
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

// Stop recording
stopButton.addEventListener('click', () => {
  // Stop the media recorder first
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    // We'll notify the background script in the onstop handler
  } else {
    // If no media recorder, just update state
    chrome.runtime.sendMessage({ action: 'stopRecording' }, (response) => {
      if (response && response.success) {
        updateUIState(false);
        statusElement.textContent = 'Recording stopped';
        statusElement.classList.remove('recording');
        stopScreenCapture();
      } else {
        statusElement.textContent = response?.error || 'Failed to stop recording';
      }
    });
  }
});

// Update UI based on recording state
function updateUIState(isRecording: boolean): void {
  startButton.disabled = isRecording;
  stopButton.disabled = !isRecording;
  
  if (isRecording) {
    statusElement.textContent = 'Recording in progress...';
    statusElement.classList.add('recording');
  } else {
    statusElement.classList.remove('recording');
  }
}

// Set up media recorder
function setupMediaRecorder(stream: MediaStream): void {
  try {
    // Create media recorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    
    // Set up event handlers
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        // Send data to background script
        chrome.runtime.sendMessage({ 
          action: 'addRecordingData', 
          data: event.data 
        });
      }
    };
    
    mediaRecorder.onstop = () => {
      // Notify background script that recording is complete
      chrome.runtime.sendMessage({ action: 'completeRecording' }, (response) => {
        if (response && response.success) {
          updateUIState(false);
          statusElement.textContent = 'Recording completed';
          statusElement.classList.remove('recording');
        }
      });
      
      // Clean up
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
    // Request user to select a screen/window to share
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always' as any
      },
      audio: false
    });
    
    // Display the stream in the video element
    videoPreview.srcObject = stream;
    currentStream = stream;
    
    // Handle when user stops sharing via the browser UI
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      stopScreenCapture();
      // If we're recording, stop that too
      if (!stopButton.disabled) {
        stopButton.click();
      }
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
  // Stop media recorder if running
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  
  // Stop all tracks in the stream
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
  videoPreview.srcObject = null;
}