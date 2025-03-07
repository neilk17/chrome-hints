class HintManager {
  constructor() {
    this.hints = [];
    this.activeHints = [];
    this.isActive = false;
    this.partialMatch = '';
    this.shiftPressed = false;
    this.cachedClickableElements = null;
    this.lastCacheTime = 0;
    this.cacheExpiryTime = 5000; // ms - how long the cache is valid
    this.clickMode = 'normal'; // 'normal', 'newTab', 'newTabSwitch'
    
    // Bind methods
    this.activateHints = this.activateHints.bind(this);
    this.removeHints = this.removeHints.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.precomputeHints = this.precomputeHints.bind(this);
    
    // Set up message listener
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'activateHints') {
        this.clickMode = message.mode || 'normal';
        this.activateHints();
      } else if (message.action === 'precomputeHints') {
        this.precomputeHints();
      }
    });
  }
  
  // Generate a hint string (e.g., "AA", "AB", etc.)
  generateHintString(index) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let hint = '';
    
    do {
      hint = chars[index % chars.length] + hint;
      index = Math.floor(index / chars.length);
    } while (index > 0);
    
    return hint;
  }
  
  // Find all clickable elements on the page
  findClickableElements() {
    const clickableElements = [];
    
    // Links
    const links = document.querySelectorAll('a, [role="link"]');
    links.forEach(link => {
      if (this.isElementVisible(link)) {
        clickableElements.push(link);
      }
    });
    
    // Buttons
    const buttons = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
    buttons.forEach(button => {
      if (this.isElementVisible(button)) {
        clickableElements.push(button);
      }
    });
    
    // Input fields
    const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea, [contenteditable="true"]');
    inputs.forEach(input => {
      if (this.isElementVisible(input)) {
        clickableElements.push(input);
      }
    });
    
    // Select elements
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
      if (this.isElementVisible(select)) {
        clickableElements.push(select);
      }
    });
    
    return clickableElements;
  }
  
  // Check if an element is visible
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    
    // Check if element has size and is in viewport
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.bottom < 0 || rect.right < 0) return false;
    if (rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
    
    // Check computed style
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.visibility === 'hidden' || computedStyle.display === 'none' || computedStyle.opacity === '0') {
      return false;
    }
    
    return true;
  }
  
  // Create hint markers and place them next to elements
  createHints(elements) {
    elements.forEach((element, index) => {
      const hintString = this.generateHintString(index);
      const hintMarker = document.createElement('div');
      hintMarker.className = 'hint-marker';
      hintMarker.textContent = hintString;
      
      // Get element position
      const rect = element.getBoundingClientRect();
      
      // Position the hint marker
      hintMarker.style.left = (rect.left + window.scrollX - 5) + 'px';
      hintMarker.style.top = (rect.top + window.scrollY - 5) + 'px';
      
      document.body.appendChild(hintMarker);
      
      this.hints.push({
        marker: hintMarker,
        element: element,
        text: hintString,
        elementText: (element.textContent || '').toLowerCase()
      });
    });
    
    this.activeHints = [...this.hints];
  }
  
  // Precompute clickable elements when the browser is idle
  precomputeHints() {
    // Cache the clickable elements for faster activation later
    this.cachedClickableElements = this.findClickableElements();
    this.lastCacheTime = Date.now();
    console.debug(`Precomputed ${this.cachedClickableElements.length} clickable elements during idle time`);
  }
  
  // Activate hint mode
  activateHints() {
    if (this.isActive) {
      this.removeHints();
      return;
    }
    
    this.isActive = true;
    this.hints = [];
    this.activeHints = [];
    this.partialMatch = '';
    
    // Set data attribute on body to enable CSS styling based on mode
    document.body.setAttribute('data-click-mode', this.clickMode);
    
    let elements;
    
    // Use cached elements if available and not expired
    const now = Date.now();
    if (this.cachedClickableElements && (now - this.lastCacheTime < this.cacheExpiryTime)) {
      elements = this.cachedClickableElements;
      console.debug(`Using ${elements.length} pre-computed clickable elements (${now - this.lastCacheTime}ms old)`);
    } else {
      elements = this.findClickableElements();
      console.debug(`Found ${elements.length} clickable elements (cache expired or not available)`);
    }
    
    this.createHints(elements);
    
    // Add keyboard listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }
  
  // Remove hints and clean up
  removeHints() {
    this.hints.forEach(hint => {
      if (hint.marker.parentNode) {
        hint.marker.parentNode.removeChild(hint.marker);
      }
    });
    
    this.hints = [];
    this.activeHints = [];
    this.isActive = false;
    this.partialMatch = '';
    
    // Remove data attribute from body
    document.body.removeAttribute('data-click-mode');
    
    // Remove keyboard listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    
    // After hints are removed, we can precompute for next time
    // This ensures the cache is fresh even if the idle event hasn't fired
    setTimeout(() => {
      this.precomputeHints();
    }, 500); // Small delay to ensure page is settled
  }
  
  // Handle key down events
  handleKeyDown(event) {
    // Check for Escape key to cancel
    if (event.key === 'Escape') {
      event.preventDefault();
      this.removeHints();
      return;
    }
    
    // Check for Shift key
    if (event.key === 'Shift') {
      this.shiftPressed = true;
      return;
    }
    
    // Ignore modifier keys
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    
    event.preventDefault();
    
    // Text search mode (Shift pressed)
    if (this.shiftPressed) {
      const searchText = this.partialMatch + event.key.toLowerCase();
      this.partialMatch = searchText;
      
      this.activeHints = this.hints.filter(hint => 
        hint.elementText.includes(searchText)
      );
      
      // If only one hint left, click it
      if (this.activeHints.length === 1) {
        this.clickElement(this.activeHints[0].element);
        this.removeHints();
        return;
      }
      
      // Update visible hints
      this.updateVisibleHints();
      return;
    }
    
    // Regular hint mode (no Shift)
    const key = event.key.toUpperCase();
    if (key.length === 1 && /[A-Z]/.test(key)) {
      this.partialMatch += key;
      
      // Filter hints that match the partial input
      this.activeHints = this.hints.filter(hint => 
        hint.text.startsWith(this.partialMatch)
      );
      
      // If only one hint left, click it
      if (this.activeHints.length === 1) {
        this.clickElement(this.activeHints[0].element);
        this.removeHints();
        return;
      }
      
      // If no hints match, reset
      if (this.activeHints.length === 0) {
        this.partialMatch = '';
        this.activeHints = [...this.hints];
      }
      
      // Update visible hints
      this.updateVisibleHints();
    }
  }
  
  // Handle key up events
  handleKeyUp(event) {
    if (event.key === 'Shift') {
      this.shiftPressed = false;
    }
  }
  
  // Update which hints are visible based on the current filter
  updateVisibleHints() {
    this.hints.forEach(hint => {
      if (this.activeHints.includes(hint)) {
        hint.marker.style.display = 'block';
      } else {
        hint.marker.style.display = 'none';
      }
    });
  }
  
  // Click or focus the selected element
  clickElement(element) {
    // If it's an input, textarea, or contenteditable, focus it
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || 
        element.contentEditable === 'true') {
      element.focus();
    } else if (element.tagName === 'A' && (this.clickMode === 'newTab' || this.clickMode === 'newTabSwitch')) {
      // For links with new tab modes
      const href = element.getAttribute('href');
      if (href) {
        console.log(`Clicking link with mode: ${this.clickMode}`, href);
        
        // Create a click event with modifier keys based on the mode
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          ctrlKey: true,  // Ctrl+click opens in new tab
          shiftKey: this.clickMode === 'newTabSwitch',  // Shift+click in most browsers opens and switches
          metaKey: navigator.platform.includes('Mac')  // For Mac users
        });
        
        // Apply the click with modifiers
        element.dispatchEvent(clickEvent);
      } else {
        // Fallback if href is not available
        element.click();
      }
    } else {
      // For regular links and buttons, simulate normal click
      element.click();
    }
  }
}

// Initialize the hint manager
const hintManager = new HintManager();

// Set up event listeners for DOM changes that might affect clickable elements
const observer = new MutationObserver(() => {
  // If the hints are not currently active, precompute for next time
  if (!hintManager.isActive) {
    // Clear any existing timeout to avoid multiple precomputes in quick succession
    if (hintManager.precomputeTimeout) {
      clearTimeout(hintManager.precomputeTimeout);
    }
    
    // Delay precompute to batch DOM changes
    hintManager.precomputeTimeout = setTimeout(() => {
      hintManager.precomputeHints();
      hintManager.precomputeTimeout = null;
    }, 1000);
  }
});

// Start observing DOM changes
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style', 'class', 'hidden']
});

// Precompute hints when page loads or becomes visible
document.addEventListener('DOMContentLoaded', () => {
  hintManager.precomputeHints();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    hintManager.precomputeHints();
  }
});