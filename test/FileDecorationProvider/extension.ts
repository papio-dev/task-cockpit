import * as vscode from 'vscode';
import WindowSettings from '../../src/WindowSettings/WindowSettings';
import FileDecorationProvider from '../../src/FileDecorationProvider/FileDecorationProvider';
import Config from '../../src/WindowSettings/Configuration';
import Schema from '../../src/WindowSettings/WindowConfigurationSchema';
import LogOutputChannel from '../../src/extension/LogOutputChannel';


export interface IFixture {
    fileDecorationProvider: FileDecorationProvider;
    updateConfig: (value: FileDecorationConf) => Promise<void>;
}

const CONFIGURATION_KEY = 'FileDecoration' as const;
type FileDecorationConf = Config[typeof CONFIGURATION_KEY];


export function activate(context: vscode.ExtensionContext): IFixture {

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const extDisplayName = context.extension.packageJSON['displayName'] as string;
    const logOutputChannel = LogOutputChannel.createLogger(extDisplayName);

    const windowSettings = new WindowSettings(logOutputChannel);

    const fileDecorationProvider = new FileDecorationProvider({ windowSettings }, logOutputChannel);

    context.subscriptions.push(
        fileDecorationProvider,
        windowSettings,
        logOutputChannel
    );

    async function updateConfig(
        value: FileDecorationConf
    ): Promise<void> {

        const fd = Schema[CONFIGURATION_KEY];
        const cfg = vscode.workspace.getConfiguration();

        function isSatisfied(): boolean {
            const current = windowSettings.getConfiguration(CONFIGURATION_KEY);
            return JSON.stringify(current) === JSON.stringify(value);
        }

        // если состояние уже целевое
        if (isSatisfied()) {
            return;
        }

        // Подписка ДО отправки обновлений — чтобы не пропустить событие
        const settled = new Promise<void>((resolve) => {
            const disposable = windowSettings.onDidCompleteUpdate(async () => {
                if (isSatisfied()) {
                    disposable.dispose();
                    await new Promise<void>(resolve => setTimeout(resolve, 550));
                    resolve();
                }
            });
        });


        await Promise.all([
            cfg.update(fd.runningSymbol.configKey, value.runningSymbol, vscode.ConfigurationTarget.Global),
            cfg.update(fd.overflowSymbol.configKey, value.overflowSymbol, vscode.ConfigurationTarget.Global),
            cfg.update(fd.badgeOrder.configKey, value.badgeOrder, vscode.ConfigurationTarget.Global),
            cfg.update(fd.availableSymbol.configKey, value.availableSymbol, vscode.ConfigurationTarget.Global),
        ]);

        await settled;
    }

    return {
        fileDecorationProvider,
        updateConfig
    };
}

export function deactivate(): void {

}
