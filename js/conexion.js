const { createClient } = supabase;

const SUPABASE_URL = "https://wakzdxcnrbplyqiggtak.supabase.co";
const SUPABASE_KEY = "sb_publishable_jXiisq2FbBwJU8u3R-tMDg_abyvHrGZ";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---------- Una sesión por panel ----------
   Los paneles de admin y de barbero comparten la sesión del navegador. Cada panel marca
   la sesión con su nombre; si al abrir un panel la sesión es del otro, se cierra y pide
   iniciar sesión de nuevo. Si el otro panel está abierto en otra pestaña, vuelve al login. */
const PANEL_KEY = 'barberia-panel';

function marcarPanel(panel) { localStorage.setItem(PANEL_KEY, panel); }

// ¿La sesión abierta se inició en este panel?
function sesionEsDe(panel) { return localStorage.getItem(PANEL_KEY) === panel; }

// Cierra la sesión solo en este navegador (sin esperar al servidor)
function cerrarSesionLocal() {
  localStorage.removeItem(PANEL_KEY);
  return db.auth.signOut({ scope: 'local' });
}

// Llama a onPerdida() si la sesión de este panel se cierra o la reemplaza otra (p. ej. desde otra pestaña)
function vigilarSesion(panel, usuarioActual, onPerdida) {
  function revisar(session) {
    var uid = usuarioActual(); if (!uid) return;
    if (!session || session.user.id !== uid || !sesionEsDe(panel)) onPerdida();
  }
  db.auth.onAuthStateChange(function (event, session) { setTimeout(function () { revisar(session); }, 0); });
  // Cambios hechos en otra pestaña (la marca del panel o la sesión de Supabase)
  window.addEventListener('storage', function () {
    db.auth.getSession().then(function (res) { revisar(res.data && res.data.session); });
  });
}

/* ---------- Servicios de una cita ----------
   Columnas a pedir junto con la cita y texto a mostrar: "Corte clásico + Barba y perfilado".
   Las citas antiguas sin filas en cita_servicios usan su servicio_id. */
const CITA_SERVICIOS_SELECT = 'servicios(nombre), cita_servicios(orden, servicios(nombre))';

function nombresServicios(r) {
  var lista = (r.cita_servicios || []).slice()
    .sort(function (a, b) { return a.orden - b.orden; })
    .map(function (x) { return x.servicios ? x.servicios.nombre : null; })
    .filter(Boolean);
  if (!lista.length && r.servicios) lista.push(r.servicios.nombre);
  return lista.length ? lista.join(' + ') : '—';
}
