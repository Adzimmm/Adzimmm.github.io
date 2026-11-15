// Every piece of site text in one place. app.js applies it to [data-c] elements and the About,
// Contact and footer blocks. The admin page edits this same shape in Supabase (row "site");
// this file is the fallback when Supabase is not set up or does not answer.
// In "gallery.note", **words** become bold.
window.SITE = {
  meta: {
    title: "Adzim's Portfolio",
    description: "Adzim's portfolio — UUM Multimedia student: logos, branding, social media, print and UI/UX.",
  },
  brand: { name: 'adzim', suffix: '.portfolio' },
  nav: { home: 'Home', about: 'About', education: 'Education', experience: 'Experience', projects: 'Projects', resume: 'Resume' },
  hero: {
    hi: "Hi, I'm",
    name: 'Adzim.',
    title: 'Welcome to my Portfolio',
    intro: 'This is where I keep my work from static design to stories that move.',
    searchPlaceholder: 'Tanya je pape kau nak',
    searchHint: 'to ask',
    seeMore: 'See More',
  },
  gallery: { note: 'A quick look at **my work**,\nfrom **logos to social media campaigns.**' },
  about: {
    title: 'About Me',
    cardTitle: "Hi, I'm Adzim.",
    body: 'My full name is Ahmad Zaid Adzim bin Abdul Rahim. Passionate about learning, with a strong affinity for minimalist aesthetics and visual communication. Constantly creative and evolving to turn complex ideas into clean, impactful digital experiences.',
    availability: 'Currently interning at Wiser.MY · 21 Sep 2026 – 21 Jan 2027',
    languagesTitle: 'Languages',
    languages: [
      { name: 'Bahasa Melayu', level: 'Native' },
      { name: 'English', level: 'Intermediate, working proficiency' },
    ],
    softwareTitle: 'Software',
    // level: 1 Basic, 2 Intermediate, 3 Advanced (drives the bar).
    software: [
      { name: 'Adobe Photoshop', level: 3 },
      { name: 'Adobe Illustrator', level: 3 },
      { name: 'Adobe InDesign', level: 3 },
      { name: 'Canva', level: 3 },
      { name: 'CapCut', level: 3 },
      { name: 'Figma', level: 2 },
      { name: 'DaVinci Resolve', level: 2 },
      { name: 'Adobe Premiere Pro', level: 1 },
    ],
    fieldsTitle: 'Fields',
    fields: ['Graphic design', 'UI/UX', 'Motion graphic', 'Videography', 'Photography'],
  },
  education: { title: 'Education' },
  experience: { title: 'Experience', workTitle: 'Work, curricular & leadership', awardsTitle: 'Awards & certificates' },
  projects: {
    title: 'Projects',
    sub: 'Lorem Ipsum',
    cta: 'View gallery',
    emptyTitle: 'No work matches that.',
    emptyText: 'Try another keyword or view all categories.',
    emptyButton: 'Reset search & filter',
  },
  contact: {
    line: 'Every visual has a story',
    sub: "Have a project, idea or collaboration? Let's talk.",
    email: 'ahmadzaidadzim.work@gmail.com',
    linkedin: 'https://www.linkedin.com/in/ahmad-zaid-adzim',
    instagram: 'adzimmm01',
  },
  footer: { tagline: 'Design & video portfolio', copyright: '© 2026 Adzim' },
  resume: { dialogTitle: 'Adzim — Resume', download: 'Download PDF', pdfName: 'Resume ADZIM.pdf' },
};
