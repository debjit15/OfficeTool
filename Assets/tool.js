// =======================================================
// CORE UI, CALCULATORS, AND PWA LOGIC
// Functions here run without internet/authentication.
// =======================================================

// --- Global UI State ---
let isAuthReady = false; 
let emiChart; 

// --- 1. UI Utility Functions ---

window.showToast = function(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    const toastHTML = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body fw-semibold">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>`;
    const toastElement = $(toastHTML);
    container.appendChild(toastElement[0]);
    const toast = new bootstrap.Toast(toastElement[0], { delay: 5000 });
    toast.show();
    toastElement.on('hidden.bs.toast', function () {
        toastElement.remove();
    });
};

window.enableTools = function() {
    $('#leadManageCard').removeClass('disabled-for-auth opacity-50')
        .removeAttr('title')
        .attr('data-bs-toggle', 'modal'); 
    $('#quickNoteFab').removeClass('d-none'); 
    $('#authRequiredBadge').addClass('d-none');
    $('#userProfileDisplay').removeClass('d-none');
    $('#googleSignInButtonContainer').addClass('d-none');
    isAuthReady = true;
};

window.disableTools = function() {
    $('#leadManageCard').addClass('disabled-for-auth opacity-50')
        .removeAttr('data-bs-toggle')
        .attr('title', 'Login required to use this tool.');
    $('#quickNoteFab').addClass('d-none'); 
    $('#authRequiredBadge').removeClass('d-none');
    $('#userProfileDisplay').addClass('d-none');
    $('#googleSignInButtonContainer').removeClass('d-none');
    isAuthReady = false;
};


// --- 2. Number-to-Words Conversion ---

function numberToIndianWords(n) {
    if (n === 0) return "Zero";
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ',
        'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ',
        'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    function inWords(num) {
        if ((num = num.toString()).length > 9) return 'overflow';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return;
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim();
    }
    return inWords(n).toUpperCase();
}


// --- 3. Denomination Tally Functions ---

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

function calculateTotalAmount() {
    let grandTotal = 0;
    $('#denominationTallyBody .note-count-input').each(function() {
        const count = parseInt($(this).val()) || 0;
        const noteValue = parseInt($(this).data('value'));
        const rowTotal = count * noteValue;
        $(this).closest('tr').find('.row-amount-display').text(rowTotal.toLocaleString('en-IN')); 
        grandTotal += rowTotal;
    });
    $('#grandTotalDisplay').html(`₹${grandTotal.toLocaleString('en-IN')}`);
}

function initializeDenominationTable() {
    const tbody = $('#denominationTallyBody');
    tbody.empty();
    DENOMINATIONS.forEach(noteValue => {
        const type = (noteValue >= 10) ? 'Note' : 'Coin';
        const row = `
            <tr>
                <td class="small">
                    ₹<strong>${noteValue}</strong> <span class="badge bg-secondary-subtle text-secondary">${type}</span>
                </td>
                <td class="text-center">
                    <input type="number" 
                           class="form-control form-control-sm text-center note-count-input shadow-sm" 
                           data-value="${noteValue}" 
                           min="0" 
                           value="0" 
                           style="max-width: 90px; margin: 0 auto;">
                </td>
                <td class="text-end fw-bold row-amount-display small">0</td>
            </tr>
        `;
        tbody.append(row);
    });
    $('.note-count-input').off('input').on('input', calculateTotalAmount);
    calculateTotalAmount(); 
}


// --- 4. EMI Calculator Functions ---

function calculateEMI(P, R, N) {
    if (R === 0) return P / N;
    const ratePowerN = Math.pow(1 + R, N);
    const emi = (P * R * ratePowerN) / (ratePowerN - 1);
    return isFinite(emi) ? emi : 0;
}

