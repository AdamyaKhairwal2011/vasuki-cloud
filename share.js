import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aitckloahlwemlekaour.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


function shortenFilename(name) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) return name; // no extension

  const ext = name.slice(dotIndex); // ".pdf"
  const base = name.slice(0, dotIndex);

  if (base.length <= 7) return name;

  return base.slice(0, 9) + "....." + ext;
}



// QUERY PARAMS
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
let project_id = getParam("project_id");
let permission_key = getParam("permission_key");

// PERMISSION CONFIG
let permissions = [
  { permission: "read-only", key: "69832077eRacrt3" },
  { permission: "download", key: "23908723Dacrt4" }
];

// CHECK USER ACCESS
function getUserPermission() {
  let p = permissions.find((x) => x.key === permission_key);
  return p ? p.permission : "read-only";
}

let userPermission = getUserPermission();

// MAIN FUNCTION
async function fetchProjectDetails(project_id) {
    
  document.getElementById("loader").classList.remove("hidden");
  document.getElementById("file_list").classList.add("hidden");
  const { data: projectData } = await supabase
    .from("projects")
    .select("*")
    .eq("id", project_id)
    .single();

  if (!projectData) return;

  const { data: owner } = await supabase
    .from("users")
    .select("*")
    .eq("id", projectData.user_id)
    .single();

  document.querySelector("#sender_name").innerText = owner?.name || "Unknown";

  // FETCH FILES
  const { data: files } = await supabase
    .from("cloud")
    .select("*")
    .eq("file_project_id", project_id);

  renderFiles(files);
}

function renderFiles(files) {
  const container = document.querySelector("#file_list");
  container.innerHTML = "";

  files.forEach((file) => {
    const div = document.createElement("div");
    div.className =
      "bg-white/5 p-4 rounded-2xl mb-4 border border-white/10 backdrop-blur-xl";

    let isImage =
      file.mime_type.startsWith("image/") ||
      /\.(png|jpg|jpeg|gif|webp)$/i.test(file.filename);

    let previewHTML = "";

    if (isImage) {
    previewHTML = `
        <div 
        class="w-full h-90 aspect-square bg-black/20 rounded-xl overflow-hidden border border-white/10 
                cursor-pointer hover:scale-[1.01] transition"
        onclick="openImageViewer('data:${file.mime_type};base64,${file.data_base64}')"
        >
        <img src="data:${file.mime_type};base64,${file.data_base64}"
            class="w-full h-full object-cover select-none pointer-events-none"
            draggable="false" />
        </div>
    `;
    }
    else {
      previewHTML = `
        <div class="text-white/60 text-sm mb-3">No preview available</div>
      `;
    }

    let downloadBtn = "";

    if (userPermission === "download") {
      downloadBtn = `
        <button onclick="downloadFile('${file.filename}','${file.mime_type}','${file.data_base64}')"
            class="px-3 py-2 mt-3 bg-green-500 rounded-lg text-black font-semibold hover:bg-blue-600 transition">
            Download
        </button>
      `;
    }

    div.innerHTML = `
      <div class="text-lg font-semibold mb-3">${shortenFilename(file.filename)}</div>
      ${previewHTML}
      ${downloadBtn}
    `;

    container.appendChild(div);
  });

  document.getElementById("loader").classList.add("hidden");
document.getElementById("file_list").classList.remove("hidden");

}

// FULLSCREEN IMAGE VIEWER FUNCTION
window.openImageViewer = function (src) {
  const viewer = document.getElementById("image_viewer");
  const img = document.getElementById("viewer_img");

  img.src = src;
  viewer.classList.remove("hidden");
};


window.downloadFile = function (filename, mime, base64) {
  if (userPermission !== "download") {
    alert("You do not have permission to download this file.");
    return;
  }

  const a = document.createElement("a");
  a.href = `data:${mime};base64,${base64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

fetchProjectDetails(project_id);

