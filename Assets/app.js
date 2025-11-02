/* =======================================================
   Digital Diary - Professional Edition
   Firebase Integrated Version
   Author: Debjit Baishnab
   ======================================================= */

// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
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
                    .catch(reject);
            }
        });
    });
}

// -------------------------------------
// User Session Info
// -------------------------------------
const storedUID = localStorage.getItem("userUID") || "guest";
const storedName = localStorage.getItem("userName") || "Guest User";
const storedPhoto = localStorage.getItem("userPhoto") || "assets/default_user.png";

// -------------------------------------
// Global State
// -------------------------------------
let quill;
let currentDate = new Date();
let autoSaveTimer = null;

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

function updateSaveButtonStatus() {
    const saveBtn = $('#saveBtn');
    const saveBtnText = $('#saveBtnText');
    
    if (!storedUID) {
        saveBtn.removeClass('btn-primary').addClass('btn-warning');
        saveBtnText.text('Local Only');
    } else if (!isFirebaseConnected) {
        saveBtn.removeClass('btn-primary').addClass('btn-warning');
        saveBtnText.text('Offline');
    } else {
        saveBtn.removeClass('btn-warning').addClass('btn-primary');
        saveBtnText.text('Auto-saving...');
    }
    saveBtn.attr('aria-label', `Save status: ${saveBtnText.text()}`);
}

// -------------------------------------
// Firebase: Save Entry
// -------------------------------------
async function saveEntryToFirebase() {
    if (!storedUID) {
        showToast("User not logged in. Entry saved locally.", "warning");
        return saveEntryToLocal();
    }

    if (!isFirebaseConnected) {
        showToast("Currently offline. Entry saved locally.", "warning");
        return saveEntryToLocal();
    }

    const content = quill.root.innerHTML.trim();
    const dateStr = formatDate(currentDate);
    const entryData = {
        content,
        updated: new Date().toISOString()
    };

    try {
        await set(ref(db, `users/${storedUID}/entries/${dateStr}`), entryData);
        showToast("Saved to cloud successfully!", "success");
    } catch (err) {
        console.error("Firebase Save Error:", err);
        showToast("Error saving to Firebase. Saved locally instead.", "danger");
        saveEntryToLocal();
    }
}

// -------------------------------------
// Firebase: Load Entry
// -------------------------------------
async function loadEntryFromFirebase(dateStr) {
    if (!storedUID) return loadEntryFromLocal(dateStr);

    try {
        // Set up real-time listener
        const entryRef = ref(db, `users/${storedUID}/entries/${dateStr}`);
        onValue(entryRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Only update if this is the current date we're viewing
                if (formatDate(currentDate) === dateStr) {
                    quill.root.innerHTML = data.content || "";
                    $("#lastModified").text(new Date(data.updated).toLocaleString());
                    updateSummary();
                    showToast("Entry synchronized", "success");
                }
            } else {
                if (formatDate(currentDate) === dateStr) {
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
function saveEntryToLocal() {
    const content = quill.root.innerHTML.trim();
    const dateStr = formatDate(currentDate);
    const entry = { content, updated: new Date().toISOString() };
    localStorage.setItem(`diary_${dateStr}`, JSON.stringify(entry));
}

function loadEntryFromLocal(dateStr) {
    const saved = localStorage.getItem(`diary_${dateStr}`);
    if (saved) {
        const data = JSON.parse(saved);
        quill.root.innerHTML = data.content || "";
        $("#lastModified").text(new Date(data.updated).toLocaleString());
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
        
        quill = new Quill("#editor", {
            theme: "snow",
            modules: {
                toolbar: "#editorToolbar"
            },
            placeholder: "Start writing your thoughts..."
        });

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

    quill.on("text-change", updateSummary);
    
    // Initialize Firebase connection monitoring
    initializeFirebaseConnection();
});

// -------------------------------------
// Navigation & Controls
// -------------------------------------
$("#prevPageBtn").on("click", () => {
    currentDate.setDate(currentDate.getDate() - 1);
    loadEntryFromFirebase(formatDate(currentDate));
});

$("#nextPageBtn").on("click", () => {
    currentDate.setDate(currentDate.getDate() + 1);
    loadEntryFromFirebase(formatDate(currentDate));
});

$("#todayBtn").on("click", () => {
    currentDate = new Date();
    loadEntryFromFirebase(formatDate(currentDate));
});

$("#datePicker").on("change", function () {
    currentDate = new Date(this.value);
    loadEntryFromFirebase(formatDate(currentDate));
});

// -------------------------------------
// Module Management
// -------------------------------------
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
}

function initializeSettingsModule($module) {
    // Font size handler
    const $fontSizeRange = $module.find('#fontSizeRange');
    const $fontSizeValue = $module.find('#fontSizeValue');
    const savedFontSize = localStorage.getItem('diaryFontSize') || '16';
    
    $fontSizeRange.val(savedFontSize);
    $fontSizeValue.text(`${savedFontSize}px`);
    $('.ql-editor').css('font-size', `${savedFontSize}px`);
    
    $fontSizeRange.on('input', function() {
        const size = $(this).val();
        $fontSizeValue.text(`${size}px`);
        $('.ql-editor').css('font-size', `${size}px`);
        localStorage.setItem('diaryFontSize', size);
    });
    
    // Font family handler
    const $fontSelect = $module.find('#fontSelect');
    const savedFont = localStorage.getItem('diaryFont') || 'Poppins';
    
    $fontSelect.val(savedFont);
    $('.ql-editor').css('font-family', savedFont);
    
    $fontSelect.on('change', function() {
        const font = $(this).val();
        $('.ql-editor').css('font-family', font);
        localStorage.setItem('diaryFont', font);
    });
    
    // Auto-save interval handler
    const $autoSaveInterval = $module.find('#autoSaveInterval');
    const savedInterval = localStorage.getItem('autoSaveInterval') || '30';
    
    $autoSaveInterval.val(savedInterval);
    
    $autoSaveInterval.on('change', function() {
        const interval = $(this).val();
        localStorage.setItem('autoSaveInterval', interval);
        startAutoSave(parseInt(interval));
    });
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
                    const range = quill.getSelection(true);
                    quill.insertEmbed(range.index, 'image', e.target.result, 'user');
                });
            };
            reader.readAsDataURL(file);
        }
    });
}

// Module button handlers
$('[data-module]').on('click', function() {
    const moduleId = $(this).data('module');
    showModule(moduleId);
});

// Remove module handler
$(document).on('click', '.remove-module', function() {
    $(this).closest('.diary-module').fadeOut(function() {
        $(this).remove();
    });
});

// Export handler
$('#exportBtn').on('click', function() {
    const content = quill.root.innerHTML;
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

// Print handler
$('#printBtn').on('click', function() {
    const content = quill.root.innerHTML;
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
