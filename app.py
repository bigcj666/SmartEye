import os
import base64
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(
    api_key=os.getenv("MIMO_API_KEY"),
    base_url=os.getenv("MIMO_BASE_URL")
)

SYSTEM_PROMPT = """你是SmartEye，一个AI视觉对话助手。你能通过摄像头实时看到用户周围的环境。

规则：
- 当用户向你提问或寻求帮助时，基于画面内容回答
- 如果用户只是自言自语、感叹、或不是在跟你说话，简单回应或不回应
- 直接回答关于画面的问题，不要说"我看到一张照片"
- 回答简洁自然，像朋友聊天
- 用中文回答"""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    image_data = data.get("image")
    user_text = data.get("text", "")
    history = data.get("history", [])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for msg in history[-6:]:
        messages.append(msg)

    user_content = []
    if image_data:
        user_content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
        })

    if user_text:
        user_content.append({"type": "text", "text": user_text})
    else:
        user_content.append({"type": "text", "text": "请描述你看到的画面。"})

    messages.append({"role": "user", "content": user_content})

    try:
        response = client.chat.completions.create(
            model="mimo-v2-omni",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        reply = response.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
