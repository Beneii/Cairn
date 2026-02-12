export const theme = {
    // Main Backgrounds (App level)
    bg: {
        dark: '#1c1c1c',
        light: '#F3F2EE',
    },
    // Main Foreground/Text
    fg: {
        dark: '#E5E5E5',
        light: '#1A1D21', // ~zinc-900
    },
    // Borders
    border: {
        dark: 'rgba(255,255,255,0.1)',
        light: 'rgba(26,29,33,0.1)',
    },
    // Subtler borders (for inputs etc)
    borderSubtle: {
        dark: 'rgba(255,255,255,0.05)',
        light: 'rgba(26,29,33,0.05)',
    },
    // Card Backgrounds (Glass/Translucent)
    cardBg: {
        dark: 'rgba(255,255,255,0.05)',
        light: 'rgba(255,255,255,0.5)', // Slightly more opaque in light mode for contrast
    },
    // Subtle Backgrounds (Headers, Sections)
    subtleBg: {
        dark: 'rgba(255,255,255,0.03)',
        light: 'rgba(26,29,33,0.03)',
    },
    // Interactivity
    hoverBg: {
        dark: 'rgba(255,255,255,0.1)',
        light: 'rgba(26,29,33,0.1)',
    },
    activeBg: {
        dark: 'rgba(255,255,255,0.15)',
        light: '#ffffff', // Clean white for active states in light mode
    },
    // Modal Backgrounds (Solid)
    modalBg: {
        dark: '#1c1c1c', // Matches app bg for seamless look
        light: '#ffffff',
    },
    // Semantic Colors
    accent: {
        green: '#10B981',
        blue: '#3B82F6',
        red: '#EF4444',
    },
    // Radius
    radius: {
        sm: '0.375rem', // 6px
        md: '0.5rem',   // 8px
        lg: '0.75rem',  // 12px
        xl: '1rem',     // 16px
    }
} as const;

export function useTheme(darkMode: boolean) {
    return {
        bg: darkMode ? theme.bg.dark : theme.bg.light,
        fg: darkMode ? theme.fg.dark : theme.fg.light,
        border: darkMode ? theme.border.dark : theme.border.light,
        borderSubtle: darkMode ? theme.borderSubtle.dark : theme.borderSubtle.light,
        cardBg: darkMode ? theme.cardBg.dark : theme.cardBg.light,
        subtleBg: darkMode ? theme.subtleBg.dark : theme.subtleBg.light,
        hoverBg: darkMode ? theme.hoverBg.dark : theme.hoverBg.light,
        activeBg: darkMode ? theme.activeBg.dark : theme.activeBg.light,
        modalBg: darkMode ? theme.modalBg.dark : theme.modalBg.light,
        // Static
        radius: theme.radius,
        accent: theme.accent,
    };
}
