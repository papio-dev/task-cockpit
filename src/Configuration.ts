/** @file Configuration.ts */

/** Модуль для работы с конфигурацией VS Code.
 * Обеспечивает строгую типизацию, валидацию и безопасное приведение типов (coercion).
 * Предоставляет инфраструктурные утилиты для типизированной работы с настройками VS Code.
 */

import assert from 'node:assert/strict';
import type { WorkspaceConfiguration } from 'vscode';
// import Immutable from './utils/Immutable'; // @fixme


// ---

const BOOLEAN_SPEC_TYPE = Symbol();


type BooleanSpec = Configuration.BooleanSpec;

type BooleanSpecDefinition = Omit<BooleanSpec, 'type'>;

function BooleanSpec(specDefinition: BooleanSpecDefinition): BooleanSpec {
    return {
        ...specDefinition,
        type: BOOLEAN_SPEC_TYPE
    };
}

// ---

const NUMBER_SPEC_TYPE = Symbol();

type NumberSpec = Configuration.NumberSpec;

type NumberSpecDefinition = Omit<NumberSpec, 'type'>;

function NumberSpec(specDefinition: NumberSpecDefinition): NumberSpec {
    return {
        ...specDefinition,
        type: NUMBER_SPEC_TYPE
    };
}

// ---

const STRING_SPEC_TYPE = Symbol();

type StringSpec = Configuration.StringSpec;

type StringSpecDefinition = Omit<StringSpec, 'type'>;

function StringSpec(specDefinition: StringSpecDefinition): StringSpec {
    return {
        ...specDefinition,
        type: STRING_SPEC_TYPE
    };
}

// ---

const STRING_SET_SPEC_TYPE = Symbol();

type StringSetSpec = Configuration.StringSetSpec;

type StringSetSpecDefinition = Omit<StringSetSpec, 'type'>;

function StringSetSpec(specDefinition: StringSetSpecDefinition): StringSetSpec {
    return {
        ...specDefinition,
        type: STRING_SET_SPEC_TYPE
    };
}

// ---

const STRING_LITERAL_SPEC_TYPE = Symbol();

type StringLiteralSpec = Configuration.StringLiteralSpec;

type StringLiteralSpecDefinition = Omit<StringLiteralSpec, 'type'>;

function StringLiteralSpec(specDefinition: StringLiteralSpecDefinition): StringLiteralSpec {
    return {
        ...specDefinition,
        type: STRING_LITERAL_SPEC_TYPE
    };
}

// ---

type Spec =
    | BooleanSpec
    | NumberSpec
    | StringSpec
    | StringSetSpec
    | StringLiteralSpec
    ;


// ---------------------------------------------------------------------------------------------


function isAnyEntry(entry: unknown): entry is Record<string, unknown> {
    return entry != null && typeof entry === 'object' && !Array.isArray(entry);
}


function isSpec(entry: unknown): entry is Spec {
    return isAnyEntry(entry) && 'type' in entry && typeof entry.type === 'symbol';
}

// ---------------------------------------------------------------------------------------------


type ConfigSchema<S> = Configuration.ConfigSchema<S>;


/** Валидирует структуру самой схемы дескрипторов.
 * Вызывает `assert`, если дескрипторы настроены противоречиво (например, fallback не входит в min/max).
 *
 * @param schema Объект схемы.
 * @throws { AssertionError } Если схема содержит логические ошибки. */
