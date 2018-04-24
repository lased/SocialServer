const async = require('async');
const mongoose = require('mongoose');

const fs = require('fs');
const path = require('path');

const User = require('../../models/user');
const Group = require('../../models/group');
const http = require('../../http');

const uuid = require("uuid");

module.exports.deleteGroup = function (req, res, next) {
}

module.exports.joinGroup = function (req, res, next) {
    let userId = req.decoded_token._id;
    let groupId = req.body.id;

    async.waterfall([
        c => {
            Group.findByIdAndUpdate(groupId, {
                $push: {
                    users: {
                        user: userId,
                        main: false
                    }
                }
            }).exec((err, group) => {
                if (err) return c(err);

                c(null);
            });
        },
        c => {
            User.updateOne({ _id: userId }, {
                $push: {
                    groups: groupId
                }
            }).exec((err, result) => {
                if (err) return c(err);

                c(null);                
            })
        }
    ], (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.getGroup = function (req, res, next) {
    let url = req.query.url;

    Group.findOne({ url }).populate({
        path: 'users.user',
        select: 'avatar url name surname'
    }).exec((err, group) => {
        if (err) return res.json(http(500));

        res.json(http(200, group));
    });
}

module.exports.leaveGroup = function (req, res, next) {
    let userId = req.decoded_token._id;
    let groupId = req.query.id;

    async.waterfall([
        c => {
            Group.updateOne({ _id: groupId }, {
                $pull: {
                    users: {
                        user: userId
                    }
                }
            }).exec((err, result) => {
                if (err) return c(err);

                c(null);
            });
        },
        c => {
            User.updateOne({ _id: userId }, {
                $pull: {
                    groups: groupId
                }
            }).exec((err, result) => {
                if (err) return c(err);

                c(null);                
            })
        }
    ], (err, result) => {
        if (err) return res.json(http(500));

        res.json(http(200));
    });
}

module.exports.getUserGroups = function (req, res, next) {
    let id = req.decoded_token._id;

    User.findById(id).select('groups').populate({
        path: 'groups',
        select: 'avatar name url users',
        populate: {
            path: 'users.user',
            select: 'url'
        }
    }).exec((err, user) => {
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
