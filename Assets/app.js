/* =======================================================
   Digital Diary - Professional Edition
   Firebase Integrated Version
   Author: Debjit Baishnab
   ======================================================= */

// Offline queue will be managed in this module (keeps access to firebase/db variables)
let _offlineQueue = [];

function loadOfflineQueue() {
    try {
        const saved = localStorage.getItem('diary_offline_queue');
        if (saved) _offlineQueue = JSON.parse(saved);
    } catch (e) { _offlineQueue = []; }
}

function saveOfflineQueue() {
    try { localStorage.setItem('diary_offline_queue', JSON.stringify(_offlineQueue)); } catch (e) { /* ignore */ }
}

function queueOfflineChange(dateStr, entryData) {
    _offlineQueue.push({ dateStr, entryData, timestamp: new Date().toISOString() });
    saveOfflineQueue();
}

async function processOfflineQueue() {
    loadOfflineQueue();
    if (!navigator.onLine || !isFirebaseConnected || _offlineQueue.length === 0) return;

    showToast("Syncing offline changes...", "info");

    const successful = [];
    for (const item of _offlineQueue) {
        try {
            await set(ref(db, `users/${storedUID}/entries/${item.dateStr}`), item.entryData);
            successful.push(item);
        } catch (err) {
            console.error('Error syncing offline change:', err);
        }
    }

    if (successful.length) {
        _offlineQueue = _offlineQueue.filter(i => !successful.includes(i));
        saveOfflineQueue();
        showToast(`Synced ${successful.length} offline changes`, 'success');
    }
}

// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, off } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// -------------------------------------
// Firebase Configuration
// -------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCLb8Fcl_Yqqd0EYXciu5wbrAj7-mz1o9M",
    authDomain: "officetools-629fc.firebaseapp.com",
    databaseURL: "https://officetools-629fc-default-rtdb.firebaseio.com",
    projectId: "officetools-629fc",
    storageBucket: "officetools-629fc.firebasestorage.app",
    messagingSenderId: "888485297465",
    appId: "1:888485297465:web:f832733b7b78d361067ce8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// -------------------------------------
// Firebase Authentication
// -------------------------------------
function initializeAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                localStorage.setItem("userUID", user.uid);
                localStorage.setItem("userName", user.displayName || "User");
                localStorage.setItem("userPhoto", user.photoURL || "./Assets/icons/default_user.png");
                resolve(user);
            } else {
                // Sign in anonymously if no user
                signInAnonymously(auth)
                    .then(result => {
                        localStorage.setItem("userUID", result.user.uid);
                        localStorage.setItem("userName", "Guest User");
                        localStorage.setItem("userPhoto", "./Assets/icons/default_user.png");
                        resolve(result.user);
                    })
                    .catch(err => {
                        // Some Firebase projects disable anonymous sign-in (admin-restricted-operation).
                        // Fall back to a local guest session so the app remains usable offline.
                        console.warn('Anonymous sign-in failed, falling back to guest:', err);
                        try {
                            localStorage.setItem("userUID", "guest");
                            localStorage.setItem("userName", "Guest User");
                            localStorage.setItem("userPhoto", "./Assets/icons/default_user.png");
                        } catch (e) { /* ignore storage errors */ }
                        resolve({ uid: 'guest', isGuest: true });
                    });
            }
        });
    });
}

// -------------------------------------
// User Session Info (kept mutable so we can update after auth)
// -------------------------------------
let storedUID = localStorage.getItem("userUID") || "guest";
let storedName = localStorage.getItem("userName") || "Guest User";
let storedPhoto = localStorage.getItem("userPhoto") || "assets/default_user.png";

// -------------------------------------
// Global State
// -------------------------------------
let quill;
let currentDate = new Date();
let autoSaveTimer = null;
let activeEntryRef = null;
let offlineQueue = [];
let isOnline = navigator.onLine;
let summaryChart = null;

// -------------------------------------
// Helper Functions
// -------------------------------------

function formatDate(date) {
    return date.toISOString().split("T")[0];
}

function showToast(message, type = "info") {
    const toast = $(`
        <div class="toast text-bg-${type} border-0">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `);
    $(".toast-container").append(toast);
    new bootstrap.Toast(toast[0], { delay: 3000 }).show();
}

// -------------------------------------
// Firebase: Connection Management
// -------------------------------------
let isFirebaseConnected = false;

function initializeFirebaseConnection() {
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
        isFirebaseConnected = snap.val() === true;
        updateSaveButtonStatus();
    });
}

