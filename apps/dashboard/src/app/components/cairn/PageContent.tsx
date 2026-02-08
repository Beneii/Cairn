import type { ReactNode } from "react";

interface PageContentProps {
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
    darkMode?: boolean;
}

/**
 * Unified page content wrapper for consistent styling across all sub-pages.
 * 
 * Standards:
 * - max-w-4xl centered content
 * - p-8 padding with pt-20 to avoid nav overlap
 * - h2 title (text-2xl font-bold tracking-tight)
 * - Optional subtitle (text-sm opacity-50)
 * - mb-8 gap after header
 * - overflow-y-auto scrollable content
 */
export function PageContent({ title, subtitle, children, darkMode = false }: PageContentProps) {
    const border = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(26,29,33,0.1)';

    return (
        <div className="flex flex-col h-full p-8 pt-20 max-w-4xl mx-auto w-full">
            {/* Standard header */}
            <div className="flex items-center gap-3 mb-8 pb-4" style={{ borderBottom: `1px solid ${border}` }}>
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                {subtitle && (
                    <span className="text-sm opacity-50">{subtitle}</span>
                )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
