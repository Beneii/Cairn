import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { AuthService } from '../services/auth';

export default function Index() {
    const [loading, setLoading] = useState(true);
    const [paired, setPaired] = useState(false);

    useEffect(() => {
        AuthService.getPairingConfig().then(config => {
            setPaired(!!config);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-black">
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    if (paired) {
        return <Redirect href="/chat" />;
    }

    return <Redirect href="/scan" />;
}
