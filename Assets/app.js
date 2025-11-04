import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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
const auth = getAuth(app);

onAuthStateChanged(auth, user => {
  if (!user) {
   // window.location.href = "index.html";
  } else {
    initDiary(user.uid);
  }
});

function initDiary(uid) {
  const quill = new Quill("#editor", {
    theme: "snow",
    modules: { toolbar: "#editorToolbar" }
  });

  function showToast(message, type = "info") {
    const toast = $(`
      <div class="toast align-items-center text-bg-${type} border-0 show" role="alert">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `);
    $(".toast-container").append(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  async function loadEntry(date) {
    const snapshot = await get(child(ref(db), `entries/${uid}/${date}`));
    const data = snapshot.val();
    quill.root.innerHTML = data?.content || "";
  }

  async function saveEntry() {
    const date = $("#datePicker").val() || new Date().toISOString().split("T")[0];
    const content = quill.root.innerHTML;
    const entryRef = ref(db, `entries/${uid}/${date}`);

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

  function changeDate(offset) {
    const current = new Date($("#datePicker").val() || new Date());
    current.setDate(current.getDate() + offset);
    const newDate = current.toISOString().split("T")[0];
    $("#datePicker").val(newDate);
    loadEntry(newDate);
  }

  async function populateSummary() {
    const snapshot = await get(child(ref(db), `entries/${uid}`));
    const data = snapshot.val() || {};
    const $tbody = $("#summaryTable tbody");
    const pieCtx = document.getElementById("summaryPieChart").getContext("2d");

    $tbody.empty();
    let totalWords = 0;
    const labels = [], wordCounts = [];

    Object.entries(data).forEach(([date, entry]) => {
      const text = entry.content.replace(/<[^>]+>/g, "");
      const wordCount = text.trim().split(/\s+/).length;
      totalWords += wordCount;

      $tbody.append(`
        <tr>
          <td>${date}</td>
          <td>${wordCount}</td>
          <td>${new Date(entry.lastModified).toLocaleString()}</td>
          <td>${text.slice(0, 50)}...</td>
        </tr>
      `);

      labels.push(date);
      wordCounts.push(wordCount);
    });

    $("#summaryTotalEntries").text(labels.length);
    $("#summaryTotalWords").text(totalWords);
    $("#summaryAvgWords").text(labels.length ? Math.round(totalWords / labels.length) : 0);

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

  $(".apply-settings").on("click", () => {
    const theme = $("input[name='theme']:checked").val();
    if (theme) $("body").attr("class", `theme-${theme}`);

    const font = $("#fontSelect").val();
    $("#editor").css("font-family", font);

    const size = $("#fontSizeRange").val();
    $("#editor").css("font-size", `${size}px`);
    $("#fontSizeValue").text(`${size}px`);

    const interval = parseInt($("#autoSaveInterval").val());
    showToast(`Settings applied. Auto-save every ${interval} seconds.`, "info");

    bootstrap.Modal.getInstance($("#settingsModal")[0])?.hide();
  });

  $("#fontSizeRange").on("input", e => {
    $("#fontSizeValue").text(`${e.target.value}px`);
  });

  $("#saveBtn").on("click", saveEntry);
  $("#prevPageBtn").on("click", () => changeDate(-1));
  $("#nextPageBtn").on("click", () => changeDate(1));
  $("#datePicker").on("change", e => loadEntry(e.target.value));
  $("[data-module='summary']").on("click", () => {
    populateSummary();
    new bootstrap.Modal($("#summaryModal")[0]).show();
  });
  $("[data-module='settings']").on("click", () => {
    new bootstrap.Modal($("#settingsModal")[0]).show();
  });
  $("#todayBtn").on("click", () => {
    const today = new Date().toISOString().split("T")[0];
    $("#datePicker").val(today);
    loadEntry(today);
  });

  const today = new Date().toISOString().split("T")[0];
  $("#datePicker").val(today);
  loadEntry(today);
}
