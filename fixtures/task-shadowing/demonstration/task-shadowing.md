# Поведение VS Code при разрешении задачи в случае Label Collision

> **Примечание по терминологии**: В этом документе **User**, **Workspace** и **Folder** — названия **Origins**: логических областей происхождения определений задач. `scope` (в бэктиках) — исключительно ссылка на поле `vscode.Task.scope`, обозначающее контекст выполнения. Это разные понятия: Origin отвечает на вопрос «откуда взялось определение задачи»; `scope` — «в каком контексте задача выполняется».

Задачи запускаются стандартными средствами VS Code.

Обозначения:

> ‣ task_label (task_description)

Лейбл пункта выбора задачи в «палитре задач», так, как показывает VS Code.


## Single-folder Label Collision внутри одного Origin


### single-folder-conflicts-within-single-origin/.vscode/tasks.json

~~~json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'My Task 1'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "My Task",
            "command": "echo 'My Task 2'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "My Task",
            "command": "echo 'My Task 3'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn My Task",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

### VS Code UI

Отображает три независимых пункта "My Task":

- ‣ DependsOn My Task
- ‣ My Task
- ‣ My Task
- ‣ My Task


### Выполнение

**"My Task"**:

При запуске любого из трех "My Task":

- ‣ My Task
  ~~~
   *  Executing task: echo 'My Task 3'

  My Task 3
  ~~~

**"DependsOn"**:

- ‣ DependsOn My Task
  ~~~
   *  Executing task: echo 'My Task 1'

  My Task 1
  ~~~


## Single-folder Label Collision с Origin.User


### User/profiles/.../tasks.json

~~~json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        }
    ]
}
~~~

### single-folder-conflicts-between-user-level/.vscode/tasks.json

~~~json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'project level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn My Task",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

### VS Code UI

- ‣ DependsOn My Task
- ‣ My Task
- ‣ My Task (User)

### Выполнение

**"My Task"**:

- ‣ My Task (User)
  ~~~
   *  Executing task: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task
  ~~~
   *  Executing task: echo 'user level My Task'

  user level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn My Task
  ~~~
   *  Executing task: echo 'project level My Task'

  project level My Task
  ~~~


## Multi-root Label Collision между Origins


### Сценарий 1

- User-версия "My Task" присутствует
- Workspace-версия "My Task" присутствует
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-origins-s1/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s1/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s1/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

В пикере присутствуют все задачи, для каждой в description указан её Origin: User, project.code-workspace, folder1 и folder2.

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ My Task (project.code-workspace)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)

#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

Результат стабильный и не зависит от порядка выполнения.


### Сценарий 2

- User-версия "My Task" присутствует
- Workspace-версия "My Task" присутствует
- Без folder1-версии "My Task"
- Без folder2-версии "My Task"


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-origins-s2/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s2/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s2/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (project.code-workspace)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)


#### Выполнение


**"My Task"**:

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
~~~
Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../folder2'
~~~


### Сценарий 3

- User-версия "My Task" присутствует
- Без Workspace-версии "My Task"
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s3/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s3/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s3/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)


#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../project.code-workspace'
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


### Сценарий 4

- User-версия "My Task" присутствует
- Без Workspace-версии "My Task"
- Без folder1-версии "My Task"
- Без folder2-версии "My Task"


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'user level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-origins-s4/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s4/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s4/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (User)
- ‣ DependsOn 'My Task' in folder2 (folder2)


#### Выполнение


**"My Task"**:

- ‣ My Task (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
   *  Executing task in folder folder1: echo 'user level My Task'

  user level My Task
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../project.code-workspace'
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../folder2'
  ~~~



### Сценарий 5

- Без User-версии "My Task"
- Workspace-версия "My Task" присутствует
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-origins-s5/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s5/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s5/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ My Task (project.code-workspace)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)


#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'settings'
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


### Сценарий 6

- Без User-версии "My Task"
- Workspace-версия "My Task" присутствует
- Без folder1-версии "My Task"
- Без folder2-версии "My Task"


#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-origins-s6/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "My Task",
                "command": "echo 'workspace level My Task'",
                "type": "shell",
                "problemMatcher": []
            },
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s6/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s6/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (project.code-workspace)
- ‣ DependsOn 'My Task' in folder2 (folder2)


#### Выполнение


**"My Task"**:

