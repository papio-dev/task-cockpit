# probe-vscode-tree-mutation

Минимальное расширение VS Code, которое эмпирически проверяет: мутирует ли
хост `TreeDataProvider` массивы и элементы, возвращённые из `getChildren`.

## Ссылки

[extHostTreeViews.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostTreeViews.ts)

## Мотивация

`vscode.TreeDataProvider<T>.getChildren` объявлен как возвращающий `T[]`
(мутируемый массив). Это вынуждает разработчиков, хранящих `readonly`-данные,
выбирать между небезопасным кастом и защитным копированием на каждый вызов.

Прежде чем выбирать меньшее из зол, стоит выяснить, мутирует ли хост эти
массивы *на самом деле* — или мутируемый тип просто недостаточно точно
описывает реальный контракт.

## Принцип работы

Каждый узел и каждый массив `children` замораживаются через `Object.freeze`
до передачи в провайдер. В strict mode `Object.freeze` бросает `TypeError`
при любой попытке записи. Провайдер дополнительно проверяет `Object.isFrozen`
на каждом объекте, который возвращает ему хост:

```typescript
getTreeItem(element: FrozenNode): vscode.TreeItem {
    if (!Object.isFrozen(element))          throw new Error('element not frozen');
    if (!Object.isFrozen(element.children)) throw new Error('children not frozen');
    // ...
}
```
Если VS Code где-то разворачивает, копирует или оборачивает элементы,
`isFrozen` вернёт `false` и проверка сработает — это означало бы, что freeze
теряется по дороге и мутацию таким способом не поймать. Если проверка
проходит, объект, пришедший в `getTreeItem` — это та же самая замороженная
ссылка, что мы вернули из `getChildren`.


## Краткий анализ LLM по исходникам `extHostTreeViews.ts`

`_fetchChildrenNodes` в `extHostTreeViews.ts`:
~~~typescript
const elements = await this._dataProvider.getChildren(parentElement);
// ...
const coalescedElements = coalesce(elements || []);
const treeItems = await Promise.all(coalesce(coalescedElements).map(element => {
    return this._dataProvider.getTreeItem(element);
}));
~~~

И `coalesce` из `arrays.ts` — это просто:
~~~typescript
export function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
    return <T[]>array.filter(e => !!e);
}
~~~

Вердикт:
- VS Code массив не мутирует. На возвращённом из `getChildren` массиве вызываются только `.filter` (через `coalesce` — создаёт новый массив) и `.map`. `push`/`pop`/`splice` — нигде нет.
- DnD: `handleDrag` получает элементы через `getExtensionElement(handle)` —
  те же замороженные ссылки из кэша. Мутация маловероятна.
- Checkbox: `setCheckboxState` записывает в `treeItem.checkboxState`, но
  `treeItem` — результат `getTreeItem`, не элемент `T`. Разные объекты.

## Результат

`TypeError` не бросается. Все проверки `isFrozen` проходят.
VS Code возвращает те же самые замороженные ссылки, которые получил —
без копий и обёрток.

## Вывод

Хост не мутирует ни возвращаемые массивы, ни сами элементы. Мутируемый `T[]`
в `TreeDataProvider.getChildren` — *артефакт типов*, а не поведенческий
контракт.

Возвращать `readonly`-данные без защитного копирования безопасно. Достаточно
одного каста на границе регистрации, например:

```typescript
type ReadonlyTreeDataProvider<T> =
    Omit<vscode.TreeDataProvider<T>, 'getChildren'> & {
        getChildren(element?: T): vscode.ProviderResult<ReadonlyArray<T>>;
    };

vscode.window.registerTreeDataProvider(
    'myView',
    provider as unknown as vscode.TreeDataProvider<MyNode>,
);
```

## Версия

Проверено на VS Code `1.86+` / `@types/vscode ^1.86.0`.

## Что **не проверялось** пробником

**Drag & Drop** и **Checkbox** — операции, в которых хост взаимодействует
с элементами нетривиальным образом. В данном probe не реализованы.
