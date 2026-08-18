/* --------------------------------------------------------------------------
   admin.js — IHRD CAS Kodungallur Admin Panel
   Handles Firebase Authentication, Gallery CRUD, and File Upload/Delete.

   Security model:
   - Authentication: Firebase Auth (email/password)
   - Authorization: Firebase Security Rules (see Firestore + Storage rules)
   - Client-side checks: supplementary UI gating only (NOT the security layer)

   The actual security enforcement happens in Firebase Security Rules,
   not here. Never trust client-side code alone for authorization.
   -------------------------------------------------------------------------- */

(function () {
  'use strict';

  /* ────────────────────────────────────────
     Constants
  ──────────────────────────────────────── */
  const MAX_FILE_SIZE_MB   = 50;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

  /* ────────────────────────────────────────
     Firebase references
  ──────────────────────────────────────── */
  let auth    = null;
  let db      = null;
  let storage = null;
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

      auth    = firebase.auth();
      db      = firebase.firestore();
      storage = firebase.storage();

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
      .catch(err => {
        showError('admin-error-banner', 'Logout failed: ' + err.message);
      });
  }

  /* ────────────────────────────────────────
     5. Show / Hide Panels
  ──────────────────────────────────────── */
  function showLoginScreen() {
    document.getElementById('loginPanel').style.display  = 'flex';
    document.getElementById('dashboardPanel').style.display = 'none';
  }

  function showDashboard(user) {
    document.getElementById('loginPanel').style.display  = 'none';
    document.getElementById('dashboardPanel').style.display = 'block';
    const nameEl = document.getElementById('adminDisplayName');
    if (nameEl) nameEl.textContent = user.email;
  }

  function showConfigWarning() {
    document.getElementById('configWarning').style.display = 'block';
    document.getElementById('loginPanel').style.display  = 'none';
    document.getElementById('dashboardPanel').style.display = 'none';
  }

  /* ────────────────────────────────────────
     6. Upload Form — Media Type Toggle
  ──────────────────────────────────────── */
  function initMediaTypeToggle() {
    const mediaTypeSelect  = document.getElementById('mediaType');
    const imageUploadWrap  = document.getElementById('imageUploadWrap');
    const videoUploadWrap  = document.getElementById('videoUploadWrap');

    if (!mediaTypeSelect) return;

    mediaTypeSelect.addEventListener('change', () => {
      const val = mediaTypeSelect.value;
      imageUploadWrap.style.display = (val === 'image') ? 'block' : 'none';
      videoUploadWrap.style.display = (val === 'video') ? 'block' : 'none';
    });

    // Set initial state
    mediaTypeSelect.dispatchEvent(new Event('change'));
  }

  /* ────────────────────────────────────────
     7. Upload Handler
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

    /* ── Validate required fields ── */
    if (!title) {
      showError('upload-error', 'Title is required.');
      return;
    }
    if (!category) {
      showError('upload-error', 'Category is required.');
      return;
    }

    setButtonLoading(btn, 'Uploading…');

    try {
      let mediaUrl    = '';
      let storagePath = '';

      if (mediaType === 'image') {
        const fileInput = document.getElementById('imageFile');
        const file = fileInput.files[0];

        if (!file) {
          showError('upload-error', 'Please select an image file.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        /* Client-side validation (supplementary — Storage Rules enforce on server) */
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          showError('upload-error', 'Unsupported image format. Please use JPG, PNG, WebP, or GIF.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          showError('upload-error', `File is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        const result = await uploadFile(file, 'gallery/images');
        mediaUrl    = result.downloadUrl;
        storagePath = result.storagePath;

      } else if (mediaType === 'video') {
        const fileInput = document.getElementById('videoFile');
        const file = fileInput.files[0];

        if (!file) {
          showError('upload-error', 'Please select a video file.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
          showError('upload-error', 'Unsupported video format. Please use MP4, WebM, OGG, or MOV.');
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          showError('upload-error', `Video file is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`);
          setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
          return;
        }

        const result = await uploadFile(file, 'gallery/videos');
        mediaUrl    = result.downloadUrl;
        storagePath = result.storagePath;
      }

      /* ── Save Firestore document ── */
      await db.collection('gallery').add({
        title,
        category,
        date:        date || '',
        caption:     caption || '',
        mediaType,
        mediaUrl,
        storagePath,
        thumbnailUrl: '',
        published:   true,
        createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
        createdBy:   currentUser.uid
      });

      showSuccess('upload-success', '✅ Gallery item uploaded successfully.');
      document.getElementById('uploadForm').reset();
      document.getElementById('mediaType').dispatchEvent(new Event('change'));
      loadGalleryItems();

    } catch (err) {
      console.error('[Admin] Upload error:', err);
      showError('upload-error', 'Upload failed: ' + (err.message || err.code || 'Unknown error'));
    } finally {
      setButtonNormal(btn, '<i class="fa-solid fa-cloud-arrow-up"></i> Upload to Gallery');
    }
  }

  /* ────────────────────────────────────────
     8. Upload File to Firebase Storage
     Returns { downloadUrl, storagePath }
  ──────────────────────────────────────── */
  async function uploadFile(file, pathPrefix) {
    const safeName    = sanitizeFileName(file.name);
    const storagePath = `${pathPrefix}/${Date.now()}-${safeName}`;
    const ref         = storage.ref(storagePath);

    // Show progress feedback
    const progressWrap = document.getElementById('uploadProgress');
    const progressBar  = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');
    if (progressWrap) progressWrap.style.display = 'block';

    const uploadTask = ref.put(file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (progressBar)  progressBar.style.width = pct + '%';
          if (progressText) progressText.textContent = `Uploading… ${pct}%`;
        },
        err => {
          if (progressWrap) progressWrap.style.display = 'none';
          reject(err);
        },
        async () => {
          if (progressWrap) progressWrap.style.display = 'none';
          const downloadUrl = await uploadTask.snapshot.ref.getDownloadURL();
          resolve({ downloadUrl, storagePath });
        }
      );
    });
  }

  /* ────────────────────────────────────────
     9. Load Gallery Items into Admin List
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
        listEl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#999;">No gallery items yet. Use the upload form above to add one.</td></tr>';
        return;
      }

      let rows = '';
      snapshot.forEach(doc => {
        const d = doc.data();
        const date = d.date ? d.date : '—';
        const thumb = d.mediaType === 'image' && d.mediaUrl
          ? `<img src="${escHtml(d.mediaUrl)}" style="width:56px;height:40px;object-fit:cover;border-radius:4px;border:1px solid #E2DFD9;">`
          : d.mediaType === 'video'
            ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:40px;background:#1a1a1a;border-radius:4px;"><i class="fa-solid fa-film" style="color:#F7EBDB;"></i></span>`
            : '—';

        rows += `
          <tr data-doc-id="${escHtml(doc.id)}">
            <td>${thumb}</td>
            <td style="font-weight:600;">${escHtml(d.title || '—')}</td>
            <td><span class="admin-badge">${escHtml(d.category || '—')}</span></td>
            <td style="color:#888;">${escHtml(date)}</td>
            <td style="text-transform:capitalize;">${escHtml(d.mediaType || '—')}</td>
            <td>
              <button class="admin-btn admin-btn-delete" data-doc-id="${escHtml(doc.id)}" data-storage-path="${escHtml(d.storagePath || '')}">
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
      listEl.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#D92323;">Failed to load gallery: ${escHtml(err.message)}</td></tr>`;
    }
  }

  /* ────────────────────────────────────────
     10. Delete Handler
  ──────────────────────────────────────── */
  async function handleDelete(e) {
    const btn         = e.currentTarget;
    const docId       = btn.dataset.docId;
    const storagePath = btn.dataset.storagePath;

    if (!docId) return;
    if (!confirm('Are you sure you want to delete this gallery item? This action cannot be undone.')) return;

    setButtonLoading(btn, 'Deleting…');

    const errors = [];

    /* Step 1: Delete Firestore document */
    try {
      await db.collection('gallery').doc(docId).delete();
    } catch (err) {
      errors.push('Firestore deletion failed: ' + (err.message || err.code));
      setButtonNormal(btn, '<i class="fa-solid fa-trash"></i> Delete');
      showError('admin-error-banner', errors.join(' | '));
      return;
    }

    /* Step 2: Delete Storage file (if path exists) */
    if (storagePath) {
      try {
        await storage.ref(storagePath).delete();
      } catch (err) {
        // Firestore doc is already gone — report Storage failure but don't block UI
        errors.push(`⚠ Firestore record deleted, but Storage file could not be removed (${err.code}). You may need to manually delete: "${storagePath}" from Firebase Storage.`);
      }
    }

    if (errors.length > 0) {
      showError('admin-error-banner', errors.join(' '));
    }

    // Refresh list
    loadGalleryItems();
  }

  /* ────────────────────────────────────────
     11. Utility Helpers
  ──────────────────────────────────────── */
  function sanitizeFileName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
  }

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
    el.textContent = msg;
    el.style.display = 'block';
  }

  function clearError(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  }

  function showSuccess(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  function clearSuccess(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.display = 'none';
  }

  function setButtonLoading(btn, text) {
    if (!btn) return;
    btn.innerHTML = text;
    btn.disabled  = true;
  }

  function setButtonNormal(btn, html) {
    if (!btn) return;
    btn.innerHTML = html;
    btn.disabled  = false;
  }

  function getFriendlyAuthError(code) {
    const map = {
      'auth/invalid-email':         'Invalid email address format.',
      'auth/user-not-found':        'No account found with this email.',
      'auth/wrong-password':        'Incorrect password. Please try again.',
      'auth/too-many-requests':     'Too many failed attempts. Please wait before trying again.',
      'auth/network-request-failed':'Network error. Please check your internet connection.',
      'auth/user-disabled':         'This admin account has been disabled.',
      'auth/invalid-credential':    'Invalid email or password. Please check your credentials.'
    };
    return map[code] || 'Login failed. Please check your credentials and try again.';
  }

  /* ────────────────────────────────────────
     12. Wire DOM Events
  ──────────────────────────────────────── */
  function wireDOMEvents() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);

    // Media type toggle
    initMediaTypeToggle();
  }

  /* ────────────────────────────────────────
     13. Entry Point
  ──────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    wireDOMEvents();
    init();

    // Allow the Refresh button in admin.html to trigger a gallery reload
    document.addEventListener('admin:refresh', () => {
      if (currentUser) loadGalleryItems();
    });
  });

})();
