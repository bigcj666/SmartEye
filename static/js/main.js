class SmartEye {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.chatMessages = document.getElementById('chat-messages');
        this.textInput = document.getElementById('text-input');
        this.btnCamera = document.getElementById('btn-camera');
        this.btnMic = document.getElementById('btn-mic');
        this.btnSend = document.getElementById('btn-send');
        this.statusText = document.getElementById('status-text');
        this.statusDot = document.getElementById('status-dot');
        this.videoPlaceholder = document.getElementById('video-placeholder');
        this.listeningBadge = document.getElementById('listening-badge');
        this.resolutionText = document.getElementById('resolution-text');

        this.stream = null;
        this.isMicOn = false;
        this.recognition = null;
        this.conversationHistory = [];
        this.lastFrame = null;
        this.frameInterval = null;

        this.initSpeechRecognition();
        this.initEventListeners();
    }

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-CN';
        this.recognition.continuous = true;
        this.recognition.interimResults = true;

        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            if (result.isFinal) {
                const transcript = result[0].transcript;
                this.addMessage('user', transcript);
                this.sendToAI(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            if (event.error === 'no-speech' || event.error === 'aborted') {
                if (this.isMicOn) this.restartRecognition();
                return;
            }
            this.stopMic();
        };

        this.recognition.onend = () => {
            if (this.isMicOn) this.restartRecognition();
        };
    }

    restartRecognition() {
        setTimeout(() => {
            if (this.isMicOn && this.recognition) {
                try { this.recognition.start(); } catch (e) {}
            }
        }, 100);
    }

    initEventListeners() {
        this.btnCamera.addEventListener('click', () => this.toggleCamera());
        this.btnMic.addEventListener('click', () => this.toggleMic());
        this.btnSend.addEventListener('click', () => this.sendTextMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendTextMessage();
        });
    }

    async toggleCamera() {
        if (this.stream) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
    }

    async startCamera() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false
            });
            
            this.video.srcObject = this.stream;
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => this.video.play().then(resolve).catch(reject);
                this.video.onerror = reject;
            });

            this.videoPlaceholder.style.display = 'none';
            this.btnCamera.innerHTML = '<span>⏹</span><span>关闭摄像头</span>';
            this.btnCamera.classList.add('active');
            this.btnMic.disabled = false;
            this.statusDot.classList.add('active');
            this.statusText.textContent = '已连接';
            
            const settings = this.stream.getVideoTracks()[0].getSettings();
            if (settings.width && settings.height) {
                this.resolutionText.textContent = `${settings.width}×${settings.height}`;
            }

            this.captureFrame();
            this.frameInterval = setInterval(() => this.captureFrame(), 3000);
        } catch (err) {
            this.statusText.textContent = '摄像头访问失败';
        }
    }

    stopCamera() {
        if (!this.stream) return;
        
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        this.video.srcObject = null;
        this.videoPlaceholder.style.display = 'flex';
        this.btnCamera.innerHTML = '<span>📷</span><span>开启摄像头</span>';
        this.btnCamera.classList.remove('active');
        this.btnMic.disabled = true;
        this.stopMic();
        this.statusText.textContent = '未连接';
        this.statusDot.classList.remove('active');
        this.resolutionText.textContent = '';
        this.lastFrame = null;
        
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
    }

    toggleMic() {
        this.isMicOn ? this.stopMic() : this.startMic();
    }

    startMic() {
        if (!this.recognition || this.isMicOn) return;
        
        try {
            this.captureFrame();
            this.recognition.start();
            this.isMicOn = true;
            this.btnMic.classList.add('active');
            this.btnMic.title = '关闭麦克风';
            this.listeningBadge.classList.add('active');
            this.textInput.placeholder = '麦克风已开启，直接说话或输入消息...';
        } catch (e) {}
    }

    stopMic() {
        if (!this.recognition || !this.isMicOn) return;
        
        try { this.recognition.stop(); } catch (e) {}
        this.isMicOn = false;
        this.btnMic.classList.remove('active');
        this.btnMic.title = '开启麦克风';
        this.listeningBadge.classList.remove('active');
        this.textInput.placeholder = '输入消息或开启麦克风语音对话...';
    }

    captureFrame() {
        if (!this.stream) return null;
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.canvas.getContext('2d').drawImage(this.video, 0, 0);
        this.lastFrame = this.canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        return this.lastFrame;
    }

    async sendToAI(text) {
        const imageData = this.lastFrame || this.captureFrame();
        this.statusText.textContent = '思考中...';

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: imageData,
                    text: text,
                    history: this.conversationHistory.slice(-6)
                })
            });

            const data = await response.json();
            if (data.error) {
                this.addMessage('system', '错误: ' + data.error);
            } else {
                this.addMessage('assistant', data.reply);
                this.conversationHistory.push(
                    { role: 'user', content: text },
                    { role: 'assistant', content: data.reply }
                );
                this.speakText(data.reply);
            }
        } catch (err) {
            this.addMessage('system', '请求失败: ' + err.message);
        }

        this.statusText.textContent = this.stream ? '已连接' : '未连接';
    }

    async sendTextMessage() {
        const text = this.textInput.value.trim();
        if (!text) return;
        
        this.textInput.value = '';
        this.addMessage('user', text);
        await this.sendToAI(text);
    }

    addMessage(role, content) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        
        const sender = role === 'user' ? '<div class="message-sender">你</div>' 
                      : role === 'assistant' ? '<div class="message-sender">AI</div>' 
                      : '';
        
        div.innerHTML = `${sender}<p>${this.escapeHtml(content)}</p>`;
        this.chatMessages.appendChild(div);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    speakText(text) {
        if (!('speechSynthesis' in window)) return;
        
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        window.speechSynthesis.speak(utterance);
    }
}

document.addEventListener('DOMContentLoaded', () => new SmartEye());
