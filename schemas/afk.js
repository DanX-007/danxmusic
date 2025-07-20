const { Schema, model } = require("mongoose");

const afkSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    isAfk: { type: Boolean, default: false },
    afkReason: { type: String, default: "" },
    afkSince: { type: Date },
});

module.exports = {
    afk: model("afk", afkSchema)
}