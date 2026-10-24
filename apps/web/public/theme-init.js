// Runs before first paint so a saved theme / text size never flashes the wrong look.
// Kept as a file (not an inline script) so the production Content-Security-Policy can stay strict.
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  var p = localStorage.getItem('palette');
  if (p === 'turmeric' || p === 'silk' || p === 'flag' || p === 'classic') document.documentElement.setAttribute('data-palette', p);
  var s = Number(localStorage.getItem('textsize'));
  if (s === 112 || s === 125) document.documentElement.style.fontSize = s + '%';
} catch (e) {}
