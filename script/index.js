/* =============================================================
   BARBERÍA ROYAL — Lógica de la Vista Cliente y Agendamiento
   ============================================================= */

   (function () {
    'use strict';
  
    /* ---------- Iconos animados (SVG en línea) ---------- */
    var ICONS = {
      scissors: '<svg class="ico i-scissors" viewBox="0 0 24 24" aria-hidden="true"><g class="blade b1"><circle cx="6" cy="6" r="2.8"/><path d="M8.2 7.8L21 18.5"/></g><g class="blade b2"><circle cx="6" cy="18" r="2.8"/><path d="M8.2 16.2L21 5.5"/></g></svg>',
      razor: '<svg class="ico i-razor" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-35 12 12)"><rect x="2" y="9.8" width="9" height="4.4" rx="1.6"/><path class="rz" d="M11 10.5h8.2a1.8 1.8 0 0 1 1.8 1.8V14H11"/><circle cx="11" cy="12" r=".9"/></g></svg>',
      mustache: '<svg class="ico i-mustache" viewBox="0 0 24 24" aria-hidden="true"><path class="must" d="M12 10.4C10.6 8.8 8.2 8.4 6.2 9.2C4.2 10 2.8 11.6 2.2 14C4 12.9 5.6 13 7 14C8.8 15.3 10.6 15.2 12 13.2C13.4 15.2 15.2 15.3 17 14C18.4 13 20 12.9 21.8 14C21.2 11.6 19.8 10 17.8 9.2C15.8 8.4 13.4 8.8 12 10.4z"/></svg>',
      pole: '<svg class="ico i-pole" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5" width="8" height="14" rx="1.5"/><g clip-path="url(#pole-clip)"><g class="stripes"><path d="M8 -2l8-3.5M8 2.5l8-3.5M8 7l8-3.5M8 11.5l8-3.5M8 16l8-3.5M8 20.5l8-3.5"/></g></g><path d="M10 5V3M14 5V3M10 19v2M14 19v2"/></svg>',
      bottle: '<svg class="ico i-bottle" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4v3h-4z"/><path d="M8 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M8 13h8"/><circle class="bub bx1" cx="10.8" cy="18" r=".7"/><circle class="bub bx2" cx="13.4" cy="17" r=".5"/><circle class="bub bx3" cx="12" cy="19" r=".6"/></svg>',
      crown: '<svg class="ico i-crown" viewBox="0 0 24 24" aria-hidden="true"><path class="crown" d="M4 18L3 8l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 21h16"/><path class="spark sp1" d="M12 0.8v2.4M10.8 2h2.4"/><path class="spark sp2" d="M21 2.5v2M20 3.5h2"/><path class="spark sp3" d="M3 2.5v2M2 3.5h2"/></svg>',
      comb: '<svg class="ico i-comb" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="5" rx="1.2"/><path class="tooth" style="animation-delay:0s" d="M5.5 12v5"/><path class="tooth" style="animation-delay:.15s" d="M8.5 12v5"/><path class="tooth" style="animation-delay:.3s" d="M11.5 12v5"/><path class="tooth" style="animation-delay:.45s" d="M14.5 12v5"/><path class="tooth" style="animation-delay:.6s" d="M17.5 12v5"/></svg>',
      cup: '<svg class="ico i-cup" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h11v4.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15.5z"/><path d="M16 12h1.4a2.3 2.3 0 0 1 0 4.6H15.6"/><path d="M4 22h13"/><path class="steam" d="M8 8.5c-1-1.2 1-2.2 0-3.6"/><path class="steam s2" d="M11.5 8.5c-1-1.2 1-2.2 0-3.6"/><path class="steam s3" d="M15 8.5c-1-1.2 1-2.2 0-3.6"/></svg>',
      check: '<svg class="ico i-check" viewBox="0 0 24 24" aria-hidden="true"><path class="draw" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
      chevL: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>',
      chevR: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>'
    };
  
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
    var SERVICE_ICONS = {
      'Corte clásico': 'scissors', 'Corte degradado': 'comb', 'Arreglo de barba': 'mustache',
      'Corte y barba': 'pole', 'Afeitado clásico': 'razor'
    };
  
    var SLOTS = [];
    for (var h = 9; h < 19; h++) { SLOTS.push(pad(h) + ':00'); SLOTS.push(pad(h) + ':30'); }
  
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
      return db.from('servicios').select('id, nombre, precio, duracion_minutos').eq('activo', true).order('id')
        .then(unwrap)
        .then(function (rows) {
          SERVICES = rows.map(function (r) {
            return { id: r.id, name: r.nombre, icon: SERVICE_ICONS[r.nombre] || 'scissors', price: Number(r.precio), mins: r.duracion_minutos };
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
          renderBarbers();
        })
        .catch(function () { toast('No se pudieron cargar los barberos.', 'error'); });
    }
    function refreshOccupied() {
      return db.rpc('horas_ocupadas').then(unwrap).then(function (rows) {
        offlineWarned = false;
        occupied = rows.map(function (r) { return { status: 'active', date: r.fecha, time: r.hora_inicio.slice(0, 5), barberId: r.barbero_id == null ? null : r.barbero_id }; });
        renderSlots();
      }).catch(function () {
        if (!offlineWarned) { offlineWarned = true; toast('Sin conexión con la base de datos.', 'error'); }
      });
    }
    function saveAppointments(appt) {
      $('submitBtn').disabled = true;
      return db.rpc('agendar_cita', {
        p_nombre: appt.name, p_email: appt.email, p_servicio_id: appt.serviceId, p_fecha: appt.date, p_hora: appt.time,
        p_barbero_id: appt.barberId
      }).then(unwrap).then(
        function (id) { $('submitBtn').disabled = false; return { id: id }; },
        function (e) { $('submitBtn').disabled = false; throw e; });
    }
    function isTaken(date, time) {
      // Una hora está ocupada si ese mismo barbero la tiene; las citas viejas sin barbero bloquean la hora para todos
      return loadAppointments().some(function (a) {
        return a.status === 'active' && a.date === date && a.time === time &&
          (a.barberId == null || a.barberId === state.barber);
      });
    }
  
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var state = { service: null, barber: null, date: null, time: null, viewY: today.getFullYear(), viewM: today.getMonth() };
  
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
        b.type = 'button'; b.className = 'service'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', state.service === s.id);
        if (state.service === s.id) b.classList.add('is-selected');
        b.innerHTML = '<div class="service__icon" aria-hidden="true">' + ICONS[s.icon] + '</div>' +
          '<div class="service__name"></div><div class="service__meta">' + s.mins + ' min</div>' +
          '<span class="service__price">' + money(s.price) + '</span>';
        b.querySelector('.service__name').textContent = s.name;
        b.addEventListener('click', function () {
          state.service = s.id; $('err-service').style.display = 'none';
          renderServices(); updateSummary();
        });
        box.appendChild(b);
      });
    }
  
    function renderBarbers() {
      var box = $('barbers'); if (!box) return; box.innerHTML = '';
      BARBERS.forEach(function (br) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'service'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', state.barber === br.id);
        if (state.barber === br.id) b.classList.add('is-selected');
        b.innerHTML = '<div class="service__icon" aria-hidden="true">' + ICONS.scissors + '</div>' +
          '<div class="service__name"></div><div class="service__meta">Barbero</div>';
        b.querySelector('.service__name').textContent = br.name;
        b.addEventListener('click', function () {
          state.barber = br.id; state.time = null; $('err-barber').style.display = 'none';
          renderBarbers(); renderSlots(); updateSummary();
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
        if (date < today || date > max || date.getDay() === 0) b.disabled = true;
        if (+date === +today) b.classList.add('is-today');
        if (state.date === iso) b.classList.add('is-selected');
        b.addEventListener('click', (function (isoVal) { return function () {
          state.date = isoVal; state.time = null; renderCalendar(); renderSlots(); updateSummary();
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
      if (!state.barber) { hint.style.display = 'block'; hint.textContent = 'Primero elige un barbero.'; return; }
      hint.style.display = 'none';
      var now = new Date(), isToday = state.date === toISO(now), available = 0;
      SLOTS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'slot'; b.textContent = t; b.setAttribute('role', 'radio');
        var past = false;
        if (isToday) { var p = t.split(':'); past = (+p[0] * 60 + +p[1]) <= (now.getHours() * 60 + now.getMinutes()); }
        var taken = isTaken(state.date, t);
        if (past || taken) { b.disabled = true; b.title = taken ? 'Hora ocupada' : 'Hora pasada'; } else { available++; }
        if (state.time === t) { b.classList.add('is-selected'); b.setAttribute('aria-checked', 'true'); }
        b.addEventListener('click', function () { state.time = t; renderSlots(); updateSummary(); });
        box.appendChild(b);
      });
      if (!available) { hint.style.display = 'block'; hint.textContent = 'No quedan horas libres este día.'; }
    }
  
    function currentService() { return SERVICES.filter(function (s) { return s.id === state.service; })[0]; }
    function currentBarber() { return BARBERS.filter(function (br) { return br.id === state.barber; })[0]; }
    function updateSummary() {
      var s = currentService();
      var br = currentBarber();
      if ($('sum-service')) $('sum-service').textContent = s ? s.name : '—';
      if ($('sum-barber')) $('sum-barber').textContent = br ? br.name : '—';
      if ($('sum-date')) $('sum-date').textContent = state.date ? longDate(state.date) : '—';
      if ($('sum-time')) $('sum-time').textContent = state.time || '—';
      if ($('sum-total')) $('sum-total').textContent = money(s ? s.price : 0);
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
  
        if (!state.service) { $('err-service').style.display = 'block'; toast('Elige un servicio.', 'error'); $('services').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (!state.barber)  { $('err-barber').style.display = 'block'; toast('Elige un barbero.', 'error'); $('barbers').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (!state.date)    { toast('Selecciona un día en el calendario.', 'error'); return; }
        if (!state.time)    { toast('Selecciona una hora disponible.', 'error'); return; }
        if (badName || badMail) { toast('Revisa tus datos de contacto.', 'error'); return; }
        if (isTaken(state.date, state.time)) { toast('Esa hora acaba de ser reservada.', 'error'); state.time = null; renderSlots(); updateSummary(); return; }
  
        var s = currentService();
        var br = currentBarber();
        var appt = {
          id: 'RB-' + Date.now().toString(36).toUpperCase().slice(-6),
          name: name, email: email,
          serviceId: s.id, service: s.name, price: s.price,
          barberId: br.id, barber: br.name,
          date: state.date, time: state.time,
          status: 'active', createdAt: new Date().toISOString()
        };
        saveAppointments(appt).then(function (created) {
          appt.id = 'RB-' + created.id;
          $('c-id').textContent = appt.id; $('c-name').textContent = appt.name;
          $('c-service').textContent = appt.service + ' (' + money(appt.price) + ')';
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
        state.service = null; state.barber = null; state.date = null; state.time = null;
        $('name').value = ''; $('email').value = '';
        $('confirmCard').classList.remove('is-visible');
        $('bookingForm').style.display = '';
        renderServices(); renderBarbers(); renderCalendar(); renderSlots(); updateSummary();
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
  
    renderServices(); renderCalendar(); renderSlots(); updateSummary();
    loadServices();
    loadBarbers();
    refreshOccupied();
  })();