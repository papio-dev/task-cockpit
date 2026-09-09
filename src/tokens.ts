/** @file tokens.ts */


const PREFIX        /**/ = 'task-cockpit';
const DISPLAY_NAME  /**/ = 'Task Cockpit';

const CONTAINER_ID     /**/ = `${PREFIX}_container`;
const USER_TREE_ID     /**/ = `${PREFIX}_user-tasks`;
const PROJECT_TREE_ID  /**/ = `${PREFIX}_project-tasks`;

export const UI = {
  COLOR: {
    INVALID            /**/: 'list.invalidItemForeground',
    DEEMPHASIZED       /**/: 'list.deemphasizedForeground'
  },
  ICON: {
    DEEMPHASIZED       /**/: 'dash',
    ERROR              /**/: 'circle-slash',
    WARNING            /**/: 'warning',
    TASK_DEFAULT       /**/: 'tools',
    USER_ORIGIN        /**/: 'vm',
    WORKSPACE_ORIGIN   /**/: 'layers',
    FOLDER_ORIGIN      /**/: 'root-folder',
    SYMBOL_FOLDER      /**/: 'symbol-folder',
    REFRESH            /**/: 'refresh',
    SEARCH             /**/: 'search',
    EXPAND_ALL         /**/: 'expand-all',
    COLLAPSE_ALL       /**/: 'collapse-all',
    LIST_FILTER        /**/: 'list-filter',
    OPEN_TASKS_FILE    /**/: 'go-to-file',
    EDIT               /**/: 'edit',
    RUN                /**/: 'play',
    HELP               /**/: 'question',
    RUN_ERRORS         /**/: 'run-errors',
    TERMINAL           /**/: 'terminal',
    ABORT              /**/: 'stop-circle',
    SETTING            /**/: 'settings',
    SYNC_ANIMATE       /**/: 'sync~spin'
  },
  DISPLAY_SEGMENT_SEPARATOR: '・'

} as const;


export const EXTENSION = {
  ID: PREFIX,
  NAME: DISPLAY_NAME,
  COMMAND: {
    // Открыть README (github) для текущей версии
    OPEN_HELP_PAGE                 /**/: { ID: `${PREFIX}.open-help-page`,                         /**/ LABEL: 'Open Documentation',                   /**/ ICON: UI.ICON.HELP },
    OPEN_DISPLAY_SETTINGS__WS      /**/: { ID: `${PREFIX}.open-display-settings@workspace`,        /**/ LABEL: 'Display Settings',                     /**/ ICON: UI.ICON.SETTING },
    OPEN_DISPLAY_SETTINGS__USR     /**/: { ID: `${PREFIX}.open-display-settings@global`,           /**/ LABEL: 'Display Settings (Global)',            /**/ ICON: UI.ICON.SETTING },
    OPEN_FILTERING_SETTINGS__WS    /**/: { ID: `${PREFIX}.open-filtering-settings@workspace`,      /**/ LABEL: 'Filtering Settings',                   /**/ ICON: UI.ICON.LIST_FILTER },
    OPEN_FILTERING_SETTINGS__USR   /**/: { ID: `${PREFIX}.open-filtering-settings@global`,         /**/ LABEL: 'Filtering Settings (Global)',          /**/ ICON: UI.ICON.LIST_FILTER },
    OPEN_SETTINGS_EXCLUDE_FOLDERS  /**/: { ID: `${PREFIX}.open-filtering-settings@excludeFolders`, /**/ LABEL: 'Filtering Settings — Exclude Folders', /**/ ICON: UI.ICON.LIST_FILTER },
    // Перечитать все данные, будет спровоцирована перестройка всех *-task-view представлений
    FULL_REFRESH             /**/: { ID: `${PREFIX}.full-refresh`,             /**/ LABEL: 'Full Refresh', /**/ ICON: UI.ICON.REFRESH },
    FULL_REFRESH__NAVIGATION /**/: { ID: `${PREFIX}.full-refresh@navigation`,  /**/ LABEL: 'Full Refresh', /**/ ICON: UI.ICON.REFRESH },
    FULL_REFRESH__SPINNER    /**/: { ID: `${PREFIX}._full-refresh@spinner`,    /**/ LABEL: 'Scanning...',  /**/ ICON: UI.ICON.SYNC_ANIMATE }
  },
  WHEN: {
    IS_IDLE: `${PREFIX}.isIdle`,
    ALL_FOLDERS_EXCLUDED: `${PROJECT_TREE_ID}.allFoldersExcluded`
  }
} as const;


