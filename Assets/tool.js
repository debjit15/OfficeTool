// =======================================================
// CORE UI, CALCULATORS, AND PWA LOGIC
// Functions here run without internet/authentication.
// =======================================================

// --- Global UI State ---
let isAuthReady = false;
let emiChart;

// --- 1. UI Utility Functions ---

window.showToast = function (message, type = 'info') {
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

window.enableTools = function () {
  $('#leadManageCard').removeClass('disabled-for-auth opacity-50')
    .removeAttr('title')
    .attr('data-bs-toggle', 'modal');
  $('#quickNoteFab').removeClass('d-none');
  $('#authRequiredBadge').addClass('d-none');
  $('#userProfileDisplay').removeClass('d-none');
  $('#googleSignInButtonContainer').addClass('d-none');
  isAuthReady = true;
};

window.disableTools = function () {
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
  $('#denominationTallyBody .note-count-input').each(function () {
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
            label: function (context) {
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

$(function () {
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


function getFavoriteTools() {
  try {
    return JSON.parse(localStorage.getItem('favoriteTools') || '[]');
  } catch { return []; }
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
    // Find matching card in main dashboard (Bank or General)
    // We search in #bankFinanceTools and #generalTools to avoid picking up from fav section itself if it existed
    const originalCard = document.querySelector(`#bankFinanceTools [data-tool="${toolName}"], #generalTools [data-tool="${toolName}"]`);

    if (originalCard) {
      const cloneWrapper = originalCard.parentNode.cloneNode(true); // clone .col tool-card-wrap
      const cloneCard = cloneWrapper.querySelector('.tool-card');

      // Ensure the clone has the correct state
      const btn = cloneCard.querySelector('.fav-btn');
      if (btn) {
        btn.classList.add('btn-warning');
        btn.querySelector('span').textContent = 'star_rate';
      }

      // Append to favorites
      favRow.appendChild(cloneWrapper);
    }
  });
}

// Event Delegation for Favorite Buttons (Handles dynamic elements)
document.body.addEventListener('click', function (event) {
  const btn = event.target.closest('.fav-btn');
  if (!btn) return;

  event.preventDefault(); // Prevent modal toggle if inside a card that toggles modal
  event.stopPropagation();

  const card = btn.closest('.tool-card');
  const toolName = card.getAttribute('data-tool');
  let favs = getFavoriteTools();

  if (!favs.includes(toolName)) {
    favs.push(toolName);
    setFavoriteTools(favs);
  } else {
    favs = favs.filter(f => f !== toolName);
    setFavoriteTools(favs);
  }

  // Update UI for ALL instances of this card (Main grid + Favorites section)
  updateFavoriteUI(toolName, favs.includes(toolName));
  refreshFavorites();
});

function updateFavoriteUI(toolName, isFav) {
  const allCards = document.querySelectorAll(`[data-tool="${toolName}"]`);
  allCards.forEach(card => {
    const btn = card.querySelector('.fav-btn');
    if (btn) {
      if (isFav) {
        btn.classList.add('btn-warning');
        btn.querySelector('span').textContent = 'star_rate';
      } else {
        btn.classList.remove('btn-warning');
        btn.querySelector('span').textContent = 'star';
      }
    }
  });
}

// On page load, mark favorite buttons and show favorites
window.addEventListener('DOMContentLoaded', () => {
  const favs = getFavoriteTools();
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const card = btn.closest('.tool-card');
    const toolName = card.getAttribute('data-tool');
    if (favs.includes(toolName)) {
      btn.classList.add('btn-warning');
      btn.querySelector('span').textContent = 'star_rate';
    }
  });
  refreshFavorites();
});



// --- 7. Usage Tracking & Profile Stats ---

function logToolUsage(toolName) {
  const history = getUsageHistory();
  const timestamp = new Date().toISOString();
  // Add to beginning
  history.unshift({ tool: toolName, time: timestamp });
  // Keep last 50 entries
  if (history.length > 50) history.pop();
  localStorage.setItem('toolUsageHistory', JSON.stringify(history));
}

function getUsageHistory() {
  try {
    return JSON.parse(localStorage.getItem('toolUsageHistory') || '[]');
  } catch { return []; }
}

function renderUsageHistory() {
  const history = getUsageHistory();
  const listContainer = document.getElementById('usageHistoryList');
  if (!listContainer) return;

  if (history.length === 0) {
    listContainer.innerHTML = '<div class="text-center text-muted py-3">No recent activity.</div>';
    return;
  }

  let html = '';
  history.forEach(item => {
    const date = new Date(item.time);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = date.toLocaleDateString();

    html += `
      <div class="usage-item">
        <span class="fw-medium">${item.tool}</span>
        <span class="usage-timestamp">${dateString}, ${timeString}</span>
      </div>
    `;
  });
  listContainer.innerHTML = html;
}

// Update profile modal open event to render stats
document.getElementById('profileModal')?.addEventListener('show.bs.modal', renderUsageHistory);


// --- Event Delegation for Tool Clicks (Tracking) ---
document.body.addEventListener('click', function (event) {
  // Check if click is on a tool card (excluding the favorite button)
  const card = event.target.closest('.tool-card');
  if (card && !event.target.closest('.fav-btn')) {
    const toolName = card.getAttribute('data-tool');
    if (toolName) {
      logToolUsage(toolName);
    }
  }
});


// --- Tool Search & Filter ---
document.getElementById('toolSearchInput').addEventListener('input', function () {
  const query = this.value.toLowerCase();
  document.querySelectorAll('.tool-card-wrap').forEach(function (card) {
    const tags = card.getAttribute('data-tags') || '';
    const text = card.textContent.toLowerCase();
    if (text.includes(query) || tags.includes(query)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
});

// PDF & Image Tools JS (Updated)
// Requires jsPDF and pdf.js for full functionality (add via CDN if not present)

// --------- Image to PDF ---------
document.getElementById('convertImagesToPdfBtn')?.addEventListener('click', async function () {
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
    fileSizes.push({ name: file.name, size: file.size });
  }
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  resultDiv.innerHTML = `<a href="${pdfUrl}" download="converted.pdf" class="btn btn-success">Download PDF</a>`;

  // Show file sizes for each image
  let sizeHtml = "";
  fileSizes.forEach(obj => {
    sizeHtml += `<li class="list-group-item bg-dark text-light border-0">Image: <b>${obj.name}</b> &mdash; <span class="badge bg-info">Before: ${(obj.size / 1024).toFixed(2)} KB</span></li>`;
  });
  fileSizeList.innerHTML = sizeHtml;

  // Show output PDF size
  outputSizeDiv.innerHTML = `<b>PDF Size: ${(pdfBlob.size / 1024).toFixed(2)} KB</b>`;
});

// --------- PDF to Image ---------
document.getElementById('convertPdfToImageBtn')?.addEventListener('click', async function () {
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
    sizes.push({ page: i, size: Math.round((dataUrl.length * (3 / 4) - (dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0)) / 1024) });
  }
  if (images.length) {
    resultDiv.innerHTML = `<div class="mb-2">PDF rendered as images (one per page):</div>`;
    images.forEach((img, idx) => {
      resultDiv.innerHTML += `<div class="mb-2">
        <img src="${img}" alt="Page ${idx + 1}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px #aaa;">
        <a href="${img}" download="page-${idx + 1}.png" class="btn btn-success btn-sm mt-1">Download Page ${idx + 1}</a>
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
document.getElementById('compressImageBtn')?.addEventListener('click', async function () {
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
  img.onload = function () {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(function (blob) {
      const url = URL.createObjectURL(blob);
      const compressedSize = blob.size;
      resultDiv.innerHTML = `<a href="${url}" download="compressed.jpg" class="btn btn-success">Download Compressed Image</a>
        <img src="${url}" alt="Compressed" style="max-width:100%;border-radius:8px;box-shadow:0 1px 4px #444;" class="mt-2">`;
      sizeDetailsDiv.innerHTML = `
        <div class="mt-2 text-muted">
            <b>Original Size:</b> <span class="badge bg-info">${(originalSize / 1024).toFixed(2)} KB</span><br>
            <b>Compressed Size:</b> <span class="badge bg-success">${(compressedSize / 1024).toFixed(2)} KB</span>
        </div>
      `;
    }, 'image/jpeg', quality);
  }
  img.onerror = function () {
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