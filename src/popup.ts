const startButton = document.getElementById('startInterpreting') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const captionsToggle = document.getElementById('captionsToggle') as HTMLInputElement;
const aiResultElement = document.getElementById('aiResult') as HTMLDivElement;

let popupIsRecording = false;

document.addEventListener('DOMContentLoaded', () => {
  startButton.addEventListener('click', toggleRecording);

  captionsToggle.addEventListener('change', (e) => {
    const enabled = (e.target as HTMLInputElement).checked;
    chrome.runtime.sendMessage({ 
      action: 'toggleCaptions', 
      enabled 
    });
  });
  
  checkRecordingState();
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'newPrediction') {
      showPrediction(message.prediction);
    }
    return true;
  });
});

function checkRecordingState() {
  chrome.storage.local.get(['recordingState', 'lastPrediction'], (result) => {
    if (result.recordingState && result.recordingState.isRecording) {
      updateUI(true);
      
      if (result.lastPrediction) {
        showPrediction(result.lastPrediction);
      }
    } else {
      chrome.runtime.sendMessage({ action: 'checkRecordingState' }, (response) => {
        if (response && response.isRecording) {
          updateUI(true);
          
          if (response.prediction) {
            showPrediction(response.prediction);
          }
        }
      });
    }
  });
}

async function toggleRecording() {
  try {
    if (popupIsRecording) {
      chrome.runtime.sendMessage({ action: 'stopRecording' });
      updateUI(false);
    } else {
      chrome.runtime.sendMessage({ 
        action: 'startRecording',
        showCaptions: captionsToggle.checked
      });
      updateUI(true);
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus('Error: ' + (error instanceof Error ? error.message : String(error)));
  }
}

function updateUI(recording: boolean) {
  popupIsRecording = recording;
  startButton.textContent = recording ? 'STOP INTERPRETING' : 'START INTERPRETING';
  showStatus(recording ? 'Interpreting active...' : '');
  
  if (recording) {
    aiResultElement.classList.remove('hidden');
    startButton.classList.add('stop-button');
    startButton.classList.remove('start-button');
  } else {
    aiResultElement.classList.add('hidden');
    startButton.classList.add('start-button');
    startButton.classList.remove('stop-button');
  }
}

function showStatus(message: string) {
  if (message) {
    statusElement.textContent = message;
    statusElement.classList.remove('hidden');
  } else {
    statusElement.classList.add('hidden');
  }
}

function showPrediction(prediction: string) {
  aiResultElement.textContent = prediction;
  aiResultElement.classList.remove('hidden');
}
