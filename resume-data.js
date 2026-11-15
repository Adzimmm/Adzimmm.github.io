// Resume content, copied from Adzim's resume PDF (resume.pdf). Shared by the Education,
// Awards and Experience timelines and the resume preview. Phone numbers stay out on purpose.
window.RESUME = {
  name: 'Ahmad Zaid Adzim bin Abdul Rahim',
  location: 'Kuala Lumpur, Malaysia',
  email: 'ahmadzaidadzim.work@gmail.com',
  linkedin: 'https://www.linkedin.com/in/ahmad-zaid-adzim',
  linkedinLabel: 'www.linkedin.com/in/ahmad-zaid-adzim',
  photo: 'assets/resume/photo.webp',
  qr: 'assets/resume/qr-linkedin.png',
  pdf: 'resume.pdf',
  availability: 'Availability: 21 September 2026 - 21 January 2027 (4 months internship)',

  education: [
    { school: 'Universiti Utara Malaysia (UUM), Kedah', award: 'Bachelor of Science with Honours (Multimedia)',
      cgpa: 'Current CGPA: 3.44', date: '2023 – Present', start: '2023',
      logo: 'assets/uum-light-sm.webp', logoDark: 'assets/uum-dark-sm.webp', logoW: 640, logoH: 268 },
    { school: 'Kolej Vokasional Alor Setar, Kedah', award: 'Diploma in Information Technology',
      cgpa: 'CGPA: 3.67', date: '2017 – 2022', start: '2017',
      logo: 'assets/resume/kv-logo-sm.webp', logoW: 640, logoH: 146 },
  ],

  interests: ['Learning & Development', 'Visual Communication', 'Education', 'Graphic Design', 'Motion Graphic',
    'Photography', 'Videography', 'UI/UX', 'Content Creation', 'Gamification'],

  // Shown on the site's Experience timeline only (not part of the PDF).
  current: { role: 'Internship', org: 'Wiser.MY', date: '21 Sep 2026 – 21 Jan 2027', start: '2026-09', points: [] },

  // Same order as the PDF.
  experience: [
    { role: 'Industrial Training (Diploma)', org: 'Darulaman Media & Events Sdn Bhd, Alor Setar', date: 'Mar 2021 - Jul 2021', start: '2021-03',
      points: ['Assisted in the setup and operation of recording studio equipment for official filming sessions with state government representatives.'] },
    { role: 'IT Technician', org: 'Bintang Security Sdn. Bhd.', date: 'Jul 2022 - Aug 2022', start: '2022-07',
      points: ['Conducted routine system maintenance, firmware updates, and faulty hardware replacements to maintain high-quality surveillance performance for clients.'] },
    { role: 'Freelance Graphic Designer', org: 'Self-employed / Various Clients', date: 'Jul 2021 – Present', start: '2021-07',
      points: ['Designed promotional materials and event banners on an ad-hoc basis for local clients and community organizations.'] },
    { role: 'Student Representative Council (MPP) 24/25', org: 'Universiti Utara Malaysia (UUM)', date: 'Nov 2024 - Nov 2025', start: '2024-11',
      points: ['Acted as liaison between students and university management to address student concerns and policy matters.',
        'Represented students in official university engagements and consultations.',
        'Managed multimedia content and campaigns to support student empowerment programs and council visibility.',
        'Contributed to human capital development and unity-building initiatives to foster stronger student community engagement.'] },
    { role: 'Vice Exco Multimedia, Multimedia Club 24/25', org: 'Universiti Utara Malaysia (UUM)', date: 'Oct 2023 - Oct 2024', start: '2023-10',
      points: ['Creative and detail-oriented Vice Exco of Multimedia, experienced in managing end-to-end creative workflows. Adept at juggling ad-hoc design tasks, team management, and delivering impactful digital assets under tight deadlines.'] },
    { role: 'Treasurer, ASEAN Disability Roundtable 2025', org: 'Student Representative Council, Universiti Utara Malaysia (UUM)', date: '21 Sept 2025', start: '2025-09',
      points: ['Managed the comprehensive event budget for an ASEAN-level disability inclusion forum and roundtable, facilitating the participation of 75+ stakeholders from universities, NGOs, government agencies, and international organisations.'] },
    { role: 'Assistant Instructor Seni Silat Cekak Malaysia', org: 'Persatuan Seni Silat Cekak Malaysia, Cawangan Kedah', date: 'Aug 2023 - Present', start: '2023-08',
      points: ['Assisted senior instructors in conducting weekly self-defense training sessions, mentoring university students in the syllabus of Seni Silat Cekak Malaysia.'] },
    { role: 'Unit Multimedia, Jabatan Penerangan', org: 'Persatuan Seni Silat Cekak Malaysia, Cawangan Kedah', date: 'May 2022 - Aug 2023', start: '2022-05',
      points: ['Maintained an organized digital archive of multimedia assets, ensuring all event photos and videos are properly cataloged for future marketing and documentation purposes.'] },
  ],

  honors: [
    { title: 'Malaysian Skills Certificate (SKM) Level 3 in Computer Network Services', org: 'Kolej Vokasional Alor Setar (KVAS)', date: 'Nov 2018', start: '2018-11',
      points: ['Department of Skills Development (JPK) | NOSS: K05002-IT-030-3:2013-2020(MTB1) FT082020',
        'Router & Switch Configuration, Network Troubleshooting, PC Assembly & Repair.'] },
    { title: 'AI for My Future', org: 'Microsoft & PEPPER LABS', date: 'Apr 2025', start: '2025-04',
      points: ['Completed comprehensive training covering key Artificial Intelligence concepts.',
        'Key Skills Acquired: AI Basics, Responsible AI, Generative AI, Microsoft Copilot, and AI Inclusivity.'] },
    { title: 'Silver Award, Multimedia Innovation Exhibition & Competition 2025', org: 'Universiti Utara Malaysia (UUM)', date: 'June 2026', start: '2026-06',
      points: ['Developed Nextgen-Finance, a web application designed to educate youth about basic finance literacy.',
        'Utilized flutter to build an intuitive user interface and integrate real-time data analytics, ensuring a seamless user experience.'] },
    { title: 'Ujian Sijil Rendah (USR) Seni Silat Cekak Malaysia', org: 'Persatuan Seni Silat Cekak Malaysia (PSSCM)', date: 'June 2019', start: '2019-06',
      points: ['Successfully completing the foundational syllabus and physical assessments of Seni Silat Cekak Malaysia.'] },
  ],

  softSkills: [
    { name: 'Adaptability', text: 'Capable of handling ad-hoc tasks and managing back-to-back schedules with ease.' },
    { name: 'Negotiation', text: 'Secured in cost savings for projects, allowing funds to be optimized for other production needs.' },
    { name: 'Leadership', text: 'Facilitated subordinates in executing respective roles and addresses issues by using critical thinking and problem-solving skills to create a conducive working practice.' },
    { name: 'Project Management', text: 'Organized training, recruitment, and ensuring smooth productions.' },
  ],

  technical: [
    { name: 'Microsoft Office', text: 'Word: Excellence | PowerPoint: Intermediate | Excel: Intermediate | Teams: Basic' },
    { name: 'Adobe Creative Suite', text: 'Photoshop: Excellence | Illustrator: Excellence | InDesign: Excellence | Premiere Pro: Basic' },
    { name: 'AI & Emerging tools', text: 'Claude: Intermediate | ChatGPT: Intermediate | Gemini : Advance' },
    { name: 'Canva', text: 'Excellence' },
    { name: 'Capcut', text: 'Excellence' },
    { name: 'Cisco Webex', text: 'Excellence' },
    { name: 'Affinity Studio', text: 'Intermediate' },
    { name: 'Figma', text: 'Intermediate' },
    { name: 'Firebase', text: 'Intermediate' },
    { name: 'Antigravity', text: 'Intermediate' },
    { name: 'VSCode', text: 'Intermediate' },
    { name: 'DaVinci Resolve', text: 'Intermediate' },
    { name: 'Open Broadcaster Software (OBS)', text: 'Intermediate' },
    { name: 'Roblox Studio', text: 'Basic' },
    { name: 'Unity', text: 'Basic' },
    { name: 'Blender', text: 'Basic' },
  ],

  languages: [
    { name: 'Bahasa Melayu', level: 'Native Proficiency' },
    { name: 'English', level: 'Intermediate Working Proficiency' },
  ],

  references: [
    { name: 'Mohd Farhan Ismail', title: 'Manager of Student Excellence Leadership Center (SELECT), UUM', email: 'mfarhan@uum.edu.my' },
    { name: 'Aeni Zuhana Saidin', title: 'Multimedia Lecturer, School of Multimedia Technology and Communication (SMMTC), UUM', email: 'aeni@uum.edu.my' },
  ],
};
