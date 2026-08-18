/* --------------------------------------------------------------------------
   IHRD College of Applied Science, Kodungallur - Main JavaScript Architecture
   Provides Interactive Navigation, Animations, Card Modals & Filters
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  initIntroReveal();   // ← runs first, before anything else
  initHeaderScroll();
  initMobileDrawer();
  initCardModals();
  initFacultyFilters();
  initGalleryFilters();
  initStatCounters();
  initEnquiryForm();
});

/* --------------------------------------------------------------------------
   INTRO TEXT REVEAL ANIMATION
   Line-by-line "slide up from clip" reveal with progress bar + exit
   -------------------------------------------------------------------------- */
function initIntroReveal() {
  const overlay   = document.getElementById('intro-overlay');
  const lines     = document.querySelectorAll('.intro-line-text');
  const fill      = document.querySelector('.intro-progress-fill');
  const tagline   = document.querySelector('.intro-tagline');

  if (!overlay || lines.length === 0) return;

  // Lock scroll while intro plays
  document.body.classList.add('intro-active');

  // Total duration the intro runs before exiting (ms)
  const TOTAL_DURATION  = 2800;
  const LINE_STAGGER    = 140;   // ms between each line reveal
  const REVEAL_START    = 300;   // ms delay before first line appears

  // Kick off the progress bar fill over TOTAL_DURATION
  requestAnimationFrame(() => {
    fill.style.transition = `width ${TOTAL_DURATION}ms linear`;
    fill.style.width = '100%';
  });

  // Fade in tagline after a short delay
  setTimeout(() => {
    tagline.classList.add('visible');
  }, 500);

  // Reveal each line with staggered delay
  lines.forEach((line, i) => {
    setTimeout(() => {
      line.classList.add('revealed');
    }, REVEAL_START + i * LINE_STAGGER);
  });

  // After the intro duration, trigger the exit animation
  setTimeout(() => {
    overlay.classList.add('intro-exit');

    // After the CSS exit transition finishes, hide the overlay & unlock scroll
    overlay.addEventListener('transitionend', () => {
      overlay.classList.add('intro-hidden');
      document.body.classList.remove('intro-active');
    }, { once: true });
  }, TOTAL_DURATION);
}


/* Header Sticky & Scrolled Effect */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/* Mobile Drawer Toggle */
function initMobileDrawer() {
  const toggle = document.querySelector('.mobile-toggle');
  const drawer = document.querySelector('.mobile-drawer');
  const links = document.querySelectorAll('.mobile-nav-link');

  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    drawer.classList.toggle('open');
  });

  links.forEach(link => {
    link.addEventListener('click', () => {
      drawer.classList.remove('open');
    });
  });
}

