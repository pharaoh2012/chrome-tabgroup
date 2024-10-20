function groupTabs(scope) {
  const queryOptions = scope === 'currentWindow' ? {currentWindow: true} : {};
  
  chrome.tabs.query(queryOptions, (tabs) => {
    const domains = {};
    tabs.forEach((tab) => {
      const url = new URL(tab.url);
      const domain = url.hostname;
      if (!domains[domain]) {
        domains[domain] = [];
      }
      domains[domain].push(tab.id);
    });

    Object.entries(domains).forEach(([domain, tabIds]) => {
      if (tabIds.length > 1) {
        chrome.tabGroups.query({title: domain}, (groups) => {
          if (groups.length > 0) {
            chrome.tabs.group({groupId: groups[0].id, tabIds});
          } else {
            chrome.tabs.group({tabIds}, (groupId) => {
              chrome.tabGroups.update(groupId, {title: domain});
            });
          }
        });
      }
    });
  });
}

function saveGroups() {
  chrome.windows.getAll({populate: true}, (windows) => {
    const windowsData = windows.map(window => ({
      id: window.id,
      state: window.state,
      groups: [],
      ungroupedTabs: []
    }));

    const promises = windows.map((window, windowIndex) => 
      new Promise((resolveWindow) => {
        chrome.tabGroups.query({windowId: window.id}, (groups) => {
          const groupPromises = groups.map(group => 
            new Promise((resolveGroup) => {
              chrome.tabs.query({groupId: group.id}, (tabs) => {
                windowsData[windowIndex].groups.push({
                  title: group.title,
                  color: group.color,
                  tabs: tabs.map(tab => ({
                    url: tab.url,
                    title: tab.title,
                    active: tab.active,
                    pinned: tab.pinned
                  }))
                });
                resolveGroup();
              });
            })
          );

          chrome.tabs.query({windowId: window.id, groupId: chrome.tabGroups.TAB_GROUP_ID_NONE}, (ungroupedTabs) => {
            windowsData[windowIndex].ungroupedTabs = ungroupedTabs.map(tab => ({
              url: tab.url,
              title: tab.title,
              active: tab.active,
              pinned: tab.pinned
            }));

            Promise.all(groupPromises).then(() => resolveWindow());
          });
        });
      })
    );

    Promise.all(promises).then(() => {
      chrome.storage.local.set({savedWindows: windowsData}, () => {
        console.log('Windows, groups, and tabs saved');
      });
    });
  });
}

function loadGroups() {
  chrome.storage.local.get(['savedWindows'], (result) => {
    if (result.savedWindows) {
      result.savedWindows.forEach(windowData => {
        chrome.windows.create({state: windowData.state}, (newWindow) => {
          const createTabs = (tabs, groupId = null) => {
            return new Promise((resolve) => {
              chrome.tabs.create({
                windowId: newWindow.id,
                url: tabs.map(tab => tab.url)
              }, (createdTabs) => {
                const tabIds = Array.isArray(createdTabs) ? createdTabs.map(tab => tab.id) : [createdTabs.id];
                if (groupId) {
                  chrome.tabs.group({tabIds, groupId}, resolve);
                } else {
                  resolve(tabIds);
                }
              });
            });
          };

          const groupPromises = windowData.groups.map(group => 
            createTabs(group.tabs).then(tabIds => 
              new Promise((resolve) => {
                chrome.tabs.group({tabIds}, (groupId) => {
                  chrome.tabGroups.update(groupId, {
                    title: group.title,
                    color: group.color
                  }, resolve);
                });
              })
            )
          );

          const ungroupedPromise = createTabs(windowData.ungroupedTabs);

          Promise.all([...groupPromises, ungroupedPromise]).then(() => {
            chrome.tabs.query({windowId: newWindow.id}, (tabs) => {
              tabs.forEach(tab => {
                const savedTab = [...windowData.groups.flatMap(g => g.tabs), ...windowData.ungroupedTabs]
                  .find(t => t.url === tab.url);
                if (savedTab) {
                  chrome.tabs.update(tab.id, {
                    active: savedTab.active,
                    pinned: savedTab.pinned
                  });
                }
              });
              chrome.tabs.remove(newWindow.tabs[0].id);
            });
          });
        });
      });
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'groupTabs') {
    groupTabs(request.scope);
  } else if (request.action === 'saveGroups') {
    saveGroups();
  } else if (request.action === 'loadGroups') {
    loadGroups();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    groupTabs('currentWindow');
  }
});

chrome.tabs.onMoved.addListener(() => {
  groupTabs('currentWindow');
});

chrome.tabs.onAttached.addListener(() => {
  groupTabs('currentWindow');
});