// ---------------------------------

const WHEN_TAG = {
  HAS_ITEMS: 'hasItems',
  SELECTED_NODE_TYPE: 'selectedNode'
} as const;

const COMMON_ACTIONS = {
  RUN_TASK: {
    CMD   /**/: 'task-run',
    LABEL /**/: 'Run Task',
    ICON  /**/: UI.ICON.RUN
  },
  TASK_RUN_NEW_INSTANCE: {
    CMD   /**/: 'task-run-new-instance',
    LABEL /**/: 'Run New Instance',
    ICON  /**/: UI.ICON.RUN
  },
  ABORT_ALL_INSTANCES: {
    CMD   /**/: 'task-abort-all-instances',
    LABEL /**/: 'Abort All Instances',
    ICON  /**/: UI.ICON.ABORT
  },
  NAVIGATE_TO_TERMINAL: {
    CMD   /**/: 'task-navigate-to-terminal',
    LABEL /**/: 'Navigate to Terminal',
    ICON  /**/: UI.ICON.TERMINAL
  },
  LIST_OPEN_FIND: {
    CMD   /**/: 'list-find',
    LABEL /**/: 'Find in List',
    ICON  /**/: UI.ICON.SEARCH
  },
  LIST_EXPAND_ALL: {
    CMD   /**/: 'list-expand-all',
    LABEL /**/: 'Expand All',
    ICON  /**/: UI.ICON.EXPAND_ALL
  },
  LIST_COLLAPSE_ALL: {
    CMD   /**/: 'list-collapse-all',
    LABEL /**/: 'Collapse All',
    ICON  /**/: UI.ICON.COLLAPSE_ALL
  }
} as const;


export const CONTAINER = {
  ID: CONTAINER_ID,
  NAME: DISPLAY_NAME
} as const;


export const USER_TREE = {
  ID: USER_TREE_ID,
  NAME: 'User Level Tasks',
  COMMAND: {
    // Открыть файл с определением задачи
    OPEN_USER_TASKS             /**/: { ID: `${USER_TREE_ID}.open-user-tasks`,                             /**/ LABEL: 'Open User Tasks',                          /**/ ICON: UI.ICON.OPEN_TASKS_FILE },
    // Открыть файл с определением задачи (для "сломанной" задачи)
    OPEN_USER_TASKS__BROKEN     /**/: { ID: `${USER_TREE_ID}.open-user-tasks@run-error`, /**/ LABEL: 'No task matches this definition (Open User Tasks)',  /**/ ICON: UI.ICON.WARNING },
    // Выполнить задачу
    TASK_RUN                   /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.RUN_TASK.CMD}`,              /**/ LABEL: COMMON_ACTIONS.RUN_TASK.LABEL,              /**/ ICON: COMMON_ACTIONS.RUN_TASK.ICON },
    // Запустить новый экземпляр задачи
    TASK_RUN_NEW_INSTANCE      /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.TASK_RUN_NEW_INSTANCE.CMD}`,      /**/ LABEL: COMMON_ACTIONS.TASK_RUN_NEW_INSTANCE.LABEL,      /**/ ICON: COMMON_ACTIONS.TASK_RUN_NEW_INSTANCE.ICON },
    // Прервать все работающие экземпляры задачи
    TASK_ABORT_ALL_INSTANCES   /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.ABORT_ALL_INSTANCES.CMD}`,   /**/ LABEL: COMMON_ACTIONS.ABORT_ALL_INSTANCES.LABEL,   /**/ ICON: COMMON_ACTIONS.ABORT_ALL_INSTANCES.ICON },
    // Перейти к терминалу задачи
    TASK_NAVIGATE_TO_TERMINAL  /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.NAVIGATE_TO_TERMINAL.CMD}`,  /**/ LABEL: COMMON_ACTIONS.NAVIGATE_TO_TERMINAL.LABEL,  /**/ ICON: COMMON_ACTIONS.NAVIGATE_TO_TERMINAL.ICON },
    // Открыть поиск по списку
    LIST_FIND                  /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.LIST_OPEN_FIND.CMD}`,        /**/ LABEL: COMMON_ACTIONS.LIST_OPEN_FIND.LABEL,        /**/ ICON: COMMON_ACTIONS.LIST_OPEN_FIND.ICON },
    // Развернуть все элементы списка
    LIST_EXPAND_ALL            /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.LIST_EXPAND_ALL.CMD}`,       /**/ LABEL: COMMON_ACTIONS.LIST_EXPAND_ALL.LABEL,       /**/ ICON: COMMON_ACTIONS.LIST_EXPAND_ALL.ICON },
    // Свернуть все элементы списка
    LIST_COLLAPSE_ALL          /**/: { ID: `${USER_TREE_ID}.${COMMON_ACTIONS.LIST_COLLAPSE_ALL.CMD}`,     /**/ LABEL: COMMON_ACTIONS.LIST_COLLAPSE_ALL.LABEL,     /**/ ICON: COMMON_ACTIONS.LIST_COLLAPSE_ALL.ICON }
  },
  WHEN: {
    // true если в дереве есть элементы ("настоящие", не синтетические)
    HAS_ITEMS: `${USER_TREE_ID}.${WHEN_TAG.HAS_ITEMS}`,
    // тип выделенного элемента или undefined
    SELECTED_NODE_TYPE: `${USER_TREE_ID}.${WHEN_TAG.SELECTED_NODE_TYPE}`
  }
} as const;


