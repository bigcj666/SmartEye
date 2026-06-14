@echo off
echo ========================================
echo   AI 视觉对话助手 - 启动脚本
echo ========================================
echo.

echo [1/3] 检查Python环境...
python --version
if errorlevel 1 (
    echo 错误: 未找到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

echo.
echo [2/3] 安装依赖...
pip install -r requirements.txt
if errorlevel 1 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [3/3] 启动服务...
echo.
echo 服务启动后，请在浏览器中访问: http://localhost:5000
echo 按 Ctrl+C 停止服务
echo.
python app.py
