import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// --- CONFIG --- (keep keys secret in production; using anon key for demo)
const SUPABASE_URL = "https://aitckloahlwemlekaour.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpdGNrbG9haGx3ZW1sZWthb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyOTQ3MTMsImV4cCI6MjA3MTg3MDcxM30.uQjQLSz0mQuuArPQ_F8u-suQ-6T0e9bF11ahQtSw6yA";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TABLE = "cloud";
let currentUser = null;

// --- UI ELEMENTS ---
const authModal = document.getElementById('authModal');
const openAuthBtn = document.getElementById('openAuthBtn');
const openAuthCallToAction = document.getElementById('openAuthCallToAction');
const btnMyFiles = document.getElementById('btnMyFiles');
const appEl = document.getElementById('app');
const landing = document.getElementById('landing');
const previewBox = document.getElementById('previewBox');
const filesTbody = document.querySelector('#filesTable tbody');

// --- HELPERS ---
function show(el){el.classList.remove('hidden')}
function hide(el){el.classList.add('hidden')}
function formatBytes(bytes){if(bytes===0)return'0 B';const k=1024,s=['B','KB','MB','GB'],i=Math.floor(Math.log(bytes)/Math.log(k));return(parseFloat((bytes/Math.pow(k,i)).toFixed(2)))+' '+s[i];}
function arrayBufferToBase64(buf){let bin='',bytes=new Uint8Array(buf);for(let i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);return btoa(bin);} 
function base64ToBlob(base64,mime){const bin=atob(base64),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime});}
function escapeHtml(s){return(s+"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));}

// generate a short secure token
function genToken(len = 28) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(36);
  }
  return out.slice(0, len);
}

// --- AUTH UI ---
openAuthBtn.addEventListener('click',()=>show(authModal));
openAuthCallToAction.addEventListener('click',()=>show(authModal));
window.closeAuth = ()=>hide(authModal);

// --- AUTH LOGIC ---
window.signUp = async function(){
  const username=document.getElementById('username').value.trim();
  const password=document.getElementById('password').value;
  if(!username||!password)return alert('Enter username & password');
  const { error } = await supabase.from('users').insert([{ username, password }]);
  if(error) return alert('Signup error: '+error.message);
  alert('Signup successful — please login.');
  localStorage.setItem('savedUsername', username);
};

window.signIn = async function(){
  const username=document.getElementById('username').value.trim();
  const password=document.getElementById('password').value;
  if(!username||!password) return alert('Enter username & password');
  const { data, error } = await supabase.from('users').select('*').eq('username',username).eq('password',password).single();
  if(error||!data) return alert('Invalid login');

  currentUser = data;
  localStorage.setItem('user_id', currentUser.id);  // ✅ Save user ID for auto-login

  afterLogin();
};

function afterLogin(){
  document.getElementById('userId').value = currentUser.id;
  document.getElementById('currentUserLabel').textContent = currentUser.username;
  hide(authModal); hide(landing); show(appEl); show(btnMyFiles);
  openAuthBtn.classList.add('hidden');
  loadFiles();
}

window.signOut = function(){
  currentUser=null;
  localStorage.removeItem('user_id');  // ✅ clear saved session
  hide(appEl); show(landing); hide(btnMyFiles);
  openAuthBtn.classList.remove('hidden');
  document.getElementById('currentUserLabel').textContent='';
};

// --- AUTO LOGIN ---
async function tryAutoLogin(){
  const savedId = localStorage.getItem('user_id');
  if(!savedId) return false;
  const { data, error } = await supabase.from('users').select('*').eq('id', savedId).single();
  if(error || !data) {
    localStorage.removeItem('user_id');
    return false;
  }
  currentUser = data;
  afterLogin();
  return true;
}

// --- INIT ---
(async function init(){
  const isShare = await handleShareView();
  if(isShare) return;
  const auto = await tryAutoLogin();  // ✅ Try automatic login first
  if(!auto){
    openAuthBtn.classList.remove('hidden');
    show(landing);
  }
})();

window.signOut = function(){ currentUser=null; hide(appEl); show(landing); hide(btnMyFiles); openAuthBtn.classList.remove('hidden'); document.getElementById('currentUserLabel').textContent=''; }

