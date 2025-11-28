const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const BUCKET_NAME = process.env.BUCKET_NAME || `serverless-file-upload-uploads-${process.env.AWS_ACCOUNT_ID}`;
const TABLE_NAME = process.env.FILES_TABLE;

exports.generatePresignedUrl = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { fileName, fileType } = body;
    
    if (!fileName || !fileType) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'fileName and fileType are required' }),
      };
    }

    const fileId = uuidv4();
    const key = `uploads/${fileId}-${fileName}`;

    // Generate presigned URL for S3 upload
    const presignedUrl = await s3.getSignedUrlPromise('putObject', {
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      Expires: 300, // 5 minutes
    });

    // Store file metadata in DynamoDB
    const fileMetadata = {
      fileId,
      fileName,
      fileType,
      s3Key: key,
      uploadDate: new Date().toISOString(),
      fileSize: 0, // Will be updated after upload
      status: 'uploading',
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: fileMetadata,
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        fileId,
        key,
      }),
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

exports.getFiles = async (event) => {
  try {
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error('Error fetching files:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

exports.getFile = async (event) => {
  try {
    const { id } = event.pathParameters;

    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { fileId: id },
    }).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'File not found' }),
      };
    }

    // Generate presigned URL for file download
    const downloadUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: BUCKET_NAME,
      Key: result.Item.s3Key,
      Expires: 300, // 5 minutes
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        ...result.Item,
        downloadUrl,
      }),
    };
  } catch (error) {
    console.error('Error fetching file:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

exports.deleteFile = async (event) => {
  try {
    const { id } = event.pathParameters;

    // Get file metadata first
    const fileData = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { fileId: id },
    }).promise();

    if (!fileData.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'File not found' }),
      };
    }

    // Delete from S3
    await s3.deleteObject({
      Bucket: BUCKET_NAME,
      Key: fileData.Item.s3Key,
    }).promise();

    // Delete from DynamoDB
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { fileId: id },
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'File deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
