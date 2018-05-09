const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    id: {
        type: Number,
        index: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    phone: String,
    platform: Boolean,
    surname: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    dateCreated: {
        type: Date,
        required: true
    },
    lastAccess: Date,
    state: Boolean,
    activated: Boolean,

    docs: [{
        name: String,
        date: Date
    }],
    images: [{
        name: String,
        date: Date
    }],
    friends: [
        {
            _id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'users'
            },
            status: Boolean,
            input: Boolean
        }
    ],
    chats: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'chats'
    }],
    groups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'groups'
    }],
    sex: Boolean,
    country: String,
    city: String,
    about: String,
    status: String,
    avatar: String,
    url: {
        type: String,
        index: true,
        unique: true
    },
    birthday: Date
}, {
        versionKey: false
    });

module.exports = mongoose.model('users', schema);
