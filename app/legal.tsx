import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme-context";

const PRIVACY_POLICY = [
  { type: "updated", text: "Last updated: February 2026" },
  { type: "heading", text: "1. Information We Collect" },
  { type: "paragraph", text: "When you use LiftFlow, we collect the following types of information:" },
  { type: "bullet", text: "Account information: Your email address, name, and hashed password when you create an account." },
  { type: "bullet", text: "Profile information: Your profile picture (optional), role selection (coach or client), and preferred weight unit." },
  { type: "bullet", text: "Workout data: Exercises, weights, sets, reps, RPE values, workout notes, and coach comments stored within your training programs." },
  { type: "bullet", text: "Personal records (PRs): Squat, bench press, and deadlift records you choose to log." },
  { type: "bullet", text: "Form check videos: Training videos you record and upload through the app for coach review." },
  { type: "bullet", text: "Messages: Chat messages exchanged between coaches and clients within the app." },
  { type: "bullet", text: "Usage data: Basic information about how you interact with the app, such as login timestamps." },
  { type: "heading", text: "2. How We Use Your Data" },
  { type: "paragraph", text: "We use your information solely to provide and improve the LiftFlow service:" },
  { type: "bullet", text: "To create and manage your account" },
  { type: "bullet", text: "To sync your workout programs, personal records, and messages across your devices" },
  { type: "bullet", text: "To facilitate the coach-client relationship, including program sharing and form check reviews" },
  { type: "bullet", text: "To display your profile picture to your connected coach or clients" },
  { type: "bullet", text: "To send you relevant in-app notifications about your training" },
  { type: "heading", text: "3. Data Storage & Security" },
  { type: "paragraph", text: "Your data is securely stored on our servers using industry-standard security practices. Passwords are hashed using bcrypt and are never stored in plain text. All data is transmitted over encrypted HTTPS connections. We take reasonable technical and organizational measures to protect your information from unauthorized access, alteration, or destruction." },
  { type: "heading", text: "4. Video Uploads & Auto-Deletion" },
  { type: "paragraph", text: "Form check videos you upload are stored on our servers and are only accessible by you and your connected coach. Videos are not shared publicly or with any other users. To protect your privacy and manage storage, videos are automatically deleted according to the following schedule:" },
  { type: "bullet", text: "3 days after your coach views the video" },
  { type: "bullet", text: "7 days after upload if the video has not been viewed by your coach" },
  { type: "heading", text: "5. Profile Pictures" },
  { type: "paragraph", text: "If you upload a profile picture, it is visible to your connected coach (if you are a client) or your connected clients (if you are a coach). When you upload a new profile picture, the previous one is automatically deleted. You can remove your profile picture at any time from the Profile screen." },
  { type: "heading", text: "6. Third-Party Sharing" },
  { type: "paragraph", text: "We do not sell, rent, or share your personal data with third parties for marketing or advertising purposes. Your information stays within LiftFlow and is used solely to provide our service to you. We do not use third-party analytics or advertising SDKs." },
  { type: "heading", text: "7. Data Retention" },
  { type: "paragraph", text: "We retain your account data for as long as your account is active. If you delete your account, all associated data — including your profile, programs, personal records, messages, videos, and profile picture — is permanently and immediately deleted from our servers. This action cannot be undone." },
  { type: "heading", text: "8. Your Rights" },
  { type: "paragraph", text: "You have the right to:" },
  { type: "bullet", text: "Access your personal data through the app at any time" },
  { type: "bullet", text: "Update your personal information (name, profile picture, weight unit) from the Profile screen" },
  { type: "bullet", text: "Delete your account and all associated data permanently from the Profile screen" },
  { type: "bullet", text: "Request a copy of your data by contacting us at the email below" },
  { type: "heading", text: "9. Children's Privacy" },
  { type: "paragraph", text: "LiftFlow is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete that information promptly." },
  { type: "heading", text: "10. Changes to This Policy" },
  { type: "paragraph", text: "We may update this Privacy Policy from time to time. When we make significant changes, we will notify you through the app or by updating the \"Last updated\" date at the top of this page." },
  { type: "heading", text: "11. Contact Us" },
  { type: "paragraph", text: "If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at support@liftflow.app." },
];

