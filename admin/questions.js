// "Questions visitors asked" in the FAQ & chat tab: what people typed in the site's chatbox
// (table "chat_questions", see supabase/chat-questions.sql). The Worker saves each question with the chat's
// answer and whether the site's content had that answer. The same question asked again is shown once with a
// count; questions without an answer come first, with a button that turns them into an FAQ entry.

const LIMIT = 1000; // newest questions read from Supabase
const SHOW = 12;    // questions shown before "Show more"
let cache = null;   // { rows, at }: kept while the admin is open, so redrawing the tab does not reload

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const plain = s => String(s || '').replace(/\*\*(.+?)\*\*/g, '$1');

const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const clock = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); // 9:14 PM
function when(d, now = new Date()) {
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const today = dayStart(now);
  if (d >= today) return `today, ${clock(d)}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d >= yesterday) return `yesterday, ${clock(d)}`;
  return `on ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' })}`;
}

// Rows come newest first, so each group keeps the wording, answer and state of its latest ask.
function group(rows) {
  const map = new Map();
  rows.forEach(r => {
    const key = norm(r.question);
    if (!key) return;
    let g = map.get(key);
    if (!g) map.set(key, g = { question: r.question, answer: r.answer, answered: r.answered, last: new Date(r.asked_at), ids: [] });
    g.ids.push(r.id);
  });
  return [...map.values()].sort((a, b) => b.ids.length - a.ids.length || b.last - a.last);
}

export function mountQuestions(root, { h, ico, ask, toast, sb, DEMO, inFaq, addToFaq }) {
  const st = { filter: null, shown: SHOW, busy: false, error: '' };
  if (cache) draw();
  else load();

  async function load() {
    st.busy = true;
    if (cache) draw();
    try {
      let rows;
      if (DEMO) rows = demoRows();
      else {
        const { data, error } = await sb.from('chat_questions').select('id,asked_at,question,answer,answered')
          .order('asked_at', { ascending: false }).limit(LIMIT);
        if (error) throw new Error(error.message);
        rows = data;
      }
      cache = { rows, at: new Date() };
      st.error = '';
    } catch (err) {
      st.error = err.message || String(err);
    }
    st.busy = false;
    draw();
  }

  function draw() {
    if (!cache) {
      const setup = /chat_questions|relation|schema cache/i.test(st.error);
      root.replaceChildren(
        h('p', { class: 'notice faq-note' }, ico('info'), h('span', {}, setup
          ? 'Saving questions is not set up yet: run supabase/chat-questions.sql in the Supabase SQL Editor.'
          : `Questions could not load: ${st.error}`)),
        h('div', {}, h('button', { class: 'btn small', type: 'button', onclick: load }, ico('refresh'), 'Try again')));
      return;
    }
    const groups = group(cache.rows);
    const open = groups.filter(g => !g.answered);
    if (st.filter === null) st.filter = open.length ? 'open' : 'all';
    const list = st.filter === 'open' ? open : groups;
    const tabs = [['open', `No answer (${open.length})`], ['all', `All (${groups.length})`]];
    root.replaceChildren(...[
      h('div', { class: 'ins-filters' },
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Which questions' }, tabs.map(([key, label]) => h('button', {
          type: 'button',
          'aria-pressed': String(st.filter === key),
          onclick: () => { if (st.filter !== key) { Object.assign(st, { filter: key, shown: SHOW }); draw(); } },
        }, label))),
        h('button', { class: 'btn small ghost', type: 'button', disabled: st.busy, onclick: load }, ico('refresh'), st.busy ? 'Loading…' : 'Refresh'),
        h('span', { class: 'ins-updated' }, `Updated ${clock(cache.at)}`)),
      st.error ? h('p', { class: 'muted' }, `Could not refresh: ${st.error}`) : null,
      list.length
        ? h('ol', { class: 'qs-list' }, list.slice(0, st.shown).map(item))
        : h('p', { class: 'empty' }, groups.length
          ? 'Every question so far had an answer.'
          : 'No questions yet. What visitors type in the chatbox shows up here.'),
      list.length > st.shown
        ? h('div', {}, h('button', { class: 'btn small', type: 'button', onclick: () => { st.shown += SHOW * 2; draw(); } }, `Show more (${list.length - st.shown})`))
        : null,
      h('p', { class: 'qs-note' }, ico('info'), h('span', {},
        'Saved without IP addresses and deleted after 13 months. Greetings are not saved, nor questions from your own devices (Insights › Your own visits).')),
    ].filter(Boolean)); // replaceChildren would show a null as the text "null"
  }

  function item(g) {
    const n = g.ids.length;
    return h('li', { class: 'qs-item' },
      h('div', {},
        h('p', { class: 'qs-q' }, g.question),
        h('p', { class: 'qs-meta' },
          h('span', { class: `qs-state${g.answered ? '' : ' no'}` }, g.answered ? 'Answered' : 'No answer'),
          h('span', {}, n > 1 ? `Asked ${n} times, last ${when(g.last)}` : `Asked ${when(g.last)}`))),
      h('div', { class: 'qs-actions' },
        inFaq(g.question)
          ? h('span', { class: 'qs-added' }, ico('check'), 'In FAQ')
          : h('button', { class: `btn small${g.answered ? '' : ' primary'}`, type: 'button', onclick: () => addToFaq(g.question) }, ico('plus'), 'Add to FAQ'),
        h('button', { class: 'icon-btn danger', type: 'button', title: 'Delete', 'aria-label': `Delete the question “${g.question}”`, onclick: () => remove(g) }, ico('trash'))),
      g.answer ? h('details', { class: 'qs-answer' }, h('summary', {}, 'The chat’s answer'), h('p', {}, plain(g.answer))) : null);
  }

  async function remove(g) {
    const n = g.ids.length;
    const ok = await ask({
      title: 'Delete this question?',
      text: `“${g.question}”${n > 1 ? `, asked ${n} times,` : ''} will be removed from this list. This cannot be undone.`,
      ok: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      if (!DEMO) {
        const { data, error } = await sb.from('chat_questions').delete().in('id', g.ids).select('id');
        if (error) throw new Error(error.message);
        if (!data.length) throw new Error('Nothing was deleted. Log in again, then try once more.');
      }
      cache.rows = cache.rows.filter(r => !g.ids.includes(r.id));
      toast(n > 1 ? `Question deleted (asked ${n} times).` : 'Question deleted.');
      draw();
    } catch (err) {
      toast(err.message, true);
    }
  }
}

