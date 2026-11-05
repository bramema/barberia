/* =============================================================
   BARBERÍA ROYAL — Lógica de la Vista Cliente y Agendamiento
   ============================================================= */

   (function () {
    'use strict';
  
    /* ---------- Iconos animados (SVG en línea) ---------- */
    // Los dibujos están en js/iconos.js (compartidos con el panel admin)
    var ICONS = ICONOS;
  
    function injectIcons() {
      Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
        if (ICONS[el.getAttribute('data-icon')]) el.innerHTML = ICONS[el.getAttribute('data-icon')];
      });
    }
    injectIcons();
  
    /* ---------- Tren de iconos ---------- */
    function buildTrain(box, names) {
      var track = box && box.querySelector('.hero__train-track'); if (!track) return;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches, lastW = 0;
      var one = names.map(function (n) { return '<span class="car">' + ICONS[n] + '<i></i><i></i></span>'; }).join('');
      function make() {
        lastW = box.clientWidth;
        track.style.animation = 'none';
        track.innerHTML = '<div class="train__grp">' + one + '</div>';
        var w = track.firstChild.getBoundingClientRect().width || 1;
        var need = Math.max(1, Math.ceil((box.clientWidth + 20) / w)), html = '';
        for (var i = 0; i < need; i++) html += one;
        track.innerHTML = '<div class="train__grp">' + html + '</div><div class="train__grp">' + html + '</div>';
        var gw = track.firstChild.getBoundingClientRect().width;
        track.style.setProperty('--train-w', gw + 'px');
        track.style.animation = reduce ? 'none' : 'train ' + (gw / 55).toFixed(1) + 's linear infinite';
      }
      make();
      var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (box.clientWidth !== lastW) make(); }, 150); });
    }
  
    /* ---------- Marco LED ---------- */
    function LedFrame(frame, stage, segs) {
      if (!frame || !stage) return;
      var base = [];
      segs.forEach(function (s) { s[0].split('').forEach(function (ch) { base.push({ ch: ch, c: s[1] }); }); });
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var chars = [], per = 0, sp = 0, W = 0, H = 0, c = 0, R = 0, A = 0, B = 0, Q = 0;
      var offset = 0, last = 0, running = false, visible = true, SPEED = 70, lw = 0, lh = 0;
  
      function build() {
        W = frame.clientWidth; H = frame.clientHeight; if (!W || !H) return;
        lw = W; lh = H;
        var band = parseFloat(getComputedStyle(frame).getPropertyValue('--band')) || 58;
        c = band * 0.54; R = band * 0.5;
        A = Math.max(0, W - 2 * c - 2 * R); B = Math.max(0, H - 2 * c - 2 * R); Q = Math.PI * R / 2;
        per = 2 * A + 2 * B + 4 * Q;
        var k = Math.max(1, Math.round(per / (base.length * band * 0.42)));
        var total = k * base.length; sp = per / total;
        var fs = Math.min(sp * 1.4, band * 0.5);
        stage.innerHTML = ''; chars = [];
        var frag = document.createDocumentFragment();
        for (var i = 0; i < total; i++) {
          var it = base[i % base.length]; if (it.ch === ' ') continue;
          var el = document.createElement('span');
          el.className = 'led__char led__char--' + it.c; el.textContent = it.ch; el.style.fontSize = fs.toFixed(1) + 'px';
          el.style.animationDelay = (-Math.random() * 9).toFixed(2) + 's';
          frag.appendChild(el); chars.push({ el: el, i: i });
        }
        stage.appendChild(frag); draw();
      }
      function place(s) {
        var x, y, g, t, a;
        if (s < A) { x = c + R + s; y = c; g = 0; }
        else if ((s -= A) < Q) { t = s / R; a = -Math.PI / 2 + t; x = W - c - R + R * Math.cos(a); y = c + R + R * Math.sin(a); g = a + Math.PI / 2; }
        else if ((s -= Q) < B) { x = W - c; y = c + R + s; g = Math.PI / 2; }
        else if ((s -= B) < Q) { t = s / R; a = t; x = W - c - R + R * Math.cos(a); y = H - c - R + R * Math.sin(a); g = a + Math.PI / 2; }
        else if ((s -= Q) < A) { x = W - c - R - s; y = H - c; g = Math.PI; }
        else if ((s -= A) < Q) { t = s / R; a = Math.PI / 2 + t; x = c + R + R * Math.cos(a); y = H - c - R + R * Math.sin(a); g = a + Math.PI / 2; }
        else if ((s -= Q) < B) { x = c; y = H - c - R - s; g = 1.5 * Math.PI; }
        else { s -= B; t = s / R; a = Math.PI + t; x = c + R + R * Math.cos(a); y = c + R + R * Math.sin(a); g = a + Math.PI / 2; }
        return [x, y, g];
      }
      function draw() {
        for (var n = 0; n < chars.length; n++) {
          var p = place((chars[n].i * sp + offset) % per);
          chars[n].el.style.transform = 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px) translate(-50%,-50%) rotate(' + p[2].toFixed(3) + 'rad)';
        }
      }
      function frameStep(ts) {
        if (!running) return;
        if (!last) last = ts;
        offset = (offset + SPEED * Math.min((ts - last) / 1000, 0.1)) % per; last = ts;
        draw(); requestAnimationFrame(frameStep);
      }
      function start() { if (!running && visible && !reduce) { running = true; last = 0; requestAnimationFrame(frameStep); } }
      function stop() { running = false; }
  
      build(); start();
      if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? start() : stop(); }).observe(frame);
      var rt; function changed() { clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(frame.clientWidth - lw) > 1 || Math.abs(frame.clientHeight - lh) > 1) build(); }, 120); }
      if ('ResizeObserver' in window) new ResizeObserver(changed).observe(frame); else window.addEventListener('resize', changed);
    }
  
    /* ---------- Datos y Estado ---------- */
    var occupied = [];
    var offlineWarned = false;

    // Los servicios vienen de la tabla "servicios" de Supabase
    var SERVICES = [];
    // Los barberos vienen de Supabase (función barberos_publicos)
    var BARBERS = [];
    // Horario de cada barbero activo (función horarios_publicos): barbero_id, dia_semana (0 = domingo … 6 = sábado), hora_inicio, hora_fin
    var HORARIOS = [];
    // Vacaciones aprobadas (función vacaciones_publicas): barbero_id, fecha_inicio, fecha_fin
    var VACACIONES = [];
  
    // Horario de atención: 7:00 a 19:00 → horas de inicio cada 30 min de 7:00 a 18:30
    var CIERRE = '19:00';
    var SLOTS = [];
    for (var h = 7; h < 19; h++) { SLOTS.push(pad(h) + ':00'); SLOTS.push(pad(h) + ':30'); }
  
    var MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var DOW = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
  
    function pad(n) { return String(n).padStart(2, '0'); }
    function money(n) { return '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 }); }
    function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function fromISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function longDate(iso) {
      return fromISO(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    function loadAppointments() { return occupied; }
    // Convierte la respuesta de Supabase en promesa: resuelve con data o lanza el error
    function unwrap(res) { if (res.error) throw res.error; return res.data; }

    function loadServices() {
      return db.from('servicios').select('id, nombre, precio, duracion_minutos, icono').eq('activo', true).order('id')
        .then(unwrap)
        .then(function (rows) {
          SERVICES = rows.map(function (r) {
            return { id: r.id, name: r.nombre, icon: r.icono, price: Number(r.precio), mins: r.duracion_minutos };
          });
          if (!SERVICES.length) toast('No hay servicios disponibles.', 'error');
          renderServices();
        })
        .catch(function () { toast('No se pudieron cargar los servicios.', 'error'); });
    }
    function loadBarbers() {
      return db.rpc('barberos_publicos')
        .then(unwrap)
        .then(function (rows) {
          BARBERS = rows.map(function (r) { return { id: r.id, name: r.nombre }; });
          if (!BARBERS.length) toast('No hay barberos disponibles.', 'error');
          revalidate();
        })
        .catch(function () { toast('No se pudieron cargar los barberos.', 'error'); });
    }
    function loadHorarios() {
      return db.rpc('horarios_publicos')
        .then(unwrap)
        .then(function (rows) {
          HORARIOS = rows.map(function (r) {
            return { barberId: r.barbero_id, dow: r.dia_semana, from: r.hora_inicio.slice(0, 5), to: r.hora_fin.slice(0, 5) };
          });
          revalidate();
        })
        .catch(function () { toast('No se pudieron cargar los horarios de los barberos.', 'error'); });
    }
    function loadVacaciones() {
      return db.rpc('vacaciones_publicas')
        .then(unwrap)
        .then(function (rows) {
          VACACIONES = rows.map(function (r) { return { barberId: r.barbero_id, from: r.fecha_inicio, to: r.fecha_fin }; });
          revalidate();
        })
        .catch(function () { toast('No se pudieron cargar las vacaciones de los barberos.', 'error'); });
    }
    function refreshOccupied() {
      return db.rpc('horas_ocupadas').then(unwrap).then(function (rows) {
        offlineWarned = false;
        occupied = rows.map(function (r) {
          var time = r.hora_inicio.slice(0, 5);
          return { status: 'active', date: r.fecha, time: time, end: r.hora_fin ? r.hora_fin.slice(0, 5) : addMinutes(time, 30), barberId: r.barbero_id == null ? null : r.barbero_id };
        });
        revalidate();
      }).catch(function () {
        if (!offlineWarned) { offlineWarned = true; toast('Sin conexión con la base de datos.', 'error'); }
      });
    }
    function saveAppointments(appt) {
      $('submitBtn').disabled = true;
      return db.rpc('agendar_cita', {
        p_nombre: appt.name, p_email: appt.email, p_servicios: appt.serviceIds, p_fecha: appt.date, p_hora: appt.time,
        p_barbero_id: appt.barberId
      }).then(unwrap).then(
        function (id) { $('submitBtn').disabled = false; return { id: id }; },
        function (e) { $('submitBtn').disabled = false; throw e; });
    }
    /* El barbero está ocupado si alguna de sus citas se cruza con el tiempo que dura esta
       (desde la hora elegida hasta que terminan todos los servicios). Las citas viejas sin barbero bloquean a todos */
    function isTaken(date, time, barberId) {
      var end = endTime(time);
      return loadAppointments().some(function (a) {
        return a.status === 'active' && a.date === date && a.time < end && time < a.end &&
          (a.barberId == null || a.barberId === barberId);
      });
    }

    function addMinutes(t, mins) { var p = t.split(':'), m = +p[0] * 60 + +p[1] + mins; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

    function onVacation(barberId, date) {
      return VACACIONES.some(function (v) { return v.barberId === barberId && v.from <= date && date <= v.to; });
    }
    // Hora en que terminaría la cita: suma de los servicios elegidos (30 min si aún no hay ninguno)
    function endTime(time) { return addMinutes(time, totalMins() || 30); }

    // El barbero trabaja ese día, no está de vacaciones y todos los servicios seguidos caben dentro de su horario
    function worksAt(barberId, date, time) {
      var end = endTime(time), dow = fromISO(date).getDay();
      return end <= CIERRE && !onVacation(barberId, date) &&
        HORARIOS.some(function (h) { return h.barberId === barberId && h.dow === dow && h.from <= time && end <= h.to; });
    }
    function availableBarbers(date, time) {
      return BARBERS.filter(function (br) { return worksAt(br.id, date, time) && !isTaken(date, time, br.id); });
    }
    function isPast(date, time) {
      var now = new Date(), p = time.split(':');
      return date === toISO(now) && (+p[0] * 60 + +p[1]) <= (now.getHours() * 60 + now.getMinutes());
    }
    function someoneWorks(date) {
      var dow = date.getDay(), iso = toISO(date);
      return HORARIOS.some(function (h) {
        return h.dow === dow && !onVacation(h.barberId, iso) && BARBERS.some(function (br) { return br.id === h.barberId; });
      });
    }

    // Tras cambiar servicio, citas u horarios: descarta la hora o el barbero elegidos si ya no están libres
    function revalidate() {
      if (state.time && (isPast(state.date, state.time) || !availableBarbers(state.date, state.time).length)) state.time = null;
      if (state.barber && !(state.time && availableBarbers(state.date, state.time).some(function (br) { return br.id === state.barber; }))) state.barber = null;
      renderCalendar(); renderSlots(); renderBarbers(); updateSummary();
    }
  
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var MAX_SERVICES = 6;
    var state = { services: [], barber: null, date: null, time: null, viewY: today.getFullYear(), viewM: today.getMonth() };
  
    var $ = function (id) { return document.getElementById(id); };
  
    var toggle = $('navToggle'), links = $('navLinks');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open);
      });
    }
    if (links) {
      links.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
      });
    }
    if ($('heroCta')) $('heroCta').addEventListener('click', function () { $('agendar').scrollIntoView({ behavior: 'smooth' }); });
    if ($('year')) $('year').textContent = new Date().getFullYear();
  
    function toast(msg, type) {
      var t = document.createElement('div');
      t.className = 'toast' + (type ? ' toast--' + type : '');
      t.textContent = msg;
      $('toasts').appendChild(t);
      setTimeout(function () { t.classList.add('is-leaving'); setTimeout(function () { t.remove(); }, 350); }, 3600);
    }
  
    function renderServices() {
      var box = $('services'); if (!box) return; box.innerHTML = '';
      SERVICES.forEach(function (s) {
        var b = document.createElement('button');
        var on = state.services.indexOf(s.id) !== -1;
        b.type = 'button'; b.className = 'service'; b.setAttribute('role', 'checkbox');
        b.setAttribute('aria-checked', on);
        if (on) b.classList.add('is-selected');
        b.innerHTML = '<div class="service__icon" aria-hidden="true">' + iconoServicio(s.icon) + '</div>' +
          '<div class="service__name"></div><div class="service__meta">' + s.mins + ' min</div>' +
          '<span class="service__price">' + money(s.price) + '</span>';
        b.querySelector('.service__name').textContent = s.name;
        // Cada clic marca o desmarca el servicio; se guardan en el orden en que se eligen
        b.addEventListener('click', function () {
          var i = state.services.indexOf(s.id);
          if (i !== -1) state.services.splice(i, 1);
          else if (state.services.length >= MAX_SERVICES) { toast('Puedes elegir hasta ' + MAX_SERVICES + ' servicios por cita.', 'error'); return; }
          else state.services.push(s.id);
          $('err-service').style.display = 'none';
          renderServices(); revalidate();
        });
        box.appendChild(b);
      });
    }
  
    function renderBarbers() {
      var box = $('barbers'), hint = $('barbersHint'); if (!box) return; box.innerHTML = '';
      if (!state.date || !state.time) { hint.style.display = 'block'; hint.textContent = 'Primero elige el día y la hora.'; return; }
      var list = availableBarbers(state.date, state.time);
      hint.style.display = list.length ? 'none' : 'block';
      hint.textContent = 'No hay barberos libres a esa hora. Elige otra.';
      list.forEach(function (br) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'service'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', state.barber === br.id);
        if (state.barber === br.id) b.classList.add('is-selected');
        b.innerHTML = '<div class="service__icon" aria-hidden="true">' + ICONS.scissors + '</div>' +
          '<div class="service__name"></div><div class="service__meta">Barbero</div>';
        b.querySelector('.service__name').textContent = br.name;
        b.addEventListener('click', function () {
          state.barber = br.id; $('err-barber').style.display = 'none';
          renderBarbers(); updateSummary();
        });
        box.appendChild(b);
      });
    }

    function renderCalendar() {
      var grid = $('calGrid'); if (!grid) return; grid.innerHTML = '';
      $('calTitle').textContent = MONTHS[state.viewM] + ' ' + state.viewY;
      DOW.forEach(function (d) { var el = document.createElement('div'); el.className = 'cal__dow'; el.textContent = d; grid.appendChild(el); });
  
      var first = new Date(state.viewY, state.viewM, 1);
      var offset = (first.getDay() + 6) % 7;
      var days = new Date(state.viewY, state.viewM + 1, 0).getDate();
      for (var i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));
  
      var max = new Date(today); max.setMonth(max.getMonth() + 3);
      for (var d = 1; d <= days; d++) {
        var date = new Date(state.viewY, state.viewM, d);
        var iso = toISO(date);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cal__day'; b.textContent = d;
        b.setAttribute('aria-label', longDate(iso));
        // Se deshabilitan los domingos y los días en que ningún barbero trabaja
        if (date < today || date > max || date.getDay() === 0 || !someoneWorks(date)) b.disabled = true;
        if (+date === +today) b.classList.add('is-today');
        if (state.date === iso) b.classList.add('is-selected');
        b.addEventListener('click', (function (isoVal) { return function () {
          state.date = isoVal; state.time = null; state.barber = null; revalidate();
        }; })(iso));
        grid.appendChild(b);
      }
      var prevMonth = new Date(state.viewY, state.viewM - 1, 1);
      var thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      if ($('calPrev')) $('calPrev').disabled = prevMonth < thisMonth;
      if ($('calNext')) $('calNext').disabled = new Date(state.viewY, state.viewM + 1, 1) > max;
    }
    if ($('calPrev')) $('calPrev').addEventListener('click', function () { state.viewM--; if (state.viewM < 0) { state.viewM = 11; state.viewY--; } renderCalendar(); });
    if ($('calNext')) $('calNext').addEventListener('click', function () { state.viewM++; if (state.viewM > 11) { state.viewM = 0; state.viewY++; } renderCalendar(); });
  
    function renderSlots() {
      var box = $('slots'), hint = $('slotsHint'); if (!box) return; box.innerHTML = '';
      if (!state.date) { hint.style.display = 'block'; hint.textContent = 'Primero selecciona un día en el calendario.'; return; }
      hint.style.display = 'none';
      var available = 0;
      SLOTS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'slot'; b.textContent = t; b.setAttribute('role', 'radio');
        var past = isPast(state.date, t);
        var free = !past && availableBarbers(state.date, t).length > 0;
        if (!free) { b.disabled = true; b.title = past ? 'Hora pasada' : 'Sin barberos disponibles'; } else { available++; }
        if (state.time === t) { b.classList.add('is-selected'); b.setAttribute('aria-checked', 'true'); }
        b.addEventListener('click', function () { state.time = t; $('err-barber').style.display = 'none'; revalidate(); });
        box.appendChild(b);
      });
      if (!available) { hint.style.display = 'block'; hint.textContent = 'No quedan horas libres este día.'; }
    }
  
    // Servicios elegidos, en el orden en que se marcaron (se ignoran los que ya no están disponibles)
    function currentServices() {
      return state.services.map(function (id) { return SERVICES.filter(function (s) { return s.id === id; })[0]; }).filter(Boolean);
    }
    function totalMins() { return currentServices().reduce(function (t, s) { return t + s.mins; }, 0); }
    function totalPrice() { return currentServices().reduce(function (t, s) { return t + s.price; }, 0); }
    function servicesText() { return currentServices().map(function (s) { return s.name; }).join(' + '); }
    function durText(m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + ' h' + (r ? ' ' + r + ' min' : '') : m + ' min'; }
    function currentBarber() { return BARBERS.filter(function (br) { return br.id === state.barber; })[0]; }
    function updateSummary() {
      var mins = totalMins();
      var br = currentBarber();
      if ($('sum-service')) $('sum-service').textContent = servicesText() || '—';
      if ($('sum-duration')) $('sum-duration').textContent = mins ? durText(mins) + (state.time ? ' (hasta las ' + endTime(state.time) + ')' : '') : '—';
      if ($('sum-barber')) $('sum-barber').textContent = br ? br.name : '—';
      if ($('sum-date')) $('sum-date').textContent = state.date ? longDate(state.date) : '—';
      if ($('sum-time')) $('sum-time').textContent = state.time || '—';
      if ($('sum-total')) $('sum-total').textContent = money(totalPrice());
      if ($('datetime')) $('datetime').value = state.date && state.time ? longDate(state.date) + ' · ' + state.time : '';
    }
  
    function setError(fieldId, bad) { $(fieldId).classList.toggle('has-error', bad); return bad; }
  
    var bookingForm = $('bookingForm');
    if (bookingForm) {
      bookingForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('name').value.trim().replace(/\s+/g, ' ');
        var email = $('email').value.trim();
        var badName = setError('f-name', name.split(' ').length < 2 || name.length < 5);
        var badMail = setError('f-email', !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
  
        if (!currentServices().length) { $('err-service').style.display = 'block'; toast('Elige al menos un servicio.', 'error'); $('services').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (!state.date)    { toast('Selecciona un día en el calendario.', 'error'); return; }
        if (!state.time)    { toast('Selecciona una hora disponible.', 'error'); return; }
        if (!state.barber)  { $('err-barber').style.display = 'block'; toast('Elige un barbero.', 'error'); $('barbers').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (badName || badMail) { toast('Revisa tus datos de contacto.', 'error'); return; }
        if (isTaken(state.date, state.time, state.barber)) { toast('Esa hora acaba de ser reservada.', 'error'); state.barber = null; revalidate(); return; }
  
        var br = currentBarber();
        var appt = {
          id: 'RB-' + Date.now().toString(36).toUpperCase().slice(-6),
          name: name, email: email,
          serviceIds: currentServices().map(function (s) { return s.id; }), service: servicesText(), price: totalPrice(),
          mins: totalMins(), end: endTime(state.time),
          barberId: br.id, barber: br.name,
          date: state.date, time: state.time,
          status: 'active', createdAt: new Date().toISOString()
        };
        saveAppointments(appt).then(function (created) {
          appt.id = 'RB-' + created.id;
          $('c-id').textContent = appt.id; $('c-name').textContent = appt.name;
          $('c-service').textContent = appt.service + ' (' + money(appt.price) + ')';
          if ($('c-duration')) $('c-duration').textContent = durText(appt.mins) + ' (hasta las ' + appt.end + ')';
          if ($('c-barber')) $('c-barber').textContent = appt.barber;
          $('c-date').textContent = longDate(appt.date); $('c-time').textContent = appt.time;
          $('bookingForm').style.display = 'none';
          var card = $('confirmCard'); card.classList.add('is-visible'); card.focus();
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          toast('Cita guardada correctamente.', 'ok');
          refreshOccupied();
        }).catch(function (err) {
          toast(err.message || 'No se pudo guardar la cita.', 'error');
          if (err.code === '23505') { state.time = null; updateSummary(); }
          refreshOccupied();
        });
      });
    }
  
    if ($('newBooking')) {
      $('newBooking').addEventListener('click', function () {
        state.services = []; state.barber = null; state.date = null; state.time = null;
        $('name').value = ''; $('email').value = '';
        $('confirmCard').classList.remove('is-visible');
        $('bookingForm').style.display = '';
        renderServices(); revalidate();
        $('agendar').scrollIntoView({ behavior: 'smooth' });
      });
    }
  
    ['name', 'email'].forEach(function (id) {
      if ($(id)) $(id).addEventListener('input', function () { $('f-' + id).classList.remove('has-error'); });
    });
  
    if (document.getElementById('heroTrain')) {
      buildTrain(document.getElementById('heroTrain'), ['scissors', 'razor', 'pole', 'bottle', 'comb', 'mustache', 'crown', 'cup']);
    }
    if (document.getElementById('bookingFrame')) {
      LedFrame(document.getElementById('bookingFrame'), document.getElementById('bookingStage'),
        [['AGENDA', 'red'], [' ', 'dim'], ['TU', 'white'], [' ', 'dim'], ['CITA', 'blue'], [' • ', 'dim']]);
    }
  
    setInterval(refreshOccupied, 10000);
  
    renderServices(); revalidate();
    loadServices();
    loadBarbers();
    loadHorarios();
    loadVacaciones();
    refreshOccupied();
  })();