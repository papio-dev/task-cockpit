interface TaskVisualMetadata {
    color?: string | undefined,
    processes?: number,
    running?: number;
    special?: 'empty' | 'broken';
}


type QueryComponent = string;


export function encodeQueryComponent(queryMetadata: TaskVisualMetadata): QueryComponent {
    return encodeURIComponent(JSON.stringify(queryMetadata)) as QueryComponent;
}


export function decodeQueryComponent(queryComponent: QueryComponent): TaskVisualMetadata | undefined {

    const queryMetadata = JSON.parse(decodeURIComponent(queryComponent));
    if (typeof queryMetadata !== 'object') {
        return undefined;
    }
    return queryMetadata;
}
