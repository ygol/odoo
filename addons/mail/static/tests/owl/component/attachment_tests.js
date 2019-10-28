odoo.define('mail.component.AttachmentTests', function (require) {
'use strict';

const Attachment = require('mail.component.Attachment');
const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    nextRender,
    pause,
    start: utilsStart,
} = require('mail.owl.testUtils');

QUnit.module('mail.owl', {}, function () {
QUnit.module('component', {}, function () {
QUnit.module('Attachment', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createAttachment = async attachmentLocalId => {
            Attachment.env = this.env;
            this.attachment = new Attachment(null, { attachmentLocalId });
            await this.attachment.mount(this.widget.$el[0]);
            await nextRender();
        };
        this.start = async params => {
            if (this.widget) {
                this.widget.destroy();
            }
            let { env, widget } = await utilsStart({
                ...params,
                data: this.data,
            });
            this.env = env;
            this.widget = widget;
        };
    },
    afterEach() {
        utilsAfterEach(this);
        if (this.attachment) {
            this.attachment.destroy();
        }
        if (this.widget) {
            this.widget.destroy();
        }
        this.env = undefined;
        delete Attachment.env;
    }
});

QUnit.test('default: TXT', async function (assert) {
    assert.expect(8);

    await this.start();
    const attachmentLocalId = this.env.store.dispatch('createAttachment', {
        filename: "test.txt",
        id: 750,
        mimetype: 'text/plain',
        name: "test.txt",
    });
    await this.createAttachment(attachmentLocalId);
    assert.strictEqual(
        document.querySelectorAll('.o_Attachment').length,
        1,
        "should have attachment component in DOM"
    );
    const attachment = document.querySelector('.o_Attachment');
    assert.strictEqual(
        attachment.dataset.attachmentLocalId,
        'ir.attachment_750',
        "attachment component should be linked to attachment store model"
    );
    assert.ok(
        attachment.classList.contains('o-basic-layout'),
        "attachment should use basic layout by default"
    );
    assert.ok(
        attachment.classList.contains('o-viewable'),
        "TXT attachment should be viewable"
    );
    assert.strictEqual(
        attachment.title,
        "test.txt",
        "attachment should have filename as title attribute"
    );
    assert.strictEqual(
        attachment.querySelectorAll(`:scope .o_Attachment_image`).length,
        1,
        "attachment should have an image part"
    );
    const attachmentImage = attachment.querySelector(`:scope .o_Attachment_image`);
    assert.ok(
        attachmentImage.classList.contains('o_image'),
        "attachment should have o_image classname (required for mimetype.scss style)"
    );
    assert.strictEqual(
        attachmentImage.dataset.mimetype,
        'text/plain',
        "attachment should have data-mimetype set (required for mimetype.scss style)"
    );
});

QUnit.test('default: PNG', async function (assert) {
    assert.expect(10);

    await this.start({
        async mockRPC(route, args) {
            if (route.includes('web/image/750')) {
                assert.ok(
                    route.includes('/160x160'),
                    "should fetch image with 160x160 pixels ratio");
                assert.step('fetch_image');
                return;
            }
            return this._super(...arguments);
        },
    });
    const attachmentLocalId = this.env.store.dispatch('createAttachment', {
        filename: "test.png",
        id: 750,
        mimetype: 'image/png',
        name: "test.png",
    });
    await this.createAttachment(attachmentLocalId);
    assert.verifySteps(['fetch_image']);
    assert.strictEqual(
        document.querySelectorAll('.o_Attachment').length,
        1,
        "should have attachment component in DOM"
    );
    const attachment = document.querySelector('.o_Attachment');
    assert.ok(
        attachment.classList.contains('o-basic-layout'),
        "attachment should use basic layout by default"
    );
    assert.ok(
        attachment.classList.contains('o-viewable'),
        "PNG attachment should be viewable"
    );
    assert.strictEqual(
        attachment.title,
        "test.png",
        "attachment should have filename as title attribute"
    );
    assert.strictEqual(
        attachment.querySelectorAll(`:scope .o_Attachment_image`).length,
        1,
        "attachment should have an image part"
    );
    const attachmentImage = attachment.querySelector(`:scope .o_Attachment_image`);
    assert.ok(
        attachmentImage.classList.contains('o_image'),
        "attachment should have o_image classname (required for mimetype.scss style)"
    );
    assert.strictEqual(
        attachmentImage.dataset.mimetype,
        'image/png',
        "attachment should have data-mimetype set (required for mimetype.scss style)"
    );
});

QUnit.test('default: PDF', async function (assert) {
    assert.expect(7);

    await this.start();
    const attachmentLocalId = this.env.store.dispatch('createAttachment', {
        filename: "test.pdf",
        id: 750,
        mimetype: 'application/pdf',
        name: "test.pdf",
    });
    await this.createAttachment(attachmentLocalId);
    assert.strictEqual(
        document.querySelectorAll('.o_Attachment').length,
        1,
        "should have attachment component in DOM"
    );
    const attachment = document.querySelector('.o_Attachment');
    assert.ok(
        attachment.classList.contains('o-basic-layout'),
        "attachment should use basic layout by default"
    );
    assert.ok(
        attachment.classList.contains('o-viewable'),
        "PDF attachment should be viewable"
    );
    assert.strictEqual(
        attachment.title,
        "test.pdf",
        "attachment should have filename as title attribute"
    );
    assert.strictEqual(
        attachment.querySelectorAll(`:scope .o_Attachment_image`).length,
        1,
        "attachment should have an image part"
    );
    const attachmentImage = attachment.querySelector(`:scope .o_Attachment_image`);
    assert.ok(
        attachmentImage.classList.contains('o_image'),
        "attachment should have o_image classname (required for mimetype.scss style)"
    );
    assert.strictEqual(
        attachmentImage.dataset.mimetype,
        'application/pdf',
        "attachment should have data-mimetype set (required for mimetype.scss style)"
    );
});

QUnit.test('default: video', async function (assert) {
    assert.expect(7);

    await this.start();
    const attachmentLocalId = this.env.store.dispatch('createAttachment', {
        filename: "test.mp4",
        id: 750,
        mimetype: 'video/mp4',
        name: "test.mp4",
    });
    await this.createAttachment(attachmentLocalId);
    assert.strictEqual(
        document.querySelectorAll('.o_Attachment').length,
        1,
        "should have attachment component in DOM"
    );
    const attachment = document.querySelector('.o_Attachment');
    assert.ok(
        attachment.classList.contains('o-basic-layout'),
        "attachment should use basic layout by default"
    );
    assert.ok(
        attachment.classList.contains('o-viewable'),
        "MP4 attachment should be viewable"
    );
    assert.strictEqual(
        attachment.title,
        "test.mp4",
        "attachment should have filename as title attribute"
    );
    assert.strictEqual(
        attachment.querySelectorAll(`:scope .o_Attachment_image`).length,
        1,
        "attachment should have an image part"
    );
    const attachmentImage = attachment.querySelector(`:scope .o_Attachment_image`);
    assert.ok(
        attachmentImage.classList.contains('o_image'),
        "attachment should have o_image classname (required for mimetype.scss style)"
    );
    assert.strictEqual(
        attachmentImage.dataset.mimetype,
        'video/mp4',
        "attachment should have data-mimetype set (required for mimetype.scss style)"
    );
});

});
});
});
