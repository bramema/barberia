/* =============================================================
   Barbería Royal — Lógica del Panel de Administración y Login
   ============================================================= */

   (function () {
    'use strict';
  
    var API = '/api';
    var cache = [], offlineWarned = false;
    var cfg = JSON.parse(JSON.stringify(Horario.DEFAULT)); // horario actual (se carga del servidor)
  
    function pad(n) { return String(n).padStart(2, '0'); }
    function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function fromISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function shortDate(iso) { return fromISO(iso).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); }
    function load() { return cache; }
  
    function send(method, url, body) {
      return fetch(API + url, { 
        method: method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: body ? JSON.stringify(body) : undefined 
      })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) { var e = new Error(d.error || 'Error del servidor'); e.status = r.status; throw e; }
          return d;
        });
      });
    }
  
    var $ = function (id) { return document.getElementById(id); };
  
    /* ---------- AUTENTICACIÓN ADMIN ---------- */
    var adminLoginForm = $('adminLoginForm');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var userInp = $('adminUser').value.trim();
        var passInp = $('adminPass').value.trim();
  
        $('f-admin-user').classList.toggle('has-error', !userInp);
        $('f-admin-pass').classList.toggle('has-error', !passInp);
  
        if (!userInp || !passInp) {
          toast('Completa los campos de usuario y contraseña.', 'error');
          return;
        }
  
        send('POST', '/login', { username: userInp, password: passInp, role: 'admin' })
          .then(function (res) {
            toast('¡Bienvenido al panel!', 'ok');
            $('adminLoginSection').style.display = 'none';
            $('adminMainPanel').style.display = 'block';
            $('logoutBtn').style.display = 'inline-flex';
            $('adminGreeting').style.display = 'inline-block';
            loadConfig();
            refresh();
          })
          .catch(function (err) {
            toast(err.message || 'Credenciales incorrectas.', 'error');
          });
      });
    }
  
    var logoutBtn = $('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
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
      return send('GET', '/citas').then(function (rows) { offlineWarned = false; cache = rows; render(); })
        .catch(function () { if (!offlineWarned) { offlineWarned = true; toast('Sin conexión con el servidor.', 'error'); } });
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
      send('PATCH', '/citas/' + encodeURIComponent(a.id), { status: 'cancelled' })
        .then(function () { toast('Cita cancelada.', 'ok'); refresh(); })
        .catch(function (e) { toast(e.message, 'error'); refresh(); });
    }
  
    function minDate() { var d = new Date(); return toISO(d); }
  
    function fillTimes(dateISO, keep) {
      var sel = $('newTime'); sel.innerHTML = '';
      var list = load(), now = new Date(), isToday = dateISO === toISO(now), n = 0;
      var ph = document.createElement('option'); ph.value = ''; ph.textContent = 'Selecciona una hora'; sel.appendChild(ph);
      var dia = fromISO(dateISO).getDay();
      Horario.turnosDelDia(cfg, dia).forEach(function (t) {
        var usadas = list.filter(function (x) { return x.id !== editingId && x.status === 'active' && x.date === dateISO && x.time === t; }).length;
        var taken = usadas >= Horario.capacidad(cfg, dia, t);
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
      return !isNaN(d) && d >= t && Horario.diaAbierto(cfg, d.getDay());
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
  
        var list = load(), dia = fromISO(d).getDay();
        var clash = list.filter(function (x) { return x.id !== editingId && x.status === 'active' && x.date === d && x.time === t; }).length >= Horario.capacidad(cfg, dia, t);
        if (clash) { toast('Esa hora ya está ocupada.', 'error'); fillTimes(d); return; }
        var a = list.filter(function (x) { return x.id === editingId; })[0]; if (!a) return;
        send('PATCH', '/citas/' + encodeURIComponent(a.id), { date: d, time: t })
          .then(function () { toast('Cita reagendada.', 'ok'); closeModal(); refresh(); })
          .catch(function (e) { toast(e.message, 'error'); refresh(); });
      });
    }
  
    /* =========================================================
       HORARIOS — barbería y barberos
       ========================================================= */
    function loadConfig() {
      return send('GET', '/config').then(function (c) { cfg = c; renderHorarios(); })
        .catch(function () { toast('No se pudo cargar el horario.', 'error'); });
    }

    function fillHours(sel, value) {
      sel.innerHTML = '';
      Horario.opcionesHora().forEach(function (t) {
        var o = document.createElement('option'); o.value = t; o.textContent = Horario.bonita(t); sel.appendChild(o);
      });
      sel.value = value;
    }

    // Casillas de días (Lu, Ma, ... Do) con la semana empezando el lunes
    function buildDays(box, selected, name) {
      box.innerHTML = '';
      Horario.ORDEN_SEMANA.forEach(function (d) {
        var lbl = document.createElement('label'); lbl.className = 'dia'; lbl.title = Horario.DIAS[d];
        var inp = document.createElement('input'); inp.type = 'checkbox'; inp.name = name; inp.value = d;
        inp.checked = selected.indexOf(d) !== -1;
        var sp = document.createElement('span'); sp.textContent = Horario.DIAS_CORTOS[d];
        lbl.appendChild(inp); lbl.appendChild(sp); box.appendChild(lbl);
      });
    }
    function readDays(box) {
      return Array.prototype.filter.call(box.querySelectorAll('input[type=checkbox]'), function (i) { return i.checked; })
        .map(function (i) { return +i.value; });
    }

    function shopSummary() {
      var dias = readDays($('shopDays')), a = $('shopOpen').value, c = $('shopClose').value;
      var err = Horario.validarRango(a, c, dias);
      $('shopSummary').textContent = err ? err : 'Atiende ' + Horario.textoDias(dias) + ', de ' + Horario.textoRango(a, c) + '.';
      $('shopSummary').classList.toggle('is-error', !!err || !dias.length);
      if (!err && !dias.length) $('shopSummary').textContent = 'Elige al menos un día de atención.';
    }

    function barberSummary(b) {
      var h = cfg.horario;
      // Horas reales en que el barbero puede atender (cruce con el horario de la barbería)
      var desde = Math.max(Horario.aMin(b.inicio), Horario.aMin(h.apertura));
      var hasta = Math.min(Horario.aMin(b.fin), Horario.aMin(h.cierre));
      var dias = b.dias.filter(function (d) { return h.dias.indexOf(d) !== -1; });
      if (!b.dias.length) return { txt: 'No trabaja ningún día.', warn: true };
      if (hasta <= desde || !dias.length) return { txt: 'Su horario no coincide con el de la barbería: no recibirá citas.', warn: true };
      var txt = 'Trabaja ' + Horario.textoDias(b.dias) + ', de ' + Horario.textoRango(b.inicio, b.fin) + '.';
      var warn = dias.length < b.dias.length || desde > Horario.aMin(b.inicio) || hasta < Horario.aMin(b.fin);
      if (warn) txt += ' Solo recibirá citas cuando la barbería esté abierta.';
      return { txt: txt, warn: warn };
    }

    function renderHorarios() {
      if (!$('shopHoursForm')) return;
      fillHours($('shopOpen'), cfg.horario.apertura);
      fillHours($('shopClose'), cfg.horario.cierre);
      buildDays($('shopDays'), cfg.horario.dias, 'shopDay');
      shopSummary();

      var box = $('barberHours'); box.innerHTML = '';
      cfg.barberos.forEach(function (b) {
        var card = document.createElement('form'); card.className = 'barbero-horario'; card.noValidate = true;
        card.innerHTML =
          '<div class="barbero-horario__head"><strong class="barbero-horario__name"></strong><span class="barbero-horario__user"></span></div>' +
          '<div class="horario-grid">' +
            '<div class="field"><label>Entrada</label><select class="b-inicio"></select></div>' +
            '<div class="field"><label>Salida</label><select class="b-fin"></select></div>' +
          '</div>' +
          '<div class="field"><span class="field__label">Días de trabajo</span><div class="dias b-dias" role="group"></div></div>' +
          '<p class="horario-resumen b-resumen"></p>' +
          '<div class="horario-actions"><button type="submit" class="btn btn--blue btn--sm">Guardar horario de <span class="b-nom"></span></button></div>';
        card.querySelector('.barbero-horario__name').textContent = b.nombre;
        card.querySelector('.barbero-horario__user').textContent = '@' + b.usuario;
        card.querySelector('.b-nom').textContent = b.nombre;
        card.querySelector('.b-dias').setAttribute('aria-label', 'Días de trabajo de ' + b.nombre);
        var ini = card.querySelector('.b-inicio'), fin = card.querySelector('.b-fin'), dias = card.querySelector('.b-dias');
        ini.id = 'bIni-' + b.usuario; fin.id = 'bFin-' + b.usuario;
        ini.previousSibling.htmlFor = ini.id; fin.previousSibling.htmlFor = fin.id;
        fillHours(ini, b.inicio); fillHours(fin, b.fin);
        buildDays(dias, b.dias, 'dias-' + b.usuario);

        function preview() {
          var p = { inicio: ini.value, fin: fin.value, dias: readDays(dias) };
          var err = Horario.validarRango(p.inicio, p.fin, p.dias);
          var r = err ? { txt: err, warn: true } : barberSummary(p);
          var el = card.querySelector('.b-resumen'); el.textContent = r.txt;
          el.classList.toggle('is-error', !!err); el.classList.toggle('is-warn', !err && r.warn);
        }
        card.addEventListener('change', preview);
        preview();

        card.addEventListener('submit', function (e) {
          e.preventDefault();
          var p = { inicio: ini.value, fin: fin.value, dias: readDays(dias) };
          var err = Horario.validarRango(p.inicio, p.fin, p.dias);
          if (err) { toast(err, 'error'); return; }
          send('PUT', '/barberos/' + encodeURIComponent(b.usuario) + '/horario', p)
            .then(function (r) { cfg = r.config; savedMsg('Horario de ' + b.nombre + ' guardado.', r.fueraDeHorario); renderHorarios(); refresh(); })
            .catch(function (e2) { toast(e2.message, 'error'); });
        });
        box.appendChild(card);
      });
    }

    function savedMsg(msg, fuera) {
      toast(msg, 'ok');
      if (fuera) toast('Atención: ' + fuera + (fuera === 1 ? ' cita activa queda' : ' citas activas quedan') + (fuera === 1 ? ' fuera del nuevo horario. Reagéndala o cancélala.' : ' fuera del nuevo horario. Reagéndalas o cancélalas.'), 'error');
    }

    if ($('shopHoursForm')) {
      $('shopHoursForm').addEventListener('change', shopSummary);
      $('shopHoursForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var p = { apertura: $('shopOpen').value, cierre: $('shopClose').value, dias: readDays($('shopDays')) };
        var err = Horario.validarRango(p.apertura, p.cierre, p.dias) || (!p.dias.length && 'Elige al menos un día de atención.');
        if (err) { toast(err, 'error'); return; }
        send('PUT', '/config/horario', p)
          .then(function (r) { cfg = r.config; savedMsg('Horario de la barbería guardado.', r.fueraDeHorario); renderHorarios(); refresh(); })
          .catch(function (e2) { toast(e2.message, 'error'); });
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