/* --------------------------------------------------------------------------
   admin.js — IHRD CAS Kodungallur Admin Panel
   
   Storage approach (100% free, no credit card):
   - Images  → Cloudinary free tier (unsigned upload via API)
   - Videos  → YouTube / external URL (paste link)
   - Metadata → Firebase Firestore (free tier)
   - Auth     → Firebase Authentication (free)

   Security model:
   - Authentication : Firebase Auth (email/password)
   - Authorization  : Firebase Firestore Security Rules
   - Client-side checks are supplementary UI only — NOT the security layer.
   -------------------------------------------------------------------------- */

(function () {
  'use strict';

  /* ────────────────────────────────────────
     CLOUDINARY CONFIG
     Fill these in after creating your free
     Cloudinary account at cloudinary.com
  ──────────────────────────────────────── */
const CLOUDINARY_CLOUD_NAME    = 'rhabkmfa';
const CLOUDINARY_UPLOAD_PRESET = 'cask_gallery';


  /* ────────────────────────────────────────
     Constants
  ──────────────────────────────────────── */
  const MAX_FILE_SIZE_MB    = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  /* ────────────────────────────────────────
     Firebase references
  ──────────────────────────────────────── */
  let auth        = null;
  let db          = null;
  let currentUser = null;

  /* ────────────────────────────────────────
     1. Bootstrap — initialise Firebase
  ──────────────────────────────────────── */
  function init() {
    try {
      const cfg = window.CASK_FIREBASE_CONFIG;
      if (!cfg || cfg.apiKey === 'REPLACE_WITH_YOUR_API_KEY') {
        showConfigWarning();
        return;
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
      }

      auth = firebase.auth();
      db   = firebase.firestore();

      // Persist session across page refreshes
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      // Listen for auth state changes
      auth.onAuthStateChanged(onAuthStateChanged);

    } catch (err) {
      showError('admin-error-banner', 'Firebase initialisation failed: ' + err.message);
    }
  }

  /* ────────────────────────────────────────
     2. Auth State Observer
  ──────────────────────────────────────── */
  function onAuthStateChanged(user) {
    if (user) {
      currentUser = user;
      showDashboard(user);
      loadGalleryItems();
    } else {
      currentUser = null;
      showLoginScreen();
    }
  }

  /* ────────────────────────────────────────
     3. Login
  ──────────────────────────────────────── */
  function handleLogin(e) {
    e.preventDefault();
    clearError('login-error');

    const email    = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const btn      = document.getElementById('loginBtn');

    if (!email || !password) {
      showError('login-error', 'Please enter both email and password.');
      return;
    }

    setButtonLoading(btn, 'Signing in…');

    auth.signInWithEmailAndPassword(email, password)
      .catch(err => {
        setButtonNormal(btn, '<i class="fa-solid fa-right-to-bracket"></i> Sign In');
        showError('login-error', getFriendlyAuthError(err.code));
      });
  }

  /* ────────────────────────────────────────
     4. Logout
  ──────────────────────────────────────── */
  function handleLogout() {
    auth.signOut()
      .then(() => showLoginScreen())
      .catch(err => showError('admin-error-banner', 'Logout failed: ' + err.message));
  }

  /* ────────────────────────────────────────
     5. Show / Hide Panels
  ──────────────────────────────────────── */
  function showLoginScreen() {
    document.getElementById('loginPanel').style.display    = 'flex';
    document.getElementById('dashboardPanel').style.display = 'none';
  }

  function showDashboard(user) {
    document.getElementById('loginPanel').style.display    = 'none';
    document.getElementById('dashboardPanel').style.display = 'block';
    const nameEl = document.getElementById('adminDisplayName');
    if (nameEl) nameEl.textContent = user.email;
  }

  function showConfigWarning() {
    document.getElementById('configWarning').style.display  = 'block';
    document.getElementById('loginPanel').style.display     = 'none';
    document.getElementById('dashboardPanel').style.display = 'none';
  }

  /* ────────────────────────────────────────
     6. Media Type Toggle
  ──────────────────────────────────────── */
  function initMediaTypeToggle() {
    const mediaTypeSelect = document.getElementById('mediaType');
    const imageWrap       = document.getElementById('imageUploadWrap');
    const videoWrap       = document.getElementById('videoUploadWrap');

    if (!mediaTypeSelect) return;

    mediaTypeSelect.addEventListener('change', () => {
      const val = mediaTypeSelect.value;
      imageWrap.style.display = (val === 'image') ? 'block' : 'none';
      videoWrap.style.display = (val === 'video') ? 'block' : 'none';
    });

    mediaTypeSelect.dispatchEvent(new Event('change'));
  }

  /* ────────────────────────────────────────
     7. Upload Handler (main form submit)
  ──────────────────────────────────────── */
  async function handleUpload(e) {
    e.preventDefault();
    if (!currentUser) return;

    clearError('upload-error');
    clearSuccess('upload-success');

    const title     = document.getElementById('itemTitle').value.trim();
    const category  = document.getElementById('itemCategory').value.trim();
    const date      = document.getElementById('itemDate').value;
    const caption   = document.getElementById('itemCaption').value.trim();
    const mediaType = document.getElementById('mediaType').value;
    const btn       = document.getElementById('uploadBtn');

    // Validate common required fields
    if (!title) {
      showError('upload-error', 'Title is required.');
      return;
    }
    if (!category) {
      showError('upload-error', 'Category is required.');
      return;
    }

    setButtonLoading(btn, '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…');

    try {
      let mediaUrl    = '';
      let storagePath = ''; // empty — Cloudinary manages paths internally
      let videoEmbedUrl = '';

      if (mediaType === 'image') {
        /* ── Image: upload to Cloudinary ── */
        if (CLOUDINARY_CLOUD_NAME === 'REPLACE_WITH_YOUR_CLOUD_NAME') {
          showError('upload-error', 'Please set your Cloudinary Cloud Name and Upload Preset in js/admin.js before uploading images.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        const fileInput = document.getElementById('imageFile');
        const file      = fileInput ? fileInput.files[0] : null;

        if (!file) {
          showError('upload-error', 'Please select an image file.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          showError('upload-error', 'Unsupported format. Use JPG, PNG, WebP, or GIF.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          showError('upload-error', `File too large. Maximum is ${MAX_FILE_SIZE_MB} MB.`);
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        mediaUrl = await uploadToCloudinary(file);

      } else if (mediaType === 'video') {
        /* ── Video: use pasted YouTube / external URL ── */
        const rawUrl = document.getElementById('videoUrl').value.trim();
        if (!rawUrl) {
          showError('upload-error', 'Please paste a YouTube or video URL.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        videoEmbedUrl = convertToYouTubeEmbed(rawUrl);
        if (!videoEmbedUrl) {
          showError('upload-error', 'Invalid URL. Please paste a valid YouTube video link (e.g. https://youtu.be/XXXXX or https://www.youtube.com/watch?v=XXXXX).');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        mediaUrl = videoEmbedUrl;
      }

      /* ── Save metadata to Firestore ── */
      await db.collection('gallery').add({
        title,
        category,
        date:         date || '',
        caption:      caption || '',
        mediaType,
        mediaUrl,
        storagePath,
        thumbnailUrl: '',
        published:    true,
        createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:    firebase.firestore.FieldValue.serverTimestamp(),
        createdBy:    currentUser.uid
      });

      showSuccess('upload-success', '✅ Gallery item added successfully!');
      document.getElementById('uploadForm').reset();
      document.getElementById('mediaType').dispatchEvent(new Event('change'));
      loadGalleryItems();

    } catch (err) {
      console.error('[Admin] Upload error:', err);
      showError('upload-error', 'Upload failed: ' + (err.message || 'Unknown error. Check browser console.'));
    } finally {
      setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
    }
  }

  /* ────────────────────────────────────────
     8. Cloudinary Upload
     Uses unsigned upload preset — no server needed
  ──────────────────────────────────────── */
  async function uploadToCloudinary(file) {
    const progressWrap = document.getElementById('uploadProgress');
    const progressBar  = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');

    const url     = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'cask-gallery');

    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar)  progressBar.style.width     = '0%';
    if (progressText) progressText.textContent    = 'Uploading to Cloudinary…';

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          if (progressBar)  progressBar.style.width  = pct + '%';
          if (progressText) progressText.textContent = `Uploading… ${pct}%`;
        }
      });

      xhr.addEventListener('load', () => {
        if (progressWrap) progressWrap.style.display = 'none';
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          resolve(res.secure_url); // HTTPS URL
        } else {
          try {
            const errRes = JSON.parse(xhr.responseText);
            reject(new Error(errRes.error?.message || 'Cloudinary upload failed'));
          } catch {
            reject(new Error('Cloudinary upload failed (status ' + xhr.status + ')'));
          }
        }
      });

      xhr.addEventListener('error', () => {
        if (progressWrap) progressWrap.style.display = 'none';
        reject(new Error('Network error during upload. Check your internet connection.'));
      });

      xhr.open('POST', url);
      xhr.send(formData);
    });
  }

  /* ────────────────────────────────────────
     9. Convert YouTube URL to embed URL
     Handles: youtu.be, youtube.com/watch, shorts
  ──────────────────────────────────────── */
  function convertToYouTubeEmbed(url) {
    try {
      const u = new URL(url);
      let videoId = '';

      if (u.hostname === 'youtu.be') {
        videoId = u.pathname.slice(1);
      } else if (u.hostname.includes('youtube.com')) {
        if (u.pathname.startsWith('/shorts/')) {
          videoId = u.pathname.replace('/shorts/', '');
        } else {
          videoId = u.searchParams.get('v');
        }
      }

      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}`;
    } catch {
      return null;
    }
  }

  /* ────────────────────────────────────────
     10. Load Gallery Items (admin list)
  ──────────────────────────────────────── */
  async function loadGalleryItems() {
    const listEl = document.getElementById('adminGalleryList');
    if (!listEl) return;

    listEl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#999;">Loading…</td></tr>';

    try {
      const snapshot = await db
        .collection('gallery')
        .orderBy('createdAt', 'desc')
        .get();

      if (snapshot.empty) {
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#999;">No gallery items yet. Use the form above to add your first one.</td></tr>';
        return;
      }

      let rows = '';
      snapshot.forEach(doc => {
        const d    = doc.data();
        const date = d.date || '—';

        let thumb = '—';
        if (d.mediaType === 'image' && d.mediaUrl) {
          thumb = `<img src="${escHtml(d.mediaUrl)}" style="width:56px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #2E2E2E;" loading="lazy">`;
        } else if (d.mediaType === 'video') {
          thumb = `<span style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:40px;background:#1a1a1a;border-radius:4px;font-size:1.2rem;">▶️</span>`;
        }

        rows += `
          <tr>
            <td>${thumb}</td>
            <td style="font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(d.title || '—')}</td>
            <td><span class="admin-badge">${escHtml(d.category || '—')}</span></td>
            <td style="color:#888;">${escHtml(date)}</td>
            <td style="text-transform:capitalize;">${escHtml(d.mediaType || '—')}</td>
            <td>
              <button class="admin-btn admin-btn-delete" data-doc-id="${escHtml(doc.id)}">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            </td>
          </tr>
        `;
      });

      listEl.innerHTML = rows;

      // Wire delete buttons
      listEl.querySelectorAll('.admin-btn-delete').forEach(btn => {
        btn.addEventListener('click', handleDelete);
      });

    } catch (err) {
      console.error('[Admin] Load error:', err);
      listEl.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#D92323;">Failed to load: ${escHtml(err.message)}</td></tr>`;
    }
  }

  /* ────────────────────────────────────────
     11. Delete Handler
     Note: Cloudinary files are NOT auto-deleted
     (Cloudinary free tier has no delete API without signing).
     Firestore document is deleted — the image stays on Cloudinary
     but is no longer referenced. For cleanup, use Cloudinary dashboard.
  ──────────────────────────────────────── */
  async function handleDelete(e) {
    const btn   = e.currentTarget;
    const docId = btn.dataset.docId;
    if (!docId) return;

    if (!confirm('Delete this gallery item? The Firestore record will be removed. (The Cloudinary image file can be cleaned up from your Cloudinary dashboard if needed.)')) return;

    setButtonLoading(btn, 'Deleting…');

    try {
      await db.collection('gallery').doc(docId).delete();
      loadGalleryItems();
    } catch (err) {
      console.error('[Admin] Delete error:', err);
      showError('admin-error-banner', 'Delete failed: ' + (err.message || err.code));
      setButtonNormal(btn, '<i class="fa-solid fa-trash"></i> Delete');
    }
  }

  /* ────────────────────────────────────────
     12. Utility Helpers
  ──────────────────────────────────────── */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
  }

  function clearError(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent   = '';
    el.style.display = 'none';
  }

  function showSuccess(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent   = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  function clearSuccess(elId) {
    const el = document.getElementById(elId);
    if (el) el.style.display = 'none';
  }

  function setButtonLoading(btn, html) {
    if (!btn) return;
    btn.innerHTML = html;
    btn.disabled  = true;
  }

  function setButtonNormal(btn, html) {
    if (!btn) return;
    btn.innerHTML = html;
    btn.disabled  = false;
  }

  function getFriendlyAuthError(code) {
    const map = {
      'auth/invalid-email':          'Invalid email address format.',
      'auth/user-not-found':         'No account found with this email.',
      'auth/wrong-password':         'Incorrect password. Please try again.',
      'auth/too-many-requests':      'Too many failed attempts. Please wait a few minutes.',
      'auth/network-request-failed': 'Network error. Check your internet connection.',
      'auth/user-disabled':          'This account has been disabled.',
      'auth/invalid-credential':     'Invalid email or password.'
    };
    return map[code] || 'Login failed. Please check your credentials.';
  }

  /* ────────────────────────────────────────
     13. Wire DOM Events
  ──────────────────────────────────────── */
  function wireDOMEvents() {
    const loginForm  = document.getElementById('loginForm');
    if (loginForm)  loginForm.addEventListener('submit', handleLogin);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn)  logoutBtn.addEventListener('click', handleLogout);

    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);

    initMediaTypeToggle();
  }

  /* ────────────────────────────────────────
     14. Entry Point
  ──────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    wireDOMEvents();
    init();

    // Refresh button support
    document.addEventListener('admin:refresh', () => {
      if (currentUser) loadGalleryItems();
    });
  });

})();
