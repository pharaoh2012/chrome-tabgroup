document.getElementById('groupCurrentWindow').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'groupTabs', scope: 'currentWindow'});
});

document.getElementById('groupAllWindows').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'groupTabs', scope: 'allWindows'});
});

document.getElementById('saveGroups').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'saveGroups'});
});

document.getElementById('loadGroups').addEventListener('click', () => {
  chrome.runtime.sendMessage({action: 'loadGroups'});
});