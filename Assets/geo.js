import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCLb8Fcl_Yqqd0EYXciu5wbrAj7-mz1o9M",
    authDomain: "officetools-629fc.firebaseapp.com",
    databaseURL: "https://officetools-629fc-default-rtdb.firebaseio.com",
    projectId: "officetools-629fc",
    storageBucket: "officetools-629fc.firebasestorage.app",
    messagingSenderId: "888485297465",
    appId: "1:888485297465:web:f832733b7b78d361067ce8",
    measurementId: "G-8QE15667LC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);


const $cameraContainer = $('#cameraContainer');
const $cameraView = $('#cameraView');
const $captureBtn = $('#captureBtn');
const $rotateBtn = $('#rotateBtn');
const $flashOverlay = $('#flashOverlay');
const $flashBtn = $('#flashBtn');
const $fetchBtn = $('#fetchBtn');
const $logBtn = $('#logBtn');

const $logsModule = $('#logsModule');
const $logsContainer = $('#logs');
const $closeLogs = $('#closeLogs');

const $overlayAddress = $('#overlayAddress');
const $overlayCoords = $('#overlayCoords');
const $overlayTime = $('#overlayTime');
const $overlayUsername = $('#overlayUsername');
const $overlayUserPhoto = $('#overlayUserPhoto');
const $overlay = $('#infoOverlay');

const overlayMapElement = document.getElementById("overlayMap"); // Renamed to avoid conflict
const dragHandle = document.getElementById("dragHandle");
const resizeHandle = document.getElementById("resizeHandle");

const $previewModal = $('#previewModal');
const $previewImage = $('#previewImage');
const $saveBtn = $('#saveBtn');
const $retakeBtn = $('#retakeBtn');

const $manualLocationModule = $('#manualLocationModule');
const $manualMapPlaceholder = $('#manualMapPlaceholder');
const $manualLatInput = $('#manualLatInput');
const $manualLngInput = $('#manualLngInput');
const $manualDateInput = $('#manualDateInput');
const $manualTimeInput = $('#manualTimeInput');
const $manualConfirmBtn = $('#manualConfirmBtn');
const $manualCancelBtn = $('#manualCancelBtn');

// Settings Module
const $settingsBtn = $('#settingsBtn');
const $settingsModule = $('#settingsModule');
const $settingsSaveBtn = $('#settingsSaveBtn');
const $settingsCancelBtn = $('#settingsCancelBtn');
const $settingDisplayName = $('#settingDisplayName');
const $settingPhotoURL = $('#settingPhotoURL');

// Gallery Module
const $galleryBtn = $('#galleryBtn');
const $galleryModule = $('#galleryModule');
const $galleryCloseBtn = $('#galleryCloseBtn');
const $galleryContent = $('#galleryContent');

let currentStream = null;
let facingMode = "environment";
let flashActive = false;
let map, mapMarker;
let manualMap, manualMarker;
let capturedImageData = null;
const logs = [];
let locationFailures = 0;
let currentLat = 0;
let currentLng = 0;
let currentTime = new Date();
let currentUsername = 'Guest';
let currentUserPhoto = 'Assets/default-user.png';
let isPortrait = window.matchMedia("(orientation: portrait)").matches; // Initial orientation check

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUsername = user.displayName || 'User';
        currentUserPhoto = user.photoURL || 'Assets/default-user.png';

        // Update Session & LocalStorage (optional sync)
        localStorage.setItem('userDisplayName', currentUsername);
        localStorage.setItem('userPhotoURL', currentUserPhoto);

        // Update UI
        $overlayUsername.text(currentUsername);
        $overlayUserPhoto.attr('src', currentUserPhoto);

        // Update Settings Inputs
        $settingDisplayName.val(currentUsername);
        $settingPhotoURL.val(currentUserPhoto);

        showToast(`Welcome, ${currentUsername}!`, 'success');
    } else {
        // Handle guest or signed out state
        currentUsername = 'Guest';
        currentUserPhoto = 'Assets/default-user.png';
        $overlayUsername.text(currentUsername);
        $overlayUserPhoto.attr('src', currentUserPhoto);
    }
});

