const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            unique: true,
            required: true
        },

        userId: {
            type: String,
            required: true,
            index: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        startDate: {
            type: String,
            required: true
        },

        dueDate: {
            type: String,
            required: true
        },

        repeat: {
            type: String,
            enum: ["none", "daily", "weekly", "biweekly", "monthly"],
            default: "none"
        },

        completions: {
            type: [String],
            default: []
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Task", taskSchema);