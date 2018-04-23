const async = require('async');
const mongoose = require('mongoose');

const fs = require('fs');
const path = require('path');

const User = require('../../models/user');
const Group = require('../../models/group');
const http = require('../../http');

const uuid = require("uuid");

module.exports.getUserGroups = function (req, res, next) {
    let id = req.decoded_token._id;

    User.findById(id).select('groups').populate('groups', 'avatar name url users').exec((err, user) => {
        if (err) return res.json(http(500));
        
        res.json(http(200, user.groups));
    })
}

module.exports.createGroup = function (req, res, next) {
    let name = req.body.name;
    let id = req.decoded_token._id;
    let _id = new mongoose.Types.ObjectId;
    let dir = path.join(__dirname, "../../data/groups/" + _id);
    let doc = {
        _id,
        name,
        dateCreated: Date.now(),
        users: [
            {
                user: id,
                main: true
            }
        ]
    }

    Group.count({ _id: { $ne: null } }).exec((err, count) => {
        if (err) return res.json(http(500));

        if (!count) {
            doc.id = 1
        } else {
            doc.id = count + 1;
        }

        doc.url = `id${doc.id}`;

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            fs.mkdirSync(dir + '/images');
            fs.mkdirSync(dir + '/docs');
        }

        let newGroup = new Group(doc);

        User.updateOne({ _id: id }, { $push: { groups: _id } }).exec((err, result) => {
            if (err) return res.json(http(500));
        })

        newGroup.save();
        res.json(http(200));
    })
}