function updateSaveButtonStatus(state = 'default') {
    const saveBtn = $('#saveBtn');
    
    // Remove all states first
    saveBtn.removeClass('saving success warning');
    
    switch(state) {
        case 'saving':
            saveBtn.addClass('saving');
            saveBtn.attr('aria-label', 'Saving to cloud');
            break;
        case 'success':
            saveBtn.addClass('success');
            saveBtn.attr('aria-label', 'Saved successfully');
            setTimeout(() => updateSaveButtonStatus(), 1500);
            break;
        case 'warning':
            saveBtn.addClass('warning');
            saveBtn.attr('aria-label', 'Offline mode - saved locally');
            break;
        default:
            if (storedUID === 'guest') {
                saveBtn.addClass('warning');
                saveBtn.attr('aria-label', 'Local save only (guest)');
            } else if (!isFirebaseConnected) {
                saveBtn.addClass('warning');
                saveBtn.attr('aria-label', 'Offline mode');
            }
            break;
    }
}

// -------------------------------------
// Firebase: Save Entry
// -------------------------------------
async function saveEntryToFirebase() {
    const dateStr = formatDate(currentDate);
    const entryData = {
        content: (quill && quill.root) ? quill.root.innerHTML.trim() : '',
        updated: new Date().toISOString(),
        lastModifiedLocally: new Date().toISOString()
    };

    // Always save locally first
    saveEntryToLocal(dateStr, entryData);
    updateSaveButtonStatus('saving');

    // If running as guest, do local save and notify user to sign in for multi-user cloud sync
    if (storedUID === 'guest') {
        showToast("Saved locally (guest). Sign in to sync entries across devices.", "warning");
        updateSaveButtonStatus('warning');
        return;
    }

    if (!isFirebaseConnected || !navigator.onLine) {
        // Queue the change for later sync
        queueOfflineChange(dateStr, entryData);
        showToast("Currently offline. Entry saved locally.", "warning");
        updateSaveButtonStatus('warning');
        return;
    }

    try {
        await set(ref(db, `users/${storedUID}/entries/${dateStr}`), entryData);
        updateSaveButtonStatus('success');
    } catch (err) {
        console.error("Firebase Save Error:", err);
        showToast("Error saving to Firebase. Saved locally instead.", "danger");
        queueOfflineChange(dateStr, entryData);
        updateSaveButtonStatus('warning');
    }
}

// -------------------------------------
// Firebase: Load Entry
// ------------------------------------- 
async function loadEntryFromFirebase(dateStr) {
    if (storedUID === 'guest') return loadEntryFromLocal(dateStr);

    try {
        // Set up real-time listener (detach previous listener first)
        const entryRef = ref(db, `users/${storedUID}/entries/${dateStr}`);
        if (activeEntryRef) {
            try { off(activeEntryRef); } catch (e) { /* ignore */ }
        }
        activeEntryRef = entryRef;

        onValue(entryRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Only update if this is the current date we're viewing
                if (formatDate(currentDate) === dateStr) {
                    if (!quill || !quill.root) return;
                    quill.root.innerHTML = data.content || "";
                    $("#lastModified").text(new Date(data.updated).toLocaleString());
                    updateSummary();
                    showToast("Entry synchronized", "success");
                }
            } else {
                if (formatDate(currentDate) === dateStr) {
                    if (!quill || !quill.root) return;
                    quill.root.innerHTML = "";
                    $("#lastModified").text("-");
                    updateSummary();
                }
            }
        }, (error) => {
            console.error("Firebase Sync Error:", error);
            showToast("Sync error. Working from local copy.", "warning");
            loadEntryFromLocal(dateStr);
        });
    } catch (err) {
        console.error("Firebase Load Error:", err);
        showToast("Error loading from Firebase. Showing local backup.", "warning");
        loadEntryFromLocal(dateStr);
    }
}

// -------------------------------------
// Local Fallbacks
// -------------------------------------
function saveEntryToLocal(dateStr, entry) {
    localStorage.setItem(`diary_${dateStr}`, JSON.stringify(entry));
    updateSaveButtonStatus('success');
}