- ‣ My Task (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'settings'
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
   *  Executing task in folder folder1: echo 'workspace level My Task'

  workspace level My Task
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../folder2'
  ~~~



### Сценарий 7

- Без User-версии "My Task"
- Без Workspace-версии "My Task"
- folder1-версия "My Task" присутствует
- folder2-версия "My Task" присутствует

#### User/profiles/.../tasks.json
~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "DependsOn 'My Task' in User",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### multi-root-conflicts-between-origins-s7/project.code-workspace

~~~jsonc
{
    // ...

    "tasks": {
        "version": "2.0.0",
        "tasks": [
            {
                "label": "DependsOn 'My Task' in Workspace",
                "dependsOn": "My Task",
                "problemMatcher": []
            }
        ]
    }
}
~~~

#### multi-root-conflicts-between-origins-s7/folder1/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder1 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder1",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~


#### multi-root-conflicts-between-origins-s7/folder2/.vscode/tasks.json

~~~jsonc
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "My Task",
            "command": "echo 'folder2 level My Task'",
            "type": "shell",
            "problemMatcher": []
        },
        {
            "label": "DependsOn 'My Task' in folder2",
            "dependsOn": "My Task",
            "problemMatcher": []
        }
    ]
}
~~~

#### VS Code UI

- ‣ DependsOn 'My Task' in folder1 (folder1)
- ‣ DependsOn 'My Task' in User (User)
- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
- ‣ My Task (folder1)
- ‣ DependsOn 'My Task' in folder2 (folder2)
- ‣ My Task (folder2)

#### Выполнение

**"My Task"**:

