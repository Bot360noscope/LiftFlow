import { StyleSheet, Text, View, FlatList, Pressable, Platform, TextInput, Keyboard, KeyboardAvoidingView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useTheme } from "@/lib/theme-context";
import { getProfile, getMessages, sendMessage, getMyCoach, getNotifications, markNotificationRead, getClients, appendMessageToCache, type ChatMessage, type UserProfile } from "@/lib/storage";
import { addWSListener } from "@/lib/websocket";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [planLocked, setPlanLocked] = useState(false);
  const [planLockMessage, setPlanLockMessage] = useState('');
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
          const result = await getMessages(resolvedCoachId, resolvedClientProfileId);
          setMessages(result.messages);
          setHasMore(result.hasMore);
          getNotifications().then(notifs => {
            notifs.filter(n => n.type === 'chat' && !n.read && n.programTitle === resolvedClientProfileId)
              .forEach(n => markNotificationRead(n.id).catch(() => {}));
          }).catch(() => {});
        }
        if (prof.role === 'coach') {
          try {
            const clientList = await getClients();
            const limit = prof.planUserLimit || 1;
            if (clientList.length > limit) {
              setPlanLocked(true);
              setPlanLockMessage(`Your plan supports ${limit} client${limit !== 1 ? 's' : ''} but you have ${clientList.length}. Upgrade to send messages.`);
            }
          } catch {}
        }
      } catch (e) {
        console.warn('Chat init error:', e);
      }
      setLoading(false);
    })();
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!coachId || !clientProfileId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0]?.createdAt;
      const result = await getMessages(coachId, clientProfileId, oldest);
      setMessages(prev => [...result.messages, ...prev]);
      setHasMore(result.hasMore);
    } catch (e) {}
    setLoadingMore(false);
  }, [coachId, clientProfileId, hasMore, loadingMore, messages]);

  const loadMessages = useCallback(async () => {
    if (!coachId || !clientProfileId) return;
    try {
      const result = await getMessages(coachId, clientProfileId);
      setMessages(result.messages);
      setHasMore(result.hasMore);
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
          appendMessageToCache(coachId, clientProfileId, m);
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
          appendMessageToCache(coachId, clientProfileId, m);
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
        <View style={[styles.messageBubble, isMe ? [styles.messageBubbleMe, { backgroundColor: colors.primary }] : [styles.messageBubbleThem, { backgroundColor: colors.backgroundCard, borderColor: colors.border }]]}>
          <Text style={[styles.messageText, { color: colors.text }, isMe && styles.messageTextMe]}>{item.text}</Text>
          <Text style={[styles.messageTime, { color: colors.textMuted }, isMe && styles.messageTimeMe]}>{time}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 8, backgroundColor: colors.backgroundCard, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Text style={[styles.headerAvatarText, { color: colors.primary }]}>{(chatPartnerName || '?')[0].toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{chatPartnerName}</Text>
            <Text style={[styles.headerRole, { color: colors.textMuted }]}>{isCoach ? 'Client' : 'Coach'}</Text>
          </View>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {noCoach ? (
        <View style={styles.emptyChat}>
          <Ionicons name="people-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>No coach connected</Text>
          <Text style={[styles.emptyChatSub, { color: colors.textMuted }]}>Join a coach first to start chatting</Text>
          <Pressable style={[styles.joinBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/join-coach')}>
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
            onStartReachedThreshold={0.1}
            ListHeaderComponent={hasMore ? (
              <Pressable onPress={loadOlderMessages} style={styles.loadMoreBtn}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load earlier messages</Text>
                )}
              </Pressable>
            ) : null}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyChatText, { color: colors.textSecondary }]}>No messages yet</Text>
                <Text style={[styles.emptyChatSub, { color: colors.textMuted }]}>Start the conversation!</Text>
              </View>
            }
          />

          {sendError ? (
            <View style={styles.errorBar}>
              <Ionicons name="warning" size={14} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{sendError}</Text>
            </View>
          ) : null}
          {planLocked ? (
            <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.danger + '12', borderTopColor: colors.danger + '30' }]}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <Ionicons name="lock-closed" size={16} color={colors.danger} />
                <Text style={{ flex: 1, color: colors.danger, fontSize: 12, fontFamily: 'Rubik_400Regular' }}>{planLockMessage}</Text>
              </View>
            </View>
          ) : (
          <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: colors.backgroundCard, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || sending) && [styles.sendBtnDisabled, { backgroundColor: colors.surfaceLight }]]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="send" size={18} color={input.trim() && !sending ? '#fff' : colors.textMuted} />
            </Pressable>
          </View>
          )}
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
  loadMoreBtn: { alignItems: 'center', paddingVertical: 12 },
  loadMoreText: { fontFamily: 'Rubik_500Medium', fontSize: 13, color: Colors.colors.primary },
});
