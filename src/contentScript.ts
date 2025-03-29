// src/contentScript.ts
// import * as tf from '@tensorflow/tfjs';

// let model: tf.LayersModel | null = null;

// async function loadModel() {
//   model = await tf.loadLayersModel("https://your-model-host/model.json");
// }

// loadModel();


function startTabCapture() {
    chrome.tabCapture.capture({ audio: false, video: true }, (stream) => {
      if (!stream) {
        console.error("Can't catch video");
        return;
      }

      const videoElement = document.createElement("video");
      videoElement.srcObject = stream;
      videoElement.play();
  

      videoElement.addEventListener("loadeddata", () => {
        processVideoStream(videoElement);
      });
    });
  }
  
  function processVideoStream(video: HTMLVideoElement) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    // every 100ms catch the image
    setInterval(() => {
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frameData = canvas.toDataURL("image/png");
      // using the image for ai to translate the language
      recognizeASL(frameData);
    }, 100);
  }
  
  function recognizeASL(frameData: string) {
    // use Tensorflow.js model here

    console.log("Process one frame of data:", frameData);

  }
  
//entrance
  startTabCapture();
  