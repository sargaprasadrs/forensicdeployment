const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { spawn, execSync } = require('child_process');
const os = require('os');
const fs = require('fs');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    title: "Forensic Sketch System",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, 'build/index.html')}`
  );

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => (mainWindow = null));
}

function startBackend() {
  const serverPath = path.join(__dirname, 'server/main.py');
  const venvPath = path.join(__dirname, 'venv');
  const requirementsPath = path.join(__dirname, 'requirements.txt');
  const pythonExec = os.platform() === 'win32'
    ? path.join(venvPath, 'Scripts', 'python.exe')
    : path.join(venvPath, 'bin', 'python');

  console.log('🚀 Checking environment...');

  if (!fs.existsSync(venvPath)) {
     console.log('📦 Virtual environment missing. Starting automated setup...');
     try {
       // Note: This assumes the user has python installed in PATH. 
       // For a perfect installer, we'd bundle a portable python, but that's complex.
       execSync('python -m venv venv', { cwd: __dirname });
       console.log('✅ Venv created. Installing dependencies...');
       const pipExec = os.platform() === 'win32' 
         ? path.join(venvPath, 'Scripts', 'pip.exe') 
         : path.join(venvPath, 'bin', 'pip');
       execSync(`"${pipExec}" install -r "${requirementsPath}"`, { cwd: __dirname });
       console.log('✅ Dependencies installed.');
     } catch (err) {
       console.error('❌ Setup failed:', err);
       return;
     }
  }

  console.log('🚀 Starting Backend...');
  backendProcess = spawn(pythonExec, [serverPath], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  backendProcess.on('error', (err) => {
    console.error('❌ Failed to start backend:', err);
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (backendProcess) {
    console.log('🔪 Terminating backend process...');
    if (os.platform() === 'win32') {
        execSync(`taskkill /F /T /PID ${backendProcess.pid}`);
    } else {
        backendProcess.kill();
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});