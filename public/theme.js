// Theme Management Script (New Genre Studio)
(function() {
    const savedTheme = localStorage.getItem('site-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    }

    document.addEventListener('DOMContentLoaded', () => {
        const themeToggles = document.querySelectorAll('#theme-toggle, .theme-toggle-btn');
        
        const updateToggleText = (isLight) => {
            themeToggles.forEach(btn => {
                btn.innerHTML = isLight ? '🌙 Toggle Mood' : '☀️ Toggle Mood';
            });
        };

        // Set initial state
        updateToggleText(document.body.classList.contains('light-mode'));

        themeToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                document.body.classList.toggle('light-mode');
                const isLight = document.body.classList.contains('light-mode');
                localStorage.setItem('site-theme', isLight ? 'light' : 'dark');
                updateToggleText(isLight);
                
                // Dispatch event for other components (like charts) to react
                document.dispatchEvent(new CustomEvent('themeChanged', { 
                    detail: { theme: isLight ? 'light' : 'dark' } 
                }));
            });
        });
    });
})();
