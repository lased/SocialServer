const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    messages: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        date: Date,
        message: {
            to: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'users'
            },
            text: String
        },
        files: [{
            path: String
        }]
    }],
    users: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        main: Boolean
    }]
}, {
    versionKey: false
});

module.exports = mongoose.model('chats', schema);
