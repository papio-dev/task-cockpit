Рабочая область содержит одинаковые задачи во всех
областях, но с разными настройками для каждой области.

- workspace:
    "taskCockpit.display.segmentSeparator" : "",
    "taskCockpit.display.useGroupKind"     : true,
    "taskCockpit.filtering.showHidden"       : false,
    "taskCockpit.display.defaultIconName"  : ""

- FolderA:
	"taskCockpit.display.segmentSeparator" : <отсутствует>,
	"taskCockpit.display.useGroupKind"     : <отсутствует>,
	"taskCockpit.filtering.showHidden"       : <отсутствует>,
    "taskCockpit.display.defaultIconName"  : <отсутствует>

- FolderB:
    "taskCockpit.display.segmentSeparator" : "/",
    "taskCockpit.display.useGroupKind"     : false,
    "taskCockpit.filtering.showHidden"       : true,
    "taskCockpit.display.defaultIconName"  : "alert"

- FolderC:
    "taskCockpit.display.segmentSeparator" : ":",
    "taskCockpit.display.useGroupKind"     : false,
    "taskCockpit.filtering.showHidden"       : false,
    "taskCockpit.display.defaultIconName"  : "info"
