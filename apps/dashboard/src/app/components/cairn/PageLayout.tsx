import type { ReactNode } from "react";

interface PageLayoutProps {
    nav: ReactNode;
    children: ReactNode;
    darkMode?: boolean;
}

export function PageLayout({ nav, children, darkMode = false }: PageLayoutProps) {
    const bg = darkMode ? '#1c1c1c' : '#F3F2EE';
    const fg = darkMode ? '#E5E5E5' : '#1A1D21';

    return (
        <div className="relative flex flex-col h-full w-full" style={{ backgroundColor: bg, color: fg }}>
            {/* Fixed nav position - always top-right */}
            <div className="absolute top-6 right-6 z-50">
                {nav}
            </div>
            {children}
        </div>
    );
}
