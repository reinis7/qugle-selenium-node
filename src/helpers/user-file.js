import path from 'path'
import fs from 'fs/promises'
import { USERS_LOG_DIR } from "./utils.js";

// Helper function to get file creation time
const getFileCreatedTime = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return stats.birthtime || stats.ctime;
    } catch (error) {
        console.error(`Error getting file stats for ${filePath}:`, error);
        return new Date();
    }
};

// Helper function to get file size in readable format
const getFileSize = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        const bytes = stats.size;
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
        console.error(`Error getting file size for ${filePath}:`, error);
        return 'Unknown';
    }
};

// Helper function to get image dimensions (for images only)


// Helper function to read directory contents
export const readUserDirectory = async (userId) => {
    const userLogsPath = path.join(USERS_LOG_DIR, 'users', `user_log_${userId}`);

    try {
        // Check if user directory exists
        console.log('[start]', userLogsPath)
        await fs.access(userLogsPath);

        const result = {
            files: [],
            images: [],
            loginInfo: null,
            exists: true
        };
        console.log('[start2]', userLogsPath)
        // Read user info
        try {
            const userLoginInfo = path.join(userLogsPath, 'log.txt');
            const userInfoData = await fs.readFile(userLoginInfo, 'utf8');
            result.loginInfo = userInfoData;
        } catch (error) {
            console.log(`No user-info.json found for user ${userId}`);
        }

        // Read files directory
        const filesPath = path.join(userLogsPath, 'shots');
        try {
            await fs.access(filesPath);
            const fileItems = await fs.readdir(filesPath);

            for (const fileName of fileItems) {
                const filePath = path.join(filesPath, fileName);
                const stats = await fs.stat(filePath);

                if (stats.isFile()) {
                    result.files.push({
                        name: fileName,
                        path: filePath,
                        size: await getFileSize(filePath),
                        type: path.extname(fileName).toUpperCase().replace('.', '') || 'File',
                        uploaded: await getFileCreatedTime(filePath),
                        fullPath: `/logs/users/user_log_${userId}/shots/${fileName}`
                    });
                }
            }

            // Sort files by creation date (newest first)
            result.files.sort((a, b) => b.uploaded - a.uploaded);
        } catch (error) {
            console.log(`No files directory found for user ${userId}`);
        }

        // Read images directory
        // const imagesPath = path.join(userLogsPath, 'images');
        // try {
        //     await fs.access(imagesPath);
        //     const imageItems = await fs.readdir(imagesPath);

        //     for (const imageName of imageItems) {
        //         const imagePath = path.join(imagesPath, imageName);
        //         const stats = await fs.stat(imagePath);

        //         if (stats.isFile()) {
        //             const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        //             const ext = path.extname(imageName).toLowerCase();

        //             if (imageExtensions.includes(ext)) {
        //                 result.images.push({
        //                     name: imageName,
        //                     path: imagePath,
        //                     size: await getFileSize(imagePath),
        //                     dimensions: await getImageDimensions(imagePath),
        //                     uploaded: await getFileCreatedTime(imagePath),
        //                     fullPath: `/logs/${userId}/images/${imageName}`,
        //                     extension: ext.replace('.', '')
        //                 });
        //             }
        //         }
        //     }

        //     // Sort images by creation date (newest first)
        //     result.images.sort((a, b) => b.uploaded - a.uploaded);
        // } catch (error) {
        //     console.log(`No images directory found for user ${userId}`);
        // }

        return result;
    } catch (error) {
        console.error(error)
        console.log(`User directory not found: ${userLogsPath}`);
        return {
            files: [],
            images: [],
            userInfo: null,
            exists: false
        };
    }
};