window.uploadFile = async function() {
  if (!currentUser) return alert('Login first');
  const f = document.getElementById('fileInput').files[0];
  if (!f) return alert('Select a file');
  

  // show progress bar
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  progressContainer.style.display = 'block';
  progressBar.style.width = '0%';

  // read file as ArrayBuffer and simulate progress
  const reader = new FileReader();
  reader.onloadstart = () => { progressBar.style.width = '5%'; };
  reader.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.min(95, Math.round((e.loaded / e.total) * 95));
      progressBar.style.width = percent + '%';
    }
  };
  
  reader.onload = async () => {
    const buf = reader.result;
    const base64 = arrayBufferToBase64(buf);
    const payload = {
      user_id: currentUser.id,
      filename: f.name,
      mime_type: f.type || 'application/octet-stream',
      data_base64: base64,
      size_bytes: f.size,
      uploaded_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from(TABLE).insert([payload]);
    
    if (error) {
      alert('Upload failed: ' + error.message);
      progressBar.style.background = 'red';
      progressBar.style.width = '100%';
      return;
    }

    // Complete progress visually
    progressBar.style.width = '98%';
    progressBar.style.background = 'linear-gradient(90deg, #000000ff, #000)';
    setTimeout(() => {
      progressContainer.style.display = 'none';
    }, 800);

    document.getElementById('fileInput').value = '';
    await loadFiles();
  };

  reader.onerror = () => {
    alert('Error reading file');
    progressContainer.style.display = 'none';
  };

  reader.readAsArrayBuffer(f);
};


// --- MODIFY loadFiles() --- 
async function loadFiles() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from(TABLE)
    .select('id,filename,mime_type,size_bytes,uploaded_at,share_token,share_expires_at')
    .eq('user_id', currentUser.id)
    .order('uploaded_at', { ascending: false });
  if (error) return console.error(error);

  filesTbody.innerHTML = '';
