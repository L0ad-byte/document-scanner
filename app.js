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
let idNumber = '';

// On page load
window.addEventListener('load', () => {
  console.log('Page loaded');
  getCameras();
  setupEventListeners();
  window.addEventListener('online', () => {
    console.log('Browser is online');
    if (imagesToUpload.length > 0) {
      uploadImages();
    }
  });
});

// Get list of cameras
async function getCameras() {
  try {
    console.log('Getting list of cameras');
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
      console.log('Selected camera deviceId:', selectedDeviceId);
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
    console.log('Stopped previous video stream');
  }
  try {
    console.log('Starting camera with deviceId:', deviceId);
    const constraints = {
      video: { deviceId: { exact: deviceId } },
      audio: false
    };
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    const videoElement = document.getElementById('video');
    videoElement.srcObject = videoStream;
    videoElement.play();
    document.getElementById('status').innerText = '';
    console.log('Camera started successfully');
  } catch (error) {
    console.error('Error accessing camera:', error);
    document.getElementById('status').innerText = 'Error accessing camera. Please ensure you have granted camera permissions.';
  }
}

// Setup event listeners
function setupEventListeners() {
  console.log('Setting up event listeners');
  document.getElementById('captureButton').addEventListener('click', () => {
    console.log('Capture button clicked');
    captureImage();
  });

  // Settings button event listener
  document.getElementById('settingsButton').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('hidden');
    console.log('Settings panel opened');
  });

  // Close settings panel
  document.getElementById('closeSettingsButton').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.add('hidden');
    console.log('Settings panel closed');
  });

  // Clear cache and data
  document.getElementById('clearCacheButton').addEventListener('click', () => {
    clearCacheAndData();
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
  console.log('Capturing image');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = canvas.toDataURL('image/png');

  // Get selected document type
  const docType = document.getElementById('documentType').value;

  console.log('Image captured, imageData length:', imageData.length);
  saveImage(imageData, docType);
  postCaptureOptions();
}

// Save image
function saveImage(imageData, docType) {
  imagesToUpload.push({ imageData, docType });
  console.log(`Image saved for ${docType}, total images to upload: ${imagesToUpload.length}`);
}

// Post capture options
function postCaptureOptions() {
  const proceed = confirm('Do you want to capture another document? Click OK to capture another, or Cancel to upload.');
  if (proceed) {
    console.log('User chose to capture another document');
    // Do nothing, allow user to capture another document
  } else {
    console.log('User chose to upload documents');
    if (navigator.onLine) {
      uploadImages();
    } else {
      alert('You are offline. Images will be uploaded when you are back online.');
      console.log('Browser is offline, cannot upload images now');
    }
  }
}

// Upload images by compiling them into a PDF
function uploadImages() {
  if (imagesToUpload.length === 0) {
    console.log('No images to upload');
    return;
  }

  // Validate ID Number
  if (idNumber.length !== 13) {
    alert('Please enter a valid 13-digit ID number.');
    console.log('Invalid ID number');
    return;
  }

  console.log('Uploading images, total images:', imagesToUpload.length);

  try {
    // Create a new PDF document
    const pdfDoc = new jsPDF();

    imagesToUpload.forEach((item, index) => {
      const { imageData, docType } = item;
      console.log(`Adding image ${index + 1} to PDF, docType: ${docType}`);
      // Add image to PDF
      pdfDoc.addImage(imageData, 'PNG', 10, 30, 190, 0); // Adjust dimensions as needed
      // Add document type as text above the image
      pdfDoc.setFontSize(16);
      pdfDoc.text(docType, 105, 20, null, null, 'center');

      // Add a new page if not the last image
      if (index < imagesToUpload.length - 1) {
        pdfDoc.addPage();
      }
    });

    // Generate PDF as a Blob
    const pdfBlob = pdfDoc.output('blob');
    console.log('PDF generated, size:', pdfBlob.size);

    // Upload the PDF to Google Drive
    uploadPdfToAppsScript(pdfBlob, idNumber);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF.');
  }
}

// Function to upload PDF to Apps Script
function uploadPdfToAppsScript(pdfBlob, idNumber) {
  const scriptURL = 'https://script.google.com/macros/s/AKfycbxuJuRz-6N2KZ9cz7Fgp39V_OiyX7RVUSGLy_snQuHpSuLfZJhkrQdhHmUecmHcnmbYSg/exec'; // Updated with your new Apps Script URL

  console.log('Uploading PDF to Apps Script');
  const reader = new FileReader();
  reader.onloadend = function() {
    const base64data = reader.result.split(',')[1]; // Get the Base64 string without the data URL prefix
    console.log('PDF converted to Base64, length:', base64data.length);

    const formData = new FormData();
    const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); // Format date as dd-mm-yyyy
    const fileName = `${idNumber}_${dateStr}.pdf`;
    formData.append('fileName', fileName);
    formData.append('fileData', base64data);

    console.log('Sending POST request to Apps Script');
    fetch(scriptURL, {
      method: 'POST',
      body: formData,
    })
    .then(response => response.text())
    .then(result => {
      console.log('Server response:', result);
      if (result.trim() === 'Success') {
        alert('Documents uploaded successfully.');
        // Clear the images array after successful upload
        imagesToUpload = [];
        console.log('Images array cleared after successful upload');
      } else {
        console.error('Server returned an error:', result);
        alert('Error uploading documents. Server error: ' + result);
      }
    })
    .catch(error => {
      console.error('Error uploading PDF:', error);
      alert('Error uploading documents. Network error: ' + error.message);
    });
  };
  reader.onerror = function(error) {
    console.error('Error reading PDF Blob:', error);
    alert('Error reading PDF file.');
  };
  reader.readAsDataURL(pdfBlob);
}

// Function to clear cache and data
function clearCacheAndData() {
  if (confirm('Are you sure you want to clear cache and data?')) {
    console.log('Clearing cache and data');
    // Clear service worker cache
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (let name of names) {
          caches.delete(name).then(() => {
            console.log('Cache deleted:', name);
          });
        }
      });
    }

    // Unregister service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister().then(() => {
            console.log('Service worker unregistered');
          });
        }
      });
    }

    // Clear imagesToUpload array
    imagesToUpload = [];
    console.log('Images array cleared');

    alert('Cache and data cleared. Please reload the app.');
  } else {
    console.log('User canceled cache and data clearing');
  }
}
