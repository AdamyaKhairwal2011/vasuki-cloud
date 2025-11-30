import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aitckloahlwemlekaour.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE = "users";

function getParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

const user_id = getParam("authentication");

// HTML Loaders
const nameLoader = document.getElementById("nameLoader");
const projectsLoader = document.getElementById("projectsLoader");
const chartLoader = document.getElementById("chartLoader");

// ===================== FETCH USER =====================
(async () => {
  const { data: user, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", user_id)
    .single();

  if (!error && user) {
    document.querySelector("#user_name").innerHTML = user.name;
  }

  // Hide loader
  nameLoader.style.display = "none";
})();

// ===================== FETCH PROJECTS =====================
(async () => {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user_id);

  if (error) {
    console.error("Project error:", error);
    projectsLoader.style.display = "none";
    return;
  }

  const container = document.getElementById("projectsContainer");
  projects.forEach(project => {
    const card = document.createElement("div");

    card.innerHTML = `
<div class="w-full max-w-xs bg-[#0f0f0f] text-white rounded-xl shadow-lg 
            overflow-hidden border border-white/10">
  
  <div class="h-16 w-full bg-gradient-to-r from-ocean-600 to-blue-700 relative">
    <button class="absolute top-2 right-2 text-white/80 hover:text-white">×</button>
  </div>

  <div class="flex justify-center -mt-8 z-100">
    <div class="h-16 w-16 bg-gradient-to-br from-gray-700 to-gray-900 
                rounded-full flex items-center justify-center shadow-xl border border-white/20">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none"
           viewBox="0 0 24 24" stroke="currentColor"
           class="h-8 w-8 text-white/80">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 6v12m6-6H6m12 0a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
    </div>
  </div>

  <div class="text-center mt-3 px-4 pb-4">
    <h2 class="text-lg font-semibold">${project.project_name}</h2>
    <div class="text-xs text-gray-400 mt-2">${project.project_description}</div>

<button class="mt-4 w-full px-4 py-2 rounded-lg border border-white/20 
               hover:bg-white/10 transition"
        onclick="window.location.href='project-details.html?project_id=${project.id}'">
  View Project
</button>

  </div>
</div>
`;

    container.appendChild(card);
  });

  // Hide project loader
  projectsLoader.style.display = "none";
})();

// ===================== CLOUD STORAGE CHART =====================

async function getUserCloudFiles() {
  const { data, error } = await supabase
    .from("cloud")
    .select("uploaded_at, size_bytes")
    .eq("user_id", user_id)
    .order("uploaded_at", { ascending: true });

  return error ? [] : data;
}

function prepareStorageUsage(files) {
  const daily = {};

  files.forEach(file => {
    const day = file.uploaded_at.split("T")[0];
    if (!daily[day]) daily[day] = 0;
    daily[day] += file.size_bytes;
  });

  const dates = Object.keys(daily).sort();
  let total = 0;

  const labels = [];
  const storageMB = [];

  dates.forEach(d => {
    total += daily[d];
    labels.push(d);
    storageMB.push((total / (1024 * 1024)).toFixed(3));
  });

  return { labels, storageMB };
}

async function drawChart() {
  const files = await getUserCloudFiles();
  const { labels, storageMB } = prepareStorageUsage(files);

  const canvas = document.getElementById("storageGraph");
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(0, 122, 255, 0.45)");
  gradient.addColorStop(1, "rgba(0, 122, 255, 0)");

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Storage (MB)",
          data: storageMB,
          borderColor: "rgba(0,122,255,1)",
          backgroundColor: gradient,
          borderWidth: 2,
          tension: 0.35,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });

  chartLoader.style.display = "none";
}

drawChart();
