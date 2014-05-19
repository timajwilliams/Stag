var NUMBERS_SET, TWILIO_NUMBER, TWILIO_SID, TWILIO_TOKEN, app, express, http, path, redis, bodyParser, redisClient, twilioClient, vcap_services, host;

NUMBERS_SET = "numbers";

TWILIO_NUMBER = process.env.TWILIO_NUMBER;

TWILIO_SID = process.env.TWILIO_SID;

TWILIO_TOKEN = process.env.TWILIO_TOKEN;

express = require("express");

http = require("http");

path = require("path");

redis = require("redis");

bodyParser = require('body-parser');

var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
 
function getRedisCredentials(){
  var credentials = {}
  if(process.env.VCAP_SERVICES){
    var services = JSON.parse(process.env.VCAP_SERVICES);
    credentials = services['redis-2.2'][0]['credentials'];
  } else {
    credentials = {
      "hostname":"localhost",
      "host":"127.0.0.1",
      "port":6379,
      "password":"",
      "name":""
    }
  }
  return credentials;
}
 
var redisCredentials = getRedisCredentials();

redisClient = redis.createClient(redisCredentials.port, redisCredentials.host);
if(redisCredentials.password != '') redisClient.auth(redisCredentials.password);


twilioClient = require('twilio')(TWILIO_SID, TWILIO_TOKEN);

vcap_services = JSON.parse(process.env.VCAP_SERVICES)

host = (process.env.VCAP_APP_HOST || 'localhost');

app = express();

app.set("port", process.env.VMC_APP_PORT || 3000);

app.use(bodyParser.urlencoded());

app.post("/", function(req, res) {
  var from, message;
  from = req.param("From");
  message = req.param("Body");
  return redisClient.sismember(NUMBERS_SET, from, function(err, exists) {
    if (exists) {
      return redisClient.get(from, function(err, name) {
        message = "" + name + ": " + message;
        return redisClient.smembers(NUMBERS_SET, function(err, numbers) {
          var number, _i, _len;
          for (_i = 0, _len = numbers.length; _i < _len; _i++) {
            number = numbers[_i];
            if (number === from) {
              continue;
            }
            twilioClient.sendMessage({
              to: number,
              from: TWILIO_NUMBER,
              body: message
            });
          }
          return res.send();
        });
      });
    } else {
      redisClient.sadd(NUMBERS_SET, from);
      redisClient.set(from, message);
      twilioClient.sendMessage({
        to: from,
        from: TWILIO_NUMBER,
        body: name + ", Your name and number were added. STAG STAG STAG!"
      });
      return res.send();
    }
  });
});


app.get('/', function(req, res){
  res.send('hello world');
});

http.createServer(app).listen(app.get("port"), function() {
  return console.log("Express server listening on port " + app.get("port"));
});

