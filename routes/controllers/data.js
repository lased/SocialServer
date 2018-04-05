const path = require('path');
const fs = require('fs');

module.exports.get = function(req, res, next){
    let name = req.url;
    let uri = path.join(__dirname, "../../" + name);
  
    fs.exists(uri, function(exists){
      if(exists){
          res.sendFile(uri);
      }
      else{
          next('File not found');
      }
    })
}
