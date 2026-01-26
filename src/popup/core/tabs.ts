// Tab switching functionality

export function switchToTab(targetId: string): void {
  const tabs = document.querySelectorAll('.tab');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabs.forEach(t => t.classList.remove('active'));
  tabPanels.forEach(panel => panel.classList.remove('active'));

  const targetTab = document.querySelector(`.tab[data-tab="${targetId}"]`);
  const targetPanel = document.getElementById(targetId);

  if (targetTab) targetTab.classList.add('active');
  if (targetPanel) targetPanel.classList.add('active');
}

export function setupTabSwitching(): void {
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      if (targetId) {
        switchToTab(targetId);
        chrome.storage.local.set({ lastActiveTab: targetId });
      }
    });
  });
}

export async function restoreLastTab(): Promise<void> {
  const { lastActiveTab } = await chrome.storage.local.get('lastActiveTab');
  if (lastActiveTab) {
    switchToTab(lastActiveTab);
  }
}
