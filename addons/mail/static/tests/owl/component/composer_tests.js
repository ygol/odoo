odoo.define('mail.component.ComposerTests', function (require) {
"use strict";

const Composer = require('mail.component.Composer');
const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    dragoverFiles,
    dropFiles,
    inputFiles,
    pasteFiles,
    pause,
    start: startUtils,
} = require('mail.owl.testUtils');

const testUtils = require('web.test_utils');

QUnit.module('mail.owl', {}, function () {
QUnit.module('component', {}, function () {
QUnit.module('Composer', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createComposer = async (composerId, otherProps) => {
            const env = await this.widget.call('env', 'get');
            this.composer = new Composer(env, {
                id: composerId,
                ...otherProps
            });
            await this.composer.mount(this.widget.$el[0]);
            this.store.dispatch('createComposer', composerId, {
                attachmentLocalIds: [],
            });
        };
        /**
         * @return {Promise<string>} resolved with emoji unicode
         */
        this.insertEmoji = async () => {
            let emoji = null;
            let trials = 0;
            // Do not why but sometimes it needs 3 trials to open the menu and select an emoji
            while (!emoji && trials < 10) {
                // Show emoji menu
                await testUtils.dom.click(
                    document.querySelector(`
                    .o_Composer
                    .o_Composer_buttons
                    > .o_Composer_toolButtons
                    > .o_Composer_buttonEmojis`)
                );
                // Select first emoji
                await testUtils.nextTick();
                emoji = document.querySelector(`
                .o_EmojisPopover
                > .o_EmojisPopover_emoji`);
                trials++;
            }
            if (emoji) {
                await testUtils.dom.click(emoji);
                return emoji.dataset.unicode;
            } else {
                return null;
            }
        };

        /**
         * @return {Promise}
         */
        this.insertMention = async (tribute, editable) => {
            editable.focus();
            tribute.showMenuForCollection(editable, 3); // 3 stands for the 3rd collection which are partner mentions
            tribute.selectItemAtIndex(0);
            tribute.hideMenu(0);
            const kevt = new window.KeyboardEvent('input');
            editable.dispatchEvent(kevt);
            await testUtils.nextTick();
        };

        this.start = async params => {
            if (this.widget) {
                this.widget.destroy();
            }
            let { store, widget } = await startUtils({
                ...params,
                data: this.data,
            });
            this.store = store;
            this.widget = widget;
        };
    },
    afterEach() {
        utilsAfterEach(this);
        if (this.composer) {
            this.composer.destroy();
        }
        if (this.widget) {
            this.widget.destroy();
        }
        this.store = undefined;
    }
});

QUnit.test('composer text input: basic rendering', async function (assert) {
    assert.expect(8);

    await this.start();
    await this.createComposer('composer_1');
    assert.strictEqual(
        document
            .querySelectorAll(`.o_Composer`)
            .length,
        1,
        "should have composer in discuss thread");
    assert.strictEqual(
        document
            .querySelectorAll(`.o_Composer_textInput`)
            .length,
        1,
        "should have text input inside discuss thread composer");
    assert.ok(
        document
            .querySelector(`.o_Composer_textInput`)
            .classList
            .contains('o_ComposerTextInput'),
        "should composer text input of composer be a ComposerTextInput component");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_ComposerTextInput
                > .note-editor`)
            .length,
        1,
        "should have note editor inside composer text input");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_ComposerTextInput
                > .note-editor
                > .note-editing-area`)
            .length,
        1,
        "should have note editing area inside note editor of composer text input");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_ComposerTextInput
                > .note-editor
                > .note-editing-area
                > .note-editable`)
            .length,
        1,
        "should have note editable inside note editing area of composer text input");
    assert.ok(
        document
            .querySelector(`
                .o_ComposerTextInput
                > .note-editor
                > .note-editing-area
                > .note-editable`)
            .isContentEditable,
        "should have note editable as an HTML editor");
    assert.strictEqual(
        document
            .querySelector(`
                .o_ComposerTextInput
                > .note-editor
                > .note-editing-area
                > .note-editable`)
            .dataset
            .placeholder,
        "Write something...",
        "should have placeholder in note editable of composer text input");
});

QUnit.test('composer: emoji insertion', async function (assert) {
    assert.expect(4);

    await this.start();
    await this.createComposer('composer_1');

    const editable = document.querySelector(`
        .o_ComposerTextInput
        > .note-editor
        > .note-editing-area
        > .note-editable`);
    // Insert emoji in empty editable
    let emoji = await this.insertEmoji();
    assert.strictEqual(
        editable.innerHTML,
        `<p>${emoji}</p>`,
        "emoji should be inserted");

    // fill editable with text
    const content = 'Blabla';
    this.composer.refs.textInput.reset();
    editable.focus();
    document.execCommand('insertHTML', false, `<p>${content}</p>`);
    // insert emoji at the end of text
    emoji = await this.insertEmoji();
    assert.strictEqual(
        editable.innerHTML,
        `<p>${content}${emoji}</p>`,
        "emoji should be inserted at end of editable");

    /* TEST SELECTED CONTENT BY KEYBOARD IS REPLACED BY EMOJI */
    // select all the content
    const range = document.createRange();
    range.selectNodeContents(editable);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    // emulate the fact that the selection is made by the keyboard
    editable.dispatchEvent(new window.KeyboardEvent('keydown', {
        key: 'ArrowLeft',
    }));
    await testUtils.nextTick();
    // insert emoji to replace selected text
    emoji = await this.insertEmoji();
    assert.strictEqual(
        editable.innerHTML,
        `<p>${emoji}<br></p>`,
        "emoji should replace selected content (keyboard)");

    /* TEST SELECTED CONTENT BY MOUSE IS REPLACED BY EMOJI */
    // select all the content
    document.execCommand('insertHTML', false, `<p>${content}</p>`);
    const range2 = document.createRange();
    range2.selectNodeContents(editable);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range2);
    // emulate the fact that the selection is made by the mouse
    editable.dispatchEvent(new window.MouseEvent('mouseup'));
    await testUtils.nextTick();
    // insert emoji to replace selected text
    emoji = await this.insertEmoji();
    assert.strictEqual(
        editable.innerHTML,
        `<p>${emoji}<br></p>`,
        "emoji should replace selected content (mouse)");
});

QUnit.test('composer: mention insertion', async function (assert) {
    assert.expect(4);

    await this.start();
    await this.createComposer('composer_1');

    const tribute = this.composer.refs.textInput._tribute;
    const editable = document.querySelector(`
        .o_ComposerTextInput
        > .note-editor
        > .note-editing-area
        > .note-editable`);

    // Insert a mention, the mention should then be in the editable

    await this.insertMention(tribute, editable);
    const mentionHtml = '<a contenteditable="false" data-oe-model="res.partner" href="#" owl="1" data-oe-id="odoobot" class="o_mention">@OdooBot</a>&nbsp;';
    assert.strictEqual(
        editable.innerHTML,
        `<p>${mentionHtml}</p>`,
        'mention should be inserted in the editable as a contenteditable false');

    // Make sur insertion of the mention is made after the text
    this.composer.refs.textInput.reset();
    const content = "bluhbluh";
    document.execCommand('insertHTML', false, `<p>${content}</p>`);
    await this.insertMention(tribute, editable);
    assert.strictEqual(
        editable.innerHTML,
        `<p>${content}${mentionHtml}</p>`,
        "mention should be inserted in the editable after the already written text");

    // Checking emoji insertion is ok after a mention
    const emoji = await this.insertEmoji();
    assert.strictEqual(
        editable.innerHTML,
        `<p>${content}${mentionHtml}${emoji}</p>`,
        'emoji should be inserted after the mention'
    );

    // Checking emoji insertion is ok after a mention when there is only a mention
    this.composer.refs.textInput.reset();
    document.execCommand('insertHTML', false, mentionHtml);
    const notextEmoji = await this.insertEmoji();
    assert.strictEqual(
        editable.innerHTML,
        `<p>${mentionHtml}${notextEmoji}</p>`,
        "emoji should be inserted after the mention");

    // Executed code includes a setTimeout function to remove the menu from the body
    // If menu is not removed at the right time, test will fail because of extra element in the body
    // We need to this manually as in unmount it cannot be awaited
    await tribute.detach(editable);
});

QUnit.test('composer: add an attachment', async function (assert) {
    assert.expect(9);

    await this.start();
    await this.createComposer('composer_1', {
        attachmentsLayout:'card'
    });

    const file = await testUtils.file.createFile({
        name: 'text.txt',
        content: 'hello, world',
        contentType: 'text/plain',
    });
    await inputFiles(
        document.querySelector('.o_Composer_fileInput'),
        [file]);
    assert.ok(
        document.querySelector('.o_Composer_attachmentList'),
        "should have an attachment list");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment`),
        "should have an attachment");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_image`),
        "should have an attachment image");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_main`),
        "should have an attachment main part");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_main
            .o_Attachment_filename`),
        "should have an attachment filename");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_main
            .o_Attachment_extension`),
        "should have an attachment extension");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_aside`),
        "should have an attachment aside");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_aside
            .o_Attachment_asideItemUploaded`),
        "should have an attachment uploaded image");
    assert.ok(
        document
            .querySelector(`
            .o_Composer_attachmentList
            .o_Attachment
            .o_Attachment_aside
            .o_Attachment_asideItemUnlink`),
        "should have an attachment remove button");
});

