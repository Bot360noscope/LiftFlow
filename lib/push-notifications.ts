import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { apiPost, getAuthToken } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(profileId: string): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("[PushNotifications] Permission not granted:", finalStatus);
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "LiftFlow",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E8512F",
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
      "e6d95b82-5700-4441-a590-28af34a5dca5";

    console.log("[PushNotifications] Getting token with projectId:", projectId);
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log("[PushNotifications] Got token:", token);

    const authToken = await getAuthToken();
    if (!authToken) {
      console.log("[PushNotifications] No auth token, skipping registration");
      return null;
    }

    await apiPost("/api/push-token", { profileId, pushToken: token });
    console.log("[PushNotifications] Token registered successfully");
    return token;
  } catch (err: any) {
    console.log("[PushNotifications] Error:", err?.message || err);
    return null;
  }
}

export function setupNotificationResponseHandler(
  onNotificationTapped: (data: Record<string, any>) => void
) {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      if (data) {
        onNotificationTapped(data as Record<string, any>);
      }
    }
  );
  return subscription;
}
