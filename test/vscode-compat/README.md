# VS Code Task Resolution — Characterization Tests

Тесты фиксируют недокументированное поведение VS Code при разрешении рантайм-задач
при Label Collision между Origins.

## Что здесь тестируется

Не код расширения — поведение VS Code:

- **DirectRunResolution**: Cross-Origin Resolution Order (User > Workspace > PrimaryFolder)
  для прямого запуска задач.
- **DependencyResolution**: Strict Origin Resolution для большинства Origins;
  Fallback Resolution (PrimaryFolder → Workspace → User) — только для PrimaryFolder.
- **Label Collision** внутри одного Origin: последнее определение в файле
  побеждает при прямом запуске, первое — при разрешении зависимости.

## Почему существуют

Поведение подтверждено экспериментально, но не задокументировано VS Code.
Подан баг: [#335950](https://github.com/microsoft/vscode/issues/335950).

Расширение опирается на эти правила. Если VS Code их изменит (исправит или задокументирует
иначе) — расширение может потребовать корректировки.

## Что делать при падении

Тест упал ≠ расширение сломалось.

1. Выяснить, что именно изменила VS Code.
2. Оценить, затрагивает ли это DirectRunResolution, DependencyResolution
   или оба режима.
3. Решить, нужна ли корректировка расширения.
