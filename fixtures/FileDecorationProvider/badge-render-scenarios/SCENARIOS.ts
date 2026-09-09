
export interface NodeState {
    label: string;
    available: number;
    running: number;
    tintColor?: string;
}

export interface Step {
    description: string;
    nodes: NodeState[];
}

export const STEP_INTERVAL_MS = 2500;

export const SCENARIOS: Step[] = [
    {
        description: 'нет декораций — все нули',
        nodes: [
            { label: 'Alpha', available: 0, running: 0 },
            { label: 'Beta', available: 0, running: 0 },
            { label: 'Gamma', available: 0, running: 0 },
            { label: 'Delta', available: 0, running: 0 },
        ],
    },
    {
        description: 'только available > 0',
        nodes: [
            { label: 'Alpha', available: 1, running: 0 },
            { label: 'Beta', available: 3, running: 0 },
            { label: 'Gamma', available: 0, running: 0 },
            { label: 'Delta', available: 5, running: 0 },
        ],
    },
    {
        description: 'running = 1',
        nodes: [
            { label: 'Alpha', available: 0, running: 1 },
            { label: 'Beta', available: 2, running: 1 }, // available должен игнорироваться
            { label: 'Gamma', available: 0, running: 0 },
            { label: 'Delta', available: 1, running: 1 },
        ],
    },
    {
        description: 'running = 2..9',
        nodes: [
            { label: 'Alpha', available: 0, running: 2 },
            { label: 'Beta', available: 0, running: 5 },
            { label: 'Gamma', available: 0, running: 9 },
            { label: 'Delta', available: 0, running: 7 },
        ],
    },
    {
        description: 'running >= 10 (overflow)',
        nodes: [
            { label: 'Alpha', available: 0, running: 10 },
            { label: 'Beta', available: 0, running: 99 },
            { label: 'Gamma', available: 0, running: 100 },
            { label: 'Delta', available: 0, running: 1 },
        ],
    },
    {
        description: 'tintColor + available',
        nodes: [
            { label: 'Alpha', available: 1, running: 0, tintColor: 'charts.green' },
            { label: 'Beta', available: 1, running: 0, tintColor: 'charts.red' },
            { label: 'Gamma', available: 1, running: 0, tintColor: 'charts.yellow' },
            { label: 'Delta', available: 1, running: 0, tintColor: 'charts.blue' },
        ],
    },
    {
        description: 'tintColor + running',
        nodes: [
            { label: 'Alpha', available: 0, running: 2, tintColor: 'charts.green' },
            { label: 'Beta', available: 0, running: 5, tintColor: 'charts.red' },
            { label: 'Gamma', available: 0, running: 10, tintColor: 'charts.yellow' },
            { label: 'Delta', available: 0, running: 1, tintColor: 'charts.blue' },
        ],
    },
    {
        description: 'tintColor без бейджа',
        nodes: [
            { label: 'Alpha', available: 0, running: 0, tintColor: 'charts.green' },
            { label: 'Beta', available: 0, running: 0, tintColor: 'charts.red' },
            { label: 'Gamma', available: 0, running: 0 },
            { label: 'Delta', available: 0, running: 0, tintColor: 'charts.purple' },
        ],
    },
];
