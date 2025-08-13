// ===== タブ切り替えロジック =====

export function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.tab;
      const targetTab = document.getElementById(`tab-${targetId}`);
      
      if (!targetTab) {
        console.error(`Tab with id 'tab-${targetId}' not found`);
        return;
      }
      
      // Remove active from all
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(s => s.classList.remove('active'));
      
      // Add active to clicked
      btn.classList.add('active');
      targetTab.classList.add('active');
      
      console.log(`Switched to tab: ${targetId}`);
    });
  });
}