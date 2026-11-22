
const reveals = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  reveals.forEach(el => obs.observe(el));
} else {

  reveals.forEach(el => el.classList.add('visible'));
}


const hero = document.querySelector('.hero');
if (hero) {

  hero.style.willChange = 'transform';

  let rafPending = false;
  let mx = 0, my = 0;


  const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (hasHover) {
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          const x = (window.innerWidth  / 2 - mx) / 40;
          const y = (window.innerHeight / 2 - my) / 40;
          hero.style.transform = `translate(${x}px, ${y}px)`;
          rafPending = false;
        });
      }
    }, { passive: true }); 
  }
}
