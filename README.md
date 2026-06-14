# SmartEye

AI视觉对话助手 - 七牛云AI程序设计比赛

## 功能

- 实时摄像头画面，AI持续感知
- 语音输入，按住说话即可对话
- 文字输入支持
- AI语音回复
- 基于画面内容回答问题

## 技术栈

- 前端：原生HTML/CSS/JS
- 后端：Python Flask
- 模型：mimo-v2-omni（多模态）
- 语音：Web Speech API（浏览器原生）

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入API密钥

# 启动
python app.py
```

访问 `http://localhost:5000`

Windows用户可直接运行 `start.bat`

## 使用

1. 点击"开启摄像头"
2. 点击🎤开启麦克风
3. 说话或打字与AI对话

## 项目结构

```
├── app.py              # Flask后端
├── requirements.txt    # Python依赖
├── .env.example        # 环境变量模板
├── start.bat           # Windows启动脚本
├── static/
│   ├── css/style.css
│   ├── js/main.js
│   └── favicon.svg
└── templates/
    └── index.html
```

## 成本控制

- 按需截取画面，非常时持续传输
- JPEG 60%压缩
- 仅保留最近6轮对话
- 语音识别/合成使用浏览器API，零成本
