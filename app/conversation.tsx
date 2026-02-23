import { StyleSheet, Text, View, FlatList, Pressable, Platform, TextInput, Keyboard, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { getProfile, getMessages, sendMessage, getMyCoach, getNotifications, markNotificationRead, type ChatMessage, type UserProfile } from "@/lib/storage";
import { addWSListener } from "@/lib/websocket";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ clientId?: string; clientName?: string; clientProfileId?: string; coachId?: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState(params.clientName || 'Chat');
  const [coachId, setCoachId] = useState('');
  const [clientProfileId, setClientProfileId] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    (async () => {
      try {
        const prof = await getProfile();
        setProfile(prof);

        let resolvedCoachId = '';
        let resolvedClientProfileId = '';

        if (prof.role === 'coach') {
          resolvedCoachId = prof.id;
          resolvedClientProfileId = params.clientProfileId || '';
          setChatPartnerName(params.clientName || 'Client');
        } else {
          resolvedClientProfileId = prof.id;
          const coachInfo = await getMyCoach();
          if (coachInfo) {
            resolvedCoachId = coachInfo.coachId;
            setChatPartnerName(coachInfo.coachName);
          }
        }

        setCoachId(resolvedCoachId);
        setClientProfileId(resolvedClientProfileId);

        if (resolvedCoachId && resolvedClientProfileId) {
          const msgs = await getMessages(resolvedCoachId, resolvedClientProfileId);
          setMessages(msgs);
          getNotifications().then(notifs => {
            notifs.filter(n => n.type === 'chat' && !n.read && n.programTitle === resolvedClientProfileId)
              .forEach(n => markNotificationRead(n.id).catch(() => {}));
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Chat init error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const loadMessages = useCallback(async () => {
    if (!coachId || !clientProfileId) return;
    try {
      const msgs = await getMessages(coachId, clientProfileId);
      setMessages(msgs);
    } catch (e) {}
  }, [coachId, clientProfileId]);

  useEffect(() => {
    if (!coachId || !clientProfileId) return;
    const removeListener = addWSListener((event: any) => {
      if (event.type === 'new_message' && event.message) {
        const m = event.message;
        if (m.coachId === coachId && m.clientProfileId === clientProfileId) {
          setMessages(prev => {
            if (prev.some(p => p.id === m.id)) return prev;
            return [...prev, m];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
      if (event.type === 'message_sent' && event.message) {
        const m = event.message;
        if (m.coachId === coachId && m.clientProfileId === clientProfileId) {
          setMessages(prev => {
            if (prev.some(p => p.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      }
    });
    const interval = setInterval(loadMessages, 15000);
    return () => { removeListener(); clearInterval(interval); };
  }, [coachId, clientProfileId, loadMessages]);

  const handleSend = async () => {
    if (!input.trim() || !coachId || !clientProfileId || sending) return;
    setSending(true);
    setSendError('');
    const text = input.trim();
    setInput('');
    try {
      const msg = await sendMessage(coachId, clientProfileId, text);
      setMessages(prev => [...prev, msg]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setInput(text);
      setSendError(e.message || 'Failed to send');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setSending(false);
  };

  const isCoach = profile?.role === 'coach';
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const noCoach = !loading && !coachId && !isCoach;

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderRole === profile?.role;
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageBubbleRow, isMe && styles.messageBubbleRowMe]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.text}</Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{time}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{(chatPartnerName || '?')[0].toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{chatPartnerName}</Text>
            <Text style={styles.headerRole}>{isCoach ? 'Client' : 'Coach'}</Text>
          </View>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {noCoach ? (
        <View style={styles.emptyChat}>
          <Ionicons name="people-outline" size={40} color={Colors.colors.textMuted} />
          <Text style={styles.emptyChatText}>No coach connected</Text>
          <Text style={styles.emptyChatSub}>Join a coach first to start chatting</Text>
          <Pressable style={styles.joinBtn} onPress={() => router.push('/join-coach')}>
            <Text style={styles.joinBtnText}>Join Coach</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={[styles.messagesList, { paddingBottom: 12 }]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={40} color={Colors.colors.textMuted} />
                <Text style={styles.emptyChatText}>No messages yet</Text>
                <Text style={styles.emptyChatSub}>Start the conversation!</Text>
              </View>
            }
          />

          {sendError ? (
            <View style={styles.errorBar}>
              <Ionicons name="warning" size={14} color={Colors.colors.danger} />
              <Text style={styles.errorText}>{sendError}</Text>
            </View>
          ) : null}
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={Colors.colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="send" size={18} color={input.trim() && !sending ? '#fff' : Colors.colors.textMuted} />
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.colors.border,
    backgroundColor: Colors.colors.backgroundCard,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(232,81,47,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarText: { fontFamily: 'Rubik_700Bold', fontSize: 14, color: Colors.colors.primary },
  headerName: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: Colors.colors.text },
  headerRole: { fontFamily: 'Rubik_400Regular', fontSize: 11, color: Colors.colors.textMuted },
  messagesList: { paddingHorizontal: 16, paddingTop: 16 },
  messageBubbleRow: { flexDirection: 'row', marginBottom: 8, justifyContent: 'flex-start' },
  messageBubbleRowMe: { justifyContent: 'flex-end' },
  messageBubble: {
    maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  messageBubbleMe: {
    backgroundColor: Colors.colors.primary, borderBottomRightRadius: 4,
  },
  messageBubbleThem: {
    backgroundColor: Colors.colors.backgroundCard, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  messageText: { fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text, lineHeight: 20 },
  messageTextMe: { color: '#fff' },
  messageTime: { fontFamily: 'Rubik_400Regular', fontSize: 10, color: Colors.colors.textMuted, marginTop: 4, textAlign: 'right' },
  messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyChatText: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: Colors.colors.textSecondary },
  emptyChatSub: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.textMuted },
  joinBtn: {
    backgroundColor: Colors.colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8,
  },
  joinBtnText: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: '#fff' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.colors.border,
    backgroundColor: Colors.colors.backgroundCard,
  },
  textInput: {
    flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text,
    backgroundColor: Colors.colors.background, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.colors.surfaceLight },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)', borderTopWidth: 1, borderTopColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.danger, flex: 1 },
});