export const COMMAND_CATEGORY = 'Task Cockpit';


export const PROJECT_TREE = {
  ID: PROJECT_TREE_ID,
  NAME: 'Project Tasks',
  COMMAND: {
    OPEN_TASKS_FILE        /**/: { ID: `${PROJECT_TREE_ID}.open-tasks-file`,                             /**/ LABEL: 'Open Tasks File',                         /**/ ICON: UI.ICON.OPEN_TASKS_FILE },

    TASK_GO_TO_DEFINITION      /**/: { ID: `${PROJECT_TREE_ID}.task-go-to-definition`,                       /**/ LABEL: 'Open Task Definition',                               /**/ ICON: UI.ICON.EDIT },

    TASK_GO_TO_DEFINITION__BROKEN /**/: { ID: `${PROJECT_TREE_ID}.task-go-to-definition@run-error`,  /**/ LABEL: 'No task matches this definition (Open Task Definition)',  /**/ ICON: UI.ICON.WARNING },
    // Выполнить задачу
    TASK_RUN                   /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.RUN_TASK.CMD}`,              /**/ LABEL: COMMON_ACTIONS.RUN_TASK.LABEL,              /**/ ICON: COMMON_ACTIONS.RUN_TASK.ICON },
    // Запустить новый экземпляр задачи
    TASK_RUN_NEW_INSTANCE                   /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.TASK_RUN_NEW_INSTANCE.CMD}`,      /**/ LABEL: COMMON_ACTIONS.TASK_RUN_NEW_INSTANCE.LABEL,      /**/ ICON: COMMON_ACTIONS.TASK_RUN_NEW_INSTANCE.ICON },
    // Прервать все работающие экземпляры задачи
    TASK_ABORT_ALL_INSTANCES   /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.ABORT_ALL_INSTANCES.CMD}`,   /**/ LABEL: COMMON_ACTIONS.ABORT_ALL_INSTANCES.LABEL,   /**/ ICON: COMMON_ACTIONS.ABORT_ALL_INSTANCES.ICON },
    // Перейти к терминалу задачи
    TASK_NAVIGATE_TO_TERMINAL  /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.NAVIGATE_TO_TERMINAL.CMD}`,  /**/ LABEL: COMMON_ACTIONS.NAVIGATE_TO_TERMINAL.LABEL,  /**/ ICON: COMMON_ACTIONS.NAVIGATE_TO_TERMINAL.ICON },
    // Открыть поиск по списку
    LIST_FIND                  /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.LIST_OPEN_FIND.CMD}`,        /**/ LABEL: COMMON_ACTIONS.LIST_OPEN_FIND.LABEL,        /**/ ICON: COMMON_ACTIONS.LIST_OPEN_FIND.ICON },
    // Развернуть все элементы списка
    LIST_EXPAND_ALL            /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.LIST_EXPAND_ALL.CMD}`,       /**/ LABEL: COMMON_ACTIONS.LIST_EXPAND_ALL.LABEL,       /**/ ICON: COMMON_ACTIONS.LIST_EXPAND_ALL.ICON },
    // Свернуть все элементы списка
    LIST_COLLAPSE_ALL          /**/: { ID: `${PROJECT_TREE_ID}.${COMMON_ACTIONS.LIST_COLLAPSE_ALL.CMD}`,     /**/ LABEL: COMMON_ACTIONS.LIST_COLLAPSE_ALL.LABEL,     /**/ ICON: COMMON_ACTIONS.LIST_COLLAPSE_ALL.ICON }
  },
  WHEN: {
    // true если в дереве есть элементы ("настоящие", не синтетические)
    HAS_ITEMS: `${PROJECT_TREE_ID}.${WHEN_TAG.HAS_ITEMS}`,
    // тип выделенного элемента или undefined
    SELECTED_NODE_TYPE: `${PROJECT_TREE_ID}.${WHEN_TAG.SELECTED_NODE_TYPE}`
  }
} as const;


