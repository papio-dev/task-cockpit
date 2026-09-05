/** @file TreeViewPanel/TreeView/formatTooltip.ts */

import {
    MarkdownString
} from 'vscode';


function formatTooltip(
    title: string | undefined | null,
    label: string | undefined | null,
    detail: string | undefined | null
): MarkdownString | undefined {

    if (!title && !label && !detail) {
        return undefined;
    }

    const tooltipMd = new MarkdownString();
    tooltipMd.isTrusted = false;
    tooltipMd.supportHtml = true;
    tooltipMd.supportThemeIcons = true;

    const titleRow =
        title
            ? `<tr><td><small><i>${title}</i></small></td></tr>`
            : '';

    const labelRow =
        label
            ? `<tr><td><b>${escapeHtml(label)}</b></td></tr>`
            : '';

    const firstLine = detail
        ?.split('\n')
        .map(line => line.trim())
        .find(line => line.length > 0);

    const widthTag =
        (firstLine?.length ?? 0) > 42
            ? 'width="100%"'
            : 'width="237"';

    if (titleRow || labelRow) {
        tooltipMd.appendMarkdown(`<table ${widthTag}>${titleRow}${labelRow}</table>`);
    }

    tooltipMd.appendMarkdown(detail ? `\n\n${escapeHtml(detail)}` : '');

    return tooltipMd;
}


function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default formatTooltip;