const log = (msg) => {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${msg}`;
    logs.push(entry);
    // Keep only the last 50 logs to prevent performance issues
    if (logs.length > 50) logs.shift();
    $logsContainer.html(logs.map(l => `<div>${l}</div>`).join(""));
    $logsContainer.scrollTop($logsContainer[0].scrollHeight);
};

const showToast = (message, type = 'info', duration = 3000) => {
    const $toast = $(`<div class="toast animate__animated animate__fadeInRight ${type}">${message}</div>`);
    $('#notificationContainer').append($toast);

    setTimeout(() => {
        $toast.addClass('animate__fadeOutRight');
        $toast.on('animationend', () => {
            $toast.remove();
        });
    }, duration);
};

const flash = () => {
    $flashOverlay.addClass("active");
    setTimeout(() => $flashOverlay.removeClass("active"), 200);
};

$flashBtn.on("click", () => {
    flashActive = !flashActive;
    const flashIcon = $flashBtn.find(".material-symbols-outlined");
    flashIcon.text(flashActive ? "flash_on" : "flash_off");
    log(`Flash ${flashActive ? 'enabled' : 'disabled'}.`);
    $flashBtn.toggleClass('is-flashing', flashActive);
});

const createUserIcon = (photoURL) => {
    const fallbackLogo = './Assets/icons/icon-256x256.png'; // Corrected path if needed
    let imageUrl = photoURL || fallbackLogo;

    const img = new Image();
    img.src = imageUrl;
    img.onerror = () => {
        console.warn(`⚠️ Failed to load user photo (${imageUrl}), using app logo.`);
        imageUrl = fallbackLogo;
    };

    return L.divIcon({
        className: 'custom-user-marker',
        html: `
            <div style="
                background-color : white; /* Ensures background if image is transparent */
                background-image: url('${imageUrl}');
                background-size: cover;
                background-position: center;
                border: 3px solid var(--primary-color); /* Changed to use CSS variable */
                border-radius: 50%;
                width: 32px;
                height: 32px;
                box-shadow: 0 0 5px rgba(0,0,0,0.5);
            "></div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
};


const updateOverlay = (lat, lng, addressHTML, date, username = 'Guest', userPhoto) => {
    const fallbackLogo = './Assets/icons/icon-256x256.png'; // Changed to default-user.png from geo.html

    currentLat = lat;
    currentLng = lng;
    currentTime = date;
    currentUsername = username;
    currentUserPhoto = userPhoto || fallbackLogo;

    localStorage.setItem('lastLat', lat);
    localStorage.setItem('lastLng', lng);

    $overlayCoords.text(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
    $overlayAddress.html(addressHTML || "Address not found");
    const formattedTime = date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    $overlayTime.text(formattedTime);

    if ($overlayUsername.length && $overlayUserPhoto.length) {
        $overlayUsername.text(username);
        $overlayUserPhoto.attr('src', currentUserPhoto);

        $overlayUserPhoto.off('error').on('error', function () {
            console.warn(`⚠️ User photo failed to load, using default.`);
            $(this).attr('src', fallbackLogo);
        });
    }
};

const initManualMap = (initialLat = 0, initialLng = 0) => {
    if (manualMap) {
        manualMap.remove();
    }

    manualMap = L.map("manualMapPlaceholder", {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true,
    }).setView([initialLat, initialLng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(manualMap);

    manualMarker = L.marker([initialLat, initialLng], { draggable: true }).addTo(manualMap);

    L.Control.CurrentLocation = L.Control.extend({
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            container.style.backgroundColor = 'white';
            container.style.width = '30px';
            container.style.height = '30px';
            container.style.lineHeight = '30px';
            container.style.textAlign = 'center';
            container.style.cursor = 'pointer';
            container.style.fontSize = '18px'; // Make icon visible
            container.innerHTML = '📍';

            container.onclick = function () {
                map.locate({ setView: true, maxZoom: 16 });
            }

            return container;
        },

        onRemove: function (map) {
            // Nothing to do here
        }
    });

    L.control.currentLocation = function (opts) {
        return new L.Control.CurrentLocation(opts);
    }

    L.control.currentLocation({ position: 'topleft' }).addTo(manualMap);

    manualMap.on('locationfound', (e) => {
        const { lat, lng } = e.latlng;
        manualMarker.setLatLng([lat, lng]);
        $manualLatInput.val(lat.toFixed(6));
        $manualLngInput.val(lng.toFixed(6));
        L.circle(e.latlng, e.accuracy, {
            weight: 1,
            color: '#136AEC',
            fillColor: '#136AEC',
            fillOpacity: 0.2
        }).addTo(manualMap);
        showToast("Device location found for manual input.", 'info');
    });

    manualMap.on('locationerror', (e) => {
        console.error("Location access denied or failed: " + e.message);
        showToast("Could not find your location. Please ensure location services are enabled.", 'error');
    });

    manualMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        $manualLatInput.val(lat.toFixed(6));
        $manualLngInput.val(lng.toFixed(6));
    });

    manualMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        manualMarker.setLatLng([lat, lng]);
        $manualLatInput.val(lat.toFixed(6));
        $manualLngInput.val(lng.toFixed(6));
    });

    setTimeout(() => manualMap.invalidateSize(true), 100);
};

