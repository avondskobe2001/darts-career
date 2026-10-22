/* Canvas dartboard + interactive throw */
window.DartBoard = (function () {
  const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const COLORS = { dark: '#1a1a1a', cream: '#f5e6c8', red: '#c41e3a', green: '#0b6e4f', wire: '#ccc' };

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let size = 320;
    let aimX = 0, aimY = 0;
    let aiming = false;
    let onThrow = null;
    let locked = false;
    let lastHits = []; // visual darts

    function resize(s) {
      size = s;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = s * dpr;
      canvas.height = s * dpr;
      canvas.style.width = s + 'px';
      canvas.style.height = s + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function R(frac) { return (size / 2) * frac; }
    function cx() { return size / 2; }
    function cy() { return size / 2; }

    function polarToCart(angle, r) {
      // angle 0 = top (20), clockwise
      const a = (angle - Math.PI / 2);
      return { x: cx() + r * Math.cos(a), y: cy() + r * Math.sin(a) };
    }

    function draw() {
      ctx.clearRect(0, 0, size, size);
      // outer ring
      ctx.beginPath();
      ctx.arc(cx(), cy(), R(0.98), 0, Math.PI * 2);
      ctx.fillStyle = '#0d0d0d';
      ctx.fill();

      const rings = [
        { outer: 0.92, inner: 0.86, type: 'double' },
        { outer: 0.86, inner: 0.56, type: 'single_outer' },
        { outer: 0.56, inner: 0.50, type: 'triple' },
        { outer: 0.50, inner: 0.14, type: 'single_inner' },
      ];

      for (let i = 0; i < 20; i++) {
        const a0 = (i * Math.PI * 2) / 20 - Math.PI / 20;
        const a1 = ((i + 1) * Math.PI * 2) / 20 - Math.PI / 20;
        const num = SEGMENTS[i];
        const isDark = i % 2 === 0;

        for (const ring of rings) {
          ctx.beginPath();
          ctx.arc(cx(), cy(), R(ring.outer), a0 - Math.PI / 2, a1 - Math.PI / 2);
          ctx.arc(cx(), cy(), R(ring.inner), a1 - Math.PI / 2, a0 - Math.PI / 2, true);
          ctx.closePath();
          let col;
          if (ring.type === 'double' || ring.type === 'triple') {
            col = isDark ? COLORS.red : COLORS.green;
          } else {
            col = isDark ? COLORS.dark : COLORS.cream;
          }
          ctx.fillStyle = col;
          ctx.fill();
        }

        // number labels
        const mid = (a0 + a1) / 2;
        const p = polarToCart(mid + Math.PI / 2, R(0.96));
        // wait - polarToCart uses angle from top. mid is already from standard.
        const labelA = mid;
        const lx = cx() + R(0.96) * Math.cos(labelA - Math.PI / 2);
        const ly = cy() + R(0.96) * Math.sin(labelA - Math.PI / 2);
        ctx.fillStyle = '#eee';
        ctx.font = `bold ${Math.max(10, size * 0.035)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(num), lx, ly);
      }

      // bull
      ctx.beginPath();
      ctx.arc(cx(), cy(), R(0.14), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.green;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx(), cy(), R(0.06), 0, Math.PI * 2);
      ctx.fillStyle = COLORS.red;
      ctx.fill();

      // wires
      ctx.strokeStyle = COLORS.wire;
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI * 2) / 20 - Math.PI / 20 - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx() + R(0.06) * Math.cos(a), cy() + R(0.06) * Math.sin(a));
        ctx.lineTo(cx() + R(0.92) * Math.cos(a), cy() + R(0.92) * Math.sin(a));
        ctx.stroke();
      }
      [0.92, 0.86, 0.56, 0.50, 0.14, 0.06].forEach((f) => {
        ctx.beginPath();
        ctx.arc(cx(), cy(), R(f), 0, Math.PI * 2);
        ctx.stroke();
      });

      // landed darts
      for (const h of lastHits) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = h.color || '#4a9eff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // aim cursor
      if (aiming && !locked) {
        ctx.beginPath();
        ctx.arc(aimX, aimY, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(aimX - 14, aimY);
        ctx.lineTo(aimX + 14, aimY);
        ctx.moveTo(aimX, aimY - 14);
        ctx.lineTo(aimX, aimY + 14);
        ctx.stroke();
      }
    }

    function scoreAt(x, y) {
      const dx = x - cx();
      const dy = y - cy();
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxR = R(0.92);
      if (dist > maxR) return { score: 0, label: 'Mis', mult: 0, segment: 0 };

      if (dist <= R(0.06)) return { score: 50, label: 'Bull!', mult: 2, segment: 25 };
      if (dist <= R(0.14)) return { score: 25, label: 'Outer Bull', mult: 1, segment: 25 };

      let angle = Math.atan2(dy, dx) + Math.PI / 2; // 0 at top
      if (angle < 0) angle += Math.PI * 2;
      const idx = Math.floor(((angle + Math.PI / 20) % (Math.PI * 2)) / (Math.PI * 2 / 20)) % 20;
      const seg = SEGMENTS[idx];

      let mult = 1;
      let label = String(seg);
      if (dist >= R(0.86) && dist <= R(0.92)) {
        mult = 2;
        label = 'D' + seg;
      } else if (dist >= R(0.50) && dist <= R(0.56)) {
        mult = 3;
        label = 'T' + seg;
      }
      return { score: seg * mult, label, mult, segment: seg };
    }

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = size / rect.width;
      const scaleY = size / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    canvas.addEventListener('mousemove', (e) => {
      if (locked) return;
      const p = getPos(e);
      aimX = p.x;
      aimY = p.y;
      aiming = true;
      draw();
    });
    canvas.addEventListener('mouseleave', () => {
      aiming = false;
      draw();
    });
    canvas.addEventListener('click', (e) => {
      if (locked || !onThrow) return;
      const p = getPos(e);
      onThrow(p.x, p.y);
    });
    // touch: drag to aim (aim point shown above finger), release to throw
    const TOUCH_OFFSET = 0;
    function touchPos(e){ const t=e.changedTouches[0]; const rect=canvas.getBoundingClientRect();
      return { x:(t.clientX-rect.left)*(size/rect.width), y:(t.clientY-rect.top)*(size/rect.height)-TOUCH_OFFSET }; }
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault(); if (locked) return;
      const p = touchPos(e); aimX=p.x; aimY=p.y; aiming=true; draw();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault(); if (locked) return;
      const p = touchPos(e); aimX=p.x; aimY=p.y; aiming=true; draw();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault(); if (locked || !onThrow) return;
      const p = touchPos(e); aimX=p.x; aimY=p.y; draw();
      onThrow(p.x, p.y);
    }, { passive: false });

    function applyThrow(targetX, targetY, wobblePx, color) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * wobblePx;
      const x = targetX + Math.cos(angle) * dist;
      const y = targetY + Math.sin(angle) * dist;
      const result = scoreAt(x, y);
      lastHits.push({ x, y, color: color || '#4a9eff' });
      if (lastHits.length > 3) lastHits.shift();
      draw();
      return { ...result, x, y };
    }

    function clearHits() {
      lastHits = [];
      draw();
    }

    function setLocked(v) {
      locked = v;
      canvas.classList.toggle('locked', v);
      draw();
    }

    function showAIHit(result, color) {
      // place visual at approximate position for AI result
      const pos = approxPos(result);
      lastHits.push({ x: pos.x, y: pos.y, color: color || '#e63946' });
      if (lastHits.length > 3) lastHits.shift();
      draw();
    }

    function approxPos(result) {
      if (result.score === 50) return { x: cx(), y: cy() };
      if (result.score === 25) return { x: cx() + 8, y: cy() + 8 };
      if (result.score === 0) {
        const a = Math.random() * Math.PI * 2;
        return { x: cx() + R(0.97) * Math.cos(a), y: cy() + R(0.97) * Math.sin(a) };
      }
      const idx = SEGMENTS.indexOf(result.segment);
      const mid = (idx * Math.PI * 2) / 20;
      let rFrac = 0.35;
      if (result.mult === 2) rFrac = 0.89;
      else if (result.mult === 3) rFrac = 0.53;
      else if (result.segment === 25) rFrac = 0.1;
      const jitter = (Math.random() - 0.5) * 0.04;
      return {
        x: cx() + R(rFrac + jitter) * Math.cos(mid - Math.PI / 2),
        y: cy() + R(rFrac + jitter) * Math.sin(mid - Math.PI / 2),
      };
    }

    const fit = () => resize(Math.floor(Math.min(420, window.innerWidth * 0.92, window.innerHeight * 0.6)));
    fit();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 120); });
    window.addEventListener('orientationchange', () => setTimeout(fit, 200));
    return {
      resize,
      draw,
      applyThrow,
      clearHits,
      setLocked,
      setOnThrow(fn) { onThrow = fn; },
      showAIHit,
      scoreAt,
      getSize: () => size,
      aimAtSegment(seg, mult) {
        // return canvas coords for aiming hint (T20 etc)
        const idx = SEGMENTS.indexOf(seg);
        if (idx < 0) return { x: cx(), y: cy() };
        const mid = (idx * Math.PI * 2) / 20;
        let rFrac = 0.35;
        if (mult === 2) rFrac = 0.89;
        else if (mult === 3) rFrac = 0.53;
        if (seg === 25) return { x: cx(), y: cy() };
        return {
          x: cx() + R(rFrac) * Math.cos(mid - Math.PI / 2),
          y: cy() + R(rFrac) * Math.sin(mid - Math.PI / 2),
        };
      },
    };
  }

  return { create, SEGMENTS };
})();
