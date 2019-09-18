odoo.define('mail.component.DropZone', function () {
'use strict';

class DropZone extends owl.store.ConnectedComponent {
    /**
     * @override
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);
        this.id = _.uniqueId('o_dropZone_');
        this.state = {
            isDraggingInside: false
        };
        this.template = 'mail.component.DropZone';
        this._globalDragOverListener = ev => this._onDragoverGlobal(ev);
        this._globalDropListener = ev => this._onDropGlobal(ev);
    }

    mounted() {
        document.addEventListener('dragover', this._globalDragOverListener);
        document.addEventListener('drop', this._globalDropListener);
    }

    willUnmount() {
        document.removeEventListener('dragover', this._globalDragOverListener);
        document.removeEventListener('drop', this._globalDropListener);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Making sure that dragging content is external files.
     * Ignoring other content draging like text.
     *
     * @private
     * @param {DataTransfer} dataTransfer
     * @returns {boolean}
     */
    _isDragSourceExternalFile(dataTransfer) {
        const dragDataType = dataTransfer.types;
        if (dragDataType.constructor === DOMStringList) {
            return dragDataType.contains('Files');
        }
        if (dragDataType.constructor === Array) {
            return dragDataType.includes('Files');
        }
        return false;
    }

    /**
     * @private
     * @param {DragEvent} ev
     * @return {boolean}
     */
    _isInDropZone(ev) {
        return (
            this.el === ev.target ||
            ev.target.closest(`[data-id="${this.id}"]`)
        );
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {DragEvent} ev
     */
    _onDragoverGlobal(ev) {
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "copy";
        this.state.isDraggingInside = this._isInDropZone(ev);
    }

    /**
     * @private
     * @param {DragEvent} ev
     */
    _onDropGlobal(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (this._isInDropZone(ev)) {
            if (this._isDragSourceExternalFile(ev.dataTransfer)) {
                this.trigger('o-dropzone-files-dropped', {
                    files: ev.dataTransfer.files
                });
            }
        } else {
            this.trigger('o-dropzone-outside-drop');
        }
    }
}

return DropZone;

});
