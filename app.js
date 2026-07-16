/* ==========================================================================
   BinScan Core Application Logic - Client-side OCR Scanner & QR Generator
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- UI Elements ---
  const tabCamera = document.getElementById('tab-camera');
  const tabManual = document.getElementById('tab-manual');
  const cameraContent = document.getElementById('camera-content');
  const manualContent = document.getElementById('manual-content');
  
  const video = document.getElementById('webcam');
  const viewfinderContainer = document.querySelector('.viewfinder-container');
  const viewfinderOverlay = document.getElementById('viewfinder-overlay');
  const overlayMsg = document.getElementById('overlay-msg');
  const btnActivateCamera = document.getElementById('btn-activate-camera');
  const btnStopCamera = document.getElementById('btn-stop-camera');
  const btnCapture = document.getElementById('btn-capture');
  const toggleAutoscan = document.getElementById('toggle-autoscan');
  
  const cameraStatusDot = document.querySelector('#camera-status .status-dot');
  const cameraStatusLabel = document.querySelector('#camera-status .status-label');
  const ocrBadge = document.getElementById('ocr-status-indicator');
  const ocrBadgeText = document.getElementById('ocr-badge-text');
  const ocrDot = ocrBadge.querySelector('.status-dot');
  
  const ocrLoader = document.getElementById('ocr-loader');
  const loaderStatusText = document.getElementById('loader-status');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const ocrFeedbackMessage = document.getElementById('ocr-feedback-message');
  const detectedChipsSection = document.getElementById('detected-chips-section');
  const chipsContainer = document.getElementById('chips-container');
  
  const manualInput = document.getElementById('manual-input');
  const btnClearInput = document.getElementById('btn-clear-input');
  
  const qrCanvas = document.getElementById('qr-canvas');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  const sticker = document.getElementById('label-sticker');
  const stickerCodeDisplay = document.getElementById('sticker-code-display');
  const stickerTimestampVal = document.getElementById('sticker-timestamp-val');
  const stickerIdVal = document.getElementById('sticker-id-val');
  
  const btnDownload = document.getElementById('btn-download');
  const btnCopy = document.getElementById('btn-copy');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const recentList = document.getElementById('recent-list');
  const emptyHistoryMsg = document.getElementById('empty-history-msg');
  const toastNotification = document.getElementById('toast-notification');
  
  const captureCanvas = document.getElementById('capture-canvas');

  // --- State Variables ---
  let activeStream = null;
  let streamActive = false;
  let tesseractWorker = null;
  let isOcrBusy = false;
  let autoScanInterval = null;
  let currentGeneratedCode = "";
  let sessionHistory = [];
  let toastTimeout = null;

  // --- 1. Tab Switching & Initialization ---
  tabCamera.addEventListener('click', () => {
    switchTab('camera');
  });

  tabManual.addEventListener('click', () => {
    switchTab('manual');
  });

  function switchTab(mode) {
    if (mode === 'camera') {
      tabCamera.classList.add('active');
      tabManual.classList.remove('active');
      cameraContent.classList.add('active');
      manualContent.classList.remove('active');
    } else {
      tabManual.classList.add('active');
      tabCamera.classList.remove('active');
      manualContent.classList.add('active');
      cameraContent.classList.remove('active');
      // Pause active auto-scan when navigating away to conserve resources
      if (toggleAutoscan.checked) {
        toggleAutoscan.checked = false;
        stopAutoScan();
      }
    }
  }

  // --- 2. Tesseract OCR Engine Setup ---
  async function initTesseract() {
    ocrDot.className = 'status-dot dot-loading';
    ocrBadgeText.innerText = 'OCR: WARMING';
    showOcrFeedback("Initializing OCR Engine (loading engine from CDN)...", false);

    try {
      // Initialize Tesseract.js v5 worker
      tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const percent = Math.round(m.progress * 100);
            updateOcrProgress(m.progress, `Analyzing frame text: ${percent}%`);
          } else {
            // E.g., 'loading language traineddata', 'initializing api'
            const msg = m.status ? m.status.replaceAll('_', ' ') : 'processing';
            const progressVal = typeof m.progress === 'number' ? m.progress : 0.2;
            updateOcrProgress(progressVal, `OCR Engine: ${msg}...`);
          }
        }
      });

      ocrDot.className = 'status-dot dot-active';
      ocrBadgeText.innerText = 'OCR: READY';
      showOcrFeedback("OCR engine ready. Start camera to begin scanning.", false, true);

      // If camera was started before OCR was ready, enable camera scanner controls
      if (streamActive) {
        btnCapture.disabled = false;
        toggleAutoscan.disabled = false;
      }
    } catch (err) {
      console.error("Tesseract Engine Initialization Error:", err);
      ocrDot.className = 'status-dot dot-inactive';
      ocrBadgeText.innerText = 'OCR: ERROR';
      showOcrFeedback("OCR Engine failed to initialize. Please use Manual Mode or reload.", true);
    }
  }

  // --- 3. Camera Access ---
  async function startCamera() {
    viewfinderOverlay.classList.remove('hidden');
    viewfinderOverlay.style.opacity = '1';
    overlayMsg.innerHTML = '<span class="status-dot dot-loading"></span> Connecting camera...';
    btnActivateCamera.disabled = true;

    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (innerErr) {
        console.warn("Ideal camera constraints failed, attempting fallback camera selection", innerErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      video.srcObject = stream;
      activeStream = stream;
      streamActive = true;

      // Force video play
      await video.play();

      // UI states
      viewfinderOverlay.classList.add('hidden');
      cameraStatusDot.className = 'status-dot dot-active';
      cameraStatusLabel.innerText = 'CAM: ON';
      btnStopCamera.disabled = false;
      btnActivateCamera.disabled = true;
      viewfinderContainer.classList.add('scanning-active');

      // Enable scanner triggers only if OCR engine is ready
      if (tesseractWorker) {
        btnCapture.disabled = false;
        toggleAutoscan.disabled = false;
      } else {
        showOcrFeedback("Camera active. Waiting for OCR engine to finish loading...", false);
      }

    } catch (err) {
      console.error("Webcam Access Error:", err);
      cameraStatusDot.className = 'status-dot dot-inactive';
      cameraStatusLabel.innerText = 'CAM: BLOCKED';
      btnActivateCamera.disabled = false;

      let errorMsg = "Camera access denied.";
      if (err.name === 'NotAllowedError') {
        errorMsg = "Camera permission denied. Please allow camera permissions in your browser.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = "No webcam device detected on this system.";
      }
      
      overlayMsg.innerHTML = `${errorMsg}<br><span style="font-size:12px; color:var(--accent-red); display:block; margin-top:8px;">Switch to 'MANUAL ENTRY' tab above to type codes.</span>`;
    }
  }

  function stopCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    activeStream = null;
    streamActive = false;

    // Turn off auto-scan loop
    if (toggleAutoscan.checked) {
      toggleAutoscan.checked = false;
      stopAutoScan();
    }

    // UI resets
    viewfinderOverlay.classList.remove('hidden');
    viewfinderOverlay.style.opacity = '1';
    overlayMsg.innerText = "Camera is inactive";
    btnActivateCamera.disabled = false;
    btnStopCamera.disabled = true;
    btnCapture.disabled = true;
    toggleAutoscan.disabled = true;
    
    cameraStatusDot.className = 'status-dot dot-inactive';
    cameraStatusLabel.innerText = 'CAM: OFF';
    viewfinderContainer.classList.remove('scanning-active');
  }

  btnActivateCamera.addEventListener('click', startCamera);
  btnStopCamera.addEventListener('click', stopCamera);

  // --- 4. OCR Scanning & Pattern Detection ---
  btnCapture.addEventListener('click', performOCR);

  async function performOCR() {
    if (isOcrBusy || !tesseractWorker || !streamActive) return;
    
    isOcrBusy = true;
    ocrLoader.classList.remove('hidden');
    updateOcrProgress(0, "Grabbing frame...");

    try {
      const ctx = captureCanvas.getContext('2d');
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      captureCanvas.width = w;
      captureCanvas.height = h;

      // Draw active frame to canvas
      ctx.drawImage(video, 0, 0, w, h);

      // Preprocessing (Grayscale + Threshold contrast adjustment for higher OCR hitrate)
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Dynamic thresholding (Contrast boost)
        const contrastFactor = 1.6;
        const factor = (259 * (contrastFactor + 255)) / (255 * (259 - contrastFactor));
        const finalVal = factor * (gray - 128) + 128;
        
        d[i] = finalVal;
        d[i+1] = finalVal;
        d[i+2] = finalVal;
      }
      ctx.putImageData(imgData, 0, 0);

      updateOcrProgress(0.1, "Recognizing location codes...");
      
      // Perform OCR
      const result = await tesseractWorker.recognize(captureCanvas);
      const text = result.data.text || "";
      console.log("OCR raw output: ", text);

      // Regex matching for code patterns
      const upperOCR = text.toUpperCase();
      const codeRegex = /\b[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){2,7}\b/g;
      const foundMatches = upperOCR.match(codeRegex) || [];
      
      // Filter out duplicate matches in the single frame
      const uniqueMatches = Array.from(new Set(foundMatches));

      handleOCRMatches(uniqueMatches);

    } catch (err) {
      console.error("OCR recognition error:", err);
      showOcrFeedback("Error processing frame. Ensure code is well-lit and centered.", true);
    } finally {
      isOcrBusy = false;
      ocrLoader.classList.add('hidden');
    }
  }

  function handleOCRMatches(matches) {
    chipsContainer.innerHTML = '';
    
    if (matches.length === 0) {
      showOcrFeedback("No matching code detected in frame. (Looking for patterns like A0-123-B)", false);
      detectedChipsSection.classList.add('hidden');
      return;
    }

    // Success! Show feedback
    showOcrFeedback(`Detected ${matches.length} code(s). Click a chip to generate QR.`, false, true);
    detectedChipsSection.classList.remove('hidden');

    matches.forEach(code => {
      const chip = document.createElement('button');
      chip.className = 'code-chip';
      chip.title = `Generate QR code for ${code}`;
      chip.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        ${code}
      `;
      chip.addEventListener('click', () => {
        confirmAndSelectCode(code);
      });
      chipsContainer.appendChild(chip);
    });

    // Auto-scan hands-free behavior:
    // If auto-scan is active and exactly ONE code is found, select it automatically and stop scanner
    if (toggleAutoscan.checked && matches.length === 1) {
      const singleCode = matches[0];
      confirmAndSelectCode(singleCode);
      stopAutoScan();
      showOcrFeedback(`Auto-scan: Code confirmed [${singleCode}]`, false, true);
    }
  }

  function confirmAndSelectCode(code) {
    manualInput.value = code;
    generateQR(code);
    playScanBeep();
    triggerHapticVibration();
  }

  // --- 5. Auto-scan Loop ---
  toggleAutoscan.addEventListener('change', () => {
    if (toggleAutoscan.checked) {
      startAutoScan();
    } else {
      stopAutoScan();
    }
  });

  function startAutoScan() {
    showOcrFeedback("Auto-scan active. Scanning frames every 2.5s...", false, true);
    // Trigger first capture instantly
    performOCR();
    
    autoScanInterval = setInterval(() => {
      if (!isOcrBusy && streamActive) {
        performOCR();
      }
    }, 2500);
  }

  function stopAutoScan() {
    if (autoScanInterval) {
      clearInterval(autoScanInterval);
      autoScanInterval = null;
    }
    toggleAutoscan.checked = false;
    showOcrFeedback("Auto-scan stopped. Continuous scanning inactive.", false);
  }

  function updateOcrProgress(progress, text) {
    loaderStatusText.innerText = text;
    progressBarFill.style.width = `${Math.min(Math.max(progress, 0), 1) * 100}%`;
  }

  function showOcrFeedback(msg, isErr = false, isSuccess = false) {
    ocrFeedbackMessage.innerText = msg;
    ocrFeedbackMessage.className = 'ocr-feedback-message';
    if (isErr) {
      ocrFeedbackMessage.classList.add('error');
    } else if (isSuccess) {
      ocrFeedbackMessage.classList.add('success');
    }
  }

  // --- 6. Manual Entry Mode ---
  btnClearInput.addEventListener('click', () => {
    manualInput.value = '';
    generateQR('');
    manualInput.focus();
  });

  // Debounced input handler (300ms delay)
  let manualInputTimeout;
  manualInput.addEventListener('input', (e) => {
    clearTimeout(manualInputTimeout);
    let val = e.target.value.trim().toUpperCase();
    
    // Auto capitalize user typed text in input
    e.target.value = val;

    manualInputTimeout = setTimeout(() => {
      generateQR(val);
    }, 300);
  });

  // --- 7. QR Code Label Renderer ---
  function generateQR(text) {
    if (!text) {
      // Clear visual state
      qrCanvas.style.display = 'none';
      qrPlaceholder.style.display = 'flex';
      stickerCodeDisplay.innerText = "AWAITING VALUE";
      stickerTimestampVal.innerText = "YYYY-MM-DD HH:MM";
      stickerIdVal.innerText = "AWAITING";
      
      btnDownload.disabled = true;
      btnCopy.disabled = true;
      currentGeneratedCode = "";
      return;
    }

    qrCanvas.style.display = 'block';
    qrPlaceholder.style.display = 'none';

    // Generate Timestamp
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    
    // Generate Serial Label ID
    const shortId = createChecksum(text);

    // Assign text updates to label HTML elements
    stickerCodeDisplay.innerText = text;
    stickerTimestampVal.innerText = timeFormatted;
    stickerIdVal.innerText = shortId;

    // Render QR Code onto the Canvas element
    QRCode.toCanvas(qrCanvas, text, {
      width: 256,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    }, function (err) {
      if (err) {
        console.error("QRCode rendering canvas error:", err);
        showOcrFeedback("QR code error: Value too long or invalid parameters.", true);
      } else {
        btnDownload.disabled = false;
        btnCopy.disabled = false;
        
        // Add to history list if it's new
        if (text !== currentGeneratedCode) {
          addToHistory(text, timeFormatted);
        }
        currentGeneratedCode = text;
        
        // Flash animation trigger on new generation
        sticker.classList.remove('sticker-flash');
        sticker.offsetWidth; // Trigger DOM reflow
        sticker.style.animation = 'none';
        sticker.offsetHeight; // trigger reflow
        sticker.style.animation = 'sticker-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      }
    });
  }

  function createChecksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash).toString(36).substring(0, 5).toUpperCase();
  }

  // --- 8. Export Features (Download & Copy) ---
  btnDownload.addEventListener('click', () => {
    if (!currentGeneratedCode) return;

    // Download only the QR code canvas directly
    const url = qrCanvas.toDataURL('image/png');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.download = `QR_${currentGeneratedCode}.png`;
    downloadAnchor.href = url;
    downloadAnchor.click();
    showToast("QR code PNG download started");
  });

  btnCopy.addEventListener('click', () => {
    if (!currentGeneratedCode) return;

    navigator.clipboard.writeText(currentGeneratedCode)
      .then(() => {
        showToast("Code text copied to clipboard!");
      })
      .catch(err => {
        console.error("Clipboard copy error:", err);
        showToast("Copy failed. Please manually select and copy text.");
      });
  });

  function showToast(msg) {
    toastNotification.innerText = msg;
    toastNotification.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 2500);
  }

  // --- 9. In-Memory Session History ---
  function addToHistory(text, time) {
    // Remove if code exists already to push to top
    sessionHistory = sessionHistory.filter(item => item.text !== text);
    
    // Add item
    sessionHistory.unshift({ text, time });

    // Limit length to 8 entries
    if (sessionHistory.length > 8) {
      sessionHistory.pop();
    }

    renderHistory();
  }

  function renderHistory() {
    recentList.innerHTML = '';
    
    if (sessionHistory.length === 0) {
      recentList.appendChild(emptyHistoryMsg);
      emptyHistoryMsg.style.display = 'block';
      return;
    }

    emptyHistoryMsg.style.display = 'none';

    sessionHistory.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'recent-item';
      
      // Format time showing HH:MM
      const timeOnly = item.time.split(' ')[1] || item.time;

      itemEl.innerHTML = `
        <span class="recent-item-text">${item.text}</span>
        <div class="recent-item-meta">
          <span class="recent-item-time">${timeOnly}</span>
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="recent-item-arrow">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        manualInput.value = item.text;
        generateQR(item.text);
        
        // Brief scan success tone on history reload
        playScanBeep();
      });

      recentList.appendChild(itemEl);
    });
  }

  btnClearHistory.addEventListener('click', () => {
    sessionHistory = [];
    renderHistory();
  });

  // --- 10. Web Audio API Scanner Sound Beep Generator ---
  function playScanBeep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime); // 1.4kHz high pitch tone
      
      // Dynamic gain curve to avoid pops
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.12); // Duration 120ms
    } catch (e) {
      console.warn("Unable to generate audio context scanner sound:", e);
    }
  }

  // --- 11. Haptic Vibrate Feedback ---
  function triggerHapticVibration() {
    if (navigator.vibrate) {
      navigator.vibrate(80); // Quick haptic tick
    }
  }

  // --- 12. Run Startup Initialization ---
  initTesseract();
  generateQR(""); // Warm up placeholder layout
});
