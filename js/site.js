// Shared behaviour for all pages: nav, scroll reveal, counters,
// responsibilities accordion, card cursor-glow.

function toggleNav(){
  const links = document.getElementById('nav-links');
  if(links) links.classList.toggle('open');
}

function toggleResp(header){
  const card = header.closest('.resp-card');
  if(!card) return;
  const isOpen = card.classList.contains('open');
  document.querySelectorAll('.resp-card.open').forEach(c => c.classList.remove('open'));
  if(!isOpen) card.classList.add('open');
}

document.querySelectorAll('section[id]').forEach(s=>{
  new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        document.querySelectorAll('.nav-links a[href^="#"]').forEach(a=>a.classList.remove('active'));
        const m=document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if(m) m.classList.add('active');
      }
    });
  },{threshold:0.35}).observe(s);
});

const btt=document.getElementById('btt');
if(btt){
  window.addEventListener('scroll', ()=> btt.classList.toggle('vis', scrollY>350));
}

function animateCount(el){
  const target = parseFloat(el.getAttribute('data-target'));
  if(Number.isNaN(target)) return;
  const duration = 900;
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased);
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

document.querySelectorAll('.fi').forEach((el,i)=>{
  new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.style.transitionDelay=(i%6*60)+'ms';
        e.target.classList.add('in');

        e.target.querySelectorAll('.count-num').forEach(animateCount);
      }
    });
  },{threshold:0.15}).observe(el);
});

document.querySelectorAll('.card').forEach(card=>{
  card.addEventListener('mousemove', e=>{
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
    card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
  });
});
