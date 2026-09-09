/** @file TreeViewPanel/TreeView/Element/Element.ts */

import type Immutable from '../../../utils/Immutable';
import EmptyElement from './EmptyElement';
import IntermediateElement from './IntermediateElement';
import RunnableElement from './RunnableElement';
import TopElement from './TopElement';


type Element =
    | EmptyElement
    | IntermediateElement
    | RunnableElement
    | TopElement;


declare namespace Element {
    type Empty = EmptyElement;
    type Intermediate = IntermediateElement;
    type Runnable = RunnableElement;
    type Top = TopElement;
}


function isSynthetic(element: Immutable<Element>): element is Immutable<Element.Top | Element.Empty> {
    return 'kind' in element;
}


function isTop(element: Immutable<Element.Top | Element.Empty>): element is Immutable<Element.Top> {
    return element.kind === 'TopNode';
}


function isEmpty(element: Immutable<Element.Top | Element.Empty>): element is Immutable<Element.Empty> {
    return element.kind === 'EmptyNode';
}


function isRunnable(element: Immutable<Element.Runnable | Element.Intermediate>): element is Immutable<Element.Runnable> {
    return element.data != null;
}

const Element = {
    Empty: EmptyElement,
    Intermediate: IntermediateElement,
    Runnable: RunnableElement,
    Top: TopElement,
    isTopElement: isTop,
    isSynthetic,
    isEmptyElement: isEmpty,
    isRunnable
};

export default Element;
