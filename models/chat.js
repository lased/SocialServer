const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    messages: [{
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'users'
        },
        date: Date,
        message: {
            reply: mongoose.Schema.Types.ObjectId,
            text: String,
            typeText: String           
        },
        files: [
            {
                date: Date,
                file: String
            }
        ]
    }],
    name: String,
    avatar: String,
    platform: Boolean,
    state: Boolean,
    unread: Number,
    users: [
        {
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'users'
            },
            main: Boolean,
            online: Boolean,
            unread: Number
        }
    ]
}, {
        versionKey: false
    });

module.exports = mongoose.model('chats', schema);
