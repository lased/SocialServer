const express = require('express');
const path = require('path');
const router = express.Router();

var multer  = require('multer')
var upload = multer({ dest: path.join(__dirname, '../data/uploads/') })

const jwt = require('jsonwebtoken');
const config = require('../config');
const http = require('../http');

const data = require('./controllers/data');
const user = require('./controllers/user');
const chat = require('./controllers/chat');

router.get('/api/user/chat', access, chat.getMessages);
router.post('/api/user/chat', access, chat.createChat);

router.get('/api/user/chats', access, chat.getChats);
router.post('/api/user/chat/message', upload.array('uploadedFiles', 5), access, chat.writeMessage);

router.get('/api/user/files', access, user.getFiles);

router.post('/api/user/friend', access, user.addFriend);
router.get('/api/user/friend', access, user.friends);
router.delete('/api/user/friend', access, user.cancelAddFriend);
router.put('/api/user/friend', access, user.confirmAddFriend);

router.get('/api/user', user.get);

router.post('/api/user/login', user.login);
router.post('/api/user/forget', user.forget);
router.post('/api/user/registration', user.registration);

router.post('/api/user/auth', user.auth);

router.get('/api/user/settings', access, user.settings);
router.post('/api/user/settings', access, user.setSettings);

router.post('/api/user/avatar', upload.single('image'), access, user.setAvatar);
router.post('/api/user/photo/avatar', access, user.photoAvatar);

router.get('/api/user/photos', access, user.getPhotos);
router.post('/api/user/photos', upload.array('images', 10), access, user.addPhotos);

router.delete('/api/user/photo', access, user.deletePhoto);

router.get('/api/user/activate/:id/:hash', user.activate);
router.get('/api/user/change/email/:id/:hash/:email', user.changeEmail);

router.get('/data/*', data.get);

module.exports = router;

function access(req, res, next) {
    let token = req.query.token || req.body.token;     

    jwt.verify(token, config.get('secret'), function (err, decode) {        
        if (err) return res.json(http(400));   

        req.decoded_token = decode;
        next();
    });

}