// --- THREE DOT LOGIC FIXED FOR BOTTOM EDGE ---
// Create three-dot menu dynamically and attach to body
data.forEach(f => {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${escapeHtml(f.filename)}</td>
    <td>${new Date(f.uploaded_at).toLocaleString()}</td>
    <td>${formatBytes(f.size_bytes||0)}</td>
    <td>
      <button class="three-dot-btn">&#8942;</button>
    </td>
  `;
  filesTbody.appendChild(tr);

  const btn = tr.querySelector('.three-dot-btn');

  btn.addEventListener('click', e => {
    // Close any existing menu
    const existingMenu = document.querySelector('.three-dot-menu-body');
    if (existingMenu) existingMenu.remove();

    // Create menu container
    const menu = document.createElement('div');
    menu.classList.add('three-dot-menu-body');
    menu.style.position = 'fixed';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ccc';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
    menu.style.zIndex = 9999;

    // Add buttons
    const actions = [
      { label: 'Download', fn: () => downloadFile(f.id) },
      { label: 'Preview', fn: () => previewFile(f.id) },
      { label: 'Rename', fn: () => promptRename(f.id, f.filename) },
      { label: f.share_token ? 'Manage Share' : 'Share', fn: () => createShare(f.id, f.share_token||'') },
      { label: 'Delete', fn: () => deleteFile(f.id) }
    ];
    actions.forEach(a => {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.style.padding = '6px 14px';
      b.style.border = 'none';
      b.style.background = 'none';
      b.style.textAlign = 'left';
      b.style.cursor = 'pointer';
      b.addEventListener('click', () => { a.fn(); menu.remove(); });
      b.addEventListener('mouseenter', () => b.style.background = '#f0f0f0');
      b.addEventListener('mouseleave', () => b.style.background = 'none');
      menu.appendChild(b);
    });

    document.body.appendChild(menu);

    // Position menu
    const rect = btn.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;

    // Check if menu would overflow bottom
    const menuHeight = actions.length * 36; // approximate button height
    if (rect.bottom + menuHeight > window.innerHeight) {
      menu.style.top = `${rect.top - menuHeight}px`; // open upwards
    } else {
      menu.style.top = `${rect.bottom}px`; // open downwards
    }

    e.stopPropagation();
  });
  
});

// Close menu when clicking anywhere else
document.addEventListener('click', () => {
  const existingMenu = document.querySelector('.three-dot-menu-body');
  if (existingMenu) existingMenu.remove();
});


  // close menus if clicked outside
  document.addEventListener('click', e => {
    if (!e.target.classList.contains('three-dot-btn')) {
      document.querySelectorAll('.three-dot-menu').forEach(menu => menu.style.display = 'none');
    }
  });

await loadFileTypeChart();


}

window.loadFiles = loadFiles;

// --- DELETE ---
window.deleteFile = async function(id){ if(!confirm('Delete this file?')) return; const { error } = await supabase.from(TABLE).delete().eq('id',id); if(error) return alert('Delete failed: '+error.message); loadFiles(); };

// --- PREVIEW ---
window.previewFile = async function(id){
  const { data, error } = await supabase.from(TABLE).select('filename,mime_type,data_base64').eq('id',id).single();
  const box = document.getElementById('previewBox'); box.innerHTML='';
  if(error||!data) return box.textContent='Preview failed.';
  const { mime_type, data_base64 } = data;
  if(mime_type && mime_type.startsWith('image/')){
    const blob = base64ToBlob(data_base64,mime_type); const url = URL.createObjectURL(blob); const img=document.createElement('img'); img.src=url; box.appendChild(img);
  } else if(mime_type && (mime_type.startsWith('text/')||mime_type.includes('json')||mime_type.includes('xml'))){
    const text = atob(data_base64);
    const pre = document.createElement('pre'); pre.textContent = text.slice(0,200000);
    box.appendChild(pre);
  } else {
    const p = document.createElement('div'); p.textContent = 'Preview not available for this file type. Use Download.'; box.appendChild(p);
  }
};

// --- DOWNLOAD ---
window.downloadFile = async function(id){
  const { data, error } = await supabase.from(TABLE).select('filename,mime_type,data_base64').eq('id',id).single();
  if(error||!data) return alert('Download failed');
  const blob = base64ToBlob(data.data_base64,data.mime_type);
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=data.filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
};

// --- RENAME ---
window.promptRename = function(id,current){ const newName = prompt('Rename file:',current); if(newName===null) return; renameFile(id,newName); }
async function renameFile(id,newName){ const { error } = await supabase.from(TABLE).update({ filename: newName, updated_at: new Date().toISOString() }).eq('id',id); if(error) return alert('Rename failed: '+error.message); loadFiles(); }

// --- SHARE MANAGEMENT ---
window.createShare = async function(fileId,existingToken){
  // simple UI prompt to create/remove/manage share
  if(existingToken){ // manage existing
    const action = prompt('Share exists. Type UNSHARE to remove it, or leave blank to copy link.');
    if(action && action.toUpperCase()==='UNSHARE'){
      const { error } = await supabase.from(TABLE).update({ share_token: null, share_expires_at: null }).eq('id',fileId);
      if(error) return alert('Failed to unshare: '+error.message);
      alert('Unshared'); loadFiles(); return;
    }
    // otherwise copy link
    const link = `${location.origin}${location.pathname}?share=${existingToken}`;
    navigator.clipboard?.writeText(link).then(()=>alert('Share link copied to clipboard'));
    return;
  }
  // create new share token
  const token = genToken(28);
  // optionally ask for expiry
  const ttl = prompt('Optional: enter expiry in hours (leave blank for no expiry)');
  let expires_at = null;
  if(ttl){ const hrs = parseFloat(ttl); if(!isNaN(hrs) && hrs>0) expires_at = new Date(Date.now()+hrs*3600*1000).toISOString(); }
  const { error } = await supabase.from(TABLE).update({ share_token: token, share_expires_at: expires_at }).eq('id',fileId);
  if(error) return alert('Failed to create share: '+error.message);
  const link = `${location.origin}${location.pathname}?share=${token}`;
  try{ await navigator.clipboard.writeText(link); alert('Share link created and copied to clipboard'); }catch(e){ prompt('Share link:',link); }
  loadFiles();
}

// --- HANDLE PUBLIC SHARE VIEW ---
async function handleShareView(){
  const params = new URLSearchParams(location.search);
  const token = params.get('share');
  if(!token) return false;

  // fetch file with token and check expiry
  const { data, error } = await supabase.from(TABLE).select('id,filename,mime_type,data_base64,share_expires_at,size_bytes,uploaded_at').eq('share_token',token).single();
  if(error || !data) { showShareError('File not found or share has been removed.'); return true; }
  if(data.share_expires_at && new Date(data.share_expires_at) < new Date()){ showShareError('Share link has expired.'); return true; }

  // show public view
  hide(landing); hide(appEl); hide(authModal);
  show(document.getElementById('shareView'));
  const info = document.getElementById('shareInfo'); info.textContent = `${data.filename} — ${formatBytes(data.size_bytes||0)} — uploaded ${new Date(data.uploaded_at).toLocaleString()}`;
  const preview = document.getElementById('sharePreview'); preview.innerHTML='';
  const actions = document.getElementById('shareActions'); actions.innerHTML='';

  if(data.mime_type && data.mime_type.startsWith('image/')){
    const blob = base64ToBlob(data.data_base64,data.mime_type); const url = URL.createObjectURL(blob); const img=document.createElement('img'); img.src=url;
    const dl = document.createElement('button'); dl.setAttribute('class','share-btn'); dl.textContent='Download'; dl.onclick=()=>{ const a=document.createElement('a'); a.href=url; a.download=data.filename; document.body.appendChild(a); a.click(); a.remove(); };
    actions.appendChild(dl);
  } else if(data.mime_type && (data.mime_type.startsWith('text/')||data.mime_type.includes('json')||data.mime_type.includes('xml'))){
    const text = atob(data.data_base64);
    const pre = document.createElement('pre'); pre.textContent = text.slice(0,200000);
    const dl = document.createElement('button'); dl.setAttribute('class','share-btn'); dl.textContent='Download'; dl.onclick=()=>{ const blob = base64ToBlob(data.data_base64,data.mime_type); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=data.filename; document.body.appendChild(a); a.click(); a.remove(); };
    actions.appendChild(dl);
  } else {
    const dl = document.createElement('button'); dl.setAttribute('class','share-btn'); dl.textContent='Download'; dl.onclick=()=>{ const blob = base64ToBlob(data.data_base64,data.mime_type); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=data.filename; document.body.appendChild(a); a.click(); a.remove(); };
    actions.appendChild(dl);
  }
  return true;
}

function showShareError(msg){ hide(landing); hide(appEl); hide(authModal); show(document.getElementById('shareView')); document.getElementById('shareInfo').textContent = msg; document.getElementById('sharePreview').innerHTML = ''; document.getElementById('shareActions').innerHTML=''; }

// --- INIT ---
(async function init(){
  // check if ?share= token present — if yes show public share
  const isShare = await handleShareView();
  if(isShare) return;
  // otherwise show landing and wire up UI
  openAuthBtn.classList.remove('hidden');
  // optional: restore existing session by checking localStorage
  // (this demo uses simple user rows; production should use supabase auth and sessions)
  
})();


const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const files = e.dataTransfer.files;
  fileInput.files = files;
  uploadFile(); // existing upload function
});

fileInput.addEventListener("change", uploadFile);

async function loadFileTypeChart() {
  if (!currentUser) return; // ensure logged in user exists

  const { data, error } = await supabase
    .from(TABLE)
    .select('mime_type, filename')
    .eq('user_id', currentUser.id); // ✅ only current user's files

  if (error) return console.error(error);

  const counts = {
    Images: 0,
    Documents: 0,
    PDFs: 0,
    Presentations: 0,
    Videos: 0,
    Archives: 0,
    Others: 0,
  };

  data.forEach(f => {
    const t = f.mime_type || '';
    const name = f.filename.toLowerCase();

    if (t.startsWith('image/')) counts.Images++;
    else if (t.includes('pdf')) counts.PDFs++;
    else if (t.includes('presentation') || name.endsWith('.pptx') || name.endsWith('.ppt')) counts.Presentations++;
    else if (t.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mkv')) counts.Videos++;
    else if (t.includes('zip') || t.includes('rar') || name.endsWith('.zip') || name.endsWith('.rar')) counts.Archives++;
    else if (t.includes('word') || name.endsWith('.docx') || name.endsWith('.txt')) counts.Documents++;
    else counts.Others++;
  });

  const ctx = document.getElementById('fileTypeChart').getContext('2d');
  if (window.fileTypeChart instanceof Chart) {
    window.fileTypeChart.destroy();
  }

  window.fileTypeChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: [
          '#000000ff', '#494949ff', '#797979ff',
          '#a8a8a8ff','rgba(238, 238, 238, 1)', '#b1a616ff', '#ffd000ff'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Detailed File Analysis',
          font: { size: 18 }
        },
        legend: { position: 'bottom' }
      }
    }
  });
}
// GOOGLE LOGIN (GitHub Pages compatible)
window.googleLogin = async function() {
  const client = google.accounts.oauth2.initCodeClient({
    client_id: "600593339063-blt9bcoe1k382f82ri4gd7a2el2bqfv1.apps.googleusercontent.com",
    scope: "email profile openid",
    ux_mode: "popup",
    callback: async (response) => {
      // Exchange authorization code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: response.code,
          client_id: "600593339063-blt9bcoe1k382f82ri4gd7a2el2bqfv1.apps.googleusercontent.com",
          client_secret: "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",
          redirect_uri: "postmessage",
          grant_type: "authorization_code"
        })
      }).then(r => r.json());

      const userInfo = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenRes.access_token}` }
      }).then(r => r.json());

      const email = userInfo.email;
      const name = userInfo.name;

      // Check if user exists in Supabase
      let { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("username", email)
        .single();

      // If not exists, create account
      if (!existingUser) {
        const pass = prompt("Set a password for your new account:");

        const { data: newUser } = await supabase
          .from("users")
          .insert([
            {
              username: email,
              password: pass,
              name: name
            }
          ])
          .select()
          .single();

        existingUser = newUser;
      }

      // Login
      currentUser = existingUser;
      localStorage.setItem("user_id", currentUser.id);
      afterLogin();
    }
  });

  client.requestCode(); // Open Google popup
};



// decode JWT helper
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}