/* Card Navigation & Modal Data Handler */
const cardData = {
  '01': {
    title: 'About IHRD CAS Kodungallur',
    subtitle: 'ESTABLISHED IN 2002 | GOVT OF KERALA UNDERTAKING',
    content: `
      <p style="margin-bottom:1rem; line-height:1.7;">College of Applied Science, Kodungallur was established in the year 2002 under the Institute of Human Resources Development (IHRD), an autonomous institution established by the Government of Kerala. The college is affiliated to the University of Calicut and offers undergraduate and postgraduate programmes in Computer Science, Commerce, and Arts.</p>
      <div style="background:#F7EBDB; padding:1.25rem; border-radius:8px; border-left:3px solid #D92323; margin-top:1rem;">
        <h4 style="font-family:'Space Grotesk',sans-serif; margin-bottom:0.4rem;">OUR VISION</h4>
        <p style="font-size:0.9rem; color:#555;">To be a premier institution of higher learning in technical, scientific, and management education, fostering innovation, ethics, and career excellence.</p>
      </div>
    `
  },
  '02': {
    title: 'Academic Programmes & Courses Offered',
    subtitle: 'UNDERGRADUATE & POSTGRADUATE DEGREE PROGRAMMES',
    content: `
      <div style="display:flex; flex-direction:column; gap:1.2rem;">
        <div style="padding:1rem; border:1px solid #E2DFD9; border-radius:8px;">
          <strong style="color:#D92323; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase;">B.Sc. Computer Science (Honours)</strong>
          <p style="font-size:0.85rem; color:#555; margin-top:0.3rem;">4 Year UG Degree Programme | 36 Seats | Focus on Software Engineering, Data Structures, AI & Web Tech.</p>
        </div>
        <div style="padding:1rem; border:1px solid #E2DFD9; border-radius:8px;">
          <strong style="color:#D92323; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase;">BCA (Honours)</strong>
          <p style="font-size:0.85rem; color:#555; margin-top:0.3rem;">4 Year Bachelor of Computer Applications | 36 Seats | Focus on Application Development & Database Management.</p>
        </div>
        <div style="padding:1rem; border:1px solid #E2DFD9; border-radius:8px;">
          <strong style="color:#D92323; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase;">B.Com. with Computer Applications (Honours)</strong>
          <p style="font-size:0.85rem; color:#555; margin-top:0.3rem;">4 Year Degree | 50 Seats | Accounting, E-Commerce, Taxation & Financial Management.</p>
        </div>
        <div style="padding:1rem; border:1px solid #E2DFD9; border-radius:8px;">
          <strong style="color:#D92323; font-size:0.8rem; letter-spacing:1px; text-transform:uppercase;">M.Com. (Finance) & M.Sc. Computer Science</strong>
          <p style="font-size:0.85rem; color:#555; margin-top:0.3rem;">2 Year Postgraduate Programmes with advanced research modules.</p>
        </div>
      </div>
    `
  },
  '03': {
    title: 'Faculty Directory & Experts',
    subtitle: 'EXPERIENCED EDUCATORS & RESEARCHERS',
    content: `
      <p style="margin-bottom:1rem;">Our faculty members bring decades of academic excellence and industry expertise to nurture student learning and innovation.</p>
      <ul style="list-style:none; display:flex; flex-direction:column; gap:0.75rem;">
        <li style="padding:0.75rem; background:#F7EBDB; border-radius:6px;"><strong>Department of Computer Science:</strong> Led by highly qualified Asst. Professors specializing in AI, Machine Learning, and Web Architecture.</li>
        <li style="padding:0.75rem; background:#F7EBDB; border-radius:6px;"><strong>Department of Commerce:</strong> Experts in Financial Accounting, Corporate Law, and Business Analytics.</li>
      </ul>
    `
  },
  '04': {
    title: 'Admission Portal & Guidelines',
    subtitle: 'IHRD CENTRALISED ADMISSION PROCESS 2026-27',
    content: `
      <p style="margin-bottom:1rem;">Admissions to all UG and PG courses at IHRD CAS Kodungallur are conducted as per Government of Kerala & Calicut University guidelines.</p>
      <div style="background:#111; color:white; padding:1.25rem; border-radius:8px; margin-top:1rem;">
        <h4 style="color:#F7EBDB; margin-bottom:0.5rem;">How to Apply Online:</h4>
        <p style="font-size:0.85rem; color:#ccc; margin-bottom:1rem;">Submit your online application through the official IHRD Admission Portal.</p>
        <a href="http://caskodungallur.ihrd.ac.in/" target="_blank" style="background:#D92323; color:white; padding:0.6rem 1.2rem; border-radius:999px; text-decoration:none; display:inline-block; font-size:0.8rem; font-weight:700;">VISIT ADMISSION PORTAL →</a>
      </div>
    `
  },
  '05': {
    title: 'Events & News Highlights',
    subtitle: 'CAMPUS HAPPENINGS & TECH FESTIVALS',
    content: `
      <p style="margin-bottom:1rem;">Stay updated with state-level symposiums, technical workshops, NSS activities, and cultural festivals hosted at CAS Kodungallur.</p>
      <div style="padding:1rem; border-left:3px solid #0F4C81; background:#F7EBDB; margin-top:0.5rem;">
        <strong>Upcoming Event: TechVista 2026</strong>
        <p style="font-size:0.85rem; color:#555;">Annual State-level Inter-Collegiate IT Fest & Coding Competition.</p>
      </div>
    `
  },
  '06': {
    title: 'Campus Life & Visual Gallery',
    subtitle: 'MOMENTS AT IHRD KODUNGALLUR',
    // NOTE: gallery-public.js intercepts this card's click event and
    // replaces #modalBody with live Firebase gallery content.
    // This string is only shown for a brief instant before being replaced.
    content: `
      <div style="text-align:center;padding:2rem;">
        <p style="font-size:0.9rem;color:#666;">Loading gallery…</p>
      </div>
    `
  },
  '07': {
    title: 'Campus Facilities & Infrastructure',
    subtitle: 'MODERN LEARNING ENVIRONMENT',
    content: `
      <ul style="display:flex; flex-direction:column; gap:0.6rem; margin-top:0.5rem; list-style:none;">
        <li style="padding:0.75rem; border:1px solid #E2DFD9; border-radius:6px;">💻 <strong>Advanced Computer Labs:</strong> Equipped with high-speed internet and modern workstations.</li>
        <li style="padding:0.75rem; border:1px solid #E2DFD9; border-radius:6px;">📚 <strong>Digital Resource Library:</strong> Thousands of reference books, e-journals, and quiet reading halls.</li>
        <li style="padding:0.75rem; border:1px solid #E2DFD9; border-radius:6px;">🎤 <strong>Seminar Hall:</strong> Air-conditioned auditorium for guest lectures, seminars, and cultural events.</li>
      </ul>
    `
  },
  '08': {
    title: 'Student & Academic Achievements',
    subtitle: 'UNIVERSITY RANKS & SPORTS LAURELS',
    content: `
      <p style="margin-bottom:1rem;">Our students consistently achieve top ranks in University of Calicut examinations and earn laurels in sports and hackathons.</p>
    `
  },
  '09': {
    title: 'Career Placement & Guidance Cell',
    subtitle: '100% RECRUITMENT SUPPORT & TRAINING',
    content: `
      <p style="margin-bottom:1rem;">The Placement Cell conducts soft-skills training, campus interviews, and career counseling sessions in collaboration with leading tech firms and financial corporations.</p>
    `
  },
  '10': {
    title: 'Clubs & Extra-Curricular Activities',
    subtitle: 'NSS | SPORTS | CULTURAL & CODING CLUBS',
    content: `
      <p style="margin-bottom:1rem;">Students participate actively in National Service Scheme (NSS), Innovation and Entrepreneurship Development Centre (IEDC), and Cultural Arts teams.</p>
    `
  },
  '11': {
    title: 'Academic Calendar & Timetable',
    subtitle: 'SEMESTER SCHEDULES & EXAMINATION DATES',
    content: `
      <p style="margin-bottom:1rem;">Access the official Calicut University academic calendar, internal assessment dates, and semester examination schedules.</p>
    `
  },
  '12': {
    title: 'Downloads & Official Documents',
    subtitle: 'PROSPECTUS | ADMISSION FORMS | SYLLABUS',
    content: `
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <a href="#" class="btn-outline-dark" style="justify-content:space-between;">College Prospectus 2026 (PDF) <span>📥</span></a>
        <a href="#" class="btn-outline-dark" style="justify-content:space-between;">UG Admission Application Form <span>📥</span></a>
        <a href="#" class="btn-outline-dark" style="justify-content:space-between;">Course Syllabus (Calicut Univ) <span>📥</span></a>
      </div>
    `
  },
  '13': {
    title: 'Official Notices & Circulars',
    subtitle: 'IMPORTANT ANNOUNCEMENTS',
    content: `
      <p style="margin-bottom:1rem;">Regular updates from the Principal's Office regarding fee payments, exam registration, and holiday announcements.</p>
    `
  },
  '14': {
    title: 'Anti-Ragging & Campus Discipline',
    subtitle: 'ZERO TOLERANCE POLICY',
    content: `
      <p style="margin-bottom:1rem;">As per UGC regulations, ragging in any form is strictly prohibited on campus. The Anti-Ragging Committee ensures a safe and comfortable environment for all freshmen.</p>
    `
  },
  '15': {
    title: 'Contact Information & Location Map',
    subtitle: 'GET IN TOUCH WITH US',
    content: `
      <p style="margin-bottom:0.5rem;"><strong>Address:</strong> College of Applied Science, Thattupally, Eriyad (P.O), Kodungallur, Thrissur, Kerala – 680666.</p>
      <p style="margin-bottom:0.5rem;"><strong>Phone:</strong> 0480-2816270</p>
      <p style="margin-bottom:0.5rem;"><strong>Email:</strong> caskodungallur@ihrd.ac.in</p>
    `
  },
  '16': {
    title: 'Frequently Asked Questions (FAQ)',
    subtitle: 'HELPDESK & QUERY RESOLUTION',
    content: `
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <strong>Q: Is the college government recognised?</strong>
          <p style="font-size:0.85rem; color:#555;">Yes, managed by IHRD (Govt. of Kerala Undertaking) and affiliated to Calicut University.</p>
        </div>
        <div>
          <strong>Q: What are the working hours?</strong>
          <p style="font-size:0.85rem; color:#555;">Monday to Friday: 9:00 AM – 4:30 PM.</p>
        </div>
      </div>
    `
  }
};

