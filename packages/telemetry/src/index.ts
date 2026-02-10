export type HealthStatus = 'ok' | 'degraded' | 'failed';

export interface HealthReport {
    component: string;
    status: HealthStatus;
    details?: string;
    timestamp: string;
}

export class HealthRegistry {
    private checks = new Map<string, () => Promise<HealthReport>>();

    register(component: string, check: () => Promise<HealthReport>): void {
        this.checks.set(component, check);
    }

    async getFullReport(): Promise<HealthReport[]> {
        const results = await Promise.all(
            Array.from(this.checks.values()).map(check =>
                check().catch(err => ({
                    component: 'unknown',
                    status: 'failed' as HealthStatus,
                    details: String(err),
                    timestamp: new Date().toISOString()
                }))
            )
        );
        return results;
    }
}

export const health = new HealthRegistry();

// Basic Metrics
export interface Metric {
    name: string;
    value: number;
    labels?: Record<string, string>;
    timestamp: string;
}

export class MetricsCollector {
    private metrics: Metric[] = [];

    record(name: string, value: number, labels?: Record<string, string>): void {
        this.metrics.push({
            name,
            value,
            labels,
            timestamp: new Date().toISOString()
        });
        // Prune older metrics if needed
        if (this.metrics.length > 1000) {
            this.metrics.shift();
        }
    }

    getMetrics(): Metric[] {
        return this.metrics;
    }
}

export const metrics = new MetricsCollector();