const showManualLocationInput = () => {
    $manualLocationModule.removeClass('hidden').find('> div').removeClass('animate__fadeOutDown').addClass('animate__fadeInUp');

    $manualLatInput.val(currentLat.toFixed(6));
    $manualLngInput.val(currentLng.toFixed(6));

    const now = new Date();
    $manualDateInput.val(now.toISOString().substring(0, 10));
    $manualTimeInput.val(now.toTimeString().substring(0, 5));

    initManualMap(currentLat, currentLng);
    log("Manual location input displayed.");
};

const processManualLocation = async () => {
    const lat = parseFloat($manualLatInput.val());
    const lng = parseFloat($manualLngInput.val());
    const dateStr = $manualDateInput.val();
    const timeStr = $manualTimeInput.val();

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showToast("Invalid Latitude (-90 to 90) or Longitude (-180 to 180).", 'error');
        return;
    }
    if (!dateStr || !timeStr) {
        showToast("Please enter a valid Date and Time.", 'error');
        return;
    }

    const manualDateTime = new Date(`${dateStr}T${timeStr}:00`);
    if (isNaN(manualDateTime)) {
        showToast("Invalid Date or Time format.", 'error');
        return;
    }

    $manualLocationModule.find('> div').removeClass('animate__fadeInUp').addClass('animate__fadeOutDown');
    $manualLocationModule.on('animationend', function () {
        if ($(this).find('> div').hasClass('animate__fadeOutDown')) {
            $(this).addClass('hidden');
            $(this).off('animationend');
        }
    });

    log(`Manual data accepted: ${lat.toFixed(6)}, ${lng.toFixed(6)} at ${manualDateTime.toLocaleString()}`);

    await reverseGeocodeAndRender(lat, lng, manualDateTime);
};

