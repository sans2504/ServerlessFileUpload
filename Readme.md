# Serverless File Upload Pipeline

A complete serverless file upload solution using AWS Lambda, S3, and DynamoDB.

## Architecture
- **Frontend**: HTML/CSS/JavaScript upload interface
- **Backend**: AWS Lambda functions with API Gateway
- **Storage**: Amazon S3 for file storage
- **Database**: DynamoDB for file metadata

## Features
- Secure file uploads using S3 presigned URLs
- File metadata storage in DynamoDB
- Drag & drop file upload interface
- File download and delete functionality
- Progress tracking for uploads

## Deployment

### Prerequisites
- AWS Account
- Node.js 18+
- Serverless Framework

### Backend Deployment
1. Navigate to backend directory:
   ```bash
   cd backend
