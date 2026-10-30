/* =============================================================
   Barbería Royal — Servidor con autenticación y base de datos JSON
   ============================================================= */
   'use strict';
   const http = require('http');
   const fs = require('fs');
   const path = require('path');
   const crypto = require('crypto');
   
   const PORT = Number(process.env.PORT) || 3000;
   const HOST = process.env.HOST || '127.0.0.1';
   const DATA_DIR = path.join(__dirname, 'data');
   const DB_FILE = path.join(DATA_DIR, 'citas.json');
   
   const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
   const Horario = require('./script/horario.js');

   const STATIC = {
     '/': ['index.html', 'text/html; charset=utf-8'],
     '/index.html': ['index.html', 'text/html; charset=utf-8'],
     '/admin.html': ['admin.html', 'text/html; charset=utf-8'],
     '/barbero.html': ['barbero.html', 'text/html; charset=utf-8'],
     '/css/styles.css': ['css/styles.css', 'text/css; charset=utf-8'],
     '/script/index.js': ['script/index.js', 'text/javascript; charset=utf-8'],
     '/script/admin.js': ['script/admin.js', 'text/javascript; charset=utf-8'],
     '/script/barbero.js': ['script/barbero.js', 'text/javascript; charset=utf-8'],
     '/script/horario.js': ['script/horario.js', 'text/javascript; charset=utf-8']
   };
   
   function readDB() {
     try {
       const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
       if (!Array.isArray(db.citas)) db.citas = [];
       return db;
     } catch (e) {
       return { esquema: 1, actualizado: null, citas: [] };
     }
   }
   
   function writeDB(db) {
     db.esquema = 1;
     db.actualizado = new Date().toISOString();
     db.citas.sort(function (a, b) {
       return (a.date + a.time + a.createdAt).localeCompare(b.date + b.time + b.createdAt);
     });
     fs.mkdirSync(DATA_DIR, { recursive: true });
     const tmp = DB_FILE + '.tmp';
     fs.writeFileSync(tmp, JSON.stringify(db, null, 2) + '\n', 'utf8');
     fs.renameSync(tmp, DB_FILE);
   }
   
   /* ---------- Configuración de horarios (data/config.json) ---------- */
   function readConfig() {
     const def = JSON.parse(JSON.stringify(Horario.DEFAULT));
     try {
       const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
       return {
         horario: Object.assign(def.horario, cfg.horario || {}),
         barberos: Array.isArray(cfg.barberos) && cfg.barberos.length ? cfg.barberos : def.barberos
       };
     } catch (e) {
       return def;
     }
   }

   function writeConfig(cfg) {
     fs.mkdirSync(DATA_DIR, { recursive: true });
     const tmp = CONFIG_FILE + '.tmp';
     fs.writeFileSync(tmp, JSON.stringify({ actualizado: new Date().toISOString(), horario: cfg.horario, barberos: cfg.barberos }, null, 2) + '\n', 'utf8');
     fs.renameSync(tmp, CONFIG_FILE);
   }

   /* Citas activas (de hoy en adelante) que quedan fuera del horario actual. */
   function citasFueraDeHorario(db, cfg) {
     const hoy = new Date(), hoyISO = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
     return db.citas.filter(function (c) {
       const d = parseDate(c.date);
       return c.status === 'active' && d && c.date >= hoyISO && Horario.capacidad(cfg, d.getDay(), c.time) === 0;
     }).length;
   }
   
   function parseDate(s) {
     if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
     const p = s.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2]);
     return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2] ? d : null;
   }
   
   function checkSlot(cfg, date, time) {
     const d = parseDate(date);
     if (!d) return 'La fecha no es válida.';
     if (!Horario.esHora(time)) return 'La hora no es válida.';
     const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
     if (d < today) return 'No se puede agendar en una fecha pasada.';
     if (cfg.horario.dias.indexOf(d.getDay()) === -1) return 'La barbería no abre ese día.';
     const t = Horario.aMin(time);
     if (t < Horario.aMin(cfg.horario.apertura) || t + Horario.PASO > Horario.aMin(cfg.horario.cierre)) {
       return 'Esa hora está fuera del horario de la barbería (' + Horario.textoRango(cfg.horario.apertura, cfg.horario.cierre) + ').';
     }
     if (Horario.capacidad(cfg, d.getDay(), time) === 0) return 'No hay barberos trabajando a esa hora.';
     if ((d - today) / 864e5 > 400) return 'La fecha está demasiado lejos.';
     if (+d === +today) {
       const p = time.split(':').map(Number);
       if (p[0] * 60 + p[1] <= now.getHours() * 60 + now.getMinutes()) return 'Esa hora ya pasó.';
     }
     return null;
   }
   
   /* Un turno está lleno cuando hay tantas citas como barberos trabajando a esa hora. */
   function taken(db, cfg, date, time, exceptId) {
     const d = parseDate(date);
     const ocupadas = db.citas.filter(function (c) { return c.id !== exceptId && c.status === 'active' && c.date === date && c.time === time; }).length;
     return ocupadas >= Horario.capacidad(cfg, d.getDay(), time);
   }
   
   function newId(db) {
     let id;
     do { id = 'RB-' + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (db.citas.some(function (c) { return c.id === id; }));
     return id;
   }
   
   function send(res, code, body, type) {
     res.writeHead(code, {
       'Content-Type': type || 'application/json; charset=utf-8',
       'Cache-Control': 'no-store',
       'X-Content-Type-Options': 'nosniff'
     });
     res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
   }
   
   function fail(res, code, msg) { send(res, code, { error: msg }); }
   
   function readBody(req) {
     return new Promise(function (resolve, reject) {
       let raw = '';
       req.on('data', function (ch) { 
         raw += ch; 
         if (raw.length > 20000) { reject(new Error('too-big')); req.destroy(); } 
       });
       req.on('end', function () { 
         try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(new Error('bad-json')); } 
       });
       req.on('error', reject);
     });
   }
   
   async function api(req, res, pathname) {
     const db = readDB();
     const cfg = readConfig();

     /* ---------- HORARIOS ---------- */
     if (pathname === '/api/config' && req.method === 'GET') {
       return send(res, 200, cfg);
     }

     if (pathname === '/api/config/horario' && req.method === 'PUT') {
       let b;
       try { b = await readBody(req); } catch (e) { return fail(res, 400, 'Solicitud no válida.'); }
       const err = Horario.validarRango(b.apertura, b.cierre, b.dias);
       if (err) return fail(res, 400, err);
       if (!b.dias.length) return fail(res, 400, 'Elige al menos un día de atención.');
       cfg.horario = { apertura: b.apertura, cierre: b.cierre, dias: b.dias.slice().sort() };
       writeConfig(cfg);
       return send(res, 200, { config: cfg, fueraDeHorario: citasFueraDeHorario(db, cfg) });
     }

     const mb = pathname.match(/^\/api\/barberos\/([A-Za-z0-9_-]{1,30})\/horario$/);
     if (mb && req.method === 'PUT') {
       const barbero = cfg.barberos.filter(function (x) { return x.usuario === mb[1]; })[0];
       if (!barbero) return fail(res, 404, 'El barbero no existe.');
       let b;
       try { b = await readBody(req); } catch (e) { return fail(res, 400, 'Solicitud no válida.'); }
       const err = Horario.validarRango(b.inicio, b.fin, b.dias);
       if (err) return fail(res, 400, err);
       barbero.inicio = b.inicio; barbero.fin = b.fin; barbero.dias = b.dias.slice().sort();
       writeConfig(cfg);
       return send(res, 200, { config: cfg, fueraDeHorario: citasFueraDeHorario(db, cfg) });
     }
   
     /* ENDPOINT LOGIN CON CONTRASEÑA */
     if (pathname === '/api/login' && req.method === 'POST') {
       let b; 
       try { b = await readBody(req); } catch (e) { return fail(res, 400, 'Solicitud no válida.'); }
       
       const username = String(b.username || '').trim();
       const password = String(b.password || '').trim();
       const role = String(b.role || '').trim();
   
       if (!username || !password) {
         return fail(res, 400, 'Usuario y contraseña requeridos.');
       }
   
       // Credenciales para Administrador
       if (role === 'admin' && username === 'admin' && password === '123456') {
         return send(res, 200, { success: true, user: { username: 'admin', role: 'admin', name: 'Administrador' } });
       }
       
       // Credenciales para Barbero
       if (role === 'barber' && username === 'barbero1' && password === '123456') {
         return send(res, 200, { success: true, user: { username: 'barbero1', role: 'barber', name: 'Carlos (Barbero)' } });
       }
   
       return fail(res, 401, 'Usuario o contraseña incorrectos.');
     }
   
     if (pathname === '/api/ocupadas' && req.method === 'GET') {
       const vistos = {}, llenos = [];
       db.citas.forEach(function (c) {
         const k = c.date + ' ' + c.time;
         if (c.status !== 'active' || vistos[k] || !parseDate(c.date)) return;
         vistos[k] = true;
         if (taken(db, cfg, c.date, c.time)) llenos.push({ date: c.date, time: c.time });
       });
       return send(res, 200, llenos);
     }
   
     if (pathname === '/api/citas' && req.method === 'GET') {
       return send(res, 200, db.citas);
     }
   
     if (pathname === '/api/barbero/citas' && req.method === 'GET') {
       return send(res, 200, db.citas);
     }
   
     if (pathname === '/api/citas' && req.method === 'POST') {
       let b; 
       try { b = await readBody(req); } catch (e) { return fail(res, 400, 'Solicitud no válida.'); }
       
       const name = String(b.name || '').trim().replace(/\s+/g, ' ');
       const email = String(b.email || '').trim();
       const service = String(b.service || '').trim();
       const serviceId = String(b.serviceId || '').trim();
       const price = Number(b.price);
   
       if (name.length < 5 || name.length > 80 || name.indexOf(' ') === -1) return fail(res, 400, 'Escribe tu nombre completo.');
       if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(res, 400, 'El correo no es válido.');
       if (!service || service.length > 60 || !/^[a-z0-9_-]{1,20}$/.test(serviceId) || !(price >= 0 && price <= 1000)) return fail(res, 400, 'El servicio no es válido.');
       
       const bad = checkSlot(cfg, b.date, b.time);
       if (bad) return fail(res, 400, bad);
       if (taken(db, cfg, b.date, b.time)) return fail(res, 409, 'Esa hora acaba de ser reservada. Elige otra.');
   
       const cita = {
         id: newId(db), name: name, email: email,
         serviceId: serviceId, service: service, price: price,
         date: b.date, time: b.time, status: 'active', createdAt: new Date().toISOString()
       };
       
       db.citas.push(cita); 
       writeDB(db);
       return send(res, 201, cita);
     }
   
     const m = pathname.match(/^\/api\/citas\/([A-Za-z0-9-]{1,20})$/);
     if (m && req.method === 'PATCH') {
       const cita = db.citas.filter(function (c) { return c.id === m[1]; })[0];
       if (!cita) return fail(res, 404, 'La cita no existe.');
       
       let b; 
       try { b = await readBody(req); } catch (e) { return fail(res, 400, 'Solicitud no válida.'); }
       
       if (b.status !== undefined) {
         if (b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'active') {
           return fail(res, 400, 'Estado no válido.');
         }
         cita.status = b.status; 
         cita.updatedAt = new Date().toISOString();
       } else {
         const bad = checkSlot(cfg, b.date, b.time);
         if (bad) return fail(res, 400, bad);
         if (taken(db, cfg, b.date, b.time, cita.id)) return fail(res, 409, 'Esa hora ya está ocupada.');
         cita.date = b.date; 
         cita.time = b.time; 
         cita.rescheduledAt = new Date().toISOString();
       }
       
       writeDB(db);
       return send(res, 200, cita);
     }
   
     return fail(res, 404, 'Ruta no encontrada.');
   }
   
   http.createServer(function (req, res) {
     const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
     
     if (pathname.indexOf('/api/') === 0) {
       return api(req, res, pathname).catch(function (e) { 
         console.error(e); 
         fail(res, 500, 'Error interno del servidor.'); 
       });
     }
   
     const f = STATIC[pathname];
     if (!f || req.method !== 'GET') return send(res, 404, 'No encontrado', 'text/plain; charset=utf-8');
   
     fs.readFile(path.join(__dirname, f[0]), function (err, buf) {
       if (err) return send(res, 500, 'Error al leer el archivo', 'text/plain; charset=utf-8');
       send(res, 200, buf, f[1]);
     });
   }).listen(PORT, HOST, function () {
     console.log('Barbería Royal lista:  http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
     console.log('Panel admin:           http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '/admin.html');
     console.log('Panel barbero:         http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + '/barbero.html');
   });