import { Crypto } from './crypto.js';
import { Storage } from './storage.js';

export const PlatformAccount = {
    /**
     * Create or get a platform account
     * @param {string} username - Display name/handle
     * @param {string} platform - Platform identifier (e.g., 'nytimes.com', 'youtube', 'twitter')
     * @param {string|null} profileUrl - URL to user's profile if available
     * @param {string|null} avatarUrl - URL to user's avatar if available
     * @returns {object} Platform account object
     */
    getOrCreate: async (username, platform, profileUrl = null, avatarUrl = null) => {
        const accounts = await Storage.platformAccounts.getAll();
        
        // Look for existing account by username + platform
        const existingKey = Object.keys(accounts).find(k => 
            accounts[k].username === username && accounts[k].platform === platform
        );
        
        if (existingKey) {
            // Update last seen
            accounts[existingKey].lastSeen = Date.now();
            if (profileUrl && !accounts[existingKey].profileUrl) accounts[existingKey].profileUrl = profileUrl;
            if (avatarUrl && !accounts[existingKey].avatarUrl) accounts[existingKey].avatarUrl = avatarUrl;
            await Storage.platformAccounts.save(accounts[existingKey]);
            return accounts[existingKey];
        }
        
        // Create new platform account with keypair
        const privkey = Crypto.generatePrivateKey();
        const pubkey = Crypto.getPublicKey(privkey);
        const id = 'pacct_' + await Crypto.sha256(platform + ':' + username);
        
        const account = {
            id,
            username,
            platform,
            profileUrl,
            avatarUrl,
            keypair: {
                pubkey,
                privkey,
                npub: Crypto.hexToNpub(pubkey),
                nsec: Crypto.hexToNsec(privkey)
            },
            linkedEntityId: null,  // Can be linked to a Person entity later
            commentCount: 0,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            metadata: {}
        };
        
        await Storage.platformAccounts.save(account);
        return account;
    },
    
    /**
     * Link a platform account to a Person entity
     */
    linkToEntity: async (accountId, entityId) => {
        const accounts = await Storage.platformAccounts.getAll();
        if (accounts[accountId]) {
            accounts[accountId].linkedEntityId = entityId;
            await Storage.platformAccounts.saveAll(accounts);
        }
    },
    
    /**
     * Get all accounts for a platform
     */
    getForPlatform: async (platform) => {
        const accounts = await Storage.platformAccounts.getAll();
        return Object.values(accounts).filter(a => a.platform === platform);
    },
    
    /**
     * Get account by ID
     */
    get: async (accountId) => {
        const accounts = await Storage.platformAccounts.getAll();
        return accounts[accountId] || null;
    }
};
