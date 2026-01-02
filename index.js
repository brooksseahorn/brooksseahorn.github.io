// Vanilla JS rewrite: generate the report client-side, type it once, then re-type only numbers every 15s.
(function() {
  function boot() {
    const consoleEl = document.getElementById('console');
    if (!consoleEl) return; // safety

    // --- Utilities ---
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const pad2 = (n) => n.toString().padStart(2, '0');

  // --- Data generation according to user constraints ---
  function generateSnapshot() {
    const queueDepth = randInt(100, 500);
    const velocity = randInt(100, 300); // jobs/minute

    const nodes = Array.from({ length: 9 }, (_, i) => {
      const name = `node${pad2(i)}`;
      return {
        name,
        cpu: randInt(10, 100),
        mem: randInt(10, 100),
        gpu: randInt(10, 100),
      };
    });

    const controller = {
      cpu: randInt(10, 50),
      mem: randInt(10, 50),
      threads: randInt(1, 16),
      dbdAgents: randInt(0, 3),
      rpcLoad: choice(['low', 'medium', 'high'])
    };

    // Sensible defaults + relationship: completed >= failed + cancelled
    let completed = randInt(800, 5000);
    let failed = randInt(5, 80);
    let cancelled = randInt(1, 50);
    if (completed < failed + cancelled) completed = failed + cancelled + randInt(50, 200);

    const messages = pickMessages(3);

    return {
      queueDepth,
      velocity,
      nodes,
      controller,
      jobs: { completed, failed, cancelled },
      messages
    };
  }

  function pickMessages(n) {
    const pool = [
      'Backfill: evaluating pending set; estimated next start within 10–20s.',
      'slurmctld: RPC backlog medium; monitoring retry latency.',
      'healthcheck: node04 reporting GPU Xid event; auto‑drain queued if repeated.',
      'acct_gather_energy: sampling enabled (60s).',
      'priority: fair‑share adjusted for user cohort; queue reordering applied.',
      'slurmdbd: connection healthy; agent backlog 0.',
      'licenses: 3 jobs waiting for feature tokens; retry scheduled.',
      'preemptor: no candidates at this time; soft preemption disabled.'
    ];
    const copy = pool.slice();
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }

  // --- HTML assembly (preserves existing structure/markup) ---
  function buildReportHTML(d) {
    const nodeLines = d.nodes.map(n => {
      const hot = (n.cpu > 90 || n.gpu > 90) ? ' hot' : '';
      return (
        `<tab class=\"node-line${hot}\" data-node=\"${n.name}\">${n.name}: ` +
        `<span class=\"metric\" data-key=\"${n.name}-cpu\">${n.cpu}</span>% CPU, ` +
        `<span class=\"metric\" data-key=\"${n.name}-mem\">${n.mem}</span>% MEM, ` +
        `<span class=\"metric\" data-key=\"${n.name}-gpu\">${n.gpu}</span>% GPU</tab>`
      );
    }).join('');

    const body = [
      '<h1>Zeehäun Cluster Status...</h1>',
      '',
      '<interesante>',
      `  <p>Queue is <span class="metric" data-key="queue">${d.queueDepth}</span> jobs deep...` +
      `Velocity <span class="metric" data-key="velocity">${d.velocity}</span> jobs/minute</p>`,
      '  <p>Node status:</p>',
      `  ${nodeLines}`,
      `  <tab>ctrl1: <span class="metric" data-key="ctrl1-cpu">${d.controller.cpu}</span>% CPU, ` +
      `<span class="metric" data-key="ctrl1-mem">${d.controller.mem}</span>% MEM, ` +
      `<span class="metric" data-key="ctrl1-threads">${d.controller.threads}</span> threads, ` +
      `<span class="metric" data-key="ctrl1-dbdAgents">${d.controller.dbdAgents}</span> DBD agent, ` +
      `${d.controller.rpcLoad} RPC</tab>`,
      '',
      '  <p>Last 24h job stats:</p>',
      `  <tab>Completed: <span class="metric" data-key="jobs-completed">${d.jobs.completed}</span></tab>`,
      `  <tab>Failed: <span class="metric" data-key="jobs-failed">${d.jobs.failed}</span></tab>`,
      `  <tab>Cancelled: <span class="metric" data-key="jobs-cancelled">${d.jobs.cancelled}</span></tab>`,
      '</interesante>',
      '',
      '<h2></h2>',
      ...d.messages.map(m => `
<p>${m}</p>`),
      '',
      '<h3>....phewtat</h3>',
      '<p>End of report.</p>',
      '<p class="timestamp-line">Last updated: <span id="timestamp"></span></p>',
      '\n\n'
    ].join('\n');

    return body;
  }

  // --- Typewriter effects ---
  const typeSpeedChars = 3; // chars per tick
  const typeTickMs = 30;

  function typeHTMLInto(target, html, onDone) {
    let i = 0;
    const len = html.length;
    const timer = setInterval(() => {
      i = Math.min(len, i + typeSpeedChars);
      target.innerHTML = html.slice(0, i);
      window.scrollTo(0, document.body.scrollHeight);
      if (i >= len) {
        clearInterval(timer);
        onDone && onDone();
      }
    }, typeTickMs);
  }

  function retype(el, newText, charMs = 15) {
    const oldText = el.textContent;
    if (oldText === newText) return;
    let i = oldText.length;
    function backspace() {
      if (i > 0) {
        el.textContent = oldText.slice(0, --i);
        setTimeout(backspace, charMs);
      } else {
        typeForward(0);
      }
    }
    function typeForward(j) {
      if (j < newText.length) {
        el.textContent += newText[j];
        setTimeout(() => typeForward(j + 1), charMs);
      } else {
        el.textContent = newText; // finalize
      }
    }
    backspace();
  }

  // --- Update cycle (numbers only) ---
  function valueForKey(snapshot, key) {
    if (key === 'queue') return String(snapshot.queueDepth);
    if (key === 'velocity') return String(snapshot.velocity);
    if (key.startsWith('jobs-')) {
      const k = key.split('-')[1];
      return String(snapshot.jobs[k]);
    }
    if (key.startsWith('ctrl1-')) {
      const k = key.split('-')[1];
      return String(snapshot.controller[k]);
    }
    if (key.startsWith('node')) {
      const [node, metric] = key.split('-');
      const name = node; // e.g., node00
      const n = snapshot.nodes.find(x => x.name === name);
      return n ? String(n[metric]) : '';
    }
    return '';
  }

  function updateTimestamp() {
    const el = document.getElementById('timestamp');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toISOString(); // ISO 8601 in UTC (e.g., 2026-01-02T04:29:15.000Z)
  }

  function schedulePeriodicUpdates() {
    // Set timestamp immediately (do not change numbers yet)
    updateTimestamp();
    setInterval(() => {
      const next = generateSnapshot();
      document.querySelectorAll('.metric').forEach(el => {
        const key = el.getAttribute('data-key');
        const val = valueForKey(next, key);
        if (val !== '') retype(el, val);
      });
      // Update node line hot/highlight class based on CPU/GPU > 90
      next.nodes.forEach(n => {
        const line = document.querySelector(`tab[data-node="${n.name}"]`);
        if (!line) return;
        if (n.cpu > 90 || n.gpu > 90) line.classList.add('hot');
        else line.classList.remove('hot');
      });
      updateTimestamp();
    }, 15000);
  }

  // --- Boot ---
  const first = generateSnapshot();
  const html = buildReportHTML(first);
  typeHTMLInto(consoleEl, html, schedulePeriodicUpdates);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
