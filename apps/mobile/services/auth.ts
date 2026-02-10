import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PAIRING_CONFIG = 'cairn_pairing_config';

export interface PairingConfig {
    secret: string;
    url: string;
}

export const AuthService = {
    getPairingConfig: async (): Promise<PairingConfig | null> => {
        try {
            const json = await AsyncStorage.getItem(KEY_PAIRING_CONFIG);
            return json ? JSON.parse(json) : null;
        } catch (e) {
            console.error('Failed to load pairing config', e);
            return null;
        }
    },

    savePairingConfig: async (config: PairingConfig): Promise<void> => {
        try {
            await AsyncStorage.setItem(KEY_PAIRING_CONFIG, JSON.stringify(config));
        } catch (e) {
            console.error('Failed to save pairing config', e);
        }
    },

    clearPairingConfig: async (): Promise<void> => {
        try {
            await AsyncStorage.removeItem(KEY_PAIRING_CONFIG);
        } catch (e) {
            console.error('Failed to clear pairing config', e);
        }
    },
};
