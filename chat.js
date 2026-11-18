// Chatbox for the hero search: pressing Enter in the search opens it with the question as the first message.
// No AI and no server. Answers come from the FAQ written in the admin page (site.faq) first, then from the
// site's own content: contact, availability, resume, education, experience, awards, software, languages,
// location, About and the project folders.
// app.js calls PortfolioChat.init() once the content is loaded and PortfolioChat.open() on search Enter.
// On phones and tablets the round chat button also shows from the start, so the chat is always one tap away.
(() => {
  'use strict';

  let ctx = null; // { site, projects, resume, icon(p), color(p), label(p) } from app.js
  let panel = null;
  let log = null;
  let input = null;
  let launcher = null;
  const asked = new Set();
  const root = document.documentElement;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const narrow = window.matchMedia('(max-width: 640px)');
  // No "Type / to ask" hint here (style.css hides it up to 700px; touch screens have no / key), so the round
  // button shows from the start instead of only after the first chat.
  const noHint = window.matchMedia('(max-width: 700px), (hover: none)');

  /* ---------- Text set in the admin (site.chat), with defaults for empty fields ---------- */
  const DEFAULTS = {
    title: 'Ask Adzim',
    subtitle: 'Quick answers about my work',
    greeting: 'Hi! Ask me about my work, skills, studies or how to reach me.',
    placeholder: 'Ask a question…',
    fallback: "I don't have an answer for that yet. Try one of these, or email me and I'll reply myself.",
  };
  function copy() {
    const saved = (ctx && ctx.site.chat) || {};
    return Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, typeof saved[k] === 'string' && saved[k].trim() ? saved[k] : v]));
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // **bold**, line breaks and clickable links and emails; everything else is escaped.
  const rich = value => esc(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
    .replace(/(^|[\s(>])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g, '$1<a href="mailto:$2">$2</a>')
    .replace(/\n/g, '<br>');
  const safeHref = href => (/^(https?:|mailto:|#)/i.test(String(href)) ? String(href) : '#');

  /* ---------- Understanding a question: words, stop words, simple stems ---------- */
  const STOP = new Set((
    'a an the is are am was were be been being do does did done you your yours u ur i im me my mine we our us it its to of in on at for '
    + 'and or with what whats how can could would will should about any some this that these those there here have has had please pls '
    + 'tell show give let know want like so just also if then than as by into get got see more much many very really '
    + 'apa ke di yang dan ini itu tu ni saya sy aku awak kau anda korang dia kami kita boleh tak x ada nak nk dengan untuk utk pada je '
    + 'jer ja la lah pun kah ya tidak bagaimana macam mcm camne mana berapa sikit tolong bagi beri kat tengok'
  ).split(' '));
  const GREET = new Set('hi hello hey hai helo hye hiya yo hola salam assalamualaikum asalamualaikum waalaikumsalam morning afternoon evening good'.split(' '));
  const THANKS = new Set('thanks thank thx ty tq tqvm terima kasih tenkiu'.split(' '));

  const words = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  function stem(w) {
    if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
    if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
    if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
    if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    if (w.length > 6 && /(nya|kan)$/.test(w)) return w.slice(0, -3);
    return w;
  }
  const terms = value => [...new Set(words(value).filter(w => w.length > 1 && !STOP.has(w) && !GREET.has(w)).map(stem))];
  const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const padded = list => ` ${list.join(' ')} `;

  /* ---------- Answers built from the site's own content ---------- */
  const LEVELS = ['', 'Basic', 'Intermediate', 'Advanced'];
  const level = n => LEVELS[Math.min(3, Math.max(1, Number(n) || 1))];
  const noDot = s => String(s || '').trim().replace(/[.\s]+$/, '');
  const byStartDesc = (a, b) => String(b.start || '').localeCompare(String(a.start || ''));
  const contact = () => ctx.site.contact || {};
  const about = () => ctx.site.about || {};

  function contactActions(emailOnly) {
    const c = contact();
    const out = [];
    if (c.email) out.push({ kind: 'link', label: 'Email me', href: `mailto:${c.email}` });
    if (emailOnly) return out;
    if (c.linkedin) out.push({ kind: 'link', label: 'LinkedIn', href: c.linkedin, external: true });
    if (c.instagram) {
      const handle = String(c.instagram).replace(/^@/, '');
      out.push({ kind: 'link', label: 'Instagram', href: `https://www.instagram.com/${encodeURIComponent(handle)}`, external: true });
    }
    return out;
  }

  // Work folders whose text matches the most of the given words.
  function projectHits(list) {
    if (!list.length) return [];
    const scored = ctx.projects.map(p => {
      const hay = terms(`${p.title} ${p.desc || ''} ${ctx.label(p)} ${(p.sections || []).map(s => s.title).join(' ')}`);
      return { p, hits: list.filter(t => hay.some(k => same(t, k))).length };
    }).filter(x => x.hits);
    const top = Math.max(0, ...scored.map(x => x.hits));
    return scored.filter(x => x.hits === top).map(x => x.p);
  }
  const folderActions = list => list.slice(0, 7).map(p => ({ kind: 'project', p }));

  // Each topic: the words that point to it, whole phrases that settle a tie, and the answer.
  const TOPICS = [
    {
      words: 'contact contacts email emel mail reach message phone number call whatsapp wa instagram ig linkedin hubungi telefon nombor mesej talk inquiry enquiry touch',
      phrases: ['get in touch', 'reach you', 'talk to you'],
      answer: () => {
        const c = contact();
        if (!c.email) return null;
        const more = ['LinkedIn', 'Instagram'].filter(n => c[n.toLowerCase()]);
        return { text: `You can email me at ${c.email}.${more.length ? ` I'm also on ${more.join(' and ')}.` : ''}`, actions: contactActions() };
      },
    },
    {
      words: 'available availability free hire hiring freelance freelancer commission order orders book booking collab collaborate collaboration opportunity opening vacancy kosong upah tempah',
      phrases: ['work with you', 'work together', 'open for', 'open to'],
      answer: () => {
        const lines = [noDot(about().availability) && `${noDot(about().availability)}.`, contact().sub, contact().email && `Email me at ${contact().email}.`].filter(Boolean);
        return lines.length ? { text: lines.join('\n'), actions: contactActions(true) } : null;
      },
    },
    {
      words: 'price prices pricing rate rates cost costs charge charges fee fees quote quotation budget package packages harga caj bayaran kos pakej',
      answer: () => (contact().email ? { text: `For prices and quotes, email me at ${contact().email} with what you need.`, actions: contactActions(true) } : null),
    },
    {
      words: 'resume cv curriculum vitae pdf download',
      answer: () => ({ text: 'Here is my resume. You can read it here or download the PDF.', actions: [{ kind: 'resume', label: 'Open resume' }] }),
    },
    {
      words: 'study studies education university uni degree diploma school college student course major cgpa gpa graduate belajar pendidikan universiti sekolah kolej pelajar kursus ijazah',
      phrases: ['where did you study', 'where do you study', 'what do you study'],
      answer: () => {
        const list = (ctx.resume.education || []).slice().sort(byStartDesc);
        return list.length ? {
          text: list.map(e => [`**${e.award}**`, [e.school, e.date].filter(Boolean).join(' · '), e.cgpa].filter(Boolean).join('\n')).join('\n\n'),
          actions: [{ kind: 'section', label: 'See Education', href: '#education' }],
        } : null;
      },
    },
    {
      words: 'experience job jobs career intern internship company companies employer role position pengalaman kerja praktikal latihan syarikat jawatan',
      phrases: ['where do you work', 'where are you working', 'work experience', 'worked at', 'working at'],
      answer: () => {
        const r = ctx.resume;
        const lines = [];
        const now = r.current;
        if (now && now.role && now.start) lines.push(`Right now: **${now.role}** at ${now.org}${now.date ? ` (${now.date})` : ''}.`);
        const past = (r.experience || []).slice().sort(byStartDesc).slice(0, 4);
        if (past.length) lines.push(`${lines.length ? 'Other experience:' : 'My experience:'}\n${past.map(e => `• **${e.role}**, ${[e.org, e.date].filter(Boolean).join(' · ')}`).join('\n')}`);
        return lines.length ? { text: lines.join('\n\n'), actions: [{ kind: 'section', label: 'See Experience', href: '#experience' }] } : null;
      },
    },
    {
      words: 'award awards certificate certificates certification certifications achievement achievements prize prizes competition anugerah sijil pencapaian pertandingan',
      answer: () => {
        const list = (ctx.resume.honors || []).slice().sort(byStartDesc).slice(0, 5);
        return list.length ? {
          text: `Awards & certificates:\n${list.map(h => `• **${h.title}**, ${[h.org, h.date].filter(Boolean).join(' · ')}`).join('\n')}`,
          actions: [{ kind: 'section', label: 'See all', href: '#experience' }],
        } : null;
      },
    },
    {
      words: 'skill skills software tool tools program programs app apps use used using adobe photoshop illustrator indesign premiere figma canva capcut davinci resolve field fields video videography motion photography kemahiran perisian guna aplikasi',
      answer: q => {
        const software = about().software || [];
        const scored = software.map(s => ({ s, n: terms(s.name).filter(t => q.terms.some(x => same(x, t))).length })).filter(x => x.n);
        const top = Math.max(0, ...scored.map(x => x.n));
        const named = scored.filter(x => x.n === top).map(x => x.s);
        if (named.length) return { text: `Yes! ${named.map(s => `**${s.name}** (${level(s.level)})`).join(', ')}.` };
        if (!software.length) return null;
        const fields = about().fields || [];
        return { text: `Software I use:\n${software.map(s => `• ${s.name}: ${level(s.level)}`).join('\n')}${fields.length ? `\n\nFields: ${fields.join(', ')}.` : ''}` };
      },
    },
    {
      words: 'language languages speak speaking english malay melayu bahasa inggeris',
      answer: () => {
        const list = about().languages || [];
        return list.length ? { text: list.map(l => `**${l.name}**: ${l.level}`).join('\n') } : null;
      },
    },
    {
      words: 'who yourself background introduce introduction name adzim bio story siapa diri pengenalan nama',
      phrases: ['about you', 'about yourself'],
      answer: () => (about().body ? { text: about().body, actions: [{ kind: 'section', label: 'About me', href: '#about' }] } : null),
    },
    {
      words: 'where based location located live living from city country area state lokasi tinggal duduk negeri asal',
      phrases: ['where are you based', 'where are you from', 'where are you located', 'where do you live'],
      answer: () => (ctx.resume.location ? { text: `I'm based in **${ctx.resume.location}**.` } : null),
    },
    {
      projects: true,
      words: 'project projects portfolio work works sample samples gallery folio category categories folder folders design designs service services karya projek hasil servis',
      phrases: ['your work', 'what do you do', 'what do you design'],
      answer: q => {
        const hits = projectHits(q.rest);
        const list = hits.length ? hits : ctx.projects;
        if (!list.length) return null;
        return {
          text: hits.length ? 'Here is the work that matches. Pick one to open it:' : `I have ${ctx.projects.length} categories of work. Pick one to open it:`,
          actions: folderActions(list),
        };
      },
    },
  ];
  TOPICS.forEach(t => { t.terms = terms(t.words); t.phrases = (t.phrases || []).map(p => padded(words(p))); });

  // The admin's FAQ entries, matched on the question and the extra words. They win a tie with a topic.
  // The whole question and each comma-separated extra (e.g. "how long") also count as phrases.
  function faqEntries() {
    return (ctx.site.faq || []).filter(f => f && String(f.q || '').trim() && String(f.a || '').trim())
      .map(f => ({
        faq: f,
        terms: terms(`${f.q} ${f.keywords || ''}`),
        phrases: [f.q, ...String(f.keywords || '').split(',')].map(p => words(p)).filter(w => w.length).map(padded),
        bonus: 0.15,
      }));
  }

  function score(entry, q) {
    const matched = q.terms.filter(t => entry.terms.some(k => same(t, k)));
    const phrase = entry.phrases.some(p => q.padded.includes(p));
    if (!matched.length && !phrase) return { s: 0, matched };
    const covered = entry.terms.filter(k => q.terms.some(t => same(t, k))).length / Math.max(1, entry.terms.length);
    return { s: matched.length / Math.max(1, q.terms.length) + (phrase ? 0.6 : 0) + (entry.bonus || 0) + covered * 0.05, matched };
  }

  function suggestions() {
    const builtIn = ['What do you design?', 'How can I contact you?', 'What software do you use?', 'Where did you study?'];
    const seen = new Set();
    return [...faqEntries().map(e => e.faq.q.trim()), ...builtIn]
      .filter(s => { const k = s.toLowerCase(); if (seen.has(k) || asked.has(k)) return false; seen.add(k); return true; })
      .slice(0, 4).map(label => ({ kind: 'ask', label }));
  }

  function respond(raw) {
    const all = words(raw);
    const q = { terms: terms(raw), padded: padded(all) };
    if (all.length && all.some(w => GREET.has(w)) && all.every(w => GREET.has(w) || STOP.has(w) || w === 'there' || w === 'adzim')) {
      return { text: copy().greeting, actions: suggestions(), small: true };
    }
    if (all.length <= 5 && all.some(w => THANKS.has(w))) return { text: "You're welcome! Anything else you'd like to know?", small: true };

    let best = null;
    [...faqEntries(), ...TOPICS].forEach(entry => {
      const r = score(entry, q);
      if (r.s > 0 && (!best || r.s > best.s)) best = { entry, ...r };
    });
    if (best && best.s >= 0.5) {
      const rest = q.terms.filter(t => !best.matched.includes(t));
      const reply = best.entry.faq ? { text: best.entry.faq.a } : best.entry.answer({ ...q, rest });
      if (reply) {
        // Folders that match the words the answer did not use, e.g. "can I contact you about a logo".
        const related = best.entry.projects ? [] : projectHits(rest).slice(0, 3);
        if (related.length) reply.actions = [...(reply.actions || []), ...folderActions(related)];
        return reply;
      }
    }
    const hits = projectHits(q.terms);
    if (hits.length) return { text: 'Here is the work that matches. Pick one to open it:', actions: folderActions(hits) };
    return { text: copy().fallback, actions: [...suggestions(), ...contactActions(true)] };
  }

  /* ---------- Panel ---------- */
  const SVG = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const ICONS = {
    close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
    send: SVG('<path d="M12 19V5m-6 6 6-6 6 6"/>'),
    chat: SVG('<path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-4A8 8 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" stroke-width="2.4"/>'),
  };

  function actionHtml(a) {
    switch (a.kind) {
      case 'project':
        return `<a class="chat-chip chat-folder" href="#project/${encodeURIComponent(a.p.id)}" data-open="${esc(a.p.id)}" style="--color:${esc(ctx.color(a.p))}">${ctx.icon(a.p)}<span>${esc(a.p.title)}</span></a>`;
      case 'resume':
        return `<button class="chat-chip" type="button" data-resume>${esc(a.label)}</button>`;
      case 'ask':
        return `<button class="chat-chip chat-suggest" type="button" data-ask="${esc(a.label)}">${esc(a.label)}</button>`;
      case 'section':
        return `<a class="chat-chip" href="${esc(safeHref(a.href))}" data-chat-nav>${esc(a.label)} <span aria-hidden="true">↓</span></a>`;
      default:
        return `<a class="chat-chip" href="${esc(safeHref(a.href))}"${a.external ? ' target="_blank" rel="noopener"' : ''}>${esc(a.label)}${a.external ? ' <span aria-hidden="true">↗</span>' : ''}</a>`;
    }
  }

  const smooth = () => (root.dataset.motion === 'off' ? 'auto' : 'smooth');
  function message(cls, html) {
    const el = document.createElement('div');
    el.className = `msg ${cls}`;
    el.innerHTML = html;
    log.append(el);
    return el;
  }
  function addUser(value) {
    message('user', `<div class="bubble">${esc(value)}</div>`);
    log.scrollTo({ top: log.scrollHeight, behavior: smooth() });
  }
  function addBot(reply) {
    const actions = reply.actions || [];
    const el = message('bot', `<div class="bubble">${rich(reply.text)}</div>${actions.length ? `<div class="chat-actions">${actions.map(actionHtml).join('')}</div>` : ''}`);
    // Long answers start at their first line; short ones simply land at the bottom.
    log.scrollTo({ top: el.offsetTop - 12, behavior: smooth() });
  }
  function addTyping() {
    const el = message('bot typing', '<div class="bubble"><i></i><i></i><i></i></div>');
    el.setAttribute('aria-hidden', 'true');
    log.scrollTo({ top: log.scrollHeight, behavior: smooth() });
    return el;
  }

  /* ---------- AI answers (Cloudflare Worker in /worker), built-in answers as the fallback ---------- */
  // The Worker answers only from the content saved in the admin. Empty url = built-in answers only.
  const AI_URL = String((window.SUPABASE && window.SUPABASE.chatUrl) || '').replace(/\/$/, '');
  const history = [];
  async function aiReply(question) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: history.slice(-6) }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = String((data && data.answer) || '').trim();
      if (!text) return null;
      // Folders the answer names get their button, like the built-in answers.
      const named = ctx.projects.filter(p => p.title && text.toLowerCase().includes(String(p.title).toLowerCase()));
      return { text, actions: folderActions(named) };
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  const pause = ms => new Promise(r => setTimeout(r, ms));
  async function ask(value) {
    const question = String(value || '').trim().slice(0, 300);
    if (!question) return;
    asked.add(question.toLowerCase());
    addUser(question);
    const local = respond(question);
    const typing = addTyping();
    const wait = root.dataset.motion === 'off' ? 120 : 420 + Math.min(480, question.length * 6);
    const started = Date.now();
    const reply = (AI_URL && !local.small && await aiReply(question)) || local;
    await pause(Math.max(0, wait - (Date.now() - started)));
    typing.remove();
    addBot(reply);
    history.push({ role: 'user', text: question }, { role: 'bot', text: reply.text });
  }

  function build() {
    const t = copy();
    const photo = ctx.resume && ctx.resume.photo;
    const letter = `<span class="chat-avatar chat-avatar-letter" aria-hidden="true">${esc(String((ctx.site.brand && ctx.site.brand.name) || 'a').charAt(0))}</span>`;
    panel = document.createElement('section');
    panel.className = 'chat';
    panel.hidden = true;
    panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'chat-title');
    panel.innerHTML = `
      <header class="chat-head">
        ${photo ? `<img class="chat-avatar" src="${esc(photo)}" alt="" width="40" height="40" decoding="async">` : letter}
        <div class="chat-who"><h2 class="chat-title" id="chat-title">${esc(t.title)}</h2><p class="chat-sub">${esc(t.subtitle)}</p></div>
        <button class="chat-close" type="button" aria-label="Close chat">${ICONS.close}</button>
      </header>
      <div class="chat-log" role="log" aria-live="polite"></div>
      <form class="chat-form">
        <label class="visually-hidden" for="chat-input">Your question</label>
        <input id="chat-input" type="text" enterkeyhint="send" autocomplete="off" maxlength="300" placeholder="${esc(t.placeholder)}">
        <button class="chat-send" type="submit" aria-label="Send">${ICONS.send}</button>
      </form>`;
    launcher = document.createElement('button');
    launcher.className = 'chat-launcher';
    launcher.type = 'button';
    launcher.hidden = true;
    launcher.setAttribute('aria-label', 'Open chat');
    launcher.innerHTML = ICONS.chat;
    document.body.append(panel, launcher);

    log = panel.querySelector('.chat-log');
    input = panel.querySelector('#chat-input');
    const avatar = panel.querySelector('img.chat-avatar');
    if (avatar) avatar.addEventListener('error', () => { avatar.outerHTML = letter; }, { once: true });

    panel.querySelector('.chat-close').addEventListener('click', close);
    panel.querySelector('.chat-form').addEventListener('submit', e => {
      e.preventDefault();
      const value = input.value;
      input.value = '';
      ask(value);
    });
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    // Folders ([data-open]) and the resume ([data-resume]) are opened by app.js, like everywhere else on the page.
    log.addEventListener('click', e => {
      const suggestion = e.target.closest('[data-ask]');
      if (suggestion) {
        ask(suggestion.dataset.ask);
        if (finePointer.matches) input.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest('[data-chat-nav]') && narrow.matches) close(); // the panel covers most of a phone screen
    });
    launcher.addEventListener('click', () => open());
  }

  // The round button, without opening the chat. The class leaves room for it under the footer.
  function showButton() {
    if (!ctx || !noHint.matches) return;
    if (!panel) build();
    if (panel.hidden) launcher.hidden = false;
    root.classList.add('has-chat-button');
  }

  function open(question = '') {
    if (!ctx) return;
    if (!panel) build();
    const wasOpen = !panel.hidden;
    if (!wasOpen) {
      panel.hidden = false;
      launcher.hidden = true;
      void panel.offsetWidth; // start the opening transition from the closed state
      panel.classList.add('is-open');
    }
    if (question) ask(question);
    else if (!log.children.length) addBot({ text: copy().greeting, actions: suggestions() });
    // Phones: keep the keyboard down so the answer is visible; the visitor taps the field to type.
    if (finePointer.matches) input.focus({ preventScroll: true });
    else if (!wasOpen) panel.focus({ preventScroll: true });
  }

  function close() {
    if (!panel || panel.hidden) return;
    panel.classList.remove('is-open');
    launcher.hidden = false;
    root.classList.add('has-chat-button');
    launcher.focus({ preventScroll: true });
    const hide = () => { if (!panel.classList.contains('is-open')) panel.hidden = true; };
    if (root.dataset.motion === 'off') hide();
    else setTimeout(hide, 280);
  }

  window.PortfolioChat = {
    init(options) {
      ctx = options;
      showButton();
      noHint.addEventListener('change', showButton);
    },
    open,
    close,
  };
})();