const TERMS_OF_SERVICE = [
  { type: "updated", text: "Last updated: February 2026" },
  { type: "heading", text: "1. Acceptance of Terms" },
  { type: "paragraph", text: "By creating an account or using LiftFlow, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, please do not use the app." },
  { type: "heading", text: "2. Eligibility" },
  { type: "paragraph", text: "You must be at least 13 years old to create an account and use LiftFlow. If you are between 13 and 18 years old, you must have the consent of a parent or legal guardian. By using the app, you represent that you meet these age requirements." },
  { type: "heading", text: "3. Description of Service" },
  { type: "paragraph", text: "LiftFlow is a fitness coaching platform that connects coaches and clients. Coaches can create and assign training programs, review form-check videos, and communicate with clients through in-app messaging. The service is provided for personal, non-commercial fitness coaching purposes." },
  { type: "heading", text: "4. User Accounts" },
  { type: "paragraph", text: "You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You agree to:" },
  { type: "bullet", text: "Provide accurate and complete information when creating your account" },
  { type: "bullet", text: "Keep your password secure and not share it with others" },
  { type: "bullet", text: "Notify us immediately of any unauthorized use of your account" },
  { type: "paragraph", text: "LiftFlow is not liable for any loss or damage resulting from unauthorized access to your account." },
  { type: "heading", text: "5. User Content" },
  { type: "paragraph", text: "You retain ownership of all content you create or upload to LiftFlow, including workout data, training videos, profile pictures, and notes. By using the service, you grant LiftFlow a limited, non-exclusive license to store, process, and display your content as necessary to provide the service. This license ends when you delete your content or your account." },
  { type: "heading", text: "6. Acceptable Use" },
  { type: "paragraph", text: "You agree not to use LiftFlow to:" },
  { type: "bullet", text: "Harass, abuse, or threaten other users" },
  { type: "bullet", text: "Upload harmful, offensive, inappropriate, or illegal content" },
  { type: "bullet", text: "Attempt to gain unauthorized access to other accounts or systems" },
  { type: "bullet", text: "Reverse-engineer, decompile, or attempt to extract the source code of the app" },
  { type: "bullet", text: "Use the platform for any purpose other than its intended fitness coaching functionality" },
  { type: "bullet", text: "Create multiple accounts for the purpose of abuse or circumventing restrictions" },
  { type: "heading", text: "7. Coach-Client Relationship" },
  { type: "paragraph", text: "LiftFlow is a platform that facilitates communication between coaches and clients. LiftFlow does not employ, endorse, or certify any coaches on the platform. LiftFlow is not a medical provider, fitness advisor, or healthcare professional. Any fitness advice provided through the platform is the sole responsibility of the coach providing it. Always consult a qualified medical professional before starting any exercise program." },
  { type: "heading", text: "8. Account Deletion" },
  { type: "paragraph", text: "You may delete your account at any time from the Profile screen within the app. Upon deletion, all of your data — including your profile, programs, personal records, messages, videos, and profile picture — will be permanently and immediately removed from our servers. This action cannot be undone." },
  { type: "heading", text: "9. Termination" },
  { type: "paragraph", text: "We reserve the right to suspend or terminate your account at any time if we reasonably believe you have violated these Terms of Service. Upon termination, your right to use LiftFlow will immediately cease." },
  { type: "heading", text: "10. Disclaimer of Warranties" },
  { type: "paragraph", text: "LiftFlow is provided \"as is\" and \"as available\" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that the service will be uninterrupted, secure, or error-free." },
  { type: "heading", text: "11. Limitation of Liability" },
  { type: "paragraph", text: "To the fullest extent permitted by applicable law, LiftFlow and its owners, operators, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service, including but not limited to any injuries sustained during workouts, loss of data, or service interruptions." },
  { type: "heading", text: "12. Governing Law" },
  { type: "paragraph", text: "These Terms of Service shall be governed by and construed in accordance with the laws of the jurisdiction in which LiftFlow operates, without regard to its conflict of law provisions." },
  { type: "heading", text: "13. Changes to Terms" },
  { type: "paragraph", text: "We may update these Terms of Service from time to time. When we make significant changes, we will update the \"Last updated\" date at the top of this page. Continued use of LiftFlow after changes are posted constitutes your acceptance of the revised terms." },
  { type: "heading", text: "14. Contact Us" },
  { type: "paragraph", text: "If you have any questions about these Terms of Service, please contact us at support@liftflow.app." },
];

export default function LegalScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";
  const content = isPrivacy ? PRIVACY_POLICY : TERMS_OF_SERVICE;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {content.map((item, index) => {
          if (item.type === "updated") {
            return <Text key={index} style={[styles.updated, { color: colors.textMuted }]}>{item.text}</Text>;
          }
          if (item.type === "heading") {
            return <Text key={index} style={[styles.sectionHeading, { color: colors.text }]}>{item.text}</Text>;
          }
          if (item.type === "bullet") {
            return (
              <View key={index} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: colors.primary }]}>{"\u2022"}</Text>
                <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{item.text}</Text>
              </View>
            );
          }
          return <Text key={index} style={[styles.paragraph, { color: colors.textSecondary }]}>{item.text}</Text>;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 32, alignItems: "flex-start" },
  headerTitle: { fontFamily: "Rubik_600SemiBold", fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },
  updated: { fontFamily: "Rubik_400Regular", fontSize: 13, marginBottom: 20 },
  sectionHeading: { fontFamily: "Rubik_600SemiBold", fontSize: 16, marginTop: 24, marginBottom: 8 },
  paragraph: { fontFamily: "Rubik_400Regular", fontSize: 14, lineHeight: 22, marginBottom: 12 },
  bulletRow: { flexDirection: "row", paddingLeft: 8, marginBottom: 6 },
  bulletDot: { fontSize: 16, lineHeight: 22, marginRight: 8 },
  bulletText: { fontFamily: "Rubik_400Regular", fontSize: 14, lineHeight: 22, flex: 1 },
});
