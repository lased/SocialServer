const async = require('async');

const fs = require('fs');
const path = require('path');

const User = require('../../models/user');
const Chat = require('../../models/chat');
const http = require('../../http');
const config = require('../../config');


module.exports.writeMessage = function (req, res, next) {
    let idUser = req.decoded_token._id;
    let files = req.files;
    let data = req.body;

    console.log(data, files);
    //Обработать данные
    
}