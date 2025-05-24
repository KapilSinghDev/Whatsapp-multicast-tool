
        // DOM Elements
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const connectBtn = document.getElementById('connectBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const qrContainer = document.getElementById('qrContainer');
        const qrCode = document.getElementById('qrCode');
        const contactsFile = document.getElementById('contactsFile');
        const contactsFileName = document.getElementById('contactsFileName');
        const uploadContactsBtn = document.getElementById('uploadContactsBtn');
        const mediaFile = document.getElementById('mediaFile');
        const mediaFileName = document.getElementById('mediaFileName');
        const uploadMediaBtn = document.getElementById('uploadMediaBtn');
        const salutation = document.getElementById('salutation');
        const message = document.getElementById('message');
        const saveMessageBtn = document.getElementById('saveMessageBtn');
        const startCampaignBtn = document.getElementById('startCampaignBtn');
        const startImageCampaignBtn = document.getElementById('startPosterCampaignBtn')
        const logs = document.getElementById('logs');
        const selectContacts = document.getElementById('contacts-x')
        const selectMedia = document.getElementById('media-x')
        const goButton = document.getElementById('executeActions')
        // Base URL for API calls
        const API_BASE_URL = 'http://localhost:3000';

        // Initialize app
        document.addEventListener('DOMContentLoaded', () => {
            checkStatus();
            loadMessageSettings();
            
            // Set up file input listeners
            contactsFile.addEventListener('change', () => {
                contactsFileName.textContent = contactsFile.files[0]?.name || 'No file chosen';
            });
            
            mediaFile.addEventListener('change', () => {
                mediaFileName.textContent = mediaFile.files[0]?.name || 'No file chosen';
            });
            
            // Button event listeners
            connectBtn.addEventListener('click', connectWhatsApp);
            logoutBtn.addEventListener('click', logoutWhatsApp);
            uploadContactsBtn.addEventListener('click', uploadContacts);
            uploadMediaBtn.addEventListener('click', uploadMedia);
            saveMessageBtn.addEventListener('click', saveMessageSettings);
            startCampaignBtn.addEventListener('click', startCampaign);
            startImageCampaignBtn.addEventListener('click',startCaptionWithImage)
            selectContacts.addEventListener('click', (e) => clearAssets(e)) // ✅ Use arrow function
            selectMedia.addEventListener('click', (e) => clearAssets(e))    // ✅ Use arrow function
            goButton.addEventListener('click',deleteAction)
        });

        // Add log entry
        function addLog(message, type = 'info') {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${type}`;
            logEntry.textContent = message;
            logs.prepend(logEntry);
        }

        // Check WhatsApp connection status
        async function checkStatus() {
            try {
                const response = await fetch(`${API_BASE_URL}/bot/status`);
                const data = await response.json();
                
                if (data.status === 'connected') {
                    statusDot.classList.add('connected');
                    statusText.textContent = 'Connected';
                    addLog('WhatsApp is connected and ready.', 'success');
                } else {
                    statusDot.classList.remove('connected');
                    statusText.textContent = 'Disconnected';
                    addLog('WhatsApp is disconnected.', 'error');
                }
            } catch (error) {
                console.error('Error checking status:', error);
                statusDot.classList.remove('connected');
                statusText.textContent = 'API Error';
                addLog('Error connecting to the server.', 'error');
            }
        }

        // Connect WhatsApp and show QR code
        function connectWhatsApp() {
            addLog('Requesting QR code...', 'info');
            qrContainer.style.display = 'block';
            
            // Create iframe to show QR code
            const iframe = document.createElement('iframe');
            iframe.width = '100%';
            iframe.height = '300px';
            iframe.style.border = 'none';
            iframe.src = `${API_BASE_URL}/bot/qr`;
            
            qrCode.innerHTML = '';
            qrCode.appendChild(iframe);
            
            // Poll for status after showing QR
            const statusInterval = setInterval(async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/bot/status`);
                    const data = await response.json();
                    
                    if (data.status === 'connected') {
                        clearInterval(statusInterval);
                        statusDot.classList.add('connected');
                        statusText.textContent = 'Connected';
                        qrContainer.style.display = 'none';
                        addLog('WhatsApp connected successfully!', 'success');
                    }
                } catch (error) {
                    console.error('Error checking status:', error);
                }
            }, 3000);
        }

        // Logout from WhatsApp
        async function logoutWhatsApp() {
            try {
                addLog('Logging out from WhatsApp...', 'info');
                const response = await fetch(`${API_BASE_URL}/bot/logout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ removeAuth: true })
                });
                
                const data = await response.json();
                
                if (data.status === 200) {
                    statusDot.classList.remove('connected');
                    statusText.textContent = 'Disconnected';
                    addLog('Logged out successfully.', 'success');
                } else {
                    addLog(`Logout failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                addLog('Error during logout.', 'error');
            }
        }

        // Upload contacts CSV file
        async function uploadContacts() {
            if (!contactsFile.files[0]) {
                addLog('Please select a CSV file first.', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', contactsFile.files[0]);
            
            try {
                addLog('Uploading contacts...', 'info');
                const response = await fetch(`${API_BASE_URL}/bot/numbers`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.status === 200) {
                    addLog(`Successful. ${data.newContactsAdded} new contacts and ${data.repeatedContacts} were repeats`, 'success');
                    contactsFileName.textContent = 'No file chosen';
                    contactsFile.value = '';
                } else {
                    addLog(`Upload failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error uploading contacts:', error);
                addLog('Error uploading contacts.', 'error');
            }
        }

        // remove contacts and media

        let contacts = false;
        let media = false;
        async function clearAssets(e) {
            console.log(e.target.id)
            if(e.target.id === 'contacts-x'){
                contacts = !contacts;
            }
            if(e.target.id === 'media-x'){
                media = !media
            }
        }
        async function deleteAction() {
            try {
                const response = await fetch(`${API_BASE_URL}/bot/clear`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contacts: contacts, 
                        media: media
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 200) {
                    addLog(`Delete Status: Contacts: ${data.results.contactsCleared ? 'Cleared' : 'Not processed'}, Media: ${data.results.mediaDeleted ? 'Deleted' : 'Not processed'}`);
                    
                    // Add individual messages from the server
                    if (data.results.messages && data.results.messages.length > 0) {
                        data.results.messages.forEach(message => {
                            addLog(`- ${message}`);
                        });
                    }
                } else {
                    addLog(`Error Deleting Files: ${data.message || 'Unknown error'}`);
                    
                    // Add error details if available
                    if (data.results && data.results.messages) {
                        data.results.messages.forEach(message => {
                            addLog(`- ${message}`);
                        });
                    }
                }
            } catch (error) {
                console.error('Error in deleteAction:', error);
                addLog(`Network Error: ${error.message}`);
            }
        }

        // Upload media file
        async function uploadMedia() {
            if (!mediaFile.files[0]) {
                addLog('Please select a media file first.', 'error');
                return;
            }
            
            const formData = new FormData();
            formData.append('media', mediaFile.files[0]);
            
            try {
                addLog('Uploading media...', 'info');
                const response = await fetch(`${API_BASE_URL}/bot/media`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.status === 200) {
                    addLog('Media uploaded successfully.', 'success');
                    mediaFileName.textContent = 'No file chosen';
                    mediaFile.value = '';
                } else {
                    addLog(`Media upload failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error uploading media:', error);
                addLog('Error uploading media.', 'error');
            }
        }

        // Load message settings
        async function loadMessageSettings() {
            try {
                // This is a workaround since we don't have a direct endpoint
                // to get the current message settings
                const response = await fetch(`${API_BASE_URL}/`);
                
                // If we had an endpoint to get message settings, we'd use it like:
                // const messageData = await response.json();
                // salutation.value = messageData.salutation || '';
                // message.value = messageData.message || '';
            } catch (error) {
                console.error('Error loading message settings:', error);
            }
        }

        // Save message settings
        async function saveMessageSettings() {
            if (!message.value.trim()) {
                addLog('Please enter a message first.', 'error');
                return;
            }
            
            try {
                addLog('Saving message settings...', 'info');
                const response = await fetch(`${API_BASE_URL}/bot/salutations`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        salutation: salutation.value.trim(),
                        message: message.value.trim()
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 201) {
                    addLog('Message settings saved successfully.', 'success');
                } else {
                    addLog(`Failed to save message settings: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error saving message settings:', error);
                addLog('Error saving message settings.', 'error');
            }
        }

        // Start the campaign
        async function startCampaign() {
            try {
                // First check if WhatsApp is connected
                const statusResponse = await fetch(`${API_BASE_URL}/bot/status`);
                const statusData = await statusResponse.json();
                
                if (statusData.status !== 'connected') {
                    addLog('WhatsApp is not connected. Please connect first.', 'error');
                    return;
                }
                
                addLog('Starting campaign...', 'info');
                const response = await fetch(`${API_BASE_URL}/bot/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ option: 'start' , useImage : false })
                });
                
                const data = await response.json();
                
                if (data.status === 200) {
                    addLog(`Campaign completed! Sent ${data.totalMessagesSent} messages successfully.`, 'success');
                    
                    if (data.totalMessagesFailed > 0) {
                        addLog(`Failed to send ${data.totalMessagesFailed} messages.`, 'error');
                    }
                } else {
                    addLog(`Campaign failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error starting campaign:', error);
                addLog('Error starting campaign.', 'error');
            }
        }

        async function startCaptionWithImage() {
            try {
                // First check if WhatsApp is connected
                const statusResponse = await fetch(`${API_BASE_URL}/bot/status`);
                const statusData = await statusResponse.json();
                
                if (statusData.status !== 'connected') {
                    addLog('WhatsApp is not connected. Please connect first.', 'error');
                    return;
                }
                
                addLog('Starting campaign...', 'info');
                const response = await fetch(`${API_BASE_URL}/bot/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ option: 'start' , useImage : true })
                });
                
                const data = await response.json();
                
                if (data.status === 200) {
                    addLog(`Campaign completed! Sent ${data.totalMessagesSent} messages successfully.`, 'success');
                    
                    if (data.totalMessagesFailed > 0) {
                        addLog(`Failed to send ${data.totalMessagesFailed} messages.`, 'error');
                    }
                } else {
                    addLog(`Campaign failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Error starting campaign:', error);
                addLog('Error starting campaign.', 'error');
            }
        }
    