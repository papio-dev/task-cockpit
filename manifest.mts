#!/usr/bin/env -S npx tsx

import cps from 'node:child_process';
import url from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import semVer from 'semver';
import * as assert from 'node:assert/strict';
import {
    COMMAND_CATEGORY,
    SETTING,
    USER_TREE,
    EXTENSION,
    CONTAINER,
    PROJECT_TREE
} from './src/tokens.js';



const MAIN_JS = process.env.MAIN_JS;
const ICONS_PATH = process.env.ICONS_PATH;
const MANIFEST_FILE = process.env.MANIFEST_FILE;


if (!MAIN_JS) {
    // MAIN_JS обязателен — путь к основному скрипту расширения
    throw new Error('Environment variable MAIN_JS is required');
}

if (ICONS_PATH == null) {
    // ICONS_PATH обязателен, даже если пустая строка — используем явную проверку на null/undefined
    throw new Error('Environment variable ICONS_PATH is required');
}

if (MANIFEST_FILE == null) {
    throw new Error('Environment variable MANIFEST_FILE is required');
}

// Защита от перезаписи существующего манифеста
if (fs.existsSync(MANIFEST_FILE)) {
    throw new Error(
        `Manifest file already exists at "${MANIFEST_FILE}". First, delete it.`
    );
}


// #region

// ------------------------------------------------------------------------------------



// ------------------------------------------------------------------------------------


