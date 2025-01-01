function createXButton(username) {
  console.log(`Creating X button for username: ${username}`);
  const button = document.createElement('a');
  button.href = `https://x.com/${username.replace('@', '')}`;
  button.target = '_blank';
  button.className = 'kaito-helper-x-button';
  button.title = `Open ${username} on X`;
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  `;
  
  // Add click handler to prevent event bubbling
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(button.href, '_blank');
  });
  
  console.log('Button created:', button);
  return button;
}

function addXButtonsToTable() {
  console.log('Running addXButtonsToTable');
  const tableRows = document.querySelectorAll('tbody tr');
  console.log(`Found ${tableRows.length} table rows`);
  
  tableRows.forEach((row, index) => {
    console.log(`Processing row ${index}`);
    const nameCell = row.querySelector('td:nth-child(2)');
    if (nameCell) {
      console.log('Found name cell:', nameCell.innerHTML);
      // Look for the username span - now using a more specific selector
      const usernameSpan = nameCell.querySelector('span.text-white\\/40 span:last-child');
      if (usernameSpan) {
        const username = usernameSpan.textContent;
        console.log(`Found username: ${username}`);
        
        // Check if button already exists
        if (!nameCell.querySelector('.kaito-helper-x-button')) {
          const button = createXButton(username);
          
          // Insert button right after the flex container that has the username
          const flexContainer = nameCell.querySelector('.flex');
          if (flexContainer) {
            flexContainer.style.display = 'flex';
            flexContainer.style.alignItems = 'center';
            flexContainer.style.gap = '8px';
            flexContainer.appendChild(button);
            console.log('Added button next to username');
          }
        }
      } else {
        console.log('No username element found in this cell');
      }
    } else {
      console.log('No name cell found in this row');
    }
  });
}

// Wait for DOM to be fully loaded
console.log('Content script loaded');
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  addXButtonsToTable();
});

// Also try running on immediate load in case DOMContentLoaded already fired
addXButtonsToTable();

// Set up observer for dynamic content
console.log('Setting up MutationObserver');
const observer = new MutationObserver((mutations) => {
  console.log('Mutation observed:', mutations);
  addXButtonsToTable();
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true 
}); 