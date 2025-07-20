// schemas/birthday.js
const { Schema, model } = require("mongoose");

const birthdaySchema = new Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    birthday: { type: Date, required: true },
    announced: { type: Boolean, default: false }, // For annual announcements
    createdAt: { type: Date, default: Date.now }
});

module.exports = {
    birthday: model("birthday", birthdaySchema)
}