function loadEntryFromLocal(dateStr) {
    const saved = localStorage.getItem(`diary_${dateStr}`);
    if (saved) {
        const data = JSON.parse(saved);
        if (quill && quill.root) {
            quill.root.innerHTML = data.content || "";
        }
        $("#lastModified").text(new Date(data.lastModifiedLocally || data.updated).toLocaleString());
        
        // If we have a local version that's newer than cloud version, queue it for sync
        if (data.lastModifiedLocally && (!isFirebaseConnected || !navigator.onLine)) {
            queueOfflineChange(dateStr, data);
        }
    } else {
        quill.root.innerHTML = "";
        $("#lastModified").text("-");
    }
    updateSummary();
}

// -------------------------------------
// Update Word Count / Summary
// -------------------------------------
function updateSummary() {
    if (!quill || !quill.getText) return;
    const text = quill.getText().trim();
    const words = text.split(/\s+/).filter(Boolean).length;
    $("#wordCount").text(words);
    $("#charCount").text(text.length);
    $("#contentPreview").text(text.slice(0, 150) || "No content yet");
}

// -------------------------------------
// Auto-Save Handler
// -------------------------------------
function startAutoSave(intervalSec = 30) {
    clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(saveEntryToFirebase, intervalSec * 1000);
}

// -------------------------------------
// Theme Management
// -------------------------------------
function setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('diaryTheme', theme);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('diaryTheme') || 'light';
    setTheme(savedTheme);
    $(`#${savedTheme}Theme`).prop('checked', true);
}

// -------------------------------------
// Editor Initialization
// -------------------------------------
$(document).ready(async () => {
    // Initialize authentication
    try {
        await initializeAuth();
        // refresh stored user vars from localStorage (may have been set by initializeAuth)
        storedUID = localStorage.getItem("userUID") || "guest";
        storedName = localStorage.getItem("userName") || "Guest User";
        storedPhoto = localStorage.getItem("userPhoto") || "assets/default_user.png";
        
        quill = new Quill("#editor", {
            theme: "snow",
            modules: {
                toolbar: "#editorToolbar"
            },
            placeholder: "Start writing your thoughts..."
        });

        // Editor change handler
        quill.on("text-change", updateSummary);

    $("#userName").text(storedName);
    $("#userPhoto").attr("src", storedPhoto);
        
        // Initialize theme
        initializeTheme();
        
        // Theme change handlers
        $('input[name="theme"]').on('change', function() {
            setTheme(this.value);
        });

        const dateStr = formatDate(currentDate);
        await loadEntryFromFirebase(dateStr);
        startAutoSave(30);
        
        // Initialize date picker with current date
        $("#datePicker").val(formatDate(currentDate));

        // Hide loading overlay
        $("#loadingOverlay").fadeOut();
    } catch (error) {
        console.error("Initialization error:", error);
        showToast("Error initializing application. Working in offline mode.", "warning");
        $("#loadingOverlay").fadeOut();
    }

    // Initialize Firebase connection monitoring
    initializeFirebaseConnection();
    // Update backup sublabel from saved value
    updateBackupSublabel();
    
    // Initialize online/offline handlers
    window.addEventListener('online', async () => {
        isOnline = true;
        showToast("Back online!", "success");
        updateSaveButtonStatus();
        await processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        showToast("You are offline. Changes will be saved locally.", "warning");
        updateSaveButtonStatus('warning');
    });
});

// -------------------------------------
// Navigation & Controls with page transition
// -------------------------------------
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function navigateToDate(targetDate) {
    // targetDate can be a Date or string parsable by Date
    const newDate = (targetDate instanceof Date) ? targetDate : new Date(targetDate);
    const dateStr = formatDate(newDate);
    const $card = $("#pagedEntryContent");

    // Start fold-out animation
    $card.addClass('page-fold-out');
    // Wait for animation to mostly finish (matches CSS duration)
    await delay(240);

    // Update state and UI
    currentDate = new Date(newDate);
    $("#datePicker").val(formatDate(currentDate));

    // Load content for the new date (real-time listener will update editor)
    await loadEntryFromFirebase(dateStr);

    // Play fold-in animation
    $card.removeClass('page-fold-out').addClass('page-fold-in');
    // Remove animation class after finish
    await delay(260);
    $card.removeClass('page-fold-in');
}

// Prev / Next / Today handlers use the animated navigator
$("#prevPageBtn").on("click", () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    navigateToDate(d);
});

$("#nextPageBtn").on("click", () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    navigateToDate(d);
});

$("#todayBtn").on("click", () => {
    navigateToDate(new Date());
});

$("#datePicker").on("change", function () {
    if (!this.value) return;
    navigateToDate(new Date(this.value));
});

