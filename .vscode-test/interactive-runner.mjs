#!/usr/bin/env -S bash -c 'NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; exec node "$1" "${@:2}"' --

// @ts-check

import { runTests } from '@vscode/test-electron';
import * as C from './color.mjs';
import fs from 'node:fs';
import path from 'node:path';
import sm from 'source-map-support';


// Проверка версии Node.js
const REQUIRED_NODE_MAJOR = 22;
const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
if (currentMajor < REQUIRED_NODE_MAJOR) {
    process.stderr.write(
        `${C.fail('🛇 ')} Node.js v${REQUIRED_NODE_MAJOR}+ is required (current: v${process.versions.node})\n`
    );
    process.exit(1);
}

sm.install();

const CWD = process.cwd();

const RAW_VSC_INSPECT = (process.env.VSC_INSPECT || 'no').toLowerCase();
/** @type {null|string} */
let VSC_INSPECT = null;
if (RAW_VSC_INSPECT === 'inspect-brk') {
    VSC_INSPECT = '--inspect-brk-extensions=9229';
}
else if (RAW_VSC_INSPECT === 'inspect') {
    VSC_INSPECT = '--inspect-extensions=9229';
}

const RAW_VSC_PARAM_DISABLE_EXTENSIONS = (process.env.VSC_PARAM_DISABLE_EXTENSIONS || 'yes').toLowerCase();
/** @type {boolean} */
let VSC_PARAM_DISABLE_EXTENSIONS = RAW_VSC_PARAM_DISABLE_EXTENSIONS === 'yes';


const OUT_DIR = process.env.OUT_DIR ?? '';


if (!OUT_DIR) {
    throw new Error('OUT_DIR is not set');
}


if (!fs.existsSync(OUT_DIR)) {
    // @fixme и что это директория?
    throw new Error(`Output directory not found: "${OUT_DIR}"`);
}

// @fixme ?????
const EXT_SANDBOX = process.env.EXT_SANDBOX;


if (EXT_SANDBOX && !fs.existsSync(EXT_SANDBOX)) {
    throw new Error(`Sandbox directory not found: "${EXT_SANDBOX}"`);
}


const VSC_VERSION = process.env.VSC_VERSION ?? '1.86.2';
const VSC_PROFILE = process.env.VSC_PROFILE ?? "Default";
const VSC_PARAM_LOG = process.env.VSC_PARAM_LOG;

const VSC_OPEN = process.env.VSC_OPEN ? process.env.VSC_OPEN.split(path.delimiter) : [];

const extensionDevelopmentPath = (() => {

    if (!EXT_SANDBOX) {
        return path.join(CWD, OUT_DIR);
    }

    const developmentPath = path.join(CWD, OUT_DIR, EXT_SANDBOX);

    const inPkgJson = path.join(CWD, EXT_SANDBOX, 'package.json');

    if (!fs.existsSync(inPkgJson)) {
        throw new Error(`package.json not found: "${inPkgJson}"`);
    }

    // копирование package.json
    fs.copyFileSync(inPkgJson, path.join(developmentPath, 'package.json'));

    const extJs = path.join(CWD, OUT_DIR, EXT_SANDBOX, 'extension.js');
    if (!fs.existsSync(extJs)) {
        throw new Error(`extension.js not found: "${extJs}"`);
    }

    return developmentPath;
})();


const extensionTestsPath = (() => {
    const extensionTestsPath = path.resolve(CWD, path.join('.', '.vscode-test', 'host-anchor.cjs'));
    if (!fs.existsSync(extensionTestsPath)) {
        throw new Error(`Extension runner not found: "${extensionTestsPath}"`);
    }
    return extensionTestsPath;
})();



async function main() {
    await runSandbox();
}




/**
 * @returns { Promise<void> }
*/
async function runSandbox() {

    let exitCode = -1;

    try {
        exitCode = await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            version: VSC_VERSION,
            launchArgs: [
                ...VSC_OPEN,
                '--disable-gpu',
                '--disable-telemetry',
                '--disable-crash-reporter',
                // '--disable-extensions',
                ...(VSC_PARAM_DISABLE_EXTENSIONS ? ['--disable-extensions'] : []),
                '--locale', 'en-US',
                '--profile', VSC_PROFILE,
                ...(VSC_PARAM_LOG ? ['--log', VSC_PARAM_LOG] : []),
                ...(VSC_INSPECT ? [VSC_INSPECT] : [])
            ],
            extensionTestsEnv: {

            }
        });
    }
    catch (error) {
        // ожидаемо, не ошибка
    }

    process.stderr.write(`\nExtension host exited with code: ${exitCode}\n`);

}


await main();
process.exit(0);