function createSchema<Schema extends object>(schema: ConfigSchema<Schema>): ConfigSchema<Schema> {

    function walkSchema(entry: unknown, path: string[] = []) {

        assert.ok(isAnyEntry(entry), `Invalid schema structure at ${path.slice(0, -1).join('.')} expected object`);

        if (isSpec(entry)) {

            // ---
            assert.ok(entry.configKey.length > 0, `Empty configKey at ${path.join('.')}`);

            switch (entry.type) {

                case BOOLEAN_SPEC_TYPE: {
                    assert.ok(typeof entry.fallback === 'boolean',
                        `Invalid fallback type at ${path.join('.')}: expected "boolean" got "${typeof entry.fallback}"`);
                    break;
                }

                case STRING_SPEC_TYPE: {

                    assert.ok(typeof entry.fallback === 'string',
                        `Invalid fallback type at ${path.join('.')}: expected "string" got "${typeof entry.fallback}"`);

                    const { fallback, pattern } = entry;
                    if (pattern) {
                        assert.ok(pattern instanceof RegExp,
                            `Invalid pattern at ${path.join('.')}: expected "RegExp" got "${typeof pattern}"`);

                        // @reject: new RegExp('').source → '(?:)'
                        // - assert.ok(pattern.source.length > 0, // не достижимо?
                        // -    `Empty RegExp pattern at ${path.join('.')}`);

                        // если есть паттерн —
                        // прогоняем fallback через проверку
                        assert.ok(pattern.test(fallback),
                            `Default value "${fallback}" does not match pattern at ${path.join('.')}`);
                    }
                    break;
                }

                case NUMBER_SPEC_TYPE: {

                    assert.ok(typeof entry.fallback === 'number',
                        `Invalid fallback type at ${path.join('.')}: expected "number" got "${typeof entry.fallback}"`);

                    assert.ok(Number.isFinite(entry.fallback),
                        `Invalid fallback value at ${path.join('.')}: expected finite number, got ${entry.fallback}`);

                    const { min, fallback, max } = entry;

                    if (min != null) {
                        assert.ok(typeof min === 'number',
                            `Min is not a number at ${path.join('.')}`);
                        assert.ok(Number.isFinite(min),
                            `Min is not a finite number at ${path.join('.')}`);
                    }

                    if (max != null) {
                        assert.ok(typeof max === 'number',
                            `Max is not a number at ${path.join('.')}`);
                        assert.ok(Number.isFinite(max),
                            `Max is not a finite number at ${path.join('.')}`);
                    }

                    if ((min != null) && (max != null)) {
                        assert.ok(min <= max,
                            `Min (${min}) is greater than max (${max}) at ${path.join('.')}`);
                    }
                    if (min != null) {
                        assert.ok(fallback >= min,
                            `Fallback (${fallback}) is less than min (${min}) at ${path.join('.')}`);
                    }
                    if (max != null) {
                        assert.ok(fallback <= max,
                            `Fallback (${fallback}) is greater than max (${max}) at ${path.join('.')}`);
                    }
                    break;
                }

                case STRING_SET_SPEC_TYPE: {

                    assert.ok(Array.isArray(entry.fallback),
                        `Invalid fallback type at ${path.join('.')}: expected "Array" got "${typeof entry.fallback}"`);

                    const badIdx = entry.fallback.findIndex(item => typeof item !== 'string');

                    assert.ok(badIdx === -1,
                        `Invalid fallback item at ${path.join('.')}[${badIdx}]: expected "string" got "${typeof entry.fallback[badIdx]}"`);

                    break;
                }

                case STRING_LITERAL_SPEC_TYPE: {

                    // spec должен содержать values: readonly string[] и fallback: string
                    assert.ok(Array.isArray(entry.values),
                        `Invalid values at ${path.join('.')}: expected Array of strings`);
                    const badIdx = entry.values.findIndex(v => typeof v !== 'string' || v.length === 0);
                    assert.ok(badIdx === -1,
                        `Invalid literal value at ${path.join('.')}[${badIdx}]: expected non-empty string`);
                    assert.ok(typeof entry.fallback === 'string',
                        `Invalid fallback type at ${path.join('.')}: expected "string" got "${typeof entry.fallback}"`);
                    assert.ok((entry.values as readonly string[]).includes(entry.fallback),
                        `Fallback "${entry.fallback}" is not included in values at ${path.join('.')}`);
                    break;
                }

                default: {
                    const _: never = entry;
                    assert.fail(`Unhandled option type at ${path.join('.')}`); // @fixme "неожиданное поле type типа символ"
                }
            }

        }
        else {
            const keys = Object.keys(entry);

            assert.equal((keys.length === 0 && path.length > 0), false, `Invalid schema structure at ${path.join('.')}: empty object`);

            for (const key of keys) {
                walkSchema(entry[key], [...path, key]);
            }
        }

    }

    walkSchema(schema);

    return schema;
};