function updateEMICalculator() {
    const principal = parseFloat($('#principalInput').val()) || 0;
    const years = parseFloat($('#timeInput').val()) || 0;
    const annualRate = parseFloat($('#rateSlider').val()) || 0;

    $('#rateDisplay').text(`${annualRate.toFixed(2)}%`);
    
    const monthlyRate = annualRate / (12 * 100); 
    const months = years * 12;

    let monthlyEMI = 0;
    let totalPayment = 0;
    let totalInterest = 0;
    
    if (principal > 0 && years > 0 && months > 0) {
        monthlyEMI = calculateEMI(principal, monthlyRate, months);
        totalPayment = monthlyEMI * months;
        totalInterest = totalPayment - principal;
    }

    const formatCurrency = (amount) => `₹${Math.round(amount).toLocaleString('en-IN')}`;

    $('#outputEMI').text(formatCurrency(monthlyEMI));
    $('#outputPrincipal').text(formatCurrency(principal));
    $('#outputTotalInterest').text(formatCurrency(totalInterest));
    $('#outputTotalPayment').text(formatCurrency(totalPayment));

    updateEMIPieChart(principal, totalInterest);
}

function updateEMIPieChart(principal, totalInterest) {
    const ctx = document.getElementById('emiPieChart').getContext('2d');
    const principalRounded = Math.round(principal);
    const totalInterestRounded = Math.round(totalInterest);
    const dataValues = [principalRounded, totalInterestRounded];
    const dataLabels = [`Principal (${principalRounded.toLocaleString('en-IN')})`, `Interest (${totalInterestRounded.toLocaleString('en-IN')})`];
    
    const chartConfig = {
        type: 'doughnut', 
        data: {
            labels: dataLabels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#0d6efd', '#dc3545'],
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 15, font: { size: 10 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (context.parsed !== null) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1) + '%';
                                label = `${context.label.split('(')[0].trim()}: ${percentage}`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    };

    if (emiChart) {
        emiChart.data.datasets[0].data = dataValues;
        emiChart.data.labels = dataLabels;
        emiChart.update();
    } else {
        emiChart = new Chart(ctx, chartConfig);
    }
}


// --- 5. Initial Event Listeners (Offline/Modal Triggers) ---

$(function() {
    $('#digitInput').on('input', function () {
        const value = parseInt(this.value);
        const output = $('#spellingOutput');
        if (isNaN(value)) output.text('Enter a valid number.');
        else if (value < 0) output.text('Negative numbers not supported.');
        else output.text(numberToIndianWords(value));
    });

    $('.emi-calc-input').on('input', updateEMICalculator);
    $('#emiCalculatorModal').on('shown.bs.modal', updateEMICalculator);
    $('#denominationModal').on('show.bs.modal', initializeDenominationTable);
});


// --- 6. PWA Service Worker (Always load for offline capability) ---

let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');
const installButton = document.getElementById('installButton');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  });
}

// PWA install banner logic
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBanner) {
    installBanner.classList.remove('d-none');
    installBanner.classList.add('d-flex', 'align-items-center', 'justify-content-between');
  }
});

if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    if (installBanner) installBanner.classList.add('d-none');
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch (err) {
      console.error('Error during PWA installation:', err);
    }
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  if (installBanner) installBanner.classList.add('d-none');
});


// --- FAVORITE TOOLS SYSTEM ---

function getFavoriteTools() {
  try {
    return JSON.parse(localStorage.getItem('favoriteTools') || '[]');
  } catch {
    return [];
  }
}

function setFavoriteTools(favs) {
  localStorage.setItem('favoriteTools', JSON.stringify(favs));
}

