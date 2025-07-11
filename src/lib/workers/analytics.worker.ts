/// <reference lib="webworker" />

import type { LogEntry } from "../../routes/analytics/utils";

self.onmessage = (event: MessageEvent<LogEntry[]>) => {
    const filteredLogEntries = event.data;

    const statusDistributionData = getStatusDistribution(filteredLogEntries);
    const topIpsData = getTopIps(filteredLogEntries);

    self.postMessage({ statusDistributionData, topIpsData });
};

function getStatusDistribution(entries: LogEntry[]) {
    const counts = entries.reduce((acc, entry) => {
        acc[entry.statusType] = (acc[entry.statusType] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return {
        labels: ['Success', 'Redirect', 'Error'],
        datasets: [{
            data: [
                counts['success'] || 0,
                counts['redirect'] || 0,
                counts['error'] || 0
            ],
            backgroundColor: [
                'hsla(174, 100%, 29%, 0.6)',
                'hsla(39, 100%, 50%, 0.6)',
                'hsla(0, 100%, 50%, 0.6)'
            ]
        }]
    };
}

function getTopIps(entries: LogEntry[]) {
    const ipCounts = entries.reduce((acc, entry) => {
        acc[entry.ip] = (acc[entry.ip] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedIps = Object.entries(ipCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    return {
        labels: sortedIps.map(([ip]) => ip),
        datasets: [{
            label: 'Requests',
            data: sortedIps.map(([, count]) => count),
            backgroundColor: 'hsla(217, 91%, 60%, 0.6)'
        }]
    };
}
