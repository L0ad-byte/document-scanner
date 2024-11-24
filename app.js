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

// Import jsPDF
const { jsPDF } = window.jspdf;

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
    // Check for mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      alert('Your browser does not support media devices.');
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const cameraList = document.getElementById('cameraList');

    // Clear existing options
    cameraList.innerHTML = '';

    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraList.appendChild(option);
    });

    if (videoDevices.length > 0) {
      selectedDeviceId = videoDevices[0].deviceId;
      startCamera(selectedDeviceId);
      document.getElementById('status').innerText = '';
    } else {
      document.getElementById('status').innerText = 'No cameras found on this device.';
    }

    cameraList.addEventListener('change', (event) => {
      selectedDeviceId = event.target.value;
      startCamera(selectedDeviceId);
    });
  } catch (error) {
    console.error('Error getting cameras:', error);
    document.getElementById('status').innerText = 'Error accessing cameras. Please ensure you have granted camera permissions.';
  }
}

// Start camera
async function startCamera(deviceId) {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }
  try {
    const constraints = {
      video: { deviceId: deviceId ? { exact: deviceId } : undefined, facingMode: 'environment' },
      audio: false
    };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoElement = document.getElementById('video');
    videoElement.srcObject = videoStream;
    videoElement.play();
    document.getElementById('status').innerText = '';
  } catch (error) {
    console.error('Error accessing camera:', error);
    document.getElementById('status').innerText = 'Error accessing camera. Please ensure you have granted camera permissions.';
  }
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('captureButton').addEventListener('click', () => {
    const docType = document.getElementById('documentType').value;
    captureImage(docType);
  });

  // Settings button event listener
  document.getElementById('settingsButton').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('hidden');
  });

  // Close settings panel
  document.getElementById('closeSettingsButton').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.add('hidden');
  });

  // Clear cache and data
  document.getElementById('clearCacheButton').addEventListener('click', () => {
    clearCacheAndData();
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
  const imageData = canvas.toDataURL('image/png');
  saveImage(docType, imageData);
  postCaptureOptions();
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

// Upload images by compiling them into a PDF
function uploadImages() {
  if (imagesToUpload.length === 0) {
    console.log('No images to upload');
    return;
  }

  // Create a new PDF document
  const pdfDoc = new jsPDF();

  imagesToUpload.forEach((image, index) => {
    const base64Img = image.imageData;

    // Add image to PDF
    pdfDoc.addImage(base64Img, 'PNG', 10, 10, 190, 0); // Adjust dimensions as needed

    // Add a new page if not the last image
    if (index < imagesToUpload.length - 1) {
      pdfDoc.addPage();
    }
  });

  // Generate PDF as a Blob
  const pdfBlob = pdfDoc.output('blob');

  // Upload the PDF to Google Drive
  uploadPdfToAppsScript(pdfBlob);
}

// Function to upload PDF to Apps Script
function uploadPdfToAppsScript(pdfBlob) {
  const scriptURL = 'https://script.google.com/macros/s/AKfycbxh7lXPqfkONnh7rod1eLNU0SKyVnYPg6R2CgGSulPnWGvvjESIG17Ow5ogZNoQQkR10g/exec';

  const formData = new FormData();
  formData.append('file', pdfBlob, `Documents_${new Date().toISOString()}.pdf`);

  fetch(scriptURL, {
    method: 'POST',
    body: formData,
  })
  .then(response => response.text())
  .then(result => {
    console.log('Server response:', result);
    alert('Documents uploaded successfully.');
    // Clear the images array after successful upload
    imagesToUpload = [];
  })
  .catch(error => {
    console.error('Error uploading PDF:', error);
    alert('Error uploading documents.');
  });
}

// Function to clear cache and data
function clearCacheAndData() {
  if (confirm('Are you sure you want to clear cache and data?')) {
    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) {
          caches.delete(name);
        }
      });
    }

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Clear imagesToUpload array
    imagesToUpload = [];

    alert('Cache and data cleared. Please reload the app.');
  }
}
