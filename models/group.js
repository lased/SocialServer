const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
    id: {
        type: Number,
        index: true,
        unique: true
    },
    name: String,
    description: String,
    url: {
        type: String,
        index: true,
        unique: true
    },
    avatar: {
        type: String,
        default: '/data/images/default-group-avatar.jpg'
    },
    dateCreated: {
        type: Date,
        required: true
    },
    users: [
        {
            _id: false,
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'users'
            },
            main: Boolean
        }
    ],
    shedule: {
        pairs: {
            type: Array,
            default: []
        },
        lowerWeek: {
            type: Array,
            default: []
        },
        topWeek: {
            type: Array,
            default: []
        }
    }
}, {
        versionKey: false
    });

module.exports = mongoose.model('groups', schema);