const reverseGeocodeAndRender = async (latitude, longitude, date = new Date()) => {
    let addressHTML = "Fetching address...";

    const username = localStorage.getItem('userDisplayName') || 'Guest'; // Defaulting to 'Guest'
    const userPhoto = localStorage.getItem('userPhotoURL') || 'Assets/default-user.png'; // Defaulting to default-user.png
    const userIcon = createUserIcon(userPhoto);

    try {
        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        let fullAddress = data.formattedAddress;

        if (!fullAddress) {
            const addrParts = [
                data.houseNumber,
                data.street,
                data.locality,
                data.city,
                data.principalSubdivision,
                data.postcode,
                data.countryName
            ].filter(Boolean);
            fullAddress = addrParts.join(', ');
        }

        addressHTML = fullAddress;

        const postalCode = data.postcode || '';
        if (postalCode) {
            addressHTML = addressHTML.replace(postalCode, `<span class="pin-code">${postalCode}</span>`);
        }

    } catch (err) {
        log("BigDataCloud failed, switching to Nominatim fallback...");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
                {
                    headers: {
                        "Accept-Language": "en",
                        "User-Agent": "GeoTaggingOnline/1.0 (contact: support@example.com)"
                    },
                    signal: controller.signal
                }
            );
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const address = data.address || {};

            const addrParts = [
                address.road,
                address.house_number,
                address.neighbourhood,
                address.suburb,
                address.village || address.town || address.city,
                address.state_district,
                address.state,
                address.postcode,
                address.country
            ].filter(Boolean);

            addressHTML = data.display_name || addrParts.join(', ');

            const postalCode = address.postcode || '';
            if (postalCode) {
                addressHTML = addressHTML.replace(postalCode, `<span class="pin-code">${postalCode}</span>`);
            }

        } catch (err2) {
            clearTimeout(timeoutId);
            log("Reverse Geocoding failed: " + (err2.name === 'AbortError' ? 'Timeout' : err2.message));
            addressHTML = "⚠️ Full address unavailable";
        }
    }

    updateOverlay(latitude, longitude, addressHTML, date, username, userPhoto);

    const initialZoom = 17;
    if (!map) {
        map = L.map(overlayMapElement, { // Use the renamed element here
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false
        }).setView([latitude, longitude], initialZoom);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        mapMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);

    } else {
        map.setView([latitude, longitude], initialZoom);
        if (mapMarker) {
            mapMarker.setLatLng([latitude, longitude]);
            mapMarker.setIcon(userIcon);
        } else {
            mapMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map);
        }
    }

    // Force map redraw to fix tile issues after resize/reposition
    setTimeout(() => map.invalidateSize(true), 500);
    locationFailures = 0;
};

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    try {
        // Request higher resolution for better geotagging quality
        const constraints = {
            video: {
                facingMode,
                width: { ideal: 1920 }, // Increased ideal width
                height: { ideal: 1080 } // Increased ideal height
            },
            audio: false
        };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        $cameraView[0].srcObject = currentStream;
        log(`Camera started (${facingMode}).`);

        // Set the CSS variable for mirroring based on facingMode
        if (facingMode === "user") {
            $cameraView.css('--camera-scaleX', '-1'); // Flip horizontally for selfie cam
        } else {
            $cameraView.css('--camera-scaleX', '1'); // Normal for environment cam
        }

    } catch (err) {
        log(`Camera error: ${err.name} - ${err.message}`);
        showToast("Unable to access camera. Check permissions and try again.", 'error');
        // Fallback to manual input if camera fails to start repeatedly?
    }
}

$rotateBtn.on("click", () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    startCamera();
});

const mapToImage = () => {
    return new Promise((resolve, reject) => {
        if (!map) return resolve(null);

        const controls = overlayMapElement.querySelectorAll('.leaflet-control-container, .leaflet-control');
        controls.forEach(c => c.style.visibility = 'hidden');

        const markerIcon = mapMarker?._icon;
        if (markerIcon) markerIcon.style.visibility = 'visible';

        html2canvas(overlayMapElement, { // Use renamed element
            allowTaint: true,
            useCORS: true,
            scale: 2,
            backgroundColor: null,
        }).then(canvas => {
            controls.forEach(c => c.style.visibility = 'visible');
            if (markerIcon) markerIcon.style.visibility = '';

            const img = document.createElement('img');
            img.src = canvas.toDataURL('image/png');
            img.className = 'map-snapshot';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            resolve(img);
        }).catch(err => {
            log("Map to image conversion failed: " + err.message);
            reject(err);
        });
    });
};

