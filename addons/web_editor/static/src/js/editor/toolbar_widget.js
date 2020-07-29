odoo.define('web_editor/static/src/js/editor/toolbar_widget.js', function (require) {
const Widget = require('web.Widget');

const paddingClasses = ['padding-none', 'padding-small', 'padding-medium', 'padding-large', 'padding-xl'];
const imageClasses = ['rounded', 'rounded-circle', 'shadow', 'img-thumbnail'];
var weWidgets = require('wysiwyg.widgets');

const ToolbarWidget = Widget.extend({
    init(parent, wysiwyg) {
        this._super.apply(this, arguments);
        this.wysiwyg = wysiwyg;
    },
    async start() {
        this.$el.html(`
            <we-customizeblock-options>
                <div class="input-group">
                    <we-button name="color">color</we-button>
                </div>

                <div class="input-group">
                    <we-button name="clear">clear</we-button>
                </div>

                <div class="input-group">
                    <input type="number">
                </div>

                <div class="input-group">
                    <we-button name="bold">bold</we-button>
                    <we-button name="italic">italic</we-button>
                    <we-button name="underline">underline</we-button>
                </div>

                <div class="input-group">
                    <we-button name="left">left</we-button>
                    <we-button name="center">center</we-button>
                    <we-button name="right">right</we-button>
                    <we-button name="justify">justify</we-button>
                </div>

                <div class="input-group">
                    <we-button name="ul">ul</we-button>
                    <we-button name="ol">ol</we-button>
                    <we-button name="checklist">checklist</we-button>
                </div>

                <div class="input-group">
                    <we-button name="indent">indent</we-button>
                    <we-button name="outdent">outdent</we-button>
                </div>

                <div class="input-group">
                    <we-button name="table">table</we-button>
                </div>

                <div class="input-group">
                    <we-button name="media">media</we-button>
                    <we-button name="link">link</we-button>
                </div>

                <div class="input-group input-image padding-buttons">
                    <we-button name="padding-none">padding-none</we-button>
                    <we-button name="padding-small">padding-small</we-button>
                    <we-button name="padding-medium">padding-medium</we-button>
                    <we-button name="padding-large">padding-large</we-button>
                    <we-button name="padding-xl">padding-xl</we-button>
                </div>

                <div class="input-group input-image width-buttons">
                    <we-button name="width-auto">width-auto</we-button>
                    <we-button name="width-100">width-100</we-button>
                    <we-button name="width-50">width-50</we-button>
                    <we-button name="width-25">width-25</we-button>
                </div>

                <div class="input-group input-image">
                    <we-button name="rounded">rounded</we-button>
                    <we-button name="rounded-circle">rounded-circle</we-button>
                    <we-button name="shadow">shadow</we-button>
                    <we-button name="img-thumbnail">img-thumbnail</we-button>
                </div>

                <div class="input-group input-image">
                    <we-button name="crop">crop</we-button>
                    <we-button name="transform">transform</we-button>
                </div>
            </we-customizeblock-options>`);

        this._bindButton('we-button[name="clear"]', () => {
            this.wysiwyg.editor.execCommand('removeFormat');
        });
        this._bindButton('we-button[name="bold"]', () => {
            this.wysiwyg.editor.execCommand('toggleFormat', {FormatClass: this.wysiwyg.JWEditorLib.BoldFormat});
        });
        this._bindButton('we-button[name="italic"]', () => {
            this.wysiwyg.editor.execCommand('toggleFormat', {FormatClass: this.wysiwyg.JWEditorLib.ItalicFormat});
        });
        this._bindButton('we-button[name="underline"]', () => {
            this.wysiwyg.editor.execCommand('toggleFormat', {FormatClass: this.wysiwyg.JWEditorLib.UnderlineFormat});
        });

        this._bindButton('we-button[name="left"]', () => {
            this.wysiwyg.editor.execCommand('align', {type: 'left'});
        });
        this._bindButton('we-button[name="center"]', () => {
            this.wysiwyg.editor.execCommand('align', {type: 'center'});
        });
        this._bindButton('we-button[name="right"]', () => {
            this.wysiwyg.editor.execCommand('align', {type: 'right'});
        });
        this._bindButton('we-button[name="justify"]', () => {
            this.wysiwyg.editor.execCommand('align', {type: 'justify'});
        });

        this._bindButton('we-button[name="ul"]', () => {
            this.wysiwyg.editor.execCommand('toggleList', {type: 'UNORDERED'});
        });
        this._bindButton('we-button[name="ol"]', () => {
            this.wysiwyg.editor.execCommand('toggleList', {type: 'ORDERED'});
        });
        this._bindButton('we-button[name="checklist"]', () => {
            this.wysiwyg.editor.execCommand('toggleList', {type: 'CHECKLIST'});
        });

        this._bindButton('we-button[name="indent"]', () => {
            this.wysiwyg.editor.execCommand('indent');
        });
        this._bindButton('we-button[name="outdent"]', () => {
            this.wysiwyg.editor.execCommand('outdent');
        });

        this._bindButton('we-button[name="media"]', () => {
            this.wysiwyg.editor.execCommand('openMedia');
        });
        this._bindButton('we-button[name="link"]', () => {
            this.wysiwyg.editor.execCommand('openLinkDialog');
        });

        // Bind all padding buttons

        for (const className of paddingClasses) {
            this._bindButton(`we-button[name="${className}"]`, () => {
                this._setImage((imageNode) => {
                    const classList = imageNode.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).classList;
                    for (const className of paddingClasses) {
                        classList.remove(className);
                    }
                    if (className === 'padding-none') return;
                    classList.add(className);
                });
            });
        }

        // Bind all width buttons

        this._bindButton(`we-button[name="width-auto"]`, () => {
            this._setImage((imageNode) => {
                const style = imageNode.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).style;
                style.remove('width');
            });
        });
        this._bindButton(`we-button[name="width-100"]`, () => {
            this._setImage((imageNode) => {
                const style = imageNode.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).style;
                style.set('width', '100%');
            });
        });
        this._bindButton(`we-button[name="width-50"]`, () => {
            this._setImage((imageNode) => {
                const style = imageNode.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).style;
                style.set('width', '50%');
            });
        });
        this._bindButton(`we-button[name="width-25"]`, () => {
            this._setImage((imageNode) => {
                const style = imageNode.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).style;
                style.set('width', '25%');
            });
        });

        for (const className of imageClasses) {
            this._bindButton(`we-button[name="${className}"]`, () => {
                this._setImage((imageNode) => {
                    const classList = imageNode.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).classList;
                    classList.toggle(className);
                });
            });
        }
        this._bindButton(`we-button[name="crop"]`, () => {
            this._setImage((imageNode) => {
                const domEngine = this.wysiwyg.editor.plugins.get(this.wysiwyg.JWEditorLib.Layout).engines.dom;
                const $node = $(domEngine.getDomNodes(imageNode)[0]);
                $node.off('image_cropped');
                $node.on('image_cropped', () => this._updateAttributes($node[0]));
                new weWidgets.ImageCropWidget(this, $node[0]).appendTo($('#wrap'));
            });
        });
        this._bindButton(`we-button[name="transform"]`, () => {
            this._setImage((imageNode) => {
                const domEngine = this.wysiwyg.editor.plugins.get(this.wysiwyg.JWEditorLib.Layout).engines.dom;
                const $node = $(domEngine.getDomNodes(imageNode)[0]);
                this._transform($node);
            });
        });

        $fontSizeInput = this.$('input[type=number]');
        $fontSizeInput.on('change', () => {
            const val = $fontSizeInput.val();
            this.wysiwyg.editor.execBatch(() => {
                const chars = this.wysiwyg.editor.selection.range.selectedNodes(this.wysiwyg.JWEditorLib.Char);

                for (const char of chars) {
                    char.modifiers.get(this.wysiwyg.JWEditorLib.Attributes).style.set('font-size', val)
                };
            });
        });


        // Bind the button state when the editor state change
        this.wysiwyg.getFormatInfo().on('set', this._updateToolbarState.bind(this));
        this._updateToolbarState(this.wysiwyg.getFormatInfo().get());

        this._super.call(...arguments);
    },
    destroy() {
        this.wysiwyg.getFormatInfo().off();
    },
    _setImage(callback) {
        this.wysiwyg.editor.execBatch(() => {
            const imageNodes = this.wysiwyg.editor.selection.range.targetedNodes(this.wysiwyg.JWEditorLib.ImageNode);
            const imageNode = imageNodes.length === 1 && imageNodes[0];
            if (imageNode) {
                callback(imageNode);
            }
        });
    },
    _updateToolbarState(info) {
        const $bold = this.$('we-button[name="bold"]');
        $bold.toggleClass('active', info['bold']);
        const $italic = this.$('we-button[name="italic"]');
        $italic.toggleClass('active', info['italic']);
        const $underline = this.$('we-button[name="underline"]');
        $underline.toggleClass('active', info['underline']);


        const $ul = this.$('we-button[name="ul"]');
        $ul.toggleClass('active', info['listType'] === 'UNORDERED');
        const $ol = this.$('we-button[name="ol"]');
        $ol.toggleClass('active', info['listType'] === 'ORDERED');
        const $checklist = this.$('we-button[name="checklist"]');
        $checklist.toggleClass('active', info['listType'] === 'CHECKLIST');

        const $left = this.$('we-button[name="left"]');
        $left.toggleClass('active', info['alignment'] === 'left');
        const $center = this.$('we-button[name="center"]');
        $center.toggleClass('active', info['alignment'] === 'center');
        const $right = this.$('we-button[name="right"]');
        $right.toggleClass('active', info['alignment'] === 'right');
        const $justify = this.$('we-button[name="justify"]');
        $justify.toggleClass('active', info['alignment'] === 'justify');

        // Image handeling

        const selectedImage = info.selectedImage;
        if (selectedImage) {
            this.$('.input-image').show();
            const imageAttribute = selectedImage.modifiers.get(this.wysiwyg.JWEditorLib.Attributes);
            if (imageAttribute) {
                this.$('.padding-buttons we-button').removeClass('active');
                const classes = paddingClasses.concat(imageClasses);
                for (const attr of classes) {
                    this.$(`we-button[name=${attr}]`).toggleClass('active', imageAttribute.classList.has(attr));
                }

                this.$('.width-buttons we-button').removeClass('active');
                for (const attr of ['100', '50', '25']) {
                    if (imageAttribute.style.get('width') === attr + '%') {
                        this.$(`we- button[name=width-${attr}]`).addClass('active');
                        break;
                    }
                }
            }
        } else {
            this.$('.input-image').hide();
        }
    },
    _bindButton(selector, clickHandler) {
        const $button = this.$el.find(selector);

        $button.on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            clickHandler();
        });
    },
    _updateAttributes(node) {
        const attributes = {}
        for (const attr of node.attributes){
            attributes[attr.name] = attr.value;
        }
        this.wysiwyg.editorHelpers.updateAttributes(node, attributes);
    },
    _transform($image) {
        if ($image.data('transfo-destroy')) {
            $image.removeData('transfo-destroy');
            return;
        }

        $image.transfo();

        const mouseup = (event) => {
            $('.note-popover button[data-event="transform"]').toggleClass('active', $image.is('[style*="transform"]'));
        };
        $(document).on('mouseup', mouseup);

        const mousedown = (event) => {
            if (!$(event.target).closest('.transfo-container').length) {
                $image.transfo('destroy');
                $(document).off('mousedown', mousedown).off('mouseup', mouseup);
            }
            if ($(event.target).closest('.note-popover').length) {
                $image.data('transfo-destroy', true).attr('style', ($image.attr('style') || '').replace(/[^;]*transform[\w:]*;?/g, ''));
            }
            this._updateAttributes($image[0])
        };
        $(document).on('mousedown', mousedown);
    },
});

return ToolbarWidget;
});
