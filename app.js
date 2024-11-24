// Check for browser support
if (!('serviceWorker' in navigator)) {
  alert('Service workers are not supported by this browser');
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker registered', reg))
    .catch(err => console.error('Service Worker registration failed', err));
}

// Variables
let videoStream;
let selectedDeviceId;
let imagesToUpload = [];

// On page load
window.addEventListener('load', () => {
  getCameras();
  setupEventListeners();
  window.addEventListener('online', () => {
    if (imagesToUpload.length > 0) {
      uploadImages();
    }
  });
});

// Get list of cameras
async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const cameraList = document.getElementById('cameraList');
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraList.appendChild(option);
    });
    if (videoDevices.length > 0) {
      selectedDeviceId = videoDevices[0].deviceId;
      startCamera(selectedDeviceId);
    }
    cameraList.addEventListener('change', (event) => {
      selectedDeviceId = event.target.value;
      startCamera(selectedDeviceId);
    });
  } catch (error) {
    console.error('Error getting cameras:', error);
  }
}

// Start camera
async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  try {
    const constraints = {
      video: { deviceId: { exact: deviceId } }
    };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoElement = document.getElementById('video');
    videoElement.srcObject = videoStream;
  } catch (error) {
    console.error('Error accessing camera:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('captureButton').addEventListener('click', () => {
    const docType = document.getElementById('documentType').value;
    captureImage(docType);
  });
}

// Capture image
function captureImage(docType) {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  convertToMonochrome(canvas, ctx);
  const imageData = canvas.toDataURL('image/png');
  saveImage(docType, imageData);
  postCaptureOptions();
}

// Convert image to monochrome
function convertToMonochrome(canvas, ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for(let i = 0; i < data.length; i += 4) {
    // Grayscale conversion
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    // Monochrome conversion
    const mono = avg > 128 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = mono;
  }
  ctx.putImageData(imageData, 0, 0);
}

// Save image
function saveImage(docType, imageData) {
  imagesToUpload.push({ docType, imageData });
  console.log(`Image saved for ${docType}`);
}

// Post capture options
function postCaptureOptions() {
  const proceed = confirm('Do you want to capture another document? Click OK to capture another, or Cancel to upload.');
  if (proceed) {
    // Do nothing, allow user to select and capture another document
  } else {
    if (navigator.onLine) {
      uploadImages();
    } else {
      alert('You are offline. Images will be uploaded when you are back online.');
    }
  }
}

// Upload images to Google Apps Script
function uploadImages() {
  if (imagesToUpload.length === 0) {
    console.log('No images to upload');
    return;
  }
  imagesToUpload.forEach((image, index) => {
    uploadImageToAppsScript(image, index);
  });
}

function uploadImageToAppsScript(image, index) {
  const scriptURL = 'https://script.google.com/macros/s/AKfycbyuQ4RJdL8zVYA0mVg34CBjYl_oqT7Y2-frR4M33JF_9wFVf-nvTOdkDYVgaF3kYxanHw/exec'; // Replace with your Apps Script URL

  const form = new FormData();
  form.append('docType', image.docType);
  form.append('imageData', image.imageData.split(',')[1]); // Remove data URL prefix

  fetch(scriptURL, {
    method: 'POST',
    body: form,
  })
  .then(response => response.text())
  .then(result => {
    console.log('Image uploaded to Apps Script');
    // Remove uploaded image from the array
    imagesToUpload.splice(index, 1);
  })
  .catch(error => {
    console.error('Error uploading image:', error);
  });
}
