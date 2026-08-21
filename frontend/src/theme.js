// Personalização de tema (claro/escuro + cor de marca). Salva só no
// navegador (localStorage) — não depende do backend, então funciona até
// na tela de login. Ver App.css: quase toda a paleta deriva de
// --color-primary/--color-accent via color-mix(), então só precisamos
// sobrescrever essas duas variáveis para "rebrandear" o app inteiro.

const STORAGE_KEY = 'painel-agil-theme';

export const DEFAULT_THEME = {
    mode: 'light',
    primary: '#6366f1',
    accent: '#8b5cf6',
};

// Combinações pensadas para os públicos citados (salão de beleza,
// barbearia, spa...), além do padrão do app.
export const PRESETS = [
    { name: 'Índigo (padrão)', primary: '#6366f1', accent: '#8b5cf6' },
    { name: 'Rosé', primary: '#db2777', accent: '#f472b6' },
    { name: 'Dourado', primary: '#b45309', accent: '#f59e0b' },
    { name: 'Esmeralda', primary: '#059669', accent: '#34d399' },
    { name: 'Petróleo', primary: '#0e7490', accent: '#22d3ee' },
    { name: 'Grafite', primary: '#334155', accent: '#64748b' },
];

export function loadTheme() {
    try {
        const salvo = localStorage.getItem(STORAGE_KEY);
        if (!salvo) {
            const prefereEscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
            return { ...DEFAULT_THEME, mode: prefereEscuro ? 'dark' : 'light' };
        }
        return { ...DEFAULT_THEME, ...JSON.parse(salvo) };
    } catch {
        return DEFAULT_THEME;
    }
}

export function saveTheme(theme) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    } catch {
        // localStorage indisponível (ex: navegação privada) — a
        // personalização só não persiste entre sessões, sem quebrar o app.
    }
}

export function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.theme = theme.mode === 'dark' ? 'dark' : 'light';
    root.style.setProperty('--color-primary', theme.primary);
    root.style.setProperty('--color-accent', theme.accent);
}
