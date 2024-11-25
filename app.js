// Check for browser support
if (!('serviceWorker' in navigator)) {
  alert('Service workers are not supported by this browser');
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => log('Service Worker registered', reg))
    .catch(err => log('Service Worker registration failed', err));
}

// Variables
let videoStream;
let selectedDeviceId;
let imagesToUpload = [];
let idNumber = '';
let logs = ''; // Store logs

// Custom log function to store logs
function log(...args) {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  console.log(message);
  logs += message + '\n';
}

// On page load
window.addEventListener('load', () => {
  log('Page loaded');
  getCameras();
  setupEventListeners();
  window.addEventListener('online', () => {
    log('Browser is online');
    if (imagesToUpload.length > 0) {
      uploadImages();
    }
  });
});

// Get list of cameras
async function getCameras() {
  try {
    log('Getting list of cameras');
    // Check for mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      alert('Your browser does not support media devices.');
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    // Filter for video input devices
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    // Filter for rear cameras
    const rearCameras = [];
    for (let device of videoDevices) {
      if (device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear')) {
        rearCameras.push(device);
      }
    }

    // If no rear cameras found, use all video devices
    const camerasToUse = rearCameras.length > 0 ? rearCameras : videoDevices;

    const cameraList = document.getElementById('cameraList');

    // Clear existing options
    cameraList.innerHTML = '';

    camerasToUse.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraList.appendChild(option);
    });

    if (camerasToUse.length > 0) {
      selectedDeviceId = camerasToUse[0].deviceId;
      startCamera(selectedDeviceId);
      document.getElementById('status').innerText = '';
    } else {
      document.getElementById('status').innerText = 'No cameras found on this device.';
    }

    cameraList.addEventListener('change', (event) => {
      selectedDeviceId = event.target.value;
      log('Selected camera deviceId:', selectedDeviceId);
      startCamera(selectedDeviceId);
    });
  } catch (error) {
    log('Error getting cameras:', error);
    document.getElementById('status').innerText = 'Error accessing cameras. Please ensure you have granted camera permissions.';
  }
}

// Start camera
async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    log('Stopped previous video stream');
  }
  try {
    log('Starting camera with deviceId:', deviceId);
    const constraints = {
      video: { deviceId: { exact: deviceId } },
      audio: false
    };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoElement = document.getElementById('video');
    videoElement.srcObject = videoStream;
    videoElement.play();
    document.getElementById('status').innerText = '';
    log('Camera started successfully');
  } catch (error) {
    log('Error accessing camera:', error);
    document.getElementById('status').innerText = 'Error accessing camera. Please ensure you have granted camera permissions.';
  }
}

// Setup event listeners
function setupEventListeners() {
  log('Setting up event listeners');
  document.getElementById('captureButton').addEventListener('click', () => {
    log('Capture button clicked');
    captureImage();
  });

  // Settings button event listener
  document.getElementById('settingsButton').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('hidden');
    log('Settings panel opened');
  });

  // Close settings panel
  document.getElementById('closeSettingsButton').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.add('hidden');
    log('Settings panel closed');
  });

  // Clear cache and data
  document.getElementById('clearCacheButton').addEventListener('click', () => {
    clearCacheAndData();
  });

  // Show logs
  document.getElementById('showLogsButton').addEventListener('click', () => {
    document.getElementById('logsTextArea').value = logs;
    document.getElementById('logsPanel').classList.remove('hidden');
    log('Logs panel opened');
  });

  // Close logs panel
  document.getElementById('closeLogsButton').addEventListener('click', () => {
    document.getElementById('logsPanel').classList.add('hidden');
    log('Logs panel closed');
  });

  // ID Number Input Formatting
  const idInput = document.getElementById('idNumber');
  idInput.addEventListener('input', formatIDNumber);
}

// Format ID Number Input
function formatIDNumber() {
  let input = this.value.replace(/\D/g, ''); // Remove non-digit characters
  if (input.length > 13) input = input.substring(0, 13);
  const formatted = input.replace(/(\d{6})(\d{4})(\d{2})(\d{1})/, '$1 $2 $3 $4');
  this.value = formatted;
  idNumber = input; // Store unformatted ID number for validation and file naming
}

// Capture image
function captureImage() {
  log('Capturing image');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = canvas.toDataURL('image/png').split(',')[1]; // Get Base64 string without data URL prefix

  // Get selected document type
  const docType = document.getElementById('documentType').value;

  log('Image captured, imageData length:', imageData.length);
  saveImage(imageData, docType);
  postCaptureOptions();
}

// Save image
function saveImage(imageData, docType) {
  imagesToUpload.push({ imageData, docType });
  log(`Image saved for ${docType}, total images to upload: ${imagesToUpload.length}`);
}

// Post capture options
function postCaptureOptions() {
  const proceed = confirm('Do you want to capture another document? Click OK to capture another, or Cancel to upload.');
  if (proceed) {
    log('User chose to capture another document');
    // Do nothing, allow user to capture another document
  } else {
    log('User chose to upload documents');
    if (navigator.onLine) {
      uploadImages();
    } else {
      alert('You are offline. Images will be uploaded when you are back online.');
      log('Browser is offline, cannot upload images now');
    }
  }
}

// Upload images to Apps Script
function uploadImages() {
  if (imagesToUpload.length === 0) {
    log('No images to upload');
    return;
  }

  // Validate ID Number
  if (idNumber.length !== 13) {
    alert('Please enter a valid 13-digit ID number.');
    log('Invalid ID number');
    return;
  }

  log('Uploading images, total images:', imagesToUpload.length);

  try {
    // Prepare the payload
    const payload = {
      idNumber: idNumber,
      imagesData: JSON.stringify(imagesToUpload),
    };

    const scriptURL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'; // Replace with your Apps Script URL

    log('Sending POST request to Apps Script with form data');
    fetch(scriptURL, {
      method: 'POST',
      mode: 'cors', // Ensure CORS mode is set
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(payload),
    })
    .then(response => {
      log('Fetch response status:', response.status);
      log('Fetch response headers:', JSON.stringify([...response.headers]));
      return response.text().then(result => {
        log('Server response:', result);
        if (result.trim() === 'Success') {
          alert('Documents uploaded successfully.');
          // Clear the images array after successful upload
          imagesToUpload = [];
          log('Images array cleared after successful upload');
        } else {
          log('Server returned an error:', result);
          alert('Error uploading documents. Server error: ' + result);
        }
      });
    })
    .catch(error => {
      log('Error uploading images:', error);
      console.error('Fetch error:', error);
      alert('Error uploading documents. Network error: ' + (error.message || error));
    });

  } catch (error) {
    log('Error preparing images for upload:', error);
    alert('Error preparing images for upload.');
  }
}

// Function to clear cache and data
function clearCacheAndData() {
  if (confirm('Are you sure you want to clear cache and data?')) {
    log('Clearing cache and data');
    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) {
          caches.delete(name).then(() => {
            log('Cache deleted:', name);
          });
        }
      });
    }

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister().then(() => {
            log('Service worker unregistered');
          });
        }
      });
    }

    // Clear imagesToUpload array
    imagesToUpload = [];
    log('Images array cleared');

    alert('Cache and data cleared. Please reload the app.');
  } else {
    log('User canceled cache and data clearing');
  }
}
