// Offline Queue Management
let offlineQueue = [];

// Load queue from local storage
function loadOfflineQueue() {
    const savedQueue = localStorage.getItem('diary_offline_queue');
    if (savedQueue) {
        offlineQueue = JSON.parse(savedQueue);
    }
}

// Save queue to local storage
function saveOfflineQueue() {
    localStorage.setItem('diary_offline_queue', JSON.stringify(offlineQueue));
}

// Add change to queue
export function queueOfflineChange(dateStr, entryData) {
    offlineQueue.push({
        dateStr,
        entryData,
        timestamp: new Date().toISOString()
    });
    saveOfflineQueue();
}

// Process offline queue when back online
export async function processOfflineQueue() {
    if (!navigator.onLine || !isFirebaseConnected || offlineQueue.length === 0) {
        return;
    }

    showToast("Syncing offline changes...", "info");
    
    const successfulSyncs = [];
    
    for (const item of offlineQueue) {
        try {
            await set(ref(db, `users/${storedUID}/entries/${item.dateStr}`), item.entryData);
            successfulSyncs.push(item);
        } catch (err) {
            console.error("Error syncing offline change:", err);
        }
    }

    // Remove successful syncs from queue
    offlineQueue = offlineQueue.filter(item => !successfulSyncs.includes(item));
    saveOfflineQueue();

    if (successfulSyncs.length > 0) {
        showToast(`Synced ${successfulSyncs.length} offline changes`, "success");
    }
}