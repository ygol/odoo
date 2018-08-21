odoo.define('web_editor.wysiwyg.plugin.text', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;


var TextPlugin = AbstractPlugin.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    insertList: function (sorted) {
        var range = this.context.invoke('editor.createRange');
        if (!range) return;

        var self = this;
        var $editable = this.$editable;
        var parent, ul, i;
        var node = range.sc;
        while (node && node !== $editable[0]) {

            parent = node.parentNode;
            if (node.tagName === (sorted ? "UL" : "OL")) {

                ul = this.document.createElement(sorted ? "ol" : "ul");
                ul.className = node.className;
                parent.insertBefore(ul, node);
                while (node.firstChild) {
                    ul.appendChild(node.firstChild);
                }
                parent.removeChild(node);
                range.normalize().select();
                this.context.invoke('editor.saveRange');
                return;

            } else if (node.tagName === (sorted ? "OL" : "UL")) {

                var lis = [];
                for (var i=0; i<node.children.length; i++) {
                    lis.push(node.children[i]);
                }

                if (parent.tagName === "LI") {
                    node = parent;
                    parent = node.parentNode;
                    _.each(lis, function (li) {
                        parent.insertBefore(li, node);
                    });
                } else {
                    _.each(lis, function (li) {
                        while (li.firstChild) {
                            parent.insertBefore(li.firstChild, node);
                        }
                    });
                }

                parent.removeChild(node);
                range.normalize().select();
                this.context.invoke('editor.saveRange');
                return;

            }
            node = parent;
        }

        var p0 = range.sc;
        while (p0 && p0.parentNode && p0.parentNode !== $editable[0] && !this._isFormatNode(p0)) {
            p0 = p0.parentNode;
        }
        if (!p0) return;
        var p1 = range.ec;
        while (p1 && p1.parentNode && p1.parentNode !== $editable[0] && !this._isFormatNode(p1)) {
            p1 = p1.parentNode;
        }
        if (!p0.parentNode || p0.parentNode !== p1.parentNode) {
            return;
        }

        parent = p0.parentNode;
        ul = this.document.createElement(sorted ? "ol" : "ul");
        parent.insertBefore(ul, p0);
        var childNodes = parent.childNodes;
        var brs = [];
        var begin = false;
        for (i = 0; i < childNodes.length; i++) {
            if (begin && dom.isBR(childNodes[i])) {
                parent.removeChild(childNodes[i]);
                i--;
            }
            if ((!dom.isText(childNodes[i]) && !this._isFormatNode(childNodes[i]) && parent !== this.editable) || (!ul.firstChild && childNodes[i] !== p0) ||
                $.contains(ul, childNodes[i]) || (dom.isText(childNodes[i]) && !childNodes[i].textContent.match(/\S|u00A0/))) {
                continue;
            }
            begin = true;
            var li = this.document.createElement('li');
            ul.appendChild(li);
            li.appendChild(childNodes[i]);
            if (li.firstChild === p1) {
                break;
            }
            i--;
        }
        if (dom.isBR(childNodes[i])) {
            parent.removeChild(childNodes[i]);
        }

        for (i = 0; i < brs.length ; i++) {
            parent.removeChild(brs[i]);
        }
        range.normalize().select();
        this.context.invoke('editor.saveRange');
    },
    indent: function (outdent) {
        var range = this.context.invoke('editor.createRange');
        if (!range) return;

        var self = this;
        var $editable = this.$editable;
        var flag = false;
        var ancestor = range.commonAncestor();
        var $dom = $(ancestor);

        if (!dom.isList(ancestor)) {
            // to indent a selection, we indent the child nodes of the common
            // ancestor that contains this selection
            $dom = $(ancestor.tagName ? ancestor : ancestor.parentNode).children();
        }
        if (!$dom.not('br').length) {
            // if selection is inside a list, we indent its list items
            $dom = $(dom.ancestor(range.sc, dom.isList));
            if (!$dom.length) {
                // if the selection is contained in a single HTML node, we indent
                // the first ancestor 'content block' (P, H1, PRE, ...) or TD
                $dom = $(range.sc).closest(this.options.styleTags.join(',')+',td');
            }
        }

        // if select tr, take the first td
        $dom = $dom.map(function () { return this.tagName === "TR" ? this.firstElementChild : this; });

        $dom.each(function () {
            if (flag || $.contains(this, range.sc)) {
                if (dom.isList(this)) {
                    if (outdent) {
                        flag = self._outdenttUL(flag, this, range.sc, range.ec);
                    } else {
                        flag = self._indentUL(flag, this, range.sc, range.ec);
                    }
                } else if (self._isFormatNode(this) || dom.ancestor(this, dom.isCell)) {
                    flag = self._indentOther(outdent, flag, this, range.sc, range.ec);
                }
            }
        });

        if ($dom.length) {
            var $parent = $dom.parent();

            // remove text nodes between lists
            var $ul = $parent.find('ul, ol');
            if (!$ul.length) {
                $ul = $(dom.ancestor(range.sc, dom.isList));
            }
            $ul.each(function () {
                if (this.previousSibling &&
                    this.previousSibling !== this.previousElementSibling &&
                    !this.previousSibling.textContent.match(/\S/)) {
                    this.parentNode.removeChild(this.previousSibling);
                }
                if (this.nextSibling &&
                    this.nextSibling !== this.nextElementSibling &&
                    !this.nextSibling.textContent.match(/\S/)) {
                    this.parentNode.removeChild(this.nextSibling);
                }
            });

            // merge same ul or ol


            range.normalize().select();
            this.context.invoke('editor.saveRange');
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _isFormatNode: function (node) {
        return node.tagName && this.options.styleTags.indexOf(node.tagName.toLowerCase()) !== -1;
    },
    _indentUL: function (flag, UL, start, end) {
        var next;
        var tagName = UL.tagName;
        var node = UL.firstChild;
        var ul = document.createElement(tagName);
        var li = document.createElement("li");
        li.style.listStyle = "none";
        li.appendChild(ul);

        if (flag) {
            flag = 1;
        }

        // create and fill ul into a li
        while (node) {
            if (flag === 1 || node === start || $.contains(node, start)) {
                flag = true;
                node.parentNode.insertBefore(li, node);
            }
            next = node.nextElementSibling;
            if (flag) {
                ul.appendChild(node);
            }
            if (node === end || $.contains(node, end)) {
                flag = false;
                break;
            }
            node = next;
        }

        var temp;
        var prev = li.previousElementSibling;
        if (prev && prev.tagName === "LI" && (temp = prev.firstElementChild) && temp.tagName === tagName && ((prev.firstElementChild || prev.firstChild) !== ul)) {
            $(prev.firstElementChild || prev.firstChild).append($(ul).contents());
            $(ul).remove();
            li = prev;
            li.parentNode.removeChild(li.nextElementSibling);
        }
        next = li.nextElementSibling;
        if (next && next.tagName === "LI" && (temp = next.firstElementChild) && temp.tagName === tagName && (li.firstElementChild !== next.firstElementChild)) {
            $(li.firstElementChild).append($(next.firstElementChild).contents());
            $(next.firstElementChild).remove();
            li.parentNode.removeChild(li.nextElementSibling);
        }
        return flag;
    },
    _outdent: function (node) {
        var style = dom.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0)-1.5;
        node.style[style] = margin > 0 ? margin + "em" : "";
        return margin;
    },
    _outdenttUL: function (flag, UL, start, end) {
        var next;
        var node = UL.firstChild;
        var parent = UL.parentNode;
        var li = UL.parentNode.tagName === "LI" ? UL.parentNode : UL;
        var ul = UL.parentNode.tagName === "LI" ? UL.parentNode.parentNode : UL.parentNode;
        start = dom.ancestor(start, dom.isLi);
        end = dom.ancestor(end, dom.isLi);

        if (ul.tagName !== "UL" && ul.tagName !== "OL") return;

        // create and fill ul into a li
        while (node) {
            if (node === start || $.contains(node, start)) {
                flag = true;
                if (node.previousElementSibling && li.tagName === "LI") {
                    li = dom.splitTree(li, dom.prevPoint({'node': node, 'offset': 0}));
                }
            }
            next = node.nextElementSibling;
            if (flag) {
                ul = node.parentNode;
                li.parentNode.insertBefore(node, li);
                if (!ul.children.length) {
                    if (ul.parentNode.tagName === "LI") {
                        ul = ul.parentNode;
                    }
                    ul.parentNode.removeChild(ul);
                }
            }

            if (node === end || $.contains(node, end)) {
                flag = false;
                break;
            }
            node = next;
        }
        return flag;
    },
    _indent: function (node) {
        var style = dom.isCell(node) ? 'paddingLeft' : 'marginLeft';
        var margin = parseFloat(node.style[style] || 0)+1.5;
        node.style[style] = margin + "em";
        return margin;
    },
    _indentOther: function(outdent, flag, p, start, end) {
        if (p === start || $.contains(p, start) || $.contains(start, p)) {
            flag = true;
        }
        if (flag) {
            if (outdent) {
                this._outdent(p);
            } else {
                this._indent(p);
            }
        }
        if (p === end || $.contains(p, end) || $.contains(end, p)) {
            flag = false;
        }
        return flag;
    },
});

registry.add('TextPlugin', TextPlugin);

return TextPlugin;

});
