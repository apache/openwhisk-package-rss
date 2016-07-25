#Openwhisk RSS Package
==========================
This package allows users to subscribe to RSS/ATOM feeds and receive events when a new feed item is available. It creates one event/activation per feed item that meets the criteria. 

```

openwhisk-package-rss/
├── actions
│   └── app.js
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


##Architecture 

![Architecture](images/rssarchitecture.png?raw=true "High Level Architecture")

##Usage
To use this trigger feed, you need to pass the required parameters (refer to the table below)

`wsk trigger create rss_trigger --feed /namespace/package/feed_name -p url 'url_to_rss' -p pollingInterval 'timePeriod'`

e.g.   
`wsk trigger create rss_trigger --feed /guest/rss/rss_feed -p url 'http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' -p pollingInterval '2h'`

Accepted polling interval formats: 2 days, 1d, 10h, 2.5hrs, 2h, 1m, 5s 


##Install/Uninstall RSS package
This package can be installed locally(local openwhisk instance or a vendors OpenWhisk offering such as Bluemix OpenWhisk)

Local installation:
--------------------
Install the package using `./install.sh  $EDGE_HOST $AUTH_KEY $WSK_CLI $PROVIDER_ENDPOINT`
where :
- **$EDGE_HOST** is where openwhisk is deployed
- **$AUTH_KEY** is the OpenWhisk Authentication key(Run `wsk property get` to obtain it).
- **$WSK_CLI** is the path of OpenWhisk command interface binary
- **$PROVIDER_ENDPOINT** is the endpoint of the event provider service, i.e. http://host:port/rss

This will create a new package called **rss** as well as feed action within the package.

To uninstall the package, use `./uninstall.sh  $EDGE_HOST $AUTH_KEY $WSK_CLI` 

Bluemix Installation 
----------------------
`./install.sh openwhisk.ng.bluemix.net $AUTH_KEY wsk $PROVIDER_ENDPOINT`

`./uninstall.sh openwhisk.ng.bluemix.net $AUTH_KEY wsk`

Note: this assumes the wsk CLI is already installed(https://new-console.ng.bluemix.net/openwhisk/cli). 

##Testing
Executing test case locally:    

   1. Copy your test files into `openwhisk/tests/src/packages`   
   2. `vagrant ssh` to your local vagrant environment      
   3. Navigate to the openwhisk directory   
   4. Run this command - `gradle :tests:test --tests "packages.CLASS_NAME`   

To execute all tests, run `gradle :tests:test` 

##Package contents
| Entity | Type | Parameters | Description |
| --- | --- | --- | --- |
| `/namespace/rss` | package | - | Openwhisk Package Template |
| `/namespace/rss/rss_feed.js` | feed | [details](#feeds) | Feed to provide events when a new rss item is available |

###Feeds
| **Parameter** | **Type** | **Required** | **Description**| **Options** | **Default** | **Example** |
| ------------- | ---- | -------- | ------------ | ------- | ------- |------- |
| url | *string* | yes |  Url to RSS feed | - | - | "http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" |
| pollingInterval | *string* | yes |  Interval at which polling is performed | - | - | "2h" |
| filter | *string* | no |  Comma separted list of keywords to filter on| - | - | "Washington D.C.,capital" |

Note: If the filter parameter enables logic that only searches for matches in the feed items' titles and descriptions. If 60% or more of the keywords are found in the RSS feed item, an event will be fired for the feed item. For example, given that filter "Washington D.C.,capital,politics", an event will be fired only if 2 of the 3 keywords are present in the feed item. 


RSS Service(Event Provider)
============================
In order to support the openwhisk package, there needs to be an event generating service that fires a trigger in the openwhisk environment. This service polls an RSS/ATOM source and applies logic to determine whether a feed item should be delivered to the openwhisk rss package. It uses internally a CouchDB database to persist the triggers information. You will need to initialized the DB prior to using this service. The event provider service keeps a registry of triggers. When a trigger is initially created, the service fires events for RSS feed items which are published within pollingInterval from now.

Local Deployment:
------------------
This service can be ran as a node app on your local machine. To run it use the following command:

`node app.js CLOUDANT_USERNAME CLOUDANT_PASSWORD OPENWHISK_AUTH_KEY`

Bluemix Deployment: 
-------------------
This service can be hosted as a cf app on CloudFoundry. To deploy on IBM Bluemix:

1. change the name and host fields in the manifest.yml
2. Run `cf push`

Initializing database:
------------------------------
Create a CouchDB/Cloudant instance called ow_triggers and the following database:
- registered_triggers

## Contributing
Please refer to [CONTRIBUTING.md](CONTRIBUTING.md)

## License
Copyright 2015-2016 IBM Corporation

Licensed under the [Apache License, Version 2.0 (the "License")](http://www.apache.org/licenses/LICENSE-2.0.html).

Unless required by applicable law or agreed to in writing, software distributed under the license is distributed on an "as is" basis, without warranties or conditions of any kind, either express or implied. See the license for the specific language governing permissions and limitations under the license.
