/* =============================================================
   BARBERÍA ROYAL — Lógica de Interfaz del Barbero & Autenticación
   ============================================================= */

   (function () {
    'use strict';
  
    /* ---------- CONFIGURACIÓN BASE DE DATOS ---------- */
    // Las citas se leen de Supabase (cliente "db" definido en js/conexion.js)
    // Estados guardados en Supabase ↔ estados usados por la interfaz
    var FROM_DB = { pendiente: 'active', cancelada: 'cancelled', completada: 'completed' };
    var TO_DB = { active: 'pendiente', cancelled: 'cancelada', completed: 'completada' };

    /* ---------- ICONOS ANIMADOS SVG ---------- */
    // Definición de íconos vectoriales del sistema
    var ICONS = {
      scissors: '<svg class="ico i-scissors" viewBox="0 0 24 24" aria-hidden="true"><g class="blade b1"><circle cx="6" cy="6" r="2.8"/><path d="M8.2 7.8L21 18.5"/></g><g class="blade b2"><circle cx="6" cy="18" r="2.8"/><path d="M8.2 16.2L21 5.5"/></g></svg>',
      razor: '<svg class="ico i-razor" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(-35 12 12)"><rect x="2" y="9.8" width="9" height="4.4" rx="1.6"/><path class="rz" d="M11 10.5h8.2a1.8 1.8 0 0 1 1.8 1.8V14H11"/><circle cx="11" cy="12" r=".9"/></g></svg>',
      pole: '<svg class="ico i-pole" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="5" width="8" height="14" rx="1.5"/><g clip-path="url(#pole-clip)"><g class="stripes"><path d="M8 -2l8-3.5M8 2.5l8-3.5M8 7l8-3.5M8 11.5l8-3.5M8 16l8-3.5M8 20.5l8-3.5"/></g></g><path d="M10 5V3M14 5V3M10 19v2M14 19v2"/></svg>',
      crown: '<svg class="ico i-crown" viewBox="0 0 24 24" aria-hidden="true"><path class="crown" d="M4 18L3 8l5 4 4-7 4 7 5-4-1 10z"/><path d="M4 21h16"/><path class="spark sp1" d="M12 0.8v2.4M10.8 2h2.4"/><path class="spark sp2" d="M21 2.5v2M20 3.5h2"/><path class="spark sp3" d="M3 2.5v2M2 3.5h2"/></svg>'
    };
  
    // Inyección de SVG en elementos con atributo data-icon
    function injectIcons() {
      Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (el) {
        var iconKey = el.getAttribute('data-icon');
        if (ICONS[iconKey]) el.innerHTML = ICONS[iconKey];
      });
    }
  
    /* ---------- UTILIDADES GENERALES ---------- */
    var $ = function (id) { return document.getElementById(id); };
  
    // Sistema de Notificaciones Flotantes (Toasts)
    function toast(msg, type) {
      var t = document.createElement('div');
      t.className = 'toast' + (type ? ' toast--' + type : '');
      t.textContent = msg;
      $('toasts').appendChild(t);
      setTimeout(function () {
        t.classList.add('is-leaving');
        setTimeout(function () { t.remove(); }, 350);
      }, 3200);
    }
  
    // Convierte la respuesta de Supabase en promesa: resuelve con data o lanza el error
    function unwrap(res) {
      if (res.error) throw res.error;
      return res.data;
    }

    // Fila de Supabase → objeto que usa la tabla
    function toAppt(r) {
      return {
        id: r.id,
        date: r.fecha,
        time: r.hora_inicio.slice(0, 5),
        status: FROM_DB[r.estado] || 'active',
        name: r.clientes ? r.clientes.nombre : '—',
        service: r.servicios ? r.servicios.nombre : '—'
      };
    }

    // Fecha local en formato AAAA-MM-DD
    function localISO(d) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  
    /* ---------- CONTROL DE ESTADO DE LA APLICACIÓN ---------- */
    var currentFilter = 'today';
    var currentUser = null; // Almacena datos del usuario activo en memoria de sesión
  
    /* ---------- AUTENTICACIÓN / INICIO DE SESIÓN ---------- */
    // Manejo del evento de Submit en el formulario de Login
    $('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      
      var userInp = $('loginUser').value.trim();
      var passInp = $('loginPass').value.trim();
  
      // Validaciones básicas de campos vacíos
      $('f-user').classList.toggle('has-error', !userInp);
      $('f-pass').classList.toggle('has-error', !passInp);
  
      if (!userInp || !passInp) {
        toast('Por favor completa todos los campos.', 'error');
        return;
      }
  
      // Inicio de sesión con Supabase Auth
      db.auth.signInWithPassword({ email: userInp, password: passInp })
        .then(unwrap)
        .then(function (data) {
          return loadPerfil(data.user).then(function (perfil) {
            if (!isStaff(perfil)) {
              db.auth.signOut();
              throw new Error('Esta cuenta no tiene acceso al panel de barbero.');
            }
            setUser(data.user, perfil);
          });
        })
        .then(function () {
          toast('¡Bienvenido, ' + currentUser.name + '!', 'ok');
          showDashboard();
        })
        .catch(function (err) {
          toast(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : err.message, 'error');
        });
    });

    // Rol del usuario guardado en la tabla "perfiles": admin o barbero
    function loadPerfil(user) {
      return db.from('perfiles').select('nombre, rol').eq('id', user.id).maybeSingle().then(unwrap);
    }

    function isStaff(perfil) {
      return !!perfil && (perfil.rol === 'barbero' || perfil.rol === 'admin');
    }

    function setUser(user, perfil) {
      currentUser = { id: user.id, name: perfil.nombre || user.email };
    }

    // Si ya había una sesión abierta, entra directo
    db.auth.getSession().then(function (res) {
      var s = res.data && res.data.session;
      if (!s) return;
      loadPerfil(s.user).then(function (perfil) {
        if (isStaff(perfil)) { setUser(s.user, perfil); showDashboard(); }
      }).catch(function () {});
    });
  
    // Muestra la vista del Dashboard tras autenticar
    function showDashboard() {
      $('loginSection').style.display = 'none';
      $('barberDashboard').style.display = 'block';
      $('logoutBtn').style.display = 'inline-flex';
      $('barberGreeting').style.display = 'inline-block';
      $('barberNameText').textContent = currentUser ? currentUser.name : 'Barbero';
  
      fetchBarberSchedule();
    }
  
    // Cierre de Sesión
    $('logoutBtn').addEventListener('click', function () {
      currentUser = null;
      db.auth.signOut();
      $('loginForm').reset();
      $('barberDashboard').style.display = 'none';
      $('loginSection').style.display = 'block';
      $('logoutBtn').style.display = 'none';
      $('barberGreeting').style.display = 'none';
      toast('Sesión cerrada correctamente.');
    });
  
    /* ---------- GESTIÓN DE CITAS DEL BARBERO ---------- */
    // Obtiene las citas desde la base de datos para el barbero en sesión
    function fetchBarberSchedule() {
      db.from('citas').select('id, fecha, hora_inicio, estado, clientes(nombre), servicios(nombre)')
        .order('fecha').order('hora_inicio')
        .then(unwrap)
        .then(function (rows) {
          renderSchedule(rows.map(toAppt));
        })
        .catch(function (err) {
          toast('No se pudieron cargar las citas.', 'error');
        });
    }
  
    // Renderiza las filas de la tabla según los datos recibidos
    function renderSchedule(citas) {
      var tbody = $('barberTbody');
      tbody.innerHTML = '';
  
      // Filtrado de datos por fecha / criterio
      var todayStr = localISO(new Date());
      var filtered = citas.filter(function (c) {
        if (currentFilter === 'today') return c.date === todayStr;
        if (currentFilter === 'upcoming') return c.date > todayStr;
        return true; // 'all'
      });
  
      // Actualización de Métricas
      var todayCount = citas.filter(function (c) { return c.date === todayStr; }).length;
      var pendingCount = citas.filter(function (c) { return c.date === todayStr && c.status === 'active'; }).length;
      var completedCount = citas.filter(function (c) { return c.date === todayStr && c.status === 'completed'; }).length;
  
      $('stat-today').textContent = todayCount;
      $('stat-pending').textContent = pendingCount;
      $('stat-completed').textContent = completedCount;
  
      $('barberEmpty').hidden = filtered.length > 0;
  
      // Construcción de filas dinámicas
      filtered.forEach(function (c) {
        var tr = document.createElement('tr');
  
        var tdTime = document.createElement('td');
        tdTime.dataset.label = 'Hora';
        tdTime.textContent = c.time;
        tr.appendChild(tdTime);
  
        var tdClient = document.createElement('td');
        tdClient.dataset.label = 'Cliente';
        tdClient.textContent = c.name;
        tr.appendChild(tdClient);
  
        var tdService = document.createElement('td');
        tdService.dataset.label = 'Servicio';
        tdService.textContent = c.service;
        tr.appendChild(tdService);
  
        var tdDate = document.createElement('td');
        tdDate.dataset.label = 'Fecha';
        tdDate.textContent = c.date;
        tr.appendChild(tdDate);
  
        var tdStatus = document.createElement('td');
        tdStatus.dataset.label = 'Estado';
        var badge = document.createElement('span');
        badge.className = 'badge ' + (c.status === 'completed' ? 'badge--active' : (c.status === 'cancelled' ? 'badge--cancel' : ''));
        badge.textContent = c.status === 'completed' ? 'Completada' : (c.status === 'cancelled' ? 'Cancelada' : 'Pendiente');
        tdStatus.appendChild(badge);
        tr.appendChild(tdStatus);
  
        var tdAction = document.createElement('td');
        tdAction.className = 'cell-actions';
        
        if (c.status === 'active') {
          var btnComplete = document.createElement('button');
          btnComplete.type = 'button';
          btnComplete.className = 'btn btn--blue btn--sm';
          btnComplete.textContent = 'Completar';
          btnComplete.addEventListener('click', function () {
            updateAppointmentStatus(c.id, 'completed');
          });
          tdAction.appendChild(btnComplete);
        }
        tr.appendChild(tdAction);
  
        tbody.appendChild(tr);
      });
    }
  
    // Actualiza el estado de una cita en la Base de Datos
    function updateAppointmentStatus(id, newStatus) {
      db.from('citas').update({ estado: TO_DB[newStatus] }).eq('id', id)
        .then(unwrap)
        .then(function () {
          toast('Estado actualizado a ' + TO_DB[newStatus], 'ok');
          fetchBarberSchedule();
        })
        .catch(function (err) {
          toast(err.message || 'Error al actualizar cita', 'error');
        });
    }
  
    /* ---------- FILTROS DE TABLA ---------- */
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (el) { el.classList.remove('is-active'); });
        chip.classList.add('is-active');
        currentFilter = chip.dataset.filter;
        fetchBarberSchedule();
      });
    });
  
    /* ---------- NAVEGACIÓN MÓVIL ---------- */
    var toggle = $('navToggle'), links = $('navLinks');
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
  
    /* ---------- INICIALIZACIÓN ---------- */
    injectIcons();
  
  })();