/* ============================================================
   问心阁 · 核心模块
   本地存储用户体系（雅号）、心光值、签到、导航与通用组件。
   未来接入后端时，把 Store 替换为 API 调用即可（见 README）。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 本地存储 ---------- */
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('wxg_' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('wxg_' + key, JSON.stringify(value)); } catch (e) {}
    },
    remove(key) { try { localStorage.removeItem('wxg_' + key); } catch (e) {} }
  };

  /* ---------- 用户（雅号） ---------- */
  const NAME_POOL = ['听松', '枕流', '栖云', '拾露', '抱朴', '望舒', '观澜', '闻溪',
    '叩月', '步虚', '汲泉', '种菊', '扫雪', '伴鹤', '收霞', '问梅'];

  function ensureUser() {
    let u = Store.get('user', null);
    if (!u) {
      const word = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
      const num = String(Math.floor(100 + Math.random() * 900));
      u = { code: word + num, created: new Date().toISOString().slice(0, 10) };
      Store.set('user', u);
    }
    return u;
  }

  /* ---------- 心光值 ---------- */
  const Light = {
    get() { return Store.get('light', 0); },
    add(n, reason) {
      const v = this.get() + n;
      Store.set('light', v);
      const logs = Store.get('light_logs', []);
      logs.unshift({ n, reason, t: todayStr() });
      Store.set('light_logs', logs.slice(0, 100));
      if (reason) toast('心光 +' + n + ' · ' + reason);
      return v;
    }
  };

  /* ---------- 日期工具 ---------- */
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /* 以日期为种子的确定性伪随机（同一天结果一致） */
  function daySeed(extra) {
    const s = todayStr() + (extra || '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function seededPick(arr, seed, count) {
    const pool = arr.slice();
    const out = [];
    let s = seed;
    while (out.length < count && pool.length) {
      s = (s * 1103515245 + 12345) >>> 0;
      out.push(pool.splice(s % pool.length, 1)[0]);
    }
    return out;
  }

  /* ---------- 签到 ---------- */
  function checkedInToday() { return Store.get('checkin', '') === todayStr(); }
  function checkin() {
    if (checkedInToday()) { toast('今日已签到，明日再来'); return false; }
    Store.set('checkin', todayStr());
    Light.add(3, '每日一省');
    return true;
  }

  /* ---------- Toast ---------- */
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  /* ---------- 通用弹窗 ---------- */
  function modal(opts) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal">' +
      '<h3>' + opts.title + '</h3>' +
      '<p>' + opts.body + '</p>' +
      '<button class="btn sha block" id="_m_ok">' + (opts.okText || '好的') + '</button>' +
      (opts.cancel ? '<button class="btn ghost block" style="margin-top:10px" id="_m_no">' + opts.cancel + '</button>' : '') +
      '</div>';
    document.body.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('show'));
    const close = () => { mask.classList.remove('show'); setTimeout(() => mask.remove(), 250); };
    mask.querySelector('#_m_ok').onclick = () => { close(); opts.onOk && opts.onOk(); };
    const no = mask.querySelector('#_m_no');
    if (no) no.onclick = close;
    mask.onclick = (e) => { if (e.target === mask) close(); };
    return close;
  }

  /* ---------- 动效偏好 ---------- */
  const REDUCED = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 液态墨彩背景（低分辨率绘制，靠 CSS blur 出"流动墨色"） ---------- */
  function injectLiquidBg() {
    if (REDUCED) return; /* CSS 已为减弱动效用户隐藏 .liquid-bg 并给出纯色背景 */
    const canvas = document.createElement('canvas');
    canvas.className = 'liquid-bg';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    /* 光团：青黛 / 流光金 / 赭砂 / 深青，缓慢游走 */
    const BLOBS = [
      { c: '79,168,176',  a: .42, r: .52, x: .22, y: .25, vx: .00010, vy: .00013, ph: 0 },
      { c: '227,194,127', a: .30, r: .44, x: .80, y: .18, vx: .00013, vy: .00009, ph: 2.1 },
      { c: '194,85,53',   a: .26, r: .40, x: .70, y: .80, vx: .00009, vy: .00012, ph: 4.2 },
      { c: '46,111,119',  a: .38, r: .58, x: .18, y: .85, vx: .00012, vy: .00010, ph: 5.5 }
    ];

    function resize() {
      /* 内部分辨率压到 ~1/6，模糊后视觉无损，渲染开销极小 */
      canvas.width = Math.max(160, Math.floor(window.innerWidth / 6));
      canvas.height = Math.max(160, Math.floor(window.innerHeight / 6));
    }
    resize();
    window.addEventListener('resize', resize);

    function frame(t) {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of BLOBS) {
        const x = (b.x + Math.sin(t * b.vx + b.ph) * .16) * w;
        const y = (b.y + Math.cos(t * b.vy + b.ph) * .14) * h;
        const r = b.r * Math.min(w, h) * (1 + Math.sin(t * .00007 + b.ph) * .12);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(' + b.c + ',' + b.a + ')');
        g.addColorStop(1, 'rgba(' + b.c + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    frame(0);

    let rafId = null;
    function loop(t) { frame(t); rafId = requestAnimationFrame(loop); }
    rafId = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
      else if (rafId === null) rafId = requestAnimationFrame(loop);
    });
  }

  /* ---------- 水波涟漪 ---------- */
  function injectRipple() {
    if (REDUCED) return;
    document.addEventListener('pointerdown', (e) => {
      if (e.clientX === 0 && e.clientY === 0) return; /* 键盘触发的合成事件 */
      const dot = document.createElement('div');
      dot.className = 'ripple-dot';
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      document.body.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
      setTimeout(() => dot.remove(), 1200); /* 兜底 */
    }, { passive: true });
  }

  /* ---------- 滚动浮现（视口外的区块滚到时再浮现） ---------- */
  function injectReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) return;
    const targets = Array.from(document.querySelectorAll('main > section'))
      .filter(el => el.getBoundingClientRect().top > window.innerHeight);
    if (!targets.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('reveal-in');
        en.target.classList.remove('reveal-init');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    targets.forEach(el => {
      el.classList.remove('fade-up'); /* 改走滚动浮现，避免进场时已空放过动画 */
      el.classList.add('reveal-init');
      io.observe(el);
    });
  }

  /* ---------- 导航与页脚注入 ---------- */
  const TABS = [
    { id: 'home', name: '首页', icon: '☖', href: 'index.html' },
    { id: 'qian', name: '问签', icon: '☴', href: 'qian.html' },
    { id: 'today', name: '今日', icon: '☀', href: 'today.html' },
    { id: 'deng', name: '心灯', icon: '🕯', href: 'deng.html' },
    { id: 'me', name: '我的', icon: '◉', href: 'me.html' }
  ];

  function injectChrome() {
    const page = document.body.dataset.page || '';
    const nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.innerHTML = TABS.map(t =>
      '<a href="' + t.href + '" class="' + (t.id === page ? 'on' : '') + '">' +
      '<span class="ti">' + t.icon + '</span>' + t.name + '</a>'
    ).join('');
    document.body.appendChild(nav);

    const foot = document.createElement('footer');
    foot.className = 'sitefoot';
    foot.innerHTML = '问心阁 · 不问鬼神，只问本心<br>' +
      '本站内容仅作传统文化与心境调适参考，不构成医疗、法律、投资等任何专业建议。';
    const main = document.querySelector('main');
    if (main) main.appendChild(foot);
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureUser();
    injectLiquidBg();
    injectRipple();
    injectChrome();
    injectReveal();
  });

  /* ---------- 暴露全局 ---------- */
  window.WXG = {
    Store, Light, toast, modal,
    user: ensureUser, todayStr, daySeed, seededPick,
    checkin, checkedInToday
  };
})();