function getLatestVersion(): string {
    // только теги, которые являются предками HEAD
    // в смысле «того, что сейчас актуально на этой ветке»
    const versions = cps.execSync("git tag --sort=-committerdate --merged HEAD 'v[0-9]*'", { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map(tag => tag.replace(/^v/, ''))
        .map(ver => semVer.valid(ver) ? semVer.parse(ver) : null)
        .filter(
            (ver: semVer.SemVer | null): ver is semVer.SemVer => Boolean(ver)
        );
    const semVersion = versions.at(0);
    if (!semVersion) {
        throw new Error('No valid semver tags found');
    }

    const branch = cps.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

    // На main/master версия должна быть «чистой» — без билд-метаданных,
    // релизная сборка не должна отличаться от тега.
    // На остальных ветках билд-метаданные = имя ветки, чтобы различать сборки.
    let normalizedBranch = '';
    if (branch !== 'main' && branch !== 'master') {
        normalizedBranch = branch
            .toLowerCase()
            .replace(/[^0-9A-Za-z-]+/g, '-')   // всё, что не разрешено → один дефис
            .replace(/-+/g, '-')               // схлопываем множественные дефисы
            .replace(/^-|-$/g, '')             // убрать дефисы в начале и конце
            .substring(0, 28);                 // ограничиваем длину, чтобы не было слишком длинного идентификатора
        // если после чистки ничего не осталось (имя ветки было сплошь спецсимволами) — fallback
        if (!normalizedBranch) {
            normalizedBranch = 'dev';
        }
    }

    const versionString = normalizedBranch
        ? `${semVersion.version}+${normalizedBranch}`
        : semVersion.version;

    const version = semVer.parse(versionString)?.raw;

    if (!version) {
        throw new Error(`Failed to parse version as valid semver: "${versionString}"`);
    }

    return version;
}


// ------------------------------------------------------------------------------------

const order = (function () {
    const map: Map<string, number> = new Map();
    return {
        nextIn(section: string) {
            let c = map.get(section);
            if (c === undefined) {
                c = 0;
                map.set(section, c);
            }
            const next = ++c;
            map.set(section, next);
            return next;
        }
    };
})();

// ------------------------------------------------------------------------------------


function getCodiconsList(): string[] {
    const packageJsonUrl = import.meta.resolve('@vscode/codicons/package.json');
    const codiconsRoot = path.dirname(url.fileURLToPath(packageJsonUrl));
    const mappingJson = path.join(codiconsRoot, 'src/template/mapping.json');
    const mapping = JSON.parse(fs.readFileSync(mappingJson, 'utf8'));
    const icons = [...new Set(Object.values(mapping).flat() as string[])]
        .filter(name => name !== 'folder' && name !== 'dash')
        .sort();

    return icons;
}

// ------------------------------------------------------------------------------------

function readDependencies() {
    const mappingJson = path.resolve('.', 'package.json');
    const mapping = JSON.parse(fs.readFileSync(mappingJson, 'utf8'));

    return mapping['dependencies'];
}

// ------------------------------------------------------------------------------------

function iconPath(icon: string): string {
    assert.ok(ICONS_PATH != null);
    return ICONS_PATH ? `${ICONS_PATH}/${icon}` : icon;
}

// ------------------------------------------------------------------------------------


type DeepStringValues<T> = T extends object
    ? DeepStringValues<T[keyof T]>
    : T extends string ? T : never;


type _ExtensionCommand = (typeof EXTENSION)['COMMAND'][keyof (typeof EXTENSION)['COMMAND']]['ID'];
type _UserTreeCommand = (typeof USER_TREE)['COMMAND'][keyof (typeof USER_TREE)['COMMAND']]['ID'];
type _ProjectTreeCommand = (typeof PROJECT_TREE)['COMMAND'][keyof (typeof PROJECT_TREE)['COMMAND']]['ID'];

type KnownCommand =
    | _ExtensionCommand
    | _UserTreeCommand
    | _ProjectTreeCommand
    ;



type KnownSettings = DeepStringValues<typeof SETTING>;

function _J(s: string | string[]): string {
    return Array.isArray(s)
        ? s.join(' ')
        : s;
}

// ------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------

// #endregion



// https://github.com/wraith13/vscode-schemas/blob/master/en/latest/schemas/vscode-extensions.json


interface CommandDefinition {
    /** Identifier of the command to execute */
    command: KnownCommand;
    /** (Optional) Icon which is used to represent the command in the UI. Either a file path, an object with file paths for dark and light themes, or a theme icon references, like "$(zap)" */
    icon: string;
    /** (Optional) Category string by which the command is grouped in the UI */
    category: typeof COMMAND_CATEGORY;
    /** Title by which the command is represented in the UI */
    title: string;
    /** (Optional) Short title by which the command is represented in the UI. Menus pick either title or shortTitle depending on the context in which they show commands. */
    shortTitle?: string;
    /** (Optional) Condition which must be true to enable the command in the UI (menu and keybindings). Does not prevent executing the command by other means, like the `executeCommand`-api. */
    enablement?: string;
}

type ExhaustiveCommands<T extends CommandDefinition[]> =
    [Exclude<KnownCommand, T[number]['command']>] extends [never]
    ? T
    : { _error: 'Not all KnownCommand values are covered'; _missing: Exclude<KnownCommand, T[number]['command']>; };

const defineCommands = <const T extends CommandDefinition[]>(
    items: T & ExhaustiveCommands<T>
): T => items;

interface MenuDefinition {
    /** Identifier of the command to execute. The command must be declared in the 'commands'-section */
    command: KnownCommand;
    /** Condition which must be true to show this item */
    when: string,
    /** Group into which this item belongs */
    group: string;
    /** Identifier of an alternative command to execute. The command must be declared in the 'commands'-section */
    alt?: string;
}


interface PaletteMenuDefinition {
    /** Identifier of the command to execute. The command must be declared in the 'commands'-section */
    command: KnownCommand,
    /** Condition which must be true to show this item */
    when: string;
    /** Group into which this item belongs */
    group?: string,
    /** Identifier of an alternative command to execute. The command must be declared in the 'commands'-section */
    alt?: KnownCommand,
}

type ExhaustivePaletteMenus<T extends PaletteMenuDefinition[]> =
    [Exclude<KnownCommand, T[number]['command']>] extends [never]
    ? T
    : { _error: 'Not all KnownCommand values are covered'; _missing: Exclude<KnownCommand, T[number]['command']>; };

const definePaletteMenus = <const T extends PaletteMenuDefinition[]>(
    items: T & ExhaustivePaletteMenus<T>
): T => items;

/**
 * - window: Configuration that can be configured in the user, remote or workspace settings.
 * - resource: Configuration that can be configured in the user, remote, workspace or folder settings.
*/
type Scope = 'application' | 'language-overridable' | 'machine' | 'machine-overridable' | 'resource' | 'window';

interface SettingsBoolean {
    /** Either a string of one of the basic schema types (number, integer, null, array, object, **boolean**, string) or an array of strings specifying a subset of those types. */
    type: 'boolean',
    /** Scope in which the configuration is applicable. Available scopes are application, machine, window, resource, and machine-overridable. */
    scope: Scope,
    /** A default value. Used by suggestions. */
    default: boolean,
    /** The description in the markdown format. */
    markdownDescription: string,
    /** When specified, gives the order of this setting relative to other settings within the same category. Settings with an order property will be placed before settings without this property set. */
    order: number;
}

interface SettingsString {
    /** Either a string of one of the basic schema types (number, integer, null, array, object, boolean, **string**) or an array of strings specifying a subset of those types. */
    type: 'string',
    /** Scope in which the configuration is applicable. Available scopes are application, machine, window, resource, and machine-overridable. */
    scope: Scope,
    /** A default value. Used by suggestions. */
    default: string,
    /** A regular expression to match the string against. It is not implicitly anchored. */
    pattern: string,
    patternErrorMessage: string,
    /** The maximum length of a string. */
    maxLength: number,
    /** The description in the markdown format. */
    markdownDescription: string,
    /** When specified, gives the order of this setting relative to other settings within the same category. Settings with an order property will be placed before settings without this property set. */
    order: number;
}

interface SettingsStringEnum {
    /** Either a string of one of the basic schema types (number, integer, null, array, object, boolean, **string**) or an array of strings specifying a subset of those types. */
    type: 'string',
    /** Scope in which the configuration is applicable. Available scopes are application, machine, window, resource, and machine-overridable. */
    scope: Scope,
    /** A default value. Used by suggestions. */
    default: string,
    /** The set of literal values that are valid. */
    enum: string[],
    /** Descriptions for enum values in the markdown format. */
    markdownEnumDescriptions: string[],
    /** The description in the markdown format. */
    markdownDescription: string,
    /** When specified, gives the order of this setting relative to other settings within the same category. Settings with an order property will be placed before settings without this property set. */
    order: number,
}

interface SettingsStringArray {
    type: "array",
    /** For arrays. Can either be a schema to validate every element against or an array of schemas to validate each item against in order (the first schema will validate the first element, the second schema will validate the second element, and so on. */
    items: {
        /** Either a string of one of the basic schema types (number, integer, null, array, object, boolean, **string**) or an array of strings specifying a subset of those types. */
        type: "string",
        uniqueItems: true;
    },
    uniqueItems: true,
    scope: Scope,
    /** A default value. Used by suggestions. */
    default: string[],
    /** The description in the markdown format. */
    markdownDescription: string,
    /** When specified, gives the order of this setting relative to other settings within the same category. Settings with an order property will be placed before settings without this property set. */
    order: number;
}


const MANIFEST: {
    [k: string]: unknown,

    contributes: {
        [k: string]: unknown,

        viewsContainers: {
            activitybar: [{
                id: typeof CONTAINER.ID,
                title: string,
                icon: string;
            }];
        },

        views: {
            [CONTAINER.ID]: [
                {
                    id: typeof USER_TREE.ID,
                    name: string,
                    icon: string,
                    type: 'tree',
                    initialSize: number,
                    visibility: 'visible',
                    when: string;
                },
                {
                    id: typeof PROJECT_TREE.ID,
                    name: string,
                    icon: string,
                    type: 'tree',
                    initialSize: number,
                    visibility: 'visible',
                    when: string;
                }
            ];
        },

        /** Contributed views welcome content. Welcome content will be rendered in tree based views whenever they have no meaningful content to display, ie. the File Explorer when no folder is open. Such content is useful as in-product documentation to drive users to use certain features before they are available. A good example would be a `Clone Repository` button in the File Explorer welcome view. */
        viewsWelcome: {
            /** Target view identifier for this welcome content. Only tree based views are supported. */
            view: typeof USER_TREE.ID | typeof PROJECT_TREE.ID,
            /** Welcome content to be displayed. The format of the contents is a subset of Markdown, with support for links only. */
            contents: string,
            /** Condition when the welcome content should be displayed. */
            when: string;
            /** Condition when the welcome content buttons and command links should be enabled. */
            enablement?: string;
        }[];

        /** Contributes commands to the command palette. */
        commands: CommandDefinition[];

        /** Contributes menu items to the editor */
        menus: {
            /** The Command Palette */
            commandPalette: PaletteMenuDefinition[],
            /** The contributed view title menu */
            'view/title': MenuDefinition[],
            /** The contributed view item context menu */
            'view/item/context': MenuDefinition[];
        };
        /** Contributes configuration settings */
        configuration: {
            title: string,
            description?: string,
            type: 'object',
            order: number,
            properties: Partial<{
                [key in KnownSettings]: SettingsBoolean | SettingsString | SettingsStringEnum | SettingsStringArray;
            }>;
        }[];
    };
} = {
    "$schema": "vscode://schemas/vscode-extensions",
    // --------------------------------------------
    name: EXTENSION.ID,
    publisher: 'papio-dev',
    icon: iconPath('icon.png'), // svg тут не разрешен
    galleryBanner: {
        color: '#F7F8EA',
        theme: 'light',
    },
    sponsor: {
        url: 'https://ko-fi.com/papio_dev',
    },
    displayName: EXTENSION.NAME,
    description: 'A tree view for organizing, browsing, and running VS Code tasks from workspace and user profile.',
    version: getLatestVersion(),
    license: 'MIT',
    keywords: [
        'tasks',
        'tasks.json',
        'task runner',
        'task tree',
        'task panel',
        'task explorer'
    ],
    markdown: 'github',
    repository: {
        type: 'git',
        url: 'https://github.com/papio-dev/task-cockpit.git',
    },
    homepage: 'https://github.com/papio-dev/task-cockpit',
    bugs: {
        url: 'https://github.com/papio-dev/task-cockpit/issues',
    },
    engines: {
        vscode: '^1.86.0',
    },
    categories: [
        'Other'
    ],
    extensionKind: [
        'workspace'
    ],
    main: MAIN_JS,
    activationEvents: [
        "onStartupFinished"
    ],
    contributes: {
        viewsContainers: {
            activitybar: [
                {
                    id: CONTAINER.ID,
                    title: CONTAINER.NAME,
                    icon: iconPath('panel-icon.svg')
                }
            ]
        },
        views: {
            [CONTAINER.ID]: [
                {
                    id: USER_TREE.ID,
                    name: USER_TREE.NAME,
                    icon: iconPath('panel-icon.svg'),
                    type: 'tree',
                    initialSize: 55,
                    visibility: 'visible',
                    when: `config.${SETTING.FILTERING.SHOW_GLOBAL_TASKS}`
                },
                {
                    id: PROJECT_TREE.ID,
                    name: PROJECT_TREE.NAME,
                    icon: iconPath('panel-icon.svg'),
                    type: 'tree',
                    initialSize: 89,
                    visibility: 'visible',
                    when: 'true'
                }
            ]
        },
        viewsWelcome: [

            // @todo context: tasksAvailable=false ?


            // -------------------------------------------------------------------
            {
                view: USER_TREE.ID,
                contents: EXTENSION.COMMAND.FULL_REFRESH__SPINNER.LABEL,
                when: 'workbenchState != empty',
                // (не умеет быть по настоящему пустым. allFoldersExcluded для него не имеет смысла)
            },
            // workspace-task-view
            // -------------------------------------------------------------------
            {
                view: PROJECT_TREE.ID,
                contents: 'Open a folder or workspace to get started.',
                when: 'workbenchState == empty'
            },
            {
                view: PROJECT_TREE.ID,
                contents: 'Scanning...',
                when: `workbenchState != empty && !${EXTENSION.WHEN.ALL_FOLDERS_EXCLUDED}`
            },
            {
                view: PROJECT_TREE.ID,
                contents: `[All folders are excluded](command:${EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.ID}).`,
                when: `workbenchState != empty && ${EXTENSION.WHEN.ALL_FOLDERS_EXCLUDED}`
            }
        ],

        menus: {
            commandPalette: definePaletteMenus([
                { command: EXTENSION.COMMAND.FULL_REFRESH.ID, when: 'true' },
                { command: EXTENSION.COMMAND.FULL_REFRESH__SPINNER.ID, when: 'false' },
                { command: EXTENSION.COMMAND.FULL_REFRESH__NAVIGATION.ID, when: 'false' },
                { command: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.ID, when: 'false' },
                { command: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.ID, when: 'false' },
                { command: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.ID, when: 'false' },
                { command: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.ID, when: 'false' },
                { command: EXTENSION.COMMAND.OPEN_HELP_PAGE.ID, when: 'true' },
                { command: EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.LIST_FIND.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID, when: 'false' },
                { command: PROJECT_TREE.COMMAND.TASK_RUN.ID, when: 'false' },
                { command: USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID, when: 'false' },
                { command: USER_TREE.COMMAND.LIST_EXPAND_ALL.ID, when: 'false' },
                { command: USER_TREE.COMMAND.LIST_FIND.ID, when: 'false' },
                { command: USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.ID, when: 'false' },
                { command: USER_TREE.COMMAND.OPEN_USER_TASKS.ID, when: 'false' },
                { command: USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID, when: 'false' },
                { command: USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID, when: 'false' },
                { command: USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID, when: 'false' },
                { command: USER_TREE.COMMAND.TASK_RUN.ID, when: 'false' }

            ]),
            'view/title': [
                //
                // *** navigation ***
                // --------------------------------------------------------------------------------------------------
                { // искать в списке глобальных
                    command: USER_TREE.COMMAND.LIST_FIND.ID,
                    when: `view == ${USER_TREE.ID}`,
                    group: 'navigation@1'
                },
                { // искать в списке проекта
                    command: PROJECT_TREE.COMMAND.LIST_FIND.ID,
                    when: `view == ${PROJECT_TREE.ID}`,
                    group: 'navigation@1'
                },

                { // обновить все.
                    command: EXTENSION.COMMAND.FULL_REFRESH__NAVIGATION.ID,
                    when: _J([
                        `( view == ${USER_TREE.ID} || view == ${PROJECT_TREE.ID} )`,
                        `&& ${EXTENSION.WHEN.IS_IDLE}`,
                    ]),
                    group: 'navigation@2'
                },

                {
                    command: EXTENSION.COMMAND.FULL_REFRESH__SPINNER.ID,
                    when: _J([
                        `( view == ${USER_TREE.ID} || view == ${PROJECT_TREE.ID} )`,
                        `&& !${EXTENSION.WHEN.IS_IDLE}`,
                    ]),
                    group: 'navigation@2'
                },

                {
                    command: USER_TREE.COMMAND.LIST_EXPAND_ALL.ID,
                    when: `view == ${USER_TREE.ID}`,
                    group: 'navigation@3'
                },
                {
                    command: PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID,
                    when: `view == ${PROJECT_TREE.ID}`,
                    group: 'navigation@3'
                },
                {
                    command: USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID,
                    when: `view == ${USER_TREE.ID}`,
                    group: 'navigation@4'
                },

                {
                    command: PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID,
                    when: `view == ${PROJECT_TREE.ID}`,
                    group: 'navigation@4'
                },
                // =================================================================================================
                //
                // *** FULL_REFRESH ***
                // --------------------------------------------------------------------------------------------------
                {
                    command: EXTENSION.COMMAND.FULL_REFRESH.ID,
                    when: `( view == ${USER_TREE.ID} || view == ${PROJECT_TREE.ID} )`,
                    group: 'a1@1'
                },
                // =================================================================================================
                //
                // *** open_settings ***
                // --------------------------------------------------------------------------------------------------
                {
                    command: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.ID,
                    when: `view == ${USER_TREE.ID}`,
                    group: 'a2@1'
                },
                {
                    command: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.ID,
                    when: `view == ${PROJECT_TREE.ID}`,
                    group: 'a2@1'
                },
                {
                    command: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.ID,
                    when: `view == ${USER_TREE.ID}`,
                    group: 'a2@2'
                },
                {
                    command: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.ID,
                    when: `view == ${PROJECT_TREE.ID}`,
                    group: 'a2@2'
                },
                // =================================================================================================
                //
                // *** help ***
                // --------------------------------------------------------------------------------------------------
                {
                    command: EXTENSION.COMMAND.OPEN_HELP_PAGE.ID,
                    when: `( view == ${USER_TREE.ID} || view == ${PROJECT_TREE.ID} )`,
                    group: 'a3@1'
                }
                // =================================================================================================
            ],
            'view/item/context': [
                //
                // *** inline ***
                // --------------------------------------------------------------------------------------------------
                // --- TASK_RUN ---
                {
                    command: USER_TREE.COMMAND.TASK_RUN.ID,
                    group: "inline@1",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`, // запускаемый, но
                        `&& !(viewItem =~ /:Running/)`, // не выполняется сейчас
                        `&& !(viewItem =~ /:Broken/)` // и не сломан
                    ]),
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_RUN.ID,
                    group: "inline@1",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`, // запускаемый, но
                        `&& !(viewItem =~ /:Running/)`, // не выполняется сейчас
                        `&& !(viewItem =~ /:Broken/)` // и не сломан
                    ]),
                },
                // --- --- ---
                // --- OPEN_USER_TASKS__BROKEN / TASK_GO_TO_DEFINITION__BROKEN ---
                {
                    command: USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.ID,
                    group: "inline@2",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`, // запускаемый, и
                        `&& viewItem =~ /:Broken/` // сломан
                    ]),
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.ID,
                    group: "inline@2",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`, // запускаемый, и
                        `&& viewItem =~ /:Broken/` // сломан
                    ]),
                },
                // --- --- ---
                {
                    command: USER_TREE.COMMAND.OPEN_USER_TASKS.ID,
                    group: "inline@3",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Section/`
                    ])
                },
                {
                    command: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID,
                    group: "inline@3",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Section/`
                    ]),
                },
                // =================================================================================================
                //
                // *** execute ***
                // --------------------------------------------------------------------------------------------------
                {
                    command: USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID,
                    group: "a1@1",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`,
                        `&& viewItem =~ /:Running/`, // и выполняется сейчас
                    ]),
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID,
                    group: "a1@1",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`,
                        `&& viewItem =~ /:Running/`, // и выполняется сейчас
                    ]),
                },
                {
                    command: USER_TREE.COMMAND.TASK_RUN.ID,
                    group: "a1@1",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`,
                        `&& !(viewItem =~ /:Running/)`, // и НЕ выполняется сейчас
                    ]),
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_RUN.ID,
                    group: "a1@1",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`,
                        `&& !(viewItem =~ /:Running/)`, // и НЕ выполняется сейчас
                    ]),
                },
                {
                    command: USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID,
                    group: "a1@2",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`
                    ]),
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID,
                    group: "a1@2",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`
                    ]),
                },
                // =================================================================================================
                //
                // *** open ***
                // --------------------------------------------------------------------------------------------------
                // ..................................................................................................
                {
                    command: USER_TREE.COMMAND.OPEN_USER_TASKS.ID,
                    group: "a2@1",
                    when: `view == ${USER_TREE.ID}`
                },
                {
                    command: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID,
                    group: "a2@1",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& !(viewItem =~ /:Runnable/)` // и не Runnable
                    ])
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID,
                    group: "a2@1",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/` // и Runnable
                    ])
                },
                // ..................................................................................................
                {
                    command: USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID,
                    group: "a3@1",
                    when: _J([
                        `view == ${USER_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`
                    ]),
                },
                {
                    command: PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID,
                    group: "a3@1",
                    when: _J([
                        `view == ${PROJECT_TREE.ID}`,
                        `&& viewItem =~ /:Runnable/`
                    ]),
                },
                // ..................................................................................................
            ]
        },
        // submenus: [],
        // "keybindings": [],
        commands: defineCommands([

            {
                command: EXTENSION.COMMAND.FULL_REFRESH__SPINNER.ID,
                icon: `$(${EXTENSION.COMMAND.FULL_REFRESH__SPINNER.ICON})`,
                title: EXTENSION.COMMAND.FULL_REFRESH__SPINNER.LABEL,
                category: COMMAND_CATEGORY,
                enablement: 'false'
            },
            {
                command: EXTENSION.COMMAND.FULL_REFRESH.ID,
                icon: `$(${EXTENSION.COMMAND.FULL_REFRESH.ICON})`,
                title: EXTENSION.COMMAND.FULL_REFRESH.LABEL,
                category: COMMAND_CATEGORY,
                enablement: 'true'
            },
            {
                command: EXTENSION.COMMAND.FULL_REFRESH__NAVIGATION.ID,
                icon: `$(${EXTENSION.COMMAND.FULL_REFRESH__NAVIGATION.ICON})`,
                title: EXTENSION.COMMAND.FULL_REFRESH__NAVIGATION.LABEL,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`
                ])
            },
            {
                command: USER_TREE.COMMAND.LIST_FIND.ID,
                icon: `$(${USER_TREE.COMMAND.LIST_FIND.ICON})`,
                title: USER_TREE.COMMAND.LIST_FIND.LABEL,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                    `&& ${USER_TREE.WHEN.HAS_ITEMS}`
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.LIST_FIND.ID,
                icon: `$(${PROJECT_TREE.COMMAND.LIST_FIND.ICON})`,
                title: PROJECT_TREE.COMMAND.LIST_FIND.LABEL,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                    `&& ${PROJECT_TREE.WHEN.HAS_ITEMS}`
                ])
            },
            {
                command: USER_TREE.COMMAND.TASK_RUN.ID,
                icon: `$(${USER_TREE.COMMAND.TASK_RUN.ICON})`,
                title: USER_TREE.COMMAND.TASK_RUN.LABEL,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`, // если не занят
                    `&& viewItem =~ /:Runnable/`,
                    `&& !(viewItem =~ /:Running/)`, // не выполняется
                    `&& !(viewItem =~ /:Broken/)` // не сломан
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.TASK_RUN.ID,
                icon: `$(${PROJECT_TREE.COMMAND.TASK_RUN.ICON})`,
                title: PROJECT_TREE.COMMAND.TASK_RUN.LABEL,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`, // если не занят
                    `&& viewItem =~ /:Runnable/`,
                    `&& !(viewItem =~ /:Running/)`, // не выполняется
                    `&& !(viewItem =~ /:Broken/)` // не сломан
                ])
            },

            {
                command: USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID,
                title: USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.LABEL,
                icon: `$(${USER_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`, // если не занят
                    `&& viewItem =~ /:Runnable/`,
                    `&& viewItem =~ /:Running/`, // выполняется
                    `&& !(viewItem =~ /:Broken/)` // не сломан
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ID,
                title: PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.TASK_RUN_NEW_INSTANCE.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`, // если не занят
                    `&& viewItem =~ /:Runnable/`,
                    `&& viewItem =~ /:Running/`, // выполняется
                    `&& !(viewItem =~ /:Broken/)` // не сломан
                ])
            },

            {
                command: USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID,
                title: USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.LABEL,
                icon: `$(${USER_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `viewItem =~ /:Running/`, // если работает
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ID,
                title: PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.TASK_ABORT_ALL_INSTANCES.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `viewItem =~ /:Running/`, // если работает
                ])
            },

            {
                // открыть файл-источник задач из профиля
                command: USER_TREE.COMMAND.OPEN_USER_TASKS.ID,
                title: USER_TREE.COMMAND.OPEN_USER_TASKS.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                ])
            },
            {
                // открыть файл-источник задач текущего проекта
                command: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ID,
                title: PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.OPEN_TASKS_FILE.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`
                ])
            },

            {
                command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ID,
                title: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`
                ])
            },


            {
                command: USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.ID,
                title: USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.LABEL,
                icon: `$(${USER_TREE.COMMAND.OPEN_USER_TASKS__BROKEN.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.ID,
                title: PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.TASK_GO_TO_DEFINITION__BROKEN.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`
                ])
            },

            {
                command: USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID,
                title: USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.LABEL,
                icon: `$(${USER_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `viewItem =~ /:Terminals/`// если есть терминалы
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ID,
                title: PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.TASK_NAVIGATE_TO_TERMINAL.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `viewItem =~ /:Terminals/`// если есть терминалы
                ])
            },

            // -------------------------------------------------------------------------
            {
                command: EXTENSION.COMMAND.OPEN_HELP_PAGE.ID,
                title: EXTENSION.COMMAND.OPEN_HELP_PAGE.LABEL,
                icon: `$(${EXTENSION.COMMAND.OPEN_HELP_PAGE.ICON})`,
                category: COMMAND_CATEGORY,
            },
            // -------------------------------------------------------------------------
            {
                command: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.ID,
                title: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.LABEL,
                icon: `$(${EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__USR.ICON})`,
                category: COMMAND_CATEGORY
            },
            {
                command: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.ID,
                title: EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.LABEL,
                icon: `$(${EXTENSION.COMMAND.OPEN_DISPLAY_SETTINGS__WS.ICON})`,
                category: COMMAND_CATEGORY
            },
            {
                command: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.ID,
                title: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.LABEL,
                icon: `$(${EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__USR.ICON})`,
                category: COMMAND_CATEGORY
            },
            {
                command: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.ID,
                title: EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.LABEL,
                icon: `$(${EXTENSION.COMMAND.OPEN_FILTERING_SETTINGS__WS.ICON})`,
                category: COMMAND_CATEGORY
            },

            // ---------------------------------------------------------
            {
                command: USER_TREE.COMMAND.LIST_EXPAND_ALL.ID,
                title: USER_TREE.COMMAND.LIST_EXPAND_ALL.LABEL,
                icon: `$(${USER_TREE.COMMAND.LIST_EXPAND_ALL.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                    `&& ${USER_TREE.WHEN.HAS_ITEMS}`
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ID,
                title: PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.LIST_EXPAND_ALL.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                    `&& ${PROJECT_TREE.WHEN.HAS_ITEMS}`
                ])
            },
            {
                command: USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ID,
                title: USER_TREE.COMMAND.LIST_COLLAPSE_ALL.LABEL,
                icon: `$(${USER_TREE.COMMAND.LIST_COLLAPSE_ALL.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                    `&& ${USER_TREE.WHEN.HAS_ITEMS}`
                ])
            },
            {
                command: PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ID,
                title: PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.LABEL,
                icon: `$(${PROJECT_TREE.COMMAND.LIST_COLLAPSE_ALL.ICON})`,
                category: COMMAND_CATEGORY,
                enablement: _J([
                    `${EXTENSION.WHEN.IS_IDLE}`,
                    `&& ${PROJECT_TREE.WHEN.HAS_ITEMS}`
                ])
            },

            {
                command: EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.ID,
                title: EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.LABEL,
                icon: EXTENSION.COMMAND.OPEN_SETTINGS_EXCLUDE_FOLDERS.ICON,
                category: COMMAND_CATEGORY
            }

        ]),
        configuration: [
            {
                title: 'Display',
                description: 'Visual appearance, hierarchy structure, and icon settings for tasks in the explorer.',
                order: order.nextIn('configuration'),
                type: 'object',
                properties: {
                    [SETTING.DISPLAY.SEGMENT_SEPARATOR]: {
                        type: 'string',
                        scope: 'resource',
                        default: '',
                        pattern: '^$|^[^\\p{L}\\p{N}\\s]$',
                        patternErrorMessage: 'Must be a single non-alphanumeric, non-whitespace character (or empty to disable)',
                        maxLength: 1,
                        markdownDescription: _J([
                            'Character for splitting task labels into hierarchical segments.',
                            'For example, `:` organizes `build:dev:watch` into a tree: `build` → `dev` → `watch`.',
                            'The separator is ignored at the start/end of labels, in consecutive occurrences, or',
                            'when adjacent to whitespace (e.g., `:build::dev : watch:` remains unsplit). Leave empty',
                            'to disable hierarchy. ',
                            '\nMust be a single non-alphanumeric, non-whitespace character or empty. ',
                            `\nSee also \`#${SETTING.DISPLAY.GROUP_BY_TASK_GROUP}#\`.`
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING.DISPLAY.GROUP_BY_TASK_GROUP]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        markdownDescription: _J([
                            'Groups tasks by their `group` property. For example, tasks with `"group": "build"` or',
                            '`"group": { kind: "build" }` will be placed under a `Build` folder (the group name will',
                            `be capitalized). Works independently or combined with \`#${SETTING.DISPLAY.SEGMENT_SEPARATOR}#\`. `,
                            '\n**Note:** When combined, both grouping and splitting apply: a task named `Build:dev:watch` with',
                            '`"group": "build"` and separator `:` creates `Build` → `Build` → `dev` → `watch`.'
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING.DISPLAY.USE_FOLDER_ICON]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        markdownDescription: _J([
                            'Display folder icon for intermediate segments in the task hierarchy.',
                            'Otherwise, no icon is applied.'
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING.DISPLAY.DEFAULT_ICON_NAME]: {
                        type: 'string',
                        scope: 'resource',
                        default: 'tools',
                        enum: [...getCodiconsList()],
                        markdownEnumDescriptions: [...getCodiconsList().map(i => `$(${i})`)],
                        markdownDescription: _J([
                            'Icon name for tasks without a custom icon in their definition. Defaults to `tools`. ',
                            '\nTip: use `blank` for an empty icon. ',
                            '\n[Available icons list](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing).'
                        ]),
                        order: order.nextIn('configuration.display'),
                    },
                    [SETTING.DISPLAY.TINT_LABEL]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        markdownDescription: 'Apply the task icon color to the task label as well.',
                        order: order.nextIn('configuration.display'),
                    }
                }
            },
            {
                title: 'Filtering',
                description: 'Control which tasks and workspace folders are visible in the explorer.',
                order: order.nextIn('configuration'),
                type: 'object',
                properties: {
                    [SETTING.FILTERING.SHOW_GLOBAL_TASKS]: {
                        type: 'boolean',
                        scope: 'window',
                        default: true,
                        markdownDescription: 'Show the "Global Tasks" view in the panel',
                        order: order.nextIn('configuration.filtering'),
                    },
                    [SETTING.FILTERING.SHOW_HIDDEN]: {
                        type: 'boolean',
                        scope: 'resource',
                        default: false,
                        markdownDescription: 'Show tasks marked with `"hide": true` in the task tree.',
                        order: order.nextIn('configuration.filtering'),
                    },
                    [SETTING.FILTERING.EXCLUDE_FOLDERS]: {
                        type: 'array',
                        items: {
                            type: 'string',
                            uniqueItems: true
                        },
                        uniqueItems: true,
                        scope: 'window',
                        default: [],
                        markdownDescription: _J([
                            'Workspace folders to hide from the task explorer.',
                            'Each entry should match the folder’s display name as shown by VS Code —',
                            'not the directory name on disk. ',
                            '\nAlso accepts the workspace scope name (e.g. `"my-project (Workspace)"`).'
                        ]),
                        order: order.nextIn('configuration.filtering')
                    }
                }
            },
            {
                title: 'Task Definition Issues',
                description: 'Enable diagnostics to surface potential issues with task definitions.',
                order: order.nextIn('configuration'),
                type: 'object',
                properties: {
                    [SETTING.DIAGNOSTICS.SHADOWED_TASKS]: {
                        type: 'boolean',
                        scope: 'window',
                        default: true,
                        markdownDescription: _J([
                            'When enabled, flags task definitions that share the same label but cannot',
                            'all be reached — either because a higher-priority origin shadows them,',
                            'or because multiple definitions within a same origin conflict with each other.'
                        ]),
                        order: order.nextIn('configuration.definition-issues')
                    },
                    [SETTING.DIAGNOSTICS.UNREACHABLE_DEPENDENCIES]: {
                        type: 'boolean',
                        scope: 'window',
                        default: true,
                        markdownDescription: _J([
                            'When enabled, flags tasks whose `dependsOn` references cannot be resolved —',
                            'either because the target task does not exist, or because it is not reachable',
                            'from the current resolution scope.'
                        ]),
                        order: order.nextIn('configuration.definition-issues')
                    }
                }
            }
        ]
    },
    dependencies: {
        ...readDependencies()
    },
    scripts: undefined
};

// Запись в MANIFEST_FILE
try {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(MANIFEST, null, 4) + '\n', 'utf-8');
} catch (err) {
    console.error(`Failed to write manifest to ${MANIFEST_FILE}: ${(err as Error).message}`);
    process.exit(1);
}
