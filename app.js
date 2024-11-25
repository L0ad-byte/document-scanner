// app.js

// Initialize variables and DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.getElementById('captureButton');
const saveButton = document.getElementById('saveButton');
const uploadButton = document.getElementById('uploadButton');
const preview = document.getElementById('preview');
const cameraOptions = document.getElementById('cameraOptions');
const documentTypeSelect = document.getElementById('documentType');
const clearCacheButton = document.getElementById('clearCacheButton'); // Added
const sidebar = document.getElementById('sidebar'); // Added
const overlay = document.getElementById('overlay'); // Added

// IndexedDB variables
let db;

// Google API Credentials (Replace with your actual Client ID and API Key)
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const API_KEY = 'YOUR_GOOGLE_API_KEY';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const CACHE_NAME = 'document-scanner-cache-v1'; // Ensure this matches service-worker.js

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initDB();
  populateCameraOptions();
  initGoogleAPI();
  setupClearCache();
});

// Initialize IndexedDB
function initDB() {
  const request = indexedDB.open('DocumentScannerDB', 1);

  request.onerror = (event) => {
    console.error('IndexedDB error:', event.target.errorCode);
  };

  request.onsuccess = (event) => {
    db = event.target.result;
    console.log('IndexedDB initialized.');
  };

  request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
    objectStore.createIndex('documentType', 'documentType', { unique: false });
    console.log('IndexedDB object store created.');
  };
}

// Populate Camera Options (Front and Back)
async function populateCameraOptions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraOptions.appendChild(option);
    });

    // Start video with the first available camera
    if (videoDevices.length > 0) {
      startCamera(videoDevices[0].deviceId);
    } else {
      alert('No camera devices found.');
    }
  } catch (error) {
    console.error('Error accessing media devices.', error);
    alert('Error accessing camera devices.');
  }
}

// Start Camera Stream
async function startCamera(deviceId) {
  const constraints = {
    video: {
      deviceId: { exact: deviceId }
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  } catch (error) {
    console.error('Error starting camera:', error);
    alert('Unable to access the selected camera.');
  }
}

// Handle Camera Selection Change
cameraOptions.addEventListener('change', (event) => {
  const selectedDeviceId = event.target.value;
  if (selectedDeviceId) {
    startCamera(selectedDeviceId);
  }
});

// Capture Image and Apply Monochrome Filter
captureButton.addEventListener('click', () => {
  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw the current frame from the video onto the canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Get image data
  let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let data = imageData.data;

  // Apply monochrome filter
  for (let i = 0; i < data.length; i += 4) {
    let grayscale = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    data[i] = data[i + 1] = data[i + 2] = grayscale;
  }
  context.putImageData(imageData, 0, 0);

  // Convert canvas to image and display in preview
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.alt = documentTypeSelect.value;
  preview.appendChild(img);
});

// Save Captured Image to IndexedDB
saveButton.addEventListener('click', () => {
  const imgData = canvas.toDataURL('image/png');
  const documentType = documentTypeSelect.value;

  const transaction = db.transaction(['images'], 'readwrite');
  const objectStore = transaction.objectStore('images');
  const request = objectStore.add({ documentType: documentType, image: imgData });

  request.onsuccess = () => {
    console.log('Image saved locally.');
    alert('Image saved successfully.');
    preview.innerHTML = ''; // Clear preview
  };

  request.onerror = (event) => {
    console.error('Error saving image:', event.target.errorCode);
    alert('Failed to save image.');
  };
});

// Initialize Google API Client
function initGoogleAPI() {
  gapi.load('client:auth2', () => {
    gapi.client.init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      scope: SCOPES
    }).then(() => {
      console.log('Google API client initialized.');
      // Listen for sign-in state changes.
      gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

      // Handle the initial sign-in state.
      updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    }, (error) => {
      console.error('Error initializing Google API client:', error);
    });
  });
}

// Update UI based on Sign-in Status
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    console.log('User is signed in.');
  } else {
    console.log('User is not signed in.');
  }
}

// Upload PDF to Google Drive
uploadButton.addEventListener('click', async () => {
  const isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();

  if (!isSignedIn) {
    try {
      await gapi.auth2.getAuthInstance().signIn();
    } catch (error) {
      console.error('Error signing in:', error);
      alert('Failed to sign in to Google.');
      return;
    }
  }

  // Generate PDF from stored images
  const pdfBlob = await generatePDF();

  // Upload the PDF to Google Drive
  uploadToGoogleDrive(pdfBlob);
});

// Generate PDF from Images in IndexedDB
async function generatePDF() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['images'], 'readonly');
    const objectStore = transaction.objectStore('images');
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
      const images = event.target.result;
      if (images.length === 0) {
        alert('No images to upload.');
        reject('No images found.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      images.forEach((img, index) => {
        if (index > 0) {
          doc.addPage();
        }
        const imgProps = doc.getImageProperties(img.image);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(img.image, 'PNG', 0, 0, pdfWidth, pdfHeight);
      });

      // Generate PDF as Blob
      const pdfBlob = doc.output('blob');
      resolve(pdfBlob);
    };

    request.onerror = (event) => {
      console.error('Error retrieving images from IndexedDB:', event.target.errorCode);
      reject(event.target.errorCode);
    };
  });
}

// Upload Blob to Google Drive
function uploadToGoogleDrive(blob) {
  const metadata = {
    'name': `documents_${new Date().toISOString()}.pdf`, // File name
    'mimeType': 'application/pdf'
  };

  const accessToken = gapi.auth.getToken().access_token;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  }).then(response => response.json())
    .then(data => {
      console.log('File uploaded successfully. File ID:', data.id);
      alert('PDF uploaded to Google Drive successfully.');
      // Optionally, clear IndexedDB after successful upload
      clearIndexedDB();
    })
    .catch(error => {
      console.error('Error uploading file:', error);
      alert('Failed to upload PDF to Google Drive.');
    });
}

// Clear IndexedDB after Upload
function clearIndexedDB() {
  const transaction = db.transaction(['images'], 'readwrite');
  const objectStore = transaction.objectStore('images');
  const request = objectStore.clear();

  request.onsuccess = () => {
    console.log('IndexedDB cleared.');
    preview.innerHTML = '';
  };

  request.onerror = (event) => {
    console.error('Error clearing IndexedDB:', event.target.errorCode);
  };
}

// Menu Toggle Function
function toggleSidebar() {
  sidebar.style.width = (sidebar.style.width === '250px') ? '0' : '250px';
  overlay.style.display = (overlay.style.display === 'block') ? 'none' : 'block';
}

// Setup Clear Cache Button
function setupClearCache() {
  clearCacheButton.addEventListener('click', async () => {
    const confirmClear = confirm('Are you sure you want to clear the cache and all stored images?');
    if (!confirmClear) return;

    try {
      // Clear Service Worker Cache
      const cacheDeleted = await caches.delete(CACHE_NAME);
      if (cacheDeleted) {
        console.log('Service Worker cache cleared.');
      } else {
        console.warn('No matching cache found to clear.');
      }

      // Clear IndexedDB
      clearIndexedDB();

      alert('Cache and stored images have been cleared.');

      // Close Sidebar and Overlay
      toggleSidebar();
      
      // Optionally, unregister the service worker and reload
      /*
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
          console.log('Service Worker unregistered.');
        }
      }
      window.location.reload();
      */
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache.');
    }
  });
}
