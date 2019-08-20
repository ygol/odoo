odoo.define('mail.store.actions', function (require) {
"use strict";

const emojis = require('mail.emojis');
const mailUtils = require('mail.utils');

const config = require('web.config');
const core = require('web.core');
const utils = require('web.utils');

const _t = core._t;

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

/**
 * @private
 * @param {Object} param0
 * @param {Array} param0.domain
 * @param {Object} param0.thread
 * @return {Array}
 */
function _extendMessageDomainWithThreadDomain({ domain, thread }) {
    if (thread._model === 'mail.channel') {
        return domain.concat([['channel_ids', 'in', [thread.id]]]);
    } else if (thread.localId === 'mail.box_inbox') {
        return domain.concat([['needaction', '=', true]]);
    } else if (thread.localId === 'mail.box_starred') {
        return domain.concat([['starred', '=', true]]);
    } else if (thread.localId === 'mail.box_history') {
        return domain.concat([['needaction', '=', false]]);
    } else if (thread.localId === 'mail.box_moderation') {
        return domain.concat([['need_moderation', '=', true]]);
    }
    return domain;
}

/**
 * @private
 * @param {Object[]} notifications
 * @return {Object[]}
 */
function _filterNotificationsOnUnsubscribe(notifications) {
    const unsubscribedNotif = notifications.find(notif =>
        notif[1].info === 'unsubscribe');
    if (unsubscribedNotif) {
        notifications = notifications.filter(notif =>
            notif[0][1] !== 'mail.channel' ||
            notif[0][2] !== unsubscribedNotif[1].id);
    }
    return notifications;
}

/**
 * @private
 * @param {string} htmlString
 * @return {string}
 */
function _generateEmojisOnHtml(htmlString) {
    for (const emoji of emojis) {
        for (const source of emoji.sources) {
            const escapedSource = String(source).replace(
                /([.*+?=^!:${}()|[\]/\\])/g,
                '\\$1');
            const regexp = new RegExp(
                '(\\s|^)(' + escapedSource + ')(?=\\s|$)',
                'g');
            htmlString = htmlString.replace(regexp, '$1' + emoji.unicode);
        }
    }
    return htmlString;
}

/**
 * @private
 * @param {string} content html content
 * @return {String|undefined} command, if any in the content
 */
function _getCommand(content) {
    if (content.startsWith('/')) {
        return content.substring(1).split(/\s/)[0];
    }
    return undefined;
}

/**
 * @private
 * @param {string} content html content
 * @return {integer[]} list of mentioned partner Ids (not duplicate)
 */
function _getMentionedPartnerIds(content) {
    const parser = new window.DOMParser();
    const node = parser.parseFromString(content, 'text/html');
    const mentions = [ ...node.querySelectorAll('.o_mention') ];
    const allPartnerIds = mentions
        .filter(mention =>
            (
                mention.dataset.oeModel === 'res.partner' &&
                !isNaN(Number(mention.dataset.oeId))
            ))
        .map(mention => Number(mention.dataset.oeId));
    return [ ...new Set(allPartnerIds) ];
}

/**
 * @private
 * @param {Object} param0
 * @param {Object} param0.env
 * @param {Object} param0.state
 * @param {Object} param1
 * @param {string} param1.threadLocalId
 * @return {Object}
 */
function _getThreadFetchMessagesKwargs({ env, state }, { threadLocalId }) {
    const thread = state.threads[threadLocalId];
    let kwargs = {
        limit: state.MESSAGE_FETCH_LIMIT,
        context: env.session.user_context
    };
    if (thread.moderation) {
        // thread is a channel
        kwargs.moderated_channel_ids = [thread.id];
    }
    return kwargs;
}

const actions = {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {boolean} [param1.autoselect=false]
     * @param {string} param1.name
     * @param {integer|undefined} [param1.partnerId=undefined]
     * @param {string|undefined} [param1.public=undefined]
     * @param {string} param1.type
     */
    async createChannel(
        { commit, dispatch, env, state },
        {
            autoselect=false,
            name,
            partnerId,
            public: publicStatus,
            type,
        }
    ) {
        const data = await env.rpc({
            model: 'mail.channel',
            method: type === 'chat' ? 'channel_get' : 'channel_create',
            args: type === 'chat' ? [[partnerId]] : [name, publicStatus],
            kwargs: {
                context: {
                    ...env.session.user_content,
                    isMobile: config.device.isMobile
                }
            }
        });
        const threadLocalId = commit('createThread', { ...data });
        if (state.threads[threadLocalId].is_minimized) {
            dispatch('openThread', threadLocalId, {
                chatWindowMode: 'last',
            });
        }
        if (autoselect) {
            dispatch('openThread', threadLocalId);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     */
    closeAllChatWindows({ dispatch, state }) {
        const chatWindowLocalIds = state.chatWindowManager.chatWindowLocalIds;
        for (const chatWindowLocalId of chatWindowLocalIds) {
            dispatch('closeChatWindow', chatWindowLocalId);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {string} chatWindowLocalId either 'new_message' or thread local Id, a
     *   valid Id in `chatWindowLocalIds` list of chat window manager.
     */
    closeChatWindow({ commit, dispatch, state }, chatWindowLocalId) {
        commit('removeChatWindowFromManager', chatWindowLocalId);
        if (chatWindowLocalId !== 'new_message') {
            dispatch('setThreadState', chatWindowLocalId, 'closed');
        }
        commit('_computeChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.resId
     * @param {string} param1.resModel
     */
    async fetchDocumentAttachments(
        { commit, env },
        { resId, resModel }
    ) {
        const attachmentsData = await env.rpc({
            model: 'ir.attachment',
            method: 'search_read',
            domain: [
                ['res_id', '=', resId],
                ['res_model', '=', resModel],
            ],
            fields: ['id', 'name', 'mimetype'],
        });
        for (const attachmentData of attachmentsData) {
            commit('insertAttachment', {
                res_id: resId,
                res_model: resModel,
                ...attachmentData,
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async fetchSuggestedRecipientsOnThread({ commit, env, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        const result = await env.rpc({
            route: '/mail/get_suggested_recipients',
            params: {
                model: thread._model,
                res_ids: [thread.id],
            },
        });
        const suggestedRecipients = result[thread.id].map(recipient => {
            const parsedEmail = recipient[1] && mailUtils.parseEmail(recipient[1]);
            const partnerLocalId = commit('insertPartner', {
                display_name: recipient[1],
                email: parsedEmail[1],
                id: recipient[0],
                name: parsedEmail[0],
            });
            return {
                checked: true,
                partnerLocalId,
                reason: recipient[2],
            };
        });
        commit('updateThread', threadLocalId, { suggestedRecipients });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {function} param1.ready
     */
    async initMessaging(
        { commit, dispatch, env },
        { ready }
    ) {
        await env.session.is_bound;
        const context = {
            isMobile: config.device.isMobile,
            ...env.session.user_context
        };
        const data = await env.rpc({
            route: '/mail/init_messaging',
            params: { context: context }
        });
        commit('initMessaging', {
            currentPartnerData: {
                displayName: env.session.partner_display_name,
                id: env.session.partner_id,
                name: env.session.name,
                userId: env.session.uid,
            },
            ...data
        });
        dispatch('_initMessagingChannels', data.channel_slots);


        env.call('bus_service', 'onNotification', null, notifs =>
            dispatch('_handleNotifications', notifs));
        env.call('bus_service', 'on', 'window_focus', null, () =>
            dispatch('_handleGlobalWindowFocus'));

        ready();
        env.call('bus_service', 'startPolling');
        dispatch('_startLoopFetchPartnerImStatus');
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Object[]} [param1.channel_channel=[]]
     * @param {Object[]} [param1.channel_direct_message=[]]
     * @param {Object[]} [param1.channel_private_group=[]]
     */
    _initMessagingChannels(
        { commit, dispatch, state },
        {
            channel_channel=[],
            channel_direct_message=[],
            channel_private_group=[],
        }
    ) {
        for (const data of channel_channel) {
            dispatch('_insertThread', {_model: 'mail.channel', ...data});
        }
        for (const data of channel_direct_message) {
            dispatch('_insertThread', {_model: 'mail.channel', ...data});
        }
        for (const data of channel_private_group) {
            dispatch('_insertThread', {_model: 'mail.channel', ...data});
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {Object} threadData
     */
    async _insertThread({ commit, dispatch, state }, threadData){
        const channelLocalId = commit('insertThread', threadData);
        if (channelLocalId && state[channelLocalId] && state[channelLocalId].is_minimized)
        {
            dispatch('openThread', channelLocalId, {chatWindowMode: 'last'})
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {integer} channelId
     * @param {Object} param2
     * @param {boolean} [param2.autoselect=false]
     */
    async joinChannel(
        { commit, dispatch, env, state },
        channelId,
        { autoselect=false }={}
    ) {
        const channel = state.threads[`mail.channel_${channelId}`];
        if (channel) {
            return;
        }
        const data = await env.rpc({
            model: 'mail.channel',
            method: 'channel_join_and_get_info',
            args: [[channelId]]
        });
        const threadLocalId = commit('createThread', { ...data });
        if(state.threads[threadLocalId].is_minimized){
            dispatch('openThread', threadLocalId, {
                chatWindowMode: 'last',
            });
        }
        if (autoselect) {
            dispatch('openThread', threadLocalId, {
                resetDiscussDomain: true,
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} [param2={}]
     * @param {Array} [param2.searchDomain=[]]
     */
    async loadMoreMessagesOnThread(
        { commit, env, state },
        threadLocalId,
        { searchDomain=[] }={}
    ) {
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalId = `${threadLocalId}_${stringifiedDomain}`;
        const threadCache = state.threadCaches[threadCacheLocalId];
        let domain = searchDomain.length ? searchDomain : [];
        domain = _extendMessageDomainWithThreadDomain({
            domain,
            thread: state.threads[threadLocalId],
        });
        if (threadCache.isAllHistoryLoaded && threadCache.isLoadingMore) {
            return;
        }
        commit('updateThreadCache', threadCacheLocalId, {
            isLoadingMore: true,
        });
        const minMessageId = Math.min(
            ...threadCache.messageLocalIds.map(messageLocalId =>
                state.messages[messageLocalId].id)
        );
        domain = [['id', '<', minMessageId]].concat(domain);
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: _getThreadFetchMessagesKwargs(
                { env, state },
                { threadLocalId }
            )
        }, { shadow: true });
        commit('handleThreadLoaded', threadLocalId, {
            messagesData,
            searchDomain,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {string} threadLocalId
     * @param {Object} [param2={}]
     * @param {Array} [params2.searchDomain=[]]
     */
    async loadThreadCache(
        { dispatch },
        threadLocalId,
        { searchDomain=[] }={}
    ) {
        dispatch('_loadMessagesOnThread', threadLocalId, { searchDomain });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string[]} threadLocalIds
     */
    async loadThreadPreviews({ commit, env, state }, threadLocalIds) {
        const threads = threadLocalIds.map(localId => state.threads[localId]);
        const channelIds = threads.reduce((list, thread) => {
            if (thread._model === 'mail.channel') {
                return list.concat(thread.id);
            }
            return list;
        }, []);
        const messagePreviews = await env.rpc({
            model: 'mail.channel',
            method: 'channel_fetch_preview',
            args: [channelIds],
        }, { shadow: true });
        for (const preview of messagePreviews) {
            commit('insertMessage', preview.last_message);
        }
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Array[]} domains
     */
    async markAllMessagesAsRead({ env }, domain) {
        await env.rpc({
            model: 'mail.message',
            method: 'mark_all_as_read',
            kwargs: {
                channel_ids: [],
                domain
            }
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string[]} param1.messageLocalIds
     */
    async markMessagesAsRead({ env, state }, messageLocalIds) {
        const currentPartner = state.partners[state.currentPartnerLocalId];
        const messageIds = messageLocalIds
            .filter(localId => {
                const message = state.messages[localId];
                // If too many messages, not all are fetched,
                // and some might not be found
                return !message || message.needaction_partner_ids.includes(currentPartner.id);
            })
            .map(localId => state.messages[localId].id);
        if (!messageIds.length) {
            return;
        }
        await env.rpc({
            model: 'mail.message',
            method: 'set_message_done',
            args: [messageIds]
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async markThreadAsSeen({ commit, env, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        if (thread.message_unread_counter === 0) {
            return;
        }
        if (thread._model === 'mail.channel') {
            const seen_message_id = await env.rpc({
                model: 'mail.channel',
                method: 'channel_seen',
                args: [[thread.id]]
            }, { shadow: true });
            commit('updateThread', threadLocalId, { seen_message_id });
        }
        commit('updateThread', threadLocalId, {
            message_unread_counter: 0,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {integer} param1.id
     * @param {string} param1.model
     */
    openDocument({ commit, dispatch, env }, { id, model }) {
        env.do_action({
            type: 'ir.actions.act_window',
            res_model: model,
            views: [[false, 'form']],
            res_id: id,
        });
        commit('closeMessagingMenu');
        dispatch('closeAllChatWindows');
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} param2
     * @param {string} [param2.chatWindowMode]
     * @param {boolean} [param2.resetDiscussDomain=false]
     */
    openThread(
        { commit, dispatch, state },
        threadLocalId,
        {
            chatWindowMode,
            resetDiscussDomain=false
        }={}
    ) {
        if (
            (
                !state.isMobile &&
                state.discuss.isOpen
            ) ||
            (
                state.isMobile &&
                state.threads[threadLocalId]._model === 'mail.box'
            )
        ) {
            if (resetDiscussDomain) {
                commit('setDiscussDomain', []);
            }
            commit('_openThreadInDiscuss', threadLocalId);
        } else {
            dispatch('_openChatWindow', threadLocalId, {
                mode: chatWindowMode,
            });
        }
        if (!state.isMobile) {
            commit('closeMessagingMenu');
        }
    },
    /**
     * @param {Object} param0
     * @param {functon} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} data
     * @param {string[]} data.attachmentLocalIds
     * @param {*[]} data.canned_response_ids
     * @param {integer[]} data.channel_ids
     * @param {string} data.content
     * @param {boolean} [data.isLog=false]
     * @param {string} data.subject
     * @param {string} [data.subtype='mail.mt_comment']
     * @param {integer} [data.subtype_id]
     * @param {String} [data.threadCacheLocalId]
     * @param {Object} [options]
     * @param {integer} options.res_id
     * @param {string} options.res_model
     */
    async postMessageOnThread({ commit, dispatch, env, state }, threadLocalId, data, options) {
        const thread = state.threads[threadLocalId];
        if (thread._model === 'mail.box') {
            const {
                res_id,
                res_model,
            } = options;
            const otherThreadLocalId = `${res_model}_${res_id}`;
            return dispatch('postMessageOnThread', otherThreadLocalId, {
                ...data,
                threadLocalId,
            });
        }
        const {
            attachmentLocalIds,
            canned_response_ids,
            channel_ids=[],
            content,
            context,
            isLog=false,
            subject,
            // subtype='mail.mt_comment',
            subtype_id,
            threadCacheLocalId,
        } = data;
        let body = content.replace(/&nbsp;/g, ' ').trim();
        // This message will be received from the mail composer as html content
        // subtype but the urls will not be linkified. If the mail composer
        // takes the responsibility to linkify the urls we end up with double
        // linkification a bit everywhere. Ideally we want to keep the content
        // as text internally and only make html enrichment at display time but
        // the current design makes this quite hard to do.
        body = mailUtils.parseAndTransform(body, mailUtils.addLink);
        body = _generateEmojisOnHtml(body);
        let postData = {
            attachment_ids: attachmentLocalIds.map(localId =>
                    state.attachments[localId].id),
            body,
            partner_ids: _getMentionedPartnerIds(body),
            message_type: 'comment',
        };
        if (thread._model === 'mail.channel') {
            const command = _getCommand(body);
            Object.assign(postData, {
                command,
                subtype: 'mail.mt_comment'
            });
            await env.rpc({
                model: 'mail.channel',
                method: command ? 'execute_command' : 'message_post',
                args: [thread.id],
                kwargs: postData
            });
        } else {
            Object.assign(postData, {
                channel_ids: channel_ids.map(channelId => [4, channelId, false]),
                canned_response_ids
            });
            if (subject) {
                postData.subject = subject;
            }
            Object.assign(postData, {
                context,
                subtype: isLog ? 'mail.mt_note' : 'mail.mt_comment',
                subtype_id
            });
            const id = await env.rpc({
                model: thread._model,
                method: 'message_post',
                args: [thread.id],
                kwargs: postData
            });
            const [messageData] = await env.rpc({
                model: 'mail.message',
                method: 'message_format',
                args: [[id]]
            });
            commit('createMessage', {
                ...messageData,
                model: thread._model,
                res_id: thread.id
            });
        }
        if (threadCacheLocalId) {
            commit('updateThreadCache', threadCacheLocalId, {
                currentPartnerMessagePostCounter:
                    state.threadCaches[threadCacheLocalId].currentPartnerMessagePostCounter + 1,
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {Event} param1.ev
     * @param {integer} param1.id
     * @param {string} param1.model
     */
    async redirect(
        { commit, dispatch, env, getters, state },
        { ev, id, model }
    ) {
        if (model === 'mail.channel') {
            ev.stopPropagation();
            const threadLocalId = `${model}_${id}`;
            const channel = state.threads[threadLocalId];
            if (!channel) {
                dispatch('joinChannel', id, {
                    autoselect: true,
                });
                return;
            }
            dispatch('openThread', threadLocalId);
        } else if (model === 'res.partner') {
            if (id === env.session.partner_id) {
                dispatch('openDocument', {
                    model: 'res.partner',
                    id,
                });
                return;
            }
            const partnerLocalId = `res.partner_${id}`;
            let partner = state.partners[partnerLocalId];
            if (!partner) {
                commit('insertPartner', { id });
                partner = state.partners[partnerLocalId];
            }
            if (partner.userId === undefined) {
                // rpc to check that
                await dispatch('_checkPartnerIsUser', partnerLocalId);
            }
            if (partner.userId === null) {
                // partner is not a user, open document instead
                dispatch('openDocument', {
                    model: 'res.partner',
                    id: partner.id,
                });
                return;
            }
            ev.stopPropagation();
            const chat = getters.chatFromPartner(`res.partner_${id}`);
            if (!chat) {
                dispatch('createChannel', {
                    autoselect: true,
                    partnerId: id,
                    type: 'chat',
                });
                return;
            }
            dispatch('openThread', chat.localId);
        } else {
            dispatch('openDocument', {
                model: 'res.partner',
                id,
            });
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {string} newName
     */
    async renameThread({ commit, dispatch, env, state }, threadLocalId, newName) {
        const thread = state.threads[threadLocalId];
        if (thread.channel_type === 'chat') {
            await env.rpc({
                model: 'mail.channel',
                method: 'channel_set_custom_name',
                args: [thread.id],
                kwargs: {
                    name: newName,
                }
            });
        }
        commit('updateThread', threadLocalId, {
            custom_channel_name: newName,
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {string} oldChatWindowLocalId chat window to replace
     * @param {string} newChatWindowLocalId chat window to replace with
     */
    replaceChatWindow(
        { commit, dispatch, state },
        oldChatWindowLocalId,
        newChatWindowLocalId
    ) {
        commit('_swapChatWindows', newChatWindowLocalId, oldChatWindowLocalId);
        dispatch('closeChatWindow', oldChatWindowLocalId);
        const thread = state.threads[newChatWindowLocalId];
        if (thread && thread.state !== 'open') {
            dispatch('setThreadState', newChatWindowLocalId, 'open');
        }
        commit('focusChatWindow', newChatWindowLocalId);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {function} param1.callback
     * @param {string} param1.keyword
     * @param {integer} [param1.limit=10]
     */
    async searchPartners(
        { commit, env, state },
        { callback, keyword, limit=10 }
    ) {
        // prefetched partners
        let partners = [];
        const searchRegexp = new RegExp(
            _.str.escapeRegExp(utils.unaccent(keyword)),
            'i'
        );
        const currentPartner = state.partners[state.currentPartnerLocalId];
        for (const partner of Object.values(state.partners)) {
            if (partners.length < limit) {
                if (
                    partner.id !== currentPartner.id &&
                    searchRegexp.test(partner.name)
                ) {
                    partners.push(partner);
                }
            }
        }
        if (!partners.length) {
            const partnersData = await env.rpc(
                {
                    model: 'res.partner',
                    method: 'im_search',
                    args: [keyword, limit]
                },
                { shadow: true }
            );
            for (const data of partnersData) {
                const partnerLocalId = commit('insertPartner', data);
                partners.push(state.partners[partnerLocalId]);
            }
        }
        callback(partners);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {string} threadLocalId
     * @param {string} newState
     */
    async setThreadState({ commit, dispatch }, threadLocalId, newState){
        commit('updateThread', threadLocalId, { state:newState });
        dispatch('_syncThreadState', threadLocalId);
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {string} threadLocalId
     * @param {boolean} newIsMinimized
     */
    async setThreadIsMinimized({ commit, dispatch }, threadLocalId, newIsMinimized){
        commit('updateThread', threadLocalId, {
            is_minimized: newIsMinimized,
            state: newIsMinimized ? 'open' : 'closed'
        });
        dispatch('_syncThreadIsMinimized', threadLocalId);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} messageLocalId
     */
    async toggleStarMessage({ env, state }, messageLocalId) {
        return env.rpc({
            model: 'mail.message',
            method: 'toggle_message_starred',
            args: [[state.messages[messageLocalId].id]]
        });
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async toggleFoldThread({ commit, dispatch, state }, threadLocalId){
        const newState = state.threads[threadLocalId].state === 'open' ? 'folded' : 'open';
        dispatch('setThreadState', threadLocalId, newState);
        if (newState === 'open') {
            commit('focusChatWindow', threadLocalId);
        }
    },
    /**
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} attachmentLocalId
     */
    async unlinkAttachment({ commit, env, state }, attachmentLocalId) {
        const attachment = state.attachments[attachmentLocalId];
        await env.rpc({
            model: 'ir.attachment',
            method: 'unlink',
            args: [attachment.id],
        }, { shadow: true });
        commit('deleteAttachment', attachmentLocalId);
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     */
    async unstarAllMessages({ env }) {
        return env.rpc({
            model: 'mail.message',
            method: 'unstar_all',
        });
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} channelLocalId
     */
    async unsubscribeFromChannel({ env, state }, channelLocalId) {
        const channel = state.threads[channelLocalId];
        if (channel.channel_type === 'channel') {
            return env.rpc({
                model: 'mail.channel',
                method: 'action_unfollow',
                args: [[channel.id]]
            });
        }
        return env.rpc({
            model: 'mail.channel',
            method: 'channel_pin',
            args: [channel.uuid, false]
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} partnerLocalId
     */
    async _checkPartnerIsUser({ commit, env, state }, partnerLocalId) {
        const partner = state.partners[partnerLocalId];
        const userIds = await env.rpc({
            model: 'res.users',
            method: 'search',
            args: [[['partner_id', '=', partner.id]]],
        });
        commit('updatePartner', partnerLocalId, {
            userId: userIds.length ? userIds[0] : null,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     */
    async _fetchPartnerImStatus({ commit, env, state }) {
        let toFetchPartnersLocalIds = [];
        let partnerIdToLocalId = {};
        for (const partner of Object.values(state.partners)) {
            if (
                typeof partner.id !== 'number' || // ignore odoobot
                partner.im_status === null // already fetched and this partner has no im_status
            ) {
                continue;
            }
            toFetchPartnersLocalIds.push(partner.localId);
            partnerIdToLocalId[partner.id] = partner.localId;
        }
        if (!toFetchPartnersLocalIds.length) {
            return;
        }
        const dataList = await env.rpc({
            route: '/longpolling/im_status',
            params: {
                partner_ids: toFetchPartnersLocalIds.map(partnerLocalId =>
                    state.partners[partnerLocalId].id),
            },
        }, { shadow: true });
        for (const data of dataList) {
            commit('updatePartner', `res.partner_${data.id}`, {
                im_status: data.im_status
            });
            delete partnerIdToLocalId[data.id];
        }
        // partners with no im_status => set null
        for (const noImStatusPartnerLocalId of Object.values(partnerIdToLocalId)) {
            commit('updatePartner', noImStatusPartnerLocalId, {
                im_status: null,
            });
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     */
    async _handleGlobalWindowFocus({ commit, env }){
        commit('setOutOfFocusUnreadMessageCounter', 0);
        env.trigger_up('set_title_part', { part: '_chat' });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.dispatch
     * @param {Object} data
     * @param {integer} data.channelId
     * @param {string} [data.info]
     * @param {integer} [data.last_message_id]
     * @param {integer} [data.partner_id]
     */
    async _handleNotificationChannel({ dispatch }, data) {
        const {
            channelId,
            info,
            last_message_id,
            partner_id,
        } = data;
        switch (info) {
            case 'channel_fetched':
                return; // disabled seen notification feature
            case 'channel_seen':
                return dispatch('_handleNotificationChannelSeen', {
                    channelId,
                    last_message_id,
                    partner_id,
                });
            case 'typing_status':
                /**
                 * data.is_typing
                 * data.is_website_user
                 * data.partner_id
                 */
                return; // disabled typing status notification feature
            default:
                return dispatch('_handleNotificationChannelMessage', data);
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.channelId
     * @param {...Object} param1.data
     * @param {Array} [param1.data.author_id]
     * @param {integer} param1.data.author_id[0]
     * @param {integer[]} param1.data.channel_ids
     */
    async _handleNotificationChannelMessage(
        { commit, dispatch, env, state },
        { channelId, ...data }) {
        const {
            author_id: [authorPartnerId]=[],
            channel_ids,
        } = data;
        if (channel_ids.length === 1) {
            await dispatch('joinChannel', channel_ids[0]);
        }
        const messageLocalId = commit('createMessage', data);
        const message = state.messages[messageLocalId];
        for (const threadLocalId of message.threadLocalIds) {
            const thread = state.threads[threadLocalId];
            if (thread._model === 'mail.channel') {
                commit('linkMessageToThreadCache', {
                    messageLocalId,
                    threadCacheLocalId: thread.cacheLocalIds['[]'],
                });
            }
        }

        const currentPartner = state.partners[state.currentPartnerLocalId];
        if (authorPartnerId === currentPartner.id) {
            return;
        }

        const channelLocalId = `mail.channel_${channelId}`;
        const channel = state.threads[channelLocalId];
        const isOdooFocused = env.call('bus_service', 'isOdooFocused');
        if (!isOdooFocused) {
            dispatch('_notifyNewChannelMessageWhileOutOfFocus', {
                channelLocalId,
                messageLocalId,
            });
        }
        commit('updateThread', channelLocalId, {
            message_unread_counter: channel.message_unread_counter + 1,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {integer} param1.channelId
     * @param {integer} param1.last_message_id
     * @param {integer} param1.partner_id
     */
    async _handleNotificationChannelSeen(
        { commit, state },
        {
            channelId,
            last_message_id,
            partner_id,
        }
    ) {

        const currentPartner = state.partners[state.currentPartnerLocalId];
        if (currentPartner.id !== partner_id) {
            return;
        }
        commit('updateThread', `mail.channel_${channelId}`, {
            message_unread_counter: 0,
            seen_message_id: last_message_id,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} data
     * @param {string} [data.info]
     * @param {string} [data.type]
     */
    async _handleNotificationPartner({ commit, dispatch }, data) {
        const {
            info,
            type,
        } = data;
        if (type === 'activity_updated') {
            /**
             * data.activity_created
             * data.activity_deleted
             */
            return; // disabled
        } else if (type === 'author') {
            /**
             * data.message
             */
            return; // disabled
        } else if (type === 'deletion') {
            /**
             * data.message_ids
             */
            return; // disabled
        } else if (type === 'mail_failure') {
            return dispatch('_handleNotificationPartnerMailFailure', data.elements);
        } else if (type === 'mark_as_read') {
            return commit('handleNotificationPartnerMarkAsRead', data);
        } else if (type === 'moderator') {
            /**
             * data.message
             */
            return; // disabled
        } else if (type === 'toggle_star') {
            return commit('handleNotificationPartnerToggleStar', data);
        } else if (info === 'transient_message') {
            return commit('handleNotificationPartnerTransientMessage', data);
        } else if (info === 'unsubscribe') {
            return dispatch('_handleNotificationPartnerUnsubscribe', data.id);
        } else if (type === 'user_connection') {
            return dispatch('_handleNotificationPartnerUserConnection', data);
        } else {
            return dispatch('_handleNotificationPartnerChannel', data);
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {Object} data
     * @param {string} data.channel_type
     * @param {integer} data.id
     * @param {string} [data.info]
     * @param {boolean} data.is_minimized
     * @param {string} data.name
     * @param {string} data.state
     * @param {string} data.uuid
     */
    _handleNotificationPartnerChannel({ commit, dispatch, env, state }, data) {
        const {
            channel_type,
            id,
            info,
            is_minimized,
            name,
            state: channelState,
        } = data;
        if (channel_type !== 'channel' || channelState !== 'open') {
            return;
        }
        const thread = state.threads[`mail.channel_${id}`];
        if (
            !is_minimized &&
            info !== 'creation' &&
            (
                !thread ||
                !thread.memberLocalIds.includes(state.currentPartnerLocalId)
            )
        ) {
            env.do_notify(
                _t("Invitation"),
                _.str.sprintf(
                    _t("You have been invited to: %s"),
                    name),
            );
        }
        if (!state.threads[`mail.channel_${id}`]) {
            const threadLocalId = commit('createThread', data);
            if(state.threads[threadLocalId].is_minimized){
                dispatch('openThread', threadLocalId, {
                    chatWindowMode: 'last',
                });
            }
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Array} elements
     */
    _handleNotificationPartnerMailFailure({ commit }, elements) {
        for (const data of elements) {
            // todo
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {integer} channelId
     */
    _handleNotificationPartnerUnsubscribe({commit, env, state }, channelId) {
        const channelLocalId = `mail.channel_${channelId}`;
        const channel = state.threads[channelLocalId];
        if (!channel) {
            return;
        }
        let message;
        if (channel.directPartnerLocalId) {
            const directPartner = state.partners[channel.directPartnerLocalId];
            message = _.str.sprintf(
                _t("You unpinned your conversation with <b>%s</b>."),
                directPartner.name);
        } else {
            message = _.str.sprintf(
                _t("You unsubscribed from <b>%s</b>."),
                channel.name);
        }
        env.do_notify(_t("Unsubscribed"), message);
        commit('unpinThread', channelLocalId);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param1
     * @param {string} param1.message
     * @param {integer} param1.partner_id
     * @param {string} param1.title
     */
    _handleNotificationPartnerUserConnection(
        { dispatch, env },
        {
            message,
            partner_id,
            title,
        }
    ) {
        env.call('bus_service', 'sendNotification', title, message);
        dispatch('createChannel', {
            autoselect: true,
            partnerId: partner_id,
            type: 'chat',
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object[]} notifications
     * @param {Array} notifications[i][0]
     * @param {string} notifications[i][0][0]
     * @param {string} notifications[i][0][1]
     * @param {integer} notifications[i][0][2]
     * @param {Object} notifications[i][1]
     */
    async _handleNotifications({ commit, dispatch }, notifications) {
        const filteredNotifications = _filterNotificationsOnUnsubscribe(notifications);
        const proms = filteredNotifications.map(notification => {
            const [[dbName, model, id], data] = notification;
            switch (model) {
                case 'ir.needaction':
                    return commit('handleNotificationNeedaction', data);
                case 'mail.channel':
                    return dispatch('_handleNotificationChannel', {
                        channelId: id,
                        ...data
                    });
                case 'res.partner':
                    return dispatch('_handleNotificationPartner', {
                        ...data
                    });
                default:
                    console.warn(`[messaging store] Unhandled notification "${model}"`);
                    return;
            }
        });
        return Promise.all(proms);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async _loadMessagesOnDocumentThread({ commit, dispatch, env, state }, threadLocalId) {
        const thread = state.threads[threadLocalId];
        if (!thread.messageIds) {
            commit('updateThread', threadLocalId, {
                messageIds: [],
            });
        }

        const messageIds = thread.messageIds;

        // TODO: this is for document_thread inside chat window
        // else {
        //     const [{ messageIds }] = await env.rpc({
        //         model: thread._model,
        //         method: 'read',
        //         args: [[thread.id], ['message_ids']]
        //     });
        // }
        const threadCacheLocalId = thread.cacheLocalIds['[]'];
        const threadCache = state.threadCaches[threadCacheLocalId];
        const loadedMessageIds = threadCache.messageLocalIds
            .filter(localId => messageIds.includes(state.messages[localId].id))
            .map(localId => state.messages[localId].id);
        const shouldFetch = messageIds
            .slice(0, state.MESSAGE_FETCH_LIMIT)
            .filter(messageId => !loadedMessageIds.includes(messageId))
            .length > 0;
        if (!shouldFetch) {
            return;
        }
        const idsToLoad = messageIds
            .filter(messageId => !loadedMessageIds.includes(messageId))
            .slice(0, state.MESSAGE_FETCH_LIMIT);
        commit('updateThreadCache', threadCacheLocalId, {
            isLoading: true,
        });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_format',
            args: [idsToLoad],
            context: env.session.user_context
        });
        commit('handleThreadLoaded', threadLocalId, {
            messagesData,
        });
        // await dispatch('markMessagesAsRead', messageLocalIds);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     * @param {Object} [param2]
     * @param {Array} [param2.searchDomain=[]]
     */
    async _loadMessagesOnThread(
        { commit, dispatch, env, state },
        threadLocalId,
        { searchDomain=[] }={}
    ) {
        const thread = state.threads[threadLocalId];
        const stringifiedDomain = JSON.stringify(searchDomain);
        const threadCacheLocalId = thread.cacheLocalIds[stringifiedDomain];
        if (!state.threadCaches[threadCacheLocalId]) {
            commit('createThreadCache', {
                stringifiedDomain,
                threadLocalId,
            });
        }
        if (!['mail.box', 'mail.channel'].includes(thread._model)) {
            return dispatch('_loadMessagesOnDocumentThread', threadLocalId);
        }
        const threadCache = state.threadCaches[threadCacheLocalId];
        if (threadCache.isLoaded && threadCache.isLoading) {
            return;
        }
        let domain = searchDomain.length ? searchDomain : [];
        domain = _extendMessageDomainWithThreadDomain({
            domain,
            thread,
        });
        commit('updateThreadCache', threadCacheLocalId, {
            isLoading: true,
        });
        const messagesData = await env.rpc({
            model: 'mail.message',
            method: 'message_fetch',
            args: [domain],
            kwargs: _getThreadFetchMessagesKwargs(
                { env, state },
                { threadLocalId })
        }, { shadow: true });
        commit('handleThreadLoaded', threadLocalId, {
            messagesData,
            searchDomain,
        });
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.dispatch
     */
    _loopFetchPartnerImStatus({ dispatch }) {
        setTimeout(async () => {
            await dispatch('_fetchPartnerImStatus');
            dispatch('_loopFetchPartnerImStatus');
        }, 50*1000);
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {Object} param0.env
     * @param {Object} param0.getters
     * @param {Object} param0.state
     * @param {Object} param1
     * @param {string} param1.channelLocalId
     * @param {string} param1.messageLocalId
     */
    _notifyNewChannelMessageWhileOutOfFocus(
        { commit, env, getters, state },
        { channelLocalId, messageLocalId }
    ) {
        const channel = state.threads[channelLocalId];
        const message = state.messages[messageLocalId];
        const author = state.partners[message.authorLocalId];
        let notificationTitle;
        if (!author) {
            notificationTitle = _t("New message");
        } else {
            const authorName = getters.partnerName(author.localId);
            if (channel.channel_type === 'channel') {
                // hack: notification template does not support OWL components,
                // so we simply use their template to make HTML as if it comes
                // from component
                const channelIcon = env.qweb.renderToString('mail.component.ThreadIcon', {
                    props: {
                        thread: channel,
                    },
                });
                const channelName = _.escape(getters.threadName(channelLocalId));
                const channelNameWithIcon = channelIcon + channelName;
                notificationTitle = _.str.sprintf(
                    _t("%s from %s"),
                    _.escape(authorName),
                    channelNameWithIcon
                );
            } else {
                notificationTitle = _.escape(authorName);
            }
        }
        const notificationContent = getters
            .messagePrettyBody(message.localId)
            .substr(0, state.PREVIEW_MSG_MAX_SIZE);
        env.call('bus_service', 'sendNotification', notificationTitle, notificationContent);
        commit('setOutOfFocusUnreadMessageCounter', state.outOfFocusUnreadMessageCounter + 1);
        const titlePattern = state.outOfFocusUnreadMessageCounter === 1
            ? _t("%d Message")
            : _t("%d Messages");
        env.trigger_up('set_title_part', {
            part: '_chat',
            title: _.str.sprintf(titlePattern, state.outOfFocusUnreadMessageCounter),
        });
    },

    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.commit
     * @param {function} param0.dispatch
     * @param {Object} param0.state
     * @param {string} chatWindowLocalId either a thread local Id or
     *   'new_message', if the chat window is already in `chatWindowLocalIds`
     *   and visible, simply focuses it. If it is already in
     *   `chatWindowLocalIds` and invisible, it swaps with last visible chat
     *   window. New chat window is added based on provided mode.
     * @param {Object} param2
     * @param {boolean} [param2.focus=true]
     * @param {string} [param2.mode='last_visible'] either 'last' or 'last_visible'
     */
    _openChatWindow(
        { commit, dispatch, state },
        chatWindowLocalId,
        {
            focus=true,
            mode='last_visible',
        }={}
    ) {
        const cwm = state.chatWindowManager;
        const thread = state.threads[chatWindowLocalId];
        if (cwm.chatWindowLocalIds.includes(chatWindowLocalId)) {
            // open already minimized chat window
            if (
                mode === 'last_visible' &&
                cwm.computed.hidden.chatWindowLocalIds.includes(chatWindowLocalId)
            ) {
                commit('makeChatWindowVisible', chatWindowLocalId);
            }
        } else {
            // new chat window
            commit('addChatWindowToManager', chatWindowLocalId);
            if (chatWindowLocalId !== 'new_message') {
                dispatch('setThreadIsMinimized', chatWindowLocalId, true);
                commit('updateThread', chatWindowLocalId, {
                    is_minimized: true,
                    state: 'open',
                });
            }
            commit('_computeChatWindows');
            if (mode === 'last_visible') {
                commit('makeChatWindowVisible', chatWindowLocalId);
            }
        }
        if (thread && thread.state !== 'open') {
            dispatch('setThreadState', chatWindowLocalId, 'open');
        }
        if (focus) {
            commit('focusChatWindow', chatWindowLocalId);
        }
    },
    /**
     * @private
     * @param {Object} param0
     * @param {function} param0.dispatch
     */
    async _startLoopFetchPartnerImStatus({ dispatch }) {
        await dispatch('_fetchPartnerImStatus');
        dispatch('_loopFetchPartnerImStatus');
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async _syncThreadState({ env, state }, threadLocalId){
        const thread = state.threads[threadLocalId];
        env.rpc({
            model: 'mail.channel',
            method: 'channel_fold',
            kwargs: {
                uuid: thread.uuid,
                state: thread.state
            }
        }, {shadow:true});
    },
    /**
     * @param {Object} param0
     * @param {Object} param0.env
     * @param {Object} param0.state
     * @param {string} threadLocalId
     */
    async _syncThreadIsMinimized({ env, state }, threadLocalId){
        const thread = state.threads[threadLocalId];
        env.rpc({
            model: 'mail.channel',
            method: 'channel_minimize',
            args: [
                thread.uuid,
                thread.is_minimized,
            ]
        }, {shadow:true});
    },
};

return actions;

});
