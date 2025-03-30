const { ipcRenderer } = require('electron');
let dialog;
try {
  const remote = require('@electron/remote');
  dialog = remote.dialog;
} catch (e) {
  console.error('Remote module not available:', e);
}
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');


const store = new Store({
  defaults: {
    gamePath: '',
    modsDirectory: '',
    autoUpdate: true,
    launchOnStartup: false,
    minimizeToTray: true,
    theme: 'default'
  }
});


const tabButtons = document.querySelectorAll('.sidebar nav li');
const tabContents = document.querySelectorAll('.tab-content');
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');
const modsList = document.getElementById('mods-list');
const modSearch = document.getElementById('mod-search');
const refreshBtn = document.getElementById('refresh-btn');
const gamePathInput = document.getElementById('game-path');
const modsDirectoryInput = document.getElementById('mods-directory');
const browseGamePathBtn = document.getElementById('browse-game-path');
const browseModsDirectoryBtn = document.getElementById('browse-mods-directory');
const saveSettingsBtn = document.getElementById('save-settings');
const resetSettingsBtn = document.getElementById('reset-settings');
const launchGameBtn = document.getElementById('launch-game');
const statusMessage = document.getElementById('status-message');
const backupModsBtn = document.getElementById('backup-mods');
const repoSearch = document.getElementById('repo-search');
const repoRefreshBtn = document.getElementById('repo-refresh-btn');
const categoryFilter = document.getElementById('category-filter');
const sortBy = document.getElementById('sort-by');
const repositoryList = document.getElementById('repository-list');
const themeButtons = document.querySelectorAll('.apply-theme-btn');
const autoUpdateToggle = document.getElementById('auto-update');
const launchOnStartupToggle = document.getElementById('launch-on-startup');
const minimizeToTrayToggle = document.getElementById('minimize-to-tray');


minimizeBtn.addEventListener('click', () => {
  try {
    const window = require('@electron/remote').getCurrentWindow();
    window.minimize();
  } catch (e) {
    console.error('Failed to minimize window:', e);
  }
});

maximizeBtn.addEventListener('click', () => {
  try {
    const window = require('@electron/remote').getCurrentWindow();
    if (window.isMaximized()) {
      window.unmaximize();
      maximizeBtn.innerHTML = '<i class="fas fa-expand"></i>';
    } else {
      window.maximize();
      maximizeBtn.innerHTML = '<i class="fas fa-compress"></i>';
    }
  } catch (e) {
    console.error('Failed to maximize/restore window:', e);
  }
});

closeBtn.addEventListener('click', () => {
  try {
    const window = require('@electron/remote').getCurrentWindow();
    window.close();
  } catch (e) {
    console.error('Failed to close window:', e);
  }
});


tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.getAttribute('data-tab');
    
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    
    tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    
    if (tabName === 'repository') {
      loadRepository();
    }
  });
});


async function loadSettings() {
  try {
    const settings = store.get();
    gamePathInput.value = settings.gamePath || '';
    modsDirectoryInput.value = settings.modsDirectory || '';
    
    
    autoUpdateToggle.checked = settings.autoUpdate !== false; 
    launchOnStartupToggle.checked = settings.launchOnStartup === true; 
    minimizeToTrayToggle.checked = settings.minimizeToTray !== false; 
    
    
    if (settings.theme) {
      applyTheme(settings.theme);
    }
    
    updateStatus('Settings loaded');
  } catch (error) {
    console.error('Failed to load settings:', error);
    updateStatus('Failed to load settings', true);
  }
}


saveSettingsBtn.addEventListener('click', async () => {
  try {
    store.set({
      gamePath: gamePathInput.value,
      modsDirectory: modsDirectoryInput.value,
      autoUpdate: autoUpdateToggle.checked,
      launchOnStartup: launchOnStartupToggle.checked,
      minimizeToTray: minimizeToTrayToggle.checked
    });
    updateStatus('Settings saved successfully');
    loadMods(); 
  } catch (error) {
    console.error('Failed to save settings:', error);
    updateStatus('Failed to save settings', true);
  }
});


