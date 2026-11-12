/* HCPVanta website script. Loaded with "defer", so the page is ready when this runs. */
(function () {
  'use strict';

  /* ---------- Settings you may want to change ---------- */
  // Paste your booking page link between the quotes to make every "Book a chat" button open it.
  var BOOKING_URL = '';

  var SUPABASE_URL = 'https://mecsynzptzniesrbsmzs.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iwDTYmjOtvCz_9FCFiGZEQ_SD8Vdppi'; // public key, safe in a website

  // Libraries are loaded from a CDN with an integrity check: if a file is ever altered, the browser refuses to run it.
  var LIBS = {
    three: {
      src: 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js',
      integrity: 'sha384-RRHfJ6w1mTlKUBMYT/hvnRiOzEB/vyRV3DrQOseb6oYfvaZSfdd0byS4bHps0k2R'
    },
    supabase: {
      src: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.50.0/dist/umd/supabase.js',
      integrity: 'sha384-K0oxqktRvaThvYgGL4G+OK2Ih6VS6Uyu7j3+7WJgp/uWM0Yv6Xi4YEiw0BB+mPfi'
    }
  };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var pageStart = Date.now();

  var loading = {};
  function loadLib(name) {
    if (loading[name]) return loading[name];
    loading[name] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = LIBS[name].src;
      s.integrity = LIBS[name].integrity;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = resolve;
      s.onerror = function () { loading[name] = null; reject(new Error('Could not load ' + name)); };
      document.head.appendChild(s);
    });
    return loading[name];
  }

  /* ---------- Booking link ---------- */
  if (/^https:\/\//.test(BOOKING_URL)) {
    document.querySelectorAll('[data-book]').forEach(function (a) {
      a.href = BOOKING_URL; a.target = '_blank'; a.rel = 'noopener noreferrer';
    });
  }

  /* ---------- Privacy notice opens when linked to ---------- */
  function openPrivacy() {
    if (location.hash === '#privacy') {
      var d = document.querySelector('details.privacy');
      if (d) d.open = true;
    }
  }
  window.addEventListener('hashchange', openPrivacy);
  openPrivacy();

  /* ---------- Header hairline once scrolled ---------- */
  var hdr = document.querySelector('header.site');
  function onScroll() { if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- The four steps draw once, when in view ---------- */
  var steps = document.querySelector('ol.steps[data-moment]');
  if (steps) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { steps.classList.add('in-view'); io.disconnect(); }
      }, { rootMargin: '0px 0px -25% 0px', threshold: 0.4 });
      io.observe(steps);
    } else {
      steps.classList.add('in-view');
    }
  }

  /* ---------- Hero diary leans towards the pointer (desktop only) ---------- */
  var hero = document.querySelector('.hero');
  var diary = document.querySelector('.visual .diary');
  if (hero && diary && finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5;
      var ny = (e.clientY - r.top) / r.height - 0.5;
      diary.style.setProperty('--ry', (nx * 7).toFixed(2) + 'deg');
      diary.style.setProperty('--rx', (-ny * 5).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', function () {
      diary.style.setProperty('--ry', '0deg');
      diary.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------- Enquiry form ---------- */
  var form = document.getElementById('enquiry');
  if (form) {
    var statusEl = form.querySelector('.status');
    var btn = form.querySelector('button[type="submit"]');
    var say = function (kind, text) { statusEl.className = 'status' + (kind ? ' ' + kind : ''); statusEl.textContent = text; };

    // Fetch the form library quietly as soon as someone starts typing.
    form.addEventListener('focusin', function () { loadLib('supabase').catch(function () {}); }, { once: true });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      say('', '');
      if (form.elements.namedItem('website').value) return;                       // hidden field: only bots fill it in
      if (!form.reportValidity()) return;
      if (Date.now() - pageStart < 3000) return;            // nobody genuine submits within 3 seconds
      var last = 0;
      try { last = Number(sessionStorage.getItem('hcpv-sent') || 0); } catch (err) {}
      if (Date.now() - last < 30000) { say('bad', 'Your last enquiry was sent a moment ago. Please wait a little before sending another.'); return; }

      btn.disabled = true; btn.textContent = 'Sending…';
      loadLib('supabase').then(function () {
        var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        return client.from('enquiries').insert({
          name: form.elements.namedItem('name').value.trim().slice(0, 200),
          email: form.elements.namedItem('email').value.trim().toLowerCase().slice(0, 320),
          company: form.elements.namedItem('company').value.trim().slice(0, 200) || null,
          message: form.elements.namedItem('message').value.trim().slice(0, 5000)
        });
      }).then(function (res) {
        if (res.error) throw res.error;
        try { sessionStorage.setItem('hcpv-sent', String(Date.now())); } catch (err) {}
        form.reset();
        say('ok', 'Thanks, your enquiry has been sent. We’ll be in touch soon.');
      }).catch(function () {
        say('bad', 'Your enquiry didn’t send. Please try again, or email kallam@hcpvanta.com.');
      }).then(function () {
        btn.disabled = false; btn.textContent = 'Send enquiry';
      });
    });
  }

  /* ---------- 3D scene ---------- */
  var canvas = document.getElementById('scene3d');
  var stage = document.querySelector('.cross-stage');
  var saveData = navigator.connection && navigator.connection.saveData;

  function supportsWebGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }

  if (canvas && stage && !saveData && supportsWebGL()) {
    var start = function () { loadLib('three').then(initScene).catch(function () { canvas.remove(); }); };
    var whenIdle = function () { if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 300); };
    if (document.readyState === 'complete') whenIdle(); else window.addEventListener('load', whenIdle);
  } else if (canvas) {
    canvas.remove();   // the flat cross in the page stays as the fallback
  }

  function initScene() {
    var THREE = window.THREE;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch (e) { canvas.remove(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;

    var dark = window.matchMedia('(prefers-color-scheme: dark)');
    var lin = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb8b3, 0.95));
    var key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(4, 6, 8); scene.add(key);
    var warm = new THREE.DirectionalLight(0xE9B949, 0.7); warm.position.set(-6, -3, 3); scene.add(warm);

    // The cross
    var a = 0.55, l = 1.6, sh = new THREE.Shape();
    sh.moveTo(-a, l); sh.lineTo(a, l); sh.lineTo(a, a); sh.lineTo(l, a); sh.lineTo(l, -a); sh.lineTo(a, -a);
    sh.lineTo(a, -l); sh.lineTo(-a, -l); sh.lineTo(-a, -a); sh.lineTo(-l, -a); sh.lineTo(-l, a); sh.lineTo(-a, a); sh.closePath();
    var geo = new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.24, bevelSegments: 10, curveSegments: 10 });
    geo.center();
    var tealMat = new THREE.MeshPhysicalMaterial({ roughness: 0.25, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 });
    var cross = new THREE.Mesh(geo, tealMat);

    // Orbit with three "booked meetings"
    var R = 2.9, tilt = Math.PI / 2.4;
    var ringMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 12, 200), ringMat);
    ring.rotation.x = tilt;
    var goldMat = new THREE.MeshPhysicalMaterial({ color: lin(0xE9B949), roughness: 0.3, clearcoat: 0.8 });
    var dots = [0, 1, 2].map(function () { return new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 32), goldMat); });

    var group = new THREE.Group();
    group.add(cross, ring);
    dots.forEach(function (d) { group.add(d); });
    scene.add(group);

    // Floating capsules and beads for depth (desktop only, kept away from the text column)
    var floaters = [];
    var pillMat = new THREE.MeshPhysicalMaterial({ color: lin(0xFFFFFF), roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.9 });
    var beadMat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.85 });
    var floatGroup = new THREE.Group();
    scene.add(floatGroup);
    var seeds = [
      [ 0.47,  0.30, -3.0, 'pill'], [-0.50, -0.22, -4.5, 'pill'], [ 0.50, -0.38, -2.0, 'bead'],
      [-0.50,  0.36, -5.5, 'bead'], [ 0.49, -0.05, -6.5, 'pill'], [-0.495, 0.02, -2.5, 'bead'],
      [ 0.46,  0.44, -7.0, 'pill']
    ];
    seeds.forEach(function (s, i) {
      var mesh = s[3] === 'pill'
        ? new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 8, 20), pillMat)
        : new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 24), beadMat);
      mesh.userData = { fx: s[0], fy: s[1], z: s[2], phase: i * 1.7, spin: 0.2 + (i % 3) * 0.12 };
      floatGroup.add(mesh);
      floaters.push(mesh);
    });

    function tint() {
      tealMat.color.copy(lin(dark.matches ? 0x5FA79E : 0x2F6F6A));
      ringMat.color.copy(lin(dark.matches ? 0x6FB8AF : 0x2F6F6A));
      beadMat.color.copy(lin(dark.matches ? 0x6FB8AF : 0x2F6F6A));
    }
    tint();
    if (dark.addEventListener) dark.addEventListener('change', tint);

    var sections = Array.prototype.slice.call(document.querySelectorAll('[data-3d]'));
    function view(z) {
      var h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - (z || 0));
      return { h: h, w: h * camera.aspect };
    }
    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    var pointer = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
    if (finePointer && !reduceMotion) {
      window.addEventListener('pointermove', function (e) {
        pointer.x = e.clientX / window.innerWidth - 0.5;
        pointer.y = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });
    }

    // The cross sits in whichever reserved space is nearest the middle of the screen.
    var stages = Array.prototype.slice.call(document.querySelectorAll('[data-stage]'));
    var target = { x: 0, y: 0, s: 1, o: 1 }, cur = { x: 0, y: 0, s: 0.01, o: 0 };
    function aim() {
      var vh = window.innerHeight, best = null, bestD = Infinity;
      var list = reduceMotion ? [stage] : stages;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect();
        if (r.width < 40 || r.height < 40) continue;                  // hidden on this screen size
        if (r.bottom < vh * 0.1 || r.top > vh * 0.9) continue;        // not really on screen
        var d = Math.abs(r.top + r.height / 2 - vh / 2);
        if (d < bestD) { bestD = d; best = r; }
      }
      if (!best) { target.o = 0; return; }
      var v = view(0), ppu = vh / v.h;
      target.x = ((best.left + best.width / 2) / window.innerWidth - 0.5) * v.w;
      target.y = -((best.top + best.height / 2) / vh - 0.5) * v.h;
      target.s = Math.min((best.height * 0.86) / ppu / 4.2, (best.width * 0.92) / ppu / 6.3, 1.05);
      target.o = 1;
    }

    var last = performance.now(), born = last, running = true, lastScroll = window.scrollY, spin = 0;
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) { last = performance.now(); requestAnimationFrame(frame); }
    });

    function frame(now) {
      if (!running) return;
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      aim();

      var k = 1 - Math.pow(0.0004, dt);                               // quick, smooth follow
      cur.x += (target.x - cur.x) * k; cur.y += (target.y - cur.y) * k;
      cur.o += (target.o - cur.o) * (1 - Math.pow(0.01, dt));
      cur.s += (target.s - cur.s) * (1 - Math.pow(0.004, dt));      // also gives the grow-in on arrival
      canvas.style.opacity = cur.o.toFixed(3);

      if (cur.o < 0.01 && target.o === 0) { lastScroll = window.scrollY; requestAnimationFrame(frame); return; }   // nothing to draw

      var t = reduceMotion ? 0 : now / 1000;
      var sc = reduceMotion ? 0 : window.scrollY * 0.0012;
      var dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
      if (!reduceMotion) spin += dy * 0.0025;
      spin *= Math.pow(0.04, dt);                                     // scroll flicks spin the cross, then settle
      var arrive = reduceMotion ? 0 : Math.max(0, 1 - (now - born) / 1100);   // one extra turn on arrival
      lean.x += (pointer.x - lean.x) * (1 - Math.pow(0.01, dt));
      lean.y += (pointer.y - lean.y) * (1 - Math.pow(0.01, dt));

      group.position.set(cur.x, cur.y + (reduceMotion ? 0 : Math.sin(t * 0.9) * 0.12 * cur.s), 0);
      group.scale.setScalar(cur.s);
      group.rotation.set(lean.y * 0.5, lean.x * 0.7, 0);
      cross.rotation.set(
        0.3 + Math.sin(t * 0.4) * 0.2 + sc * 0.35,
        0.6 + t * 0.25 + sc + spin + arrive * arrive * 5,
        Math.sin(t * 0.3) * 0.08
      );
      for (var i = 0; i < dots.length; i++) {
        var ang = t * 0.6 + i * 2.094 + sc * 1.5 + spin * 0.5;
        dots[i].position.set(Math.cos(ang) * R, Math.sin(ang) * R * Math.cos(tilt), Math.sin(ang) * R * Math.sin(tilt));
      }

      floatGroup.visible = window.innerWidth >= 1200;                 // only where there are side margins
      if (floatGroup.visible) {
        for (var j = 0; j < floaters.length; j++) {
          var m = floaters[j], u = m.userData, fv = view(u.z);
          var drift = reduceMotion ? 0 : (window.scrollY * 0.0016 * (1 + j * 0.15));
          var yy = u.fy * fv.h + drift;
          yy = ((yy + fv.h * 0.6) % (fv.h * 1.2) + fv.h * 1.2) % (fv.h * 1.2) - fv.h * 0.6;   // wrap top to bottom
          m.position.set(u.fx * fv.w - lean.x * 0.4, yy + Math.sin(t * 0.5 + u.phase) * 0.25 + lean.y * 0.3, u.z);
          m.rotation.set(t * u.spin + u.phase, t * u.spin * 0.7, u.phase);
        }
      }

      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    document.documentElement.classList.add('has-3d');
    requestAnimationFrame(frame);
  }
})();
