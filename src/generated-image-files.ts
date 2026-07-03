import fs from 'fs';
import path from 'path';
import { ImageConcept } from './types';

export const GENERATED_IMAGE_MANIFEST_FILENAME = 'generated-image-ad-variations.json';
export const GENERATED_IMAGE_ASSETS_DIRNAME = 'generated-image-assets';
export const GENERATED_IMAGE_ASSETS_ROUTE = '/generated-image-assets';

export interface GeneratedImageSourceAd {
    id: string;
    name: string;
    creativeName?: string;
    headline?: string;
    adCopy?: string;
    imageUrl?: string;
    integrationId?: string;
    status?: string;
    startDate?: string;
    endDate?: string | null;
    metrics?: Record<string, number>;
}

export interface GeneratedImageRun {
    id: string;
    createdAt: string;
    completedAt?: string;
    status: 'running' | 'completed' | 'completed_with_errors' | 'failed';
    requestedCount: number;
    generatedCount: number;
    conceptsPerSource: number;
    integrationId: string;
    selectionStrategy: string;
    sourceAds: GeneratedImageSourceAd[];
    errors: Array<{
        sourceAdId?: string;
        message: string;
    }>;
}

export interface GeneratedImageFileRecord {
    id: string;
    runId: string;
    kind: 'image_ad_variation';
    status: 'done' | 'failed';
    createdAt: string;
    itemId: string;
    itemName: string;
    sourceAd: GeneratedImageSourceAd;
    conceptIndex: number;
    imageUrl: string;
    generatedImageUrl: string;
    originalGeneratedImageUrl?: string;
    localPath?: string;
    isLocal?: boolean;
    concept: ImageConcept;
    generation: {
        model?: string;
        request?: any;
        response?: any;
        providerImage?: any;
        error?: string;
    };
}

export interface GeneratedImageManifest {
    version: 1;
    updatedAt: string | null;
    images: GeneratedImageFileRecord[];
    runs: GeneratedImageRun[];
}

const emptyManifest = (): GeneratedImageManifest => ({
    version: 1,
    updatedAt: null,
    images: [],
    runs: []
});

export const getGeneratedImageManifestPath = (dataDir: string) =>
    path.join(dataDir, GENERATED_IMAGE_MANIFEST_FILENAME);

export const getGeneratedImageAssetsDir = (dataDir: string) =>
    path.join(dataDir, GENERATED_IMAGE_ASSETS_DIRNAME);

export async function readGeneratedImageManifest(dataDir: string): Promise<GeneratedImageManifest> {
    const manifestPath = getGeneratedImageManifestPath(dataDir);

    try {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
            ...emptyManifest(),
            ...parsed,
            images: Array.isArray(parsed.images) ? parsed.images : [],
            runs: Array.isArray(parsed.runs) ? parsed.runs : []
        };
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return emptyManifest();
        }
        throw error;
    }
}

export async function writeGeneratedImageManifest(dataDir: string, manifest: GeneratedImageManifest): Promise<void> {
    await fs.promises.mkdir(dataDir, { recursive: true });
    await fs.promises.writeFile(
        getGeneratedImageManifestPath(dataDir),
        JSON.stringify({ ...manifest, updatedAt: new Date().toISOString() }, null, 4),
        'utf-8'
    );
}

export function isRemoteImageUrl(imageUrl: string): boolean {
    return /^https?:\/\//i.test(imageUrl);
}

function extensionFromMimeType(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
        case 'image/jpeg':
        case 'image/jpg':
            return 'jpg';
        case 'image/webp':
            return 'webp';
        case 'image/gif':
            return 'gif';
        case 'image/png':
        default:
            return 'png';
    }
}

export async function persistGeneratedImagePayload(
    dataDir: string,
    fileId: string,
    imageUrl: string
): Promise<{
    imageUrl: string;
    originalImageUrl?: string;
    localPath?: string;
    isLocal: boolean;
}> {
    if (!imageUrl || isRemoteImageUrl(imageUrl)) {
        return {
            imageUrl,
            originalImageUrl: imageUrl,
            isLocal: false
        };
    }

    const dataUrlMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!dataUrlMatch) {
        return {
            imageUrl,
            originalImageUrl: imageUrl,
            isLocal: false
        };
    }

    const [, mimeType, base64Payload] = dataUrlMatch;
    const extension = extensionFromMimeType(mimeType);
    const safeFileId = fileId.replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = `${safeFileId}.${extension}`;
    const assetsDir = getGeneratedImageAssetsDir(dataDir);
    const absolutePath = path.join(assetsDir, fileName);

    await fs.promises.mkdir(assetsDir, { recursive: true });
    await fs.promises.writeFile(absolutePath, Buffer.from(base64Payload, 'base64'));

    return {
        imageUrl: `${GENERATED_IMAGE_ASSETS_ROUTE}/${fileName}`,
        originalImageUrl: imageUrl,
        localPath: path.relative(process.cwd(), absolutePath),
        isLocal: true
    };
}
