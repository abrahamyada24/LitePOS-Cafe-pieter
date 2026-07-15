import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useStore } from '../store/useStore';
import OrderNotificationWatcher from './OrderNotificationWatcher';

type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

type DialogButton = {
    text: string;
    style?: DialogButtonStyle;
    onPress?: () => void;
};

type DialogState = {
    title: string;
    message?: string;
    buttons: DialogButton[];
    cancelable: boolean;
    onDismiss?: () => void;
};

const normalizeButtons = (buttons?: DialogButton[]): DialogButton[] => {
    if (!buttons || buttons.length === 0) return [{ text: 'OK' }];
    return buttons.map(button => ({
        text: button.text || 'OK',
        style: button.style || 'default',
        onPress: button.onPress,
    }));
};

const getTone = (dialog: DialogState | null) => {
    const title = (dialog?.title || '').toLowerCase();
    const hasDestructive = dialog?.buttons.some(button => button.style === 'destructive');
    if (hasDestructive || /hapus|reset|restore|retur|keluar/.test(title)) return 'danger';
    if (/gagal|error|ditolak|invalid|salah/.test(title)) return 'danger';
    if (/konfirmasi|peringatan|kurang|trial/.test(title)) return 'warning';
    if (/berhasil|sukses|selesai|tersimpan|tersambung|backup/.test(title)) return 'success';
    return 'info';
};

const toneMap = {
    info: { bg: '#EFF6FF', fg: '#2563EB', icon: 'information-outline' },
    success: { bg: '#ECFDF5', fg: '#16A34A', icon: 'check-circle-outline' },
    warning: { bg: '#FFFBEB', fg: '#D97706', icon: 'alert-outline' },
    danger: { bg: '#FEF2F2', fg: '#DC2626', icon: 'alert-circle-outline' },
};

