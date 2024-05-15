from flask import Flask, render_template, request, jsonify, send_file
from openai import OpenAI
import os
import websocket
import datetime
import hashlib
import base64
import hmac
import json
from urllib.parse import urlencode
import time
import ssl
from wsgiref.handlers import format_date_time
from datetime import datetime
from time import mktime
import _thread as thread

client = OpenAI(api_key="sess-3s5HNqOgrQcYnjUiYZjutwBgYwuMLdagEfBYI8Su")
app = Flask(__name__)

sketch_object_en = ["bird", "ant", "ambulance", "angel", "alarm_clock", "antyoga", "backpack", "barn", "basket", "bear", "bee", "beeflower", "bicycle", "book", "brain", "bridge", "bulldozer", "bus", "butterfly", "cactus", "calendar", "castle", "cat", "catbus", "catpig", "chair", "couch", "crab", "crabchair", "crabrabbitfacepig", "cruise_ship", "diving_board", "dog", "dogbunny", "dolphin", "duck", "elephant", "elephantpig", "everything", "eye", "face", "fan", "fire_hydrant", "firetruck", "flamingo", "flower", "floweryoga", "frog", "frogsofa", "garden", "hand", "hedgeberry", "hedgehog", "helicopter", "kangaroo", "key", "lantern", "lighthouse", "lion", "lionsheep", "lobster", "map", "mermaid", "monapassport", "monkey", "mosquito", "octopus", "owl", "paintbrush", "palm_tree", "parrot", "passport", "peas", "penguin", "pig", "pigsheep", "pineapple", "pool", "postcard", "power_outlet", "rabbit", "rabbitturtle", "radio", "radioface", "rain", "rhinoceros", "rifle", "roller_coaster", "sandwich", "scorpion", "sea_turtle", "sheep", "skull", "snail", "snowflake", "speedboat", "spider", "squirrel", "steak", "stove", "strawberry", "swan", "swing_set", "the_mona_lisa", "tiger", "toothbrush", "toothpaste", "tractor", "trombone", "truck", "whale", "windmill", "yoga", "yogabicycle"]
sketch_object_ch = ["鸟","蚂蚁","救护车","天使","闹钟","蚂蚁瑜伽","背包","谷仓","篮子","熊","蜜蜂","蜂花","自行车","书","大脑","桥","推土机","公共汽车","蝴蝶","仙人掌","日历","城堡","猫","猫巴士","猫猪","椅子","沙发","蟹","螃蟹椅","蟹兔脸猪","邮轮","跳板","狗","狗兔子","海豚","鸭","大象","象猪","一切","眼睛","脸","粉丝","消防栓","救火车","火烈鸟","花","花瑜伽","青蛙","青蛙沙发","花园","手","对冲浆果","刺猬","直升机","袋鼠","关键","灯笼","灯塔","狮子","狮子羊","龙虾","地图","美人鱼","莫娜护照","猴子","蚊子","章鱼","猫头鹰","画笔","棕榈树","鹦鹉","护照","豌豆","企鹅","猪","猪羊","菠萝","池","明信片","电源插座","兔子","兔子乌龟","收音机","收音机的脸","雨","犀牛","步枪","过山车","三明治","蝎子","海龟","羊","头骨","蜗牛","雪花","快艇","蜘蛛","松鼠","牛排","火炉","草莓","天鹅","秋千","蒙娜丽莎""老虎","牙刷","牙膏","拖拉机","长号","卡车","鲸","风车","瑜伽","瑜伽自行车"]

STATUS_FIRST_FRAME = 0  # 第一帧的标识
STATUS_CONTINUE_FRAME = 1  # 中间帧标识
STATUS_LAST_FRAME = 2  # 最后一帧的标识