// ---------------------------------------------------------------------------------------------
// #region Валидаторы (Coercion Logic)

function coerceNumber(
    value: unknown,
    spec: NumberSpec
): number {

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return spec.fallback;
    }
    else if (spec.min != null && value < spec.min) {
        return spec.min;
    }
    else if (spec.max != null && value > spec.max) {
        return spec.max;
    }

    return value;
}


function coerceBoolean(
    value: unknown,
    boolSpec: Readonly<BooleanSpec>
): boolean {

    return typeof value === 'boolean' ? value : boolSpec.fallback;
}


function coerceString(
    value: unknown,
    stringSpec: Readonly<StringSpec>
): string {

    if (typeof value !== 'string') {
        return stringSpec.fallback;
    }
    if (stringSpec.pattern != null && !stringSpec.pattern.test(value)) {
        return stringSpec.fallback;
    }

    return value;
}


function coerceStringSet(
    value: unknown,
    stringSetSpec: Readonly<StringSetSpec>
): Set<string> {

    if (!Array.isArray(value)) {
        return new Set(stringSetSpec.fallback);
    }
    if (value.some(item => typeof item !== 'string')) {
        return new Set(stringSetSpec.fallback);
    }

    return new Set(value as string[]);
}


function coerceStringLiteral(
    value: unknown,
    spec: Readonly<StringLiteralSpec>
): string {
    return (typeof value === 'string' && spec.values.includes(value))
        ? value
        : spec.fallback;
}

// ---------------------------------------------------------------------------------------------
// #endregion Валидаторы


enum IsolationMode {
    None,               // полное слияние (по умолчанию)
    FolderOnly,  // только настройки папки, без подъёма к workspace/user
    WorkspaceOnly,
    UserOnly
}

/**  Извлекает значение из .
 * */
function resolveFieldValue(
    configObj: WorkspaceConfiguration,
    spec: Spec,
    isolated?: IsolationMode
) {

    const input =
        isolated === IsolationMode.UserOnly
            ? configObj.inspect(spec.configKey)?.globalValue
            : isolated === IsolationMode.WorkspaceOnly
                ? configObj.inspect(spec.configKey)?.workspaceValue
                : isolated === IsolationMode.FolderOnly
                    ? configObj.inspect(spec.configKey)?.workspaceFolderValue
                    : configObj.get(spec.configKey);

    switch (spec.type) {

        case BOOLEAN_SPEC_TYPE: {
            return coerceBoolean(input, spec);
        }
        case NUMBER_SPEC_TYPE: {
            return coerceNumber(input, spec);
        }
        case STRING_SPEC_TYPE: {
            return coerceString(input, spec);
        }
        case STRING_SET_SPEC_TYPE: {
            return coerceStringSet(input, spec);
        }
        case STRING_LITERAL_SPEC_TYPE: {
            return coerceStringLiteral(input, spec);
        }

        default: {
            const _spec: never = spec;
            throw new Error(_spec);
        }
    }
};


// ---------------------------------------------------------------------------------------------


function coerce<Schema extends object>(
    configObj: WorkspaceConfiguration,
    schema: ConfigSchema<Schema>,
    isolated?: IsolationMode
): Schema {

    // Обход схемы в поисках спеки
    function walkSchema(entry: object): Schema {
        const result = Object.create(null) as Record<string, unknown>;

        for (const [key, field] of Object.entries(entry)) {
            if (!isAnyEntry(field)) {
                continue;
            }

            if (isSpec(field)) {
                result[key] = resolveFieldValue(configObj, field, isolated);
            } else {
                result[key] = walkSchema(field);
            }
        }

        return result as unknown as Schema;
    }

    return walkSchema(schema);
};


