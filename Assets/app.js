// app.js (ES Module)

// Firebase Setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// Firebase Config (replace with your actual config)
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
const db = getDatabase(app);

// Quill Editor Setup
const quill = new Quill("#editor", {
  theme: "snow",
  modules: {
    toolbar: "#editorToolbar"
  }
});

// Utility: Toast Notification
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-bg-${type} border-0 show`;
  toast.role = "alert";
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  document.querySelector(".toast-container").appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Load Entry by Date
async function loadEntry(date) {
  const snapshot = await get(child(ref(db), `entries/${date}`));
  const data = snapshot.val();
  quill.root.innerHTML = data?.content || "";
}

// Save Entry
async function saveEntry() {
  const date = document.getElementById("datePicker").value || new Date().toISOString().split("T")[0];
  const content = quill.root.innerHTML;
  const entryRef = ref(db, `entries/${date}`);

  try {
    await set(entryRef, {
      content,
      lastModified: new Date().toISOString()
    });
    showToast("Entry saved online!", "success");
  } catch (err) {
    showToast("Save failed: " + err.message, "danger");
  }
}

// Date Navigation
function changeDate(offset) {
  const picker = document.getElementById("datePicker");
  const current = new Date(picker.value || new Date());
  current.setDate(current.getDate() + offset);
  picker.value = current.toISOString().split("T")[0];
  loadEntry(picker.value);
}

// Populate Summary Modal
async function populateSummary() {
  const snapshot = await get(child(ref(db), "entries"));
  const data = snapshot.val() || {};
  const tbody = document.querySelector("#summaryTable tbody");
  const pieCtx = document.getElementById("summaryPieChart").getContext("2d");

  tbody.innerHTML = "";
  let totalWords = 0;
  const labels = [], wordCounts = [];

  Object.entries(data).forEach(([date, entry]) => {
    const text = entry.content.replace(/<[^>]+>/g, "");
    const wordCount = text.trim().split(/\s+/).length;
    totalWords += wordCount;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${date}</td>
      <td>${wordCount}</td>
      <td>${new Date(entry.lastModified).toLocaleString()}</td>
      <td>${text.slice(0, 50)}...</td>`;
    tbody.appendChild(row);

    labels.push(date);
    wordCounts.push(wordCount);
  });

  document.getElementById("summaryTotalEntries").textContent = labels.length;
  document.getElementById("summaryTotalWords").textContent = totalWords;
  document.getElementById("summaryAvgWords").textContent = labels.length ? Math.round(totalWords / labels.length) : 0;

  new Chart(pieCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        label: "Words per Entry",
        data: wordCounts,
        backgroundColor: labels.map(() => `hsl(${Math.random() * 360}, 70%, 70%)`)
      }]
    }
  });
}

// Event Listeners
document.getElementById("saveBtn").addEventListener("click", saveEntry);
document.getElementById("prevPageBtn").addEventListener("click", () => changeDate(-1));
document.getElementById("nextPageBtn").addEventListener("click", () => changeDate(1));
document.getElementById("datePicker").addEventListener("change", e => loadEntry(e.target.value));
document.querySelector("[data-module='summary']").addEventListener("click", () => {
  populateSummary();
  new bootstrap.Modal(document.getElementById("summaryModal")).show();
});
document.getElementById("todayBtn").addEventListener("click", () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("datePicker").value = today;
  loadEntry(today);
});

// Initialize with today's date
document.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("datePicker").value = today;
  loadEntry(today);
});
