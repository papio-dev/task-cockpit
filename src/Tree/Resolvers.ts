import * as vscode from 'vscode';
import {
    CountTDetail,
    CountWDetail,
    FolderRoot,
    WorkspaceRoot
} from './Basic';

function workspaceRoot(item: vscode.TreeItem, node: WorkspaceRoot, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {

    if (token.isCancellationRequested) {
        return item;
    }

    const foldersDetail = formatFoldersDetail(node.workspaceDetail);

    const tooltip = new vscode.MarkdownString(
        `**${node.segment}**  \n` +
        `${foldersDetail ? `$(root-folder) Folders: ${foldersDetail}  \n` : ''}` +
        `$(tools) Tasks: ${formatTasksDetail(node.tasksDetail, node.excluded)}  \n` +
        '\u00A0',
        true
    );
    tooltip.isTrusted = false;

    item.tooltip = tooltip;
    return item;
}


function folderRoot(item: vscode.TreeItem, node: FolderRoot, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {

    if (token.isCancellationRequested) {
        return item;
    }

    const tooltip = new vscode.MarkdownString(
        `**${node.segment}**  \n` +
        `$(tools) Tasks: ${formatTasksDetail(node.tasksDetail)}  \n` +
        '\u00A0',
        true
    );

    tooltip.isTrusted = false;
    item.tooltip = tooltip;
    return item;
}


function formatFoldersDetail(detail: CountWDetail): string {

    // No folders in this scope at all
    if (detail.all === 0) {
        return `*Workspace contains no folders*`;
    }

    const visible = detail.all - detail.excludes;

    // All folders in this scope are excluded
    if (visible === 0) {
        return `*All excluded* (excludes: \`${detail.excludes}\`)`;
    }

    // Some folders are excluded
    if (detail.excludes > 0) {
        return `\`${visible}\` (excludes: \`${detail.excludes}\`)`;
    }

    // No excluded folders
    return `\`${detail.all}\``;
}


function formatTasksDetail(detail: CountTDetail, excluded: boolean = false): string {

    // This scope is excluded from display
    if (excluded) {
        return `*No tasks to display*${detail.all > 0 ? ` (excludes: \`${detail.all}\`)` : ''}`;
    }

    // No tasks in this scope at all
    if (detail.all === 0) {
        return `*None in this scope*`;
    }

    const visible = detail.all - detail.hidden;

    // All tasks in this scope are hidden
    if (visible === 0) {
        return `*All hidden* (hidden: \`${detail.hidden}\`)`;
    }

    // Some tasks are hidden
    if (detail.hidden > 0) {
        return `\`${visible}\` (hidden: \`${detail.hidden}\`)`;
    }

    // No hidden tasks
    return `\`${detail.all}\``;
}


export const Resolvers = {
    folderRoot,
    workspaceRoot
};
