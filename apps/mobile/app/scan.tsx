import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { AuthService } from '../services/auth';
import { useWebSocket } from '../context/WebSocketContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/Colors';

export default function ScanScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const { connect } = useWebSocket();
    const [scanned, setScanned] = useState(false);

    if (!permission) {
        return <View className="flex-1" style={{ backgroundColor: colors.bg }} />;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView className="flex-1 justify-center items-center p-8" style={{ backgroundColor: colors.bg }}>
                <View className="mb-12 items-center">
                    <Text style={{ color: colors.fg }} className="text-3xl font-bold tracking-tighter uppercase mb-4">Camera Access</Text>
                    <Text style={{ color: colors.fgMuted }} className="text-center text-base leading-6 font-medium">
                        Cairn requires camera access to pair with your local environment.
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={requestPermission}
                    className="bg-white px-10 py-4 rounded-2xl active:opacity-80 shadow-2xl"
                >
                    <Text style={{ color: colors.bg }} className="font-bold text-sm uppercase tracking-widest">Grant Permission</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);

        try {
            const config = JSON.parse(data);
            if (config.secret && config.url) {
                await AuthService.savePairingConfig({ secret: config.secret, url: config.url });
                connect({ secret: config.secret, url: config.url });
                router.replace('/chat');
            } else {
                alert('Invalid QR Code');
                setScanned(false);
            }
        } catch (e) {
            alert('Invalid QR Code');
            setScanned(false);
        }
    };

    return (
        <View className="flex-1 bg-black">
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />

            {/* Minimal solid focus frame */}
            <View style={StyleSheet.absoluteFillObject} className="items-center justify-center">
                <View className="w-72 h-72 border border-white/30 rounded-[32px]" />
                <View className="absolute inset-0 border-[40px] border-black/40" />
            </View>

            <SafeAreaView className="flex-1 justify-between p-8">
                <View className="items-center">
                    <View className="px-5 py-2 rounded-full" style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong }}>
                        <Text style={{ color: colors.fg }} className="font-bold text-[10px] uppercase tracking-[3px]">Pairing Mode</Text>
                    </View>
                </View>

                <View className="items-center mb-4">
                    <View className="w-full px-8 py-8 rounded-[24px]" style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong }}>
                        <Text style={{ color: colors.fg }} className="text-center font-bold text-2xl tracking-tighter uppercase mb-2">Cairn Dashboard</Text>
                        <Text style={{ color: colors.fgMuted }} className="text-center text-[10px] font-bold uppercase tracking-[2px]">
                            Settings {'->'} Integrations {'->'} Mobile
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
}
