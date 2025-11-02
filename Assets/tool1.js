// =======================================================
// ONLINE.JS: FIREBASE, DATA MANAGEMENT, AND TABLE RENDERING
// Functions here require Firebase/RTDB and user authentication.
// =======================================================

let currentUserData = [];

// --- 1. Firebase/Auth/Data Functions ---

// NOTE: googleLogin and signOutUser are assumed to be handled in index.html
// or another separate script where the Firebase SDK is initialized, but 
// their handlers are kept here for completeness and to use the same logic 
// as the combined file.

window.googleLogin = async function() {
    if (!window.firebase || !window.firebase.auth || !window.firebase.signInWithPopup) {
        return window.showToast("Authentication services are not initialized.", 'danger');
    }
    
    try {
        window.showToast("Opening Google Sign-In...", 'info');
        // Assuming Firebase object is globally available with required methods
        await window.firebase.signInWithPopup(
            window.firebase.auth, 
            window.firebase.googleProvider
        );
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            window.showToast("Sign-in window closed.", 'warning');
        } else {
            console.error("Firebase Sign-In Error:", error);
            window.showToast(`Sign-in failed: ${error.message}`, 'danger');
        }
    }
};

window.signOutUser = async function() {
    try {
        await window.firebase.auth.signOut(); 
        window.FIREBASE_USER_UID = null;
        localStorage.clear();
        window.firebaseAuthRequiredHandler();
        $('#notesTable tbody').empty();
        window.showToast("You have been signed out.", 'info');
    } catch (error) {
        window.showToast("Sign-out failed. Please try again.", 'danger');
    }
};

window.firebaseAuthSuccessHandler = function(user) {
    if (!user) { user = window.firebase.auth.currentUser; }

    const fallbackLogo = './Assets/icons/icon-256x256.png';
    const photoURL = user.photoURL || fallbackLogo;
    const displayName = user.displayName || 'User';
    const email = user.email || 'N/A';

    localStorage.setItem('userDisplayName', displayName);
    localStorage.setItem('userPhotoURL', photoURL);

    window.enableTools(); // From offline.js

    // Update profile display
    const $userPhoto = $('#userPhoto');
    const $modalUserPhoto = $('#modalUserPhoto');

    $userPhoto.attr('src', photoURL).off('error').on('error', function() { $(this).attr('src', fallbackLogo); });
    $modalUserPhoto.attr('src', photoURL).off('error').on('error', function() { $(this).attr('src', fallbackLogo); });

    $('#userName').text(displayName);
    $('#modalUserName').text(displayName);
    $('#modalUserEmail').text(email);

    window.showToast(`Welcome back, ${displayName}!`, 'success');

    // Load data only when a modal is fully shown
    $('#leadManageModal').off('shown.bs.modal').on('shown.bs.modal', window.loadAndRenderData);
    $('#quickNoteModal').off('shown.bs.modal').on('shown.bs.modal', window.loadAndRenderQuickNotes);
};

window.firebaseAuthRequiredHandler = function() {
    window.disableTools(); // From offline.js
};

// --- RTDB Fetchers and Savers ---

window.fetchSheetDBData = async function() {
  if (!window.FIREBASE_USER_UID || !window.RTDB) return [];

  try {
    const path = `datatable/${window.FIREBASE_USER_UID}/tabledata`;
    const userLeadsRef = firebase.database.ref(window.RTDB, path);
    const snapshot = await firebase.database.get(userLeadsRef);
    const data = snapshot.val();

    if (!data) return [];

    return Object.keys(data).map(key => ({
      ...data[key],
      RTDBKey: key,
    }));

  } catch (error) {
    console.error("❌ Fetch Error:", error);
    window.showToast(`Failed to load lead data: ${error.message}`, 'danger');
    return [];
  }
};

