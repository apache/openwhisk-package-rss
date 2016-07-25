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

package packages

import common._
import org.junit.runner.RunWith
import org.scalatest.Matchers
import org.scalatest.junit.JUnitRunner
import spray.json._
import spray.json.DefaultJsonProtocol.StringJsonFormat
import scala.collection.immutable.HashMap
import org.scalatest.FlatSpecLike

@RunWith(classOf[JUnitRunner])
class TemplateTests extends TestHelpers with WskTestHelpers with Matchers {

  implicit val wskprops = WskProps()
  val wsk = new Wsk()

  //val credentials = TestUtils.getVCAPcredentials("openwhisk-local")
  //val apiKey = credentials.get("apiKey");

  behavior of "Rss Package"

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
}