/* Modal Popup Controller */
function initCardModals() {
  const cards = document.querySelectorAll('.nav-grid-card, .quick-card');
  const modal = document.getElementById('infoModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalBody = document.getElementById('modalBody');
  const closeBtn = document.getElementById('modalCloseBtn');

  if (!modal) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const cardNum = card.dataset.cardNum || '01';
      const data = cardData[cardNum] || cardData['01'];

      if (modalTitle) modalTitle.textContent = data.title;
      if (modalSubtitle) modalSubtitle.textContent = data.subtitle;
      if (modalBody) modalBody.innerHTML = data.content;

      modal.classList.add('active');
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

/* Faculty Filter Handler */
function initFacultyFilters() {
  const filterBtns = document.querySelectorAll('.faculty-filter-btn');
  const facultyCards = document.querySelectorAll('.faculty-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      facultyCards.forEach(card => {
        if (filter === 'all' || card.dataset.dept === filter) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* Gallery Filter Handler */
function initGalleryFilters() {
  const galleryBtns = document.querySelectorAll('.gallery-filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  galleryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      galleryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.category;
      galleryItems.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });
}

/* Stat Counter Animation */
function initStatCounters() {
  const statNumbers = document.querySelectorAll('.stat-number');
  let animated = false;

  const handleScroll = () => {
    if (animated) return;
    const statsSection = document.querySelector('.stats-counter-grid');
    if (!statsSection) return;

    const rect = statsSection.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.85) {
      animated = true;
      statNumbers.forEach(stat => {
        const target = parseInt(stat.dataset.target, 10);
        let count = 0;
        const speed = target / 50;

        const updateCount = () => {
          count += speed;
          if (count < target) {
            stat.textContent = Math.ceil(count) + (stat.dataset.plus ? '+' : '');
            setTimeout(updateCount, 30);
          } else {
            stat.textContent = target + (stat.dataset.plus ? '+' : '');
          }
        };
        updateCount();
      });
    }
  };

  window.addEventListener('scroll', handleScroll);
  handleScroll();
}

/* Enquiry Form Submission Handler */
function initEnquiryForm() {
  const form = document.getElementById('enquiryForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Submitting Enquiry...';
    btn.disabled = true;

    setTimeout(() => {
      alert('Thank you! Your enquiry has been submitted successfully. The CAS Kodungallur admission team will contact you shortly.');
      form.reset();
      btn.textContent = originalText;
      btn.disabled = false;
    }, 1200);
  });
}