function refreshFavorites() {
  const favSection = document.getElementById('favoriteToolsSection');
  const favRow = document.getElementById('favoriteTools');
  const favs = getFavoriteTools();
  favRow.innerHTML = '';

  if (favs.length === 0) {
    favSection.classList.add('d-none');
    return;
  }

  favSection.classList.remove('d-none');

  favs.forEach(toolName => {
    const card = document.querySelector(`.modern-card[data-tool="${toolName}"]`);
    if (card) {
      const col = card.closest('.col-6, .col-md-4, .col-lg-3');
      if (col) {
        const clone = col.cloneNode(true);
        favRow.appendChild(clone);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const favs = getFavoriteTools();

  // Initialize favorite buttons
  document.querySelectorAll('.modern-card').forEach(card => {
    const btn = card.querySelector('.fav-btn');
    const toolName = card.getAttribute('data-tool');

    if (!btn || !toolName) return;

    if (favs.includes(toolName)) {
      btn.classList.add('active');
      btn.querySelector('span').textContent = 'star_rate';
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      let currentFavs = getFavoriteTools();

      if (currentFavs.includes(toolName)) {
        currentFavs = currentFavs.filter(f => f !== toolName);
        btn.classList.remove('active');
        btn.querySelector('span').textContent = 'star';
      } else {
        currentFavs.push(toolName);
        btn.classList.add('active');
        btn.querySelector('span').textContent = 'star_rate';
      }

      setFavoriteTools(currentFavs);
      refreshFavorites();
    });
  });

  refreshFavorites();
});


// PDF & Image Tools JS (Updated)
// Requires jsPDF and pdf.js for full functionality (add via CDN if not present)

// --------- Image to PDF ---------
document.getElementById('convertImagesToPdfBtn')?.addEventListener('click', async function() {
  const input = document.getElementById('imagesForPdfInput');
  const resultDiv = document.getElementById('imageToPdfResult');
  const fileSizeList = document.getElementById('imageToPdfFileSizeList');
  const outputSizeDiv = document.getElementById('imageToPdfOutputSize');

  if (!input.files.length) {
    resultDiv.innerHTML = `<div class="alert alert-warning">Please select image files.</div>`;
    fileSizeList.innerHTML = "";
    outputSizeDiv.innerHTML = "";
    return;
  }
  resultDiv.innerHTML = `<div class="text-info">Converting, please wait...</div>`;
  fileSizeList.innerHTML = "";
  outputSizeDiv.innerHTML = "";

  // jsPDF required
  if (!window.jspdf) {
    resultDiv.innerHTML = `<div class="alert alert-danger">jsPDF library required for this tool.</div>`;
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  let first = true;
  let fileSizes = [];
  for (const file of input.files) {
    const imgData = await fileToBase64(file);
    const img = new Image();
    img.src = imgData;
    await new Promise(resolve => img.onload = resolve);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    if (!first) pdf.addPage();
    pdf.addImage(img, 'JPEG', 10, 10, pdfWidth - 20, pdfHeight - 20);
    first = false;
    fileSizes.push({name: file.name, size: file.size});
  }
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  resultDiv.innerHTML = `<a href="${pdfUrl}" download="converted.pdf" class="btn btn-success">Download PDF</a>`;

  // Show file sizes for each image
  let sizeHtml = "";
  fileSizes.forEach(obj => {
    sizeHtml += `<li class="list-group-item bg-dark text-light border-0">Image: <b>${obj.name}</b> &mdash; <span class="badge bg-info">Before: ${(obj.size/1024).toFixed(2)} KB</span></li>`;
  });
  fileSizeList.innerHTML = sizeHtml;

  // Show output PDF size
  outputSizeDiv.innerHTML = `<b>PDF Size: ${(pdfBlob.size/1024).toFixed(2)} KB</b>`;
});

// --------- PDF to Image ---------
document.getElementById('convertPdfToImageBtn')?.addEventListener('click', async function() {
  const input = document.getElementById('pdfForImageInput');
  const resultDiv = document.getElementById('pdfToImageResult');
  const fileSizeList = document.getElementById('pdfToImageFileSizeList');

  if (!input.files.length) {
    resultDiv.innerHTML = `<div class="alert alert-warning">Please select a PDF file.</div>`;
    fileSizeList.innerHTML = "";
    return;
  }
  resultDiv.innerHTML = `<div class="text-info">Extracting images, please wait...</div>`;
  fileSizeList.innerHTML = "";

  // pdf.js required
  if (!window['pdfjsLib']) {
    resultDiv.innerHTML = `<div class="alert alert-danger">pdf.js library required for this tool.</div>`;
    return;
  }
  const pdfjsLib = window['pdfjsLib'];
  const file = input.files[0];
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let images = [];
  let sizes = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    images.push(dataUrl);
    // Estimate base64 image size
    sizes.push({page: i, size: Math.round((dataUrl.length * (3/4) - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0)) / 1024)});
  }
  if (images.length) {
    resultDiv.innerHTML = `<div class="mb-2">PDF rendered as images (one per page):</div>`;
    images.forEach((img, idx) => {
      resultDiv.innerHTML += `<div class="mb-2">
        <img src="${img}" alt="Page ${idx+1}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px #aaa;">
        <a href="${img}" download="page-${idx+1}.png" class="btn btn-success btn-sm mt-1">Download Page ${idx+1}</a>
      </div>`;
    });
    let sizeHtml = `<ul class="list-group">`;
    sizes.forEach(obj => {
      sizeHtml += `<li class="list-group-item bg-dark text-light border-0">Page ${obj.page}: <span class="badge bg-info">${obj.size} KB</span></li>`;
    });
    sizeHtml += `</ul>`;
    fileSizeList.innerHTML = sizeHtml;
    resultDiv.innerHTML += `<div class="mt-2 small text-muted">Note: This renders each page as an image. True image extraction from PDF streams requires advanced parsing.</div>`;
  } else {
    resultDiv.innerHTML = `<div class="alert alert-info">No images/pages could be rendered from this PDF.</div>`;
    fileSizeList.innerHTML = "";
  }
});

// --------- Image Compress ---------
document.getElementById('compressImageBtn')?.addEventListener('click', async function() {
  const input = document.getElementById('imageCompressInput');
  const quality = parseInt(document.getElementById('compressQuality')?.value) / 100;
  const resultDiv = document.getElementById('imageCompressResult');
  const sizeDetailsDiv = document.getElementById('imageCompressSizeDetails');
  if (!input.files.length) {
    resultDiv.innerHTML = `<div class="alert alert-warning">Please select an image file.</div>`;
    sizeDetailsDiv.innerHTML = "";
    return;
  }
  resultDiv.innerHTML = `<div class="text-info">Compressing image...</div>`;
  sizeDetailsDiv.innerHTML = "";
  const file = input.files[0];
  const originalSize = file.size;
  const img = new Image();
  img.src = await fileToBase64(file);
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(function(blob){
      const url = URL.createObjectURL(blob);
      const compressedSize = blob.size;
      resultDiv.innerHTML = `<a href="${url}" download="compressed.jpg" class="btn btn-success">Download Compressed Image</a>
        <img src="${url}" alt="Compressed" style="max-width:100%;border-radius:8px;box-shadow:0 1px 4px #444;" class="mt-2">`;
      sizeDetailsDiv.innerHTML = `
        <div class="mt-2 text-muted">
            <b>Original Size:</b> <span class="badge bg-info">${(originalSize/1024).toFixed(2)} KB</span><br>
            <b>Compressed Size:</b> <span class="badge bg-success">${(compressedSize/1024).toFixed(2)} KB</span>
        </div>
      `;
    }, 'image/jpeg', quality);
  }
  img.onerror = function() {
    resultDiv.innerHTML = `<div class="alert alert-danger">Failed to load image. Please select a valid image file.</div>`;
    sizeDetailsDiv.innerHTML = "";
  }
});

