// =======================================================
// OFFLINE.JS: CORE UI, CALCULATORS, AND PWA LOGIC
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
    container.append(toastElement[0]);
    
    const toast = new bootstrap.Toast(toastElement[0], { delay: 5000 });
    toast.show();

    toastElement.on('hidden.bs.toast', function () {
        $(this).remove();
    });
};

window.enableTools = function() {
    // Enable the main Lead Management card and Quick Note FAB
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
    // Disable Lead Management card and Quick Note FAB
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
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
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

$(document).ready(function() {
    // Calculator/Conversion Listeners
    $('#digitInput').on('input', function () {
        const value = parseInt($(this).val());
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
      // Assuming service-worker.js is in the root directory
      const registration = await navigator.serviceWorker.register('./service-worker.js'); 
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  });
}

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
