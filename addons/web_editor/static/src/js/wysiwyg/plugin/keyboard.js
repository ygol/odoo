odoo.define('web_editor.wysiwyg.plugin.keyboard', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var Wysiwyg = require('web_editor.wysiwyg');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;

var KeyboardPlugin = AbstractPlugin.extend({
    events: {
        'summernote.keydown': '_onKeydown',
        'DOMNodeInserted .note-editable': '_checkForSpan',
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * 
     */
    appendEmptyPInto: function (node) {
        var p = this.document.createElement('p');
        p.innerHTML = '<br>';
        node.appendChild(p);
        return p;
    },
    /**
     * Clean up a node:
     * - combine all split text nodes
     * - remove all zero-width text nodes that are not at the end of the node,
     *   in an otherwise empty text node
     * - remove empty text nodes
     * - remove empty elements
     * 
     * @param {Object} node
     * @return {Object} Clean node
     */
    cleanNode: function (node) {
        if (dom.isText(node)) {
            return node;
        }
        var newNode = node;
        newNode.innerHTML = newNode.innerHTML.replace(/(?!\w)\u200B(?!$)/g, '');
        if (!this.context.invoke('HelperPlugin.isVisibleText', newNode.innerHTML)) {
            this.removeNode(node);
            return;
        }
        newNode.normalize();
        return newNode;
    },
    /**
     * 
     */
    getInfo: function (point, isInline) {
        var pred = isInline ? dom.isPara : dom.isBodyContainer;
        var ancestors = dom.listAncestor(point.node, pred);
        var container = ancestors[ancestors.length - 1] || point.node;
        container = container.tagName === 'UL' ? point.node : container;
        var pivot = container === point.node ? point.node.childNodes[point.offset] : false;
        return {
            rightNode: pivot,
            container: container,
        };
    },
    /**
     * 
     */
    isEmptyElement: function (element) {
        if (this.options.isUnbreakableNode(element) || element.tagName === 'BR') {
            return false;
        }
        var inside = dom.isText(element) ? element.textContent : element.innerHTML;
        return /^[\s\u00A0\u200B]*$/.test(inside);
    },
    /**
     * 
     */
    removeNode: function (node) {
        if (dom.isText(node)) {
            node.textContent = '';
        }
        if (node && node.parentNode) {
            return node.parentNode.removeChild(node);
        }
        return false;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Patch for Chrome's contenteditable SPAN bug.
     * 
     * @private
     * @param {jQueryEvent} e
     */
    _checkForSpan: function (e) {
        if (e.target.className === "" && e.target.tagName == "SPAN" &&
            e.target.style.fontStyle === "inherit" &&
            e.target.style.fontVariantLigatures === "inherit" &&
            e.target.style.fontVariantCaps === "inherit") {
            var $span = $(e.target);
            $span.after($span.contents()).remove();
        }
    },
    /**
     * 
     * @private
     */
    _deleteSelection: function () {
        var range = this.context.invoke('editor.createRange');
        if (range.isCollapsed()) {
            return;
        }
        var point = this.context.invoke('HelperPlugin.deleteBetween',
                        {node: range.sc, offset: range.so},
                        {node: range.ec, offset: range.eo});
        range.ec = range.sc = point.node;
        range.eo = range.so = point.offset;
        if (range.sc.parentNode.innerHTML === '') {
            range.sc = range.ec = range.sc.parentNode;
            range.sc.innerHTML = '<br/>';
            range.so = range.eo = 0;
        }
        range.normalize().select();
        this.context.invoke('editor.saveRange');
        return true;
    },
    /**
     * 
     * @private
     */
    _handleDeletion: function (direction) {
        var deleteNodes = this._deleteSelection();
        var range = this.context.invoke('editor.createRange');

        if (!range.sc.tagName && range.so === 1 && range.sc.textContent[0] === '\u200B') {
            range.sc.textContent = range.sc.textContent.slice(1);
            range.so = 0;
        }
        if (!range.sc.tagName && range.so === dom.nodeLength(range.sc) - 1 && range.sc.textContent.slice(range.so) === '\u200B') {
            range.sc.textContent = range.sc.textContent.slice(0, range.so);
        }

        if (deleteNodes) {
            direction = 'next';
        } else  if (direction === 'next' && range.so === dom.nodeLength(range.sc) || direction === 'prev' && range.so === 0) {
            var rest = this.context.invoke('HelperPlugin.deleteEdge', range.sc, direction);
            deleteNodes = !!rest;
            if (deleteNodes) {
                range.sc = range.ec = rest.node;
                range.so = range.eo = rest.offset;
            }
        }
        if (!deleteNodes) {
            // delete next char

            var method = direction === 'prev' ? 'prevPointUntil' : 'nextPointUntil';
            var hasBlock = false;
            var blockToRemove = false;

            var pt = dom[method]({node: range.sc, offset: range.so}, function (point) {
                if (!point.offset && this.context.invoke('HelperPlugin.isNodeBlockType', point.node)) {
                    hasBlock = true;
                }
                if (!blockToRemove && (!point.offset && dom.isMedia(point.node) || point.node.tagName === 'BR')) {
                    blockToRemove = point.node;
                    return false;
                }
                if (range.ec === point.node && range.eo === point.offset) {
                    return false;
                }
                return (this.context.invoke('HelperPlugin.isVisibleText', point.node) || dom.isMedia(point.node) || point.node.tagName === 'BR') && this.options.isEditableNode(point.node);
            }.bind(this));

            if (pt) {
                if (blockToRemove) {
                    if (blockToRemove.tagName !== "BR" || blockToRemove.parentNode.childNodes.length !== 1) { // keep the last br
                        $(blockToRemove).remove();
                    }
                } else if (!hasBlock) {
                    if (pt.offset && direction === 'next') {
                        pt.offset -= 1;
                    }
                    pt.node.textContent = pt.node.textContent.slice(0, pt.offset) + pt.node.textContent.slice(pt.offset + 1);
                    if (!pt.offset && direction === 'prev' && (!pt.node.previousSibling || pt.node.previousSibling.tagName === "BR")) {
                        pt.node.textContent = pt.node.textContent.replace(/^\s+/, '\u00A0');
                    }
                }

                range.sc = range.ec = pt.node;
                range.so = range.eo = pt.offset;
            }
        }

        while (range.sc.firstElementChild) {
            range.sc = range.sc.firstElementChild;
            range.so = 0;
        }

        if (range.sc.tagName && range.sc.tagName !== 'BR' && range.sc.innerHTML === '') {
            range.sc.innerHTML = '<br/>';
            range.ec = range.sc;
            range.so = range.eo = 0;
        } else if (range.sc.parentNode.innerHTML === '') {
            range.sc = range.ec = range.sc.parentNode;
            range.sc.innerHTML = '<br/>';
            range.so = range.eo = 0;
        }

        range.collapse(direction === 'prev').normalize().select();
        return true;
    },
    /**
     * Handle ENTER: split the first block parent of the node.
     * 
     * @return {boolean} true
     */
    _handleEnter: function () {
        var range = this.context.invoke('editor.createRange');

        var ancestor = dom.ancestor(range.sc, function (node) {
            return dom.isLi(node) || this.options.isUnbreakableNode(node.parentNode);
        }.bind(this));

        var point = {node: range.sc, offset: range.so};

        if (!point.node.tagName && this.options.isUnbreakableNode(point.node.parentNode)) {
            return this._handleShiftEnter();
        }


        if (point.node.tagName && point.node.childNodes[point.offset] && point.node.childNodes[point.offset].tagName === "BR") {
            point = dom.nextPoint(point);
        }
        if (point.node.tagName === "BR") {
            point = dom.nextPoint(point);
        }

        var next = this.context.invoke('HelperPlugin.splitTree', ancestor, point, {
            isSkipPaddingBlankHTML: !this.context.invoke('HelperPlugin.isNodeBlockType', point.node.parentNode) && !!point.node.parentNode.nextSibling
        });
        while (next.firstElementChild) {
            next = next.firstElementChild;
        }

         // if there is no block in the cut parents, then we add a br between the two node
        var hasSplitedBlock = false;
        var node = next;
        var lastChecked = node;
        while (node && node !== ancestor && node !== this.editable) {
            if (this.context.invoke('HelperPlugin.isNodeBlockType', node)) {
                hasSplitedBlock = true;
                break;
            }
            lastChecked = node;
            node = node.parentNode;
        }
        if (!hasSplitedBlock && lastChecked.tagName) {
            $(lastChecked).before(this.document.createElement('br'));
        }

        if (!next.tagName && next.textContent === "") {
            next.textContent = '\u200B';
        }
        if (next.tagName !== "BR" && next.innerHTML === "") {
            next.innerHTML = '\u200B';
        }

        // move to next editable area
        point = {node: next, offset: 0};
        if ((point.node.tagName && point.node.tagName !== 'BR') || !this.context.invoke('HelperPlugin.isVisibleText', point.node.textContent)) {
            point = dom.nextPointUntil(point, function (pt) {
                if (pt.node === point.node) {
                    return;
                }
                return (pt.node.tagName === "BR" || this.context.invoke('HelperPlugin.isVisibleText', pt.node)) && this.options.isEditableNode(pt.node);
            }.bind(this)) || {node: next, offset: 0};
            if (point.node.tagName === "BR") {
                point = dom.nextPoint(point);
            }
        }

        if (!hasSplitedBlock && !point.node.tagName) {
            point.node.textContent = '\u200B' + point.node.textContent;
            point.offset = 1;
        }

        range.sc = range.ec = point.node;
        range.so = range.eo = point.offset;
        range.normalize().select();

        return true;
    },
    /**
     * Handle SHIFT+ENTER: add a <br>
     * 
     * @private
     * @return {boolean} true
     */
    _handleShiftEnter: function () {
        var range = this.context.invoke('editor.createRange');
        var target = range.sc.childNodes[range.so] || range.sc;
        var before;
        if (target.tagName) {
            if (target.tagName === "BR") {
                before = target;
            } else if (target === range.sc) {
                if (range.so) {
                    before = range.sc.childNodes[range.so-1];
                } else {
                    before = this.document.createTextNode('');
                    $(range.sc).append(before);
                }
            }
        } else {
            before = target;
            var after = target.splitText(target === range.sc ? range.so : 0);
            if (!after.nextSibling && after.textContent === '' && this.context.invoke('HelperPlugin.isNodeBlockType', after.parentNode)) {
                after.textContent = '\u200B';
            }
            if (!after.tagName && (!after.previousSibling || after.previousSibling.tagName === "BR")) {
                after.textContent = after.textContent.replace(/^\s+/, '\u00A0');
            }
        }

        if (!before) {
            return true;
        }

        var br = this.document.createElement('br');
        $(before).after(br);
        var point = {node: br, offset: 0};
        var next = dom.nextPointUntil(point, function (pt) {
            if (pt.node === point.node && pt.node.tagName !== "BR") {
                return;
            }
            return (pt.node.tagName === "BR" || this.context.invoke('HelperPlugin.isVisibleText', pt.node)) && this.options.isEditableNode(pt.node);
        }.bind(this)) || point;

        if (next.node.tagName === "BR" && next.node.nextSibling && !next.node.nextSibling.tagName) {
            next.node.nextSibling.textContent = next.node.nextSibling.textContent.replace(/^\s+/, '\u00A0');
        }
        if (!next.node.tagName && (!next.node.previousSibling || next.node.previousSibling.tagName === "BR")) {
            next.node.textContent = next.node.textContent.replace(/^\s+/, '\u00A0');
        }

        range.sc = range.ec = next.node;
        range.so = range.eo = next.offset;
        range.select();

        return true;
    },
    /**
     * 
     * @private
     */
    _normalize: function () {
        this.editable.normalize();
        var range = this.context.invoke('editor.createRange');
        var rangeN = range.normalize();

        // normalize fail when br in text, and target the br instead of the point just after br.
        var point = rangeN.getStartPoint();
        if (point.node.tagName === "BR") {
            point = dom.nextPoint(point);
        }
        if (point.node.tagName && point.node.childNodes[point.offset]) {
            point = dom.nextPoint(point);
        }
        if (point.node.tagName === "BR") {
            point = dom.nextPoint(point);
        }
        if (point.node !== range.sc || point.offset !== range.so) {
            range.sc = range.ec = point.node;
            range.so = range.eo = point.offset;
            range.select();
        }
    },
    /**
     * 
     * @private
     */
    _preventTextInEditableDiv: function () {
        var range = this.context.invoke('editor.createRange');
        while (dom.isText(this.editable.firstChild) && !this.context.invoke('HelperPlugin.isVisibleText', this.editable.firstChild)) {
            this.removeNode(this.editable.firstChild);
        }
        var editableIsEmpty = !this.editable.childNodes.length;
        if (editableIsEmpty) {
            var p = this.appendEmptyPInto(this.editable);
            range.sc = range.ec = p;
            range.so = range.eo = 0;
        } else if (this.isEmptyElement(this.editable.firstChild) && !range.sc.parentNode) {
            this.editable.firstChild.innerHTML = '<br/>';
            range.sc = range.ec = this.editable.firstChild;
            range.so = range.eo = 0;
        }

        range.select();
    },

    //--------------------------------------------------------------------------
    // Handle
    //--------------------------------------------------------------------------

    /** 
     * Mapping to customize handling of certain keydown events.
     * 
     * @private
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     **/
    _onKeydown: function (se, e) {
        var handled = false;

        if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            this._onVisibleChar(e);
        } else {
            this.context.invoke('editor.beforeCommand');
            switch (e.keyCode) {
                case 8:  // BACKSPACE
                    handled = this._onBackspace(e);
                    break;
                case 9:  // TAB
                    handled = this._onTab(e);
                    break;
                case 13:  // ENTER
                    handled = this._onEnter(e);
                    break;
                case 46:  // DELETE
                    handled = this._onDelete(e);
                    break;
            }
            if (handled) {
                this._preventTextInEditableDiv();
                this._normalize();
                this.context.invoke('editor.saveRange');
                e.preventDefault();
                this.$editable.trigger('change');
            }
            this.context.invoke('editor.afterCommand');
        }
    },
    /**
     * Handle BACKSPACE keydown event
     * 
     * @private
     * @param {jQueryEvent} e
     * @return {boolean} true if case is handled and event default must be prevented
     */
    _onBackspace: function (e) {
        this._handleDeletion('prev');
        return true;
    },
    /**
     * Handle DELETE keydown event
     * 
     * @private
     * @param {jQueryEvent} e
     * @return {boolean} true if case is handled and event default must be prevented
     */
    _onDelete: function (e) {
        this._handleDeletion('next');
        return true;
    },
    /**
     * Handle ENTER keydown event
     * 
     * @private
     * @param {jQueryEvent} e
     * @return {boolean} true if case is handled and event default must be prevented
     */
    _onEnter: function (e) {
        this._deleteSelection();
        if (e.shiftKey) {
            this._handleShiftEnter();
        } else {
            this._handleEnter();
        }
        return true;
    },
    /**
     * Handle TAB keydown event: prevent it
     * 
     * @private
     * @param {jQueryEvent} e
     * @return {boolean} true if case is handled and event default must be prevented
     */
    _onTab: function (e) {
        if (!this.options.keyMap.pc.TAB) {
            this.trigger_up('wysiwyg_blur', {key: 'TAB', keyCode: 9, shiftKey: e.shiftKey});
            return true;
        }
        return false;
    },
    /**
     * Handle a visible char
     * 
     * @private
     * @param {jQueryEvent} e
     * @return {boolean} true if case is handled and event default must be prevented
     */
    _onVisibleChar: function (e) {
        e.preventDefault();
        this._deleteSelection();
        document.execCommand("insertText", 0, e.key || String.fromCharCode(e.keyCode));
        var range = this.context.invoke('editor.createRange');
        if (!range.sc.tagName && !dom.ancestor(range.sc, dom.isAnchor)) {
            if (range.sc.textContent.slice(range.so - 2, range.so -1) === '\u200B') {
                range.sc.textContent = range.sc.textContent.slice(0, range.so - 2) + range.sc.textContent.slice(range.so - 1);
                range.so = range.eo = range.so - 1;
                range.normalize().select();
            }
            if (range.sc.textContent.slice(range.so, range.so + 1) === '\u200B') {
                range.sc.textContent = range.sc.textContent.slice(0, range.so) + range.sc.textContent.slice(range.so + 1);
                range.normalize().select();
            }
        }
        return true;
    },
});

registry.add('KeyboardPlugin', KeyboardPlugin);

return KeyboardPlugin;
});