window.fetchQuickNotes = async function() {
    if (!window.FIREBASE_USER_UID || !window.RTDB) { return []; }
    // ... (Note fetch logic) ...
    try {
        const path = `datatable/${window.FIREBASE_USER_UID}/quicknotes`;
        const notesRef = firebase.database.ref(window.RTDB, path);
        const snapshot = await firebase.database.get(notesRef);
        const data = snapshot.val();
        
        if (!data) { return []; }

        return Object.keys(data).map(key => ({
            ...data[key],
            RTDBKey: key, 
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); 

    } catch (error) {
        window.showToast(`Failed to load quick notes: ${error.message}`, 'danger');
        return [];
    }
};

window.saveLeadEntry = async function(leadData) {
  if (!window.FIREBASE_USER_UID || !window.RTDB) {
    window.showToast("Cannot save data. User not authenticated.", 'danger');
    return false;
  }
  // ... (Lead save logic) ...
  const path = `datatable/${window.FIREBASE_USER_UID}/tabledata`;
  const dataToSend = {
    ...leadData,
    DateAdded: new Date().toLocaleString(),
    LastEdited: 'N/A',
    timestamp: window.firebase.database.serverTimestamp(),
  };

  try {
    const userLeadsRef = firebase.database.ref(window.RTDB, path);
    await firebase.database.push(userLeadsRef, dataToSend);
    window.showToast("✅ Lead entry saved successfully!", 'success');
    return true;
  } catch (error) {
    console.error("❌ Save Error:", error);
    window.showToast(`Failed to save lead: ${error.message}`, 'danger');
    return false;
  }
};

window.saveEditedLead = async function(rtdbKey, updatedData) {
    if (!window.FIREBASE_USER_UID || !window.RTDB) {
        return window.showToast("Cannot update data. User not authenticated.", 'danger');
    }
    // ... (Lead edit logic) ...
    const { ref, update } = window.firebase.database; 

    const path = `datatable/${window.FIREBASE_USER_UID}/tabledata/${rtdbKey}`;
    
    const dataToUpdate = {
        ...updatedData,
        LastEdited: new Date().toLocaleString(),
    };

    try {
        const leadRef = ref(window.RTDB, path);
        await update(leadRef, dataToUpdate);
        
        window.showToast("✏️ Lead updated successfully!", 'success');
        return true;
    } catch (error) {
        console.error("❌ Update Error:", error);
        window.showToast(`Failed to update lead: ${error.message}`, 'danger');
        return false;
    }
};

window.deleteSheetDBRow = async function(rtdbKey) {
  if (!window.FIREBASE_USER_UID || !window.RTDB) {
    return window.showToast("Cannot delete data. User not authenticated.", 'danger');
  }
  // ... (Lead delete logic) ...
  try {
    const path = `datatable/${window.FIREBASE_USER_UID}/tabledata/${rtdbKey}`;
    const leadRef = firebase.database.ref(window.RTDB, path);
    await firebase.database.remove(leadRef);

    window.showToast("🗑️ Lead deleted successfully!", 'success');
    return true;
  } catch (error) {
    console.error("❌ Delete Error:", error);
    window.showToast(`Failed to delete lead: ${error.message}`, 'danger');
    return false;
  }
};

window.saveQuickNote = async function(noteText) {
    if (!window.FIREBASE_USER_UID || !window.RTDB) {
        return window.showToast("Cannot save note. User not authenticated.", 'danger');
    }
    // ... (Note save logic) ...
    const path = `datatable/${window.FIREBASE_USER_UID}/quicknotes`;
    const timestamp = new Date().toLocaleString();

    const dataToSend = {
        Note: noteText,
        DateAdded: timestamp,
        timestamp: window.firebase.database.serverTimestamp(),
    };

    try {
        const notesRef = firebase.database.ref(window.RTDB, path);
        await firebase.database.push(notesRef, dataToSend);
        
        window.showToast("Quick Note saved successfully!", 'success');
        return true;
    } catch (error) {
        window.showToast(`Failed to save note: ${error.message}`, 'danger');
        return false;
    }
};

window.deleteQuickNote = async function(rtdbKey) {
    if (!window.FIREBASE_USER_UID || !window.RTDB) {
        return window.showToast("Cannot delete data. User not authenticated.", 'danger');
    }
    // ... (Note delete logic) ...
    try {
        const path = `datatable/${window.FIREBASE_USER_UID}/quicknotes/${rtdbKey}`;
        const noteRef = firebase.database.ref(window.RTDB, path);
        await firebase.database.remove(noteRef);
        
        window.showToast("Note deleted successfully!", 'success');
        return true;
    } catch (error) {
        window.showToast(`Failed to delete note: ${error.message}`, 'danger');
        return false;
    }
};


// --- 2. Lead Table UI/Logic Functions ---

window.loadAndRenderData = async function(showLoadToast = true) {
  if (showLoadToast) window.showToast("Loading lead data...", 'info');
  currentUserData = await window.fetchSheetDBData(); 
  $('#leadSearchInput').val('');
  renderLeadsTable(currentUserData);
  if (showLoadToast) window.showToast(`✅ Loaded ${currentUserData.length} leads.`, 'success');
};

function filterLeads(searchTerm) {
    if (!currentUserData) return [];

    const lowerCaseSearch = searchTerm.toLowerCase();

    if (!lowerCaseSearch) {
        return currentUserData;
    }

    return currentUserData.filter(lead => {
        return (lead.CustomerName && lead.CustomerName.toLowerCase().includes(lowerCaseSearch)) ||
               (lead.MobileNumber && lead.MobileNumber.toLowerCase().includes(lowerCaseSearch)) ||
               (lead.LeadFor && lead.LeadFor.toLowerCase().includes(lowerCaseSearch)) ||
               (lead.Remark && lead.Remark.toLowerCase().includes(lowerCaseSearch));
    });
}

function handleEditClick() {
    const key = $(this).data('key');
    const lead = currentUserData.find(l => l.RTDBKey === key);
    
    if (!lead) return window.showToast("Lead data not found.", 'danger');
    
    // Populate the edit modal fields
    $('#editLeadRtdbKey').val(key);
    $('#editCustomerName').val(lead.CustomerName).prop('disabled', true);
    $('#editMobileNumber').val(lead.MobileNumber);
    $('#editLeadFor').val(lead.LeadFor);
    $('#editLeadBy').val(lead.LeadBy);
    $('#editLastContact').val(lead.LastContact);
    $('#editRemark').val(lead.Remark);
    
    const editModal = new bootstrap.Modal(document.getElementById('leadEditModal'));
    editModal.show();
}

async function handleInlineSave(rtdbKey, field, value, element) {
    if (!rtdbKey) return window.showToast("Missing lead ID for update.", 'danger');
    if (!isAuthReady) return window.showToast("Please log in to update data.", 'danger'); // isAuthReady from offline.js

    const updateObject = { [field]: value };
    const $element = $(element);
    $element.prop('disabled', true).removeClass('is-invalid is-valid').addClass('is-loading'); 
    
    try {
        const success = await window.saveEditedLead(rtdbKey, updateObject); 
        
        if (success) {
            $element.removeClass('is-invalid is-loading').addClass('is-valid');
            
            // Update the local data copy immediately
            const leadIndex = currentUserData.findIndex(l => l.RTDBKey === rtdbKey);
            if(leadIndex !== -1) {
                currentUserData[leadIndex] = { 
                    ...currentUserData[leadIndex], 
                    [field]: value,
                    LastEdited: new Date().toLocaleString()
                };
            }
            
            setTimeout(() => $element.removeClass('is-valid'), 2000);
        } else {
            $element.removeClass('is-valid is-loading').addClass('is-invalid');
        }
    } catch (error) {
        console.error("Inline save error:", error);
        window.showToast("Unexpected error during inline update.", 'danger');
        $element.removeClass('is-valid is-loading').addClass('is-invalid');
    } finally {
        $element.prop('disabled', false);
    }
}

function renderLeadsTable(dataToRender) {
  const tableBody = $('#notesTable tbody');
  tableBody.empty();

  const data = dataToRender || currentUserData;

  if (!data || data.length === 0) {
    tableBody.append('<tr><td colspan="11" class="text-center text-muted py-4">No lead data found. Start by adding a new lead.</td></tr>');
    return;
  }

  data.sort((a, b) => new Date(b.DateAdded) - new Date(a.DateAdded));

  // Helper function to ensure empty strings/placeholders display as '-'
  const displayValue = (val) => (val && val.trim() !== '' && val.trim().toUpperCase() !== 'N/A') ? val : '-';

  data.forEach((row, index) => {
    const rtdbKey = row.RTDBKey || '';
    const {
      CustomerName = '', MobileNumber = '', LeadFor = '', LeadBy = '',
      LastContact = '', Remark = '', DateAdded = '', LastEdited = '',
    } = row;

    const callButton = (MobileNumber && MobileNumber.length > 5)
      ? `<a href="tel:${MobileNumber}" class="btn btn-sm btn-info text-white me-1" title="Call ${CustomerName}">
           <span class="material-symbols-outlined fs-6">call</span>
         </a>`
      : `<button class="btn btn-sm btn-secondary me-1" disabled title="No phone number">
           <span class="material-symbols-outlined fs-6">call</span>
         </button>`;
         
    const remarkInput = `<textarea class="form-control form-control-sm lead-inline-edit" data-key="${rtdbKey}" data-field="Remark" rows="1" style="min-width: 150px; white-space: normal;">${Remark}</textarea>`;
    const contactInput = `<input type="date" class="form-control form-control-sm lead-inline-edit" data-key="${rtdbKey}" data-field="LastContact" value="${LastContact}" style="min-width: 130px;">`;


    const rowMarkup = `
      <tr>
        <td class="small">${index + 1}</td>
        <td class="small fw-semibold text-primary">${CustomerName}</td>
        <td class="small">${displayValue(MobileNumber)}</td>
        <td class="small">${displayValue(LeadFor)}</td>
        <td class="small">${displayValue(LeadBy)}</td>
        <td>${contactInput}</td>
        <td>${remarkInput}</td>
        <td class="small">${displayValue(DateAdded)}</td>
        <td class="small">${displayValue(LastEdited)}</td>
        <td>${callButton}</td>
        <td>
          <button class="btn btn-sm btn-warning edit-btn me-1" data-key="${rtdbKey}" title="Edit All Details">
            <span class="material-symbols-outlined fs-6">edit_square</span>
          </button>
          <button class="btn btn-sm btn-danger delete-btn" data-key="${rtdbKey}" title="Delete Lead">
            <span class="material-symbols-outlined fs-6">delete</span>
          </button>
        </td>
      </tr>
    `;

    tableBody.append(rowMarkup);
  });

  // Attach dynamic event listeners
  $('.delete-btn').off('click').on('click', async function () {
    const key = $(this).data('key');
    if (!key) return window.showToast("Missing record ID.", 'danger');

    if (confirm("⚠️ Are you sure you want to delete this lead? This cannot be undone.")) {
      const success = await window.deleteSheetDBRow(key); 
      if (success) await window.loadAndRenderData();
    }
  });
  
  $('.edit-btn').off('click').on('click', handleEditClick);
  
  // Event handler for inline editing (FIX APPLIED: saves empty string)
  $('.lead-inline-edit').off('change').on('change', function() {
    const $this = $(this);
    const key = $this.data('key');
    const field = $this.data('field');
    const value = $this.val().trim(); // Value is correctly an empty string if cleared
    handleInlineSave(key, field, value, this);
  });
}

// --- 3. Quick Note UI/Logic Functions ---

window.loadAndRenderQuickNotes = async function() {
    const notes = await window.fetchQuickNotes(); 
    renderQuickNotes(notes);
};

function renderQuickNotes(notes) {
    const container = $('#savedNotesContainer');
    container.empty();
    
    if (notes.length === 0) {
        container.append('<p class="text-center text-muted small mb-0">No saved notes.</p>');
        return;
    }

    notes.forEach(note => {
        const noteElement = $(`
            <div class="alert alert-light border shadow-sm d-flex justify-content-between align-items-start mb-2 py-2 pe-1" role="alert">
                <div class="me-auto small" style="overflow-wrap: break-word;">
                    <strong><span class="material-symbols-outlined fs-6" style="vertical-align: sub;">edit_note</span> ${note.DateAdded}:</strong> ${note.Note}
                </div>
                <button type="button" class="btn-close btn-sm delete-note-btn" data-key="${note.RTDBKey}" aria-label="Delete note"></button>
            </div>
        `);
        container.append(noteElement);
    });

    $('.delete-note-btn').off('click').on('click', async function() {
        if (!confirm("Delete this note?")) return;
        const rtdbKey = $(this).data('key');
        const success = await window.deleteQuickNote(rtdbKey); 
        if (success) {
            window.loadAndRenderQuickNotes();
        }
    });
}


// --- 4. Form Submission Listeners ---

$('#leadSearchInput').on('input', function() {
    const searchTerm = $(this).val();
    const filteredData = filterLeads(searchTerm); 
    renderLeadsTable(filteredData);
});

$('#noteEntryForm').on('submit', async function (e) {
    e.preventDefault();
    if (!window.FIREBASE_USER_UID) return window.showToast("Please log in to submit data.", 'danger');

    const leadData = {
        CustomerName: $('#customerName').val().trim(),
        MobileNumber: $('#mobileNumber').val().trim(),
        LeadFor: $('#leadFor').val(),
        LeadBy: $('#leadBy').val().trim() || 'N/A',
        LastContact: $('#lastContact').val(),
        Remark: $('#remark').val().trim() || 'N/A',
    };
    
    if (!leadData.MobileNumber) return window.showToast("Mobile Number is required.", 'warning');

    const success = await window.saveLeadEntry(leadData);
    if (success) {
        $('#noteEntryForm')[0].reset();
        bootstrap.Modal.getInstance(document.getElementById('leadEntryModal')).hide();
        await window.loadAndRenderData();
    }
});

$('#quickNoteForm').on('submit', async function (e) {
    e.preventDefault();
    if (!window.FIREBASE_USER_UID) return window.showToast("Please log in to save a note.", 'danger');

    const noteText = $('#noteTextarea').val().trim();
    if (!noteText) return window.showToast("Note cannot be empty.", 'warning');

    const success = await window.saveQuickNote(noteText);

    if (success) {
        $('#noteTextarea').val('');
        await window.loadAndRenderQuickNotes(); 
    }
});

async function handleSaveClick() {
    const rtdbKey = $('#editLeadRtdbKey').val().trim();
    if (!rtdbKey) { return window.showToast("Error: Cannot find lead key to update.", 'danger'); }

    const $saveButton = $('#saveLeadChanges');
    $saveButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span> Saving...');

    const updatedFields = {
        MobileNumber: $('#editMobileNumber').val().trim(),
        LeadFor: $('#editLeadFor').val(),
        LeadBy: $('#editLeadBy').val().trim() || 'N/A', 
        LastContact: $('#editLastContact').val(),
        Remark: $('#editRemark').val().trim() || 'N/A',
    };

    if (!updatedFields.MobileNumber) {
        $saveButton.prop('disabled', false).text('Save Changes');
        return window.showToast("Mobile Number is required.", 'warning');
    }

    try {
        const success = await window.saveEditedLead(rtdbKey, updatedFields); 
        if (success) {
            bootstrap.Modal.getInstance(document.getElementById('leadEditModal')).hide();
            await window.loadAndRenderData();
        } else {
            window.showToast("Failed to update lead. Please try again.", 'danger');
        }
    } catch (err) {
        console.error("Error while saving lead:", err);
        window.showToast("Unexpected error during update.", 'danger');
    } finally {
        $saveButton.prop('disabled', false).text('Save Changes');
    }
}

$('#saveLeadChanges').off('click').on('click', handleSaveClick);