// -------------------------------------
// Module Management
// -------------------------------------
// Create backdrop for fullscreen modules
let $backdrop = $('<div class="module-backdrop"></div>').appendTo('body');

function showModule(moduleId) {
    const template = $(`#${moduleId}ModuleTemplate`).html();
    const $module = $(template);
    $("#moduleContainer").append($module);
    $module.hide().fadeIn();
    
    // Initialize module-specific functionality
    if (moduleId === 'settings') {
        initializeSettingsModule($module);
    } else if (moduleId === 'image') {
        initializeImageModule($module);
    } else if (moduleId === 'summary') {
        updateSummary();
    }

    // Initialize fullscreen functionality
    initializeFullscreenModule($module);
}

function initializeFullscreenModule($module) {
    const $toggleBtn = $module.find('.toggle-fullscreen');
    const $icon = $toggleBtn.find('i');
    
    $toggleBtn.on('click', function() {
        const isFullscreen = $module.hasClass('fullscreen');
        
        // Toggle fullscreen state
        if (isFullscreen) {
            $module.removeClass('fullscreen');
            $backdrop.removeClass('active');
            $icon.removeClass('fa-compress').addClass('fa-expand');
        } else {
            $module.addClass('fullscreen');
            $backdrop.addClass('active');
            $icon.removeClass('fa-expand').addClass('fa-compress');
        }
    });

    // Close fullscreen when clicking backdrop
    $backdrop.on('click', function() {
        $module.removeClass('fullscreen');
        $backdrop.removeClass('active');
        $icon.removeClass('fa-compress').addClass('fa-expand');
    });

    // Handle escape key
    $(document).on('keydown.fullscreen', function(e) {
        if (e.key === 'Escape' && $module.hasClass('fullscreen')) {
            $toggleBtn.click();
        }
    });
}

function initializeSettingsModule($module) {
    let settings = {
        fontSize: localStorage.getItem('diaryFontSize') || '16',
        fontFamily: localStorage.getItem('diaryFont') || 'Poppins',
        autoSaveInterval: localStorage.getItem('autoSaveInterval') || '30',
        theme: localStorage.getItem('diaryTheme') || 'light'
    };

    // Temporary settings for preview
    let tempSettings = { ...settings };
    
    // Font size handler
    const $fontSizeRange = $module.find('#fontSizeRange');
    const $fontSizeValue = $module.find('#fontSizeValue');
    
    $fontSizeRange.val(settings.fontSize);
    $fontSizeValue.text(`${settings.fontSize}px`);
    
    $fontSizeRange.on('input', function() {
        const size = $(this).val();
        $fontSizeValue.text(`${size}px`);
        $('.ql-editor').css('font-size', `${size}px`);
        tempSettings.fontSize = size;
    });
    
    // Font family handler
    const $fontSelect = $module.find('#fontSelect');
    $fontSelect.val(settings.fontFamily);
    
    $fontSelect.on('change', function() {
        const font = $(this).val();
        $('.ql-editor').css('font-family', font);
        tempSettings.fontFamily = font;
    });
    
    // Auto-save interval handler
    const $autoSaveInterval = $module.find('#autoSaveInterval');
    $autoSaveInterval.val(settings.autoSaveInterval);
    
    $autoSaveInterval.on('change', function() {
        tempSettings.autoSaveInterval = $(this).val();
    });

    // Theme handler
    $module.find(`input[name="theme"][value="${settings.theme}"]`).prop('checked', true);
    
    $module.find('input[name="theme"]').on('change', function() {
        const theme = $(this).val();
        setTheme(theme);
        tempSettings.theme = theme;
    });

    // Apply button handler
    const $applyBtn = $('<button class="btn btn-primary mt-4 w-100 apply-settings">')
        .html('<i class="fas fa-check me-2"></i>Apply Changes')
        .appendTo($module.find('.module-content'));

    $applyBtn.on('click', function() {
        // Save all settings
        localStorage.setItem('diaryFontSize', tempSettings.fontSize);
        localStorage.setItem('diaryFont', tempSettings.fontFamily);
        localStorage.setItem('autoSaveInterval', tempSettings.autoSaveInterval);
        localStorage.setItem('diaryTheme', tempSettings.theme);

        // Apply settings permanently
        $('.ql-editor').css({
            'font-size': `${tempSettings.fontSize}px`,
            'font-family': tempSettings.fontFamily
        });

        // Update auto-save interval
        startAutoSave(parseInt(tempSettings.autoSaveInterval));

        // Show success message
        showToast('Settings saved successfully!', 'success');

        // Update stored settings
        settings = { ...tempSettings };
    });

    // Add cancel button
    const $cancelBtn = $('<button class="btn btn-secondary mt-3 w-100">')
        .html('<i class="fas fa-times me-2"></i>Cancel')
        .insertAfter($applyBtn);

    $cancelBtn.on('click', function() {
        // Restore previous settings
        $('.ql-editor').css({
            'font-size': `${settings.fontSize}px`,
            'font-family': settings.fontFamily
        });
        setTheme(settings.theme);
        
        // Reset temporary settings
        tempSettings = { ...settings };
        
        // Reset UI
        $fontSizeRange.val(settings.fontSize);
        $fontSizeValue.text(`${settings.fontSize}px`);
        $fontSelect.val(settings.fontFamily);
        $autoSaveInterval.val(settings.autoSaveInterval);
        $module.find(`input[name="theme"][value="${settings.theme}"]`).prop('checked', true);
        
        // Close module
        $module.find('.remove-module').click();
    });
}

