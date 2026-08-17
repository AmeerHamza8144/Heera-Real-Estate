(() => {
  'use strict';
  const storageKey='heeraTheme';
  const saved=localStorage.getItem(storageKey);
  const systemDark=window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  let theme=saved || (systemDark ? 'dark' : 'light');
  const root=document.documentElement;
  function apply(value){theme=value;root.dataset.theme=value;localStorage.setItem(storageKey,value);document.querySelectorAll('.theme-toggle').forEach(button=>{const dark=value==='dark';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');button.innerHTML=`<span class="theme-toggle-icon" aria-hidden="true">${dark?'☀':'☾'}</span><span>${dark?'Light mode':'Dark mode'}</span>`;});}
  function createToggle(){const button=document.createElement('button');button.type='button';button.className='theme-toggle';button.addEventListener('click',()=>apply(theme==='dark'?'light':'dark'));return button;}
  function createSocials(){const nav=document.createElement('nav');nav.className='footer-socials';nav.setAttribute('aria-label','Social media');nav.innerHTML='<a href="https://www.facebook.com/" target="_blank" rel="noopener">Facebook</a><a href="https://www.instagram.com/" target="_blank" rel="noopener">Instagram</a><a href="https://wa.me/923000660446" target="_blank" rel="noopener">WhatsApp</a>';return nav;}
  document.addEventListener('DOMContentLoaded',()=>{const footer=document.querySelector('.site-footer');const header=document.querySelector('.admin-header');if(footer){footer.appendChild(createSocials());footer.appendChild(createToggle());}else if(header)header.insertBefore(createToggle(),header.lastElementChild);const year=document.querySelector('#year');if(year&&!year.textContent)year.textContent=new Date().getFullYear();apply(theme);});
  root.dataset.theme=theme;
})();
