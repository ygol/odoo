odoo.define('web_editor.AssetLoaderWidget', function (require) {
  'use strict';

  // todo: Remove this.
  var Widget = require('web.Widget');
  var AssetLoaderWidget = Widget.extend({
      // assetLibs: ['web_editor.compiled_assets_wysiwyg'],
      loadAssets: function(assets) {
        var proms = [];
        if (assets.xmlDependencies) {
            proms.push.apply(proms, _.map(assets.xmlDependencies, function (xmlPath) {
                return ajax.loadXML(xmlPath, core.qweb);
            }));
        }
        if (assets.jsLibs || assets.cssLibs || assets.assetLibs) {
            proms.push(this._loadLibs(this));
        }
        return Promise.all(proms);
      }
  });

  return AssetLoaderWidget;
});