// -------------------------------------
// Summary Modal Population
// -------------------------------------
function sanitizeText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    return tmp.textContent || tmp.innerText || '';
}

function getAllLocalEntries() {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('diary_')) {
            const dateStr = key.replace('diary_', '');
            try {
                const data = JSON.parse(localStorage.getItem(key) || '{}');
                entries.push({ dateStr, data });
            } catch (e) { /* ignore parse errors */ }
        }
    }
    // sort desc by date
    entries.sort((a,b) => b.dateStr.localeCompare(a.dateStr));
    return entries;
}

function populateSummaryModal(filter) {
    const entries = getAllLocalEntries();
    const $tbody = $('#summaryTable tbody');
    $tbody.empty();

    let totalWords = 0;
    // bucket counts for pie chart
    const buckets = { short: 0, medium: 0, long: 0 };
    let displayedCount = 0;
    entries.forEach(entry => {
        const text = sanitizeText(entry.data.content || '');
        const words = text.trim().length ? text.trim().split(/\s+/).filter(Boolean).length : 0;
        totalWords += words;
        const preview = text.slice(0, 120).replace(/[\n\r]+/g, ' ');

        if (filter) {
            const f = filter.toLowerCase();
            if (!(entry.dateStr.includes(f) || preview.toLowerCase().includes(f) || text.toLowerCase().includes(f))) return;
        }

        // increment bucket for displayed entries
        if (words < 100) buckets.short++;
        else if (words < 400) buckets.medium++;
        else buckets.long++;
        displayedCount++;

        const $tr = $('<tr>').appendTo($tbody);
        $('<td>').html(`<a href="#" class="summary-open-entry" data-date="${entry.dateStr}">${entry.dateStr}</a>`).appendTo($tr);
        $('<td>').text(words).appendTo($tr);
        $('<td>').text(new Date(entry.data.lastModifiedLocally || entry.data.updated || '').toLocaleString()).appendTo($tr);
        $('<td>').text(preview).appendTo($tr);
    });

    $('#summaryTotalEntries').text(entries.length);
    $('#summaryTotalWords').text(totalWords);
    $('#summaryAvgWords').text(entries.length ? Math.round(totalWords / entries.length) : 0);

    // open entry handler
    $('.summary-open-entry').on('click', function(e) {
        e.preventDefault();
        const d = $(this).data('date');
        if (d) {
            const bs = bootstrap.Modal.getOrCreateInstance($('#summaryModal')[0]);
            bs.hide();
            navigateToDate(new Date(d));
        }
    });

    // filter input
    $('#summarySearch').off('input').on('input', function() {
        const q = $(this).val().trim();
        populateSummaryModal(q);
    });

    // Render / update pie chart (for displayed entries)
    try {
        const ctx = document.getElementById('summaryPieChart');
        if (ctx) {
            const data = [buckets.short, buckets.medium, buckets.long];
            const labels = ['Short (<100 words)', 'Medium (100-399)', 'Long (400+ words)'];
            const colors = ['#4CAF50', '#FFCA28', '#EF5350'];

            if (summaryChart && summaryChart.destroy) {
                // update existing chart
                summaryChart.data.datasets[0].data = data;
                summaryChart.update();
            } else {
                // create new chart
                const chartCtx = ctx.getContext('2d');
                summaryChart = new Chart(chartCtx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: colors,
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: { mode: 'index' }
                        }
                    }
                });
            }
        }
    } catch (err) {
        console.warn('Chart render failed:', err);
    }
}