$captureBtn.on("click", async () => {
    $captureBtn.addClass('is-capturing');

    try {
        if (flashActive) flash();
        log("Capturing image with Geo Tag...");

        $overlay.css('visibility', 'visible');

        // Temporarily hide drag/resize handles and UI elements before capture
        if (dragHandle) dragHandle.style.visibility = 'hidden';
        if (resizeHandle) resizeHandle.style.visibility = 'hidden';

        const mapImageElement = await mapToImage();
        let mapElementPlaceholder = [];

        if (mapImageElement) {
            mapElementPlaceholder = Array.from(overlayMapElement.children); // Use renamed element
            overlayMapElement.innerHTML = '';
            overlayMapElement.appendChild(mapImageElement);
        }

        const logsWasOpen = !$logsModule.hasClass('hidden');
        if (logsWasOpen) $logsModule.addClass('hidden');
        $flashOverlay.css('visibility', 'hidden');
        $flashOverlay.css('visibility', 'hidden');
        $('#bottomDeck').css('visibility', 'hidden');
        $('#topBar').css('visibility', 'hidden');

        // Use a slight delay to ensure all CSS visibility changes are applied
        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = await html2canvas($cameraContainer[0], {
            allowTaint: true,
            useCORS: true,
            scale: 2,
            removeContainer: true,
        });

        // Restore map elements and UI visibility
        if (mapImageElement && mapElementPlaceholder.length > 0) {
            overlayMapElement.innerHTML = '';
            mapElementPlaceholder.forEach(child => overlayMapElement.appendChild(child));
            map.invalidateSize();
        }

        $overlay.css('visibility', '');
        if (dragHandle) dragHandle.style.visibility = '';
        if (resizeHandle) resizeHandle.style.visibility = '';
        $flashOverlay.css('visibility', 'visible');
        $flashOverlay.css('visibility', 'visible');
        $('#bottomDeck').css('visibility', 'visible');
        $('#topBar').css('visibility', 'visible');
        if (logsWasOpen) $logsModule.removeClass('hidden');

        capturedImageData = canvas.toDataURL("image/png");

        $previewImage.attr('src', capturedImageData);

        $previewModal.removeClass('hidden');
        $previewModal.find('> div').removeClass('animate__fadeOutDown').addClass('animate__zoomIn');

        log("Preview modal displayed.");
        $overlay.addClass('pointer-events-none'); // Prevent interaction with overlay behind modal

    } catch (err) {
        log("Capture error: " + err.message);
        showToast("Capture failed. Please retry.", 'error');
    } finally {
        $captureBtn.removeClass('is-capturing');
    }
});


const closeModalAndReenable = (element) => {
    element.find('> div').removeClass('animate__zoomIn animate__fadeInUp').addClass('animate__fadeOutDown');
    element.on('animationend', function () {
        if ($(this).find('> div').hasClass('animate__fadeOutDown')) {
            $(this).addClass('hidden');
            $(this).off('animationend'); // Remove listener after animation
        }
    });
    $overlay.removeClass('pointer-events-none');
};

$saveBtn.on("click", () => {
    if (capturedImageData) {
        const link = document.createElement("a");
        link.href = capturedImageData;
        link.download = `GeoTag_${Date.now()}.png`;
        log("Image saved.");
        link.click();
        showToast("Image saved successfully.", 'success');
    }
    closeModalAndReenable($previewModal);
});

$retakeBtn.on("click", () => {
    log("Preview closed. Retaking image.");
    closeModalAndReenable($previewModal);
});

$('#previewModal .close-modal-btn').on('click', () => {
    log("Preview closed via X. Retaking image.");
    closeModalAndReenable($previewModal);
});

// --- Settings Logic ---
$settingsBtn.on('click', () => {
    $settingDisplayName.val(localStorage.getItem('userDisplayName') || '');
    $settingPhotoURL.val(localStorage.getItem('userPhotoURL') || '');
    $settingsModule.removeClass('hidden');
});

$settingsCancelBtn.on('click', () => {
    $settingsModule.addClass('hidden');
});

$('#settingsCloseX').on('click', () => {
    $settingsModule.addClass('hidden');
});

$settingsSaveBtn.on('click', () => {
    const name = $settingDisplayName.val().trim();
    const photo = $settingPhotoURL.val().trim();

    if (name) localStorage.setItem('userDisplayName', name);
    if (photo) localStorage.setItem('userPhotoURL', photo);

    // Update current session variables
    currentUsername = name || 'Guest';
    currentUserPhoto = photo || 'Assets/default-user.png';

    // Refresh Overlay
    $overlayUsername.text(currentUsername);
    $overlayUserPhoto.attr('src', currentUserPhoto);

    showToast('Settings saved!', 'success');
    $settingsModule.addClass('hidden');
});

// --- Gallery Logic ---
$galleryBtn.on('click', () => {
    $galleryModule.removeClass('hidden');
    loadGallery(); // Need to implement or ensure it exists
});

$galleryCloseBtn.on('click', () => {
    $galleryModule.addClass('hidden');
});

$('#galleryCloseX').on('click', () => {
    $galleryModule.addClass('hidden');
});

const loadGallery = () => {
    // Simple placeholder logic for now, as real gallery might need IndexedDB or similar
    // For this task, we just ensure the module opens/closes.
    // If we were saving images to localStorage, we could list them here.
    console.log("Gallery opened");
};

