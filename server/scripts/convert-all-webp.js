import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import sharp from "sharp";
import {
    Article,
    Ad,
    Gallery,
    User,
    Wanted,
    ArticleRevision
} from "../models.js";

const uploadsDir = path.resolve(process.cwd(), "server/uploads");

async function initMongo() {
    if (mongoose.connection.readyState !== 0) return;
    let mongoURI = process.env.MONGODB_URI;
    if (!mongoURI || /YOUR_PASSWORD|xxxxx|user:password/i.test(mongoURI)) {
        mongoURI = 'mongodb://127.0.0.1:27017/zemun-news';
        console.log("No remote MONGODB_URI -> Using local fallback", mongoURI);
    }
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 3000 });
    console.log("Connected to MongoDB -> Starting image migration to WebP...");
}

async function convertFileToWebP(oldFileName) {
    try {
        const oldPath = path.join(uploadsDir, oldFileName);

        // Check if the file actually exists on disk before trying to convert
        try {
            await fs.access(oldPath, fs.constants.R_OK);
        } catch (err) {
            return null;
        }

        const { name } = path.parse(oldFileName);
        const newFileName = `${name}.webp`;
        const newPath = path.join(uploadsDir, newFileName);

        // Convert
        await sharp(oldPath)
            .rotate()
            .webp({ quality: 82, effort: 4 })
            .toFile(newPath);

        // Remove old file
        await fs.unlink(oldPath);
        return newFileName;

    } catch (error) {
        console.error(`Error converting ${oldFileName}:`, error.message);
        return null;
    }
}

async function run() {
    await initMongo();

    const entries = await fs.readdir(uploadsDir, { withFileTypes: true });
    const convertable = entries.filter((e) => {
        if (!e.isFile()) return false;
        if (e.name.startsWith("_")) return false; // skip internal prefix dirs/files just in case
        const ext = path.extname(e.name).toLowerCase();
        return ext === ".jpg" || ext === ".jpeg" || ext === ".png";
    });

    console.log(`Found ${convertable.length} legacy images in 'uploads/' to convert.`);

    const oldToNewMap = new Map();

    for (const entry of convertable) {
        const newName = await convertFileToWebP(entry.name);
        if (newName) {
            // We'll replace occurrences of `/uploads/old.jpg` with `/uploads/new.webp`
            oldToNewMap.set(`/uploads/${entry.name}`, `/uploads/${newName}`);
        }
    }

    console.log(`Converted ${oldToNewMap.size} images to WebP. Now updating MongoDB URLs...`);

    let updatedCount = 0;

    if (oldToNewMap.size === 0) {
        console.log("No images to convert. Exiting.");
        process.exit(0);
    }

    // Articles
    const articles = await Article.find({});
    for (const doc of articles) {
        let changed = false;
        if (doc.image && oldToNewMap.has(doc.image)) {
            doc.image = oldToNewMap.get(doc.image);
            changed = true;
        }
        // Also we need to check inside article.content for hardcoded html src='/uploads/...jpg'
        // A quick hacky replace:
        if (doc.content) {
            for (const [oldUrl, newUrl] of oldToNewMap.entries()) {
                if (doc.content.includes(oldUrl)) {
                    doc.content = doc.content.split(oldUrl).join(newUrl);
                    changed = true;
                }
            }
        }
        if (changed) {
            await doc.save();
            updatedCount++;
        }
    }

    // Ads
    const ads = await Ad.find({});
    for (const doc of ads) {
        if (doc.image && oldToNewMap.has(doc.image)) {
            doc.image = oldToNewMap.get(doc.image);
            await doc.save();
            updatedCount++;
        }
    }

    // Gallery
    const galleries = await Gallery.find({});
    for (const doc of galleries) {
        if (doc.image && oldToNewMap.has(doc.image)) {
            doc.image = oldToNewMap.get(doc.image);
            await doc.save();
            updatedCount++;
        }
    }

    // Users
    const users = await User.find({});
    for (const doc of users) {
        if (doc.avatar && oldToNewMap.has(doc.avatar)) {
            doc.avatar = oldToNewMap.get(doc.avatar);
            await doc.save();
            updatedCount++;
        }
    }

    // Wanted
    const wanteds = await Wanted.find({});
    for (const doc of wanteds) {
        if (doc.image && oldToNewMap.has(doc.image)) {
            doc.image = oldToNewMap.get(doc.image);
            await doc.save();
            updatedCount++;
        }
    }

    console.log(`Successfully updated ${updatedCount} MongoDB documents.`);
    console.log(`Next step: Optional - run \`npm run images:backfill\` to ensure pipeline metadata is clean.`);

    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
