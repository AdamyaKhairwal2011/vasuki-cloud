import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aitckloahlwemlekaour.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PROJECTS_TABLE = "projects";
const CLOUD_TABLE = "cloud";

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

let project_id = getParam("project_id");
if (!project_id) console.error("No project ID found in URL.");


// DELETE PROJECT FUNCTION
async function deleteProject() {
  const yes = confirm("Delete project permanently? All files will be erased!");
  if (!yes) return;

  try {
    // 1. DELETE ALL FILES FIRST
    const deleteFilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cloud?file_project_id=eq.${project_id}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!deleteFilesRes.ok) {
      const msg = await deleteFilesRes.text();
      console.error(msg);
      alert("Failed deleting files. Cannot delete project.");
      return;
    }

    // 2. DELETE THE PROJECT
    const deleteProjectRes = await fetch(
      `${SUPABASE_URL}/rest/v1/projects?id=eq.${project_id}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!deleteProjectRes.ok) {
      const msg = await deleteProjectRes.text();
      console.error(msg);
      alert("Failed deleting project.");
      return;
    }

    alert("Project deleted successfully!");
    window.location.href = "dashboard.html?authentication="+localStorage.getItem("userid");

  } catch (err) {
    console.error("Delete failed:", err);
    alert("Unexpected error.");
  }
}


// attach event listener
document.getElementById("deleteProjectBtn").onclick = deleteProject;

/* ---------------- LOAD PROJECT ---------------- */
export async function getProjects() {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("*")
    .eq("id", project_id)
    .single();

  if (error) {
    console.error("Error fetching project:", error.message);
    return null;
  }
  return data;
}

async function populateProjects() {
  const project = await getProjects();
  if (!project) return;

  document.querySelector("#project_name").innerText = project.project_name;
  document.querySelector("#project_description").innerText =
    project.project_description;

  loadFiles();
}



/* ------------------- DOM READY -------------------- */
document.addEventListener("DOMContentLoaded", () => {
  populateProjects();
  setupDropZone();
  setupTableDelegation();
});

/* ------------------- SETUP DRAG & DROP -------------------- */
function setupDropZone() {
  const dropZone = document.querySelector("#dropZone");
  if (!dropZone) return;

  dropZone.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = () => {
      if (input.files && input.files[0]) uploadFile(input.files[0]);
    };
    input.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("bg-white/10");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("bg-white/10");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("bg-white/10");

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });
}
window.openEditor = function (fileId) {
  window.location.href = `edit.html?file_id=${fileId}`;
};


/* ------------------- LOAD FILES -------------------- */
/* ------------------- LOAD FILES -------------------- */
async function loadFiles() {
  const table = document.querySelector("#fileTableBody");
  if (!table) return;

  table.innerHTML =
    `<tr><td colspan="4" class="py-3 text-gray-400 text-center">Loading...</td></tr>`;

  const { data, error } = await supabase
    .from("cloud")
    .select("id, filename, mime_type, size_bytes, uploaded_at")
    .eq("file_project_id", project_id);


  if (error) {
    table.innerHTML =
      `<tr><td colspan="4" class="py-3 text-red-500 text-center">Error fetching files.</td></tr>`;
    return;
  }

  if (!data.length) {
    table.innerHTML =
      `<tr><td colspan="4" class="py-3 text-gray-500 text-center">No files found.</td></tr>`;
    return;
  }

  table.innerHTML = "";

  data.forEach((file) => {
    const row = document.createElement("tr");
    row.className = "border-b border-white/10 pb-10";

    const canEdit =
      file.mime_type.startsWith("text/") ||
      file.mime_type === "application/json" ||
      file.mime_type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    row.innerHTML = `
      <td class="pl-5">${file.filename}</td>
      <td class="pl-5">${file.mime_type}</td>
      <td class="pl-5">${(file.size_bytes / 1024).toFixed(1)} KB</td>
      <td class="pl-10 flex gap-3 pt-4">
        ${canEdit ? `
        <button title="Edit" class="p-2 rounded hover:bg-white/10" onclick="openEditor('${file.id}')">
          <img src="./edit.png" alt="" width="20px" height="20px">
        </button>` : ``}

        <button title="Rename" class="p-2 rounded hover:bg-white/10" onclick="renameFile('${file.id}')">
          <img src="./rename.png" alt="" width="20px" height="20px">
        </button>

        <button title="Download" class="p-2 rounded hover:bg-white/10" onclick="downloadFile('${file.id}')">
          <img src="./download.png" alt="" width="20px" height="20px">
        </button>

        <button title="Delete" class="p-2 rounded hover:bg-white/10" onclick="deleteFile('${file.id}')">
          <img src="./delete.svg" alt="" width="20px" height="20px">
        </button>
      </td>
    `;

    row.innerHTML += '<br>'

    table.appendChild(row);
  });
}


/* ------------------- TABLE EVENT DELEGATION -------------------- */
function setupTableDelegation() {
  const tableBody = document.querySelector("#fileTableBody");
  if (!tableBody) return;

  tableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    // Already handled inline with onclick in horizontal buttons
  });
}



// // Search Files
// document.getElementById("fileSearch").addEventListener("input", (e) => {
//   const searchTerm = e.target.value.toLowerCase();
//   const rows = document.querySelectorAll("#fileTableBody tr");

//   rows.forEach(row => {
//     const fileName = row.querySelector("td")?.innerText.toLowerCase() || "";
//     if (fileName.includes(searchTerm)) {
//       row.style.display = "";
//     } else {
//       row.style.display = "none";
//     }
//   });
// });



/* ------------------- FILE FUNCTIONS -------------------- */

window.deleteFile = async function deleteFile(id) {
  await supabase.from(CLOUD_TABLE).delete().eq("id", id);
  loadFiles();
}

window.renameFile = async function renameFile(id) {
  const newName = prompt("Enter new filename:");
  if (!newName) return;

  await supabase.from(CLOUD_TABLE).update({ filename: newName }).eq("id", id);
  loadFiles();
}

window.downloadFile = async function(id) {
  const { data, error } = await supabase
    .from("cloud")
    .select("filename, mime_type, data_base64")
    .eq("id", id)
    .single();

  if (error) return console.error("Download error", error);

  // Directly decode the full base64 (no "||" splitting)
  const fullBase64 = data.data_base64;

  if (!fullBase64 || fullBase64.length < 10) {
    alert("File corrupted or empty!");
    return;
  }

  const link = document.createElement("a");
  link.href = `data:${data.mime_type};base64,${fullBase64}`;
  link.download = data.filename;
  link.click();
};



window.editFile = async function editFile(id) {
  const { data } = await supabase
    .from(CLOUD_TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return;

  const decoded = decodeURIComponent(escape(atob(data.data_base64)));
  const newText = prompt("Edit content:", decoded);
  if (newText === null) return;

  const newBase64 = btoa(unescape(encodeURIComponent(newText)));

  await supabase
    .from(CLOUD_TABLE)
    .update({
      data_base64: newBase64,
      size_bytes: newText.length,
    })
    .eq("id", id);

  loadFiles();
}

/* ------------------- UPLOAD FILE -------------------- */
function splitIntoChunks(str, chunkSize = 1024 * 1024) {
  let chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

async function uploadFile(file) {
  const user = localStorage.getItem("userid");
  const project_id = getParam("project_id");

  const progressBox = document.getElementById("uploadProgress");
  const progressBar = document.getElementById("uploadBar");
  const uploadText = document.getElementById("uploadText");

  progressBox.classList.remove("hidden");

  const totalSize = file.size;
  let uploadedBytes = 0;

  uploadText.innerText = `0 MB / ${(totalSize / (1024 * 1024)).toFixed(2)} MB uploaded`;
  progressBar.style.width = "0%";

  const CHUNK_SIZE = 1024 * 1024 * 2; // 2MB per chunk
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  const arrayBuffer = await file.arrayBuffer();

  // 🧱 STEP 1: INSERT EMPTY ROW
  let { data: row, error: insertErr } = await supabase.from("cloud").insert([
    {
      user_id: user,
      filename: file.name,
      mime_type: file.type,
      data_base64: "",     // empty for now
      size_bytes: file.size,
      file_project_id: project_id
    }
  ]).select().single();

  if (insertErr) {
    console.error(insertErr);
    alert("Upload failed (DB insert error)");
    return;
  }

  const fileId = row.id;

  // --------------------------
  // PROCESS EACH CHUNK
  // --------------------------
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);

    // slice buffer → encode to base64
    const chunk = arrayBuffer.slice(start, end);
    const base64Chunk = arrayBufferToBase64(chunk);

    // append chunk to database → *UPDATE NOT INSERT*
    await supabase.rpc("append_chunk", {
      file_id: fileId,
      chunk_text: base64Chunk
    });

    uploadedBytes = end;
    const uploadedMB = (uploadedBytes / (1024 * 1024)).toFixed(2);
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

    uploadText.innerText = `${uploadedMB} MB / ${totalMB} MB uploaded`;
    progressBar.style.width = `${((i + 1) / totalChunks) * 100}%`;
  }

  setTimeout(() => {
    progressBox.classList.add("hidden");
  }, 1000);

  loadFiles();
}


function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary);
}

/* ------------------------------ */
/*        CREATE FILE             */
/* ------------------------------ */

async function createFile(args) {
  try {
    if (!args.file_name) throw new Error("Missing file_name");
    if (!args.file_mime_type) throw new Error("Missing file_mime_type");
    if (!args.file_content) throw new Error("Missing file_content");

    const user_id = localStorage.getItem("userid");

    // Convert text → Blob → Base64
    const blob = new Blob([args.file_content], {
      type: args.file_mime_type,
    });

    const buffer = await blob.arrayBuffer();
    const binary = Array.from(new Uint8Array(buffer))
      .map((b) => String.fromCharCode(b))
      .join("");

    const base64 = btoa(binary);

    // Insert file into Supabase
    const { data, error } = await supabase
      .from("cloud")
      .insert({
        user_id: user_id,
        file_project_id: project_id,
        filename: args.file_name,
        mime_type: args.file_mime_type,
        data_base64: base64,
        size_bytes: buffer.byteLength,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return;
    }

    console.log("File created successfully:", data);

    window.location.reload();
  } catch (err) {
    console.error("Create File Error:", err);
  }
}




let currentProjectId = null;

window.openPermissionPopup = function openPermissionPopup(projectId) {
  currentProjectId = projectId;
  document.getElementById("permissionPopup").classList.remove("hidden");
}

window.closePermissionPopup = function closePermissionPopup() {
  document.getElementById("permissionPopup").classList.add("hidden");
}

window.generateShareLink = function generateShareLink() {
  const key = document.getElementById("permissionSelect").value;

  const url = `${location.origin}/share.html?project_id=${currentProjectId}&permission_key=${key}`;

  closePermissionPopup();

  // Open link in new tab
  navigator.clipboard.writeText(url);
  alert("Share link copied to clipboard!");
  window.open(url, "_blank");
}



