const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const AdmZip = require('adm-zip');


try {
  require('@electron/remote/main').initialize();
} catch (e) {
  console.error('Failed to initialize remote module:', e);
}


const store = new Store({
  defaults: {
    gamePath: '',
    modsDirectory: path.join(app.getPath('userData'), 'mods'),
    autoUpdate: true,
    launchOnStartup: false,
    minimizeToTray: true,
    theme: 'default'
  }
});


function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  
  try {
    require('@electron/remote/main').enable(mainWindow.webContents);
  } catch (e) {
    console.error('Failed to enable remote module for window:', e);
  }

  mainWindow.loadFile('index.html');

  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}


app.whenReady().then(() => {
  createWindow();

  
  const modsDir = store.get('modsDirectory');
  if (modsDir && !fs.existsSync(modsDir)) {
    try {
      fs.mkdirSync(modsDir, { recursive: true });
      console.log('Created mods directory:', modsDir);
    } catch (error) {
      console.error('Failed to create mods directory:', error);
    }
  }

  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  
  updateAutoLaunch();
});


app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});


ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.handle('update-settings', (event, settings) => {
  
  Object.keys(settings).forEach(key => {
    store.set(key, settings[key]);
  });
ipcMain.handle('openExternal', (event, url) => {
  shell.openExternal(url);
});
  
  if (settings.hasOwnProperty('launchOnStartup')) {
    updateAutoLaunch();
  }

  return store.store;
});

ipcMain.handle('get-installed-mods', async () => {
  const modsDir = store.get('modsDirectory');
  
  if (!modsDir || !fs.existsSync(modsDir)) {
    return [];
  }
  
  try {
    
    const modFolders = fs.readdirSync(modsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    
    const mods = [];
    for (const folder of modFolders) {
      const modPath = path.join(modsDir, folder);
      const modInfoPath = path.join(modPath, 'mod.json');
      
      if (fs.existsSync(modInfoPath)) {
        try {
          const modInfo = JSON.parse(fs.readFileSync(modInfoPath, 'utf8'));
          mods.push({
            id: folder,
            name: modInfo.name || folder,
            version: modInfo.version || '1.0.0',
            author: modInfo.author || 'Unknown',
            description: modInfo.description || '',
            enabled: true 
          });
        } catch (error) {
          console.error(`Failed to parse mod.json for ${folder}:`, error);
        }
      } else {
        
        mods.push({
          id: folder,
          name: folder,
          version: '1.0.0',
          author: 'Unknown',
          description: 'No description available',
          enabled: true
        });
      }
    }
    
    return mods;
  } catch (error) {
    console.error('Failed to get installed mods:', error);
    throw error;
  }
});

ipcMain.handle('toggle-mod', async (event, modId, enabled) => {
  
  console.log(`Toggle mod ${modId} to ${enabled ? 'enabled' : 'disabled'}`);
  return { success: true };
});


ipcMain.handle('download-mod', async (event, { url, modId, modName }) => {
  try {
    console.log(`Starting download for mod ${modName} from ${url}`);
    
    
    const timestamp = Date.now();
    const tempFile = path.join(app.getPath('temp'), `mod-${modId}-${timestamp}.zip`);
    
    
    const fileStream = fs.createWriteStream(tempFile);
    
    
    const request = require('electron').net.request({
      method: 'GET',
      url: url
    });
    
    
    let receivedBytes = 0;
    let totalBytes = 0;
    
    
    request.on('response', (response) => {
      console.log(`Response status code: ${response.statusCode}`);
      
      if (response.statusCode !== 200) {
        fileStream.end();
        fs.unlinkSync(tempFile);
        event.sender.send('download-progress', {
          modId,
          progress: 0,
          error: `Server returned status code ${response.statusCode}`
        });
        return;
      }
      
      
      const contentLength = response.headers['content-length'];
      if (contentLength) {
        totalBytes = parseInt(contentLength[0], 10);
        console.log(`Total download size: ${totalBytes} bytes`);
      }
      
      
      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        fileStream.write(chunk);
        
        
        const progress = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : -1;
        
        
        event.sender.send('download-progress', {
          modId,
          progress,
          receivedBytes,
          totalBytes
        });
      });
      
      
      response.on('end', async () => {
        console.log(`Download completed: ${receivedBytes} bytes received`);
        fileStream.end();
        
        try {
          
          let slug;
          try {
            
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            
            
            if (url.includes('/storage/mods/files/')) {
              
              
              const filename = pathParts[pathParts.length - 1];
              
              const slugMatch = filename.match(/^([a-z0-9-]+)-\d+\.\d+\.\d+\.zip$/);
              if (slugMatch) {
                slug = slugMatch[1];
              } else {
                
                slug = `mod-${modId}`;
              }
            } else if (pathParts.includes('mods') && pathParts.length > pathParts.indexOf('mods') + 1) {
              
              const modIndex = pathParts.indexOf('mods');
              if (modIndex >= 0 && modIndex < pathParts.length - 1) {
                slug = pathParts[modIndex + 1];
              }
            }
          } catch (error) {
            console.warn('Failed to extract slug from URL:', error);
          }
          
          
          if (!slug) {
            slug = modName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          }
          
          console.log(`Using slug "${slug}" for mod directory`);
          
          
          const modsDir = store.get('modsDirectory');
          const modDir = path.join(modsDir, slug);
          if (!fs.existsSync(modDir)) {
            fs.mkdirSync(modDir, { recursive: true });
          }
          
          
          await extractZip(tempFile, { dir: modDir });
          
          
          fs.unlinkSync(tempFile);
          
          
          return { success: true };
        } catch (error) {
          console.error('Error processing downloaded mod:', error);
          return { success: false, error: error.message };
        }
      });
    });
    
    
    request.on('error', (error) => {
      console.error('Download request error:', error);
      fileStream.end();
      
      
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
      
      
      event.sender.send('download-progress', {
        modId,
        progress: 0,
        error: error.message
      });
      
      return { success: false, error: error.message };
    });
    
    
    request.end();
    
    
    return { success: true, message: 'Download started' };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: error.message };
  }
});


async function extractZip(zipFile, options) {
  try {
    const zip = new AdmZip(zipFile);
    zip.extractAllTo(options.dir, true);
    console.log(`Extracted zip file to ${options.dir}`);
  } catch (error) {
    console.error('Failed to extract zip file:', error);
    throw error;
  }
}


function updateAutoLaunch() {
  const AutoLaunch = require('auto-launch');
  const autoLauncher = new AutoLaunch({
    name: 'InZoi Mod Loader',
    path: app.getPath('exe')
  });
  
  const launchOnStartup = store.get('launchOnStartup');
  
  if (launchOnStartup) {
    autoLauncher.enable().catch(err => {
      console.error('Failed to enable auto-launch:', err);
    });
  } else {
    autoLauncher.disable().catch(err => {
      console.error('Failed to disable auto-launch:', err);
    });
  }
}
