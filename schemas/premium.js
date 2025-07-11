const { model, Schema } = require("mongoose");

const premiumUserSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    addedAt: { type: Date, default: Date.now }
});

module.exports = model("premium", premiumUserSchema);