QUnit.test('composer: drop attachments', async function (assert) {
    assert.expect(3);

    await this.start();
    await this.createComposer('composer_1');
    const files = [
        await testUtils.file.createFile({
            name: 'text.txt',
            content: 'hello, world',
            contentType: 'text/plain',
        }),
        await testUtils.file.createFile({
            name: 'text2.txt',
            content: 'hello, worlduh',
            contentType: 'text/plain',
        })
    ];
    await dragoverFiles(document.querySelector('.o_Composer'));
    assert.ok(
        document.querySelector('.o_Composer_dropZone'),
        "should have a drop zone");
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_Composer
                .o_Attachment`)
            .length,
        0,
        "should have no attachment before files are dropped");

    await dropFiles(
        document.querySelector('.o_Composer_dropZone'),
        files);
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_Composer
                .o_Attachment`)
            .length,
        2,
        "should have 2 attachments in the composer after files dropped");
});

QUnit.test('composer: paste attachments', async function (assert) {
    assert.expect(2);

    await this.start();
    await this.createComposer('composer_1');

    const files = [
        await testUtils.file.createFile({
            name: 'text.txt',
            content: 'hello, world',
            contentType: 'text/plain',
        }),
        await testUtils.file.createFile({
            name: 'text2.txt',
            content: 'hello, worlduh',
            contentType: 'text/plain',
        })
    ];
    assert.strictEqual(
        document.querySelectorAll('.o_Composer_attachmentList').length,
        0,
        "should not have any attachment in the composer before paste");

    await pasteFiles(document.querySelector('.o_ComposerTextInput'), files);
    assert.strictEqual(
        document
            .querySelectorAll(`
                .o_Composer_attachmentList
                .o_Attachment`)
            .length,
        2,
        "should have 2 attachments in the composer after paste");
});

});
});
});
