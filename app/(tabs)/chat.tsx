import { StyleSheet, Text, View, FlatList, Pressable, Platform, TextInput, KeyboardAvoidingView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { getProfile, getMessages, sendMessage, getMyCoach, type ChatMessage, type UserProfile } from "@/lib/storage";

export default function ChatTab() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
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
  const flatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const prof = await getProfile();
          if (!active) return;
          setProfile(prof);

          if (prof.role === 'coach') {
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
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyContent}>
            <Ionicons name="chatbubbles-outline" size={56} color={Colors.colors.textMuted} />
            <Text style={styles.emptyTitle}>Coach Chat</Text>
            <Text style={styles.emptySubtitle}>Open a client's profile and tap the chat button to message them.</Text>
          </Animated.View>
        </View>
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + webTopInset }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom + (Platform.OS === 'web' ? 84 : 50), Platform.OS === 'web' ? 34 : 8) }]}>
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
    </KeyboardAvoidingView>
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
});
