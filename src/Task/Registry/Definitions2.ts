import * as vscode from 'vscode';
import * as JSONC from 'jsonc-parser';
import {
    Definition,
    File,
    IconDefinition,
    isName,
    jsonPath,
    Name,
    Uri,
} from '../Basic';


// #region DEBUG
declare type LoggerFn = (level: vscode.LogLevel, text: string, identity?: string) => void;
declare type AssertFn = (condition: unknown, text: string) => void;
let logger: LoggerFn | undefined = undefined;
let assert: AssertFn | undefined = undefined;
try {
    ({ logger, assert } = require('../../Logger').get(module.filename));
}
catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') {
        throw error;
    }
}
// #endregion DEBUG


interface Raw {
    label?: string;
    hide?: boolean;
    icon?: IconDefinition;
}


type Definitions = readonly [File, Map<Name, Readonly<Definition>>];


/** Загрузка определений задач напрямую из файла задач.
 *
 * Парсит файл самостоятельно.
 * Гарантирует порядок задач как в файле.
 *
 * @param uri URI файла задач (не обязан существовать физически)
 * @returns Массив определений задач, или пустой массив при ошибках чтения/парсинга */
async function fetchDefinitions(uri: Uri): Promise<Definitions> {

    try {
        return remapRaw(uri, extract(
            new TextDecoder('utf-8').decode(await vscode.workspace.fs.readFile(uri)),
            jsonPath(uri),
            /* никак не реагируем на ошибки */
        ));

    }
    catch (error) {
        // Отсутствие файла - нормальная ситуация
        if (error instanceof Error && 'code' in error && error.code === 'FileNotFound') {
            // #region DEBUG
            logger?.(
                vscode.LogLevel.Trace,
                `Skipping "${uri.fsPath}": file does not exist`,
                'fetchDefinitions');
            // #endregion DEBUG
        }
        else {
            // Проблемы с чтением/парсингом — не наши проблемы, VS Code разберётся
            // #region DEBUG
            logger?.(
                vscode.LogLevel.Debug,
                `Tasks file "${uri.fsPath}" read error: ${error instanceof Error ? error.message : JSON.stringify(error)}, skipping`,
                'fetchDefinitions');
            // #endregion DEBUG
        }
        return [uri.fsPath, new Map()];
    }

}


/** Извлечение массива задач из JSONC-содержимого.
 *
 * @param jsoncContent Содержимое файла JSONC
 * @param jsonPath Путь к массиву задач внутри структуры (например, `["tasks"]`) */
function extract(jsoncContent: string, jsonPath: JSONC.JSONPath, parseErrors?: JSONC.ParseError[]): Raw[] {

    // Парсим JSONC
    const parsed = JSONC.parse(
        jsoncContent,
        parseErrors,
        {
            // настройки совместимости с vscode tasks.json
            allowEmptyContent: true,
            allowTrailingComma: true
        }
    );

    // Извлекаем масси задач
    const raw = jsonPath.reduce((node, key) => {
        return node?.[key];
    }, parsed);
    return Array.isArray(raw) ? raw : [];
}


function remapRaw(uri: Uri, rawArr: Raw[]): Definitions {

    const map: Map<Name, Definition> = new Map();

    for (const raw of rawArr) {
        if (raw && typeof raw === 'object' && isName(raw.label)) {

            map.set(raw.label, {
                // name: raw.label,
                hide: raw.hide,
                icon: {
                    id: raw.icon?.id,
                    color: raw.icon?.color
                }
            });
        }
    }

    return [uri.fsPath, map];
}


export {
    fetchDefinitions
};
