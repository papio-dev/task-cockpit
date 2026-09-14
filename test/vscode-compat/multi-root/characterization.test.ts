/** @file test/vscode-compat/multi-root/characterization.test.ts */

import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type IFixture from '../extension';


suite('VS Code DirectRunResolution — Cross-Origin Resolution Order', function () {

    let fixture: IFixture;

    suiteSetup(async function () {
        const ext = vscode.extensions.getExtension('papio-dev.vscode-compat-test');
        assert.ok(ext);
        fixture = await ext.activate();
        assert.ok(fixture);

    });


    setup(async function () {

    });



    /*
        Сценарий | Где "test-task" определен | Что запускается при вызове "test-task"
                 |                           | Из пикера  | По имени
        ---------|---------------------------|------------|--------------------------
        Сц. 1    |   +U +W +P                |  U         | P
        Сц. 2    |   +U +W -P                |  U         | W
        Сц. 3    |   +U -W +P                |  U         | P
        Сц. 4    |   +U -W -P                |  U         | U
        Сц. 5    |   -U +W +P                |  W         | P
        Сц. 6    |   -U +W -P                |  W         | W
        Сц. 7    |   -U -W +P                |  P         | P

        > - U — User
        > - W — Workspace
        > - P — PrimaryFolder (folder1)
    */
    suite('vscode-task-resolution-quirks', function () {

        suite('cross-origin task resolution', function () {

            suite('Сценарий 1 (+U +W +P)', function () {

                let markerPickerFolder1: string;
                let markerPickerWorkspace: string;
                let markerPickerUser: string;
                let markerByName: string;

                test('1.1: Пикер → "folder1"', async function () {
                    markerPickerFolder1 = await fixture.runFromPicker('S1-test-task', 'folder1');
                    assert.equal(markerPickerFolder1, 'S1-test-task (User)');
                });

                test('1.2: Пикер → "Workspace"', async function () {
                    markerPickerWorkspace = await fixture.runFromPicker('S1-test-task', 'Workspace');
                    assert.equal(markerPickerWorkspace, 'S1-test-task (User)');
                });

                test('1.3: Пикер → "User"', async function () {
                    markerPickerUser = await fixture.runFromPicker('S1-test-task', 'User');
                    assert.equal(markerPickerUser, 'S1-test-task (User)');
                });

                test('1.4: По имени', async function () {
                    markerByName = await fixture.runByName('S1-test-task');
                    assert.equal(markerByName, 'S1-test-task (folder1)');
                });

                test('Текущее поведение: все варианты пикера расходятся с запуском по имени', function () {
                    const msg = `VS Code ${vscode.version}: совпали — поведение изменилось`;
                    assert.notEqual(markerPickerFolder1, markerByName, `folder1: ${msg}`);
                    assert.notEqual(markerPickerWorkspace, markerByName, `Workspace: ${msg}`);
                    assert.notEqual(markerPickerUser, markerByName, `User: ${msg}`);
                });

            });

            suite('Сценарий 2 (+U +W -P)', function () {

                let markerPickerWorkspace: string;
                let markerPickerUser: string;
                let markerByName: string;


                test('2.1: Пикер → "Workspace"', async function () {
                    markerPickerWorkspace = await fixture.runFromPicker('S2-test-task', 'Workspace');
                    assert.equal(markerPickerWorkspace, 'S2-test-task (User)');
                });

                test('2.2: Пикер → "User"', async function () {
                    markerPickerUser = await fixture.runFromPicker('S2-test-task', 'User');
                    assert.equal(markerPickerUser, 'S2-test-task (User)');
                });

                test('2.3: По имени', async function () {
                    markerByName = await fixture.runByName('S2-test-task');
                    assert.equal(markerByName, 'S2-test-task (Workspace)');
                });

                test('Текущее поведение: все варианты пикера расходятся с запуском по имени', function () {
                    const msg = `VS Code ${vscode.version}: совпали — поведение изменилось`;
                    assert.notEqual(markerPickerWorkspace, markerByName, `Workspace: ${msg}`);
                    assert.notEqual(markerPickerUser, markerByName, `User: ${msg}`);
                });

            });


            suite('Сценарий 3 (+U -W +P)', function () {

                let markerPickerFolder1: string;
                let markerPickerUser: string;
                let markerByName: string;

                test('3.1: Пикер → "folder1"', async function () {
                    markerPickerFolder1 = await fixture.runFromPicker('S3-test-task', 'folder1');
                    assert.equal(markerPickerFolder1, 'S3-test-task (User)');
                });

                test('3.2: Пикер → "User"', async function () {
                    markerPickerUser = await fixture.runFromPicker('S3-test-task', 'User');
                    assert.equal(markerPickerUser, 'S3-test-task (User)');
                });

                test('3.3: По имени', async function () {
                    markerByName = await fixture.runByName('S3-test-task');
                    assert.equal(markerByName, 'S3-test-task (folder1)');
                });

                test('Текущее поведение: все варианты пикера расходятся с запуском по имени', function () {
                    const msg = `VS Code ${vscode.version}: совпали — поведение изменилось`;
                    assert.notEqual(markerPickerFolder1, markerByName, `folder1: ${msg}`);
                    assert.notEqual(markerPickerUser, markerByName, `User: ${msg}`);
                });

            });


            suite('Сценарий 4 (+U -W -P)', function () {

                let markerPickerUser: string;
                let markerByName: string;

                test('4.1: Пикер → "User"', async function () {
                    markerPickerUser = await fixture.runFromPicker('S4-test-task', 'User');
                    assert.equal(markerPickerUser, 'S4-test-task (User)');
                });

                test('4.2: По имени', async function () {
                    markerByName = await fixture.runByName('S4-test-task');
                    assert.equal(markerByName, 'S4-test-task (User)');
                });

                test('Текущее поведение: пикер и по имени совпадают', function () {
                    const msg = `VS Code ${vscode.version}: НЕ совпали — поведение изменилось`;
                    assert.equal(markerPickerUser, markerByName, `User: ${msg}`);
                });

            });

            suite('Сценарий 5 (-U +W +P)', function () {

                let markerPickerFolder1: string;
                let markerPickerWorkspace: string;
                let markerByName: string;

                test('1.1: Пикер → "folder1"', async function () {
                    markerPickerFolder1 = await fixture.runFromPicker('S5-test-task', 'folder1');
                    assert.equal(markerPickerFolder1, 'S5-test-task (Workspace)');
                });

                test('1.2: Пикер → "Workspace"', async function () {
                    markerPickerWorkspace = await fixture.runFromPicker('S5-test-task', 'Workspace');
                    assert.equal(markerPickerWorkspace, 'S5-test-task (Workspace)');
                });

                test('1.3: По имени', async function () {
                    markerByName = await fixture.runByName('S5-test-task');
                    assert.equal(markerByName, 'S5-test-task (folder1)');
                });

                test('Текущее поведение: все варианты пикера расходятся с запуском по имени', function () {
                    const msg = `VS Code ${vscode.version}: совпали — поведение изменилось`;
                    assert.notEqual(markerPickerFolder1, markerByName, `folder1: ${msg}`);
                    assert.notEqual(markerPickerWorkspace, markerByName, `Workspace: ${msg}`);
                });

            });


            suite('Сценарий 6 (-U +W -P)', function () {

                let markerPickerWorkspace: string;
                let markerByName: string;

                test('1.1: Пикер → "Workspace"', async function () {
                    markerPickerWorkspace = await fixture.runFromPicker('S6-test-task', 'Workspace');
                    assert.equal(markerPickerWorkspace, 'S6-test-task (Workspace)');
                });

                test('1.2: По имени', async function () {
                    markerByName = await fixture.runByName('S6-test-task');
                    assert.equal(markerByName, 'S6-test-task (Workspace)');
                });

                test('Текущее поведение: пикер и по имени совпадают', function () {
                    const msg = `VS Code ${vscode.version}: НЕ совпали — поведение изменилось`;
                    assert.equal(markerPickerWorkspace, markerByName, `Workspace: ${msg}`);
                });

            });


            suite('Сценарий 7 (-U -W +P)', function () {

                let markerPickerFolder1: string;
                let markerByName: string;

                test('1.1: Пикер → "folder1"', async function () {
                    markerPickerFolder1 = await fixture.runFromPicker('S7-test-task', 'folder1');
                    assert.equal(markerPickerFolder1, 'S7-test-task (folder1)');
                });

                test('1.2: По имени', async function () {
                    markerByName = await fixture.runByName('S7-test-task');
                    assert.equal(markerByName, 'S7-test-task (folder1)');
                });

                test('Текущее поведение: пикер и по имени совпадают', function () {
                    const msg = `VS Code ${vscode.version}: НЕ совпали — поведение изменилось`;
                    assert.equal(markerPickerFolder1, markerByName, `folder1: ${msg}`);
                });

            });
        });


    });

});
