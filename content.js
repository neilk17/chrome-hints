class HintManager {
  constructor() {
    this.hints = [];
    this.activeHints = [];
    this.isActive = false;
    this.partialMatch = '';
    this.shiftPressed = false;
    
    // Bind methods
    this.activateHints = this.activateHints.bind(this);
    this.removeHints = this.removeHints.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    
    // Set up message listener
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'activateHints') {
        this.activateHints();
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
    
    const elements = this.findClickableElements();
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
    
    // Remove keyboard listeners
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
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
    } else {
      // For links and buttons, simulate a click
      element.click();
    }
  }
}

// Initialize the hint manager
const hintManager = new HintManager();