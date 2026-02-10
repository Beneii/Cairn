import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useWebSocket } from '../context/WebSocketContext';
import { useState, useRef, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { AuthService } from '../services/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clsx } from 'clsx';
import { colors } from '../constants/Colors';
import { TasksList } from '../components/TasksList';

type Tab = 'chat' | 'tasks';

export default function ChatScreen() {
    const { connected, messages, tasks, sendMessage, completeTask, createTask, deleteTask, disconnect } = useWebSocket();
    const [text, setText] = useState('');
    const [activeTab, setActiveTab] = useState<Tab>('chat');
    const flatListRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    const handleSend = () => {
        const trimmed = text.trim();
        if (trimmed) {
            sendMessage(trimmed);
            setText('');
        }
    };

    const handleUnpair = async () => {
        await AuthService.clearPairingConfig();
        disconnect();
        router.replace('/scan');
    }

    // Auto-scroll to bottom
    useEffect(() => {
        if (messages.length > 0 && activeTab === 'chat') {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages, activeTab]);

    return (
        <View className="flex-1" style={{ backgroundColor: colors.bg }}>
            <Stack.Screen options={{
                headerShown: true,
                title: '',
                headerStyle: { backgroundColor: colors.bg },
                headerShadowVisible: false,
                headerLeft: () => (
                    <View className="pl-4">
                        <Text style={{ color: colors.fg }} className="text-xl font-bold tracking-tighter uppercase">Cairn</Text>
                        <Text className="text-[8px] uppercase tracking-[2px] -mt-1" style={{ color: colors.fgMuted }}>
                            {connected ? 'Live Environment' : 'Connecting...'}
                        </Text>
                    </View>
                ),
                headerRight: () => (
                    <TouchableOpacity onPress={handleUnpair} className="pr-4">
                        <Text style={{ color: colors.danger, opacity: 0.8 }} className="text-[10px] font-bold uppercase tracking-widest">Unpair</Text>
                    </TouchableOpacity>
                )
            }} />

            {/* Tab switcher */}
            <View className="flex-row px-5 pt-1 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                {(['chat', 'tasks'] as Tab[]).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className="mr-6 pb-2"
                        style={{
                            borderBottomWidth: activeTab === tab ? 1.5 : 0,
                            borderBottomColor: activeTab === tab ? colors.fg : 'transparent',
                        }}
                    >
                        <Text
                            className="text-[10px] font-bold uppercase tracking-[2px]"
                            style={{ color: activeTab === tab ? colors.fg : colors.fgSubtle }}
                        >
                            {tab}{tab === 'tasks' && tasks.filter(t => t.status === 'todo').length > 0
                                ? ` (${tasks.filter(t => t.status === 'todo').length})`
                                : ''}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeTab === 'chat' ? (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(_, index) => index.toString()}
                        contentContainerStyle={{
                            paddingHorizontal: 20,
                            paddingTop: 24,
                            paddingBottom: 24,
                            gap: 20
                        }}
                        renderItem={({ item }) => {
                            const isUser = item.role === 'user';
                            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                            return (
                                <View className="flex-col gap-1">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-[10px] font-medium" style={{ color: colors.fgSubtle }}>{timestamp}</Text>
                                        <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: colors.fgMuted }}>
                                            {isUser ? 'USER' : 'CAIRN'} {item.source === 'telegram' ? '(Telegram)' : ''}
                                        </Text>
                                    </View>

                                    <View className="px-0 py-1">
                                        <Text className="text-[15px] leading-6 font-normal" style={{ color: colors.fg }}>
                                            {item.content || item.text}
                                        </Text>
                                    </View>

                                    {item.tools && item.tools.length > 0 && (
                                        <View className="mt-1 pl-3" style={{ borderLeftWidth: 1, borderLeftColor: colors.fgSubtle }}>
                                            <Text className="text-[10px] italic font-mono" style={{ color: colors.fgMuted }}>
                                                {item.tools.length} tool outputs hidden
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />

                    <View
                        className="p-4"
                        style={{
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            backgroundColor: colors.bg,
                            paddingBottom: Math.max(insets.bottom, 16),
                        }}
                    >
                        <View
                            className="flex-row items-center rounded-xl px-4 py-1"
                            style={{ backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border }}
                        >
                            <TextInput
                                className="flex-1 text-[15px] py-3"
                                style={{ color: colors.fg }}
                                placeholder="Type to Cairn..."
                                placeholderTextColor={colors.fgSubtle}
                                value={text}
                                onChangeText={setText}
                                onSubmitEditing={handleSend}
                                multiline={false}
                                returnKeyType="send"
                            />
                            <TouchableOpacity
                                onPress={handleSend}
                                disabled={!text.trim()}
                                className={clsx(
                                    "ml-2 px-4 py-2 rounded-lg",
                                    text.trim() ? "bg-white" : "bg-white/5"
                                )}
                            >
                                <Text className={clsx(
                                    "text-[10px] font-bold uppercase tracking-widest",
                                    text.trim() ? "text-black" : "text-white/20"
                                )}>Send</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            ) : (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <TasksList
                        tasks={tasks}
                        onComplete={completeTask}
                        onCreate={createTask}
                        onDelete={deleteTask}
                    />
                </KeyboardAvoidingView>
            )}
        </View>
    );
}
