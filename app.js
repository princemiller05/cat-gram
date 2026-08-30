// ===== CONNECT TO SUPABASE =====
const SUPABASE_URL = 'https://bzagsqinfqtdjkkrchaf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_rPuI1OBWdG1Wjyx52Wj8JA_tI-jDR_s';   // your full publishable key
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== THE MAP =====
const map = L.map('map').setView([18.5204, 73.8567], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);
// center the map on the user's real location when the page opens
map.locate({ setView: true, maxZoom: 16 });

// drop a "you are here" dot once we find them
map.on('locationfound', (e) => {
  L.circleMarker(e.latlng, { radius: 8, color: '#2b82ff', fillColor: '#2b82ff', fillOpacity: .6 })
    .addTo(map).bindPopup('You are here 📍');
});

// if they deny permission or it fails, just stay on the default view
map.on('locationerror', () => console.log('Location unavailable — using default view.'));
// ===== PAGE ELEMENTS =====
const addBtn    = document.getElementById('addBtn');
const formPanel = document.getElementById('formPanel');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn   = document.getElementById('saveBtn');
const catNotes  = document.getElementById('catNotes');
const wordCount = document.getElementById('wordCount');

// ===== STATE =====
let placing = false, draftMarker = null, draftLatLng = null;

// ----- draw one cat on the map -----
function addCatToMap(cat) {
  const marker = L.marker([cat.lat, cat.lng]).addTo(map);
  const photo = cat.photo_url
    ? `<img src="${cat.photo_url}" style="width:150px;border-radius:8px;display:block;margin-bottom:6px;">`
    : '';
  marker.bindPopup(`${photo}<b>${cat.name}</b><br>${cat.notes || ''}`);
}

// ----- ON LOAD: fetch every cat and draw it -----
async function loadCats() {
  const { data, error } = await db.from('cats').select('*');
  if (error) { console.error(error); return; }
  data.forEach(addCatToMap);
}
loadCats();

// ----- Add button -> open form -----
addBtn.addEventListener('click', () => {
  formPanel.classList.remove('hidden');
  addBtn.style.display = 'none';
  placing = true;
});

// ----- tap map -> place/move draft pin -----
map.on('click', (e) => {
  if (!placing) return;
  draftLatLng = e.latlng;
  if (draftMarker) draftMarker.setLatLng(e.latlng);
  else draftMarker = L.marker(e.latlng).addTo(map);
});

// ----- word counter -----
catNotes.addEventListener('input', () => {
  const words = catNotes.value.trim().split(/\s+/).filter(Boolean);
  wordCount.textContent = words.length + ' / 200 words';
  wordCount.style.color = words.length > 200 ? 'red' : '#888';
});

// ----- reset the form -----
function resetForm() {
  formPanel.classList.add('hidden');
  addBtn.style.display = 'block';
  placing = false;
  if (draftMarker) { map.removeLayer(draftMarker); draftMarker = null; }
  draftLatLng = null;
  document.getElementById('catName').value = '';
  document.getElementById('catPhoto').value = '';
  catNotes.value = '';
  wordCount.textContent = '0 / 200 words';
}
cancelBtn.addEventListener('click', resetForm);

// ----- SAVE: upload photo -> insert row -> show it -----
saveBtn.addEventListener('click', async () => {
  const name = document.getElementById('catName').value.trim();
  const notes = catNotes.value.trim();
  const words = notes.split(/\s+/).filter(Boolean);
  const photoFile = document.getElementById('catPhoto').files[0];

  if (!draftLatLng)       { alert('Tap the map to place the cat first!'); return; }
  if (!name)              { alert('Give the cat a name!'); return; }
  if (words.length > 200) { alert('Notes must be 200 words or fewer.'); return; }

  saveBtn.disabled = true; saveBtn.textContent = 'Saving...';

  // 1. upload photo (if any) to the cat-photos bucket
  let photoUrl = null;
  if (photoFile) {
    const ext = photoFile.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from('cat-photos').upload(fileName, photoFile);
    if (upErr) { alert('Photo upload failed: ' + upErr.message); saveBtn.disabled=false; saveBtn.textContent='Save cat 🐾'; return; }
    photoUrl = db.storage.from('cat-photos').getPublicUrl(fileName).data.publicUrl;
  }

  // 2. insert the cat row
  const { data, error } = await db.from('cats')
    .insert({ name, notes, lat: draftLatLng.lat, lng: draftLatLng.lng, photo_url: photoUrl })
    .select().single();

  if (error) { alert('Save failed: ' + error.message); saveBtn.disabled=false; saveBtn.textContent='Save cat 🐾'; return; }

  // 3. show it and clean up
  addCatToMap(data);
  resetForm();
  saveBtn.disabled = false; saveBtn.textContent = 'Save cat 🐾';
});