- ‣ My Task (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ My Task (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~

**"DependsOn"**:

- ‣ DependsOn 'My Task' in folder1 (folder1)
  ~~~
   *  Executing task in folder folder1: echo 'folder1 level My Task'

  folder1 level My Task
  ~~~

- ‣ DependsOn 'My Task' in User (User)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'settings'
  ~~~

- ‣ DependsOn 'My Task' in Workspace (project.code-workspace)
  ~~~
  Couldn't resolve dependent task 'My Task' in workspace folder 'file://.../project.code-workspace'
  ~~~

- ‣ DependsOn 'My Task' in folder2 (folder2)
  ~~~
   *  Executing task in folder folder2: echo 'folder2 level My Task'

  folder2 level My Task
  ~~~


## Выводы

### Концепция: Prima

*Прима* (`Prima`) — это каталог, который в multi‑root является первым каталогом проекта, а в single‑folder — единственным. Prima имеет особое положение.

### Правила запуска

#### "Прямой" запуск (DirectRunResolution)

> VS Code не запускает конкретный экземпляр, выбранный в пикере. Она строит рантайм-задачу заново, из определения по Cross-Origin Resolution Order.
>
> Определения задач из Origins `User`, `Workspace` и `Prima` конкурируют по Cross-Origin Resolution Order (`User` > `Workspace` > `Prima`) — независимо от того, какой экземпляр выбран в пикере.

Это значит: если ты кликаешь на "‣ My Task (project.code-workspace)", а в `User` тоже есть "My Task" — запустится User-версия. Метка "(project.code-workspace)" в пикере декоративна.

~~~
Сценарий | Где "My Task" определен | Что запускается при клике на 'My Task'
         |                         | -----------------------------------------
         |                         |  U  |  W  |  P
---------|-------------------------|-----|-----|------------------------------
Сц. 1    |   +U +W +P              |  U  |  U  |  U
Сц. 2    |   +U +W -P              |  U  |  U  |  -
Сц. 3    |   +U -W +P              |  U  |  -  |  U
Сц. 4    |   +U -W -P              |  U  |  -  |  -
Сц. 5    |   -U +W +P              |  -  |  W  |  W
Сц. 6    |   -U +W -P              |  -  |  W  |  -
Сц. 7    |   -U -W +P              |  -  |  -  |  P
~~~

> - U — Origin.User
> - W — Origin.Workspace
> - P — Prima (folder1)

`Folder2` всегда запускает только свою собственную задачу — без исключений (Сц. 1, 3, 5, 7).

> Задачи из `folder[1+]` (не `Prima`) запускают исключительно свою версию задачи.

#### Запуск как зависимость (DependencyResolution)

> Разрешение определяется **Origin, где определена родительская задача**:
> - `User`: Strict Origin Resolution — поиск зависимости ограничен Origin.User
> - `Workspace`: Strict Origin Resolution — поиск зависимости ограничен Origin.Workspace
> - `Prima`: Fallback Resolution — поиск `Prima` → `Workspace` → `User` (при отсутствии в текущем Origin)
> - `folder[1+]`: Strict Origin Resolution — поиск зависимости ограничен своим Origin.Folder

~~~
Сценарий | Где "My Task" определен | Что запускается при клике на DependsOn in (X)
         |                         | ---------------------------------------------
         |                         |  U  |  W  |  P
---------|-------------------------|-----|-----|----------------------------------
Сц. 1    |   +U +W +P              |  U  |  W  |  P
Сц. 2    |   +U +W -P              |  U  |  W  |  W
Сц. 3    |   +U -W +P              |  U  | err |  P
Сц. 4    |   +U -W -P              |  U  | err |  U
Сц. 5    |   -U +W +P              | err |  W  |  P
Сц. 6    |   -U +W -P              | err |  W  |  W
Сц. 7    |   -U -W +P              | err | err |  P
~~~

> - U — Origin.User
> - W — Origin.Workspace
> - P — Prima (folder1)

`Folder2` запускает только если зависимость доступна в её Origin (Сц. 1, 3, 5, 7). Ошибка — в противоположном случае (Сц. 2, 4, 6).

##### Асимметрия

`User`, `Workspace` и `folder[n+1]` используют Strict Origin Resolution — ищут зависимости только в своём Origin. Только `Prima` обладает Fallback Resolution (Cascading Origin Resolution) — видимо, VS Code рассматривает первый каталог как каталог со специальными правилами, который «наследует» конфигурацию.

#### Label Collision внутри одного Origin

Когда в одном Origin несколько определений задач с одинаковым label:

**Прямой запуск**: Побеждает **последнее по порядку в файле** определение задачи.

**Как зависимость**: Побеждает **первое по порядку в файле** определение задачи.

## Ремарка

Протестировано, но не задокументировано подробно — поведение тривиально:

- `Prima` определяется индексом 0 в `workspace.workspaceFolders` (он же порядок в проводнике; первая из "folders" в .code-workspace).
- `folder[1+]` — все папки с индексом ≥ 1 ведут себя одинаково.
- Label Collision внутри одного Origin работает по одним и тем же правилам независимо от Origin.

"dependsOn" принимает только string | string[] — объектной адресации не существует (ITaskIdentifier не является адресом задачи. Это структурный идентификатор задачи, который используется для сопоставления task definition ("что", а не "где". То есть через dependsOn нельзя выразить: «возьми задачу blah именно из folder3»).


----

## Если кратко:

В документе задокументировано неочевидное и местами противоречивое поведение VS Code при разрешении рантайм-задач если есть определения с одинаковым label (Label Collision) в разных Origins (User, Workspace, папки проекта).

Главное: правила зависят не только от того, где задача определена, но и от того, как она запускается (прямой запуск или как зависимость через dependsOn), а также от особого статуса первой папки multi-root-проекта, названной здесь «Prima».

Суть: когда вы видите в списке задач пункт "My Task (project.code-workspace)", вы ожидаете, что запустится именно workspace-версия. Но VS Code игнорирует выбранный пункт и переразрешает задачу заново по Cross-Origin Resolution Order. А при использовании `dependsOn` правила становятся ещё более запутанными.

**Правила прямого запуска (Run Task)**:

1. Для папок, не являющихся первой (folder2, folder3 …)

    Если задача определена в такой папке, при клике на неё всегда выполняется строго своя локальная версия. Если есть определения с таким же label в User или Workspace — полностью игнорируются. Если локальной задачи нет, соответствующий пункт в интерфейсе просто отсутствует.

2. Для первой папки («Prima»)

    Здесь работает Cross-Origin Resolution Order: User → Workspace → Prima.

    Даже если в Prima есть собственная задача, при клике на "My Task (folder1)" выполнится User-версия, если она существует. Если User-версии нет, но есть Workspace — выполнится Workspace. Только при отсутствии и User, и Workspace-версии запустится локальная задача из Prima.

3. Для User и Workspace

    При клике на "My Task (User)" или "My Task (Workspace)" работает тот же Cross-Origin Resolution Order: User главнее Workspace, Workspace главнее Prima. То есть метка (Workspace) декоративна, если есть User-задача с тем же label.

Вывод: в multi-root прямой запуск для первой папки всегда проигрывает определениям из Origins с более высоким приоритетом по Cross-Origin Resolution Order, а для остальных — использует Strict Origin Resolution. В single-folder проекте единственная папка ведёт себя как Prima.

**Правила разрешения зависимостей (`dependsOn`)**:

Здесь поведение становится противоположным: поиск задачи-зависимости жёстко привязан к Origin родительской задачи (Strict Origin Resolution).

1. Родитель в User

    Поиск зависимости строго внутри User. Если там нет задачи с нужным label — ошибка, даже если она есть в Workspace или папках.

2. Родитель в Workspace

    Поиск строго внутри Workspace. При отсутствии — ошибка, Fallback Resolution к другим Origins не выполняется.

3. Родитель в папке, не являющейся первой (folder2, folder3 …)

    Поиск строго внутри этой же папки. Нет локальной задачи — ошибка.

4. Родитель в первой папке (Prima) — исключение

    Только здесь действует Fallback Resolution (Cascading Origin Resolution):
    Сначала ищется задача в Prima → если нет, то в Workspace → если нет, то в User.

    То есть Prima «наследует» зависимости из Origins с более высоким приоритетом, если не имеет своей. Все остальные Origins используют Strict Origin Resolution при разрешении dependsOn.

**Label Collision внутри одного Origin** (несколько определений задач с одинаковым label в одном файле)

Прямой запуск: побеждает последняя по порядку определения в файле.

Использование как зависимости: побеждает первая по порядку.

Это различие прямо противоположно и подтверждает, что резолвинг идёт двумя разными путями.

VS Code не даёт пользователю прямого контроля над тем, какая именно задача выполнится при совпадении label. Метки в списке задач ((User), (Workspace), (folder)) могут вводить в заблуждение, а поведение зависит от неочевидных факторов. Единственный надёжный способ избежать сюрпризов — использовать уникальные label задач во всех Origins, особенно если применяется dependsOn или работа идёт в multi-root-окружении.

-----

## Анализ с LLM


https://github.com/microsoft/vscode/

### Механизм 1: Strict Origin Resolution для `dependsOn` — `TaskDependency.uriFromSource`

`taskConfiguration.ts:1325–1330`

~~~
function uriFromSource(context: IParseContext, source: TaskConfigSource): URI | string {
    switch (source) {
        case TaskConfigSource.User: return Tasks.USER_TASKS_GROUP_KEY;
        case TaskConfigSource.TasksJson: return context.workspaceFolder.uri;
        default: return context.workspace && context.workspace.configuration
            ? context.workspace.configuration : context.workspaceFolder.uri;
    }
}
~~~

При парсинге `dependsOn: "My Task"` в каждой задаче VS Code кодирует, где искать, в dependency.uri:

- User → строка-константа `USER_TASKS_GROUP_KEY` ("settings")
- `.vscode/tasks.json` → URI папки этого файла
- `.code-workspace` → URI самого workspace-файла

Резолвер потом ищет именно по этому ключу. Отсюда Strict Origin Resolution — каждый Origin ищет зависимости только среди своих определений задач.

### Механизм 2: почему Prima видит всё — `_getAFolder()`

`abstractTaskService.ts:2579–2586`

~~~
private async _getAFolder(): Promise<IWorkspaceFolder> {
    let folder = this.workspaceFolders.length > 0 ? this.workspaceFolders[0] : undefined;
    // ...
    return folder;
}
~~~

User-задачи и workspace-файл-задачи парсятся с `workspaceFolder = _getAFolder() = folder1 (Prima)`. Это записывается в `_source.config.workspaceFolder`. В итоге `task.getWorkspaceFolder()` для user-задачи возвращает folder1.

### Механизм 3: Fallback Resolution (Prima) — `_createResolver.quickResolve`

`abstractTaskService.ts:1971–1993`

~~~
async function quickResolve(that, uri, identifier) {
    const foundTasks = await that._findWorkspaceTasks((task) => {
        const taskUri = ((ConfiguringTask.is(task) || CustomTask.is(task))
            ? task._source.config.workspaceFolder?.uri : undefined);
        const originalUri = typeof uri === 'string' ? uri : uri.toString();
        if (taskUri?.toString() !== originalUri) { return false; }
        return task._label === identifier || task.configurationProperties.identifier === identifier;
    });
    // ...
    return foundTasks[0];  // первая найденная
}
~~~

Когда Prima делает `dependsOn`, `dependency.uri = folder1_uri`. `quickResolve` ищет задачи по `task._source.config.workspaceFolder?.uri === folder1_uri`. Попадают все, у кого `workspaceFolder = folder1` — то есть сама Prima-задача, workspace-задача и user-задача (все три парсились с `workspaceFolder = folder1`).

`_findWorkspaceTasks` итерирует в порядке insertion в `_computeWorkspaceTasks`:

~~~
folder1_uri → folder2_uri → workspace_config → USER_TASKS_GROUP_KEY
~~~

`foundTasks[0]` = первая найденная = **folder1** если есть → **workspace** если нет → **user** — каскад без sort.

> Prima не «наследует» Workspace/User как концептуальную семантику.
> Она оказывается общим workspaceFolder-контекстом для задач, которые VS Code искусственно вычисляет через первую workspace folder.
>
> Это workspace folder, которую VS Code использует как synthetic context для источников, не принадлежащих конкретной workspace folder.

Это может объяснить и другую особенность:
Поле "scope" в vscode.Task никогда не равно `TaskScope.Global`
~~~
/**
    * The scope of a task.
    */
export enum TaskScope {
    /**
        * The task is a global task. Global tasks are currently not supported.
        */
    Global = 1,

    /**
        * The task is a workspace task
        */
    Workspace = 2
}
~~~

даже если задача пришла из User level области — `scope` это не "происхождение задачи", это — контекст в котором она выполняется. А текущая реализация ожидает существующую директорию как контекст для выполнения, и нет ни "виртуальных" ни "глобальных" контекстов.

### Механизм 4: "переразрешение" при прямом запуске — `_executeTask → getTask`

`abstractTaskService.ts:2075–2087`

~~~
private async _executeTask(task: Task, resolver, runSource) {
    let taskToRun = task;
    if (await this._saveBeforeRun()) {  // по умолчанию saveBeforeRun = "always" → true
        await this._updateWorkspaceTasks();
        const taskFolder = task.getWorkspaceFolder();  // для User/Workspace задач → folder1!
        const taskIdentifier = task.configurationProperties.identifier;
        taskToRun = (await this.getTask(taskFolder, taskIdentifier, ...)) ?? task;
    }
~~~

Поскольку `task.saveBeforeRun` по умолчанию `"always"`, задача **всегда переразрешается** через `getTask(task.getWorkspaceFolder(), identifier)`. Для User-задачи и Workspace-задачи `getWorkspaceFolder() = folder1` — потому что они парсились с `workspaceFolder = folder1`. (WYSIWYG не работает).

`abstractTaskService.ts:970–978`

~~~
const matchedTasks = await this._findWorkspaceTasks((task, workspaceFolder) => {
    const taskFolder = TaskMap.getKey(workspaceFolder);
    if (taskFolder !== requestedFolder && taskFolder !== USER_TASKS_GROUP_KEY) {
        return false;
    }
    return task.matches(key, compareId);
});
matchedTasks.sort(task => task._source.kind === TaskSourceKind.Extension ? 1 : -1);
~~~

`_findWorkspaceTasks` передаёт `workspaceTasks.workspaceFolder` — а для user/workspace задач это folder1 (из `IWorkspaceFolderTaskResult.workspaceFolder`). Значит `TaskMap.getKey(folder1) = folder1_uri = requestedFolder` → все три (folder1, workspace, user) попадают в `matchedTasks`.

Дальше — сортировка с **некорректным comparator** `task => -1` (принимает один аргумент вместо двух). Для non-extension задач compareFn(a, b) всегда возвращает -1 ("a < b"). Insertion sort с таким компаратором реверсирует массив:

~~~
[folder1_task, workspace_task, user_task] → [user_task, workspace_task, folder1_task]
~~~

`matchedTasks[0] = user_task`. Запускается user-версия. Cross-Origin Resolution Order (`User` > `Workspace` > `Prima`) — побочный эффект баговатого sort.

folder2 при этом избегает переразрешения: `task.getWorkspaceFolder() = folder2` → `getTask(folder2, ...)` → matchedTasks содержит только folder2_task → запускается folder2-версия.

-----

Итого: карта по файлам


| Поведение                        | Файл                     | Строки    | Механизм                                                    |
|----------------------------------|--------------------------|-----------|-------------------------------------------------------------|
| Strict Origin Resolution         | `taskConfiguration.ts`   | 1325–1330 | `uriFromSource` жёстко кодирует URI поиска                  |
| Prima = folder1                  | `abstractTaskService.ts` | 2579–2586 | `_getAFolder()` → `workspaceFolders[0]`                     |
| Fallback Resolution (Prima)      | `abstractTaskService.ts` | 1971–1993 | `quickResolve` по `_source.config.workspaceFolder`          |
| Переразрешение при запуске       | `abstractTaskService.ts` | 2075–2087 | `saveBeforeRun=always` → `getTask(folder1, id)`             |
| Cross-Origin Resolution Order    | `abstractTaskService.ts` | 970–978   | баговый sort реверсирует matchedTasks                       |


-----

https://raw.githubusercontent.com/microsoft/vscode/main/src/vs/workbench/contrib/tasks/common/taskConfiguration.ts
