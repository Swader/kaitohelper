// Cache for yap scores to avoid repeated lookups
let yapScoresCache = null;

async function getYapScores() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getYapScores' });
    if (response.success) {
      yapScoresCache = response.data.attestations;
      return yapScoresCache;
    }
    console.error('Failed to get yap scores:', response.error);
    return [];
  } catch (error) {
    console.error('Error fetching yap scores:', error);
    return [];
  }
}

function findYapScore(username) {
  if (!yapScoresCache) return null;
  const attestation = yapScoresCache.find(a => a.twitterUsername.toLowerCase() === username.toLowerCase());
  return attestation ? attestation.yapPoints : null;
}

// Function to add yap score to a tweet
function addYapScoreToTweet(tweetElement) {
  // Find the username element - this selector might need adjustment based on X's current DOM structure
  const usernameElement = tweetElement.querySelector('div[data-testid="User-Name"] a:last-child');
  if (!usernameElement) return;

  // Extract username from the href
  const username = usernameElement.href.split('/').pop();
  if (!username) return;

  // Check if we already added a yap score to this tweet
  if (tweetElement.querySelector('.kaito-helper-yap-score')) return;

  // Find yap score
  const yapScore = findYapScore(username);
  if (!yapScore) return;

  // Create and add the yap score element as a link
  const scoreLink = document.createElement('a');
  scoreLink.className = 'kaito-helper-yap-score';
  scoreLink.href = 'https://yaps.kaito.ai/referral/125083073';
  scoreLink.target = '_blank';
  scoreLink.textContent = `${yapScore} YAP`;
  
  // Add click handler to prevent event bubbling
  scoreLink.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Insert after the username
  const userInfoContainer = usernameElement.closest('div[data-testid="User-Name"]');
  if (userInfoContainer) {
    userInfoContainer.appendChild(scoreLink);
  }
}

// Function to handle X.com
async function handleXContent() {
  // Fetch yap scores if not cached
  if (!yapScoresCache) {
    await getYapScores();
  }

  // Find all tweets in the timeline
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  tweets.forEach(addYapScoreToTweet);
}

// Function to create X button (for kaito site)
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

// Function to handle Kaito site
function addXButtonsToTable() {
  console.log('Running addXButtonsToTable');
  const tableRows = document.querySelectorAll('tbody tr');
  console.log(`Found ${tableRows.length} table rows`);
  
  tableRows.forEach((row, index) => {
    console.log(`Processing row ${index}`);
    const nameCell = row.querySelector('td:nth-child(2)');
    if (nameCell) {
      console.log('Found name cell:', nameCell.innerHTML);
      const usernameSpan = nameCell.querySelector('span.text-white\\/40 span:last-child');
      if (usernameSpan) {
        const username = usernameSpan.textContent;
        console.log(`Found username: ${username}`);
        
        if (!nameCell.querySelector('.kaito-helper-x-button')) {
          const button = createXButton(username);
          const flexContainer = nameCell.querySelector('.flex');
          if (flexContainer) {
            flexContainer.style.display = 'flex';
            flexContainer.style.alignItems = 'center';
            flexContainer.style.gap = '8px';
            flexContainer.appendChild(button);
            console.log('Added button next to username');
          }
        }
      }
    }
  });
}

// Initialize based on current site
const isXSite = window.location.hostname === 'x.com' || window.location.hostname === 'twitter.com';

if (isXSite) {
  console.log('On X.com, setting up yap score display');
  handleXContent();
  
  // Set up observer for dynamic content on X
  const observer = new MutationObserver((mutations) => {
    handleXContent();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
} else {
  console.log('On Kaito site, setting up X buttons');
  // Handle Kaito site initialization
  document.addEventListener('DOMContentLoaded', addXButtonsToTable);
  addXButtonsToTable();
  
  // Set up observer for Kaito site
  const observer = new MutationObserver((mutations) => {
    addXButtonsToTable();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
} 