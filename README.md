# Openwhisk RSS Package

This package allows users to subscribe to RSS/ATOM feeds and receive events when a new feed item is available. It creates one event/activation per feed item that meets the criteria. Below is the hierarchy of the RSS Package.

```
openwhisk-package-rss/
├── CONTRIBUTING.md
|-- images 
├── feeds
│      └── feed.js
├── install.sh
├── LICENSE.txt
├── README.md
├── tests
│   └── src
│      └── RssTests.scala
├── tools
│   └── travis
│       └── build.sh
├── rssEventProvider
│      └── app.js
|	   |__ manifest.yml
|	   |__ package.json
└── uninstall.sh
```


## Architecture

![Architecture](images/rssarchitecture.png?raw=true "High Level Architecture")

## Package contents
| Entity | Type | Parameters | Description |
| --- | --- | --- | --- |
| `/namespace/rss` | package | - | Openwhisk Package Template |
| `/namespace/rss/rss_feed.js` | feed | [details](#feeds) | Feed to provide events when a new rss item is available |

### Feeds parameters
| **Parameter** | **Type** | **Required** | **Description**| **Options** | **Default** | **Example** |
| ------------- | ---- | -------- | ------------ | ------- | ------- |------- |
| url | *string* | yes |  Url to RSS feed | - | - | "http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" |
| pollingInterval | *string* | yes |  Interval at which polling is performed | - | - | "2h" |
| filter | *string* | no |  Comma separted list of keywords to filter on| - | - | "Washington D.C.,capital" |

Note: If the filter parameter enables logic that only searches for matches in the feed items' titles and descriptions. If 60% or more of the keywords are found in the RSS feed item, an event will be fired for the feed item. For example, given that filter "Washington D.C.,capital,politics", an event will be fired only if 2 of the 3 keywords are present in the feed item.

## RSS Package Installation

### Bluemix Installation
First you need to install wsk CLI, follow the instructions at https://new-console.ng.bluemix.net/openwhisk/cli

`./install.sh openwhisk.ng.bluemix.net $AUTH_KEY wsk $PROVIDER_ENDPOINT`

`./uninstall.sh openwhisk.ng.bluemix.net $AUTH_KEY wsk`

where:
- **$PROVIDER_ENDPOINT** is the endpoint of the event provider service. It's a fully qualified url including the path to the resource. i.e. http://host:port/rss
- **$AUTH_KEY** is the OpenWhisk Authentication key(Run `wsk property get` to obtain it).

### Local installation:
Local installation requires running the OpenWhisk environment locally prior to installing the package. To run OpenWhisk locally follow the instructions at https://github.com/openwhisk/openwhisk/blob/master/tools/vagrant/README.md.    

`./install.sh  $EDGE_HOST $AUTH_KEY $WSK_CLI $PROVIDER_ENDPOINT`

`./uninstall.sh  $EDGE_HOST $AUTH_KEY $WSK_CLI` 

where :
- **$EDGE_HOST** is where openwhisk is deployed
- **$AUTH_KEY** is the OpenWhisk Authentication key(Run `wsk property get` to obtain it).
- **$WSK_CLI** is the path of OpenWhisk command interface binary
- **$PROVIDER_ENDPOINT** is the endpoint of the event provider service. It's a fully qualified url including the path to the resource. i.e. http://host:port/rss

This will create a new package called **rss** as well as feed action within the package.


## RSS Service(Event Provider) Deployment

In order to support the openwhisk package, there needs to be an event generating service that fires a trigger in the openwhisk environment. This service polls an RSS/ATOM source and applies logic to determine whether a feed item should be delivered to the openwhisk rss package. It internally uses  Cloudant/CouchDB database to persist the triggers' information. You will need to initialized the DB prior to using this service. The event provider service keeps a registry of triggers. When a trigger is initially created, the service fires events for RSS feed items which are published within pollingInterval from now.

There are two options to deploy the service:

### Bluemix Deployment:
This service can be hosted as a cf app on CloudFoundry. To deploy on IBM Bluemix:

1. Create a Cloudant service on bluemix, and create a database with name 'registered_triggers'
1. Change the name and host fields in the manifest.yml to be unique. Bluemix requires routes to be globally unique.
2. Run `cf push`

### Local Deployment:
This service can be ran as a node app on your local machine.

1. Install a local CouchDB, for how to install a CouchDB locally, please follow instruction at https://developer.ibm.com/open/2016/05/23/setup-openwhisk-use-local-couchdb/

2. Create a database with name 'registered_triggers' in the CouchDB.

3. Run the following command, `node app.js CLOUDANT_USERNAME CLOUDANT_PASSWORD OPENWHISK_AUTH_KEY`

Note: Local deployment of this service requires extra configuration if it's to be run with the Bluemix OpenWhisk.

## Usage of RSS package.
To use this trigger feed, you need to pass the required parameters (refer to the table below)

`wsk trigger create rss_trigger --feed /namespace/package/feed_name -p url 'url_to_rss' -p pollingInterval 'timePeriod'`

e.g.
`wsk trigger create rss_trigger --feed /guest/rss/rss_feed -p url 'http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' -p pollingInterval '2h'`

Accepted polling interval formats: 2 days, 1d, 10h, 2.5hrs, 2h, 1m, 5s

For testing purpose, you could use https://github.com/mbertolacci/lorem-rss as the rss feed source.

To use trigger feed to delete created trigger.

`wsk trigger delete rss_trigger`

## Associate rss trigger and action by using rule
 1. Create a new trigger, for example:
 `wsk trigger create rss_trigger --feed /guest/rss/rss_feed -p url 'http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml'  -p pollingInterval  '2h'   -p whiskHost  whiskhostip`

 2. Create a 'hello.js' file that reacts to the trigger events with action code below:
 ```
 function main(params) {
   var title = params.title || 'world';
   var des = params.description || 'default_description';
  return {payload: 'hello,' + title + '!'+ 'description' + des};

 }
 ```
 Make sure the action exists:
 `wsk action update hello hello.js`

 3. Create the rule that associate the trigger and the action:
 `wsk rule create rss_rule rss_trigger hello`

 4. So once there are any rss updates that trigger events, you can verify the action was invoked by checking the most recent activations:

 `wsk activation list --limit 1  hello`

 ```
 activations
 f9d41bd2589943efa4f36c5cf1f55b44             hello
 ```

 `wsk activation result f9d41bd2589943efa4f36c5cf1f55b44`

 ```
 {
     "payload": "hello,Lorem ipsum 2016-09-13T03:05:57+00:00!descriptionUllamco esse officia cillum exercitation ullamco aute aute quis adipisicing officia."
 }
 ```
## How to do tests
The integration test could only be performed with a local openwhisk deployment:

   1. Copy your test files into `openwhisk/tests/src/packages`   
   2. `vagrant ssh` to your local vagrant environment      
   3. Navigate to the openwhisk directory   
   4. Run this command - `gradle :tests:test --tests "packages.CLASS_NAME" `

To execute all tests, run `gradle :tests:test` 

## How to contributing
Please refer to [CONTRIBUTING.md](CONTRIBUTING.md)

## License
Copyright 2015-2016 IBM Corporation

Licensed under the [Apache License, Version 2.0 (the "License")](http://www.apache.org/licenses/LICENSE-2.0.html).

Unless required by applicable law or agreed to in writing, software distributed under the license is distributed on an "as is" basis, without warranties or conditions of any kind, either express or implied. See the license for the specific language governing permissions and limitations under the license.
