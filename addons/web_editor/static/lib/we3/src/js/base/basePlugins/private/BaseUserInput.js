(function () {
'use strict';

var navigationKey = [
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'PageUp',
    'PageDown',
    'End',
    'Home',
];

var BaseUserInput = class extends we3.AbstractPlugin {
    static get autoInstall () {
        return [];
    }
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseArch', 'BaseRange', 'BaseRenderer', 'UserInput'];
        this.editableDomEvents = {
            keydown: '_onKeyDown',
            keypress: '_onKeyDown',
            input: '_onInput',
            compositionend: '_onCompositionEnd',
            mousedown: '_onMouseDown',
            touchstart: '_onMouseDown',
        };
        var self = this;
        this.documentDomEvents = {
            selectionchange: '_onSelectionChange',
            click: '_onClick',
            touchend: '_onClick',
            contextmenu: '_onContextMenu',
        };
        this._keydownNavigationKey = [];
    }
    willStart () {
        var self = this;
        this._observer = new MutationObserver(function onMutation (mutationsList, observer) {
            if (self._currentEvent) {
                self._currentEvent.mutationsList = self._currentEvent.mutationsList.concat(mutationsList);
            }
        });
        this._observer.observe(this.editable, {
            characterData: true,
            childList: true,
            subtree: true,
        });
        return super.willStart();
    }
    blurEditor () {
        this._editorFocused = false;
    }
    focusEditor () {
        this._editorFocused = true;
    }
    destroy () {
        this._observer.disconnect();
        super.destroy();
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Add a newline at range: split a paragraph if possible, after
     * removing the selection if needed.
     */
    _addLine () {
        var self = this;
        return this.dependencies.BaseArch.do(function () {
            var range = self.dependencies.BaseRange.getRange();
            var id, offset;
            if (range.isCollapsed()) {
                id = range.scID;
                offset = range.so;
            } else {
                id = self.dependencies.BaseArch.removeFromRange().id;
                offset = 0;
            }
            self.dependencies.BaseArch.nextChangeIsRange();
            self.dependencies.BaseArch.getArchNode(id).addLine(offset);
            return false; // default behavior of range from `Arch._processChanges`
        });
    }
    _beginToStackEventDataForNextTick (e) {
        if (this._currentEvent) {
            this._currentEvent.events.push(e);
            return this._currentEvent;
        }
        this._currentEvent = {
            type: null,
            key: 'Unidentified',
            data: '',
            shiftKey: false,
            ctrlKey: false,
            mutationsList: [],
            defaultPrevented: false,
            events: [e],
        };
        setTimeout(this._tickAfterUserInteraction.bind(this));
        return this._currentEvent;
    }
    _eventsNormalization (param) {
        var ev = {
            preventDefault: function () {
                param.defaultPrevented = true;
            },
            get defaultPrevented () {
                return param.defaultPrevented;
            }
        };

        if (navigationKey.indexOf(param.key) !== -1) {
            ev.name = 'move';
            ev.data = param.key;
            ev.shiftKey = param.shiftKey;
            ev.ctrlKey = param.ctrlKey;
            ev.altKey = param.altKey;
        } else if (param.type === 'move') {
            ev.name = 'move';
            ev.data = param.data;
            ev.targetID = param.targetID;
        } else if (param.type === 'composition') {
            ev.data = param.data;
            // previous.update = audroid update for each char
            // param.data[0] !== ' ' = audio insertion
            ev.previous = param.data[0] !== ' ' && param.previous && param.previous.update ? param.previous.data : false;
            ev.name = 'composition';
        } else {
            ev.shiftKey = param.shiftKey;
            ev.ctrlKey = param.ctrlKey;
            ev.altKey = param.altKey;
            if (param.key === 'Backspace') {
                ev.name = 'Backspace';
            } else if (param.key === 'Delete') {
                ev.name = 'Delete';
            } else if (param.key === 'Tab') {
                ev.name = 'Tab';
            } else if (param.key === 'Enter') {
                ev.name = 'Enter';
            } else if ((!param.ctrlKey && !param.altKey || param.inputType === 'insertText') &&
                    (param.data && param.data.length === 1 || param.key && param.key.length === 1 || param.key === 'Space')) {
                ev.data = param.data && param.data.length === 1 ? param.data : param.key;
                if (param.data === 'Space') {
                    param.data = ' ';
                }
                ev.name = 'char';
            }
        }

        if (!ev.name) {
            ev = Object.assign({
                preventDefault: ev.preventDefault,
            }, param);
            ev.name = 'default';
        }

        return ev;
    }
    async _eventsdDispatcher (ev, mutationsList) {
        this.dependencies.UserInput.trigger(ev.name, ev);

        if (ev.defaultPrevented && ev.name !== 'move') {
            return this._redrawToRemoveArtefact(mutationsList);
        }

        if (ev.name === 'composition') {
            await this._pressInsertComposition(ev);
        } else if (ev.name === 'Backspace') {
            await this._removeSide(true);
        } else if (ev.name === 'Delete') {
            await this._removeSide(false);
        } else if (ev.name === 'Tab') {
            await this._pressInsertTab(ev);
        } else if (ev.name === 'Enter') {
            await this._pressInsertEnter(ev);
        } else if (ev.name === 'char') {
            await this._pressInsertChar(ev);
        } else if (ev.name === 'move') {
            await this._pressMove(ev);
        }

        if (ev.name !== 'move') {
            await this._redrawToRemoveArtefact(mutationsList);
        }
    }
    _findOffsetInsertion (text, offset, insert) {
        var prevIndex = offset;
        var globalIndex = 0;
        do {
            var index = text.substring(globalIndex).indexOf(insert);
            if (index === -1) {
                break;
            }
            index += globalIndex;
            globalIndex = index + 1;

            if (prevIndex >= index && prevIndex <= index + insert.length) {
                return index + insert.length;
            }
        } while (globalIndex < text.length);

        return -1;
    }
    _isOffsetLeftEdge (range) {
        var pointArch = this._skipVirtual({
            archNode: range.scArch,
            offset: range.so,
        });
        return !pointArch.offset && range.isCollapsed() && pointArch.archNode
    }
    _isOnLeftEdgeOf (ancestorOrMethodName, range) {
        var ancestor = typeof ancestorOrMethodName === 'string' ? range.scArch.ancestor(ancestorOrMethodName) : ancestorOrMethodName;
        return ancestor && range.scArch.isLeftEdgeOf(ancestor, true) && this._isOffsetLeftEdge(range);
    }
    _isSelectAll (rangeDOM) {
        var sc = rangeDOM.sc;
        var so = rangeDOM.so;
        var ec = rangeDOM.ec;
        var eo = rangeDOM.eo;

        if (rangeDOM.isCollapsed() || !sc || !ec) {
            return false;
        }
        if (!this.document.body.contains(sc) || !this.document.body.contains(ec)) {
            return false;
        }
        if (sc.childNodes[so]) {
            sc = sc.childNodes[so];
            so = 0;
        }
        if (ec.childNodes[eo]) {
            ec = ec.childNodes[eo];
        }
        if (so !== 0 || ec.nodeType === 3 && eo !== ec.textContent.length) {
            return false;
        }

        function isVisible (el) {
            if (el.tagName === 'WE3-EDITABLE') {
                return true;
            }
            var style = window.getComputedStyle(el.parentNode);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            return isVisible(el.parentNode);
        }

        var el;
        if (this.editable.contains(sc)) {
            el = this.editable;
            while (el) {
                if (el === sc) {
                    break;
                }
                if (el.nodeType === 3 && isVisible(el.parentNode)) {
                    return false;
                }
                if (el.firstChild) {
                    el = el.firstChild;
                } else if (el.nextSibling) {
                    el = el.nextSibling;
                } else if (el.parentNode !== this.editable) {
                    el = el.parentNode.nextSibling;
                } else {
                    el = null;
                }
            }
        }

        if (this.editable.contains(ec)) {
            el = this.editable;
            while (el) {
                if (el === ec) {
                    break;
                }
                if (el.nodeType === 3 && isVisible(el)) {
                    return false;
                }
                if (el.lastChild) {
                    el = el.lastChild;
                } else if (el.previousSibling) {
                    el = el.previousSibling;
                } else if (el.parentNode !== this.editable) {
                    el = el.parentNode.previousSibling;
                } else {
                    el = null;
                }
            }
        }
        return true;
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertChar (param) {
        if (param.data === ' ') {
            return this.dependencies.BaseArch.insert(this.utils.char('nbsp'));
        } else if (param.data.charCodeAt(0) === 10) {
            return this.dependencies.BaseArch.insert('<br/>');
        } else {
            return this.dependencies.BaseArch.insert(param.data);
        }
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertComposition (param) {
        var self = this;
        var BaseArch = this.dependencies.BaseArch;
        var BaseRenderer = this.dependencies.BaseRenderer;
        var BaseRange = this.dependencies.BaseRange;

        return BaseArch.do(function () {
            var range = BaseRange.getRange();
            var archNode = BaseArch.getArchNode(range.scID);
            var arch = archNode.ancestor('isFormatNode') || archNode.ancestor('isUnbreakable');
            var formatNode = BaseRenderer.getElement(arch.id);

            if (!formatNode) {
                return false; // default behavior of range from `Arch._processChanges`
            }

            var lastTextNodeID;
            var lastTextNodeOldValue;
            var newArch = BaseArch.parse(formatNode.cloneNode(true));
            newArch.nextUntil(function (archNode) {
                if (!archNode.isText()) {
                    return;
                }
                var target = arch.applyPath(archNode.path(newArch));
                if (target && target.isText()) {
                    lastTextNodeOldValue = target.nodeValue;
                    lastTextNodeID = target.id;

                    if (range.scID === lastTextNodeID && param.previous) {
                        // eg: 'paaa' from replacement of 'a' in 'aa' ==> must be 'paa'
                        var previous = param.previous ? param.previous.replace(/\u00A0/g, ' ') : '';
                        var beforeRange = lastTextNodeOldValue.replace(/\u00A0/g, ' ').slice(0, range.so);
                        var afterRange = lastTextNodeOldValue.replace(/\u00A0/g, ' ').slice(range.so);
                        if (previous && beforeRange.slice(-previous.length) === previous) {
                            beforeRange = beforeRange.slice(0, -previous.length);
                        }
                        archNode.nodeValue = beforeRange + param.data + afterRange;
                    }

                    target.setNodeValue(archNode.nodeValue);
                } else if (target && target.isBR()) {
                    var res = target.insert(archNode.params.create(null, null, archNode.nodeValue));
                    lastTextNodeOldValue = archNode.nodeValue;
                    lastTextNodeID = res[0] && res[0].id;
                }
            }, {doNotLeaveNode: true});

            if (lastTextNodeID) {
                var archNode = BaseArch.getArchNode(lastTextNodeID);
                var lastTextNodeNewValue = archNode.nodeValue.replace(/\u00A0/g, ' ');
                var newOffset = lastTextNodeNewValue.length;

                param.data = param.data.replace(/\u00A0/g, ' ');
                if (lastTextNodeID === range.scID) {
                    var offset = 0;
                    if (lastTextNodeID === range.scID) {
                        offset = range.so;
                        if (lastTextNodeOldValue.length > lastTextNodeNewValue.length) {
                            offset -= lastTextNodeOldValue.length - lastTextNodeNewValue.length;
                            if (offset < 0) {
                                offset = 0;
                            }
                        }
                    }

                    var newOffset = self._findOffsetInsertion(lastTextNodeNewValue, offset, param.data);
                    newOffset = newOffset !== -1 ? newOffset : offset;

                    if (lastTextNodeNewValue[newOffset] === ' ') {
                        newOffset++;
                    }
                }

                newOffset = Math.min(newOffset, archNode.nodeValue.length);
                return {
                    scID: lastTextNodeID,
                    so: newOffset,
                };
            }

            var lastLeaf = formatNode.lastLeaf();
            if (lastLeaf) {
                return {
                    scID: lastLeaf.id,
                    so: lastLeaf.length(),
                };
            }

            var rangeDOM = BaseRange.getRangeFromDOM();
            if (rangeDOM && rangeDOM.scID && rangeDOM.scArch.length() <= rangeDOM.so) {
                return {
                    scID: rangeDOM.scID,
                    so: rangeDOM.so,
                };
            }
            return false; // default behavior of range from `Arch._processChanges`
        });
    }
    /**
     * @private
     * @param {object} param
     */
    _pressInsertEnter (param) {
        var BaseArch = this.dependencies.BaseArch;
        var BaseRange = this.dependencies.BaseRange;

        if (param.shiftKey) {
            return BaseArch.insert('<br/>');
        } else {
            var range = BaseRange.getRange();
            var liAncestor = range.scArch.ancestor('isLi');
            var isInEmptyLi = range.isCollapsed() && liAncestor && liAncestor.isDeepEmpty();
            if (isInEmptyLi) {
                return BaseArch.outdent();
            } else {
                return this._addLine();
            }
        }
    }
    /**
     * Insert a TAB (4 non-breakable spaces).
     *
     * @private
     * @param {object} param
     */
    _pressInsertTab (param) {
        if (this.options.tab && !this.options.tab.enabled) {
            return;
        }
        if (param.shiftKey || param.ctrlKey || param.altKey) {
            return;
        }
        var tabSize = this.options.tab && this.options.tab.size || 0;
        var tab = new Array(tabSize).fill(this.utils.char('nbsp')).join('');
        return this.dependencies.BaseArch.insert(tab);
    }
    _pressMove (param) {
        if (param.defaultPrevented) {
            return this.dependencies.BaseRange.restore();
        }
        if (param.data === 'SelectAll') {
            return this.dependencies.BaseRange.selectAll();
        } else if (navigationKey.indexOf(param.data) !== -1) {
            var isLeftish = ['ArrowUp', 'ArrowLeft', 'PageUp', 'Home'].indexOf(param.data) !== -1;
            return this._setRangeFromDOM({
                moveLeft: isLeftish,
                moveRight: !isLeftish,
            });
        } else if (param.targetID) {
            this.dependencies.BaseRange.setRange({
                scID: param.targetID,
                so: 0,
            });
        } else {
            return this._setRangeFromDOM();
        }
    }
    _redrawToRemoveArtefact (mutationsList) {
        var BaseRenderer = this.dependencies.BaseRenderer;
        var BaseRange = this.dependencies.BaseRange;

        // mark as dirty the new nodes to re-render it
        // because the browser can split other than our arch and we must fix the errors
        var targets = [];
        mutationsList.forEach(function (mutation) {
            if (mutation.type == 'characterData' && targets.indexOf(mutation.target) === -1) {
                targets.push(mutation.target);
            }
            if (mutation.type == 'childList') {
                mutation.addedNodes.forEach(function (target) {
                    if (targets.indexOf(target) === -1) {
                        targets.push(target);
                    }
                });
                mutation.removedNodes.forEach(function (target) {
                    if (targets.indexOf(target) === -1) {
                        targets.push(target);
                    }
                });
            }
        });

        targets.forEach(function (target) {
            var id = BaseRenderer.getID(target);
            if (id) {
                BaseRenderer.markAsDirty(id, {childNodes: true, nodeValue: true});
            } else if (target.parentNode) {
                target.parentNode.removeChild(target);
            }
        });

        if (targets.length) {
            BaseRenderer.redraw({forceDirty: false});
            BaseRange.restore();
        }
    }
    _skipVirtual (pointArch) {
        if (pointArch.archNode.isVirtual()) {
            pointArch.archNode = pointArch.archNode.nextUntil(pointArch.archNode.isNotVirtual);
            pointArch.offset = 0;
        }
        return pointArch;
    }
    /**
     * Set the range from the selection in the DOM.
     *
     * @private
     * @param {Object} [options]
     * @param {Boolean} [options.moveLeft] true if a movement is initiated from right to left
     * @param {Boolean} [options.moveRight] true if a movement is initiated from left to right
     */
    _setRangeFromDOM (options) {
        var range = this.dependencies.BaseRange.getRangeFromDOM();
        if (!range.scID || range.scArch && (range.scArch.type === 'TEXT-VIRTUAL' ? 1 : range.scArch.length()) < range.so ||
            !range.ecID || range.ecArch && (range.ecArch.type === 'TEXT-VIRTUAL' ? 1 : range.ecArch.length()) < range.eo) {
            console.warn("Try to take the range from DOM but does not seem synchronized", range);
            return;
        }
        range = this._voidoidSelectToWE3(range);
        this.dependencies.BaseRange.setRange(range, options);
    }
    async _tickAfterUserInteraction () {
        var param = this._currentEvent;
        param.previous = this._previousEvent;
        this._previousEvent = param;
        this._currentEvent = null;
        var ev = this._eventsNormalization(param);
        await this._eventsdDispatcher(ev, param.mutationsList);
    }
    /**
     * Remove to the side of the current range.
     *
     * @private
     * @param {Boolean} isLeft true to remove to the left
     */
    _removeSide (isLeft) {
        var self = this;
        return this.dependencies.BaseArch.do(function () {
            var range = self.dependencies.BaseRange.getRange();
            if (range.isCollapsed()) {
                var offset = range.so;
                var node = self.dependencies.BaseArch.getArchNode(range.scID);
                var next = node[isLeft ? 'removeLeft' : 'removeRight'](offset);
                if (next) {
                    next.lastLeaf().deleteEdge(true, {
                        doNotBreakBlocks: true,
                    });
                }
             } else {
                var virtualText = self.dependencies.BaseArch.removeFromRange();
                virtualText.parent.deleteEdge(false,  {
                    keepRight: true,
                });
            }
            return false; // default behavior of range from `Arch._processChanges`
        });
    }
    /**
     * Convert a native voidoid selection to ensure deepest selection.
     * For a native range, we need to select the voidoid from within its parent.
     * In we3, a selected voidoid is within the voidoid.
     *
     * @private
     * @see BaseRange._voidoidSelectToNative
     * @param {object} range
     * @param {ArchNode} range.scArch
     * @param {number} range.so
     * @param {ArchNode} range.ecArch
     * @param {number} range.eo
     * @returns {object} {scID, so, ecID, eo}
     */
    _voidoidSelectToWE3 (range) {
        if (!range.scArch || !range.ecArch || range.isCollapsed()) {
            return range;
        }
        var startIsBeforeVoidoid = range.scArch.isText() &&
            range.so === range.scArch.length() && range.scArch.nextSibling() &&
            range.scArch.nextSibling().isVoidoid();
        var endIsAfterVoidoid = range.ecArch.isText() && range.eo === 0 &&
            range.ecArch.previousSibling() &&
            range.ecArch.previousSibling().isVoidoid()
        if (startIsBeforeVoidoid && endIsAfterVoidoid) {
            range.scID = range.scArch.nextSibling().id;
            range.so = 0;
            range.ecID = range.ecArch.previousSibling().id;
            range.eo = 0;
        }
        return range;
    }

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {MouseEvent} e
     */
    _onCompositionEnd (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        var param = this._beginToStackEventDataForNextTick(e);
        param.type = 'composition';
        param.update = false;
        param.data = e.data;
    }
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onContextMenu (e) {
        this._mousedownInEditable = false;
    }
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onInput (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        var param = this._beginToStackEventDataForNextTick(e);

        if (!param.type) {
            param.type = e.type;
            param.data = e.data;
        }

        // todo: delete word <=> composition

        if (e.inputType === 'insertCompositionText' || e.inputType === 'insertReplacementText') {
            param.update = param.update || param.type !== 'composition';
            param.type = 'composition';
            param.data = e.data;
        } else if (e.inputType === 'insertParagraph' && param.key === 'Unidentified') {
            param.key = 'Enter';
        } else if (e.inputType === 'deleteContentBackwards' && param.key === 'Unidentified') {
            param.key = 'Backspace';
        } else if (e.inputType === 'deleteContentForward' && param.key === 'Unidentified') {
            param.key = 'Delete';
        } else if (!param.data) {
            param.data = e.data;
        } else if (e.inputType === "insertText") {
            if (param.type.indexOf('key') === 0 && param.key.length === 1 && e.data.length === 1) {
                param.key = e.data; // keep accent
            } else if(e.data && e.data.length === 1 && e.data !== param.data && param.type === 'composition') {
                // swiftKey add automatically a space after the composition, without this line the arch is correct but not the range
                param.data += e.data;
            } else if (param.key === 'Unidentified') {
                param.key = e.data;
            }
        }
    }
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onKeyDown (e) {
        if (this.editable.style.display === 'none') {
            return;
        }
        if (e.type === 'keydown' && e.key === 'Dead') {
            return;
        }
        var param = this._beginToStackEventDataForNextTick(e);
        param.defaultPrevented = param.defaultPrevented || e.defaultPrevented;
        param.type = param.type || e.type;
        param.shiftKey = e.shiftKey;
        param.ctrlKey = e.ctrlKey;
        param.altKey = e.altKey;
        param.key = e.key;
    }
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onMouseDown (e) {
        this._previousEvent = null;
        this._mousedownInEditable = e;
    }
    /**
     * @private
     * @param {MouseEvent} e
     */
    async _onClick (e) {
        if (!this._mousedownInEditable) {
            return;
        }
        await new Promise(setTimeout);

        var ev = {
            type: 'move',
            data: 'MouseEvent',
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            defaultPrevented: e.target.closest('a') ? false : e.defaultPrevented, // because we must prevent default the link to avoid change page
        };

        var archNodeID = this.dependencies.BaseRenderer.getID(this._mousedownInEditable.target);
        var archNode = archNodeID && this.dependencies.BaseArch.getArchNode(archNodeID);
        var voidoid = archNode && archNode.ancestor('isVoidoid', true);

        if (voidoid) {
            if (this._mousedownInEditable.target !== e.target) {
                archNodeID = this.dependencies.BaseRenderer.getID(e.target);
                archNode = archNodeID && this.dependencies.BaseArch.getArchNode(archNodeID);
                voidoid = archNode && archNode.ancestor('isVoidoid', true);
            }
        }
        if (voidoid) {
            ev.targetID = voidoid && voidoid.id;
        } else {
            var range = this.dependencies.BaseRange.getRange();
            var rangeDOM = this.dependencies.BaseRange.getRangeFromDOM();
            if (range.sc === rangeDOM.sc && range.so === rangeDOM.so &&
                range.ec === rangeDOM.ec && range.eo === rangeDOM.eo) {
                return;
            }
        }

        this._eventsdDispatcher(this._eventsNormalization(ev), []);
        if (!ev.defaultPrevented) {
            this._mousedownInEditable = false;
            return;
        }
        if (!this.editor.contains(e.target) || this.editable === e.target || this.editable.contains(e.target)) {
            this._mousedownInEditable = false;
            return;
        }
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            this.editable.focus();
            this.dependencies.BaseRange.restore();
        }
        this._mousedownInEditable = false;
    }
    /**
     * @private
     * @param {MouseEvent} e
     */
    _onSelectionChange (e) {
        if (!this._editorFocused || this._mousedownInEditable || this.editable.style.display === 'none') {
            return;
        }
        var range = this.dependencies.BaseRange.getRange();
        var rangeDOM = this.dependencies.BaseRange.getRangeFromDOM();
        if (range.sc === rangeDOM.sc && range.so === rangeDOM.so &&
            range.ec === rangeDOM.ec && range.eo === rangeDOM.eo) {
            return;
        }
        if (!this._isSelectAll(rangeDOM)) {
            return;
        }
        var param = this._currentEvent || {};
        param.type = 'move';
        param.data = 'SelectAll';
        if (!this._currentEvent) {
            var ev = this._eventsNormalization(param);
            this._eventsdDispatcher(ev, []);
        }
    }
};

we3.pluginsRegistry.BaseUserInput = BaseUserInput;

})();