// Utility: Convert file to base64
async function fileToBase64(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

  const canvas = document.getElementById('signaturePad');
  const ctx = canvas.getContext('2d');
  let drawing = false;

  canvas.addEventListener('mousedown', () => drawing = true);
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('mousemove', draw);

  canvas.addEventListener('touchstart', () => drawing = true);
  canvas.addEventListener('touchend', () => drawing = false);
  canvas.addEventListener('touchmove', drawTouch);

  function draw(e) {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function drawTouch(e) {
    e.preventDefault();
    if (!drawing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  function clearSignature() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function downloadSignature() {
    const link = document.createElement('a');
    link.download = 'signature.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }


/* 🗜️ Image Compressor */
let compressedData = null;
function compressImage() {
  const file = document.getElementById('compressInput').files[0];
  if (!file) return alert('Select an image first');
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('compressCanvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      compressedData = canvas.toDataURL('image/jpeg', 0.6);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      img.src = compressedData;
      ctx.drawImage(img, 0, 0);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function downloadCompressed() {
  if (!compressedData) return alert('Compress first');
  const a = document.createElement('a');
  a.href = compressedData;
  a.download = 'compressed.jpg';
  a.click();
}

/* 📏 Photo Resizer */
function resizeImage() {
  const file = document.getElementById('resizeInput').files[0];
  const width = +document.getElementById('resizeWidth').value;
  const height = +document.getElementById('resizeHeight').value;
  if (!file || !width || !height) return alert('Select image and dimensions');
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('resizeCanvas');
      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function downloadResized() {
  const canvas = document.getElementById('resizeCanvas');
  const a = document.createElement('a');
  a.href = canvas.toDataURL();
  a.download = 'resized.png';
  a.click();
}

/* 🔢 Unit Converter */
function convertUnit() {
  const type = document.getElementById('unitType').value;
  const value = parseFloat(document.getElementById('unitValue').value);
  let result = '';
  if (type === 'length') result = `${value} m = ${(value * 100).toFixed(2)} cm`;
  else if (type === 'weight') result = `${value} kg = ${(value * 1000).toFixed(2)} g`;
  else if (type === 'temperature') result = `${value} °C = ${((value * 9/5) + 32).toFixed(2)} °F`;
  document.getElementById('unitResult').textContent = result;
}

/* 💱 Currency Converter (mock) */
function convertCurrency() {
  const amount = +document.getElementById('currencyAmount').value;
  const from = document.getElementById('fromCurrency').value;
  const to = document.getElementById('toCurrency').value;
  if (!amount) return alert('Enter amount');
  const rate = (from === 'USD' && to === 'INR') ? 83.2 :
               (from === 'INR' && to === 'USD') ? 0.012 :
               (from === to) ? 1 : 1.1;
  const converted = (amount * rate).toFixed(2);
  document.getElementById('currencyResult').textContent = `${amount} ${from} = ${converted} ${to}`;
}

/* 🔐 Password Generator */
function generatePassword() {
  const len = +document.getElementById('passwordLength').value;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let pass = '';
  for (let i = 0; i < len; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  document.getElementById('passwordResult').textContent = pass;
}


let pdfDoc = null;
let pdfBytes = null;
let pdfCanvas = document.getElementById('pdfCanvas');

let currentPage = null;
let pageScale = 1;

// Load and render selected PDF
document.getElementById('pdfInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  pdfBytes = await file.arrayBuffer();
  pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
  renderPDFPage(0);
});

async function renderPDFPage(pageIndex) {
  const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.min.mjs');
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  currentPage = await pdf.getPage(pageIndex + 1);

  const viewport = currentPage.getViewport({ scale: 1.5 });
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;

  const renderCtx = { canvasContext: ctx, viewport: viewport };
  await currentPage.render(renderCtx).promise;
}

// ✏️ Add Text
document.getElementById('addTextBtn').addEventListener('click', async () => {
  if (!pdfDoc) return alert('Load a PDF first!');
  const text = prompt('Enter text to add:');
  if (!text) return;

  const page = pdfDoc.getPage(0);
  page.drawText(text, {
    x: 50,
    y: 700,
    size: 14,
    color: PDFLib.rgb(0, 0, 0.8),
  });

  pdfBytes = await pdfDoc.save();
  renderPDFPage(0);
});

// 🟨 Add Highlight
document.getElementById('addRectBtn').addEventListener('click', async () => {
  if (!pdfDoc) return alert('Load a PDF first!');
  const page = pdfDoc.getPage(0);
  page.drawRectangle({
    x: 40,
    y: 680,
    width: 200,
    height: 25,
    color: PDFLib.rgb(1, 1, 0),
    opacity: 0.4
  });

  pdfBytes = await pdfDoc.save();
  renderPDFPage(0);
});

// 💾 Download Edited PDF
document.getElementById('downloadPdfBtn').addEventListener('click', async () => {
  if (!pdfDoc) return alert('No PDF loaded!');
  const updatedPdfBytes = await pdfDoc.save();
  const blob = new Blob([updatedPdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'edited.pdf';
  a.click();
});