export default function AppDialogProvider({ children }: { children: ReactNode }) {
    const { width } = useWindowDimensions();
    const settings = useStore(state => state.settings);
    const isDark = settings?.theme === 'dark';
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const dialogRef = useRef<DialogState | null>(null);
    const queueRef = useRef<DialogState[]>([]);
    const fade = useRef(new Animated.Value(0)).current;
    const sheetY = useRef(new Animated.Value(320)).current;
    const modalScale = useRef(new Animated.Value(0.96)).current;
    const originalAlertRef = useRef<any>(null);

    useEffect(() => {
        dialogRef.current = dialog;
    }, [dialog]);

    const presentDialog = useCallback((nextDialog: DialogState) => {
        if (dialogRef.current) {
            queueRef.current.push(nextDialog);
            return;
        }
        setDialog(nextDialog);
    }, []);

    useEffect(() => {
        originalAlertRef.current = (Alert as any).alert;
        (Alert as any).alert = (title: string, message?: string, buttons?: DialogButton[], options?: any) => {
            const normalizedButtons = normalizeButtons(buttons);
            presentDialog({
                title: title || 'Info',
                message,
                buttons: normalizedButtons,
                cancelable: options?.cancelable ?? normalizedButtons.length <= 1,
                onDismiss: options?.onDismiss,
            });
        };

        return () => {
            if (originalAlertRef.current) {
                (Alert as any).alert = originalAlertRef.current;
            }
        };
    }, [presentDialog]);

    useEffect(() => {
        if (!dialog) return;
        fade.setValue(0);
        sheetY.setValue(320);
        modalScale.setValue(0.96);
        Animated.parallel([
            Animated.timing(fade, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(sheetY, {
                toValue: 0,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.spring(modalScale, {
                toValue: 1,
                damping: 18,
                stiffness: 180,
                mass: 0.8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [dialog, fade, modalScale, sheetY]);

    const isDecision = useMemo(() => {
        if (!dialog) return false;
        return dialog.buttons.length > 1 || dialog.buttons.some(button => button.style === 'destructive');
    }, [dialog]);

    const tone = toneMap[getTone(dialog)];
    const cardWidth = Math.min(width - 32, isDecision ? 380 : 520);

    const finishClose = useCallback((button?: DialogButton, dismissed?: boolean) => {
        const currentDialog = dialogRef.current;
        setDialog(null);
        const nextDialog = queueRef.current.shift();
        if (nextDialog) {
            requestAnimationFrame(() => setDialog(nextDialog));
        }
        if (dismissed) currentDialog?.onDismiss?.();
        if (button?.onPress) requestAnimationFrame(button.onPress);
    }, []);

    const closeDialog = useCallback((button?: DialogButton, dismissed?: boolean) => {
        Animated.parallel([
            Animated.timing(fade, {
                toValue: 0,
                duration: 140,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(sheetY, {
                toValue: 320,
                duration: 160,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(modalScale, {
                toValue: 0.96,
                duration: 140,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start(() => finishClose(button, dismissed));
    }, [fade, finishClose, modalScale, sheetY]);

    const dismissDialog = useCallback(() => {
        if (!dialog?.cancelable) return;
        closeDialog(undefined, true);
    }, [closeDialog, dialog?.cancelable]);

    const renderButton = (button: DialogButton, index: number) => {
        const isCancel = button.style === 'cancel';
        const isDestructive = button.style === 'destructive';
        const buttonStyle = [
            styles.button,
            isDecision && dialog!.buttons.length <= 2 ? styles.buttonInline : styles.buttonFull,
            isCancel ? styles.buttonCancel : isDestructive ? styles.buttonDanger : styles.buttonPrimary,
        ];
        const textStyle = [
            styles.buttonText,
            isCancel ? styles.buttonCancelText : styles.buttonPrimaryText,
        ];

        return (
            <TouchableOpacity
                key={`${button.text}-${index}`}
                activeOpacity={0.85}
                style={buttonStyle}
                onPress={() => closeDialog(button)}
            >
                <Text style={textStyle} numberOfLines={1}>{button.text}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <OrderNotificationWatcher />
            {children}
            <Modal
                visible={!!dialog}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={dismissDialog}
            >
                {dialog ? (
                    <View style={[styles.portal, isDecision ? styles.centerContent : styles.bottomContent]}>
                        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
                            <Pressable style={StyleSheet.absoluteFill} onPress={dismissDialog} />
                        </Animated.View>

                        <Animated.View
                            style={[
                                styles.card,
                                isDecision ? styles.modalCard : styles.sheetCard,
                                {
                                    width: cardWidth,
                                    backgroundColor: isDark ? '#111827' : '#FFFFFF',
                                    borderColor: isDark ? '#1F2937' : '#E5E7EB',
                                    opacity: fade,
                                    transform: isDecision ? [{ scale: modalScale }] : [{ translateY: sheetY }],
                                },
                            ]}
                        >
                            {!isDecision ? <View style={styles.handle} /> : null}

                            <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
                                <Icon name={tone.icon} size={24} color={tone.fg} />
                            </View>

                            <Text style={[styles.title, { color: isDark ? '#F9FAFB' : '#111827' }]}>
                                {dialog.title}
                            </Text>
                            {dialog.message ? (
                                <Text style={[styles.message, { color: isDark ? '#D1D5DB' : '#6B7280' }]}>
                                    {dialog.message}
                                </Text>
                            ) : null}

                            <View style={[
                                styles.buttonRow,
                                isDecision && dialog.buttons.length <= 2 ? styles.buttonRowInline : styles.buttonRowStack,
                            ]}>
                                {dialog.buttons.map(renderButton)}
                            </View>
                        </Animated.View>
                    </View>
                ) : null}
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    portal: {
        flex: 1,
        paddingHorizontal: 16,
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    bottomContent: {
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 18,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.52)',
    },
    card: {
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
        elevation: 18,
    },
    modalCard: {
        borderRadius: 22,
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 18,
        alignItems: 'flex-start',
    },
    sheetCard: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: 20,
        alignItems: 'flex-start',
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: '#D1D5DB',
        alignSelf: 'center',
        marginBottom: 14,
    },
    iconWrap: {
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 20,
        lineHeight: 26,
        fontWeight: '900',
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        lineHeight: 21,
        fontWeight: '600',
        marginBottom: 18,
    },
    buttonRow: {
        width: '100%',
    },
    buttonRowInline: {
        flexDirection: 'row',
        gap: 10,
    },
    buttonRowStack: {
        gap: 10,
    },
    button: {
        minHeight: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    buttonInline: {
        flex: 1,
    },
    buttonFull: {
        width: '100%',
    },
    buttonPrimary: {
        backgroundColor: '#2563EB',
    },
    buttonDanger: {
        backgroundColor: '#EF4444',
    },
    buttonCancel: {
        backgroundColor: '#F3F4F6',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '900',
    },
    buttonPrimaryText: {
        color: '#FFFFFF',
    },
    buttonCancelText: {
        color: '#4B5563',
    },
});