// ---------------------------------------------------------------------------------------------

function readRaw<T>(
    configObj: WorkspaceConfiguration,
    configKey: string,
    isolated?: IsolationMode
): T | undefined {

    return isolated === IsolationMode.UserOnly
        ? configObj.inspect<T>(configKey)?.globalValue
        : isolated === IsolationMode.WorkspaceOnly
            ? configObj.inspect<T>(configKey)?.workspaceValue
            : isolated === IsolationMode.FolderOnly
                ? configObj.inspect<T>(configKey)?.workspaceFolderValue
                : configObj.get(configKey);
}

// ---------------------------------------------------------------------------------------------


function collectSections<SchemaType extends object>(schema: ConfigSchema<SchemaType>): ReadonlyMap<keyof SchemaType, readonly string[]> {

    function collectConfigKeys(entry: unknown): string[] {
        if (!isAnyEntry(entry)) { return []; }

        if (isSpec(entry)) {
            return [entry.configKey];
        }

        const keys: string[] = [];
        for (const value of Object.values(entry)) {
            keys.push(...collectConfigKeys(value));
        }
        return keys;
    }

    const result = new Map();

    for (const [section, value] of Object.entries(schema)) {
        const keys = collectConfigKeys(value);
        if (keys.length > 0) {
            result.set(section, keys);
        }
    }

    return result;
}

// ---------------------------------------------------------------------------------------------

declare namespace Configuration {

    type ConfigSchema<S> = {
        [K in keyof S]: S[K] extends boolean ? BooleanSpec
        : S[K] extends number ? NumberSpec
        : S[K] extends Set<string> ? StringSetSpec
        : string extends S[K] ? StringSpec        // широкий string
        : S[K] extends string ? StringLiteralSpec // string literal union ('a' | 'b')
        : S[K] extends object ? ConfigSchema<S[K]>
        : never;
    };

    interface BooleanSpec {
        readonly type: typeof BOOLEAN_SPEC_TYPE;
        readonly configKey: string;
        /** Значение по умолчанию, если в настройках записан не-boolean или ключ отсутствует. */
        readonly fallback: boolean;
    }

    interface NumberSpec {
        readonly type: typeof NUMBER_SPEC_TYPE;
        readonly configKey: string;
        /** Значение, возвращаемое когда настройка отсутствует или не является конечным числом. */
        readonly fallback: number;
        /** Включительная нижняя граница. Значения ниже неё обрезаются до `min`. */
        readonly min?: number;
        /** Включительная верхняя граница. Значения выше неё обрезаются до `max`. */
        readonly max?: number;
    }

    interface StringSpec {
        readonly type: typeof STRING_SPEC_TYPE;
        readonly configKey: string;
        /** Значение, возвращаемое когда настройка отсутствует, не является строкой или не прошла `pattern`. */
        readonly fallback: string;
        /** Регулярное выражение для валидации. */
        readonly pattern?: RegExp;
    }

    interface StringSetSpec {
        readonly type: typeof STRING_SET_SPEC_TYPE;
        readonly configKey: string;
        /** Значение, возвращаемое когда настройка отсутствует или не является массивом. */
        readonly fallback: readonly string[];
    }

    interface StringLiteralSpec {
        readonly type: typeof STRING_LITERAL_SPEC_TYPE;
        readonly configKey: string;
        readonly fallback: string;
        readonly values: readonly string[];  // для валидации в рантайме
    }
}

const Configuration = {
    BooleanSpec,
    NumberSpec,
    StringSpec,
    StringSetSpec,
    StringLiteralSpec,
    createSchema,
    coerce,
    collectSections,
    IsolationMode,
    readRaw
};

export default Configuration;
