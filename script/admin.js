/* =============================================================
   Barbería Royal — Lógica del Panel de Administración y Login
   ============================================================= */

   (function () {
    'use strict';
  
    var cache = [], offlineWarned = false, loggedIn = false;
    var SLOTS = [];
    for (var h = 9; h < 19; h++) { SLOTS.push(pad(h) + ':00'); SLOTS.push(pad(h) + ':30'); }

    // Estados guardados en Supabase ↔ estados usados por la interfaz
    var FROM_DB = { pendiente: 'active', cancelada: 'cancelled', completada: 'completed' };
    var TO_DB = { active: 'pendiente', cancelled: 'cancelada', completed: 'completada' };

    function pad(n) { return String(n).padStart(2, '0'); }
    function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function fromISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function shortDate(iso) { return fromISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); }
    function addMinutes(t, mins) { var p = t.split(':'), m = (+p[0] * 60 + +p[1] + mins) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
    function load() { return cache; }

    // Convierte la respuesta de Supabase en promesa: resuelve con data o lanza el error
    function unwrap(res) { if (res.error) throw res.error; return res.data; }
    function toAppt(r) {
      return {
        id: r.id, date: r.fecha, time: r.hora_inicio.slice(0, 5), status: FROM_DB[r.estado] || 'active',
        name: r.clientes ? r.clientes.nombre : '—', email: r.clientes ? r.clientes.correo || '—' : '—',
        service: r.servicios ? r.servicios.nombre : '—', mins: r.servicios ? r.servicios.duracion_minutos : 30
      };
    }

    var $ = function (id) { return document.getElementById(id); };

    /* ---------- AUTENTICACIÓN ADMIN (Supabase Auth + tabla perfiles) ---------- */
    function loadPerfil(user) {
      return db.from('perfiles').select('nombre, rol').eq('id', user.id).maybeSingle().then(unwrap);
    }
    function isAdmin(perfil) { return !!perfil && perfil.rol === 'admin'; }

    function showPanel() {
      loggedIn = true;
      $('adminLoginSection').style.display = 'none';
      $('adminMainPanel').style.display = 'block';
      $('logoutBtn').style.display = 'inline-flex';
      $('adminGreeting').style.display = 'inline-block';
      refresh();
    }

    var adminLoginForm = $('adminLoginForm');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var userInp = $('adminUser').value.trim();
        var passInp = $('adminPass').value.trim();

        $('f-admin-user').classList.toggle('has-error', !userInp);
        $('f-admin-pass').classList.toggle('has-error', !passInp);

        if (!userInp || !passInp) {
          toast('Completa los campos de correo y contraseña.', 'error');
          return;
        }

        db.auth.signInWithPassword({ email: userInp, password: passInp })
          .then(unwrap)
          .then(function (data) { return loadPerfil(data.user); })
          .then(function (perfil) {
            if (!isAdmin(perfil)) {
              db.auth.signOut();
              throw new Error('Esta cuenta no tiene permisos de administrador.');
            }
            toast('¡Bienvenido al panel!', 'ok');
            showPanel();
          })
          .catch(function (err) {
            toast(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : err.message, 'error');
          });
      });
    }

    // Si ya había una sesión de admin abierta, entra directo
    db.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (!s) return;
      loadPerfil(s.user).then(function (perfil) { if (isAdmin(perfil)) showPanel(); }).catch(function () {});
    });

    var logoutBtn = $('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        loggedIn = false; cache = [];
        db.auth.signOut();
        if ($('adminLoginForm')) $('adminLoginForm').reset();
        $('adminMainPanel').style.display = 'none';
        $('adminLoginSection').style.display = 'block';
        logoutBtn.style.display = 'none';
        if ($('adminGreeting')) $('adminGreeting').style.display = 'none';
        toast('Sesión cerrada.');
      });
    }
  
    var filter = 'all', editingId = null;
  
    var toggle = $('navToggle'), links = $('navLinks');
    if (toggle) {
      toggle.addEventListener('click', function () { 
        var o = links.classList.toggle('is-open'); 
        toggle.setAttribute('aria-expanded', o); 
      });
    }
  
    function toast(msg, type) {
      var t = document.createElement('div'); t.className = 'toast' + (type ? ' toast--' + type : ''); t.textContent = msg;
      $('toasts').appendChild(t);
      setTimeout(function () { t.classList.add('is-leaving'); setTimeout(function () { t.remove(); }, 350); }, 3200);
    }
  
    function cell(tr, label, text, cls) {
      var td = document.createElement('td'); td.dataset.label = label; td.textContent = text;
      if (cls) td.className = cls; tr.appendChild(td); return td;
    }
  
    function refresh() {
      if (!loggedIn) return Promise.resolve();
      return db.from('citas').select('id, fecha, hora_inicio, estado, clientes(nombre, correo), servicios(nombre, duracion_minutos)')
        .then(unwrap)
        .then(function (rows) { offlineWarned = false; cache = rows.map(toAppt); render(); })
        .catch(function () { if (!offlineWarned) { offlineWarned = true; toast('Sin conexión con la base de datos.', 'error'); } });
    }
  
    function render() {
      var all = load();
      var active = all.filter(function (a) { return a.status === 'active'; }).length;
      if ($('m-total')) $('m-total').textContent = all.length;
      if ($('m-active')) $('m-active').textContent = active;
      if ($('m-cancel')) $('m-cancel').textContent = all.length - active;
  
      var rows = all.filter(function (a) { return filter === 'all' || (filter === 'active' ? a.status === 'active' : a.status === 'cancelled'); })
        .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
  
      var body = $('tbody'); if (!body) return;
      body.innerHTML = '';
      $('empty').hidden = rows.length > 0;
      $('empty').querySelector('strong').textContent = all.length ? 'Sin resultados' : 'Aún no hay citas';
  
      rows.forEach(function (a, i) {
        var tr = document.createElement('tr');
        tr.style.animationDelay = Math.min(i * 40, 400) + 'ms';
        if (a.status === 'cancelled') tr.className = 'is-cancelled';
        cell(tr, 'Cliente', a.name);
        cell(tr, 'Correo', a.email, 'cell-email');
        cell(tr, 'Servicio', a.service);
        cell(tr, 'Fecha', shortDate(a.date));
        cell(tr, 'Hora', a.time);
  
        var st = document.createElement('td'); st.dataset.label = 'Estado';
        var badge = document.createElement('span');
        var isActive = a.status === 'active';
        badge.className = 'badge ' + (isActive ? 'badge--active' : 'badge--cancel');
        badge.textContent = isActive ? 'Activa' : 'Cancelada';
        st.appendChild(badge); tr.appendChild(st);
  
        var ac = document.createElement('td'); ac.className = 'cell-actions';
        var box = document.createElement('div'); box.className = 'actions';
        var re = document.createElement('button'); re.type = 'button'; re.className = 'btn btn--blue btn--sm'; re.textContent = 'Reagendar';
        var ca = document.createElement('button'); ca.type = 'button'; ca.className = 'btn btn--ghost btn--sm'; ca.textContent = 'Cancelar';
        if (!isActive) { re.disabled = true; ca.disabled = true; }
        re.addEventListener('click', function () { openModal(a.id); });
        ca.addEventListener('click', function () { cancelAppt(a.id); });
        box.appendChild(re); box.appendChild(ca); ac.appendChild(box); tr.appendChild(ac);
        body.appendChild(tr);
      });
    }
  
    function cancelAppt(id) {
      var list = load();
      var a = list.filter(function (x) { return x.id === id; })[0];
      if (!a || !window.confirm('¿Cancelar la cita de ' + a.name + ' el ' + shortDate(a.date) + ' a las ' + a.time + '?')) return;
      db.from('citas').update({ estado: TO_DB.cancelled }).eq('id', a.id)
        .then(unwrap)
        .then(function () { toast('Cita cancelada.', 'ok'); refresh(); })
        .catch(function (e) { toast(e.message, 'error'); refresh(); });
    }
  
    function minDate() { var d = new Date(); return toISO(d); }
  
    function fillTimes(dateISO, keep) {
      var sel = $('newTime'); sel.innerHTML = '';
      var list = load(), now = new Date(), isToday = dateISO === toISO(now), n = 0;
      var ph = document.createElement('option'); ph.value = ''; ph.textContent = 'Selecciona una hora'; sel.appendChild(ph);
      SLOTS.forEach(function (t) {
        var taken = list.some(function (x) { return x.id !== editingId && x.status === 'active' && x.date === dateISO && x.time === t; });
        var p = t.split(':'), past = isToday && (+p[0] * 60 + +p[1]) <= (now.getHours() * 60 + now.getMinutes());
        if (taken || past) return;
        var o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); n++;
      });
      if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
      return n;
    }
  
    function validDate(v) {
      if (!v) return false;
      var d = fromISO(v); var t = new Date(); t.setHours(0, 0, 0, 0);
      return !isNaN(d) && d >= t && d.getDay() !== 0;
    }
  
    function openModal(id) {
      var a = load().filter(function (x) { return x.id === id; })[0]; if (!a) return;
      editingId = id;
      $('modalWho').textContent = a.name + ' · ' + a.service;
      var inp = $('newDate'); inp.min = minDate(); inp.value = a.date;
      $('f-date').classList.remove('has-error'); $('f-time').classList.remove('has-error');
      fillTimes(a.date, a.time);
      $('modal').classList.add('is-open'); inp.focus();
    }
    function closeModal() { $('modal').classList.remove('is-open'); editingId = null; }
  
    var newDateEl = $('newDate');
    if (newDateEl) {
      newDateEl.addEventListener('change', function () {
        var v = this.value, ok = validDate(v);
        $('f-date').classList.toggle('has-error', !ok);
        if (ok) { var n = fillTimes(v); if (!n) { $('f-time').classList.add('has-error'); $('f-time').querySelector('.field__error').textContent = 'No hay horas libres ese día.'; } else { $('f-time').classList.remove('has-error'); } }
      });
    }
  
    if ($('modalCancel')) $('modalCancel').addEventListener('click', closeModal);
    if ($('modal')) $('modal').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  
    if ($('modalSave')) {
      $('modalSave').addEventListener('click', function () {
        var d = $('newDate').value, t = $('newTime').value;
        var okD = validDate(d); $('f-date').classList.toggle('has-error', !okD);
        $('f-time').querySelector('.field__error').textContent = 'Elige una hora disponible.';
        var okT = !!t; $('f-time').classList.toggle('has-error', !okT);
        if (!okD || !okT) return;
  
        var list = load();
        var clash = list.some(function (x) { return x.id !== editingId && x.status === 'active' && x.date === d && x.time === t; });
        if (clash) { toast('Esa hora ya está ocupada.', 'error'); fillTimes(d); return; }
        var a = list.filter(function (x) { return x.id === editingId; })[0]; if (!a) return;
        db.from('citas').update({ fecha: d, hora_inicio: t, hora_fin: addMinutes(t, a.mins) }).eq('id', a.id)
          .then(unwrap)
          .then(function () { toast('Cita reagendada.', 'ok'); closeModal(); refresh(); })
          .catch(function (e) { toast(e.code === '23505' ? 'Esa hora ya está ocupada.' : e.message, 'error'); refresh(); });
      });
    }
  
    document.querySelectorAll('.chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active'); filter = c.dataset.filter; render();
      });
    });
  
    setInterval(refresh, 10000);
  })();


// ESTO ES LO DEL FORMULARIO DE CREACION DE UN NUEVO BARBERO 
// ---------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBarberFormBtn');
  const cancelBtn = document.getElementById('cancelBarberBtn');
  const dropdown = document.getElementById('newBarberDropdown');

  if (toggleBtn && dropdown) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = dropdown.style.display === 'none';
      dropdown.style.display = isHidden ? 'block' : 'none';
    });
  }

  if (cancelBtn && dropdown) {
    cancelBtn.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });
  }
});