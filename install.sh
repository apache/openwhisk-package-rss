#!/bin/bash

#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

set -e
set -x

if [ $# -eq 0 ]
then
    echo "Usage: ./install.sh APIHOST AUTH WSK_CLI"
fi

APIHOST="$1"
AUTH="$2"
WSK_CLI="$3"
PROVIDER_ENDPOINT="$4"

PACKAGE_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo Installing RSS Package \

$WSK_CLI -i --apihost $APIHOST package update rss --auth $AUTH --shared yes \
    -a description "RSS Package" \
    -a parameters '[{"name":"provider_endpoint","required":true,"bindTime":true,"description":"RSS provider host"}]'


$WSK_CLI -i --apihost $APIHOST action update rss/rss_feed $PACKAGE_HOME/feeds/feed.js --auth $AUTH \
    -a feed true \
	-a description "A feed action to register for rss events meeting user specified criteria" \
	-a parameters '[{"name":"url","required":true,"bindTime":true,"description":"Source URL"},{"name":"pollingInterval","required":true,"bindTime":true,"description":"RSS polling interval"},{"name":"filter","required":false,"bindTime":true,"description":"Comma separated list of keywords to watch for"}]' \
    -a sampleInput '{"url":"http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml","pollingInterval":"2h", "filter":"Washington, Capitol"}' \
