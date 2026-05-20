const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let serverProcess;

// Handle window controls from the custom title bar
ipcMain.on('window-control', (event, command) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (command === 'close') win.close();
  else if (command === 'minimize') win.minimize();
  else if (command === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

function createWindow() {
  // Start Express API server process
  serverProcess = fork(path.join(__dirname, 'server.js'), [], {
    env: { ...process.env, PORT: 3000 }
  });

  // Wait for Express server to start, then load native window
  setTimeout(() => {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      title: "Game Room Management Dashboard",
      frame: false, // Hides native Windows title bar
      transparent: true, // Enables transparency for custom rounded corners
      backgroundColor: '#00000000',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs')
      }
    });

    mainWindow.loadURL('http://localhost:3000');

    let isForceClosing = false;

    // Intercept native "X" button
    mainWindow.on('close', (e) => {
      if (!isForceClosing) {
        e.preventDefault();
        // Dispatch a custom event to the frontend to trigger the React modal
        mainWindow.webContents.executeJavaScript(`
          window.dispatchEvent(new Event('electron-close-request'));
        `).catch(() => {
          isForceClosing = true;
          app.quit();
        });
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }, 2000);

  // When the server shuts down (from our /api/system/shutdown endpoint), force close the Electron app
  serverProcess.on('exit', () => {
    app.exit(0);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
