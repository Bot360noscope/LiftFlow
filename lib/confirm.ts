import { Alert, Platform } from "react-native";

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void | Promise<void>,
  confirmText = "OK",
) {
  if (Platform.OS === 'web') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
}

export function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}
