odoo.define('web_qweb', function (require) {
"use strict";

var core = require('web.core');

var AbstractView = require('web.AbstractView');
var AbstractModel = require('web.AbstractModel');
var AbstractRenderer = require('web.AbstractRenderer');
var AbstractController = require('web.AbstractController');

var _lt = core._lt;
var registry = require('web.view_registry');

var Model = AbstractModel.extend({
    init: function () {
        this._super.apply(this, arguments);
        this._body = null;
        this._model_name = null;
        this._view_id = false;
    },
    _fetch: function (domain, context) {
        var _this = this;
        return this._rpc({
            model: this._model_name,
            method: 'qweb_render_view',
            kwargs: {
                view_id: this._view_id,
                domain: domain,
                context: context
            }
        }).then(function (r) {
            _this._body = r;
            return r;
        });
    },
    get: function () {
        return this._body;
    },
    load: function (params) {
        this._view_id = params.view_id;
        this._model_name = params.modelName;

        return this._fetch(
            params.domain,
            params.context
        );
    },
    reload: function (_id, params) {
        return this._fetch(
            params.domain,
            params.context
        )
    }
});
var Renderer = AbstractRenderer.extend({
    _render: function () {
        var _this = this;
        return this._super.apply(this, arguments).then(function () {
            _this.$el.html(_this.state);
        });
    }
});
var Controller = AbstractController.extend({
    events: _.extend({}, AbstractController.prototype.events, {
        'click [type="toggle"]': '_onLazyToggle',
    }),

    _onLazyToggle: function (e) {
        // TODO: add support for view (possibly action as well?)
        var $target = $(e.target);
        var $t = $target.closest('[data-model]');
        if (!($target.hasClass('fa-caret-down') || $target.hasClass('fa-caret-right'))) {
            $target = $t.find('.fa-caret-down, .fa-caret-right');
        }

        var data = $t.data();
        if (this._fold($t)) {
            $target.removeClass('fa-caret-down').addClass('fa-caret-right');
            return;
        }

        // NB: $.data() automatically parses json attributes, but does not
        //     automatically parse lone float literals in data-*, so a
        //     data-args (as a json object) is very convenient
        var args = data.args || _.omit(data, 'model', 'method', 'id');

        return this._rpc({
            model: data.model,
            method: data.method,
            args: data.id ? [data.id] : undefined,
            kwargs: args // FIXME: context?
        }).then(function (s) {
            return $(s);
        }).then(function ($newcontent) {
            $t.data('children', $newcontent).after($newcontent);
            $target.removeClass('fa-caret-right').addClass('fa-caret-down');
        });
    },
    _fold: function ($el) {
        var $children = $el.data('children');
        if (!$children) {
            return false;
        }

        var _this = this;
        $children.each(function (_i, e) {
            _this._fold($(e));
        }).remove();
        $el.removeData('children');
        return true;
    }
});

var QWebView = AbstractView.extend({
    display_name: _lt('Freedom View'),
    icon: 'fa-file-picture-o',
    viewType: 'qweb',
    // groupable?
    enableTimeRangeMenu: true,
    config: {
        Model: Model,
        Renderer: Renderer,
        Controller: Controller,
    },

    init: function (viewInfo, params) {
        this._super.apply(this, arguments);
        this.loadParams.view_id = viewInfo.view_id;
    }
});

registry.add('qweb', QWebView);
return {
    View: QWebView,
    Controller: Controller,
    Renderer: Renderer,
    Model: Model
};
});