@app.route("/")
def index():
  # return handle_voice2text("./story_voice.mp3")  
  handle_text2voice("小熊听了，眼睛一亮，决定把壳做成一个小球来玩。他找来了树叶和泥巴，开始认真地制作。不久，一个小巧的球做好了，小熊兴奋地把它轻轻一踢，球滚了起来。", './abc.mp3')
  return "hello world"

# 消息收发接口
@app.route("/text2voice", methods=["POST"])
def text2voice():
  text = request.json.get("message", "").lower()
  print(text)
  # voice_path = request.json.get("voice_path", "").lower()
  handle_text2voice(text, './temp.mp3')
  send_file('./temp.mp3', as_attachment=True)
  

@app.route("/voice2text", methods=["POST"])
def voice2text():
  voice_file = request.json.get("message", "").lower()
  return jsonify({'text':handle_voice2text(voice_file)})


@app.route("/next_chapter", methods=["POST"])
def next_chapter():
  story_index = request.json.get("story_index","").lower()
  chapter_index = request.json.get("chapter_index","").lower()
  user_message_type = request.json.get("message_type","").lower()
  need_extract_keyword = request.json.get("extract","").lower()
  
  user_message = ""
  if user_message_type == 'voice':
    user_message = handle_voice2text()
  elif user_message_type == 'text':
    user_message = request.json.get("message_text","").lower()
  else:
    user_message = ""
  
  # 记录用户反馈
  
  prompt_file_path = "./prompt/"+story_index+'/'+chapter_index+".txt"
  prompt_text = read_prompt_file(prompt_file_path)
  
  user_prompt = prompt_text.format(message = user_message)
  
  res_json = send_to_gpt(user_prompt)
  
  # 记录gpt生成
  
  story_voice_path = './'+story_index+'_'+chapter_index+'_story'
  handle_text2voice(res_json["story"], story_voice_path)
  interact_voice_path = './'+story_index+'_'+chapter_index+'_interact'
  handle_text2voice(res_json["interact"], interact_voice_path)
  
  res = {
    'story':res_json["story"],
    'interact':res_json["interact"],
    'story_voice_path':story_voice_path,
    'interact_voice_path':interact_voice_path
  }
  
  if need_extract_keyword is True:
    keyword, object = extract_object(user_message)
    res.update({'keyword':keyword, 'sketch_object':object})
  
  return jsonify(res)
  

# gpt收发接口
def send_to_gpt(user_prompt):
  chat_completion = client.chat.completions.create(
    messages=[
      {
        "role":"user",
        "content":user_prompt,
      }
    ],
    model="gpt-3.5-turbo",
  )
  return json.loads(chat_completion.choices[0].message.content)

# 音频文字转换接口（讯飞）
wsParam = None
text2voice_done = False
voice2text_done = False
feedback_text = ""

class Ws_Param_For_text2voice(object):
    # 初始化
    def __init__(self, APPID, APIKey, APISecret, Text, voice_path):
        self.APPID = APPID
        self.APIKey = APIKey
        self.APISecret = APISecret
        self.Text = Text
        self.voice_path = voice_path
        
        self.CommonArgs = {"app_id": self.APPID}
        self.BusinessArgs = {"aue": "lame", "sfl":1, "auf": "audio/L16;rate=16000", "vcn": "x3_xiaofang", "tte": "utf8"}
        self.Data = {"status": 2, "text": str(base64.b64encode(self.Text.encode('utf-8')), "UTF8")}

    def create_url(self):
        url = 'wss://tts-api.xfyun.cn/v2/tts'
        now = datetime.now()
        date = format_date_time(mktime(now.timetuple()))

        signature_origin = "host: " + "ws-api.xfyun.cn" + "\n"
        signature_origin += "date: " + date + "\n"
        signature_origin += "GET " + "/v2/tts " + "HTTP/1.1"
        signature_sha = hmac.new(self.APISecret.encode('utf-8'), signature_origin.encode('utf-8'),
                                 digestmod=hashlib.sha256).digest()
        signature_sha = base64.b64encode(signature_sha).decode(encoding='utf-8')

        authorization_origin = "api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"" % (
            self.APIKey, "hmac-sha256", "host date request-line", signature_sha)
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')
        v = {
            "authorization": authorization,
            "date": date,
            "host": "ws-api.xfyun.cn"
        }
        url = url + '?' + urlencode(v)
        return url

