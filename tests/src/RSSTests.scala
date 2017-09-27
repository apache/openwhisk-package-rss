/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package rss

import common._
import org.junit.runner.RunWith
import org.scalatest.Matchers
import org.scalatest.junit.JUnitRunner
import common.TestHelpers
import common.TestUtils._
import common.Wsk
import common.WskProps
import common.WskTestHelpers

@RunWith(classOf[JUnitRunner])
class RSSTests extends TestHelpers with WskTestHelpers with Matchers {

  implicit val wskprops = WskProps()
  val wsk = new Wsk()

    behavior of "Rss Package"
    /*
    "trigger creation" should "return ok: created trigger feed" in {
    val triggerName = "trigger_rss_update"
    val feed = Some("/guest/rss/rss_feed")
    val annotation = Map("dummy"->"dummy".toJson)
    val params = Map("url" -> "http://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml".toJson, "pollingInterval" -> "2h".toJson);

    var res = wsk.trigger.create(triggerName,params,annotation,feed)
    res.toString should include("ok: created trigger feed")
    }


    "trigger deletion" should "return ok: deleted" in {
    val triggerName = "trigger_rss_update"

    var res = wsk.trigger.delete(triggerName);
    res.toString should include("ok: deleted ")
    }
    */

    it should "not create a trigger when feed fails to initialize" in withAssetCleaner(wskprops) { (wp, assetHelper) =>
        assetHelper.withCleaner(wsk.trigger, "badfeed", confirmDelete = false) { (trigger, name) =>
          trigger.create(name, feed = Some(s"bogus"), expectedExitCode = ANY_ERROR_EXIT).exitCode should equal(NOT_FOUND)
          trigger.get(name, expectedExitCode = NOT_FOUND)

          trigger.create(name, feed = Some(s"bogus/feed"), expectedExitCode = ANY_ERROR_EXIT).exitCode should equal(
            NOT_FOUND)
          trigger.get(name, expectedExitCode = NOT_FOUND)
        }
      }
}