// Demo mode (localhost ?demo): made-up questions so the list can be tried without Supabase.
function demoRows() {
  const now = Date.now();
  const sample = [
    ['How much do you charge for a logo?', false, 'I don’t have that information. You can email me at hello@example.com and I’ll reply myself.', 6, 30],
    ['Are you available for freelance work?', true, 'Yes, I’m **open for freelance work**. Email me at hello@example.com with what you need.', 5, 4],
    ['Boleh buat logo untuk kedai saya?', true, 'Boleh! Saya buat **logo dan branding**. Tengok folder **Logo Folio**, lepas tu emel saya di hello@example.com.', 4, 50],
    ['Do you do wedding photography?', false, 'I don’t have that information. You can email me at hello@example.com for more details.', 3, 200],
    ['Where did you study?', true, 'I study **Multimedia** at Universiti Utara Malaysia (UUM).', 2, 1500],
    ['Boleh tak buat website?', false, 'Saya tiada maklumat tentang itu. Awak boleh emel saya di hello@example.com.', 2, 2900],
    ['What software do you use?', true, 'Mostly **Adobe Photoshop**, **Illustrator** and **InDesign**, plus Canva and CapCut.', 1, 4400],
    ['Can you edit videos for TikTok?', false, 'I don’t have that information. You can email me at hello@example.com.', 1, 7000],
  ];
  const rows = [];
  let id = 1;
  sample.forEach(([question, answered, answer, times, minsAgo]) => {
    for (let i = 0; i < times; i++) {
      rows.push({ id: id++, asked_at: new Date(now - (minsAgo + i * 1440 * 2) * 60000).toISOString(), question, answer, answered });
    }
  });
  return rows.sort((a, b) => b.asked_at.localeCompare(a.asked_at));
}
