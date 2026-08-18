/* --------------------------------------------------------------------------
   gallery-public.js — IHRD CAS Kodungallur
   Public-side Firebase gallery integration.

   What this does:
     - Initializes Firebase using the shared config
     - Intercepts the Card-06 ("GALLERY") modal click
     - Fetches published gallery items from Firestore (one-time read)
     - Renders them as .gallery-item elements inside #modalBody
     - Supports admin-defined category filter tabs
     - Provides a lightbox for images and inline playback for videos
     - Falls back gracefully when Firebase is unavailable or no items exist
   -------------------------------------------------------------------------- */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────
     1. Firebase references (set after SDK loads)
  ────────────────────────────────────────────── */
  let db        = null;   // Firestore instance
  let firebaseReady = false;

  /* ──────────────────────────────────────────────
     2. Initialise Firebase once the SDK is ready
  ────────────────────────────────────────────── */
  function initFirebase() {
    try {
      const cfg = window.CASK_FIREBASE_CONFIG;
      if (!cfg || cfg.apiKey === 'REPLACE_WITH_YOUR_API_KEY') {
        console.warn('[Gallery] Firebase config not set. Gallery will show placeholder.');
        return;
      }

      // Avoid double-initialisation if Firebase SDK already initialised elsewhere
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
      }

      db = firebase.firestore();
      firebaseReady = true;
    } catch (err) {
      console.error('[Gallery] Firebase init failed:', err);
    }
  }

  /* ──────────────────────────────────────────────
     3. Gallery Modal Intercept
     We patch the Card-06 click so clicking the
     gallery card renders Firebase content into
     #modalBody instead of the static cardData string
  ────────────────────────────────────────────── */
  function patchGalleryCard() {
    const observeCards = () => {
      // Card-06 cards (both quick-card and nav-grid-card with data-card-num="06")
      const galleryCards = document.querySelectorAll(
        '[data-card-num="06"]'
      );

      galleryCards.forEach(card => {
        if (card.dataset.galleryPatched) return;
        card.dataset.galleryPatched = 'true';
        card.addEventListener('click', handleGalleryCardClick, true); // capture
      });

      // Wire up all "Campus Life" nav links (href="#campus") to open the Gallery modal
      const campusNavLinks = document.querySelectorAll('a[href="#campus"]');
      campusNavLinks.forEach(link => {
        if (link.dataset.campusPatched) return;
        link.dataset.campusPatched = 'true';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetCard = document.querySelector('.nav-grid-card[data-card-num="06"]') || document.querySelector('[data-card-num="06"]');
          if (targetCard) {
            targetCard.click();
          }
        });
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', observeCards);
    } else {
      observeCards();
    }
  }

  /* ──────────────────────────────────────────────
     4. Handle Gallery Card Click
  ────────────────────────────────────────────── */
  function handleGalleryCardClick(e) {
    // Let the existing modal open logic in main.js run first,
    // then we replace #modalBody with our gallery content.
    // We use setTimeout(0) to yield after the native click handler fires.
    setTimeout(() => {
      const modalBody = document.getElementById('modalBody');
      const modalTitle = document.getElementById('modalTitle');
      const modalSubtitle = document.getElementById('modalSubtitle');

      if (!modalTitle || !modalBody) return;

      // Update modal header to match gallery context
      modalTitle.textContent = 'Campus Life & Visual Gallery';
      if (modalSubtitle) modalSubtitle.textContent = 'MOMENTS AT IHRD KODUNGALLUR';

      if (!firebaseReady || !db) {
        modalBody.innerHTML = buildConfigPlaceholder();
        return;
      }

      // Show a loading spinner while fetching
      modalBody.innerHTML = buildLoadingSpinner();

      loadGalleryItems();
    }, 0);
  }

  /* ──────────────────────────────────────────────
     5. Load Gallery Items from Firestore
  ────────────────────────────────────────────── */
  async function loadGalleryItems() {
    const modalBody = document.getElementById('modalBody');
    if (!modalBody) return;

    try {
      // Query without requiring a composite index to prevent 'failed-precondition'
      let snapshot;
      try {
        snapshot = await db.collection('gallery').orderBy('createdAt', 'desc').get();
      } catch (e) {
        // Fallback simple query if orderBy fails
        snapshot = await db.collection('gallery').get();
      }

      if (snapshot.empty) {
        modalBody.innerHTML = buildEmptyState();
        return;
      }

      const items = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.published !== false) {
          items.push({ id: doc.id, ...data });
        }
      });

      if (items.length === 0) {
        modalBody.innerHTML = buildEmptyState();
        return;
      }

      renderGallery(items, modalBody);

    } catch (err) {
      console.error('[Gallery] Firestore fetch error:', err);
      modalBody.innerHTML = buildErrorState(err);
    }
  }

  /* ──────────────────────────────────────────────
     6. Render Gallery
  ────────────────────────────────────────────── */
  function renderGallery(items, container) {
    // Collect unique categories for filter tabs
    const categories = ['All'];
    items.forEach(item => {
      const cat = (item.category || '').trim();
      if (cat && !categories.includes(cat)) {
        categories.push(cat);
      }
    });

    const html = `
      <div class="gallery-public-wrapper">

        ${/* Category filter bar — reuses existing .tab-btn styles */ ''}
        <div class="gallery-filter-bar-wrapper" style="
          display:flex;
          flex-wrap:wrap;
          gap:0.5rem;
          margin-bottom:1.5rem;
        ">
          ${categories.map((cat, i) => `
            <button
              class="tab-btn gallery-filter-btn${i === 0 ? ' active' : ''}"
              data-category="${cat === 'All' ? 'all' : cat}"
              style="font-size:0.78rem; padding:0.4rem 1rem;"
            >${cat.toUpperCase()}</button>
          `).join('')}
        </div>

        ${/* Gallery grid — reuses existing .gallery-grid and .gallery-item CSS */ ''}
        <div class="gallery-grid" id="publicGalleryGrid" style="margin-top:0;">
          ${items.map(item => buildGalleryItem(item)).join('')}
        </div>

        ${items.length === 0 ? buildEmptyState() : ''}
      </div>
    `;

    container.innerHTML = html;

    // Wire up category filters
    wireGalleryFilters(container);

    // Wire up lightbox / video clicks
    wireMediaClicks(container);
  }

  /* ──────────────────────────────────────────────
     7. Build a Single Gallery Item Card
  ────────────────────────────────────────────── */
  function buildGalleryItem(item) {
    const cat    = (item.category || 'Uncategorised').trim();
    const title  = escapeHtml(item.title  || 'Untitled');
    const caption = escapeHtml(item.caption || '');
    const date   = item.date ? formatDate(item.date) : '';

    if (item.mediaType === 'video') {
      /* ── Video item ── */
      const videoUrl = escapeHtml(item.mediaUrl || '');
      const poster   = escapeHtml(item.thumbnailUrl || '');

      return `
        <div
          class="gallery-item"
          data-category="${escapeHtml(cat)}"
          data-media-type="video"
          data-video-url="${videoUrl}"
          data-title="${title}"
          style="background:#111; cursor:pointer;"
        >
          ${poster
            ? `<img src="${poster}" alt="${title}" loading="lazy">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1a1a1a;">
                 <i class="fa-solid fa-video" style="font-size:3rem;color:#F7EBDB;opacity:0.6;"></i>
               </div>`
          }
          <div class="gallery-overlay" style="opacity:1; background:linear-gradient(to top,rgba(0,0,0,0.85),transparent);">
            <div>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
                <i class="fa-solid fa-play-circle" style="color:#F7EBDB;font-size:1.1rem;"></i>
                <span style="font-size:0.7rem;color:#F7EBDB;background:#D92323;padding:0.15rem 0.5rem;border-radius:99px;font-weight:700;letter-spacing:0.5px;">${escapeHtml(cat.toUpperCase())}</span>
              </div>
              <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:0.9rem;color:white;">${title}</div>
              ${date ? `<div style="font-size:0.72rem;color:#ccc;margin-top:0.2rem;">${date}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    } else {
      /* ── Image item ── */
      const imgUrl = escapeHtml(item.mediaUrl || '');

      return `
        <div
          class="gallery-item"
          data-category="${escapeHtml(cat)}"
          data-media-type="image"
          data-img-url="${imgUrl}"
          data-title="${title}"
          data-caption="${caption}"
          style="cursor:pointer;"
        >
          <img src="${imgUrl}" alt="${title}" loading="lazy">
          <div class="gallery-overlay">
            <div>
              <span style="font-size:0.7rem;color:#F7EBDB;background:#D92323;padding:0.15rem 0.5rem;border-radius:99px;font-weight:700;letter-spacing:0.5px;display:inline-block;margin-bottom:0.4rem;">${escapeHtml(cat.toUpperCase())}</span>
              <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:0.9rem;color:white;">${title}</div>
              ${caption ? `<div style="font-size:0.75rem;color:#ddd;margin-top:0.2rem;">${caption}</div>` : ''}
              ${date ? `<div style="font-size:0.72rem;color:#ccc;margin-top:0.2rem;">${date}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }
  }

  /* ──────────────────────────────────────────────
     8. Wire Category Filters
  ────────────────────────────────────────────── */
  function wireGalleryFilters(container) {
    const filterBtns  = container.querySelectorAll('.gallery-filter-btn');
    const galleryItems = container.querySelectorAll('.gallery-item');

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.dataset.category;
        galleryItems.forEach(item => {
          const itemCat = item.dataset.category || '';
          if (category === 'all' || itemCat === category) {
            item.style.display = 'block';
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  /* ──────────────────────────────────────────────
     9. Wire Media Clicks — Lightbox & Video
  ────────────────────────────────────────────── */
  function wireMediaClicks(container) {
    const items = container.querySelectorAll('.gallery-item');

    items.forEach(item => {
      item.addEventListener('click', () => {
        const type    = item.dataset.mediaType;
        const title   = item.dataset.title   || '';
        const caption = item.dataset.caption || '';

        if (type === 'image') {
          const imgUrl = item.dataset.imgUrl;
          openImageLightbox(imgUrl, title, caption);
        } else if (type === 'video') {
          const videoUrl = item.dataset.videoUrl;
          openVideoPlayer(videoUrl, title);
        }
      });
    });
  }

  /* ──────────────────────────────────────────────
     10. Image Lightbox
  ────────────────────────────────────────────── */
  function openImageLightbox(src, title, caption) {
    const lightbox = document.createElement('div');
    lightbox.id = 'caskLightbox';
    lightbox.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.92);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:2rem;cursor:pointer;
    `;

    lightbox.innerHTML = `
      <div style="position:absolute;top:1.5rem;right:1.5rem;cursor:pointer;color:white;font-size:1.8rem;z-index:1;">
        <i class="fa-solid fa-xmark"></i>
      </div>
      <img
        src="${escapeHtml(src)}"
        alt="${escapeHtml(title)}"
        style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.6);"
      >
      ${title || caption ? `
        <div style="margin-top:1.25rem;text-align:center;max-width:600px;">
          ${title ? `<div style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;color:white;">${escapeHtml(title)}</div>` : ''}
          ${caption ? `<div style="font-size:0.85rem;color:#ccc;margin-top:0.4rem;">${escapeHtml(caption)}</div>` : ''}
        </div>
      ` : ''}
    `;

    // Close on click anywhere
    lightbox.addEventListener('click', () => lightbox.remove());

    document.body.appendChild(lightbox);
  }

  /* ──────────────────────────────────────────────
     11. Video Player Overlay (YouTube embed)
  ────────────────────────────────────────────── */
  function openVideoPlayer(src, title) {
    const overlay = document.createElement('div');
    overlay.id = 'caskVideoOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:99999;
      background:rgba(0,0,0,0.95);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:2rem;
    `;

    // src is already an embed URL (https://www.youtube.com/embed/VIDEO_ID)
    overlay.innerHTML = `
      <div style="position:absolute;top:1.5rem;right:1.5rem;cursor:pointer;color:white;font-size:1.8rem;z-index:1;" id="caskVideoClose">
        <i class="fa-solid fa-xmark"></i>
      </div>
      ${title ? `<div style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;color:white;margin-bottom:1rem;">${escapeHtml(title)}</div>` : ''}
      <iframe
        src="${escapeHtml(src)}?autoplay=1&rel=0"
        style="width:min(90vw,854px);height:min(50vw,480px);border:none;border-radius:8px;background:#000;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    `;

    document.body.appendChild(overlay);

    document.getElementById('caskVideoClose').addEventListener('click', () => {
      overlay.remove();
    });
  }


  /* ──────────────────────────────────────────────
     12. Helper — Loading / Empty / Error States
  ────────────────────────────────────────────── */
  function buildLoadingSpinner() {
    return `
      <div style="text-align:center;padding:3rem 1rem;">
        <div style="
          width:40px;height:40px;
          border:3px solid #E2DFD9;
          border-top-color:#D92323;
          border-radius:50%;
          animation:caskSpin 0.8s linear infinite;
          margin:0 auto 1rem;
        "></div>
        <p style="font-size:0.9rem;color:#666;">Loading gallery…</p>
        <style>
          @keyframes caskSpin { to { transform: rotate(360deg); } }
        </style>
      </div>
    `;
  }

  function buildEmptyState() {
    return `
      <div style="text-align:center;padding:3rem 1rem;">
        <i class="fa-regular fa-image" style="font-size:3rem;color:#ccc;display:block;margin-bottom:1rem;"></i>
        <p style="font-family:'Space Grotesk',sans-serif;font-weight:700;margin-bottom:0.5rem;">No Gallery Items Yet</p>
        <p style="font-size:0.85rem;color:#666;">Admins can upload photos and videos from the Admin Panel.</p>
      </div>
    `;
  }

  function buildErrorState(err) {
    const msg = (err && err.code) ? err.code : 'Unknown error';
    return `
      <div style="text-align:center;padding:3rem 1rem;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size:3rem;color:#D92323;display:block;margin-bottom:1rem;"></i>
        <p style="font-family:'Space Grotesk',sans-serif;font-weight:700;margin-bottom:0.5rem;">Could Not Load Gallery</p>
        <p style="font-size:0.8rem;color:#999;">${escapeHtml(msg)}</p>
        <p style="font-size:0.8rem;color:#999;margin-top:0.5rem;">Please check your Firebase configuration and security rules.</p>
      </div>
    `;
  }

  function buildConfigPlaceholder() {
    return `
      <div style="text-align:center;padding:3rem 1rem;">
        <i class="fa-solid fa-gears" style="font-size:3rem;color:#ccc;display:block;margin-bottom:1rem;"></i>
        <p style="font-family:'Space Grotesk',sans-serif;font-weight:700;margin-bottom:0.5rem;">Gallery Backend Not Configured</p>
        <p style="font-size:0.85rem;color:#666;">
          Open <code style="background:#F7EBDB;padding:0.1rem 0.4rem;border-radius:4px;">js/firebase-config.js</code>
          and replace the placeholder values with your Firebase project config.
        </p>
      </div>
    `;
  }

  /* ──────────────────────────────────────────────
     13. Utilities
  ────────────────────────────────────────────── */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  /* ──────────────────────────────────────────────
     14. Bootstrap
  ────────────────────────────────────────────── */
  initFirebase();
  patchGalleryCard();

})();
