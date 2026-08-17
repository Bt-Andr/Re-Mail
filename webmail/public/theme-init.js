// Externalisé depuis index.html pour rester compatible avec la CSP (script-src 'self',
// pas de 'unsafe-inline') — applique le thème avant le premier rendu pour éviter un flash.
(function () {
  var stored = localStorage.getItem('theme')
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (dark) document.documentElement.classList.add('dark')
})()
