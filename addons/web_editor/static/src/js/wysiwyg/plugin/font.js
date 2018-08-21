odoo.define('web_editor.wysiwyg.plugin.font', function (require) {
'use strict';

var core = require('web.core');
var ColorpickerDialog = require('wysiwyg.widgets.ColorpickerDialog');
var AbstractPlugin = require('web_editor.wysiwyg.plugin.abstract');
var registry = require('web_editor.wysiwyg.plugin.registry');
var wysiwygTranslation = require('web_editor.wysiwyg.translation');
var wysiwygOptions = require('web_editor.wysiwyg.options');

var QWeb = core.qweb;
var _t = core._t;

var dom = $.summernote.dom;

//--------------------------------------------------------------------------
// helper for Font
//--------------------------------------------------------------------------

function isVisibleText (textNode) {
  return !!textNode.textContent.match(/\S|\u00A0/);
}

//--------------------------------------------------------------------------
// Font (colorpicker & font-size)
//--------------------------------------------------------------------------

dom.isFont = function (node) {
    return node && node.tagName === "FONT" || dom.isIcon(node);
};

var FontPlugin = AbstractPlugin.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /*
     *
     * @param {jQuery} $button
     * @returns {jQuery}
     */
    colorPickerButton: function ($button) {
        var self = this;
        var $container = $('<div class="note-btn-group btn-group note-color"/>');

        var $foreContainer = $(QWeb.render('wysiwyg.plugin.font.paletteButton', {
            className: 'note-fore-color',
            icon: this.options.icons.fore,
        })).appendTo($container);
        $foreContainer.find('.dropdown-menu').append(this.createPalette('foreColor'));

        var $bgContainer = $(QWeb.render('wysiwyg.plugin.font.paletteButton', {
            className: 'note-bg-color',
            icon: this.options.icons.bg,
        })).appendTo($container);
        $bgContainer.find('.dropdown-menu').append(this.createPalette('backColor'));

        // fore palette

        var $forePalette = this.createPalette('foreColor');
        $forePalette.find("button:not(.note-color-btn)")
            .addClass("note-color-btn")
            .attr('data-event', 'foreColor')
            .each(function () {
                var $el = $(this);
                var className = $el.hasClass('o_custom_color') ? $el.data('color') : 'text-' + $el.data('color');
                $el.attr('data-value', className).addClass($el.hasClass('o_custom_color') ? '' : 'bg-' + $el.data('color'));
            });
        var custom = '';

        // bg palette

        var $bgPalette = this.createPalette('backColor');
        var $bg = $bgPalette.find("button:not(.note-color-btn)")
            .addClass("note-color-btn")
            .attr('data-event', 'backColor')
            .each(function () {
                var $el = $(this);
                var className = $el.hasClass('o_custom_color') ? $el.data('color') : 'bg-' + $el.data('color');
                $el.attr('data-value', className).addClass($el.hasClass('o_custom_color') ? '' : className);
            });

        // add event

        $container.on('mousedown', function (ev) {
            self.context.invoke('editor.saveRange');
        });
        return $container;
    },
    /*
     *
     * @param {string} eventName (backColor or foreColor)
     * @returns {jQuery}
     */
    createPalette: function (eventName) {
        var $palette = $(QWeb.render('wysiwyg.plugin.font.colorPalette', {
            colors: this.options.colors,
            eventName: eventName,
            lang: this.lang,
        }));
        if (this.options.tooltip) {
            $palette.find('.note-color-btn').tooltip({
                container: this.options.container,
                trigger: 'hover',
                placement: 'bottom'
            });
        }

        var $clpicker = $(QWeb.render('web_editor.colorpicker'));
        var groups;

        if ($clpicker.is("colorpicker")) {
            groups = _.map($clpicker.find('[data-name="theme"], [data-name="transparent_grayscale"]'), function (el) {
                return $(el).find("button").empty();
            });
        } else {
            groups = [$clpicker.find("button").empty()];
        }

        var $buttons = $(_.map(groups, function ($group) {
            if (!$group.length) {
                return '';
            }
            var $row = $("<div/>", {"class": "note-color-row mb8"}).append($group);
            var $after_breaks = $row.find(".o_small + :not(.o_small)");
            if ($after_breaks.length === 0) {
                $after_breaks = $row.find(":nth-child(8n+9)");
            }
            $after_breaks.addClass("o_clear");
            return $row[0].outerHTML;
        }).join(""));

        $buttons.find('button').each(function () {
            var color = $(this).data('color');
            $(this).addClass('note-color-btn bg-' + color).attr('data-value', (eventName === 'backColor' ? 'bg-' : 'text-') + color);
        });

        $palette.find('.o_theme_color_placeholder').prepend($buttons);

        $palette.on('mousedown', '.note-color-btn', this._wrapCommand(function (e) {
            var method = eventName === 'backColor' ? 'changeBgColor' : 'changeForeColor';
            this[method]($(e.target).data('value'));
        }.bind(this)));
        $palette.on('mousedown', '.note-custom-color', this._onCustomColor.bind(this, eventName));

        return $palette;
    },
    /*
     *
     * @param {jQuery} $button
     * @returns {jQuery}
     */
    fontSizeButton: function ($button) {
        $button.find('.dropdown-menu').off('click').on('click', this.context.createInvokeHandlerAndUpdateState('FontPlugin.changeFontSize'));
        return $button;
    },
    /*
     *
     * @param {string} color (hexadecimal or class name)
     */
    changeForeColor: function (color) {
        this._applyFont(color || 'text-undefined', null, null);
    },
    /*
     *
     * @param {string} color (hexadecimal or class name)
     */
    changeBgColor: function (color) {
        this._applyFont(null, color || 'bg-undefined', null);
    },
    /*
     *
     * @param {integer} fontsize
     */
    changeFontSize: function (fontsize) {
        this._applyFont(null, null, fontsize || 'inherit');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /*
     *
     * @param {string} color (hexadecimal or class name)
     * @param {string} bgcolor (hexadecimal or class name)
     * @param {integer} fontsize
     */
    _applyFont: function (color, bgcolor, size) {
        var r = this.context.invoke('editor.createRange');
        if (!r) {
            return;
        }
        var target;
        if (r.isCollapsed() && !dom.isIcon(r.sc)) {
            target = this.context.invoke('editor.restoreTarget');
            if (target) {
                r.sc = r.ec = target;
                r.so = r.eo = 0;
            }
        }

        var startPoint = r.getStartPoint();
        var endPoint = r.getEndPoint();
        if (r.isCollapsed() && !dom.isIcon(r.sc)) {
            if (!r.sc.tagName || r.so !== 1 || r.sc.childNodes.length !== 1 || r.sc.childNodes[0].tagName !== 'BR') {
                return {
                    sc: startPoint.node,
                    so: startPoint.offset,
                    ec: endPoint.node,
                    offset: endPoint.offset
                };
            }
        }
        if (startPoint.node.tagName && startPoint.node.childNodes[startPoint.offset]) {
            startPoint.node = startPoint.node.childNodes[startPoint.offset];
            startPoint.offset = 0;
        }
        if (endPoint.node.tagName && endPoint.node.childNodes[endPoint.offset]) {
            endPoint.node = endPoint.node.childNodes[endPoint.offset];
            endPoint.offset = 0;
        }
        // get first and last point
        var ancestor;
        var node;
        if (endPoint.offset && endPoint.offset !== dom.nodeLength(endPoint.node)) {
            ancestor = dom.ancestor(endPoint.node, dom.isFont) || endPoint.node;
            dom.splitTree(ancestor, endPoint);
        }
        if (startPoint.offset && startPoint.offset !== dom.nodeLength(startPoint.node)) {
            ancestor = dom.ancestor(startPoint.node, dom.isFont) || startPoint.node;
            node = dom.splitTree(ancestor, startPoint);
            if (endPoint.node === startPoint.node) {
                endPoint.node = node;
                endPoint.offset = dom.nodeLength(node);
            }
            startPoint.node = node;
            startPoint.offset = 0;
        }
        // get list of nodes to change
        var nodes = [];
        dom.walkPoint(startPoint, endPoint, function (point) {
            var node = point.node;
            if (((dom.isText(node) && isVisibleText(node)) || dom.isIcon(node)) &&
            (node !== endPoint.node || endPoint.offset)) {
                nodes.push(point.node);
            }
        });
        nodes = _.unique(nodes);
        // If ico fa
        if (r.isCollapsed()) {
            nodes.push(startPoint.node);
        }

        // apply font: foreColor, backColor, size (the color can be use a class text-... or bg-...)
        var font, $font, fonts = [], style, className;
        var i;
        if (color || bgcolor || size) {
            for (i=0; i<nodes.length; i++) {
                node = nodes[i];
                font = dom.ancestor(node, dom.isFont);
                if (!font) {
                    if (node.textContent.match(/^[ ]|[ ]$/)) {
                        node.textContent = node.textContent.replace(/^[ ]|[ ]$/g, '\u00A0');
                    }
                    font = dom.create("font");
                    node.parentNode.insertBefore(font, node);
                    font.appendChild(node);
                }
                fonts.push(font);
                className = font.className.split(/\s+/);
                var k;
                if (color) {
                    for (k=0; k<className.length; k++) {
                        if (className[k].length && className[k].slice(0,5) === "text-") {
                            className.splice(k,1);
                            k--;
                        }
                    }
                    if (color === 'text-undefined') {
                        font.className = className.join(" ");
                        font.style.color = "inherit";
                    } else if (color.indexOf('text-') !== -1) {
                        font.className = className.join(" ") + " " + color;
                        font.style.color = "inherit";
                    } else {
                        font.className = className.join(" ");
                        font.style.color = color;
                    }
                }
                if (bgcolor) {
                    for (k=0; k<className.length; k++) {
                        if (className[k].length && className[k].slice(0,3) === "bg-") {
                            className.splice(k,1);
                            k--;
                        }
                    }

                    if (bgcolor === 'bg-undefined') {
                        font.className = className.join(" ");
                        font.style.backgroundColor = "inherit";
                    } else if (bgcolor.indexOf('bg-') !== -1) {
                        font.className = className.join(" ") + " " + bgcolor;
                        font.style.backgroundColor = "inherit";
                    } else {
                        font.className = className.join(" ");
                        font.style.backgroundColor = bgcolor;
                    }
                }
                if (size) {
                    font.style.fontSize = "inherit";
                    if (!isNaN(size) && Math.abs(parseInt(this.window.getComputedStyle(font).fontSize, 10)-size)/size > 0.05) {
                        font.style.fontSize = size + "px";
                    }
                }
            }
        }
        // remove empty values
        // we must remove the value in 2 steps (applay inherit then remove) because some
        // browser like chrome have some time an error for the rendering and/or keep inherit
        for (i=0; i<fonts.length; i++) {
            font = fonts[i];
            if (font.style.color === "inherit") {
                font.style.color = "";
            }
            if (font.style.backgroundColor === "inherit") {
                font.style.backgroundColor = "";
            }
            if (font.style.fontSize === "inherit") {
                font.style.fontSize = "";
            }
            $font = $(font);
            if (font.style.color === '' && font.style.backgroundColor === '' && font.style.fontSize === '') {
                $font.removeAttr("style");
            }
            if (!font.className.length) {
                $font.removeAttr("class");
            }
        }

        // target the deepest node
        if (startPoint.node.tagName && !startPoint.offset) {
            startPoint.node = this.context.invoke('HelperPlugin.firstChild', startPoint.node.childNodes[startPoint.offset] || startPoint.node);
            startPoint.offset = 0;
        }
        if (endPoint.node.tagName && !endPoint.offset) {
            endPoint.node = this.context.invoke('HelperPlugin.firstChild', endPoint.node.childNodes[endPoint.offset] || endPoint.node);
            endPoint.offset = 0;
        }

        // select nodes to clean (to remove empty font and merge same nodes)
        nodes = [];
        dom.walkPoint(startPoint, endPoint, function (point) {
            nodes.push(point.node);
        });
        nodes = _.unique(nodes);
        // remove node without attributes (move content), and merge the same nodes
        for (i=0; i<nodes.length; i++) {
            node = nodes[i];
            if ((dom.isText(node) || dom.isBR(node)) && !isVisibleText(node)) {
                $(node).remove();
                nodes.splice(i,1);
                i--;
                continue;
            }
            font = dom.ancestor(node, dom.isFont);
            node = font || dom.ancestor(node, dom.isSpan);
            if (!node) {
                continue;
            }
            $font = $(node);
            className = this.context.invoke('HelperPlugin.orderClass', node);
            style = this.context.invoke('HelperPlugin.orderStyle', node);
            if (!className && !style) {
                $(node).before($(node).contents());
                if (endPoint.node === node) {
                    endPoint = dom.prevPointUntil(endPoint, function (point) {
                        return point.node !== node;
                    });
                }
                $(node).remove();

                nodes.splice(i,1);
                i--;
                continue;
            }
            var prev = font && font.previousElementSibling;
            if (prev &&
                font.tagName === prev.tagName &&
                className === this.context.invoke('HelperPlugin.orderClass', prev) && style === this.context.invoke('HelperPlugin.orderStyle', prev)) {
                $(prev).append($(font).contents());
                if (endPoint.node === font) {
                    endPoint = dom.prevPointUntil(endPoint, function (point) {
                        return point.node !== font;
                    });
                }
                $(font).remove();

                nodes.splice(i,1);
                i--;
                continue;
            }
        }

        // restore selection
        r.sc = startPoint.node;
        r.so = startPoint.offset;
        r.ec = endPoint.node;
        r.eo = endPoint.offset;
        r.normalize().select();

        if (target) {
            this.context.invoke('MediaPlugin.updatePopoverAfterEdit', target);
        }
    },
    /*
     *
     * @param {string} rgb
     * @returns {string} hex color
     */
    _rgbToHex: function(rgb) {
        var rgbSplit = rgb.match(/rgb\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)/);
        if (!rgbSplit) {
            return rgbSplit;
        }
        var hex = ColorpickerDialog.prototype.convertRgbToHex(
            parseInt(rgbSplit[1]),
            parseInt(rgbSplit[2]),
            parseInt(rgbSplit[3])
        );
        if (!hex) {
            throw new Error('Wrong Color');
        }
        return hex.hex.toUpperCase();
    },
    /*
     *
     * @param {jQuery Event} ev
     */
    _onCustomColor: function (targetColor, ev) {
        ev.preventDefault();
        ev.stopPropagation();

        var self = this;
        var $button = $(ev.target).next('button');
        var target = this.context.invoke('editor.restoreTarget');
        var colorPickerDialog = new ColorpickerDialog(this, {});

        this.context.invoke('editor.saveRange');
        colorPickerDialog.on('colorpicker:saved', this, this._wrapCommand(function (ev) {
            $button.show();
            $button.css('background-color', ev.data.hex);
            $button.attr('data-value', ev.data.hex);
            $button.attr('title', ev.data.hex);
            self.context.invoke('editor.saveTarget', target);
            self.context.invoke('editor.restoreRange');
            $button.mousedown();
        }));
        colorPickerDialog.open();
        this.context.invoke('MediaPlugin.hidePopovers');
    },
});

_.extend(wysiwygOptions.icons, {
    fore: 'fa fa-font',
    bg: 'fa fa-paint-brush',
});
_.extend(wysiwygTranslation.color, {
    customColor: _t('Custom Color'),
    fore: _t('Color'),
    bg: _t('Background color'),
});

registry.add('FontPlugin', FontPlugin);

registry.addXmlDependency('/web_editor/static/src/xml/wysiwyg_colorpicker.xml');
registry.addJob(function (wysiwyg) {
    if ('web_editor.colorpicker' in QWeb.templates) {
        return;
    }
    var options = {};
    wysiwyg.trigger_up('getRecordInfo', {recordInfo: options});
    return wysiwyg._rpc({
        model: 'ir.ui.view',
        method: 'read_template',
        args: ['web_editor.colorpicker', options.context]
    }).then(function (template) {
        QWeb.add_template(template);
    });
});


return FontPlugin;

});