export type SelectedNodeTag =
  | `TopNode:${'User' | 'Workspace' | 'Folder'}`
  | 'RunnableNode'
  | 'IntermediateNode'
  | 'UnknownNode';


export const CONFIG_SECTION = 'taskCockpit';

export const SETTING = {
  DECORATOR: {
    AVAILABLE_SYMBOL          /**/: `${CONFIG_SECTION}.decorator.availableSymbol`,
    BADGE_ORDER               /**/: `${CONFIG_SECTION}.decorator.badgeOrder`,
    OVERFLOW_SYMBOL           /**/: `${CONFIG_SECTION}.decorator.overflowSymbol`,
    RUNNING_SYMBOL            /**/: `${CONFIG_SECTION}.decorator.runningSymbol`
  },
  DISPLAY: {
    DEFAULT_ICON_NAME         /**/: `${CONFIG_SECTION}.display.defaultIconName`,
    GROUP_BY_TASK_GROUP       /**/: `${CONFIG_SECTION}.display.groupByTaskGroup`,
    SEGMENT_SEPARATOR         /**/: `${CONFIG_SECTION}.display.segmentSeparator`,
    TINT_LABEL                /**/: `${CONFIG_SECTION}.display.tintLabel`,
    USE_FOLDER_ICON           /**/: `${CONFIG_SECTION}.display.useFolderIcon`
  },
  FILTERING: {
    EXCLUDE_FOLDERS           /**/: `${CONFIG_SECTION}.filtering.excludeFolders`,
    SHOW_HIDDEN               /**/: `${CONFIG_SECTION}.filtering.showHidden`,
    SHOW_GLOBAL_TASKS         /**/: `${CONFIG_SECTION}.filtering.showUserLevelTasks`
  },
  PROCESS_MONITOR: {
    POLLING_ACCEL             /**/: `${CONFIG_SECTION}.processMonitor.polling.acceleration`,
    POLLING_CAP               /**/: `${CONFIG_SECTION}.processMonitor.polling.cap`,
    POLLING_MIN               /**/: `${CONFIG_SECTION}.processMonitor.polling.min`
  },
  TERMINALS: {
    TIMEOUT                    /**/: `${CONFIG_SECTION}.terminals.timeout`
  },
  DIAGNOSTICS: {
    SHADOWED_TASKS             /**/: `${CONFIG_SECTION}.diagnostics.shadowedTasks`,
    UNREACHABLE_DEPENDENCIES   /**/: `${CONFIG_SECTION}.diagnostics.unreachableDependencies`
  }

} as const;


type _ExtensionCommand = (typeof EXTENSION)['COMMAND'][keyof (typeof EXTENSION)['COMMAND']]['ID'];
type _UserTreeCommand = (typeof USER_TREE)['COMMAND'][keyof (typeof USER_TREE)['COMMAND']]['ID'];
type _ProjectTreeCommand = (typeof PROJECT_TREE)['COMMAND'][keyof (typeof PROJECT_TREE)['COMMAND']]['ID'];

export type CommandKey =
  | _ExtensionCommand
  | _UserTreeCommand
  | _ProjectTreeCommand
  ;
