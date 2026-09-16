@echo off
chcp 65001 > nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Criando ambiente virtual pela primeira vez...
    python -m venv .venv
    if errorlevel 1 goto sem_python
)

if not exist ".venv\instalado.ok" (
    echo Instalando dependencias ^(so na primeira vez, precisa de internet^)...
    ".venv\Scripts\python.exe" -m pip install --upgrade pip
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 goto erro_instalacao
    echo ok > ".venv\instalado.ok"
)

start "" cmd /c "timeout /t 3 > nul & start http://127.0.0.1:5000"
".venv\Scripts\python.exe" run.py
pause
exit /b 0

:sem_python
echo.
echo Nao foi possivel criar o ambiente. Verifique se o Python esta instalado
echo e se a opcao "Add python.exe to PATH" foi marcada na instalacao.
pause
exit /b 1

:erro_instalacao
echo.
echo Falha ao instalar as dependencias. Verifique a conexao com a internet
echo ^(ou o proxy do hospital^) e execute este arquivo novamente.
pause
exit /b 1
