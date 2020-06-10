odoo.define("web.LunchModelExtension.js", function (require) {
    "use strict";

    const ActionModel = require("web.ActionModel");

    class LunchModelExtension extends ActionModel.Extension {

        get(property) {
            switch (property) {
                case "domain": return this.getDomain();
                case "userId": return this.state.userId;
            }
        }

        async reloadAfterDispatch() {
            await this._getLocationId();
        }

        async load() {
            await this._getLocationId();
        }

        prepareState() {
            Object.assign(this.state, {
                locationId: null,
                userId: null,
            });
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------

        getDomain() {
            if (this.state.locationId) {
                return [["is_available_at", "in", [this.state.locationId]]];
            }
        }

        setLocationId(locationId) {
            this.state.locationId = locationId;
            return this.env.services.rpc({
                route: "/lunch/user_location_set",
                params: {
                    context: this.env.session.user_context,
                    location_id: this.state.locationId,
                    user_id: this.state.userId,
                },
            });
        }

        updateUserId(userId) {
            this.state.userId = userId;
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        async _getLocationId() {
            this.state.locationId = await this.env.services.rpc({
                route: "/lunch/user_location_get",
                params: {
                    context: this.env.session.user_context,
                    user_id: this.state.userId,
                },
            });
        }
    }

    ActionModel.registry.add("lunch", LunchModelExtension, 30);

    return LunchModelExtension;
});