def on_message_text2voice(ws, message):
    try:
        message =json.loads(message)
        code = message["code"]
        sid = message["sid"]
        audio = message["data"]["audio"]
        audio = base64.b64decode(audio)
        status = message["data"]["status"]
        if status == 2:
            print("ws is closed")
            ws.close()
        if code != 0:
            errMsg = message["message"]
            print("sid:%s call error:%s code is:%s" % (sid, errMsg, code))
        else:
            with open(wsParam.voice_path, 'ab') as f:
                f.write(audio)
            global text2voice_done
            text2voice_done = True
            
    except Exception as e:
        print("receive msg,but parse exception:", e)


# 收到websocket错误的处理
def on_error(ws, error):
    print("### error:", error)


# 收到websocket关闭的处理
def on_close(ws):
    print("### closed ###")


# 收到websocket连接建立的处理
def on_open_text2voice(ws):
    global text2voice_done
    text2voice_done = False
    def run(*args):
      d = {"common": wsParam.CommonArgs,
            "business": wsParam.BusinessArgs,
            "data": wsParam.Data,
            }
      d = json.dumps(d)
      print("------>开始发送文本数据")
      ws.send(d)
      if os.path.exists(wsParam.voice_path):
          os.remove(wsParam.voice_path)

    thread.start_new_thread(run, ()) 
    


def handle_text2voice(text, voice_path):
  global wsParam
  wsParam = Ws_Param_For_text2voice(APPID='1905c43f', APISecret='MzlmOGFkNzkyMGVhZjg1ODAwYTc2YzI0',
                       APIKey='a6573f48d2ea818e898005aa4eccf28d',
                       Text=text, voice_path=voice_path)
  websocket.enableTrace(False)
  wsUrl = wsParam.create_url()
  ws = websocket.WebSocketApp(wsUrl, on_message=on_message_text2voice, on_error=on_error, on_close=on_close)
  ws.on_open = on_open_text2voice
  ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
  global text2voice_done
  while text2voice_done is False:
    pass
  text2voice_done = False


class Ws_Param_For_voice2text(object):
    def __init__(self, APPID, APIKey, APISecret, AudioFile):
        self.APPID = APPID
        self.APIKey = APIKey
        self.APISecret = APISecret
        self.AudioFile = AudioFile

        self.CommonArgs = {"app_id": self.APPID}
        self.BusinessArgs = {"domain": "iat", "language": "zh_cn", "accent": "mandarin", "vinfo":1,"vad_eos":10000}

    def create_url(self):
        url = 'wss://ws-api.xfyun.cn/v2/iat'
        now = datetime.now()
        date = format_date_time(mktime(now.timetuple()))

        signature_origin = "host: " + "ws-api.xfyun.cn" + "\n"
        signature_origin += "date: " + date + "\n"
        signature_origin += "GET " + "/v2/iat " + "HTTP/1.1"
        signature_sha = hmac.new(self.APISecret.encode('utf-8'), signature_origin.encode('utf-8'),
                                 digestmod=hashlib.sha256).digest()
        signature_sha = base64.b64encode(signature_sha).decode(encoding='utf-8')

        authorization_origin = "api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"" % (
            self.APIKey, "hmac-sha256", "host date request-line", signature_sha)
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')
        v = {
            "authorization": authorization,
            "date": date,
            "host": "ws-api.xfyun.cn"
        }
        url = url + '?' + urlencode(v)
        return url