function initializeImageModule($module) {
    const $fileInput = $module.find('input[type="file"]');
    const $preview = $module.find('.image-preview');
    
    $fileInput.on('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = $('<img>').addClass('img-fluid').attr('src', e.target.result);
                $preview.empty().append(img);
                
                // Insert image into editor when ready
                img.on('load', function() {
                    if (!quill) return;
                    const range = quill.getSelection(true);
                    if (range) quill.insertEmbed(range.index, 'image', e.target.result, 'user');
                });
            };
            reader.readAsDataURL(file);
        }
    });
}

// Module / action handlers: map older data-module items to modals or actions
$('[data-module]').on('click', function(e) {
    const moduleId = $(this).data('module');
    if (!moduleId) return;

    if (moduleId === 'settings') {
        // Initialize settings modal controls when shown
        const $modal = $('#settingsModal');
        initializeSettingsModule($modal);
        const bs = bootstrap.Modal.getOrCreateInstance($modal[0]);
        bs.show();
        return;
    }

    if (moduleId === 'summary') {
        populateSummaryModal();
        const $modal = $('#summaryModal');
        const bs = bootstrap.Modal.getOrCreateInstance($modal[0]);
        bs.show();
        return;
    }

    if (moduleId === 'image') {
        // Trigger the hidden file input to add image
        $('#globalImageInput').click();
        return;
    }

    // Fallback: if there's still a template-based module, show it
    showModule(moduleId);
});

// Hidden global image input handler
$('#globalImageInput').on('change', function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        if (!quill) return;
        const range = quill.getSelection(true) || { index: 0 };
        quill.insertEmbed(range.index, 'image', ev.target.result, 'user');
    };
    reader.readAsDataURL(file);
    // reset input
    $(this).val('');
});

// Remove module handler
$(document).on('click', '.remove-module', function() {
    const $module = $(this).closest('.diary-module');
    
    // Clean up event listeners
    if ($module.hasClass('fullscreen')) {
        $backdrop.removeClass('active');
    }
    $(document).off('keydown.fullscreen');
    
    $module.fadeOut(function() {
        $(this).remove();
    });
});

// Export handler
$('#exportBtn').on('click', function() {
    const content = (quill && quill.root) ? quill.root.innerHTML : '';
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary_${formatDate(currentDate)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Backup handler: create a JSON backup of all diary entries (localStorage) and download
function updateBackupSublabel() {
    const ts = localStorage.getItem('lastBackupTime');
    const el = document.getElementById('backupSublabel');
    if (!el) return;
    if (!ts) {
        el.textContent = 'Last backup: -';
    } else {
        try {
            const d = new Date(ts);
            el.textContent = 'Last backup: ' + d.toLocaleString();
        } catch (e) {
            el.textContent = 'Last backup: -';
        }
    }
}

$('#backupBtn').on('click', function() {
    // gather all diary_ keys
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('diary_')) {
            try { backup[key] = JSON.parse(localStorage.getItem(key)); } catch (e) { backup[key] = localStorage.getItem(key); }
        }
    }
    const payload = JSON.stringify({ created: new Date().toISOString(), data: backup }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diary_backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const now = new Date().toISOString();
    localStorage.setItem('lastBackupTime', now);
    updateBackupSublabel();
    showToast('Backup created and downloaded', 'success');
});

// Print handler
$('#printBtn').on('click', function() {
    const content = (quill && quill.root) ? quill.root.innerHTML : '';
    const printWin = window.open('', '', 'width=900,height=650');
    printWin.document.write(`
        <html>
            <head>
                <title>Diary Entry - ${formatDate(currentDate)}</title>
                <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .entry-date { font-size: 1.2em; margin-bottom: 20px; }
                    @media print {
                        .entry-date { color: #333; }
                    }
                </style>
            </head>
            <body>
                <div class="entry-date">${new Date(currentDate).toLocaleDateString()}</div>
                <div class="ql-snow">
                    <div class="ql-editor">${content}</div>
                </div>
            </body>
        </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
        printWin.print();
        printWin.close();
    }, 250);
});

// -------------------------------------
// Manual Save Shortcut
// -------------------------------------
$(document).on("keydown", (e) => {
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveEntryToFirebase();
    }
});

// Save button in dropdown (manual save)
$('#saveBtn').on('click', function() {
    saveEntryToFirebase();
});
