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
        this.videoContainer = document.getElementById('video-container');
        this.listeningBadge = document.getElementById('listening-badge');
        this.resolutionText = document.getElementById('resolution-text');

        this.stream = null;
        this.isRecording = false;
        this.conversationHistory = [];
        this.lastFrame = null;
        this.frameInterval = null;

        this.audioContext = null;
        this.audioStream = null;
        this.scriptNode = null;
        this.audioChunks = [];

        this.initEventListeners();
    }

    initEventListeners() {
        this.btnCamera.addEventListener('click', () => this.toggleCamera());
        this.btnSend.addEventListener('click', () => this.sendTextMessage());
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendTextMessage();
        });

        this.btnMic.addEventListener('mousedown', (e) => { e.preventDefault(); this.startRecording(); });
        this.btnMic.addEventListener('mouseup', (e) => { e.preventDefault(); this.stopRecording(); });
        this.btnMic.addEventListener('mouseleave', () => { if (this.isRecording) this.stopRecording(); });
        this.btnMic.addEventListener('touchstart', (e) => { e.preventDefault(); this.startRecording(); });
        this.btnMic.addEventListener('touchend', (e) => { e.preventDefault(); this.stopRecording(); });
        this.btnMic.addEventListener('touchcancel', () => { if (this.isRecording) this.cancelRecording(); });
    }

    async startRecording() {
        if (this.isRecording) return;

        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            this.scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);

            this.audioChunks = [];
            this.scriptNode.onaudioprocess = (e) => {
                const channelData = e.inputBuffer.getChannelData(0);
                this.audioChunks.push(new Float32Array(channelData));
            };

            source.connect(this.scriptNode);
            this.scriptNode.connect(this.audioContext.destination);

            this.isRecording = true;
            this.captureFrame();
            this.btnMic.classList.add('active');
            this.listeningBadge.classList.add('active');
            this.textInput.placeholder = '正在聆听...松开发送';
        } catch (e) {
            console.error('启动录音失败:', e);
            this.addMessage('system', '麦克风访问失败: ' + e.message);
        }
    }

    stopRecording() {
        if (!this.isRecording) return;
        this.isRecording = false;

        this.btnMic.classList.remove('active');
        this.listeningBadge.classList.remove('active');
        this.textInput.placeholder = '输入消息或按住麦克风说话...';

        if (this.scriptNode) {
            this.scriptNode.disconnect();
            this.scriptNode = null;
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(t => t.stop());
            this.audioStream = null;
        }

        const chunks = this.audioChunks;
        this.audioChunks = [];

        if (chunks.length === 0) return;

        const wavBase64 = this.encodeWAV(chunks, this.audioContext.sampleRate);
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.transcribeAndSend(wavBase64);
    }

    cancelRecording() {
        this.isRecording = false;
        this.btnMic.classList.remove('active');
        this.listeningBadge.classList.remove('active');
        this.textInput.placeholder = '输入消息或按住麦克风说话...';
        if (this.scriptNode) { this.scriptNode.disconnect(); this.scriptNode = null; }
        if (this.audioStream) { this.audioStream.getTracks().forEach(t => t.stop()); this.audioStream = null; }
        if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
        this.audioChunks = [];
    }

    encodeWAV(channels, sampleRate) {
        let totalLength = 0;
        for (const chunk of channels) totalLength += chunk.length;

        const buffer = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of channels) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }

        const numSamples = buffer.length;
        const bytesPerSample = 2;
        const blockAlign = bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = numSamples * bytesPerSample;
        const headerSize = 44;
        const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(arrayBuffer);

        const writeString = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bytesPerSample * 8, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        let pos = 44;
        for (let i = 0; i < numSamples; i++) {
            let s = Math.max(-1, Math.min(1, buffer[i]));
            view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            pos += 2;
        }

        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    async transcribeAndSend(wavBase64) {
        this.statusText.textContent = '识别中...';
        try {
            const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: wavBase64 })
            });
            const data = await res.json();
            if (data.error) {
                this.addMessage('system', '语音识别失败: ' + data.error);
            } else if (data.text && data.text.trim()) {
                this.addMessage('user', data.text.trim());
                this.sendToAI(data.text.trim());
            }
        } catch (err) {
            this.addMessage('system', '语音请求失败: ' + err.message);
        }
        this.statusText.textContent = this.stream ? '已连接' : '未连接';
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
            if (err.name === 'NotAllowedError') {
                this.statusText.textContent = '请允许摄像头权限';
            } else if (err.name === 'NotFoundError') {
                this.statusText.textContent = '未检测到摄像头';
            } else if (err.name === 'NotReadableError') {
                this.statusText.textContent = '摄像头被占用';
            } else {
                this.statusText.textContent = '错误: ' + err.message;
            }
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
        if (this.isRecording) this.cancelRecording();
        this.statusText.textContent = '未连接';
        this.statusDot.classList.remove('active');
        this.resolutionText.textContent = '';
        this.lastFrame = null;
        
        if (this.frameInterval) {
            clearInterval(this.frameInterval);
            this.frameInterval = null;
        }
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
        this.chatMessages.classList.add('thinking');

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

        this.chatMessages.classList.remove('thinking');
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
        const row = document.createElement('div');
        
        if (role === 'system') {
            row.className = 'message system';
            row.innerHTML = `<p>${this.escapeHtml(content)}</p>`;
        } else {
            row.className = `message-row ${role}`;
            const avatarLabel = role === 'user' ? '我' : '🤖';
            const avatarHtml = `<div class="avatar ${role}">${avatarLabel}</div>`;
            row.innerHTML = `${avatarHtml}<div class="message ${role}"><p>${this.escapeHtml(content)}</p></div>`;
        }

        this.chatMessages.appendChild(row);
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