# 收到websocket消息的处理
def on_message_voice2text(ws, message):
    try:
        code = json.loads(message)["code"]
        sid = json.loads(message)["sid"]
        if code != 0:
            errMsg = json.loads(message)["message"]
            print("sid:%s call error:%s code is:%s" % (sid, errMsg, code))

        else:
            data = json.loads(message)["data"]["result"]["ws"]
            # print(json.loads(message))
            result = ""
            for i in data:
                for w in i["cw"]:
                    result += w["w"]
            # print("sid:%s call success!,data is:%s" % (sid, json.dumps(data, ensure_ascii=False)))
            global feedback_text
            feedback_text += result
            global voice2text_done
            voice2text_done = True
    except Exception as e:
        print("receive msg,but parse exception:", e)


# 收到websocket连接建立的处理
def on_open_voice2text(ws):
    global voice2text_done 
    voice2text_done = False
    def run(*args):
        frameSize = 8000  # 每一帧的音频大小
        intervel = 0.04  # 发送音频间隔(单位:s)
        status = STATUS_FIRST_FRAME  # 音频的状态信息，标识音频是第一帧，还是中间帧、最后一帧
        global wsParam

        with open(wsParam.AudioFile, "rb") as fp:
            while True:
                buf = fp.read(frameSize)
                # 文件结束
                if not buf:
                    status = STATUS_LAST_FRAME
                # 第一帧处理
                # 发送第一帧音频，带business 参数
                # appid 必须带上，只需第一帧发送
                if status == STATUS_FIRST_FRAME:

                    d = {"common": wsParam.CommonArgs,
                         "business": wsParam.BusinessArgs,
                         "data": {"status": 0, "format": "audio/L16;rate=16000",
                                  "audio": str(base64.b64encode(buf), 'utf-8'),
                                  "encoding": "lame"}}
                    d = json.dumps(d)
                    ws.send(d)
                    status = STATUS_CONTINUE_FRAME
                # 中间帧处理
                elif status == STATUS_CONTINUE_FRAME:
                    d = {"data": {"status": 1, "format": "audio/L16;rate=16000",
                                  "audio": str(base64.b64encode(buf), 'utf-8'),
                                  "encoding": "lame"}}
                    ws.send(json.dumps(d))
                # 最后一帧处理
                elif status == STATUS_LAST_FRAME:
                    d = {"data": {"status": 2, "format": "audio/L16;rate=16000",
                                  "audio": str(base64.b64encode(buf), 'utf-8'),
                                  "encoding": "lame"}}
                    ws.send(json.dumps(d))
                    time.sleep(1)
                    break
                # 模拟音频采样间隔
                time.sleep(intervel)
        ws.close()

    thread.start_new_thread(run, ())
    
    
def handle_voice2text(voice_file):
  global wsParam
  wsParam = Ws_Param_For_voice2text(APPID='1905c43f', APISecret='MzlmOGFkNzkyMGVhZjg1ODAwYTc2YzI0',
                       APIKey='a6573f48d2ea818e898005aa4eccf28d',
                       AudioFile=voice_file)
  websocket.enableTrace(False)
  wsUrl = wsParam.create_url()
  ws = websocket.WebSocketApp(wsUrl, on_message=on_message_voice2text, on_error=on_error, on_close=on_close)
  ws.on_open = on_open_voice2text
  ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
  global voice2text_done
  while voice2text_done is False:
    pass
  voice2text_done = False
  global feedback_text
  return feedback_text


# 被试关键词提取
def extract_object(user_message):
  extract_text = read_prompt_file("./prompt/extract.txt").format(message=user_message)
  res_json = send_to_gpt(extract_text)
  keyword = res_json["keyword"]
  sketch_object = sketch_object_en[sketch_object_ch.index(res_json["object"])]
  return keyword, sketch_object
  

# 读取文件模板
def read_prompt_file(file_path):
  with open(file_path, 'r') as file:
    content = file.read()
  return content


if __name__ == "__main__":
  app.run(host='0.0.0.0', port=4999, debug=True)


