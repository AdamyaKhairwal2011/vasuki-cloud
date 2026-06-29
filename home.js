/* ── LENIS SMOOTH SCROLL ── */
const lenis = new Lenis({
    duration: 1.8,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 0.8,
    smoothTouch: false
});
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

/* ── MOBILE MENU ── */
const menuTrigger = document.getElementById('menuTrigger');
const mobileLinks = document.querySelectorAll('.mobile-menu-link');
function toggleMenu() { document.body.classList.toggle('mobile-menu-active'); }
menuTrigger.addEventListener('click', toggleMenu);
mobileLinks.forEach(link => link.addEventListener('click', toggleMenu));

/* ── VAIMANIKA ARC POSITIONING ── */
function positionArcCards() {
    const wrapper = document.getElementById('arcWrapper');
    if (!wrapper) return;

    // Only run arc positioning on desktop
    if (window.innerWidth <= 768) return;

    const cards = wrapper.querySelectorAll('.capability-card');
    const n = cards.length;

    // Arc is a semicircle: from 180° to 0° (left-to-right arc, opening upward)
    // We use an ellipse: cx = 50%, cy = at bottom, rx wide, ry tall
    const W = wrapper.offsetWidth;
    const H = wrapper.offsetHeight;
    const cx = W / 2;
    const cy = H + 40;        // Centre below the wrapper bottom
    const rx = W * 0.48;
    const ry = H * 0.92;

    // Distribute cards from ~190° to ~350° (bottom-left to bottom-right via top)
    const startDeg = 196;
    const endDeg   = 344;

    cards.forEach((card, i) => {
        const t = i / (n - 1);
        const deg = startDeg + t * (endDeg - startDeg);
        const rad = deg * Math.PI / 180;

        const x = cx + rx * Math.cos(rad);
        const y = cy + ry * Math.sin(rad);

        const cardW = 190;
        const cardH = card.offsetHeight || 160;

        card.style.position = 'absolute';
        card.style.left  = (x - cardW / 2) + 'px';
        card.style.top   = (y - cardH / 2) + 'px';
        card.style.width = cardW + 'px';
    });
}

// Run after fonts/layout settle
window.addEventListener('load', positionArcCards);
window.addEventListener('resize', positionArcCards);
setTimeout(positionArcCards, 200);

/* ── SCROLL REVEAL ── */
const revealEls = document.querySelectorAll('.step-card, .product-card, .deploy-step, .capability-card');
const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.style.transition += ', opacity 0.6s ease, transform 0.6s ease';
            e.target.style.opacity = '1';
            e.target.style.transform = e.target.style.transform.replace('translateY(24px)','translateY(0)') || 'translateY(0)';
            io.unobserve(e.target);
        }
    });
}, { threshold: 0.1 });

revealEls.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    io.observe(el);
});


let currentIndex = 0;
  const slides = document.querySelectorAll('.slide');
  const wrapper = document.querySelector('.slider-wrapper');
  const textSlides = document.querySelectorAll('.text-slide');
  let autoSlideTimer = setInterval(() => moveSlide(1), 10000);

  function updateLinkedComponent(index) {
    textSlides.forEach(slide => slide.classList.remove('active'));
    if (textSlides[index]) {
      textSlides[index].classList.add('active');
    }
  }

  function moveSlide(direction) {
    clearInterval(autoSlideTimer); 
    currentIndex += direction;

    if (currentIndex < 0) {
        currentIndex = slides.length - 1;
    } else if (currentIndex >= slides.length) {
        currentIndex = 0;
    }

    const offset = -currentIndex * 100;
    wrapper.style.transform = `translateX(${offset}%)`;
    
    updateLinkedComponent(currentIndex);
    autoSlideTimer = setInterval(() => moveSlide(1), 10000); 
  }
