odoo.define('web_editor.wysiwyg.plugin.helper', function (require) {
'use strict';

var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');

var dom = $.summernote.dom;


var HelperPlugin = AbstractPlugin.extend({
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * 
     */
    compareNodes: function (node, otherNode) {
        if (dom.isText(node)) {
            return dom.isText(otherNode);
        }
        this.removeBlankAttrs(node);
        this.removeBlankAttrs(otherNode);
        this.orderClass(node);
        this.orderStyle(node);
        this.orderClass(otherNode);
        this.orderStyle(otherNode);
        if ((!node.attributes) !== (!otherNode.attributes) ||
            node.attributes.length !== otherNode.attributes.length ||
            node.tagName != otherNode.tagName) {
            return false;
        }
        for (var i = 0; i < node.attributes.length; i++) {
            var attr = node.attributes[i];
            var otherAttr = otherNode.attributes[i];
            if (attr.name !== otherAttr.name || attr.value !== otherAttr.value) {
                return false;
            }
        }
        return true;
    },
    /**
     * remove the dom between 2 points (use unbreakable)
     * 
     * @param {Object} pointA
     * @param {DOM} pointA.node
     * @param {Integer} pointA.offset
     * @param {Object} pointB
     * @param {DOM} pointB.node
     * @param {Integer} pointB.offset
     */
    deleteBetween: function (pointA, pointB) {
        if (pointB.node.childNodes[pointB.offset] || pointB.offset === dom.nodeLength(pointB.node)) {
            pointB = dom.nextPointUntil(pointB, function (point) {
                return !point.offset && !point.node.tagName;
            }.bind(this)) || pointB;
        }
        var beginPath = this.path(pointA.node);
        var changed;
        var commonAncestor = dom.commonAncestor(pointA.node, pointB.node);

        var scAncestor = dom.ancestor(pointA.node, function (node) {
            return node === commonAncestor || this.options.isUnbreakableNode(node.parentNode);
        }.bind(this));

        var next = this.splitTree(scAncestor, {node: pointA.node, offset: pointA.offset},
                                              {nextText: true});

        pointA.node = this.fromPath(beginPath);

        if (pointB.node === pointA.node) {
            pointB.node = next;
            pointB.offset -= dom.nodeLength(pointA.node);
        }

        var ecAncestor = dom.ancestor(pointB.node, function (node) {
            return node === commonAncestor || this.options.isUnbreakableNode(node.parentNode);
        }.bind(this));

        if (pointB.offset === dom.nodeLength(pointB.node)) {
            pointB = dom.nextPointUntil(pointB, dom.isLeftEdgePoint);
        }

        if (pointB) {
            ecAncestor = dom.ancestor(pointB.node, function (node) {
                return node === commonAncestor || this.options.isUnbreakableNode(node.parentNode);
            }.bind(this));
            next = this.splitTree(ecAncestor, {node: pointB.node, offset: pointB.offset},
                                              {nextText: true});
        } else {
            next = null;
        }

        var nodes = [];
        dom.nextPointUntil({node: pointA.node, offset: pointA.offset}, function (point) {
            if (point.node === next) {
                return true;
            }
            if (dom.isText(point.node) && point.offset) {
                return;
            }
            var target = point.node.childNodes[point.offset] || point.node;
            if (target === pointA.node || $.contains(target, pointA.node) || target === next || $.contains(target, next)) {
                return;
            }
            if (nodes.indexOf(target) === -1 && !dom.ancestor(target, function (target) { return nodes.indexOf(target) !== -1; })) {
                nodes.push(target);
            }
        });
        $(nodes).remove();

        changed = !!nodes.length;

        if (changed) {
            this.deleteEdge(pointA.node, 'next');
        }

        return {
            node: pointA.node,
            offset: pointA.offset,
            changed: changed,
        };
    },
    /**
     * remove the edge (merge the nodes) (use unbreakable)
     *
     * @param {DOM} node
     * @param {'next'|'prev'} direction
     * @returns {object} {node, offset}
     */
    deleteEdge: function (node, direction) {
        var prevOrNext = direction === 'prev' ? 'previousSibling' : 'nextSibling';

        if (node.tagName === 'BR' && node.nextSibling) {
            node = node.nextSibling;
            node = this.firstChild(node);
        }

        var nodes = [];
        while(node && node !== this.editable && !this.options.isUnbreakableNode(node)) {
            while(node[prevOrNext] && !node[prevOrNext].tagName) {
                if (!/\S|\u00A0|\u200B/.test(node[prevOrNext].textContent)) {
                    $(node[prevOrNext]).remove();
                    continue;
                }
                break;
            }
            nodes.push(node);
            if (node[prevOrNext]) {
              break;
            }
            node = node.parentNode;
        }

        var ifBrRemovedAndMerge = !_.filter(nodes, this.isNodeBlockType.bind(this)).length;
        var brRemoved = false;

        var result = false;
        while((node = nodes.pop())) {
            if (!node[prevOrNext] ||
                !(node.tagName || node[prevOrNext].tagName === 'BR') ||
                !node[prevOrNext].tagName) {
                continue;
            }

            if (!brRemoved && node[prevOrNext].tagName === 'BR') {
                $(node[prevOrNext]).remove();
                result = {
                    node: node[prevOrNext] || node,
                    offset: (node[prevOrNext] ? direction === 'prev' : direction === 'next') ? dom.nodeLength(node[prevOrNext]) : 0,
                };
                if (!ifBrRemovedAndMerge) {
                    continue;
                }
                brRemoved = true;
                ifBrRemovedAndMerge = false;
            }

            if (!this.compareNodes(node, node[prevOrNext])) {
                continue;
            }
            var next = node[prevOrNext];
            var $next = $(next);
            if (next.tagName) {
                if (direction === 'prev') {
                    var deep = this.lastChild(next);
                    result = {
                        node: deep,
                        offset: dom.nodeLength(deep),
                    };
                    if (/\S|\u00A0|\u200B/.test(node.textContent) || node.childElementCount > 1 ||
                        node.firstElementChild && node.firstElementChild.tagName !== "BR") {
                        $next.append($(node).contents());
                    }
                    $(node).remove();
                } else {
                    var deep = this.lastChild(node);
                    result = {
                        node: deep,
                        offset: dom.nodeLength(deep),
                    };
                    $(node).append($next.contents());
                    $next.remove();
                }
                continue;
            } else if (!/\S|\u00A0|\u200B/.test(next.textContent)) {
                result = {
                    node: node,
                    offset: direction === 'prev' ? 0 : dom.nodeLength(node),
                };
                $next.remove();
                continue;
            }
            break;
        }

        return result;
    },
    /**
     * 
     */
    firstChild: function (node) {
        while (node.firstChild && !dom.isMedia(node) && this.options.isEditableNode(node)) {
            node = node.firstChild;
        }
        return node;
    },
    /**
     * return the node targeted by a path
     *
     * @param {Object[]} list of object (tagName, offset)
     * @returns {DOM} node
     */
    fromPath: function (path) {
        var node = this.editable;
        var to;
        path = path.slice();
        while ((to = path.shift())) {
            node = _.filter(node.childNodes, function (node) {
                return !to.tagName && node.tagName === 'BR' || node.tagName === to.tagName;
            })[to.offset];
        }
        return node;
    },
    /**
     * 
     */
    lastChild: function (node) {
        while (node.lastChild && !dom.isMedia(node) && this.options.isEditableNode(node)) {
            node = node.lastChild;
        }
        return node;
    },
    /**
     * split the dom tree and insert the node respecting the rules of unbreakable nodes
     *
     * @param {DOM} node
     */
    insertBlockNode: function (node) {
        var range = this.context.invoke('editor.createRange');
        range = range.deleteContents();
        var point = {node: range.sc, offset: range.so};
        var unbreakable = dom.ancestor(point.node, function (node) {
            return this.options.isUnbreakableNode(node.parentNode);
        }.bind(this)) || point.node;
        var tree = dom.splitTree(unbreakable, point, {
            isSkipPaddingBlankHTML: true,
            isNotSplitEdgePoint: true,
        });
        if ((!tree || $.contains(tree, range.sc)) && (point.offset || point.node.tagName)) {
            tree = tree || dom.ancestor(point.node, function (node) {
                return this.options.isUnbreakableNode(node.parentNode);
            }.bind(this));
            $(tree).after(node);
        } else {
            $(tree).before(node);
        }
        if (range.sc.innerHTML === '<br>') {
            var clone = range.sc.cloneNode(true);
            if (node.previousSibling === range.sc) {
                $(node).after(clone);
            } else if (node.nextSibling === range.sc) {
                $(node).before(clone);
            }
        }
    },
    /**
     * 
     */
    isNodeBlockType: function (node) {
        if (dom.isText(node)) {
            return false;
        }
        var display = this.window.getComputedStyle(node).display;
        // All inline elements have the word 'inline' in their display value, except 'contents'
        return 'inline'.indexOf(display) === -1 && display !== 'contents';
    },
    /**
     * 
     * @private
     */
    isVisibleText: function (node) {
        return !node.tagName && /\S|\u200B|\u00A0/.test(node.textContent);
    },
    /**
     * re-order the class and return it
     *
     * @param {DOM} node
     * @returns {string}
     */
    orderClass: function (node) {
        var className = node.getAttribute && node.getAttribute('class');
        if (!className) return null;
        className = className.replace(/[\s\n\r]+/, ' ').replace(/^ | $/g, '').replace(/ +/g, ' ');
        if (!className.length) {
            node.removeAttribute("class");
            return null;
        }
        className = className.split(" ");
        className.sort();
        className = className.join(" ");
        node.setAttribute('class', className);
        return className;
    },
    /**
     * re-order the style attributes and return it
     *
     * @param {DOM} node
     * @returns {string}
     */
    orderStyle: function (node) {
        var style = node.getAttribute('style');
        if (!style) return null;
        style = style.replace(/[\s\n\r]+/, ' ').replace(/^ ?;? ?| ?;? ?$/g, '').replace(/ ?; ?/g, ';');
        if (!style.length) {
          node.removeAttribute("style");
          return null;
        }
        style = style.split(";");
        style.sort();
        style = style.join("; ")+";";
        node.setAttribute('style', style);
        return style;
    },
    /**
     * return the path to the node from the editable node
     *
     * @param {DOM} node
     * @returns {Object[]} list of object (tagName, offset)
     */
    path: function (node) {
        var path = [];
        while (node && node !== this.editable) {
            var tagName = node.tagName;
            path.unshift({
                tagName: tagName,
                offset: _.filter(node.parentNode.childNodes, function (node) {
                    return node.tagName === tagName;
                }).indexOf(node),
            });
            node = node.parentNode;
        }
        return path;
    },
    /**
     * 
     */
    removeBlankAttrs: function (node) {
        _.each(node.attributes, function (attr) {
            if (!attr.value) {
                node.removeAttribute(attr.name);
            }
        });
        return node
    },
    /**
     * 
     */
    splitTree: function (root, point, options) {
        var nextText;
        if (options && options.nextText && dom.isText(point.node)) {
            nextText = point.node.splitText(point.offset);
        }
        var next = dom.splitTree(root, point, options);
        var result = nextText || next;
        var att = nextText ? 'textContent' : 'innerHTML';
        if (/^\s+([^\s<])/.test(result[att])) {
            result[att] = result[att].replace(/^\s+/, '\u00A0');
        }
        return result;
    },
});

registry.add('HelperPlugin', HelperPlugin);

return HelperPlugin;

});
