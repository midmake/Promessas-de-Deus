const byId = (id) => document.getElementById(id);

byId('nav-home')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
byId('brand-home')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
byId('nav-share')?.addEventListener('click', () => byId('share-promise')?.click());
byId('nav-bible')?.addEventListener('click', () => byId('read-bible')?.click());
byId('nav-settings')?.addEventListener('click', () => byId('theme-toggle')?.click());
