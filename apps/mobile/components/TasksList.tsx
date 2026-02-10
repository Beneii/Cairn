import { View, Text, TouchableOpacity, TextInput, FlatList, Keyboard } from 'react-native';
import { useState } from 'react';
import { colors } from '../constants/Colors';
import type { Task } from '../context/WebSocketContext';

interface TasksListProps {
    tasks: Task[];
    onComplete: (id: string) => void;
    onCreate: (title: string) => void;
    onDelete: (id: string) => void;
}

export function TasksList({ tasks, onComplete, onCreate, onDelete }: TasksListProps) {
    const [newTask, setNewTask] = useState('');

    const todoTasks = tasks.filter(t => t.status === 'todo');
    const doneTasks = tasks.filter(t => t.status === 'done').slice(0, 10);

    const handleCreate = () => {
        const trimmed = newTask.trim();
        if (trimmed) {
            onCreate(trimmed);
            setNewTask('');
            Keyboard.dismiss();
        }
    };

    return (
        <View className="flex-1">
            <FlatList
                data={[
                    { type: 'input' as const },
                    ...todoTasks.map(t => ({ type: 'todo' as const, task: t })),
                    ...(doneTasks.length > 0 ? [{ type: 'divider' as const }] : []),
                    ...doneTasks.map(t => ({ type: 'done' as const, task: t })),
                ]}
                keyExtractor={(item, i) => {
                    if (item.type === 'input') return 'input';
                    if (item.type === 'divider') return 'divider';
                    return (item as any).task.id;
                }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 0 }}
                renderItem={({ item }) => {
                    if (item.type === 'input') {
                        return (
                            <View
                                className="flex-row items-center rounded-xl px-4 py-1 mb-6"
                                style={{ backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border }}
                            >
                                <TextInput
                                    className="flex-1 py-3 text-[15px]"
                                    style={{ color: colors.fg }}
                                    placeholder="Add a task..."
                                    placeholderTextColor={colors.fgSubtle}
                                    value={newTask}
                                    onChangeText={setNewTask}
                                    onSubmitEditing={handleCreate}
                                    returnKeyType="done"
                                />
                                {newTask.trim() ? (
                                    <TouchableOpacity onPress={handleCreate} className="ml-2 px-3 py-1.5 rounded-lg bg-white">
                                        <Text className="text-[10px] font-bold uppercase tracking-widest text-black">Add</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        );
                    }

                    if (item.type === 'divider') {
                        return (
                            <View className="flex-row items-center gap-3 mt-6 mb-3 px-1">
                                <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
                                <Text className="text-[9px] font-bold uppercase tracking-[2px]" style={{ color: colors.fgMuted }}>
                                    Done
                                </Text>
                                <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
                            </View>
                        );
                    }

                    const task = (item as any).task as Task;
                    const isDone = item.type === 'done';

                    return (
                        <TouchableOpacity
                            onPress={() => !isDone && onComplete(task.id)}
                            onLongPress={() => onDelete(task.id)}
                            activeOpacity={0.7}
                            className="flex-row items-center gap-3 py-3.5 px-1"
                            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                        >
                            {/* Checkbox circle */}
                            <View
                                className="w-5 h-5 rounded-full items-center justify-center"
                                style={{
                                    borderWidth: isDone ? 0 : 1.5,
                                    borderColor: isDone ? 'transparent' : colors.fgSubtle,
                                    backgroundColor: isDone ? colors.fgSubtle : 'transparent',
                                }}
                            >
                                {isDone && (
                                    <Text className="text-[10px]" style={{ color: colors.bg }}>✓</Text>
                                )}
                            </View>

                            <View className="flex-1">
                                <Text
                                    className="text-[15px]"
                                    style={{
                                        color: isDone ? colors.fgMuted : colors.fg,
                                        textDecorationLine: isDone ? 'line-through' : 'none',
                                    }}
                                >
                                    {task.title}
                                </Text>
                                {(task.due_date || task.suggested_by_agent) && (
                                    <View className="flex-row items-center gap-2 mt-1">
                                        {task.due_date && (
                                            <Text className="text-[10px]" style={{ color: colors.fgMuted }}>
                                                Due {task.due_date}
                                            </Text>
                                        )}
                                        {task.suggested_by_agent && (
                                            <Text className="text-[10px]" style={{ color: colors.fgSubtle }}>
                                                ✦ Cairn
                                            </Text>
                                        )}
                                    </View>
                                )}
                            </View>

                            {task.type === 'recurring' && (
                                <Text className="text-[10px]" style={{ color: colors.fgMuted }}>↻</Text>
                            )}
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View className="items-center py-16">
                        <Text className="text-[10px] uppercase tracking-[2px]" style={{ color: colors.fgSubtle }}>
                            No tasks yet
                        </Text>
                    </View>
                }
            />
        </View>
    );
}
