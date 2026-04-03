/**
 * SkyHeal AI — Local Data Store
 * IndexedDB-based storage for measurement history and user profile
 */

class LocalStore {
    constructor() {
        this.dbName = 'SkyHealAI';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('measurements')) {
                    const store = db.createObjectStore('measurements', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('profile')) {
                    db.createObjectStore('profile', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // ─── Measurements ───

    async saveMeasurement(data) {
        const record = {
            ...data,
            timestamp: Date.now(),
            date: new Date().toISOString()
        };

        return this._put('measurements', record);
    }

    async getMeasurements(limit = 50) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('measurements', 'readonly');
            const store = tx.objectStore('measurements');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            
            const results = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getRecentMeasurements(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const all = await this.getMeasurements(100);
        return all.filter(m => m.timestamp >= cutoff);
    }

    // ─── Profile ───

    async saveProfile(profile) {
        return this._put('profile', { id: 'userProfile', ...profile });
    }

    async getProfile() {
        return this._get('profile', 'userProfile');
    }

    // ─── Settings ───

    async saveSettings(settings) {
        return this._put('settings', { id: 'appSettings', ...settings });
    }

    async getSettings() {
        const result = await this._get('settings', 'appSettings');
        return result || {
            strictMode: false,
            coaching: true,
            eqiDisplay: false,
            bpMode: 'detailed',
            wellnessWindow: 7
        };
    }

    // ─── Clear ───

    async clearAll() {
        const tx = this.db.transaction(['measurements', 'profile', 'settings'], 'readwrite');
        tx.objectStore('measurements').clear();
        tx.objectStore('profile').clear();
        tx.objectStore('settings').clear();
        return new Promise((resolve) => { tx.oncomplete = resolve; });
    }

    // ─── Export ───

    async exportData() {
        const measurements = await this.getMeasurements(1000);
        const profile = await this.getProfile();
        return JSON.stringify({ measurements, profile, exportDate: new Date().toISOString() }, null, 2);
    }

    // ─── Helpers ───

    _put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

window.LocalStore = LocalStore;