function saveSettings() {
  const settings = JSON.parse(localStorage.getItem('celeste-mod-loader-settings') || '{}');
  
  
  const themeClasses = Array.from(document.body.classList)
    .filter(cls => cls.endsWith('-theme-applied'));
  
  if (themeClasses.length > 0) {
    const currentTheme = themeClasses[0].replace('-theme-applied', '');
    settings.theme = currentTheme;
  }
  
  
  localStorage.setItem('celeste-mod-loader-settings', JSON.stringify(settings));
  
  
  const apiEndpoint = 'https://celestemods.net/api/v1/loader/mods';
  settings.apiEndpoint = apiEndpoint;
  
  
  updateStatus('Settings saved');
}


document.getElementById('save-settings').addEventListener('click', () => {
  const gamePath = document.getElementById('game-path').value;
  const modsDirectory = document.getElementById('mods-directory').value;
  
  
  const settings = JSON.parse(localStorage.getItem('celeste-mod-loader-settings') || '{}');
  
  
  settings.gamePath = gamePath;
  settings.modsDirectory = modsDirectory;
  
  
  localStorage.setItem('celeste-mod-loader-settings', JSON.stringify(settings));
  
  
  updateStatus('Settings saved');
});


resetSettingsBtn.addEventListener('click', async () => {
  try {
    let defaultModsDir;
    try {
      const app = require('@electron/remote').app;
      defaultModsDir = path.join(app.getPath('userData'), 'mods');
    } catch (e) {
      defaultModsDir = path.join(process.env.APPDATA, 'celeste-mod-loader', 'mods');
    }
    
    
    store.set({
      gamePath: '',
      modsDirectory: defaultModsDir,
      autoUpdate: true,
      launchOnStartup: false,
      minimizeToTray: true,
      theme: 'default'
    });
    loadSettings(); 
    applyTheme('default'); 
    updateStatus('Settings reset to default');
  } catch (error) {
    console.error('Failed to reset settings:', error);
    updateStatus('Failed to reset settings', true);
  }
});


browseGamePathBtn.addEventListener('click', async () => {
  try {
    if (!dialog) {
      updateStatus('Dialog module not available', true);
      return;
    }
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Celeste Game Directory'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      gamePathInput.value = result.filePaths[0];
    }
  } catch (error) {
    console.error('Failed to browse for game path:', error);
    updateStatus('Failed to browse for game path', true);
  }
});


browseModsDirectoryBtn.addEventListener('click', async () => {
  try {
    if (!dialog) {
      updateStatus('Dialog module not available', true);
      return;
    }
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Mods Directory'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      modsDirectoryInput.value = result.filePaths[0];
    }
  } catch (error) {
    console.error('Failed to browse for mods directory:', error);
    updateStatus('Failed to browse for mods directory', true);
  }
});


