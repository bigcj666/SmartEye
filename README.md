# SmartEye

AI视觉对话助手 

## Demo视频

通过网盘分享的文件：演示demo.mp4
链接: https://pan.baidu.com/s/1K4hk50iDfjiuNyGGE86bCg?pwd=mjbm 提取码: mjbm

## 功能

- 实时摄像头画面，AI持续感知
- 按住说话语音输入（MIMO ASR 语音识别）
- 文字输入支持
- AI语音回复（浏览器 TTS）
- 基于画面内容智能回答
- 现代化浅色 UI，消息动画、头像、呼吸灯等交互细节

## 技术栈

- 前端：原生 HTML / CSS / JavaScript
- 后端：Python Flask
- 多模态模型：mimo-v2-omni（视觉 + 对话）
- 语音识别：mimo-v2.5-asr（MIMO ASR）
- 语音合成：浏览器原生 SpeechSynthesis API

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API 密钥和接口地址

# 启动
python app.py
```

访问 `http://localhost:5000`

Windows 用户可直接运行 `start.bat`

## 使用

1. 点击「开启摄像头」按钮
2. 按住 🎤 按钮说话，松开后自动识别并发送给 AI
3. 也可以在输入框打字发送

## 项目结构

```
├── app.py              # Flask 后端（对话 + 语音识别接口）
├── requirements.txt    # Python 依赖
├── .env.example        # 环境变量模板
├── .gitignore
├── start.bat           # Windows 启动脚本
├── static/
│   ├── css/style.css   # 样式
│   └── js/main.js      # 前端逻辑
└── templates/
    ├── index.html      # 主页面
    └── test.html       # 摄像头测试页
```

## 成本控制

- 按需截取画面，非常时持续传输
- JPEG 60% 压缩，仅保留最近 6 轮对话
- 语音识别使用 MIMO ASR，通过已有 API 通道，无额外成本
