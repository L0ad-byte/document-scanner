// app.js

// Initialize variables and DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.getElementById('captureButton');
const saveButton = document.getElementById('saveButton');
const uploadButton = document.getElementById('uploadButton');
const viewLogsButton = document.getElementById('viewLogsButton');
const clearCacheButton = document.getElementById('clearCacheButton');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const logPanel = document.getElementById('log-panel');
const logContent = document.getElementById('log-content');
const clearLogsButton = document.getElementById('clearLogsButton');
const logOverlay = document.getElementById('log-overlay');
const documentTypeSelect = document.getElementById('documentType');

let capturedImageData = '';

// Google Apps Script Web App URL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'; // TODO: Replace with your Web App URL

// Logging variables
let logs = []; // Array to store log messages

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initCamera();
  populateCameraOptions();
  setupClearCache();
  setupViewLogs();
  setupClearLogs();
});

/**
 * Function to log messages
 * @param {string} message - The message to log
 */
function log(message) {
  const timestamp = new Date().toLocaleString();
  const logMessage = `[${timestamp}] ${message}`;
  logs.push(logMessage);
  console.log(logMessage);
  
  // If log panel is open, append the log
  if (logPanel.style.width === '400px') {
    appendLog(logMessage);
  }
}

/**
 * Function to append a single log message to the log panel
 * @param {string} message - The message to append
 */
function appendLog(message) {
  const p = document.createElement('p');
  p.textContent = message;
  logContent.appendChild(p);
  // Scroll to the bottom
  logContent.scrollTop = logContent.scrollHeight;
}

/**
 * Initialize camera
 */
async function initCamera() {
  log('Initializing camera...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    log('Camera initialized successfully.');
  } catch (error) {
    log(`Error initializing camera: ${error}`);
    alert('Unable to access the camera.');
  }
}

/**
 * Populate Camera Options (Front and Back)
 */
function populateCameraOptions() {
  log('Populating camera options...');
  navigator.mediaDevices.enumerateDevices()
    .then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      if (videoDevices.length === 0) {
        log('No camera devices found.');
        alert('No camera devices found.');
        return;
      }

      const cameraOptions = document.getElementById('cameraOptions');
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${index + 1}`;
        cameraOptions.appendChild(option);
        log(`Camera option added: ${option.text}`);
      });

      // Optionally, set the first camera as default
      if (videoDevices.length > 0) {
        startCamera(videoDevices[0].deviceId);
      }
    })
    .catch(error => {
      log(`Error enumerating devices: ${error}`);
      alert('Error accessing camera devices.');
    });
}

/**
 * Start Camera Stream
 * @param {string} deviceId - The device ID of the camera to start
 */
function startCamera(deviceId) {
  log(`Starting camera with device ID: ${deviceId}`);
  const constraints = {
    video: {
      deviceId: { exact: deviceId }
    },
    audio: false
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      video.srcObject = stream;
      log('Camera stream started successfully.');
    })
    .catch(error => {
      log(`Error starting camera: ${error}`);
      alert('Unable to access the selected camera.');
    });
}

/**
 * Capture Image and Apply Monochrome Filter
 */
captureButton.addEventListener('click', () => {
  log('Capture button clicked.');
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw the current frame from the video onto the canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  log('Image captured from video stream.');

  // Get image data
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  // Apply monochrome filter
  for (let i = 0; i < data.length; i += 4) {
    let grayscale = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    data[i] = data[i + 1] = data[i + 2] = grayscale;
  }
  context.putImageData(imageData, 0, 0);
  log('Monochrome filter applied to the image.');

  // Convert canvas to image and display in preview
  capturedImageData = canvas.toDataURL('image/png');
  const img = new Image();
  img.src = capturedImageData;
  img.alt = documentTypeSelect.value;
  img.style.width = '100%';
  img.style.maxWidth = '600px';
  img.style.border = '1px solid #ccc';
  img.style.borderRadius = '10px';
  document.getElementById('preview').innerHTML = '';
  document.getElementById('preview').appendChild(img);
  log('Captured image displayed in preview.');
});

/**
 * Save Captured Image to IndexedDB (Optional)
 */
saveButton.addEventListener('click', () => {
  log('Save & Next button clicked.');
  // Implement saving to IndexedDB or other storage if required
  alert('Save functionality is not implemented in this integration.');
});

/**
 * Upload Image to Google Drive via GAS
 */
uploadButton.addEventListener('click', async () => {
  if (!capturedImageData) {
    alert('Please capture an image first.');
    return;
  }

  log('Upload to Google Drive button clicked.');
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageData: capturedImageData,
        documentType: documentTypeSelect.value
      })
    });

    const result = await response.json();

    if (result.success) {
      log(`Upload successful. File URL: ${result.url}`);
      alert('Image uploaded successfully to Google Drive.');
    } else {
      log(`Upload failed: ${result.error}`);
      alert('Failed to upload image. Please check the logs.');
    }
  } catch (error) {
    log(`Error uploading document: ${error}`);
    alert('Error uploading document. Please check the logs.');
  }
});

/**
 * Menu Toggle Function
 */
function toggleSidebar() {
  log('Toggling sidebar.');
  sidebar.style.width = (sidebar.style.width === '250px') ? '0' : '250px';
  overlay.style.display = (overlay.style.display === 'block') ? 'none' : 'block';
}

/**
 * Log Panel Toggle Function
 */
function toggleLogPanel() {
  log('Toggling log panel.');
  if (logPanel.style.width === '400px') {
    logPanel.style.width = '0';
    logOverlay.style.display = 'none';
  } else {
    logPanel.style.width = '400px';
    logOverlay.style.display = 'block';
    // Populate log content
    logContent.innerHTML = ''; // Clear existing logs
    logs.forEach(msg => appendLog(msg));
  }
}

/**
 * Setup View Logs Button
 */
function setupViewLogs() {
  viewLogsButton.addEventListener('click', () => {
    log('View Logs button clicked.');
    toggleLogPanel();
  });
}

/**
 * Setup Clear Cache Button
 */
function setupClearCache() {
  clearCacheButton.addEventListener('click', async () => {
    log('Clear Cache button clicked.');
    const confirmClear = confirm('Are you sure you want to clear the cache and all stored images?');
    if (!confirmClear) {
      log('Cache clearing canceled by user.');
      return;
    }

    try {
      // Clear Service Worker Cache
      log('Attempting to delete service worker cache...');
      const cacheDeleted = await caches.delete('document-scanner-cache-v1');
      if (cacheDeleted) {
        log('Service Worker cache cleared successfully.');
      } else {
        log('No matching cache found to delete.');
      }

      // Clear IndexedDB (if implemented)
      // Implement IndexedDB clearing if applicable

      // Clear Logs
      log('Clearing accumulated logs.');
      logs = [];
      logContent.innerHTML = '';

      alert('Cache and stored images have been cleared.');

      // Close Sidebar and Overlay
      toggleSidebar();
    } catch (error) {
      log(`Error clearing cache: ${error}`);
      alert('Failed to clear cache.');
    }
  });
}

/**
 * Clear Logs Function
 */
function clearLogs() {
  log('Clear Logs button clicked.');
  logs = [];
  logContent.innerHTML = '';
  log('All logs have been cleared.');
}

/**
 * Setup Clear Logs Button
 */
function setupClearLogs() {
  clearLogsButton.addEventListener('click', () => {
    clearLogs();
  });
}
