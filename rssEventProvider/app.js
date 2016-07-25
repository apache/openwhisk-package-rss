/*
* Copyright 2015-2016 IBM Corporation
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


const Cloudant = require('cloudant');
var logger = require('winston');
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var Promise = require('bluebird');
var ms = require('ms');
var FeedParser = require('feedparser');
var feedparser = new FeedParser();
var app = express(); 
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
app.use(bodyParser.json());
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var whiskhost;
var triggers = {}
var credentials = {}
var apiKey;

if(process.env.VCAP_SERVICES) {
    credentials = appEnv.getServiceCreds("ow_triggers");
    whiskhost = "openwhisk.ng.bluemix.net"
} else if(process.argv[2]!=null && process.argv[3]!=null && process.argv[4]!=null){
    credentials.username = process.argv[2]
    credentials.password = process.argv[3]
    apiKey = process.argv[4].split(':');
}

if(!credentials || !credentials.username || !credentials.password) {
    logger.error('No credentials provided')
    process.exit(1)
}

var cloudant = Cloudant({account: credentials.username, password: credentials.password}, function(err, cloudant) {
    if (err) {
        return logger.error('Failed to initialize Cloudant: ' + err.message);
    }
});

var db = cloudant.db.use("registered_triggers");

//POST
app.post('/rss',authorize, function(req, res) {
    var method  = "POST /rss";
    var newRequest = req.body;

    // early exits 
    if(!newRequest.namespace) return sendError(method, 400, 'No namespace', res)
    if(!newRequest.name) return sendError(method, 400, 'No name', res)
    if(!newRequest.url) return sendError(method, 400, 'No url', res)
    if(!newRequest.pollingInterval) return sendError(method, 400, 'No pollingInterval', res)
   
    if(appEnv.isLocal) {
        newRequest.apiKey = apiKey[0] + ":" + apiKey[1]  
        whiskhost = newRequest.whiskhost; 
    }
    else {
        newRequest.apiKey = req.user.uuid + ":" + req.user.key; 
    }

    var triggerIdentifier = getTriggerIdentifier(newRequest.apiKey, newRequest.namespace, newRequest.name);
    newRequest.pollingInterval = ms(newRequest.pollingInterval);

    if(!newRequest.pollingInterval) {
        logger.error("Bad pollingInterval")
        sendError(method, 400, "Bad polling interval",res)
        return
    }

    if(!triggers[triggerIdentifier])
    {
       createTrigger(newRequest);

       var insertToDB = Promise.promisify(db.insert);
       insertToDB(newRequest, triggerIdentifier)
       .then(function(err){
            checkFeedSourceUpdated(triggerIdentifier, function(err,data){
                if(data) {
                    res.status(200).json({ok:'trigger ' + newRequest.name + ' created successfully'});
                }
                else {
                    deleteTrigger(req.body.namespace, req.body.name, req.user.uuid + ':' + req.user.key)
                    res.status(400).json({error:'trigger ' + newRequest.name + ' creation failed because '  + err.message})
                }
           })
       })
       .catch(function(err){
            logger.error("Error " + err.message)
            return sendError(method, 400, err.message,res)
       })
    }
    else {
        return sendError(method, 400, "Trigger " +  newRequest.name +  " already exist",res)
    }
});

app.delete('/rss',authorize, function(req, res) {
    var deleted = deleteTrigger(req.body.namespace, req.body.name, req.user.uuid + ':' + req.user.key)
    if(deleted) {
        return res.status(200).json({ok: 'trigger ' + req.params.name + ' successfully deleted'});
    }
    else {
        return res.status(404).json({error: 'trigger ' + req.params.name + ' not found'});
    }
});

//*----RSS method-----*
function checkFeedSourceUpdated(triggerIdentifier, callback)
{
    var newTrigger = triggers[triggerIdentifier];
    logger.info("Start of CheckFeedSourceUpdated for " + newTrigger.namespace + "/" + newTrigger.name) 
    var timeLastChecked = newTrigger.timeLastChecked;
    var filter = newTrigger.filter;
    var keywordsArray;

    if(filter)
    {
        keywordsArray = filter.split(",");
    }

    var req = request(newTrigger.url)
        , feedparser = new FeedParser();
    
    req.on('error', function (error) {
        var err = new Error(error.message)
        callback(err, null);
    });

    req.on('response', function (res) {
        var stream = this;
        if (res.statusCode != 200)
        {
            this.emit('error', new Error('Bad status code. Check your url and try again!'));
        }
        else
        {
            stream.pipe(feedparser);
        }
    });

    feedparser.on('error', function(error) {
        logger.info("Error encountered" + error.message)
        callback(error, null);
    });

    feedparser.on('readable', function() {
        var stream = this
          , meta = this.meta 
          , item;

        var itemDate;
        var itemTime;
        var includeItem;
        var itemContentMap;

        while (item = stream.read()) {
            itemDate = item.date;
            itemTime = new Date(itemDate).getTime();

            if(itemTime > timeLastChecked)
            {
                itemContentMap= createItemContentMap(item);
                
                if(keywordsArray) {   //If filter is present, search for keywords 
                    includeItem = areKeywordsFoundInItems(keywordsArray,item, 0.6);//Hardcoded threshold. Maybe externalize later
                     
                    if(includeItem) {
                      fireTrigger(newTrigger.namespace,newTrigger.name,itemContentMap, newTrigger.apiKey)
                    }
                }
                else {
                    fireTrigger(newTrigger.namespace,newTrigger.name,itemContentMap, newTrigger.apiKey)
                }
            }
        }
    });

    feedparser.on('end', function() {
        callback(null, true)
        logger.info('End of checkFeedSourceUpdated for ' + newTrigger.namespace + "/" + newTrigger.name);
    });
}

function fireTrigger(namespace, name, payload, apiKey) {;
    var baseUrl = "https://" + whiskhost + "/api/v1/namespaces";
    var keyParts = apiKey.split(':');

    var options = {
        method: "POST",
        url: baseUrl + "/" + namespace + "/triggers/" + name,
        json: payload,
        auth: {
            user: keyParts[0],
            pass: keyParts[1]
        }
    };

    request(options, (err, res, body) => {
        if (!err && res.statusCode == 200) {
            logger.info("Trigger fired");
        } else {
            logger.info("Can not fire trigger: " + err);
            logger.info('http status code:', (res || {}).statusCode);
            logger.error('error:', err);
            logger.info('body:', body);
        }
    });
}

function deleteTrigger(namespace, name, apikey) {
    var method = 'deleteTrigger';

    var triggerIdentifier = getTriggerIdentifier(apikey, namespace, name);

    if(triggers[triggerIdentifier]) {
        clearInterval(triggers[triggerIdentifier].cronHandle);
        delete triggers[triggerIdentifier];

        logger.info(method, 'trigger', namespace + "  " + name , 'successfully deleted');

        db.get(triggerIdentifier, function(err, body) {
            if(!err) {
                db.destroy(body._id, body._rev, function(err) {
                    if(err) logger.error(method, 'there was an error while deleting', triggerIdentifier, 'from database');
                });
            }
            else {
                logger.error(method, 'there was an error while deleting', triggerIdentifier, 'from database');
            }
        });
        return true;
    }
    else {
        logger.info(method, 'trigger', triggerIdentifier, 'could not be found');
        return false;
    }
}

function areKeywordsFoundInItems(keywordsArray, item, keywordsThreshold)
{
    var numberKeywordsFound = 0;

    for(var k in keywordsArray)
    {
        if(item.description.toLowerCase().indexOf(keywordsArray[k].toLowerCase())>-1 || item.title.toLowerCase().indexOf(keywordsArray[k].toLowerCase())>-1)
        {
           numberKeywordsFound++;
        }
    }
    var keywordsFoundToTotalKeywordsRatio = numberKeywordsFound/keywordsArray.length;

    if(keywordsFoundToTotalKeywordsRatio >= keywordsThreshold) //60% coverage
    {
        return true;
    }
    else
    {
       return false;
    }
}

function createItemContentMap(item)
{
    var json = {};

    json["title"] = item.title;
    json["description"] = item.description;
    json["summary"] = item.summary;
    json["date"] = item.date;
    json["link"] = item.link;
    json["origlink"] = item.origlink;
    json["permalink"] = item.permalink;
    json["pubdate"] = item.pubdate;
    json["author"] = item.author;
    json["guid"] = item.guid;
    json["comments"] = item.comments;
    json["image"] = item.image;
    json["categories"] = item.categories;
    json["source"] = item.source;
    json["enclosures"] = item.enclosures;
    json["meta"] = item.meta;

    return json;
}

function createTrigger(params) {
    var timeNow = new Date().getTime();
    var timeLastChecked = timeNow - params.pollingInterval;
    var triggerIdentifier = getTriggerIdentifier(params.apiKey, params.namespace, params.name);

    var cronHandle = setInterval(function() {
        logger.info("Polling....");
        checkFeedSourceUpdated(triggerIdentifier,function(err,data){});
    }, params.pollingInterval);
    
    var trigger = {
        cronHandle: cronHandle,
        apiKey: params.apiKey,
        url:params.url,
        name: params.name,
        namespace:params.namespace,
        pollingInterval: params.pollingInterval,
        filter: params.filter,
        timeLastChecked:timeLastChecked
    };

    triggers[triggerIdentifier] = trigger;
}

function getTriggerIdentifier(apikey, namespace, name) {
    return apikey + '/' + namespace + '/' + name;
}

function sendError(method, statusCode, message, res) {
    logger.info(method, message);
    res.status(statusCode).json({
        error: message
    });
}

function authorize(req, res, next) {
    var method = req.method;   

    if(!req.headers.authorization) return sendError(method, 400, 'Malformed request, authentication header expected', res);

    var parts = req.headers.authorization.split(' ');
    if (parts[0].toLowerCase() !== 'basic' || !parts[1]) return sendError(method, 400, 'Malformed request, basic authentication expected', res);

    var auth = new Buffer(parts[1], 'base64').toString();
    auth = auth.match(/^([^:]*):(.*)$/);
    if (!auth) return sendError(method,400, 'Malformed request, authentication invalid', res);

    req.user = {
        uuid: auth[1],
        key: auth[2]
    };

    next();
}

function resetSystem() {
    var method = 'resetSystem';
    logger.info(method, 'resetting system from last state');
    db.list({include_docs: true}, function(err, body) {
        if(!err) {
            body.rows.forEach(function(trigger) {
                createTrigger(trigger.doc);
            });
        }
        else {
            logger.error(method, 'could not get latest state from database');
        }
    });
}

app.listen(appEnv.port || 6003, function () {
    logger.info('init', 'listening on port ' + appEnv.port || 6003);
    logger.info("About to reset the system")
    resetSystem();
});