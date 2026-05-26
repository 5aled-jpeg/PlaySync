const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

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

ipcMain.handle('set-autostart', (event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath('exe')
  });
});

ipcMain.handle('get-autostart', () => {
  return app.getLoginItemSettings().openAtLogin;
});

function createWindow() {
  // Start Express API server process
  // Run directly in the main process to natively support ASAR packaging without fork issues
  process.env.USER_DATA_PATH = app.getPath('userData');
  process.env.PORT = "3000";

  import('./server.js').then(() => {
    console.log('Server started in main process.');
  }).catch(err => {
    dialog.showErrorBox('Server Error', `Could not start backend server: ${err.message}`);
  });

  // Wait for Express server to actually be ready before opening the window
  const waitForServer = (retries = 30) => {
    const http = require('http');
    const check = (attemptsLeft) => {
      if (attemptsLeft <= 0) {
        console.error('Server failed to start after 15 seconds. Opening window anyway.');
        openMainWindow();
        return;
      }
      const req = http.get('http://localhost:3000', (res) => {
        // Server is up!
        openMainWindow();
      });
      req.on('error', () => {
        // Not ready yet, retry in 500ms
        setTimeout(() => check(attemptsLeft - 1), 500);
      });
      req.setTimeout(1000, () => { req.destroy(); });
    };
    check(retries);
  };

  const openMainWindow = () => {
    if (mainWindow) return; // Prevent double-open
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
  };

  waitForServer();

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
