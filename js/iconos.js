/* =============================================================
   Barbería Royal — Iconos SVG compartidos
   Los usan la página de reservas (index.html) y el panel admin (admin.html).
   Todos dibujan en una cuadrícula de 24×24 con trazo (sin relleno); el tamaño
   y el color los pone el CSS (.ico usa 1em y currentColor).
   ============================================================= */

const ICONOS = {
  scissors: '<svg class="ico i-scissors" viewBox="0 0 24 24" aria-hidden="true"><g class="blade b1"><circle cx="6" cy="6" r="2.8"/><path d="M8.2 7.8L21 18.5"/></g><g class="blade b2"><circle cx="6" cy="18" r="2.8"/><path d="M8.2 16.2L21 5.5"/></g></svg>',
  razor: '<svg class="ico i-razor" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-35 12 12)"><rect x="2" y="9.8" width="9" height="4.4" rx="1.6"/><path class="rz" d="M11 10.5h8.2a1.8 1.8 0 0 1 1.8 1.8V14H11"/><circle cx="11" cy="12" r=".9"/></g></svg>',
  mustache: '<svg class="ico i-mustache" viewBox="0 0 24 24" aria-hidden="true"><path class="must" d="M12 10.4C10.6 8.8 8.2 8.4 6.2 9.2C4.2 10 2.8 11.6 2.2 14C4 12.9 5.6 13 7 14C8.8 15.3 10.6 15.2 12 13.2C13.4 15.2 15.2 15.3 17 14C18.4 13 20 12.9 21.8 14C21.2 11.6 19.8 10 17.8 9.2C15.8 8.4 13.4 8.8 12 10.4z"/></svg>',
  pole: '<svg class="ico i-pole" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5" width="8" height="14" rx="1.5"/><g clip-path="url(#pole-clip)"><g class="stripes"><path d="M8 -2l8-3.5M8 2.5l8-3.5M8 7l8-3.5M8 11.5l8-3.5M8 16l8-3.5M8 20.5l8-3.5"/></g></g><path d="M10 5V3M14 5V3M10 19v2M14 19v2"/></svg>',
  bottle: '<svg class="ico i-bottle" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v3h-4z"/><path d="M8 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M8 13h8"/><circle class="bub bx1" cx="10.8" cy="18" r=".7"/><circle class="bub bx2" cx="13.4" cy="17" r=".5"/><circle class="bub bx3" cx="12" cy="19" r=".6"/></svg>',
  crown: '<svg class="ico i-crown" viewBox="0 0 24 24" aria-hidden="true"><path class="crown" d="M4 18L3 8l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 21h16"/><path class="spark sp1" d="M12 0.8v2.4M10.8 2h2.4"/><path class="spark sp2" d="M21 2.5v2M20 3.5h2"/><path class="spark sp3" d="M3 2.5v2M2 3.5h2"/></svg>',
  comb: '<svg class="ico i-comb" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="5" rx="1.2"/><path class="tooth" style="animation-delay:0s" d="M5.5 12v5"/><path class="tooth" style="animation-delay:.15s" d="M8.5 12v5"/><path class="tooth" style="animation-delay:.3s" d="M11.5 12v5"/><path class="tooth" style="animation-delay:.45s" d="M14.5 12v5"/><path class="tooth" style="animation-delay:.6s" d="M17.5 12v5"/></svg>',
  cup: '<svg class="ico i-cup" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15.5z"/><path d="M16 12h1.4a2.3 2.3 0 0 1 0 4.6H15.6"/><path d="M4 22h13"/><path class="steam" d="M8 8.5c-1-1.2 1-2.2 0-3.6"/><path class="steam s2" d="M11.5 8.5c-1-1.2 1-2.2 0-3.6"/><path class="steam s3" d="M15 8.5c-1-1.2 1-2.2 0-3.6"/></svg>',

  // Iconos nuevos para servicios
  brush: '<svg class="ico i-brush" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11.5C6 6.5 8.7 3 12 3s6 3.5 6 8.5z"/><path d="M9.5 6v5.5M14.5 6v5.5M12 4.5v7"/><path d="M8.5 11.5h7v2.5h-7z"/><path d="M9.5 14h5l.7 7H8.8z"/></svg>',
  dryer: '<svg class="ico i-dryer" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="5"/><circle cx="9" cy="9" r="1.8"/><path d="M13.6 7H20v4h-6.4"/><path d="M8 14l1.5 7h3L11.4 13.6"/><path d="M21.5 7.5v3"/></svg>',
  spray: '<svg class="ico i-spray" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h8v10.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 7 20.5z"/><path d="M9 10V7h4v3"/><path d="M8.5 4h6v3h-6z"/><path d="M7 15h8"/><path d="M18 4h.01M21 2.5h.01M21 5.5h.01M19.5 8h.01"/></svg>',
  drop: '<svg class="ico i-drop" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c3.2 4.2 6 7.4 6 11a6 6 0 0 1-12 0c0-3.6 2.8-6.8 6-11z"/><path d="M9.2 14.5a2.9 2.9 0 0 0 2.4 2.8"/></svg>',
  face: '<svg class="ico i-face" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01"/><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2"/></svg>',
  towel: '<svg class="ico i-towel" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h13a3 3 0 0 1 0 6H4z"/><path d="M4 17v3h13"/><path d="M8 7.5c-.8-1 .8-1.8 0-3M12 7.5c-.8-1 .8-1.8 0-3M16 7.5c-.8-1 .8-1.8 0-3"/></svg>',
  star: '<svg class="ico i-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
  child: '<svg class="ico i-child" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="3"/><path d="M7 21v-6.5a5 5 0 0 1 10 0V21"/><path d="M12 13.5V21"/></svg>',

  // Iconos de la interfaz (no se ofrecen para servicios)
  check: '<svg class="ico i-check" viewBox="0 0 24 24" aria-hidden="true"><path class="draw" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  chevL: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>',
  chevR: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>'
};

/* Iconos que el admin puede asignar a un servicio, en el orden en que se muestran.
   El "id" es lo que se guarda en servicios.icono. Para añadir uno: dibujarlo en ICONOS
   y agregarlo aquí. */
const ICONOS_SERVICIO = [
  { id: 'scissors', nombre: 'Tijeras' },
  { id: 'comb',     nombre: 'Peine' },
  { id: 'razor',    nombre: 'Navaja' },
  { id: 'mustache', nombre: 'Barba' },
  { id: 'brush',    nombre: 'Brocha' },
  { id: 'dryer',    nombre: 'Secador' },
  { id: 'spray',    nombre: 'Atomizador' },
  { id: 'bottle',   nombre: 'Loción' },
  { id: 'drop',     nombre: 'Tinte' },
  { id: 'face',     nombre: 'Facial' },
  { id: 'towel',    nombre: 'Toalla caliente' },
  { id: 'child',    nombre: 'Niños' },
  { id: 'pole',     nombre: 'Poste' },
  { id: 'crown',    nombre: 'Corona' },
  { id: 'star',     nombre: 'Especial' },
  { id: 'cup',      nombre: 'Bebida' }
];

const ICONO_SERVICIO_POR_DEFECTO = 'scissors';

// SVG del icono de un servicio; si no tiene o ya no existe, las tijeras
function iconoServicio(id) {
  var ok = ICONOS_SERVICIO.some(function (i) { return i.id === id; });
  return ICONOS[ok ? id : ICONO_SERVICIO_POR_DEFECTO];
}
