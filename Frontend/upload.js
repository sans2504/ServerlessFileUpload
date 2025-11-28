// Configuration - Update this with your API Gateway URL after deployment
const API_BASE_URL = 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const filesList = document.getElementById('filesList');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    loadFiles();
    
    // File input change event
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Click to browse
    uploadArea.addEventListener('click', () => fileInput.click());
});

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
}

async function handleFiles(files) {
    for (let file of files) {
        await uploadFile(file);
    }
    loadFiles(); // Refresh the files list
}

async function uploadFile(file) {
    try {
        // Show progress
        uploadProgress.style.display = 'flex';
        updateProgress(0);
        
        // Step 1: Get presigned URL from Lambda
        const presignedResponse = await fetch(`${API_BASE_URL}/generate-presigned-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type,
            }),
        });
        
        if (!presignedResponse.ok) {
            throw new Error('Failed to get upload URL');
        }
        
        const { uploadUrl, fileId } = await presignedResponse.json();
        
        // Step 2: Upload file to S3 using presigned URL
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                updateProgress(percentComplete);
            }
        });
        
        await new Promise((resolve, reject) => {
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve();
                    } else {
                        reject(new Error('Upload failed'));
                    }
                }
            };
            
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type);
            xhr.send(file);
        });
        
        updateProgress(100);
        
        // Hide progress after a delay
        setTimeout(() => {
            uploadProgress.style.display = 'none';
        }, 1000);
        
        console.log('File uploaded successfully:', fileId);
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
        uploadProgress.style.display = 'none';
    }
}

function updateProgress(percent) {
    progressFill.style.width = percent + '%';
    progressText.textContent = Math.round(percent) + '%';
}

async function loadFiles() {
    try {
        const response = await fetch(`${API_BASE_URL}/files`);
        if (!response.ok) {
            throw new Error('Failed to fetch files');
        }
        
        const files = await response.json();
        displayFiles(files);
    } catch (error) {
        console.error('Error loading files:', error);
        filesList.innerHTML = '<div class="empty-state">Error loading files</div>';
    }
}

function displayFiles(files) {
    if (files.length === 0) {
        filesList.innerHTML = `
            <div class="empty-state">
                <span>📁</span>
                <p>No files uploaded yet</p>
            </div>
        `;
        return;
    }
    
    filesList.innerHTML = files.map(file => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-name">${file.fileName}</div>
                <div class="file-meta">
                    Type: ${file.fileType} | 
                    Uploaded: ${new Date(file.uploadDate).toLocaleDateString()} |
                    Status: ${file.status}
                </div>
            </div>
            <div class="file-actions">
                <button class="download-btn" onclick="downloadFile('${file.fileId}')">
                    Download
                </button>
                <button class="delete-btn" onclick="deleteFile('${file.fileId}')">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function downloadFile(fileId) {
    try {
        const response = await fetch(`${API_BASE_URL}/files/${fileId}`);
        if (!response.ok) {
            throw new Error('Failed to get download URL');
        }
        
        const fileData = await response.json();
        
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = fileData.downloadUrl;
        link.download = fileData.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed: ' + error.message);
    }
}

async function deleteFile(fileId) {
    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete file');
        }
        
        loadFiles(); // Refresh the list
        console.log('File deleted successfully');
        
    } catch (error) {
        console.error('Delete error:', error);
        alert('Delete failed: ' + error.message);
    }
}
