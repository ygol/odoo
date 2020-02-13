odoo.define('web_editor.loader', function (require) {
'use strict';

var ajax = require('web.ajax');

async function loadWysiwyg() {
    // console.log('loading', { assetLibs: ['web_editor.compiled_assets_wysiwyg', 'website.compiled_assets_wysiwyg'] })
    // await ajax.loadLibs({ assetLibs: ['website.compiled_assets_wysiwyg'] });
    await ajax.loadLibs({ assetLibs: ['web_editor.compiled_assets_wysiwyg'] });
    return odoo.__DEBUG__.services['web_editor.wysiwyg'];
}

async function loadFromTextarea(parent, $textarea, options) {
    const Wysiwyg = await loadWysiwyg();

    const $wysiwygWrapper = $textarea.closest('.o_wysiwyg_wrapper');
    const $form = $textarea.closest('form');

    // hide and append the $textarea in $form so it's value will be send
    // through the form
    $textarea.hide();
    $form.append($textarea);

    const wysiwyg = new Wysiwyg(parent, options);
    wysiwyg.attachTo($wysiwygWrapper);

    $form.on('click', 'button[type=submit]', (e) => {
        // todo: check if following fix is it still relevant with jabberwock
        // float-left class messes up the post layout OPW 769721
        // $form.find('.note-editable').find('img.float-left').removeClass('float-left');
        $textarea.val(wysiwyg.getValue());
    });

    return wysiwyg;
}

return {
    loadFromTextarea: loadFromTextarea,
    loadWysiwyg: loadWysiwyg,
};
});
