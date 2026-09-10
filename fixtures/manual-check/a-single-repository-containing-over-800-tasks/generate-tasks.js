const fs = require('fs');

const tasks = [];
const roots = ['app', 'lib', 'tools', 'infra', 'docs', 'test', 'e2e', 'db', 'api', 'ui'];
const actions = ['build', 'test', 'lint', 'deploy', 'watch', 'clean', 'migrate', 'seed', 'profile'];

for (const root of roots) {
    tasks.push({
        label: root,
        type: 'shell',
        command: `echo root ${root}`,
        group: 'build',
        icon: { id: 'folder', color: 'terminal.ansiBlue' }
    });

    for (const action of actions) {
        const mid = `${root}:${action}`;
        tasks.push({
            label: mid,
            type: 'shell',
            command: `echo ${mid}`,
            group: action.includes('test') ? 'test' : 'build',
            icon: {
                id: action === 'test' ? 'beaker' : 'gear',
                color: 'terminal.ansiCyan'
            }
        });

        for (let i = 0; i < 8; i++) {
            const leaf = `${mid}:step${i}`;
            tasks.push({
                label: leaf,
                type: 'shell',
                command: `echo ${leaf}`,
                dependsOn: i > 0 ? [`${mid}:step${i - 1}`] : [],
                hide: i === 7 && root === 'test',
                detail: `**${leaf}**\n\nШаг ${i} для \`${mid}\`.`
            });
        }
    }
}

// Ловушки поверх огромного дерева
tasks.push(
    { label: 'dup', type: 'shell', command: 'echo dup 1' },
    { label: 'dup', type: 'shell', command: 'echo dup 2' },
    { label: 'missing-dep', type: 'shell', command: 'echo x', dependsOn: ['no-such-task'] },
    { label: 'hidden-parent', type: 'shell', command: 'echo hidden', hide: true },
    { label: 'hidden-parent:child', type: 'shell', command: 'echo child' },
    {
        label: 'composite-only',
        dependsOn: ['app:build:step0', 'lib:test:step0'],
        dependsOrder: 'parallel',
        problemMatcher: []
    },
    { label: '🚀:launch:prod', type: 'shell', command: 'echo emoji' },
    { label: 'a::b', type: 'shell', command: 'echo double colon' },
    { label: 'a : b', type: 'shell', command: 'echo spaces' },
    { label: 'buіld:test', type: 'shell', command: 'echo confusable' }
);

fs.mkdirSync('.vscode', { recursive: true });
fs.writeFileSync(
    '.vscode/tasks.json',
    JSON.stringify({ version: '2.0.0', tasks }, null, 2)
);

console.log(`Wrote ${tasks.length} tasks to .vscode/tasks.json`);