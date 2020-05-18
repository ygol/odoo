odoo.define("website_forum.tour_forum", function (require) {
    "use strict";

    var core = require("web.core");
    var tour = require("web_tour.tour");

    var _t = core._t;

    tour.register("question", {
        url: "/forum/1",
    }, [{
        trigger: ".o_forum_ask_btn",
        position: "left",
        content: _t("Create a new post in this forum by clicking on the button."),
    }, {
        trigger: "input[name=post_name]",
        position: "top",
        content: _t("Give your post title."),
    }, {
        trigger: ".note-editable p",
        extra_trigger: "input[name=post_name]:not(:propValue(\"\"))",
        content: _t("Put your question here."),
        position: "bottom",
        run: "text",
    }, {
        trigger: ".select2-choices",
        extra_trigger: ".note-editable p:not(:containsExact(\"<br>\"))",
        content: _t("Insert tags related to your question."),
        position: "top",
        run: function (actions) {
            actions.auto("input[id=s2id_autogen2]");
        },
    }, {
        trigger: "button:contains(\"Post\")",
        extra_trigger: "input[id=s2id_autogen2]:not(:propValue(\"Tags\"))",
        content: _t("Click to post your question."),
        position: "bottom",
    }, {
        extra_trigger: 'div.modal.modal_shown',
        trigger: ".modal-header button.close",
        auto: true,
    },
    {
        trigger: "a:contains(\"Answer\").collapsed",
        content: _t("Click to answer."),
        position: "bottom",
    },
    {
        trigger: ".note-editable p",
        content: _t("Put your answer here."),
        position: "bottom",
        run: "text",
    }, {
        trigger: "button:contains(\"Post Answer\")",
        extra_trigger: ".note-editable p:not(:containsExact(\"<br>\"))",
        content: _t("Click to post your answer."),
        position: "bottom",
    }, {
        extra_trigger: 'div.modal.modal_shown',
        trigger: ".modal-header button.close",
        auto: true,
    }, {
        trigger: ".o_wforum_validate_toggler[data-karma=\"20\"]:first",
        content: _t("Click here to accept this answer."),
        position: "right",
    }]);

    tour.register("flag_question", {
        url: "/forum/1",
    }, [{
        trigger: ".o_forum_ask_btn",
        position: "left",
        content: _t("Ask the question in this forum by clicking on the button."),
    }, {
        trigger: "input[name=post_name]",
        position: "top",
        content: _t("Give your question title."),
    }, {
        trigger: ".note-editable p",
        extra_trigger: "input[name=post_name]:not(:propValue(\"\"))",
        content: _t("Put your question here."),
        position: "bottom",
        run: "text",
    }, {
        trigger: ".select2-choices",
        extra_trigger: ".note-editable p:not(:containsExact(\"<br>\"))",
        content: _t("Insert tags related to your question."),
        position: "top",
        run: function (actions) {
            actions.auto("input[id=s2id_autogen2]");
        },
    }, {
        trigger: "button:contains(\"Post Your Question\")",
        extra_trigger: "input[id=s2id_autogen2]:not(:propValue(\"Tags\"))",
        content: _t("Click to post your question."),
        position: "bottom",
    }, {
        extra_trigger: 'div.modal.modal_shown',
        trigger: ".modal-header button.close",
        auto: true,
    }, {
        trigger: ".o_wforum_post section .dropdown #dropdownMenuLink",
        content: _t("Click here to show dropdown options."),
        position: "right",
    }, {
        trigger: "button:contains(\"Flag\")",
        extra_trigger: ".o_wforum_post section .dropdown.show .dropdown-menu-right.show",
        content: _t("Click to flag question."),
        position: "right",
        run: 'click',
    }, {
        trigger: ".input-group-append .js_flag_validator .text-success",
        content: _t("Click here to validate question."),
        position: "bottom",
        run: 'click',
    }, {
        trigger: "button:contains(\'Flag\')",
        extra_trigger: ".o_wforum_post section .dropdown.show .dropdown-menu-right.show",
        content: _t("Click to flag question."),
        position: "right",
        run: 'click',
    }, {
        trigger: ".input-group-append .js_flag_mark_as_offensive .text-danger",
        content: _t("Click here to submit mark as offensive question ."),
        position: "bottom",
        run: 'click',
    }, {
        trigger: ".form-group .btn-danger",
        content: _t("Click here to submit reason of flagged question."),
        position: "bottom",
        run: 'click',
    }]);
});
