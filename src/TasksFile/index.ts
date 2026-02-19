import { DiagnosticsManager } from "./DiagnosticsManager";
import { dependencies } from "./Checkers/Dependencies";
import { duplicates } from "./Checkers/Duplicates";
import { openTask } from "./OpenTask";

export const TasksFile = {
    openTask,
    DiagnosticsManager,
};


export const Checkers = {
    duplicates,
    dependencies
};
