/* HCPVanta website script. Loaded with "defer", so the page is ready when this runs. */
(function () {
  'use strict';

  /* ---------- Settings you may want to change ---------- */
  // Paste your booking page link between the quotes to make every "Book a chat" button open it.
  var BOOKING_URL = '';

  var SUPABASE_URL = 'https://mecsynzptzniesrbsmzs.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iwDTYmjOtvCz_9FCFiGZEQ_SD8Vdppi'; // public key, safe in a website

  // Libraries load from a CDN with an integrity check: if a file is ever altered, the browser refuses to run it.
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

  /* ---------- Header shadow once scrolled ---------- */
  var hdr = document.querySelector('header.site');
  function onScroll() { if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Two moments that play once, when in view ---------- */
  function playOnce(el, rootMargin, threshold) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in-view'); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { el.classList.add('in-view'); io.disconnect(); }
    }, { rootMargin: rootMargin, threshold: threshold });
    io.observe(el);
  }
  playOnce(document.querySelector('ol.steps[data-moment]'), '0px 0px -25% 0px', 0.4);
  playOnce(document.getElementById('miniDiary'), '0px 0px -20% 0px', 0.5);

  /* ---------- Hero chips drift gently with the pointer (desktop only) ---------- */
  var hero = document.querySelector('.hero');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-drift]'));
  if (hero && chips.length && finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      chips.forEach(function (c) {
        var d = Number(c.getAttribute('data-drift')) || 10;
        c.style.translate = (nx * d).toFixed(1) + 'px ' + (ny * d * 0.7).toFixed(1) + 'px';
      });
    });
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (resolve, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); })]);
  }

  /* ---------- Enquiry form ---------- */
  var form = document.getElementById('enquiry');
  if (form) {
    var statusEl = form.querySelector('.status');
    var btn = form.querySelector('button[type="submit"]');
    var say = function (kind, text) { statusEl.className = 'status' + (kind ? ' ' + kind : ''); statusEl.textContent = text; };
    var val = function (n) { return form.elements.namedItem(n).value; };

    // Fetch the form library quietly once the page has settled, or as soon as someone starts typing.
    var prefetch = function () { loadLib('supabase').catch(function () {}); };
    form.addEventListener('focusin', prefetch, { once: true });
    var later = function () { if ('requestIdleCallback' in window) requestIdleCallback(prefetch, { timeout: 4000 }); else setTimeout(prefetch, 2500); };
    if (document.readyState === 'complete') later(); else window.addEventListener('load', later);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      say('', '');
      if (val('website')) return;                           // hidden field: only bots fill it in
      if (!form.reportValidity()) return;
      if (Date.now() - pageStart < 3000) return;            // nobody genuine submits within 3 seconds
      var last = 0;
      try { last = Number(sessionStorage.getItem('hcpv-sent') || 0); } catch (err) {}
      if (Date.now() - last < 30000) { say('bad', 'Your last enquiry was sent a moment ago. Please wait a little before sending another.'); return; }

      btn.disabled = true; btn.textContent = 'Sending…';
      withTimeout(loadLib('supabase').then(function () {
        var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        return client.from('enquiries').insert({
          name: val('name').trim().slice(0, 200),
          email: val('email').trim().toLowerCase().slice(0, 320),
          company: val('company').trim().slice(0, 200) || null,
          message: val('message').trim().slice(0, 5000)
        });
      }), 15000).then(function (res) {
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

  /* ---------- 3D: a DNA helix that leads the hero, then runs down the edge of the page ---------- */
  var canvas = document.getElementById('scene3d');
  var stage = document.getElementById('helixStage');
  var saveData = navigator.connection && navigator.connection.saveData;

  function supportsWebGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }

  if (canvas && stage && !saveData && supportsWebGL()) {
    var start = function () { loadLib('three').then(initScene).catch(function () { canvas.remove(); }); };
    var whenIdle = function () { if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1200 }); else setTimeout(start, 250); };
    if (document.readyState === 'complete') whenIdle(); else window.addEventListener('load', whenIdle);
  } else if (canvas) {
    canvas.remove();   // the still helix in the page stays as the fallback
  }

  function initScene() {
    var THREE = window.THREE, renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch (e) { canvas.remove(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding;

    var lin = function (hex) { return new THREE.Color(hex).convertSRGBToLinear(); };
    var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 18);

    // A small studio of light panels, so the glossy beads have something to reflect
    try {
      var pm = new THREE.PMREMGenerator(renderer);
      var studio = new THREE.Scene();
      var panel = function (hex, power, x, y, z, w, h) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(power), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
      };
      panel(0xffffff, 3.4, 0, 9, 5, 12, 4);
      panel(0xfff0dc, 2.4, -9, 2, 4, 4, 9);
      panel(0xff7a3d, 2.0, 9, -2, 3, 3, 7);
      panel(0xcfd9ae, 1.3, 0, -9, 2, 12, 3);
      scene.environment = pm.fromScene(studio, 0.03).texture;
      pm.dispose();
    } catch (e) { /* the beads still render, just with plainer reflections */ }

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a66, 0.5));
    var key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(4, 6, 8); scene.add(key);
    var rim = new THREE.DirectionalLight(0xff7a3d, 0.8); rim.position.set(-6, -2, -4); scene.add(rim);

    function mat(extra) {
      var m = new THREE.MeshPhysicalMaterial({ roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.1 });
      if (extra) for (var k in extra) m[k] = extra[k];
      return m;
    }
    var matA = mat(), matB = mat(), matR = mat({ roughness: 0.5, clearcoat: 0.3 });
    var matP = mat({ emissive: lin(0x7a2a0a), emissiveIntensity: 0.35 });
    matP.color.copy(lin(0xFF7A3D));

    // Two colour sets: one for dark sections, one for light sections
    var C = {
      dark:  { a: lin(0xB4C47C), b: lin(0xF3ECDC), r: lin(0x7E9150) },
      light: { a: lin(0x566B2A), b: lin(0xBBA878), r: lin(0x8F9E63) }
    };

    var N = window.innerWidth < 760 ? 34 : 38, TURNS = 2.2, TAU = Math.PI * 2;
    var isAccent = function (i) { return i % 9 === 4; };
    var nP = 0; for (var q = 0; q < N; q++) if (isAccent(q)) nP++;

    var ball = new THREE.SphereGeometry(1, 26, 26);
    var rod = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); rod.rotateZ(Math.PI / 2);   // lies along X
    function inst(geo, m, count) {
      var im = new THREE.InstancedMesh(geo, m, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; return im;
    }
    var meshA = inst(ball, matA, N - nP), meshP = inst(ball, matP, nP), meshB = inst(ball, matB, N), meshR = inst(rod, matR, N);
    var group = new THREE.Group();
    group.add(meshR, meshA, meshB, meshP);
    scene.add(group);
    var dummy = new THREE.Object3D();

    function layout(p, age) {
      var ia = 0, ip = 0;
      for (var i = 0; i < N; i++) {
        var t = i / (N - 1), y = (t - 0.5) * p.H, ang = t * TURNS * TAU + p.phase;
        var r = reduceMotion ? 1 : clamp((age - i * 0.024) / 0.6, 0, 1), e = 1 - Math.pow(1 - r, 3);
        var taper = 0.55 + 0.45 * Math.sin(Math.PI * t), rr = p.R * (0.35 + 0.65 * e), br = p.bead * taper * e;
        var c = Math.cos(ang), s = Math.sin(ang);

        dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(Math.max(br, 0.0001));
        dummy.position.set(c * rr, y, s * rr); dummy.updateMatrix();
        if (isAccent(i)) meshP.setMatrixAt(ip++, dummy.matrix); else meshA.setMatrixAt(ia++, dummy.matrix);

        dummy.position.set(-c * rr, y, -s * rr); dummy.updateMatrix(); meshB.setMatrixAt(i, dummy.matrix);

        dummy.position.set(0, y, 0); dummy.rotation.set(0, -ang, 0);
        dummy.scale.set(Math.max(2 * rr, 0.0001), Math.max(br * 0.2, 0.0001), Math.max(br * 0.2, 0.0001));
        dummy.updateMatrix(); meshR.setMatrixAt(i, dummy.matrix);
      }
      meshA.instanceMatrix.needsUpdate = meshP.instanceMatrix.needsUpdate = meshB.instanceMatrix.needsUpdate = meshR.instanceMatrix.needsUpdate = true;
    }

    var tones = Array.prototype.slice.call(document.querySelectorAll('[data-tone]'));
    function worldHeight() { return 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z; }
    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    }
    resize(); window.addEventListener('resize', resize);

    var pointer = { x: 0, y: 0 }, lean = { x: 0, y: 0 };
    if (finePointer && !reduceMotion) {
      window.addEventListener('pointermove', function (e) {
        pointer.x = e.clientX / window.innerWidth - 0.5; pointer.y = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });
    }

    // Targets: "hero" (big, tilted, in its stage) or "edge" (a slim strand down the right-hand side)
    var tgt = { cx: 0, cy: 0, R: 100, H: 600, bead: 14, tilt: -0.4, o: 1, tone: 0 };
    var cur = { cx: window.innerWidth * 0.75, cy: window.innerHeight * 0.5, R: 100, H: 600, bead: 14, tilt: -0.4, o: 0, tone: 0 };
    function aim() {
      var vw = window.innerWidth, vh = window.innerHeight, mobile = vw < 760, wide = vw >= 1240;
      var r = stage.getBoundingClientRect();
      var inHero = r.bottom > vh * 0.18 && r.top < vh * 0.95;
      if (inHero) {
        var Rpx = mobile ? Math.min(r.width * 0.19, r.height * 0.22) : Math.min(r.width * 0.23, r.height * 0.25);
        tgt.cx = r.left + r.width / 2; tgt.cy = r.top + r.height / 2;
        tgt.R = Rpx; tgt.H = r.height * (mobile ? 1.2 : 1.2); tgt.bead = Rpx * 0.125; tgt.tilt = mobile ? -0.5 : -0.42; tgt.o = 1; tgt.tone = 0;
      } else {
        var Re = mobile ? 9 : (wide ? 19 : 15);
        tgt.R = Re; tgt.H = vh * 1.15; tgt.bead = Re * (mobile ? 0.32 : 0.26);
        tgt.cx = vw - (mobile ? 15 : (wide ? 38 : 26)); tgt.cy = vh / 2; tgt.tilt = 0;
        tgt.o = mobile ? 0.55 : (wide ? 0.95 : 0.3);
        var mid = vh * 0.5, tone = 1;
        for (var i = 0; i < tones.length; i++) {
          var b = tones[i].getBoundingClientRect();
          if (b.top <= mid && b.bottom > mid) { tone = tones[i].getAttribute('data-tone') === 'dark' ? 0 : 1; break; }
        }
        tgt.tone = tone;
      }
    }

    var last = performance.now(), born = last, raf = 0, lastScroll = window.scrollY, spin = 0;
    function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { last = performance.now(); schedule(); } });

    function frame(now) {
      raf = 0;
      if (document.hidden) return;
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      aim();

      var k = 1 - Math.pow(0.002, dt);
      ['cx', 'cy', 'R', 'H', 'bead', 'tilt', 'o', 'tone'].forEach(function (key2) { cur[key2] += (tgt[key2] - cur[key2]) * k; });
      canvas.style.opacity = cur.o.toFixed(3);

      var t = reduceMotion ? 0 : now / 1000;
      var dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
      if (!reduceMotion) spin += dy * 0.004;
      spin *= Math.pow(0.05, dt);                                   // a scroll flick twists the helix, then it settles
      lean.x += (pointer.x - lean.x) * (1 - Math.pow(0.01, dt));
      lean.y += (pointer.y - lean.y) * (1 - Math.pow(0.01, dt));

      var wpp = worldHeight() / window.innerHeight;                  // world units per screen pixel
      group.position.set((cur.cx - window.innerWidth / 2) * wpp, -(cur.cy - window.innerHeight / 2) * wpp, 0);
      group.rotation.set(lean.y * 0.3, lean.x * 0.5, cur.tilt);

      matA.color.copy(C.dark.a).lerp(C.light.a, cur.tone);
      matB.color.copy(C.dark.b).lerp(C.light.b, cur.tone);
      matR.color.copy(C.dark.r).lerp(C.light.r, cur.tone);

      layout({ R: cur.R * wpp, H: cur.H * wpp, bead: cur.bead * wpp, phase: t * 0.35 + spin }, reduceMotion ? 9 : (now - born) / 1000);
      renderer.render(scene, camera);
      schedule();
    }
    document.documentElement.classList.add('has-3d');
    schedule();
  }
})();
