import { StyleSheet, Text, View, FlatList, Pressable, Platform, TextInput, Keyboard, ActivityIndicator, Image, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback, useRef } from "react";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getProfile, getMessages, sendMessage, getMyCoach, getClients, getLatestMessages, type ChatMessage, type UserProfile, type ClientInfo, type LatestMessages } from "@/lib/storage";
import { getAvatarUrl } from "@/lib/api";

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ChatTab() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const webBottomInset = Platform.OS === 'web' ? 84 : 0;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [chatPartnerName, setChatPartnerName] = useState('Coach');
  const [coachId, setCoachId] = useState('');
  const [clientProfileId, setClientProfileId] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasCoach, setHasCoach] = useState(false);
  const [sendError, setSendError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const [coachClients, setCoachClients] = useState<ClientInfo[]>([]);
  const [latestMsgs, setLatestMsgs] = useState<LatestMessages>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const prof = await getProfile();
          if (!active) return;
          setProfile(prof);

          if (prof.role === 'coach') {
            const [cls, latest] = await Promise.all([
              getClients().catch(() => [] as ClientInfo[]),
              getLatestMessages().catch(() => ({} as LatestMessages)),
            ]);
            if (!active) return;
            setCoachClients(cls);
            setLatestMsgs(latest);
            setLoading(false);
            return;
          }

          const coachInfo = await getMyCoach();
          if (!active) return;
          if (coachInfo) {
            setHasCoach(true);
            setCoachId(coachInfo.coachId);
            setClientProfileId(prof.id);
            setChatPartnerName(coachInfo.coachName);
            const msgs = await getMessages(coachInfo.coachId, prof.id);
            if (active) setMessages(msgs);
          } else {
            setHasCoach(false);
          }
        } catch (e) {
          console.warn('Chat init error:', e);
        }
        if (active) setLoading(false);
      })();
      return () => { active = false; };
    }, [])
  );

  useEffect(() => {
    if (!coachId || !clientProfileId) return;
    const interval = setInterval(async () => {
      try {
        const msgs = await getMessages(coachId, clientProfileId);
        setMessages(msgs);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [coachId, clientProfileId]);

  useEffect(() => {
    if (profile?.role !== 'coach') return;
    const interval = setInterval(async () => {
      try {
        const latest = await getLatestMessages();
        setLatestMsgs(latest);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [profile?.role]);

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
    } catch (e: any) {
      setInput(text);
      setSendError(e.message || 'Failed to send');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setSending(false);
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderRole === (profile?.role || 'client');
    return (
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        <Text style={[styles.bubbleText, isMe ? styles.myBubbleText : styles.theirBubbleText]}>{item.text}</Text>
        <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.colors.primary} />
      </View>
    );
  }

  if (profile?.role === 'coach') {
    const sortedClients = [...coachClients].sort((a, b) => {
      const aMsg = latestMsgs[a.clientProfileId || ''];
      const bMsg = latestMsgs[b.clientProfileId || ''];
      if (aMsg && bMsg) return new Date(bMsg.createdAt).getTime() - new Date(aMsg.createdAt).getTime();
      if (aMsg) return -1;
      if (bMsg) return 1;
      return 0;
    });

    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        {sortedClients.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyContent}>
              <Ionicons name="chatbubbles-outline" size={56} color={Colors.colors.textMuted} />
              <Text style={styles.emptyTitle}>No Clients Yet</Text>
              <Text style={styles.emptySubtitle}>Once clients join with your coach code, they'll appear here for messaging.</Text>
            </Animated.View>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 20 }}
            showsVerticalScrollIndicator={false}
          >
            {sortedClients.map((client, idx) => {
              const latest = latestMsgs[client.clientProfileId || ''];
              return (
                <TouchableOpacity
                  key={client.id}
                  style={styles.clientRow}
                  activeOpacity={0.6}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/conversation', params: { coachId: profile.id, clientProfileId: client.clientProfileId || '', clientName: client.name } });
                  }}
                  accessibilityLabel={`Chat with ${client.name}`}
                  accessibilityRole="button"
                >
                  {client.avatarUrl ? (
                    <Image source={{ uri: getAvatarUrl(client.avatarUrl) }} style={styles.clientAvatar} />
                  ) : (
                    <View style={styles.clientAvatarFallback}>
                      <Text style={styles.clientAvatarText}>{(client.name || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.clientInfo}>
                    <View style={styles.clientNameRow}>
                      <Text style={styles.clientName} numberOfLines={1}>{client.name || 'Client'}</Text>
                      {latest && (
                        <Text style={styles.clientTime}>{formatTime(latest.createdAt)}</Text>
                      )}
                    </View>
                    <Text style={styles.clientLastMsg} numberOfLines={1}>
                      {latest
                        ? `${latest.senderRole === 'coach' ? 'You: ' : ''}${latest.text}`
                        : 'No messages yet'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  if (!hasCoach) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyContent}>
            <Ionicons name="person-add-outline" size={56} color={Colors.colors.textMuted} />
            <Text style={styles.emptyTitle}>No Coach Yet</Text>
            <Text style={styles.emptySubtitle}>Join a coach first to start chatting. Go to your Profile and enter a coach code to connect.</Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  const tabBarHeight = Platform.OS === 'web' ? 84 : 50;
  const bottomPadding = Platform.OS === 'web'
    ? 34
    : keyboardHeight > 0
      ? keyboardHeight - tabBarHeight + 55
      : insets.bottom + tabBarHeight;

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + webTopInset }]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={22} color={Colors.colors.primary} />
          <Text style={styles.headerTitle}>{chatPartnerName}</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        scrollEnabled={!!messages.length}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.colors.textMuted} />
            <Text style={styles.emptyMessagesText}>No messages yet. Say hi!</Text>
          </View>
        }
      />

      {sendError ? (
        <View style={styles.errorBar}>
          <Ionicons name="warning" size={14} color={Colors.colors.danger} />
          <Text style={styles.errorText}>{sendError}</Text>
        </View>
      ) : null}
      <View style={[styles.inputRow, { paddingBottom: Math.max(bottomPadding, 8) }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={Colors.colors.textMuted}
          multiline
          accessibilityLabel="Message input"
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontFamily: 'Rubik_700Bold', fontSize: 20, color: Colors.colors.text },
  messagesList: { padding: 16, flexGrow: 1, paddingBottom: 4 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  myBubble: {
    alignSelf: 'flex-end', backgroundColor: Colors.colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start', backgroundColor: Colors.colors.backgroundCard,
    borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.colors.border,
  },
  bubbleText: { fontFamily: 'Rubik_400Regular', fontSize: 15, lineHeight: 21 },
  myBubbleText: { color: '#fff' },
  theirBubbleText: { color: Colors.colors.text },
  timestamp: { fontFamily: 'Rubik_400Regular', fontSize: 11, marginTop: 4 },
  myTimestamp: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  theirTimestamp: { color: Colors.colors.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.colors.border,
    backgroundColor: Colors.colors.backgroundCard,
  },
  input: {
    flex: 1, fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.text,
    backgroundColor: Colors.colors.surface, borderRadius: 20, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10, maxHeight: 100,
    borderWidth: 1, borderColor: Colors.colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyContent: { alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: 'Rubik_700Bold', fontSize: 22, color: Colors.colors.text },
  emptySubtitle: { fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.textMuted, textAlign: 'center', lineHeight: 22 },
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyMessagesText: { fontFamily: 'Rubik_400Regular', fontSize: 15, color: Colors.colors.textMuted },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.1)', borderTopWidth: 1, borderTopColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: { fontFamily: 'Rubik_400Regular', fontSize: 13, color: Colors.colors.danger, flex: 1 },
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.colors.border,
  },
  clientAvatar: { width: 48, height: 48, borderRadius: 24 },
  clientAvatarFallback: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.colors.surfaceLight,
    alignItems: 'center', justifyContent: 'center',
  },
  clientAvatarText: { fontFamily: 'Rubik_700Bold', fontSize: 18, color: Colors.colors.primary },
  clientInfo: { flex: 1 },
  clientNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clientName: { fontFamily: 'Rubik_600SemiBold', fontSize: 16, color: Colors.colors.text, flex: 1 },
  clientTime: { fontFamily: 'Rubik_400Regular', fontSize: 12, color: Colors.colors.textMuted, marginLeft: 8 },
  clientLastMsg: { fontFamily: 'Rubik_400Regular', fontSize: 14, color: Colors.colors.textMuted, marginTop: 2 },
});
