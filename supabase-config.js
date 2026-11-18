// Supabase project used by the site (read) and the admin page (write).
// Both values are public by design: writes are protected by the database rules in supabase/setup.sql.
// Leave them empty and the site simply uses the bundled content files.
window.SUPABASE = {
  url: 'https://kizpexgoqssuxoclpozy.supabase.co',
  anonKey: 'sb_publishable_3BinoAREe_T6hg_rD3U-ZA_oYpIP-4z', // publishable (public) key
  // AI answers for the chatbox (Cloudflare Worker in /worker). Empty = built-in answers only.
  chatUrl: 'https://portfolio-chat.ahmadzaidadzim-work.workers.dev',
  // Visit counter for the admin's Insights tab (same Worker, see dist/visit.js). Empty = no counting.
  visitUrl: 'https://portfolio-chat.ahmadzaidadzim-work.workers.dev/visit',
};