async function fetchLocation() {
    if (!navigator.geolocation) {
        showToast("Geolocation not supported by this browser.", 'error');
        log("Geolocation not supported.");
        return;
    }

    $overlayAddress.html("📡 Fetching current address...");
    $overlayCoords.text("Lat: ---, Lng: ---");
    log("Requesting current location...");
    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            });
        });

        locationFailures = 0;

        const { latitude, longitude } = pos.coords;

        await reverseGeocodeAndRender(latitude, longitude, new Date());
        showToast("Location updated successfully.", 'success'); // Changed to success for good UX

    } catch (err) {
        locationFailures++;
        log(`Geolocation failed (Attempt ${locationFailures}/3): ${err.message}`);

        const errorMsg = err.code === 1
            ? "🛑 Permission denied. Please enable location services."
            : err.message.includes("timeout")
                ? "⏱️ Location request timed out. Try moving outside."
                : "❌ Unable to get GPS location.";

        if (locationFailures >= 3) {
            log("Maximum geolocation failures reached. Opening manual input.");
            showManualLocationInput();
        } else {
            showToast(errorMsg, 'error');

            updateOverlay(currentLat, currentLng, `<span style="color: red;">${errorMsg}</span><br>Location Unavailable`, new Date());
        }

        $overlayCoords.text("Lat: Error, Lng: Error");
    }
}

$fetchBtn.on("click", fetchLocation);

$manualConfirmBtn.on("click", processManualLocation);
$manualCancelBtn.on("click", () => {
    log("Manual location input cancelled.");
    closeModalAndReenable($manualLocationModule);
});

const updateMapFromManualInputs = () => {
    const lat = parseFloat($manualLatInput.val());
    const lng = parseFloat($manualLngInput.val());

    if (manualMap && manualMarker && !isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180) {
        manualMarker.setLatLng([lat, lng]);
        manualMap.setView([lat, lng], manualMap.getZoom(), { animate: true });
    }
};
$manualLatInput.on('input', updateMapFromManualInputs);
$manualLngInput.on('input', updateMapFromManualInputs);

$('#logBtn').on("click", () => {
    $logsModule.toggleClass("hidden");
    if (!$logsModule.hasClass('hidden')) {
        $logsContainer.scrollTop($logsContainer[0].scrollHeight); // Scroll to bottom when opening
    }
});

$closeLogs.on("click", () => $logsModule.addClass("hidden"));

// =========================================
// Overlay Drag & Resize Logic REMOVED for Native App Look
// =========================================
// The new UI uses a fixed 'Tech Overlay' or 'Data Stamp' which is standard for these apps.
// Drag/Resize logic has been removed to prevent errors with missing handles.

// =========================================
// Orientation / Resize Handling
// =========================================
function applyOrientationClass() {
    if (window.matchMedia("(orientation: portrait)").matches) {
        $('body').removeClass('landscape-mode').addClass('portrait-mode');
        log("Orientation: Portrait Mode.");
    } else {
        $('body').removeClass('portrait-mode').addClass('landscape-mode');
        log("Orientation: Landscape Mode.");
    }

    // Force map redraws on orientation change
    if (map) setTimeout(() => map.invalidateSize(true), 200);
    if (manualMap) setTimeout(() => manualMap.invalidateSize(true), 200);
}

// Listen for orientation changes
window.matchMedia("(orientation: portrait)").addEventListener("change", () => {
    setTimeout(applyOrientationClass, 100);
});

$(window).on('resize', () => {
    setTimeout(applyOrientationClass, 100);
});


const loadLastLocation = () => {
    const lastLat = parseFloat(localStorage.getItem('lastLat'));
    const lastLng = parseFloat(localStorage.getItem('lastLng'));

    if (!isNaN(lastLat) && !isNaN(lastLng)) {
        currentLat = lastLat;
        currentLng = lastLng;
        log(`Loaded last coordinates from localStorage: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}.`);
        updateOverlay(currentLat, currentLng, "Last known location.", new Date());
    }
}

// =========================================
// Initialization
// =========================================
$(document).ready(() => {
    log("Initializing GeoTag Pro...");

    applyOrientationClass(); // Set initial orientation
    loadLastLocation();      // Load cached location
    startCamera();           // Start camera stream
    fetchLocation();         // Fetch fresh GPS
});

