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

const overlayMap = document.getElementById("overlayMap");
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


const log = (msg) => {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${msg}`;
    logs.push(entry);
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
    const fallbackLogo = './Assets/icons/icon-256x256.png';
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
                background-color : white;
                background-image: url('${imageUrl}');
                background-size: cover;
                background-position: center;
                border: 3px solid var(--color-primary);
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
    const fallbackLogo = 'Assets/icons/icon-256x256.png';

    currentLat = lat;
    currentLng = lng;
    currentTime = date;
    currentUsername = username;
    currentUserPhoto = userPhoto || fallbackLogo;

    localStorage.setItem('lastLat', lat);
    localStorage.setItem('lastLng', lng);
    
    $overlayCoords.text(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
    $overlayAddress.html(addressHTML || "Address not found");
    $overlayTime.text(`Time: ${date.toLocaleString()}`);

    if ($overlayUsername.length && $overlayUserPhoto.length) {
        $overlayUsername.text(username);
        $overlayUserPhoto.attr('src', currentUserPhoto);

        $overlayUserPhoto.off('error').on('error', function() {
            console.warn(`⚠️ User photo failed to load, using app logo.`);
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
    
    // --- Current Location Button Implementation ---

    // 1. Define the custom control (this uses Leaflet's pattern for custom buttons)
    L.Control.CurrentLocation = L.Control.extend({
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            
            // Set the button's appearance (e.g., using a location icon emoji or an icon class)
            container.style.backgroundColor = 'white';
            container.style.width = '40px';
            container.style.height = '40px';
            container.style.lineHeight = '30px';
            container.style.textAlign = 'center';
            container.style.cursor = 'pointer';
            container.innerHTML = '📍'; // Location pin icon
            
            // 2. Add the click handler to call map.locate()
            container.onclick = function() {
                map.locate({ setView: true, maxZoom: 16 });
            }

            return container;
        },

        onRemove: function(map) {
            // Nothing to do here
        }
    });

    L.control.currentLocation = function(opts) {
        return new L.Control.CurrentLocation(opts);
    }

    // Add the custom control to the map
    L.control.currentLocation({ position: 'topleft' }).addTo(manualMap);

    // 3. Handle successful location finding
    manualMap.on('locationfound', (e) => {
        const { lat, lng } = e.latlng;
        // Update the marker position
        manualMarker.setLatLng([lat, lng]); 
        // Update the hidden input fields (assuming these are defined elsewhere)
        $manualLatInput.val(lat.toFixed(6));
        $manualLngInput.val(lng.toFixed(6));
        // Add a circle to show the accuracy radius
        L.circle(e.latlng, e.accuracy, {
            weight: 1, 
            color: '#136AEC', 
            fillColor: '#136AEC', 
            fillOpacity: 0.2
        }).addTo(manualMap);
    });
    
    // 4. Handle location error
    manualMap.on('locationerror', (e) => {
        console.error("Location access denied or failed: " + e.message);
        alert("Could not find your location. Please ensure location services are enabled.");
    });

    // --- Original Event Handlers ---
    
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
    $manualLocationModule.on('animationend', function() {
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

    const username = localStorage.getItem('userName') || 'Guest User';
    const userPhoto = localStorage.getItem('userPhoto') || 'Assets/icons/icon-256x256.png';
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
        map = L.map(overlayMap, {
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


    setTimeout(() => map.invalidateSize(true), 500);
    locationFailures = 0;
};

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    try {
        const constraints = {
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        };
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        $cameraView[0].srcObject = currentStream;
        log(`Camera started (${facingMode}).`);
    } catch (err) {
        log(`Camera error: ${err.message}`);
        showToast("Unable to access camera. Check permissions.", 'error');
    }
}

$rotateBtn.on("click", () => {
    facingMode = facingMode === "environment" ? "user" : "environment";
    startCamera();
});

const mapToImage = () => {
    return new Promise((resolve, reject) => {
        if (!map) return resolve(null);
        
        const controls = overlayMap.querySelectorAll('.leaflet-control-container, .leaflet-control');
        controls.forEach(c => c.style.visibility = 'hidden');
        
        const markerIcon = mapMarker?._icon;
        if (markerIcon) markerIcon.style.visibility = 'visible';

        html2canvas(overlayMap, {
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

        if (dragHandle) dragHandle.style.visibility = 'hidden';
        if (resizeHandle) resizeHandle.style.visibility = 'hidden';

        const mapImageElement = await mapToImage();
        let mapElementPlaceholder = []; 

        if (mapImageElement) {
            mapElementPlaceholder = Array.from(overlayMap.children);
            overlayMap.innerHTML = '';
            overlayMap.appendChild(mapImageElement);
        }
        
        const logsWasOpen = !$logsModule.hasClass('hidden');
        if (logsWasOpen) $logsModule.addClass('hidden');
        $flashOverlay.css('visibility', 'hidden');
        $('#controlPanel').css('visibility', 'hidden'); 
        $('nav').css('visibility', 'hidden'); 

        const canvas = await html2canvas($cameraContainer[0], {
            allowTaint: true,
            useCORS: true, 
            scale: 2,         
            removeContainer: true,
        });

        if (mapImageElement && mapElementPlaceholder.length > 0) {
            overlayMap.innerHTML = '';
            mapElementPlaceholder.forEach(child => overlayMap.appendChild(child));
            map.invalidateSize();
        }

        $overlay.css('visibility', ''); 
        if (dragHandle) dragHandle.style.visibility = '';
        if (resizeHandle) resizeHandle.style.visibility = '';
        $flashOverlay.css('visibility', 'visible');
        $('#controlPanel').css('visibility', 'visible'); 
        $('nav').css('visibility', 'visible'); 
        if (logsWasOpen) $logsModule.removeClass('hidden');

        capturedImageData = canvas.toDataURL("image/png");
        
        $previewImage.attr('src', capturedImageData);
        
        $previewModal.removeClass('hidden');
        $previewModal.find('> div').removeClass('animate__fadeOutDown').addClass('animate__zoomIn');
        
        log("Preview modal displayed.");
        $overlay.addClass('pointer-events-none'); 

    } catch (err) {
        log("Capture error: " + err.message);
        showToast("Capture failed. Please retry.", 'error');
    } finally {
        $captureBtn.removeClass('is-capturing');
    }
});


const closeModalAndReenable = (element) => {
    element.find('> div').removeClass('animate__zoomIn animate__fadeInUp').addClass('animate__fadeOutDown');
    element.on('animationend', function() {
        if ($(this).find('> div').hasClass('animate__fadeOutDown')) {
            $(this).addClass('hidden');
            $(this).off('animationend');
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

async function fetchLocation() {
    if (!navigator.geolocation) {
        showToast("Geolocation not supported by this browser.", 'error');
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
        showToast("Location updated successfully.", 'info');

    } catch (err) {
        locationFailures++;
        log(`Geolocation failed (Attempt ${locationFailures}/3).`);

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

$('nav #logBtn').on("click", () => {
    $logsModule.toggleClass("hidden");
});

$closeLogs.on("click", () => $logsModule.addClass("hidden"));

let drag = false, resize = false, startX, startY;
const getCoords = (e) => e.touches ? e.touches[0] : e;
let offsetX = 0;
let offsetY = 0;
let containerRect;

const startInteraction = (e) => {
    if (!$previewModal.hasClass('hidden') || !$manualLocationModule.hasClass('hidden')) return;
    
    e.preventDefault(); 
    
    containerRect = $cameraContainer[0].getBoundingClientRect(); 
    const targetId = e.currentTarget.id;

    if (targetId === "resizeHandle") {
        if (window.getComputedStyle(resizeHandle).display === 'none') return; 
        resize = true;
        drag = false;
    } else if (targetId === "dragHandle" || e.currentTarget === $overlay[0]) {
        drag = true;
        resize = false;
    } else {
        return; 
    }

    const { clientX, clientY } = getCoords(e);
    
    if (drag) {
        offsetX = clientX - $overlay[0].offsetLeft;
        offsetY = clientY - $overlay[0].offsetTop;
    } else if (resize) {
        startX = clientX;
        startY = clientY;
    }

    $overlay.addClass('is-interacting');
};

$overlay.on("mousedown touchstart", "#dragHandle, #resizeHandle", startInteraction);
$overlay.on("mousedown touchstart", (e) => {
    if (e.target.id === 'infoOverlay') {
        startInteraction(e);
    }
});


$(document).on("mousemove touchmove", (e) => {
    if (!drag && !resize) return;
    
    e.preventDefault(); 
    
    const { clientX, clientY } = getCoords(e);
    
    if (drag) {
        let newLeft = clientX - offsetX;
        let newTop = clientY - offsetY;

        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - $overlay.outerWidth()));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - $overlay.outerHeight()));

        $overlay.css({ left: `${newLeft}px`, top: `${newTop}px` });

    } else if (resize) {
        const dx = clientX - startX;
        const dy = clientY - startY;
        
        let currentWidth = $overlay.outerWidth();
        let currentHeight = $overlay.outerHeight();

        const MIN_WIDTH = 300; 
        const MIN_HEIGHT = 150; 

        const newWidth = Math.max(MIN_WIDTH, currentWidth + dx);
        const newHeight = Math.max(MIN_HEIGHT, currentHeight + dy);
        
        const maxPossibleWidth = containerRect.width - $overlay[0].offsetLeft;
        const maxPossibleHeight = containerRect.height - $overlay[0].offsetTop;

        $overlay.css({ 
            width: `${Math.min(newWidth, maxPossibleWidth)}px`, 
            height: `${Math.min(newHeight, maxPossibleHeight)}px` 
        });

        startX = clientX;
        startY = clientY;
        
        if (map) map.invalidateSize(false); 
    }
});

$(document).on("mouseup touchend touchcancel", () => {
    if (drag || resize) {
        drag = false;
        resize = false;
        $overlay.removeClass('is-interacting');
        
        if (map) {
            map.invalidateSize(true);
            log("Overlay resize/drag finished. Map redrawn.");
        } else {
            log("Overlay interaction ended.");
        }
    }
});

let orientationTimer;
$(window).on('resize', () => {
    clearTimeout(orientationTimer);
    orientationTimer = setTimeout(() => {
        log("Device orientation changed. Adjusting overlay and map.");

        containerRect = $cameraContainer[0].getBoundingClientRect();
        
        let currentLeft = $overlay[0].offsetLeft;
        let currentTop = $overlay[0].offsetTop;
        
        let newLeft = Math.max(0, Math.min(currentLeft, containerRect.width - $overlay.outerWidth()));
        let newTop = Math.max(0, Math.min(currentTop, containerRect.height - $overlay.outerHeight()));

        $overlay.css({ left: `${newLeft}px`, top: `${newTop}px` });

        if (map) {
            map.invalidateSize(true);
        }
    }, 300);
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

$(document).ready(() => {
    log("Initializing GeoTag Pro...");
    loadLastLocation();
    startCamera();
    fetchLocation();
});
