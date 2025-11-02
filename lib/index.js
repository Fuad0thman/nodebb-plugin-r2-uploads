'use strict';

const fs = require('fs');
const path = require('path');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const winston = require.main.require('winston');
const utils = require.main.require('./src/utils');

let cachedClient = null;
let cachedConfig = null;
let cachedClientKey = null;

async function init(/* params */) {
	winston.info('[nodebb-plugin-r2-uploads] Ready (using environment-based configuration)');
}

function getConfig() {
	const bucket = process.env.R2_BUCKET || process.env.S3_UPLOADS_BUCKET || process.env.AWS_S3_BUCKET;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
	const endpoint = process.env.R2_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_ENDPOINT;
	const region = process.env.R2_REGION || process.env.AWS_REGION || process.env.S3_ENDPOINT_REGION || 'auto';
	const pathPrefix = (process.env.R2_UPLOADS_PATH || process.env.S3_UPLOADS_PATH || 'files/').replace(/^\/+/, '').replace(/\/+$/, '');
	const cdnHost = process.env.R2_PUBLIC_BASE || process.env.CDN_HOST || '';
	const forcePathStyle = [/true/i, /1/].some((re) => re.test(process.env.R2_FORCE_PATH_STYLE || process.env.AWS_S3_FORCE_PATH_STYLE || '')) ||
		(endpoint ? endpoint.includes('r2.cloudflarestorage.com') : false);

	if (!bucket) {
		throw loggedError('Missing bucket configuration. Set S3_UPLOADS_BUCKET or R2_BUCKET.');
	}
	if (!accessKeyId || !secretAccessKey) {
		throw loggedError('Missing access key configuration. Set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or R2_* equivalents).');
	}

	let formattedEndpoint = endpoint;
	if (formattedEndpoint && !/^https?:\/\//i.test(formattedEndpoint)) {
		formattedEndpoint = `https://${formattedEndpoint}`;
	}

	return {
		bucket,
		accessKeyId,
		secretAccessKey,
		endpoint: formattedEndpoint || '',
		region,
		pathPrefix,
		cdnHost,
		forcePathStyle,
	};
}

function ensureClient() {
	const config = getConfig();
	const clientKey = JSON.stringify({
		bucket: config.bucket,
		endpoint: config.endpoint,
		region: config.region,
		forcePathStyle: config.forcePathStyle,
	});

	if (!cachedClient || clientKey !== cachedClientKey) {
		const clientConfig = {
			region: config.region && config.region !== 'auto' ? config.region : 'us-east-1',
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		};

		if (config.endpoint) {
			clientConfig.endpoint = config.endpoint;
		}

		if (config.forcePathStyle) {
			clientConfig.forcePathStyle = true;
		}

		cachedClient = new S3Client(clientConfig);
		cachedClientKey = clientKey;
		cachedConfig = config;
	}

	return { client: cachedClient, config: cachedConfig };
}

async function uploadFile(data) {
	if (!data || !data.file) {
		return data;
	}

	const { client, config } = ensureClient();
	const objectKey = buildObjectKey(config, data.folder, data.uid, data.file.name);

	await uploadToR2(client, config, data.file.path, data.file.type, objectKey);
	setFileUrl(data.file, config, objectKey);
	return {
		url: data.file.url,
		name: data.file.name,
		path: data.file.path,
	};
}

async function uploadImage(data) {
	if (!data || !data.image) {
		return data;
	}

	const { client, config } = ensureClient();
	const objectKey = buildObjectKey(config, data.folder, data.uid, data.image.name);

	await uploadToR2(client, config, data.image.path, data.image.type, objectKey);
	setFileUrl(data.image, config, objectKey);
	return {
		url: data.image.url,
		name: data.image.name,
		path: data.image.path,
	};
}

async function uploadToR2(client, config, tmpPath, contentType, objectKey) {
	try {
		const upload = new Upload({
			client,
			params: {
				Bucket: config.bucket,
				Key: objectKey,
				Body: fs.createReadStream(tmpPath),
				ContentType: contentType || 'application/octet-stream',
			},
		});

		await upload.done();
	} catch (err) {
		loggedError(`Upload error: ${err.message || err}`);
		throw err;
	}
}

function buildObjectKey(config, folder, uid, originalName) {
	const extension = path.extname(originalName || '').toLowerCase();
	const uuid = utils.generateUUID();
	const safeUid = typeof uid === 'number' ? String(uid) : (uid || '0');
	const cleanFolder = typeof folder === 'string' ? folder.replace(/^\/+|\/+$/g, '') : '';
	const prefixSegments = [];

	if (config.pathPrefix) {
		config.pathPrefix.split('/').filter(Boolean).forEach((segment) => prefixSegments.push(segment));
	}

	if (cleanFolder && cleanFolder !== config.pathPrefix) {
		prefixSegments.push(cleanFolder);
	}

	prefixSegments.push(safeUid);
	const fileName = extension ? `${uuid}${extension}` : uuid;
	prefixSegments.push(fileName);

	return prefixSegments.filter(Boolean).join('/');
}

function setFileUrl(target, config, objectKey) {
	const url = buildPublicUrl(config, objectKey);
	target.url = url;
	target.path = objectKey;
	target.name = path.basename(objectKey);
}

function buildPublicUrl(config, objectKey) {
	const normalizedKey = objectKey.replace(/^\/+/, '');
	if (config.cdnHost) {
		const base = config.cdnHost.startsWith('http') ? config.cdnHost : `https://${config.cdnHost}`;
		return `${base.replace(/\/+$/, '')}/${normalizedKey}`;
	}

	if (config.endpoint) {
		try {
			const endpointUrl = new URL(config.endpoint);
			if (config.forcePathStyle) {
				return `${endpointUrl.origin.replace(/\/+$/, '')}/${config.bucket}/${normalizedKey}`;
			}
			return `${endpointUrl.protocol}//${config.bucket}.${endpointUrl.hostname.replace(/\/+$/, '')}/${normalizedKey}`;
		} catch (err) {
			winston.warn(`[nodebb-plugin-r2-uploads] Could not parse endpoint "${config.endpoint}": ${err.message || err}`);
		}
	}

	return `https://${config.bucket}.s3.amazonaws.com/${normalizedKey}`;
}

function loggedError(message) {
	winston.error(`[nodebb-plugin-r2-uploads] ${message}`);
	return new Error(message);
}

module.exports = {
	init,
	uploadFile,
	uploadImage,
};
