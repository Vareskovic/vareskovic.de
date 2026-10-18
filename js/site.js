document.documentElement.classList.add('js');

function toggleNav(){
  const links = document.getElementById('nav-links');
  const btn = document.querySelector('.nav-toggle');
  if(!links) return;
  const open = links.classList.toggle('open');
  if(btn) btn.setAttribute('aria-expanded', open);
}

document.querySelectorAll('.nav-links a').forEach(a=>{
  a.addEventListener('click', ()=>{
    const links = document.getElementById('nav-links');
    if(links && links.classList.contains('open')) toggleNav();
  });
});

// Active section in the navigation
const navLinks = document.querySelectorAll('.nav-links a[href^="#"], .side-nav a[href^="#"]');
const sections = [...document.querySelectorAll('section[id]')];
function setActive(id){
  navLinks.forEach(a=>a.classList.toggle('active', a.getAttribute('href') === '#' + id));
}
sections.forEach(s=>{
  new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting) setActive(e.target.id); });
  },{ rootMargin:'-30% 0px -65% 0px' }).observe(s);
});

// Scroll progress bar; the last section counts as active at the very bottom
const progress = document.querySelector('.progress');
function onScroll(){
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  if(progress) progress.style.setProperty('--p', p);
  if(max > 0 && window.scrollY >= max - 4 && sections.length) setActive(sections[sections.length - 1].id);
}
window.addEventListener('scroll', onScroll, { passive:true });
onScroll();

// Count-up for key figures
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el){
  const target = parseInt(el.dataset.target, 10);
  if(Number.isNaN(target) || reduceMotion) return;
  const start = performance.now(), duration = 1100;
  (function tick(now){
    const t = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
    if(t < 1) requestAnimationFrame(tick);
  })(start);
}

// Reveal on scroll with a small stagger per batch
const revealObserver = new IntersectionObserver(entries=>{
  let i = 0;
  entries.forEach(e=>{
    if(!e.isIntersecting) return;
    const el = e.target;
    el.style.transitionDelay = (i++ * 70) + 'ms';
    el.classList.add('in');
    setTimeout(()=>{ el.style.transitionDelay = ''; }, 1000);
    el.querySelectorAll('.count').forEach(countUp);
    revealObserver.unobserve(el);
  });
},{ threshold:0.12, rootMargin:'0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));

// Soft light following the cursor on cards
document.querySelectorAll('.card').forEach(card=>{
  card.addEventListener('pointermove', e=>{
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});
