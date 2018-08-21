odoo.define('web_editor.wysiwyg.plugin.unbreakable', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;

//--------------------------------------------------------------------------
// unbreakable node preventing editing
//--------------------------------------------------------------------------

var Unbreakable = AbstractPlugin.extend({
    events: {
        'wysiwyg.range .note-editable': '_onRange',
        'summernote.mouseup': '_onMouseUp',
        'summernote.keyup': '_onKeyup',
        'summernote.keydown': '_onKeydown',
        // 'summernote.focusnode': '_onFocusnode', => add this event to summernote.
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /*
     * trigger an focusnode event when the focus enter in an other node
     *
     * @param {DOM} se
     */
    _focusNode: function (node) {
        if (!node.tagName) {
            node = node.parentNode;
        }
        if (this._focusedNode !== node) {
            this._focusedNode = node;
            this.context.triggerEvent('focusnode', node);
        }
    },
    /*
     * change the selection if it's break an unbreakable node
     *
        <unbreakable id="a">
            content_1
            <unbreakable id="b">content_2</unbreakable>
            <allow id="c">
                content_3
                <unbreakable id="d">content_4</unbreakable>
                <unbreakable id="e">
                    content_5
                    <allow id="f">content_6</allow>
                    content_7
                </unbreakable>
                content_8
            </allow>
            <unbreakable id="f">content_9</unbreakable>
            <allow id="g">
                content_10
                <unbreakable id="h">content_11</unbreakable>
                content_12
            </allow>
        </unbreakable>

        START            END            RESIZE START     RESIZE END

        content_1       content_1       content_3       content_3   (find the first allowed node)
        content_1       content_2       content_3       content_3
        content_1       content_3       content_3       -
        content_3       content_3       -               -           (nothing to do)
        content_3       content_8       -               -           (can remove unbreakable node)
        content_3       content_4       -               content_3
        content_3       content_5       -               #d          (can select the entire unbreakable node)
        content_5       content_8       content_6       content_6
        content_5       content_7       #e              #e          (select the entire unbreakable node)
        content_6       content_8       -               content_6
        content_7       content_8       -               content_8
        content_9       content_12      content_10      -
     *
     * @returns {WrappedRange}
     */
    _secureRange: function () {
        var self = this;
        var range = this.context.invoke('editor.createRange');
        var isCollapsed = range.isCollapsed();
        var needReselect = false;

        // move the start selection to an allowed node
        var startPoint = dom.nextPointUntil({node: range.sc, offset: range.so}, function (point) {
            return self.options.isEditableNode(point.node) && dom.isVisiblePoint(point);
        });
        if (!startPoint) { // no allowed node, search the other way
            startPoint = dom.prevPointUntil({node: range.sc, offset: range.so}, function (point) {
                return self.options.isEditableNode(point.node) && dom.isVisiblePoint(point);
            });
        }

        if (startPoint && (startPoint.node !== range.sc || startPoint.offset !== range.so)) {
            needReselect = true;
            range.sc = startPoint.node;
            range.so = startPoint.offset;
            if (isCollapsed) {
                range.ec = range.sc;
                range.eo = range.so;
            }
        }

        if (!isCollapsed) { // mouse selection or key selection with shiftKey
            var point = {node: range.ec, offset: range.eo};
            var endPoint;

            // if the start point are moved after the end point
            var toCollapse = !dom.prevPointUntil(point, function (point) {
                return point.node === range.sc && point.offset === range.so;
            });

            if (!toCollapse) {
                // find the allowed ancestor
                var commonUnbreakableParent = dom.ancestor(range.sc, this.options.isUnbreakableNode.bind(this));
                if (!commonUnbreakableParent) {
                    commonUnbreakableParent = this.editable;
                }

                var lastCheckedNode;
                if (point.offset === dom.nodeLength(point.node)) {
                    point = dom.nextPoint(point);
                }

                // move the end selection to an allowed node in the allowed ancestor
                endPoint = dom.prevPointUntil(point, function (point) {
                    if (point.node === range.sc && point.offset === range.so) {
                        return true;
                    }
                    if (lastCheckedNode === point.node) {
                        return false;
                    }

                    // select the entirety of the unbreakable node
                    if (point.node.tagName && point.offset && $.contains(commonUnbreakableParent, point.node) && self.options.isUnbreakableNode(point.node)) {
                        return true;
                    }

                    var unbreakableParent = dom.ancestor(point.node, self.options.isUnbreakableNode.bind(self));
                    if (!unbreakableParent) {
                        unbreakableParent = self.editable;
                    }

                    if (commonUnbreakableParent !== unbreakableParent) {
                        lastCheckedNode = point.node;
                        return false;
                    }
                    lastCheckedNode = point.node;
                    if (!self.options.isEditableNode(point.node)) {
                        return false;
                    }
                    if ((/\S|\u200B|\u00A0/.test(point.node.textContent) || dom.isMedia(point.node)) && dom.isVisiblePoint(point)) {
                        return true;
                    }
                    if (dom.isText(point.node)) {
                        lastCheckedNode = point.node;
                    }
                    return false;
                });
            }

            if (!endPoint) {
                endPoint = {
                    node: range.sc,
                    offset: range.so,
                };
            }

            if (endPoint.node !== range.ec || endPoint.offset !== range.eo) {
                needReselect = true;
                range.ec = endPoint.node;
                range.eo = endPoint.offset;
            }
        }

        if (needReselect) {
            range = range.normalize().select();
            this.context.invoke('editor.saveRange');
        }
        return range;
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    _onRange: function () {
        var range = this._secureRange();
        this._focusNode(range.sc);
    },
    _onMouseUp: function () {
        var range = this._secureRange();
        this._focusNode(range.ec);
    },
    /*
     * prevents changes to unbreakable nodes
     *
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} e
     */
    _onKeydown: function (se, e) {
        if (!e.key || (e.key.length !== 1 && e.keyCode !== 8 && e.keyCode !== 46)) {
            return;
        }
        // for test tour, to trigger Keydown on target (instead of use Wysiwyg.setRange)
        if (e.target !== this._focusedNode && (this.editable === e.target || $.contains(this.editable, e.target))) {
            var range = this.context.invoke('editor.createRange');
            if (!$.contains(e.target, range.sc) && !$.contains(e.target, range.ec)) {
                range.sc = range.ec = e.target;
                range.so = range.eo = 0;
                range = range.normalize().select();
                this.context.invoke('editor.saveRange');
                this._focusNode(range.ec);
            }
        }

        var self = this;
        // rerange to prevent some edition.
        // eg: if the user select with arraw and shifKey and keypress an other char
        var range = this._secureRange();
        var target = {node: range.sc, offset: range.so};

        if (e.key.length === 1) { // printable Char (eg: juste after a icon, we prevent to write into the icon)
            var media;
            if (range.isCollapsed() && (media = dom.ancestor(target.node, dom.isMedia))) {
                target = {node: media, offset: 0};
                target = dom.nextPointUntil(dom.nextPoint(target), function (point) {
                    return !$.contains(media, point.node) && (self.context.invoke('HelperPlugin.isVisibleText', point.node) || point.node.tagName === 'BR') && self.options.isEditableNode(point.node);
                });
                if (!target) {
                    if (!this.options.isEditableNode(media.parentNode)) {
                        e.preventDefault();
                        return;
                    }
                    target = {
                        node: this.document.createTextNode('§'),
                        offset: 1,
                    };
                    $(media).after(target.node);
                } else {
                    target.node.textContent = '§' + target.node.textContent;
                }

                range.sc = range.ec = target.node;
                range.so = range.eo = 1;
                range = range.normalize().select();
                setTimeout(function () {
                    if (target.node.textContent[0] === '§') {
                        target.node.textContent = target.node.textContent.slice(1);
                        if (!range.sc.parentNode) {
                            // prevent error when change content by test (innerHTML)
                            return;
                        }
                        range = range.normalize().select();
                        self._focusNode(range.ec);
                    }
                });
            } else {
                setTimeout(function () {
                    self._focusNode(range.ec);
                });
            }
        } else if (e.keyCode === 8) { // backspace
            if (!target || this.options.isUnbreakableNode(target.node)) {
                e.preventDefault();
            }
        } else if (e.keyCode === 46) { // delete
            target = dom.nextPointUntil(dom.nextPoint(target), dom.isVisiblePoint);
            if (!target || this.options.isUnbreakableNode(target.node)) {
                e.preventDefault();
            }
        }
        if (e.keyCode === 8 || e.keyCode === 46) {
            if (!target) {
                return;
            }
            var targetNode = target.node.tagName ? target.node : target.node.parentNode;
            if (dom.isMedia(targetNode)) {
                $(targetNode).remove();
                this.context.triggerEvent('change', this.$editable.html());
            }
            setTimeout(function () {
                self._focusNode(range.ec);
            });
        }
    },
    /*
     * prevents selection of unbreakable nodes
     *
     * @param {SummernoteEvent} se
     * @param {jQueryEvent} se
     */
    _onKeyup: function (se, e) {
        if (e.keyCode < 37 || e.keyCode > 40) {
            return;
        }
        var range;
        if (e.keyCode === 37) { // left
            range = this._secureRange();
            this._focusNode(range.sc);
        } else if (e.keyCode === 39) { // right
            range = this._secureRange();
            this._focusNode(range.ec);
        } else if (e.keyCode === 38) { // up
            range = this._secureRange();
            this._focusNode(range.sc);
        } else { // down
            range = this._secureRange();
            this._focusNode(range.ec);
        }
    },
});

registry.add('UnbreakablePlugin', Unbreakable);

return Unbreakable;

});
