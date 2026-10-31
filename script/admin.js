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
        closeBarbers();
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeBarbers(); } });
  
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
  
    document.querySelectorAll('.filters .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        document.querySelectorAll('.filters .chip').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active'); filter = c.dataset.filter; render();
      });
    });
  
    /* ---------- CRUD DE BARBEROS (tabla "barberos" en Supabase) ---------- */
    var barbers = [], horarios = [], editingBarberId = null;
    var DIAS = ['', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
    var HORAS = SLOTS.concat(['19:00']);
    var HORARIO_GENERAL = [1, 2, 3, 4, 5, 6].map(function (d) { return { dia_semana: d, hora_inicio: '09:00', hora_fin: '19:00' }; });

    function validBarberName(v) { return v.length >= 3 && v.length <= 60; }
    function validPhone(v) { return !v || /^[0-9+\-\s()]{7,20}$/.test(v); }

    function loadBarbers() {
      return Promise.all([
        db.from('barberos').select('id, nombre, telefono, activo').order('nombre').then(unwrap),
        db.from('horarios_barberos').select('barbero_id, dia_semana, hora_inicio, hora_fin, activo').order('hora_inicio').then(unwrap)
      ])
        .then(function (res) { barbers = res[0]; horarios = res[1]; renderBarbers(); fillVacBarberos(); })
        .catch(function (e) { toast('No se pudieron cargar los barberos: ' + e.message, 'error'); });
    }

    // dia_semana: 0 = domingo, 1 = lunes … 6 = sábado; activo = false si ese día no atiende
    function horarioDe(id) { return horarios.filter(function (h) { return h.barbero_id === id; }); }
    function horarioActivo(id) { return horarioDe(id).filter(function (h) { return h.activo; }); }

    // Agrupa días seguidos con el mismo horario: "Lu–Vi 09:00–19:00 · Sá 09:00–14:00"
    function horarioResumen(list) {
      var parts = [];
      list.slice().sort(function (a, b) { return a.dia_semana - b.dia_semana; }).forEach(function (h) {
        var hrs = h.hora_inicio.slice(0, 5) + '–' + h.hora_fin.slice(0, 5), last = parts[parts.length - 1];
        if (last && last.hrs === hrs && last.to === h.dia_semana - 1) last.to = h.dia_semana;
        else parts.push({ from: h.dia_semana, to: h.dia_semana, hrs: hrs });
      });
      if (!parts.length) return 'Sin horario';
      return parts.map(function (p) { return DIAS[p.from] + (p.to > p.from ? '–' + DIAS[p.to] : '') + ' ' + p.hrs; }).join(' · ');
    }

    /* Editor de horario: una fila por día (lunes a sábado) con entrada y salida */
    function horarioRows() { return Array.prototype.slice.call($('barberHorario').children); }

    function buildHorarioEditor() {
      var box = $('barberHorario'); if (box.children.length) return;
      for (var d = 1; d <= 6; d++) {
        var row = document.createElement('div'); row.className = 'horario-row'; row.dataset.dia = d;
        row.innerHTML = '<label class="dia"><input type="checkbox"><span>' + DIAS[d] + '</span></label>' +
          '<select aria-label="Entrada ' + DIAS[d] + '"></select><span class="horario-row__sep">a</span><select aria-label="Salida ' + DIAS[d] + '"></select>';
        var sels = row.querySelectorAll('select');
        HORAS.forEach(function (t, i) {
          if (i < HORAS.length - 1) sels[0].add(new Option(t, t));
          if (i > 0) sels[1].add(new Option(t, t));
        });
        row.querySelector('input').addEventListener('change', function () {
          var on = this.checked;
          Array.prototype.forEach.call(this.closest('.horario-row').querySelectorAll('select'), function (s) { s.disabled = !on; });
          $('f-barber-horario').classList.remove('has-error');
        });
        box.appendChild(row);
      }
    }

    // El editor maneja un bloque por día: si en la base hay varios, se toma del primero al último
    function setHorarioForm(list) {
      horarioRows().forEach(function (row) {
        var day = list.filter(function (x) { return x.dia_semana === +row.dataset.dia; });
        var on = day.some(function (x) { return x.activo !== false; });
        var sels = row.querySelectorAll('select');
        row.querySelector('input').checked = on;
        sels[0].value = day.length ? day[0].hora_inicio.slice(0, 5) : '09:00';
        sels[1].value = day.length ? day[day.length - 1].hora_fin.slice(0, 5) : '19:00';
        sels[0].disabled = sels[1].disabled = !on;
      });
    }

    // Los seis días con su estado (los desmarcados se guardan con activo = false para conservar sus horas),
    // o null si no hay ningún día marcado o alguna salida no es posterior a la entrada
    function readHorarioForm() {
      var out = [], ok = true;
      horarioRows().forEach(function (row) {
        var on = row.querySelector('input').checked, sels = row.querySelectorAll('select');
        var valid = sels[0].value < sels[1].value;
        if (on && !valid) ok = false;
        if (valid) out.push({ dia_semana: +row.dataset.dia, hora_inicio: sels[0].value, hora_fin: sels[1].value, activo: on });
      });
      return ok && out.some(function (h) { return h.activo; }) ? out : null;
    }

    // Reemplaza el horario completo del barbero en una sola transacción (función en Supabase)
    function saveHorario(barberoId, horario) {
      return db.rpc('guardar_horario_barbero', { p_barbero_id: barberoId, p_horario: horario }).then(unwrap);
    }

    function renderBarbers() {
      var body = $('barbersTbody'); body.innerHTML = '';
      $('barbersEmpty').hidden = barbers.length > 0;
      barbers.forEach(function (b, i) {
        var tr = document.createElement('tr');
        tr.style.animationDelay = Math.min(i * 40, 400) + 'ms';
        if (!b.activo) tr.className = 'is-cancelled';
        cell(tr, 'Nombre', b.nombre);
        cell(tr, 'Teléfono', b.telefono || '—');
        cell(tr, 'Horario', horarioResumen(horarioActivo(b.id)), 'cell-horario');
        cell(tr, 'Acceso', accesos[b.id] ? accesos[b.id].correo : 'Sin acceso', 'cell-email');

        var st = document.createElement('td'); st.dataset.label = 'Estado';
        var badge = document.createElement('span');
        badge.className = 'badge ' + (b.activo ? 'badge--active' : 'badge--cancel');
        badge.textContent = b.activo ? 'Activo' : 'Inactivo';
        st.appendChild(badge); tr.appendChild(st);

        var ac = document.createElement('td'); ac.className = 'cell-actions';
        var box = document.createElement('div'); box.className = 'actions';
        var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'btn btn--blue btn--sm'; ed.textContent = 'Editar';
        var del = document.createElement('button'); del.type = 'button'; del.className = 'btn btn--ghost btn--sm'; del.textContent = 'Eliminar';
        var acc = document.createElement('button'); acc.type = 'button'; acc.className = 'btn btn--ghost btn--sm'; acc.textContent = 'Acceso';
        ed.addEventListener('click', function () { editBarber(b.id); });
        acc.addEventListener('click', function () { openAccess(b.id); });
        del.addEventListener('click', function () { deleteBarber(b.id); });
        box.appendChild(ed); box.appendChild(acc); box.appendChild(del); ac.appendChild(box); tr.appendChild(ac);
        body.appendChild(tr);
      });
    }

    /* ---------- ACCESO DE LOS BARBEROS AL PANEL (correo y contraseña en Supabase Auth) ----------
       La cuenta se crea con signUp y luego enlazar_acceso_barbero() (SQL, solo admin) crea su perfil,
       confirma el correo y fija la contraseña. Ver sql/accesos_barberos.sql */
    var accesos = {}, accessBarberId = null, signupClient = null;

    function loadAccesos() {
      return db.rpc('accesos_barberos').then(unwrap)
        .then(function (rows) {
          accesos = {};
          rows.forEach(function (r) { accesos[r.barbero_id] = r; });
          renderBarbers();
        })
        .catch(function (e) { toast('No se pudieron cargar los accesos: ' + e.message, 'error'); });
    }

    function openAccess(id) {
      var b = barbers.filter(function (x) { return x.id === id; })[0]; if (!b) return;
      var actual = accesos[id];
      accessBarberId = id;
      $('accessForm').reset();
      $('f-access-correo').classList.remove('has-error'); $('f-access-pass').classList.remove('has-error');
      $('accessTitle').textContent = 'Acceso de ' + b.nombre;
      $('accessNote').textContent = actual
        ? 'Entra a barbero.html con este correo. Escribe una contraseña nueva para cambiarla.'
        : 'Crea el correo y la contraseña con los que ' + b.nombre + ' entrará al panel de barbero.';
      $('accessCorreo').value = actual ? actual.correo : '';
      $('accessCorreo').disabled = !!actual; // el correo se cambia desde Supabase → Authentication
      $('accessSave').textContent = actual ? 'Cambiar contraseña' : 'Crear acceso';
      $('accessForm').hidden = false;
      $('accessForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      (actual ? $('accessPass') : $('accessCorreo')).focus();
    }
    function closeAccess() { accessBarberId = null; $('accessForm').hidden = true; }

    // Cliente aparte que no guarda sesión: así signUp no reemplaza la sesión del admin
    function getSignupClient() {
      if (!signupClient) {
        signupClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'barberia-alta-barbero' }
        });
      }
      return signupClient;
    }

    function authMessage(err) {
      var m = (err && err.message) || '';
      if (/rate limit/i.test(m)) return 'Supabase limitó el envío de correos. Desactiva "Confirm email" en Authentication → Providers → Email o espera un rato.';
      if (/signups? not allowed/i.test(m)) return 'El registro de usuarios está desactivado en Supabase. Crea la cuenta en Authentication → Add user y vuelve a pulsar "Crear acceso".';
      return m || 'No se pudo crear la cuenta.';
    }

    // 1) signUp crea la cuenta (si ya existía se sigue igual); 2) la función SQL la enlaza, la confirma y fija la contraseña
    function createAccess(barberoId, correo, pass) {
      return getSignupClient().auth.signUp({ email: correo, password: pass })
        .then(function (res) { return res.error; }, function (e) { return e; })
        .then(function (signupErr) {
          return db.rpc('enlazar_acceso_barbero', { p_correo: correo, p_barbero_id: barberoId, p_contrasena: pass })
            .then(function (res) {
              if (!res.error) return;
              // Si la cuenta no existe es porque signUp falló: se muestra ese motivo
              if (signupErr && /no existe ninguna cuenta/i.test(res.error.message)) throw new Error(authMessage(signupErr));
              throw res.error;
            });
        });
    }

    function resetBarberForm() {
      editingBarberId = null;
      $('barberForm').reset();
      $('barberActivo').checked = true;
      $('f-barber-nombre').classList.remove('has-error'); $('f-barber-tel').classList.remove('has-error');
      $('f-barber-horario').classList.remove('has-error');
      setHorarioForm(HORARIO_GENERAL);
      $('barberFormTitle').textContent = 'Nuevo barbero';
      $('barberFormSave').textContent = 'Agregar barbero';
      $('barberFormReset').hidden = true;
    }

    function markEditing(id) {
      editingBarberId = id;
      $('barberFormTitle').textContent = 'Editar barbero';
      $('barberFormSave').textContent = 'Guardar cambios';
      $('barberFormReset').hidden = false;
    }

    function editBarber(id) {
      var b = barbers.filter(function (x) { return x.id === id; })[0]; if (!b) return;
      resetBarberForm();
      markEditing(id);
      $('barberNombre').value = b.nombre;
      $('barberTelefono').value = b.telefono || '';
      $('barberActivo').checked = !!b.activo;
      setHorarioForm(horarioDe(id));
      $('barberNombre').focus();
    }

    function deleteBarber(id) {
      var b = barbers.filter(function (x) { return x.id === id; })[0];
      if (!b || !window.confirm('¿Eliminar al barbero ' + b.nombre + '? Esta acción no se puede deshacer.')) return;
      db.from('barberos').delete().eq('id', id).select('id')
        .then(unwrap)
        .then(function (rows) {
          if (!rows.length) throw new Error('No tienes permiso para eliminar barberos.');
          if (editingBarberId === id) resetBarberForm();
          toast('Barbero eliminado.', 'ok'); loadBarbers();
        })
        .catch(function (e) {
          // 23503: hay citas o perfiles que apuntan a este barbero
          toast(e.code === '23503' ? b.nombre + ' tiene citas o un usuario asociado. Desactívalo en lugar de eliminarlo.' : e.message, 'error');
        });
    }

    function openBarbers() {
      buildHorarioEditor();
      resetBarberForm(); resetVacForm(); closeAccess();
      showTab('tab-barberos');
      $('barbersModal').classList.add('is-open');
      loadBarbers().then(loadAccesos);
      $('barberNombre').focus();
    }

    function showTab(id) {
      document.querySelectorAll('.modal-tabs .chip').forEach(function (c) {
        var on = c.dataset.tab === id;
        c.classList.toggle('is-active', on); c.setAttribute('aria-selected', on);
        $(c.dataset.tab).hidden = !on;
      });
      if (id === 'tab-vacaciones') loadVacaciones();
    }
    function closeBarbers() { if ($('barbersModal')) $('barbersModal').classList.remove('is-open'); }

    if ($('barbersModal')) {
      $('openBarbersBtn').addEventListener('click', openBarbers);
      $('barbersClose').addEventListener('click', closeBarbers);
      $('barbersModal').addEventListener('click', function (e) { if (e.target === this) closeBarbers(); });
      $('barberFormReset').addEventListener('click', resetBarberForm);
      $('accessCancel').addEventListener('click', closeAccess);

      $('accessForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var correo = $('accessCorreo').value.trim().toLowerCase(), pass = $('accessPass').value;
        var isNew = !accesos[accessBarberId];
        var okC = !isNew || (correo.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo));
        var okP = pass.length >= 8 && pass.length <= 72;
        $('f-access-correo').classList.toggle('has-error', !okC);
        $('f-access-pass').classList.toggle('has-error', !okP);
        if (!okC || !okP) return;

        var saveBtn = $('accessSave'); saveBtn.disabled = true;
        var save = isNew
          ? createAccess(accessBarberId, correo, pass)
          : db.rpc('cambiar_contrasena_barbero', { p_barbero_id: accessBarberId, p_contrasena: pass }).then(unwrap);
        save
          .then(function () {
            toast(isNew ? 'Acceso creado. Ya puede entrar al panel de barbero.' : 'Contraseña actualizada.', 'ok');
            closeAccess(); loadAccesos();
          })
          .catch(function (err) { toast(err.message, 'error'); })
          .then(function () { saveBtn.disabled = false; });
      });

      $('barberForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var nombre = $('barberNombre').value.trim().replace(/\s+/g, ' ');
        var telefono = $('barberTelefono').value.trim();
        var horario = readHorarioForm();
        var okN = validBarberName(nombre), okT = validPhone(telefono);
        $('f-barber-nombre').classList.toggle('has-error', !okN);
        $('f-barber-tel').classList.toggle('has-error', !okT);
        $('f-barber-horario').classList.toggle('has-error', !horario);
        if (!okN || !okT || !horario) return;

        var data = { nombre: nombre, telefono: telefono || null, activo: $('barberActivo').checked };
        var isNew = editingBarberId === null;
        var saveBtn = $('barberFormSave'); saveBtn.disabled = true;
        var query = isNew
          ? db.from('barberos').insert(data).select('id')
          : db.from('barberos').update(data).eq('id', editingBarberId).select('id');
        query.then(unwrap)
          .then(function (rows) {
            if (!rows.length) throw new Error('No tienes permiso para modificar barberos.');
            // Si falla el horario, el formulario queda editando este barbero para no duplicarlo al reintentar
            markEditing(rows[0].id);
            return saveHorario(rows[0].id, horario);
          })
          .then(function () {
            toast(isNew ? 'Barbero agregado.' : 'Barbero actualizado.', 'ok');
            resetBarberForm();
          })
          .catch(function (err) { toast(err.message, 'error'); })
          .then(function () { saveBtn.disabled = false; loadBarbers(); });
      });
    }

    /* ---------- VACACIONES DE LOS BARBEROS (tabla "vacaciones_barberos") ----------
       estado: 'pendiente' | 'aprobado'. Solo las aprobadas bloquean citas en la página de reservas. */
    var vacaciones = [], editingVacId = null;

    function dayLabel(iso) { return fromISO(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }
    function rangeLabel(a, b) { return a === b ? dayLabel(a) : dayLabel(a) + ' – ' + dayLabel(b); }
    function vacBarberName(v) { return v.barberos ? v.barberos.nombre : '—'; }

    function loadVacaciones() {
      return db.from('vacaciones_barberos').select('id, barbero_id, fecha_inicio, fecha_fin, motivo, estado, barberos(nombre)')
        .order('fecha_inicio', { ascending: false })
        .then(unwrap)
        .then(function (rows) { vacaciones = rows; renderVacaciones(); })
        .catch(function (e) { toast('No se pudieron cargar las vacaciones: ' + e.message, 'error'); });
    }

    function fillVacBarberos() {
      var sel = $('vacBarbero'), keep = sel.value; sel.innerHTML = '';
      sel.add(new Option('Selecciona un barbero', ''));
      barbers.forEach(function (b) { sel.add(new Option(b.nombre + (b.activo ? '' : ' (inactivo)'), b.id)); });
      if (Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
    }

    function renderVacaciones() {
      var body = $('vacTbody'); body.innerHTML = '';
      $('vacEmpty').hidden = vacaciones.length > 0;
      var hoy = toISO(new Date());
      vacaciones.forEach(function (v, i) {
        var tr = document.createElement('tr');
        tr.style.animationDelay = Math.min(i * 40, 400) + 'ms';
        if (v.fecha_fin < hoy) tr.className = 'is-cancelled'; // ya terminaron
        cell(tr, 'Barbero', vacBarberName(v));
        cell(tr, 'Fechas', rangeLabel(v.fecha_inicio, v.fecha_fin));
        cell(tr, 'Motivo', v.motivo || '—');

        var aprobada = v.estado === 'aprobado';
        var st = document.createElement('td'); st.dataset.label = 'Estado';
        var badge = document.createElement('span');
        badge.className = 'badge ' + (aprobada ? 'badge--active' : 'badge--pending');
        badge.textContent = aprobada ? 'Aprobada' : 'Pendiente';
        st.appendChild(badge); tr.appendChild(st);

        var ac = document.createElement('td'); ac.className = 'cell-actions';
        var box = document.createElement('div'); box.className = 'actions';
        if (!aprobada) {
          var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn btn--blue btn--sm'; ok.textContent = 'Aprobar';
          ok.addEventListener('click', function () { approveVacacion(v); });
          box.appendChild(ok);
        }
        var ed = document.createElement('button'); ed.type = 'button'; ed.className = 'btn btn--ghost btn--sm'; ed.textContent = 'Editar';
        var del = document.createElement('button'); del.type = 'button'; del.className = 'btn btn--ghost btn--sm'; del.textContent = 'Eliminar';
        ed.addEventListener('click', function () { editVacacion(v.id); });
        del.addEventListener('click', function () { deleteVacacion(v); });
        box.appendChild(ed); box.appendChild(del); ac.appendChild(box); tr.appendChild(ac);
        body.appendChild(tr);
      });
    }

    function resetVacForm() {
      editingVacId = null;
      $('vacForm').reset();
      ['f-vac-barbero', 'f-vac-inicio', 'f-vac-fin'].forEach(function (id) { $(id).classList.remove('has-error'); });
      $('vacFormTitle').textContent = 'Nuevas vacaciones';
      $('vacFormSave').textContent = 'Agregar vacaciones';
      $('vacFormReset').hidden = true;
    }

    function editVacacion(id) {
      var v = vacaciones.filter(function (x) { return x.id === id; })[0]; if (!v) return;
      resetVacForm();
      editingVacId = id;
      $('vacBarbero').value = v.barbero_id;
      $('vacEstado').value = v.estado === 'aprobado' ? 'aprobado' : 'pendiente';
      $('vacInicio').value = v.fecha_inicio;
      $('vacFin').value = v.fecha_fin;
      $('vacMotivo').value = v.motivo || '';
      $('vacFormTitle').textContent = 'Editar vacaciones';
      $('vacFormSave').textContent = 'Guardar cambios';
      $('vacFormReset').hidden = false;
      $('vacInicio').focus();
    }

    // Las vacaciones no cancelan las citas ya agendadas: avisa al admin para que las reagende
    function warnCitas(v) {
      db.from('citas').select('id', { count: 'exact', head: true })
        .eq('barbero_id', v.barbero_id).gte('fecha', v.fecha_inicio).lte('fecha', v.fecha_fin)
        .in('estado', ['pendiente', 'confirmada'])
        .then(function (res) {
          if (res.count) toast(res.count + (res.count === 1 ? ' cita activa' : ' citas activas') + ' de este barbero cae en esas fechas. Reagéndala o cancélala.', 'error');
        });
    }

    function approveVacacion(v) {
      db.from('vacaciones_barberos').update({ estado: 'aprobado' }).eq('id', v.id).select('id')
        .then(unwrap)
        .then(function (rows) {
          if (!rows.length) throw new Error('No tienes permiso para gestionar vacaciones.');
          toast('Vacaciones de ' + vacBarberName(v) + ' aprobadas.', 'ok');
          warnCitas(v); loadVacaciones();
        })
        .catch(function (e) { toast(e.message, 'error'); });
    }

    function deleteVacacion(v) {
      if (!window.confirm('¿Eliminar las vacaciones de ' + vacBarberName(v) + ' (' + rangeLabel(v.fecha_inicio, v.fecha_fin) + ')?')) return;
      db.from('vacaciones_barberos').delete().eq('id', v.id).select('id')
        .then(unwrap)
        .then(function (rows) {
          if (!rows.length) throw new Error('No tienes permiso para gestionar vacaciones.');
          if (editingVacId === v.id) resetVacForm();
          toast('Vacaciones eliminadas.', 'ok'); loadVacaciones();
        })
        .catch(function (e) { toast(e.message, 'error'); });
    }

    if ($('vacForm')) {
      document.querySelectorAll('.modal-tabs .chip').forEach(function (c) {
        c.addEventListener('click', function () { showTab(c.dataset.tab); });
      });
      $('vacFormReset').addEventListener('click', resetVacForm);

      $('vacForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var barberoId = +$('vacBarbero').value, ini = $('vacInicio').value, fin = $('vacFin').value;
        var okB = !!barberoId, okI = !!ini, okF = !!fin && fin >= ini;
        $('f-vac-barbero').classList.toggle('has-error', !okB);
        $('f-vac-inicio').classList.toggle('has-error', !okI);
        $('f-vac-fin').classList.toggle('has-error', !okF);
        if (!okB || !okI || !okF) return;

        var data = { barbero_id: barberoId, fecha_inicio: ini, fecha_fin: fin, motivo: $('vacMotivo').value.trim() || null, estado: $('vacEstado').value };
        var isNew = editingVacId === null;
        var saveBtn = $('vacFormSave'); saveBtn.disabled = true;
        var query = isNew
          ? db.from('vacaciones_barberos').insert(data).select('id')
          : db.from('vacaciones_barberos').update(data).eq('id', editingVacId).select('id');
        query.then(unwrap)
          .then(function (rows) {
            if (!rows.length) throw new Error('No tienes permiso para gestionar vacaciones.');
            toast(isNew ? 'Vacaciones registradas.' : 'Vacaciones actualizadas.', 'ok');
            resetVacForm();
            if (data.estado === 'aprobado') warnCitas(data);
          })
          .catch(function (err) { toast(err.message, 'error'); })
          .then(function () { saveBtn.disabled = false; loadVacaciones(); });
      });
    }

    setInterval(refresh, 10000);
  })();