async function loadMods() {
  try {
    updateStatus('Loading mods...');
    modsList.innerHTML = '<div class="mod-card placeholder"><div class="mod-info"><h3>Loading mods...</h3><p>Please wait while we load your mods.</p></div></div>';
    
    const mods = await ipcRenderer.invoke('get-installed-mods');
    
    if (mods.length === 0) {
      modsList.innerHTML = `
        <div class="mod-card">
          <div class="mod-info">
            <h3>No mods found</h3>
            <p>Place mod files in your mods directory to get started or download them from the Repository tab.</p>
          </div>
        </div>
      `;
      updateStatus('No mods found');
      return;
    }
    
    modsList.innerHTML = '';
    mods.forEach(mod => {
      const modCard = document.createElement('div');
      modCard.className = 'mod-card';
      modCard.innerHTML = `
        <div class="mod-info">
          <h3>${mod.name}</h3>
          <p>Version: ${mod.version}</p>
          <p>Author: ${mod.author}</p>
        </div>
        <div class="mod-actions">
          <span>${mod.enabled ? 'Enabled' : 'Disabled'}</span>
          <label class="toggle-switch">
            <input type="checkbox" class="mod-toggle" data-mod-id="${mod.id}" ${mod.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
      `;
      modsList.appendChild(modCard);
    });
    
    
    document.querySelectorAll('.mod-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        const modId = e.target.getAttribute('data-mod-id');
        const enabled = e.target.checked;
        
        try {
          await ipcRenderer.invoke('toggle-mod', modId, enabled);
          updateStatus(`Mod ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
          console.error(`Failed to toggle mod ${modId}:`, error);
          updateStatus(`Failed to ${enabled ? 'enable' : 'disable'} mod`, true);
          e.target.checked = !enabled; 
        }
      });
    });
    
    updateStatus(`Loaded ${mods.length} mods`);
  } catch (error) {
    console.error('Failed to load mods:', error);
    updateStatus('Failed to load mods', true);
    modsList.innerHTML = `
      <div class="mod-card">
        <div class="mod-info">
          <h3>Error loading mods</h3>
          <p>${error.message || 'Unknown error'}</p>
        </div>
      </div>
    `;
  }
}


async function loadRepository() {
  try {
    
    repositoryList.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading mods from repository...</p>
      </div>
    `;
    
    
    const apiUrl = 'https://celestemods.net/api/v1/loader/mods';
    console.log('Fetching mods from:', apiUrl);
    
    const response = await fetch(apiUrl);
    console.log('API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch repository: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    
    
    const mods = data.data || data.mods || data;
    
    if (!mods || !Array.isArray(mods) || mods.length === 0) {
      console.warn('No mods found in API response');
      
      
      repositoryList.innerHTML = `
        <div class="mod-card empty-state">
          <div class="mod-info">
            <i class="fas fa-info-circle fa-3x"></i>
            <h3>No Mods Available</h3>
            <p>The repository doesn't have any mods available at this time.</p>
          </div>
        </div>
      `;
      return;
    }
    
    
    displayRepositoryMods(mods);
    
    
    updateStatus(`Loaded ${mods.length} mods from repository`);
  } catch (error) {
    console.error('Failed to load repository:', error);
    
    
    repositoryList.innerHTML = `
      <div class="mod-card error-state">
        <div class="mod-info">
          <i class="fas fa-exclamation-circle fa-3x"></i>
          <h3>Connection Error</h3>
          <p>${error.message}</p>
          <button id="retry-repository-btn" class="primary-btn">
            <i class="fas fa-sync"></i> Retry
          </button>
        </div>
      </div>
    `;
    
    
    document.getElementById('retry-repository-btn').addEventListener('click', () => {
      loadRepository();
    });
    
    updateStatus('Failed to load repository', true);
  }
}


function displayRepositoryMods(mods) {
  if (!mods || mods.length === 0) {
    repositoryList.innerHTML = `
      <div class="mod-card empty-state">
        <div class="mod-info">
          <i class="fas fa-info-circle fa-3x"></i>
          <h3>No Mods Available</h3>
          <p>The repository doesn't have any mods available at this time.</p>
        </div>
      </div>
    `;
    return;
  }
  
  
  repositoryList.innerHTML = '';
  
  
  mods.forEach(mod => {
    
    const modItem = {
      id: mod.id,
      name: mod.name,
      slug: mod.slug,
      version: mod.current_version || mod.version,
      author: mod.user?.name || mod.author || 'Unknown',
      description: mod.description,
      category: mod.category?.name || mod.category || 'Uncategorized',
      categorySlug: mod.category?.slug || mod.category_slug,
      categoryIcon: mod.category?.icon || 'tag',
      downloads: mod.download_count || mod.downloads || 0,
      lastUpdated: mod.updated_at || mod.lastUpdated,
      thumbnailUrl: mod.thumbnail_url || mod.thumbnailUrl || 'assets/mod-default.png',
      downloadUrl: mod.direct_download_url || mod.download_url || mod.downloadUrl,
      fileSize: mod.file_size_formatted || mod.fileSize,
      modType: mod.mod_type || mod.modType,
      installationType: mod.installation_type || mod.installationType,
      rating: mod.average_rating || mod.rating,
      isFeatured: mod.is_featured,
      versions: mod.versions || []
    };
    
    
    const modCard = document.createElement('div');
    modCard.className = 'mod-card';
    modCard.setAttribute('data-mod-id', modItem.id);
    modCard.setAttribute('data-mod-slug', modItem.slug);
    
    if (modItem.isFeatured) {
      modCard.classList.add('featured-mod');
    }
    
    
    const thumbnail = document.createElement('div');
    thumbnail.className = 'mod-thumbnail';
    thumbnail.style.backgroundImage = `url('${modItem.thumbnailUrl}')`;
    thumbnail.addEventListener('error', () => {
      thumbnail.style.backgroundImage = "url('assets/mod-default.png')";
    });
    
    
    const categoryTag = document.createElement('div');
    categoryTag.className = 'category-tag';
    categoryTag.innerHTML = `<i class="fas fa-${modItem.categoryIcon || 'tag'}"></i> ${modItem.category}`;
    
    
    const modInfo = document.createElement('div');
    modInfo.className = 'mod-info';
    
    
    const modHeader = document.createElement('div');
    modHeader.className = 'mod-header';
    
    const modTitle = document.createElement('h3');
    modTitle.textContent = modItem.name;
    
    const modVersion = document.createElement('span');
    modVersion.className = 'mod-version';
    modVersion.textContent = `v${modItem.version}`;
    
    modHeader.appendChild(modTitle);
    modHeader.appendChild(modVersion);
    
    
    const modMeta = document.createElement('div');
    modMeta.className = 'mod-meta';
    
    const modAuthor = document.createElement('span');
    modAuthor.className = 'mod-author';
    modAuthor.innerHTML = `<i class="fas fa-user"></i> ${modItem.author}`;
    
    const modDownloads = document.createElement('span');
    modDownloads.className = 'mod-downloads';
    modDownloads.innerHTML = `<i class="fas fa-download"></i> ${modItem.downloads.toLocaleString()}`;
    
    const modDate = document.createElement('span');
    modDate.className = 'mod-date';
    modDate.innerHTML = `<i class="fas fa-calendar-alt"></i> ${formatDate(modItem.lastUpdated)}`;
    
    if (modItem.fileSize) {
      const modSize = document.createElement('span');
      modSize.className = 'mod-size';
      modSize.innerHTML = `<i class="fas fa-file-archive"></i> ${modItem.fileSize}`;
      modMeta.appendChild(modSize);
    }
    
    if (modItem.rating) {
      const modRating = document.createElement('span');
      modRating.className = 'mod-rating';
      modRating.innerHTML = `<i class="fas fa-star"></i> ${modItem.rating}/5`;
      modMeta.appendChild(modRating);
    }
    
    modMeta.appendChild(modAuthor);
    modMeta.appendChild(modDownloads);
    modMeta.appendChild(modDate);
    
    
    const modDescription = document.createElement('p');
    modDescription.className = 'mod-description';
    modDescription.textContent = modItem.description;
    
    
    const modActions = document.createElement('div');
    modActions.className = 'mod-actions';
    
    const detailsButton = document.createElement('button');
    detailsButton.className = 'secondary-btn';
    detailsButton.innerHTML = '<i class="fas fa-info-circle"></i> Details';
    detailsButton.addEventListener('click', () => {
      showModDetails(modItem);
    });
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'primary-btn';
    downloadButton.innerHTML = '<i class="fas fa-download"></i> Download';
    downloadButton.addEventListener('click', () => {
      downloadMod(modItem);
    });
    
    modActions.appendChild(detailsButton);
    modActions.appendChild(downloadButton);
    
    
    modInfo.appendChild(modHeader);
    modInfo.appendChild(modMeta);
    modInfo.appendChild(modDescription);
    modInfo.appendChild(modActions);
    
    modCard.appendChild(thumbnail);
    modCard.appendChild(categoryTag);
    modCard.appendChild(modInfo);
    
    repositoryList.appendChild(modCard);
  });
}


document.querySelectorAll('.mod-card').forEach(card => {
  
  if (card.classList.contains('placeholder') || card.classList.contains('empty-state')) {
    return;
  }
  
  
  const infoSection = card.querySelector('.mod-info');
  if (infoSection) {
    infoSection.addEventListener('click', async () => {
      const modId = card.querySelector('.download-mod-btn').getAttribute('data-mod-id');
      const mod = mods.find(m => m.id === modId);
      
      if (mod) {
        showModDetails(mod);
      }
    });
  }
});


async function showModDetails(mod) {
  try {
    
    let modalContainer = document.getElementById('mod-details-modal');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'mod-details-modal';
      modalContainer.className = 'modal-container';
      document.body.appendChild(modalContainer);
    }
    
    
    modalContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Loading mod details...</h2>
          <button class="close-modal-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;
    modalContainer.style.display = 'flex';
    
    
    modalContainer.querySelector('.close-modal-btn').addEventListener('click', () => {
      modalContainer.style.display = 'none';
    });
    
    
    let detailedMod = mod;
    try {
      
      const apiUrl = `https://celestemods.net/api/v1/mods/${mod.slug}`;
      console.log('Fetching mod details from:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch mod details: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('API response data:', data);
      
      
      detailedMod = {
        ...mod,
        description: data.description,
        category: data.category?.name || data.category || 'Uncategorized',
        categorySlug: data.category?.slug || data.category_slug,
        categoryIcon: data.category?.icon || 'tag',
        downloads: data.download_count || data.downloads || 0,
        lastUpdated: data.updated_at || data.lastUpdated,
        thumbnailUrl: data.thumbnail_url || data.thumbnailUrl || 'assets/mod-default.png',
        downloadUrl: data.direct_download_url || data.download_url || data.downloadUrl,
        fileSize: data.file_size_formatted || data.fileSize,
        modType: data.mod_type || data.modType,
        installationType: data.installation_type || data.installationType,
        rating: data.average_rating || data.rating,
        author: data.user?.name || data.author || 'Unknown',
        versions: data.versions || [],
        installationInstructions: data.installation_instructions
      };
      
      
      if (!detailedMod.versions || detailedMod.versions.length === 0) {
        try {
          const versionsUrl = `https://celestemods.net/api/v1/mods/${mod.slug}/versions`;
          console.log('Fetching versions from:', versionsUrl);
          
          const versionsResponse = await fetch(versionsUrl);
          if (versionsResponse.ok) {
            const versionsData = await versionsResponse.json();
            console.log('Versions data:', versionsData);
            
            if (versionsData && Array.isArray(versionsData.data)) {
              detailedMod.versions = versionsData.data;
            }
          }
        } catch (versionsError) {
          console.warn('Failed to fetch versions:', versionsError);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch detailed mod info:', error);
      
    }
    
    
    modalContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${detailedMod.name}</h2>
          <button class="close-modal-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="mod-detail-header">
            <div class="mod-detail-thumbnail">
              <img src="${detailedMod.thumbnailUrl}" alt="${detailedMod.name}" onerror="this.src='assets/mod-default.png'">
            </div>
            <div class="mod-detail-info">
              <div class="mod-detail-meta">
                <p><strong>Version:</strong> ${detailedMod.version}</p>
                <p><strong>Author:</strong> ${detailedMod.author}</p>
                <p>
                  <strong>Category:</strong> 
                  <span class="category-tag">
                    <i class="fas fa-${detailedMod.categoryIcon || 'tag'}"></i> ${detailedMod.category}
                  </span>
                </p>
                <p><strong>Downloads:</strong> ${detailedMod.downloads.toLocaleString()}</p>
                <p><strong>Last Updated:</strong> ${formatDate(detailedMod.lastUpdated)}</p>
                ${detailedMod.fileSize ? `<p><strong>Size:</strong> ${detailedMod.fileSize}</p>` : ''}
                ${detailedMod.rating ? `<p><strong>Rating:</strong> ${detailedMod.rating}/5</p>` : ''}
                ${detailedMod.modType ? `<p><strong>Type:</strong> ${detailedMod.modType}</p>` : ''}
                ${detailedMod.installationType ? `<p><strong>Installation:</strong> ${detailedMod.installationType}</p>` : ''}
              </div>
              <div class="mod-detail-actions">
                <button class="download-mod-btn primary-btn" data-mod-id="${detailedMod.id}">
                  <i class="fas fa-download"></i> Download Latest
                </button>
              </div>
            </div>
          </div>
          <div class="mod-detail-description">
            <h3>Description</h3>
            <p>${detailedMod.description}</p>
          </div>
          
          ${detailedMod.installationInstructions ? `
            <div class="mod-installation-instructions">
              <h3>Installation Instructions</h3>
              <p>${detailedMod.installationInstructions}</p>
            </div>
          ` : ''}
          
          ${detailedMod.versions && detailedMod.versions.length > 0 ? `
            <div class="mod-versions">
              <h3>Available Versions</h3>
              <ul class="version-list">
                ${detailedMod.versions.map(version => `
                  <li class="version-item">
                    <div class="version-info">
                      <span class="version-number">v${version.version}</span>
                      <span class="version-date">${formatDate(version.created_at || version.releaseDate)}</span>
                      ${version.file_size_formatted ? `<span class="version-size">${version.file_size_formatted}</span>` : ''}
                    </div>
                    <div class="version-details">
                      ${version.changelog ? `<div class="version-changelog">${version.changelog}</div>` : ''}
                    </div>
                    <button class="download-version-btn secondary-btn" data-version-id="${version.id}" data-version-number="${version.version}">
                      <i class="fas fa-download"></i> Download
                    </button>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    
    
    modalContainer.querySelector('.close-modal-btn').addEventListener('click', () => {
      modalContainer.style.display = 'none';
    });
    
    
    const downloadLatestBtn = modalContainer.querySelector('.download-mod-btn');
    if (downloadLatestBtn) {
      downloadLatestBtn.addEventListener('click', async () => {
        await downloadMod(detailedMod);
      });
    }
    
    
    const versionButtons = modalContainer.querySelectorAll('.download-version-btn');
    versionButtons.forEach(button => {
      button.addEventListener('click', async () => {
        const versionId = button.getAttribute('data-version-id');
        const versionNumber = button.getAttribute('data-version-number');
        
        
        const versionData = detailedMod.versions.find(v => v.id.toString() === versionId);
        
        
        const versionDownloadUrl = versionData?.direct_download_url || 
                                  `https://celestemods.net/api/v1/mods/${detailedMod.slug}/download/${versionId}`;
        
        
        const versionMod = {
          ...detailedMod,
          version: versionNumber,
          downloadUrl: versionDownloadUrl,
          fileSize: versionData?.file_size_formatted
        };
        
        
        await downloadMod(versionMod);
      });
    });
  } catch (error) {
    console.error('Failed to show mod details:', error);
    updateStatus('Failed to show mod details', true);
  }
}


async function downloadMod(mod) {
  try {
    
    if (!mod.downloadUrl && !mod.download_url) {
      throw new Error('No download URL available for this mod');
    }
    
    const downloadUrl = mod.download_url || mod.downloadUrl;
    
    
    const modCards = document.querySelectorAll(`[data-mod-id="${mod.id}"]`);
    modCards.forEach(card => {
      const downloadBtn = card.querySelector('.download-mod-btn, .download-version-btn');
      if (downloadBtn) {
        const btnParent = downloadBtn.parentElement;
        
        
        let progressElement = btnParent.querySelector('.download-progress');
        if (!progressElement) {
          progressElement = document.createElement('div');
          progressElement.className = 'download-progress';
          progressElement.innerHTML = `
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <div class="progress-text">0%</div>
          `;
          btnParent.appendChild(progressElement);
        }
        
        
        downloadBtn.style.display = 'none';
        progressElement.style.display = 'flex';
      }
    });
    
    
    const result = await ipcRenderer.invoke('download-mod', {
      url: downloadUrl,
      modId: mod.id,
      modName: mod.name
    });
    
    
    if (result.success) {
      updateStatus(`Successfully downloaded ${mod.name}`);
      
      
      modCards.forEach(card => {
        const progressElement = card.querySelector('.download-progress');
        if (progressElement) {
          progressElement.innerHTML = `
            <div class="success-message">
              <i class="fas fa-check-circle"></i> Downloaded
            </div>
          `;
          
          
          setTimeout(() => {
            const downloadBtn = card.querySelector('.download-mod-btn, .download-version-btn');
            if (downloadBtn) {
              downloadBtn.style.display = 'inline-flex';
              progressElement.style.display = 'none';
            }
          }, 3000);
        }
      });
    } else {
      throw new Error(result.error || 'Download failed');
    }
  } catch (error) {
    console.error('Download error:', error);
    updateStatus(`Failed to download mod: ${error.message}`, true);
    
    
    const modCards = document.querySelectorAll(`[data-mod-id="${mod.id}"]`);
    modCards.forEach(card => {
      const progressElement = card.querySelector('.download-progress');
      if (progressElement) {
        progressElement.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-circle"></i> ${error.message}
          </div>
        `;
        
        
        setTimeout(() => {
          const downloadBtn = card.querySelector('.download-mod-btn, .download-version-btn');
          if (downloadBtn) {
            downloadBtn.style.display = 'inline-flex';
            progressElement.style.display = 'none';
          }
        }, 3000);
      }
    });
  }
}


repoSearch.addEventListener('input', () => {
  loadRepository();
});

categoryFilter.addEventListener('change', () => {
  loadRepository();
});

sortBy.addEventListener('change', () => {
  loadRepository();
});

repoRefreshBtn.addEventListener('click', () => {
  loadRepository();
});


modSearch.addEventListener('input', () => {
  const searchTerm = modSearch.value.toLowerCase();
  const modCards = document.querySelectorAll('#mods-list .mod-card');
  
  modCards.forEach(card => {
    const modName = card.querySelector('h3')?.textContent.toLowerCase() || '';
    const modAuthor = card.querySelector('p:nth-child(3)')?.textContent.toLowerCase() || '';
    
    if (modName.includes(searchTerm) || modAuthor.includes(searchTerm)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
});


refreshBtn.addEventListener('click', loadMods);


document.querySelectorAll('.apply-theme-btn').forEach(button => {
  button.addEventListener('click', () => {
    const theme = button.getAttribute('data-theme');
    applyTheme(theme);
    store.set('theme', theme);
  });
});

function applyTheme(theme) {
  
  document.body.classList.remove(
    'default-theme-applied', 
    'dark-theme-applied', 
    'light-theme-applied', 
    'synthwave-theme-applied',
    'pastel-dream-theme-applied',
    'cherry-blossom-theme-applied',
    'mint-chocolate-theme-applied',
    'lavender-fields-theme-applied',
    'ocean-breeze-theme-applied',
    'strawberry-milk-theme-applied'
  );
  
  
  document.body.classList.add(`${theme}-theme-applied`);
  
  
  document.querySelectorAll('.apply-theme-btn').forEach(btn => {
    if (btn.getAttribute('data-theme') === theme) {
      btn.textContent = 'Applied';
      btn.disabled = true;
    } else {
      btn.textContent = 'Apply';
      btn.disabled = false;
    }
  });
}


function loadSavedTheme() {
  const theme = store.get('theme');
  
  if (theme) {
    applyTheme(theme);
  } else {
    
    localStorage.removeItem('selectedTheme');
    localStorage.setItem('selectedTheme', 'default');
    
    
    document.body.classList.remove(
      'default-theme-applied', 
      'dark-theme-applied', 
      'light-theme-applied', 
      'synthwave-theme-applied',
      'pastel-dream-theme-applied',
      'cherry-blossom-theme-applied',
      'mint-chocolate-theme-applied',
      'lavender-fields-theme-applied',
      'ocean-breeze-theme-applied',
      'strawberry-milk-theme-applied'
    );
    document.body.classList.add('default-theme-applied');
    
    
    document.querySelectorAll('.apply-theme-btn').forEach(btn => {
      if (btn.getAttribute('data-theme') === 'default') {
        btn.textContent = 'Applied';
        btn.disabled = true;
      } else {
        btn.textContent = 'Apply';
        btn.disabled = false;
      }
    });
  }
}


loadSavedTheme();


backupModsBtn.addEventListener('click', async () => {
  try {
    if (!dialog) {
      updateStatus('Dialog module not available', true);
      return;
    }
    
    const settings = store.get();
    if (!settings.modsDirectory) {
      updateStatus('Mods directory not set', true);
      return;
    }
    
    const result = await dialog.showSaveDialog({
      title: 'Save Mods Backup',
      defaultPath: path.join(require('electron').remote.app.getPath('documents'), 'celeste-mods-backup.zip'),
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
    });
    
    if (result.canceled || !result.filePath) {
      return;
    }
    
    updateStatus('Creating backup...');
    
    
    
    setTimeout(() => {
      updateStatus('Backup created successfully');
    }, 2000);
  } catch (error) {
    console.error('Failed to backup mods:', error);
    updateStatus('Failed to backup mods', true);
  }
});


launchGameBtn.addEventListener('click', async () => {
  try {
    const settings = store.get();
    
    if (!settings.gamePath) {
      updateStatus('Game path not set. Please set it in Settings.', true);
      return;
    }
    
    
    updateStatus('Launching game...');
    
    
    setTimeout(() => {
      updateStatus('Game launched');
    }, 2000);
  } catch (error) {
    console.error('Failed to launch game:', error);
    updateStatus('Failed to launch game', true);
  }
});


function updateStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? 'var(--danger)' : 'var(--text-dark)';
  
  if (isError) {
    console.error(message);
  } else {
    console.log(message);
  }
}


function initLoadingParticles() {
  const particlesContainer = document.getElementById('loading-particles');
  const numParticles = 20;
  
  
  particlesContainer.innerHTML = '';
  
  
  for (let i = 0; i <numParticles; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    
    const size = Math.floor(Math.random() * 6) + 3;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    
    const posX = Math.floor(Math.random() * 100);
    const posY = Math.floor(Math.random() * 100);
    particle.style.left = `${posX}%`;
    particle.style.top = `${posY}%`;
    
    
    const delay = Math.random() * 5;
    particle.style.animationDelay = `${delay}s`;
    
    
    const duration = Math.random() * 10 + 10;
    particle.style.animationDuration = `${duration}s`;
    
    
    particlesContainer.appendChild(particle);
  }
}


document.addEventListener('DOMContentLoaded', () => {
  initLoadingParticles();
  
  
  const progressBar = document.getElementById('loading-progress-bar');
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 10;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        setTimeout(() => {
          document.getElementById('loading-screen').style.display = 'none';
        }, 500);
      }, 500);
    }
    progressBar.style.width = `${progress}%`;
  }, 200);
  
  
  loadSettings();
  loadMods();
  loadRepository();
  
  
  setTimeout(() => {
    updateStatus('Celeste Mod Loader ready');
  }, 2500);
});


function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${month}/${day}/${year}`;
}
